import type { HistoryEntry, HistoryPreview } from '../../../interfaces/History'
import { addCircle, arrowDown, arrowUp, circleDashed, hide, pin, show, sparkles, trash } from '../../icons'
import type { UIManager } from '../../UIManager'
import { UIComponent } from '../../UIComponent'
import './historymenu.scss'

/** Which end of the timeline a click travels towards. */
type Direction = 'undo' | 'redo'

/** One rendered row: an entry plus where it sits relative to the line. */
interface Row {
    entry: HistoryEntry
    /** `true` when it has been undone — above the line, in redo territory. */
    undone: boolean
    /** How many steps a click on it travels, counted away from the line. */
    steps: number
    direction: Direction
}

/**
 * How many rows at either end of a hovered span get the background wash. A span
 * can be 30 rows deep, and washing all of them paints the whole menu one colour;
 * the rail and the ink still run its full length, so the extent is never in doubt.
 */
const WASH_EDGE = 4

/**
 * The history dropdown.
 *
 * One list from either button, newest at the top, with a *now* line through it:
 * the rows above it have been undone, the rows below are what can still be undone.
 * Clicking a row drags the line past it, which is the same gesture in both
 * directions — and because the span is always the block between the row and the
 * line, the contiguous rule is the shape of the list rather than a caveat about it.
 *
 * It reads `graph.history` through the public API and nothing else.
 */
export class HistoryMenu extends UIComponent {

    /** The two carets, so the menu can keep their `aria-expanded` honest itself. */
    private readonly carets: Record<Direction, HTMLButtonElement>
    private root?: HTMLDivElement
    private scroller?: HTMLDivElement
    private nowLine?: HTMLDivElement
    private side?: HTMLSpanElement
    private counter?: HTMLSpanElement
    private foot?: HTMLDivElement
    private footDir?: HTMLSpanElement
    private footSay?: HTMLSpanElement
    private footDelta?: HTMLSpanElement
    private jumpUp?: HTMLButtonElement
    private jumpDown?: HTMLButtonElement

    /** Newest first: the undone entries, then the ones still standing. */
    private rows: Row[] = []
    /** How many of {@link rows} sit above the line. */
    private ahead = 0
    private opened = false
    /** Which button opened it — only the accent rail and the resting scroll differ. */
    private openedFrom: Direction = 'undo'
    /** The entry the pointer or the keyboard is aiming at. */
    private armed?: string

    constructor(uiManager: UIManager, carets: Record<Direction, HTMLButtonElement>) {
        super(uiManager)
        this.carets = carets
    }

    protected onMount(container?: HTMLElement): void {
        if (!container) return

        this.root = document.createElement('div')
        this.root.className = 'pvt-history'
        this.root.setAttribute('role', 'menu')
        this.root.setAttribute('aria-label', 'Graph history')
        this.root.tabIndex = -1
        this.root.dataset.side = 'undo'

        const head = document.createElement('div')
        head.className = 'pvt-history-head'
        const title = document.createElement('span')
        title.className = 'pvt-history-title'
        title.textContent = 'History'
        this.side = document.createElement('span')
        this.side.className = 'pvt-history-side'
        this.counter = document.createElement('span')
        this.counter.className = 'pvt-history-count'
        head.append(title, this.side, this.counter)

        const wrap = document.createElement('div')
        wrap.className = 'pvt-history-scrollwrap'
        this.jumpUp = this.buildJump('top', arrowUp)
        this.jumpDown = this.buildJump('bottom', arrowDown)
        this.scroller = document.createElement('div')
        this.scroller.className = 'pvt-history-scroll'
        wrap.append(this.jumpUp, this.jumpDown, this.scroller)

        this.foot = document.createElement('div')
        this.foot.className = 'pvt-history-foot idle'
        this.footDir = document.createElement('span')
        this.footDir.className = 'pvt-history-dir'
        this.footSay = document.createElement('span')
        this.footSay.className = 'pvt-history-say'
        this.footDelta = document.createElement('span')
        this.footDelta.className = 'pvt-history-delta'
        this.foot.append(this.footDir, this.footSay, this.footDelta)

        this.root.append(head, wrap, this.foot)
        container.appendChild(this.root)
    }

    protected onAfterMount(): void {
        const { root, scroller } = this
        if (!root || !scroller) return

        this.listen(scroller, 'pointerover', event => this.aimAt(this.rowUnder(event)))
        this.listen(scroller, 'pointerleave', () => this.aimAt(undefined))
        this.listen(scroller, 'click', event => {
            const row = this.rowUnder(event)
            if (row) this.travel(row)
        })
        this.listen(scroller, 'scroll', () => this.paintJumps())
        this.listen(root, 'keydown', event => this.onKeydown(event as KeyboardEvent))
        // A click anywhere else is a dismissal. Captured, so a control that stops
        // propagation cannot leave the menu stranded open.
        this.listen(document, 'pointerdown', event => {
            if (!this.opened) return
            const target = event.target as globalThis.Node | null
            if (target && (root.contains(target) || this.isOwnButton(target))) return
            this.close()
        }, true)

        this.track(this.uiManager.graph.history.on(() => {
            if (this.opened) this.render()
        }))
    }

    protected onDestroy(): void {
        this.uiManager.graph.renderer.clearEmphasis()
        this.root?.remove()
        this.root = undefined
    }

    /* ---------- opening and closing ---------- */

    public isOpen(): boolean {
        return this.opened
    }

    public toggle(from: Direction): void {
        if (this.opened && this.openedFrom === from) {
            this.close()
            return
        }
        this.openedFrom = from
        if (!this.opened) {
            this.opened = true
            this.root?.classList.add('open')
        }
        this.render()
        this.restingScroll()
        this.root?.focus()
        this.paintCarets()
    }

    public close(): void {
        if (!this.opened) return
        this.opened = false
        this.armed = undefined
        this.root?.classList.remove('open')
        this.uiManager.graph.renderer.clearEmphasis()
        this.paintCarets()
    }

    private paintCarets(): void {
        for (const side of ['undo', 'redo'] as Direction[]) {
            this.carets[side].setAttribute(
                'aria-expanded',
                String(this.opened && this.openedFrom === side),
            )
        }
    }

    /* ---------- rendering ---------- */

    private render(): void {
        const history = this.uiManager.graph.history
        const undone = history.redoable()
        const done = history.entries()

        this.ahead = undone.length
        this.rows = [
            ...undone.map((entry, i) => ({
                entry, undone: true, steps: undone.length - i, direction: 'redo' as Direction,
            })),
            ...done.map((entry, i) => ({
                entry, undone: false, steps: i + 1, direction: 'undo' as Direction,
            })),
        ]
        // The row the pointer was on may be gone — a travel rewrote the list.
        if (this.armed && !this.rows.some(row => row.entry.id === this.armed)) this.armed = undefined

        const scroller = this.scroller
        if (!scroller) return
        scroller.replaceChildren()

        if (!this.rows.length) {
            scroller.append(this.buildNowLine(), terminal('Nothing has happened yet'))
        } else {
            if (!this.ahead) scroller.appendChild(terminal('Nothing ahead — nothing has been undone'))
            // The line sits immediately above the first row that is still standing, so
            // with nothing undone it is the first thing in the list.
            this.rows.forEach((row, index) => {
                if (index === this.ahead) scroller.appendChild(this.buildNowLine())
                scroller.appendChild(this.buildRow(row))
            })
            if (this.ahead === this.rows.length) scroller.appendChild(this.buildNowLine())
            scroller.appendChild(terminal('The start of the session'))
        }

        this.nowLine = scroller.querySelector('.pvt-history-now') as HTMLDivElement ?? undefined
        const total = this.rows.length
        if (this.counter) {
            this.counter.textContent = total >= 30
                ? `${total} of 30 · oldest evicted`
                : `${total} of 30`
        }
        this.decorate()
    }

    private buildRow(row: Row): HTMLDivElement {
        const { entry } = row
        const element = document.createElement('div')
        // Sealed *and* above the line: undone by position, applied in fact.
        const kept = entry.sealed && row.undone
        element.className = [
            'pvt-history-row', `kind-${entry.kind}`, row.undone ? 'undone' : 'done',
            entry.sealed ? 'sealed' : '', kept ? 'kept' : '',
        ].filter(Boolean).join(' ')
        element.dataset.entry = entry.id
        element.setAttribute('role', 'menuitem')
        element.tabIndex = -1

        const steps = document.createElement('span')
        steps.className = 'pvt-history-step'
        steps.textContent = String(row.steps)

        const icon = document.createElement('span')
        icon.className = 'pvt-history-icon'
        icon.innerHTML = kindIcon(entry)

        const main = document.createElement('span')
        main.className = 'pvt-history-main'
        const label = document.createElement('span')
        label.className = 'pvt-history-label'
        label.textContent = rowLabel(entry)
        const detail = document.createElement('span')
        detail.className = 'pvt-history-detail'
        detail.textContent = rowDetail(entry)
        main.append(label, detail)

        const chip = document.createElement('span')
        if (entry.sealed) {
            chip.className = 'pvt-history-chip'
            chip.innerHTML = pin
            chip.append(kept ? 'kept' : 'saved')
        }

        const time = document.createElement('span')
        time.className = 'pvt-history-time'
        time.textContent = elapsed(entry.at)

        const ghost = document.createElement('span')
        ghost.className = 'pvt-history-ghost'

        element.append(steps, icon, main, chip, time, ghost)
        return element
    }

    private buildNowLine(): HTMLDivElement {
        const line = document.createElement('div')
        line.className = 'pvt-history-now'
        const pill = document.createElement('span')
        pill.className = 'pvt-history-now-pill'
        pill.textContent = 'NOW'
        const meta = document.createElement('span')
        meta.className = 'pvt-history-now-meta'
        meta.textContent = `${this.ahead} undone · ${this.rows.length - this.ahead} done`
        line.append(pill, meta)
        return line
    }

    private buildJump(edge: 'top' | 'bottom', icon: string): HTMLButtonElement {
        const button = document.createElement('button')
        button.type = 'button'
        button.className = `pvt-history-jump ${edge}`
        button.innerHTML = icon
        button.append('NOW')
        button.title = 'Scroll back to now'
        button.addEventListener('click', () => this.scrollToNow('center'))
        return button
    }

    /* ---------- the armed span ---------- */

    private aimAt(entryId?: string): void {
        if (this.armed === entryId) return
        this.armed = entryId
        this.decorate()
    }

    /** Mark the span, state its effect in the footer, and light it on the canvas. */
    private decorate(): void {
        const scroller = this.scroller
        if (!scroller) return
        for (const element of scroller.querySelectorAll('.pvt-history-row')) {
            element.classList.remove(
                'in-span', 'washed', 'armed', 'preview-remove', 'preview-restore',
                'preview-kept', 'edge-top', 'edge-bottom', 'noop',
            )
            const ghost = element.querySelector('.pvt-history-ghost')
            if (ghost) ghost.replaceChildren()
        }

        const span = this.spanFor(this.armed)
        if (!span) {
            this.root!.dataset.side = this.openedFrom
            this.paintSideChip(this.openedFrom)
            this.footIdle()
            this.uiManager.graph.renderer.clearEmphasis()
            return
        }

        const { rows, direction } = span
        const preview = this.uiManager.graph.history.preview(this.armed!, direction)
        // The emphasis follows what is being aimed at, not only what opened the menu.
        this.root!.dataset.side = direction
        this.paintSideChip(direction)

        rows.forEach((row, offset) => {
            const element = scroller.querySelector(`[data-entry="${cssEscape(row.entry.id)}"]`)
            if (!element) return
            element.classList.add('in-span')
            if (offset < WASH_EDGE || offset >= rows.length - WASH_EDGE) element.classList.add('washed')
            if (row.entry.sealed) element.classList.add('preview-kept')
            else element.classList.add(direction === 'undo' ? 'preview-remove' : 'preview-restore')
        })

        const armedRow = scroller.querySelector(`[data-entry="${cssEscape(this.armed!)}"]`)
        if (armedRow) {
            armedRow.classList.add('armed')
            // Newest first, so an undo walks *down* into older entries and a redo
            // walks up into the newer ones that were taken back.
            armedRow.classList.add(direction === 'undo' ? 'edge-bottom' : 'edge-top')
            const ghost = armedRow.querySelector('.pvt-history-ghost')
            if (ghost) {
                ghost.innerHTML = direction === 'undo' ? arrowDown : arrowUp
                ghost.append('NOW')
            }
            if (!preview.entries.length || preview.skipped.length === preview.entries.length) {
                armedRow.classList.add('noop')
            }
        }

        this.footSpan(direction, preview)
        this.uiManager.graph.renderer.emphasiseElements([...preview.nodes, ...preview.edges])
    }

    /** The contiguous block between a row and the line — always touching the line. */
    private spanFor(entryId?: string): { rows: Row[], direction: Direction } | undefined {
        if (!entryId) return undefined
        const index = this.rows.findIndex(row => row.entry.id === entryId)
        if (index < 0) return undefined
        return index < this.ahead
            ? { rows: this.rows.slice(index, this.ahead), direction: 'redo' }
            : { rows: this.rows.slice(this.ahead, index + 1), direction: 'undo' }
    }

    private travel(entryId: string): void {
        const span = this.spanFor(entryId)
        if (!span) return
        const history = this.uiManager.graph.history
        if (span.direction === 'undo') history.undo(entryId)
        else history.redo(entryId)
        // `history.on` re-renders; the emphasis is stale the moment the graph moves.
        this.uiManager.graph.renderer.clearEmphasis()
        this.armed = undefined
        this.decorate()
    }

    /* ---------- the footer ---------- */

    private footIdle(): void {
        this.foot?.classList.add('idle')
        if (this.footDir) this.footDir.replaceChildren()
        if (this.footSay) this.footSay.textContent = 'Point at a row to travel there.'
        if (this.footDelta) {
            this.footDelta.textContent = `${this.ahead} ahead · ${this.rows.length - this.ahead} behind`
        }
    }

    private footSpan(direction: Direction, preview: HistoryPreview): void {
        this.foot?.classList.remove('idle')
        if (this.footDir) this.footDir.innerHTML = direction === 'undo' ? arrowDown : arrowUp

        const total = preview.entries.length
        const kept = preview.skipped.length
        const acting = total - kept
        const verb = direction === 'undo' ? 'Undoes' : 'Redoes'
        const say = this.footSay
        if (say) {
            say.replaceChildren()
            if (!acting) {
                say.append(muted('Nothing to reverse'), ` · ${plural(kept, 'saved item')} kept`)
            } else if (kept) {
                const tail = direction === 'undo'
                    ? `${plural(kept, 'saved item')} kept`
                    : `${kept} already applied`
                say.append(`${verb} ${acting} of ${total} `, muted(`· ${tail}`))
            } else {
                say.append(`${verb} ${plural(acting, 'step')}`)
            }
        }
        if (this.footDelta) this.footDelta.textContent = deltaLabel(preview)
    }

    /* ---------- scroll ---------- */

    /**
     * Where the list rests when it opens. Opened from Undo the line goes to the top
     * and the undo stack fills the view below it; opened from Redo it goes low and
     * the undone entries fill the view above. With nothing undone — the common state
     * — the first is already scroll-top, so the reflexive "scroll to top" restores
     * the line rather than losing it.
     */
    private restingScroll(): void {
        this.scrollToNow(this.openedFrom === 'undo' ? 'top' : 'bottom')
    }

    private scrollToNow(mode: 'top' | 'bottom' | 'center'): void {
        const { scroller, nowLine } = this
        if (!scroller || !nowLine) return
        const top = nowLine.offsetTop
        if (mode === 'top') scroller.scrollTop = Math.max(0, top - 46)
        else if (mode === 'bottom') {
            scroller.scrollTop = Math.max(0, top + nowLine.offsetHeight - scroller.clientHeight + 46)
        } else scroller.scrollTop = Math.max(0, top - scroller.clientHeight / 2)
        this.paintJumps()
    }

    /** At thirty rows the line can scroll away; these say which way it went. */
    private paintJumps(): void {
        const { scroller, nowLine, jumpUp, jumpDown } = this
        if (!scroller || !jumpUp || !jumpDown) return
        if (!nowLine) {
            jumpUp.classList.remove('on')
            jumpDown.classList.remove('on')
            return
        }
        const top = nowLine.offsetTop
        jumpUp.classList.toggle('on', top + nowLine.offsetHeight < scroller.scrollTop + 4)
        jumpDown.classList.toggle('on', top > scroller.scrollTop + scroller.clientHeight - 4)
    }

    /* ---------- input ---------- */

    private onKeydown(event: KeyboardEvent): void {
        if (!this.opened) return
        if (event.key === 'Escape') {
            event.stopPropagation()
            event.preventDefault()
            this.close()
            return
        }
        if (event.key === 'Enter' || event.key === ' ') {
            if (!this.armed) return
            event.stopPropagation()
            event.preventDefault()
            this.travel(this.armed)
            return
        }
        const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0
        if (!step || !this.rows.length) return
        event.stopPropagation()
        event.preventDefault()
        const current = this.armed ? this.rows.findIndex(row => row.entry.id === this.armed) : -1
        // From nothing, ArrowDown aims at the next undo and ArrowUp at the next redo:
        // the two rows touching the line.
        const next = current < 0
            ? (step > 0 ? this.ahead : this.ahead - 1)
            : current + step
        const row = this.rows[Math.max(0, Math.min(this.rows.length - 1, next))]
        if (!row) return
        this.aimAt(row.entry.id)
        this.scroller?.querySelector(`[data-entry="${cssEscape(row.entry.id)}"]`)
            ?.scrollIntoView({ block: 'nearest' })
    }

    private rowUnder(event: Event): string | undefined {
        const target = event.target as HTMLElement | null
        return target?.closest('.pvt-history-row')?.getAttribute('data-entry') ?? undefined
    }

    /** The caret buttons live in the header, outside the menu; a click on one is not a dismissal. */
    private isOwnButton(target: globalThis.Node): boolean {
        return Boolean((target as HTMLElement).closest?.('.pvt-undoredo-group'))
    }

    private paintSideChip(direction: Direction): void {
        const chip = this.side
        if (!chip) return
        chip.innerHTML = direction === 'undo' ? arrowDown : arrowUp
        chip.append(direction === 'undo' ? 'Undo side' : 'Redo side')
    }
}

/* ---------- row copy ---------- */

const KIND_ICONS: Record<HistoryEntry['kind'], string> = {
    pivot: sparkles,
    delete: trash,
    visibility: hide,
    create: addCircle,
}

function kindIcon(entry: HistoryEntry): string {
    // A hide and an unhide are the same kind and opposite acts, so the eye flips.
    if (entry.kind === 'visibility') return entry.label.startsWith('Showed') ? show : hide
    return KIND_ICONS[entry.kind]
}

/** Two runs of one pivot must never read as two identical rows, hence the ordinal. */
function rowLabel(entry: HistoryEntry): string {
    if (entry.kind === 'pivot' && entry.ordinal) return `${entry.label} #${entry.ordinal}`
    return entry.label
}

/**
 * What the entry touched, as the row's secondary line — for a pivot only. Every
 * other kind's label already carries its counts (`Deleted 3 nodes`), and repeating
 * them beside it says the same thing twice.
 */
function rowDetail(entry: HistoryEntry): string {
    if (entry.kind !== 'pivot') return ''
    const parts: string[] = []
    if (entry.nodeIds.length) parts.push(plural(entry.nodeIds.length, 'node'))
    if (entry.edgeIds.length) parts.push(plural(entry.edgeIds.length, 'edge'))
    return parts.join(' · ')
}

function deltaLabel(preview: HistoryPreview): string {
    const { effect } = preview
    const nodes = effect.nodesRestored - effect.nodesRemoved
    if (nodes) return `${nodes > 0 ? '+' : '−'}${plural(Math.abs(nodes), 'node')}`
    const shown = effect.nodesShown - effect.nodesHidden
    if (shown) return `${plural(Math.abs(shown), 'node')} ${shown > 0 ? 'back in view' : 'hidden'}`
    const edges = effect.edgesRestored - effect.edgesRemoved
    if (edges) return `${edges > 0 ? '+' : '−'}${plural(Math.abs(edges), 'edge')}`
    return 'nothing changes'
}

function terminal(text: string): HTMLDivElement {
    const element = document.createElement('div')
    element.className = 'pvt-history-terminal'
    element.innerHTML = circleDashed
    element.append(text)
    return element
}

function muted(text: string): HTMLElement {
    const em = document.createElement('em')
    em.textContent = text
    return em
}

function plural(n: number, noun: string): string {
    return `${n.toLocaleString()} ${n === 1 ? noun : `${noun}s`}`
}

function elapsed(at: number): string {
    const minutes = Math.floor((Date.now() - at) / 60_000)
    if (minutes <= 0) return 'now'
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    return `${hours}h${minutes % 60 ? ` ${minutes % 60}m` : ''}`
}

/** Entry ids are generated or provider-supplied, so they cannot be trusted in a selector. */
function cssEscape(value: string): string {
    return typeof CSS?.escape === 'function' ? CSS.escape(value) : value.replace(/["\\]/g, '\\$&')
}
