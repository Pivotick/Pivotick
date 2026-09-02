import type { Node } from '../../../Node'
import type {
    PivotDefinition, PivotFacet, PivotNarrowing, PivotRefusal, PivotSummary,
} from '../../../interfaces/Pivot'
import type { FieldConfig, FieldOption, FormValues } from '../../../utils/FormFactory'
import { FormFactory } from '../../../utils/FormFactory'
import { tryResolveString } from '../../../utils/Getters'
import type { UIManager } from '../../UIManager'

const fmt = (value: number): string => value.toLocaleString()

/** Dock tab ids are namespaced by pivot — the same prefix `PivotTriage` registers under. */
const TRIAGE_TAB_PREFIX = 'pivot-triage:'

/** How long a typed narrowing field waits before it re-asks the provider. */
const TYPED_DELAY_MS = 400

/**
 * How many applicable pivots it takes before the panel grows a filter box, per-entry
 * checkboxes and a run tray.
 *
 * Below this the list is short enough to read, and the controls would be chrome around
 * nothing. Above it neither is true: a backend that registers one pivot per enrichment
 * module puts fifty in the panel at once, none of which can advertise a count, so the
 * list is both long and undifferentiated.
 */
const BULK_MIN = 8

/**
 * How many pivots may be selected before the tray says out loud what running them
 * costs. A caution, not a refusal — the analyst may well mean it, and refusing here
 * would only teach them to tick fewer boxes.
 */
const BATCH_CAUTION = 8

/** The field kinds that commit as you type; everything else commits on `change`. */
const TYPED_FIELDS: ReadonlySet<string> = new Set(['text', 'numberRange'])

/**
 * Pivot mode's panel: the origin, and what can be done to it.
 *
 * It is a persistent element rather than something the tool panel rebuilds, because
 * `RailModeDefinition.render()` is only re-invoked when the panel itself is rebuilt —
 * which a summary landing is not. So this owns its DOM and repaints the parts that
 * changed, leaving the analyst's narrowing controls alone.
 */
export class PivotPanel {
    private readonly root: HTMLElement
    private readonly originBlock: HTMLElement
    private readonly heading: HTMLElement
    private readonly list: HTMLElement
    private readonly originless: HTMLDetailsElement
    private readonly originlessList: HTMLElement

    private readonly entries = new Map<string, PivotEntry>()
    private origin: Node[] = []
    /** True between `onEnter` and `onExit` — the window in which a provider may be called. */
    private active = false
    private readonly unsubscribe: () => void
    private readonly uiManager: UIManager

    /* ---------- the bulk controls, live only past {@link BULK_MIN} ---------- */

    private readonly filterBar: HTMLElement
    private readonly filterInput: HTMLInputElement
    private readonly filterClear: HTMLButtonElement
    private readonly hits: HTMLElement
    private readonly selectAll: HTMLButtonElement
    private readonly tray: HTMLElement
    private readonly trayCount: HTMLButtonElement
    private readonly trayClear: HTMLButtonElement
    private readonly trayRun: HTMLButtonElement
    private readonly trayCaution: HTMLElement
    private readonly noMatches: HTMLElement

    private query = ''
    /**
     * Which pivots are ticked, by id. Deliberately not cleared when the filter changes:
     * if it were, searching would destroy the selection, and building one run out of two
     * searches — the only reason to have both controls — would be impossible.
     */
    private readonly selected = new Set<string>()
    /** Show only what is ticked, ignoring the filter, so nothing can hide off-screen. */
    private reveal = false

    constructor(uiManager: UIManager) {
        this.uiManager = uiManager
        this.root = el('div', 'pvt-pivot-panel')

        this.originBlock = el('div', 'pvt-pivot-origin')
        this.heading = el('div', 'pvt-pivot-section pvt-pivot-heading')
        this.list = el('div', 'pvt-pivot-list')

        this.originless = document.createElement('details')
        this.originless.className = 'pvt-pivot-originless'
        this.originless.appendChild(document.createElement('summary'))
        this.originlessList = el('div', 'pvt-pivot-list')
        this.originless.appendChild(this.originlessList)

        this.filterInput = document.createElement('input')
        this.filterInput.type = 'text'
        this.filterInput.className = 'pvt-pivot-filter-input'
        this.filterInput.placeholder = 'Filter pivots'
        this.filterInput.setAttribute('aria-label', 'Filter pivots')

        this.filterClear = button('Clear the filter', () => {
            this.query = ''
            this.filterInput.value = ''
            this.reveal = false
            this.rebuild()
            this.filterInput.focus()
        })
        this.filterClear.className = 'pvt-pivot-filter-clear'
        this.filterClear.textContent = '×'

        const filterBox = el('div', 'pvt-pivot-filter-box')
        filterBox.append(this.filterInput, this.filterClear)

        this.hits = el('span', 'pvt-pivot-hits')
        this.selectAll = button('', () => this.toggleAllShown())
        this.selectAll.className = 'pvt-pivot-selectall'
        const subbar = el('div', 'pvt-pivot-subbar')
        subbar.append(this.hits, this.selectAll)

        this.filterBar = el('div', 'pvt-pivot-filter')
        this.filterBar.append(filterBox, subbar)

        this.noMatches = el('div', 'pvt-pivot-nomatch')

        // Only the pivots scroll. The origin and the count of what applies to it are
        // what the whole panel is about, so they stay put however long the list gets.
        const scroll = el('div', 'pvt-pivot-scroll')
        scroll.append(this.list, this.noMatches, this.originless)

        this.trayCount = button('', () => {
            if (!this.selected.size) return
            this.reveal = !this.reveal
            this.rebuild()
        })
        this.trayCount.className = 'pvt-pivot-tray-count'
        this.trayClear = button('Clear the selection', () => {
            this.selected.clear()
            this.reveal = false
            this.rebuild()
        })
        this.trayClear.className = 'pvt-pivot-button'
        this.trayClear.textContent = 'Clear'
        this.trayRun = button('Run every selected pivot', () => this.runSelected())
        this.trayRun.className = 'pvt-pivot-button pvt-pivot-button-primary'
        this.trayCaution = el('div', 'pvt-pivot-tray-caution')
        this.tray = el('div', 'pvt-pivot-tray')
        this.tray.append(this.trayCount, this.trayClear, this.trayRun, this.trayCaution)

        this.root.append(this.originBlock, this.heading, this.filterBar, scroll, this.tray)

        this.filterInput.addEventListener('input', () => {
            this.query = this.filterInput.value
            // Typing is a new question; it must not keep showing the answer to the old one.
            this.reveal = false
            this.rebuild()
        })
        // Reveal ignores the filter, so the box must not look like it is still in force —
        // and typing again is the natural way back out of it.
        this.filterInput.addEventListener('focus', () => {
            if (!this.reveal) return
            this.reveal = false
            this.rebuild()
        })
        this.filterInput.addEventListener('keydown', event => this.onFilterKey(event))

        // A pivot registered or unregistered while the mode is open changes the list.
        this.unsubscribe = this.uiManager.graph.pivots.on(change => {
            if (change === 'registry') this.rebuild()
            if (change === 'candidates') for (const entry of this.entries.values()) entry.refreshStaged()
        })
    }

    public element(): HTMLElement {
        return this.root
    }

    /** Called when the mode is entered: the origin is settled, so start asking. */
    public enter(): void {
        this.active = true
        this.rebuild()
        for (const entry of this.entries.values()) entry.start()
    }

    /**
     * Called when the mode is left. Every *question* in flight goes with it (D11) — but
     * not a fetch: that already has a candidate set and a pane of its own, so leaving is
     * not a cancellation (C3). Cancel is still reachable from both.
     */
    public exit(): void {
        this.active = false
        this.uiManager.graph.pivots.cancel(undefined, 'summarize')
        for (const entry of this.entries.values()) entry.stop()
    }

    /**
     * The origin changed. Which pivots apply is re-read from it, and every entry that
     * survives re-asks — the origin is half of the question its count answers.
     */
    public setOrigin(nodes: Node[]): void {
        if (sameIds(nodes, this.origin)) return
        this.origin = nodes
        // A different origin is a different question, so a selection built for the old
        // one does not carry. The filter does: it is a lens on the catalogue, not on the
        // origin, and an analyst hunting one provider across several nodes keeps it.
        this.selected.clear()
        this.reveal = false
        this.rebuild()
        if (!this.active) return
        for (const entry of this.entries.values()) entry.originChanged()
    }

    /**
     * Scope the panel to one pivot: its entry is scrolled to and marked. Deferred a frame
     * because the caller is usually the same gesture that entered the mode, and the tool
     * panel has not laid the entry out yet.
     */
    public focus(pivotId: string): void {
        // Being sent to one pivot outranks the filter that was hiding it — a badge that
        // opened the mode and then scrolled to nothing would be a dead end.
        if (this.query || this.reveal) {
            this.query = ''
            this.filterInput.value = ''
            this.reveal = false
            this.rebuild()
        }
        window.requestAnimationFrame(() => {
            for (const [id, entry] of this.entries) entry.element().classList.toggle('pvt-pivot-focus', id === pivotId)
            this.entries.get(pivotId)?.element().scrollIntoView({ block: 'nearest' })
        })
    }

    public destroy(): void {
        this.unsubscribe()
        for (const entry of this.entries.values()) entry.destroy()
        this.entries.clear()
        this.root.remove()
    }

    /** Repaint the origin block and re-derive which entries belong in which list. */
    private rebuild(): void {
        const pivots = this.uiManager.graph.pivots
        const applicable = pivots.for(this.origin)
        // With an origin picked, the origin-less pivots fold into a group of their own
        // (C14): they are still runnable, they just answer a different question.
        const detached = this.origin.length ? pivots.for([]) : []

        // The controls are earned by the length of the list, not switched on: a panel
        // with four pivots in it has nothing to search and nothing to batch.
        const bulk = applicable.length + detached.length >= BULK_MIN
        this.root.classList.toggle('pvt-pivot-bulk', bulk)
        this.filterBar.hidden = !bulk
        // The query is kept but stops applying, never cleared. Clicking a node fires an
        // unselect and a select, so the origin is briefly empty and the list briefly
        // short — and a filter wiped by that would vanish as the analyst changed node.
        if (!bulk) this.reveal = false

        const shownApplicable = bulk ? this.shown(applicable) : applicable
        const shownDetached = bulk ? this.shown(detached) : detached

        this.paintOrigin()
        this.paintHeading(applicable.length)
        this.paintList(this.list, applicable, shownApplicable)
        this.paintList(this.originlessList, detached, shownDetached)

        // A detached group that is entirely filtered out is a disclosure onto nothing.
        this.originless.hidden = shownDetached.length === 0
        const summary = this.originless.querySelector('summary')
        if (summary) summary.textContent = `Without an origin (${shownDetached.length})`

        this.noMatches.hidden = !bulk || shownApplicable.length + shownDetached.length > 0
        this.noMatches.textContent = this.reveal
            ? 'Nothing selected.'
            : `No pivot matches “${this.query.trim()}”.`

        // Anything no longer in either list is gone for good — drop its state with it.
        const live = new Set([...applicable, ...detached].map(def => def.id))
        for (const [id, entry] of [...this.entries]) {
            if (live.has(id)) continue
            entry.destroy()
            this.entries.delete(id)
            this.selected.delete(id)
        }

        this.paintBulk(bulk, [...shownApplicable, ...shownDetached])
    }

    /** What the list shows: the selection when revealing, otherwise what the filter keeps. */
    private shown(defs: PivotDefinition[]): PivotDefinition[] {
        if (this.reveal) return defs.filter(def => this.selected.has(def.id))
        const needle = this.query.trim().toLowerCase()
        if (!needle) return defs
        return defs.filter(def => `${def.label} ${def.id}`.toLowerCase().includes(needle))
    }

    /** The filter line, the select-all verb and the tray, from one pass over what is on show. */
    private paintBulk(bulk: boolean, shownDefs: PivotDefinition[]): void {
        if (!bulk) {
            this.tray.hidden = true
            return
        }

        const filtering = Boolean(this.query.trim()) || this.reveal
        this.filterClear.hidden = !this.query
        // Revealing ignores the query, so the box must not go on looking like it is in
        // force. Focusing it is the way back out, and it says so by waking up.
        this.filterBar.classList.toggle('pvt-pivot-filter-inert', this.reveal)
        this.hits.textContent = this.reveal
            ? `Showing your ${fmt(this.selected.size)} selected`
            : filtering ? `${fmt(shownDefs.length)} match` : ''

        // The verb names the number it will actually add, and that number is always
        // scoped to what is on screen: an unscoped "select all" in a list this long is a
        // way to fire fifty requests by accident.
        const unpicked = shownDefs.filter(def => !this.selected.has(def.id)).length
        this.selectAll.disabled = shownDefs.length === 0
        this.selectAll.textContent = shownDefs.length === 0 ? 'Select none'
            : unpicked === 0 ? `Deselect ${fmt(shownDefs.length)}`
            : filtering ? `Select ${fmt(unpicked)} matching`
            : `Select all ${fmt(unpicked)}`

        const picked = this.selected.size
        // Empty selection has nothing to reveal; staying in the mode would strand the
        // list on a set that can never repopulate.
        if (!picked) this.reveal = false
        this.tray.hidden = picked === 0
        if (!picked) return

        const shownIds = new Set(shownDefs.map(def => def.id))
        const hidden = [...this.selected].filter(id => !shownIds.has(id)).length

        this.trayCount.replaceChildren()
        this.trayCount.append(strong(fmt(picked)), document.createTextNode(' selected'))
        if (hidden) {
            const away = el('span', 'pvt-pivot-tray-hidden')
            away.textContent = `${fmt(hidden)} hidden`
            this.trayCount.append(document.createTextNode(' · '), away)
        }
        this.trayCount.setAttribute('aria-pressed', String(this.reveal))
        this.trayCount.title = this.reveal
            ? 'Back to the filtered list'
            : 'Show only what is selected'

        this.trayRun.textContent = `Run ${fmt(picked)}`
        const over = picked > BATCH_CAUTION
        this.tray.classList.toggle('pvt-pivot-tray-over', over)
        this.trayCaution.hidden = !over
        this.trayCaution.textContent = over
            ? `${fmt(picked)} pivots is over ${fmt(BATCH_CAUTION)} — this asks every one of them at once.`
            : ''
    }

    private toggleAllShown(): void {
        const shownDefs = this.shown(this.uiManager.graph.pivots.for(this.origin))
            .concat(this.origin.length ? this.shown(this.uiManager.graph.pivots.for([])) : [])
        const unpicked = shownDefs.filter(def => !this.selected.has(def.id))
        if (unpicked.length) for (const def of unpicked) this.selected.add(def.id)
        else for (const def of shownDefs) this.selected.delete(def.id)
        this.rebuild()
    }

    /**
     * Run every ticked pivot. Each goes through its own entry, so each keeps its own
     * narrowing, its own gate and its own candidate set — a batch is several runs, not
     * one run of several things.
     */
    private runSelected(): void {
        for (const id of this.selected) this.entries.get(id)?.run()
    }

    private onFilterKey(event: KeyboardEvent): void {
        if (event.key === 'ArrowDown') {
            event.preventDefault()
            this.checkboxes()[0]?.focus()
            return
        }
        if (event.key !== 'Enter') return
        event.preventDefault()
        // Once anything is ticked the tray owns Enter, so the action Enter takes is
        // always the one the panel is showing.
        if (this.selected.size) return this.runSelected()
        const only = this.checkboxes()
        if (only.length === 1) this.entries.get(only[0].value)?.run()
    }

    /** Every on-screen entry's tick box, in list order — what the arrow keys walk. */
    private checkboxes(): HTMLInputElement[] {
        return [...this.root.querySelectorAll<HTMLInputElement>('.pvt-pivot-check input')]
    }

    /** Arrow keys walk the list; Escape hands the keyboard back to the filter. */
    private onListKey(event: KeyboardEvent, box: HTMLInputElement): void {
        if (event.key === 'Escape') {
            event.preventDefault()
            this.filterInput.focus()
            return
        }
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
        event.preventDefault()
        const boxes = this.checkboxes()
        const index = boxes.indexOf(box)
        if (event.key === 'ArrowUp' && index === 0) return this.filterInput.focus()
        const next = boxes[index + (event.key === 'ArrowDown' ? 1 : -1)]
        next?.focus()
    }

    private toggle(id: string, on: boolean): void {
        if (on) this.selected.add(id)
        else this.selected.delete(id)
        this.rebuild()
    }

    private paintOrigin(): void {
        this.originBlock.replaceChildren()
        const label = el('div', 'pvt-pivot-section pvt-pivot-origin-label')
        label.textContent = 'Origin'
        this.originBlock.appendChild(label)

        if (!this.origin.length) {
            const empty = el('div', 'pvt-pivot-origin-empty')
            // Only offer what is actually there: with no origin-less pivots registered,
            // the list below is empty and pointing at it is a dead end.
            empty.textContent = this.uiManager.graph.pivots.for([]).length
                ? 'Nothing picked — click a node on the canvas, or run one of the pivots below'
                : 'Nothing picked — click a node on the canvas to see what can be run on it'
            this.originBlock.appendChild(empty)
            return
        }

        // A bordered well, like the narrowing fields below it: what is picked is a
        // value the panel is holding, not a heading.
        const box = el('div', 'pvt-pivot-origin-box')
        const chips = el('div', 'pvt-pivot-chips')
        const shown = this.origin.slice(0, 3)
        for (const node of shown) {
            const chip = el('span', 'pvt-pivot-chip')
            const dot = el('span', 'pvt-pivot-dot')
            // The canvas colour, so the chip and the node it stands for are the same
            // thing at a glance — and the legend already reads in these colours.
            const colour = tryResolveString(this.uiManager.graph.renderer.getNodeStyle(node).color, node)
            if (colour) dot.style.backgroundColor = colour
            const name = el('span', 'pvt-pivot-chip-name')
            const text = node.getData()?.label
            name.textContent = typeof text === 'string' && text ? text : String(node.id)
            chip.append(dot, name)
            chip.title = String(node.id)
            chips.appendChild(chip)
        }
        if (this.origin.length > shown.length) {
            const rest = el('span', 'pvt-pivot-chip pvt-pivot-chip-more')
            rest.textContent = `+${fmt(this.origin.length - shown.length)}`
            chips.appendChild(rest)
        }

        const clear = document.createElement('button')
        clear.type = 'button'
        clear.className = 'pvt-pivot-clear'
        clear.textContent = 'Clear'
        clear.addEventListener('click', () => {
            this.uiManager.graph.renderer.getGraphInteraction().unselectAll()
            this.setOrigin([])
        })

        box.append(chips, clear)
        this.originBlock.appendChild(box)
    }

    private paintHeading(applicable: number): void {
        if (!this.origin.length) {
            this.heading.textContent = ''
            this.heading.hidden = true
            return
        }
        this.heading.hidden = false
        this.heading.textContent = applicable
            ? `${applicable} pivot${applicable === 1 ? '' : 's'} appl${applicable === 1 ? 'ies' : 'y'}`
            : 'No pivots apply to this origin'
    }

    /**
     * Put each definition's entry in `host`, in order, creating what is new.
     *
     * `shown` is the subset the filter kept. An entry the filter hides is taken out of
     * the DOM but not destroyed: it keeps its summary, its narrowing and its place in
     * the selection, because filtering is a way of looking at the list rather than a
     * change to it.
     */
    private paintList(host: HTMLElement, defs: PivotDefinition[], shown: PivotDefinition[]): void {
        const visible = new Set(shown.map(def => def.id))
        const bulk = this.root.classList.contains('pvt-pivot-bulk')
        // Where the next visible entry belongs. Re-inserting an element that is already
        // in the right place still blurs whatever inside it had focus, and a repaint
        // fires on every tick — so an entry is only moved when it has actually moved.
        let slot = 0
        for (const def of defs) {
            let entry = this.entries.get(def.id)
            if (!entry) {
                entry = new PivotEntry(
                    this.uiManager, def, () => this.originFor(def),
                    {
                        toggle: (on: boolean) => this.toggle(def.id, on),
                        key: (event: KeyboardEvent, box: HTMLInputElement) => this.onListKey(event, box),
                    },
                )
                this.entries.set(def.id, entry)
                if (this.active) entry.start()
            }
            entry.setSelectable(bulk, this.selected.has(def.id))
            if (!visible.has(def.id)) {
                entry.element().remove()
                continue
            }
            if (host.children[slot] !== entry.element()) host.insertBefore(entry.element(), host.children[slot] ?? null)
            slot++
        }
    }

    /** An origin-less pivot is asked about nothing, whatever is selected (D19). */
    private originFor(def: PivotDefinition): Node[] {
        return def.origin === 'none' ? [] : this.origin
    }
}

/**
 * One pivot in the panel — the state machine of §2 of the states doc, from what the
 * provider has advertised down to the link into the triage pane its fetch filled.
 */
class PivotEntry {
    private readonly root: HTMLElement
    /** The right-hand slot of the head row: whatever this entry has to say in one line. */
    private readonly status: HTMLElement
    private readonly breakdown: HTMLElement
    private readonly errorLine: HTMLElement
    private readonly gateLine: HTMLElement
    private readonly progress: HTMLElement
    private readonly narrowingHost: HTMLElement
    private readonly actions: HTMLElement

    private phase: 'idle' | 'summarizing' | 'ready' | 'resummarizing' | 'failed' | 'fetching' = 'idle'
    private summary?: PivotSummary
    private narrowing: PivotNarrowing = {}
    private refusal?: PivotRefusal
    /** What an auto-ingest run just landed, until the next run or a new origin (S10). */
    private ingested?: number
    private form?: HTMLFormElement
    /** The facet shape the current form was built from, so it is only rebuilt when it moves. */
    private facetSignature = ''
    /** Rebuild the form once the analyst's cursor has left it, never under their fingers. */
    private formStale = false
    /** Bumped on every ask, so a superseded answer is dropped rather than painted. */
    private token = 0
    private typedTimer?: number
    /** Whether this entry has asked since the mode was entered — `start` is idempotent. */
    private started = false
    /** The origin the last ask was about, so an origin change that isn't one asks nothing. */
    private askedFor?: string

    private readonly uiManager: UIManager
    private readonly def: PivotDefinition
    private readonly origin: () => Node[]
    /** The tick box, present only while the panel is long enough to batch (`BULK_MIN`). */
    private readonly check: HTMLElement
    private readonly checkInput: HTMLInputElement

    constructor(
        uiManager: UIManager,
        def: PivotDefinition,
        origin: () => Node[],
        selection: { toggle: (on: boolean) => void, key: (event: KeyboardEvent, box: HTMLInputElement) => void },
    ) {
        this.uiManager = uiManager
        this.def = def
        this.origin = origin
        this.root = el('div', 'pvt-pivot-entry')
        this.root.dataset.pivot = def.id

        const head = el('div', 'pvt-pivot-entry-head')

        // Selection rides on its own control rather than on the entry: the entry already
        // has a Run of its own, and a card that both selects and runs depending on where
        // it was clicked spends a request on a slip.
        this.check = el('label', 'pvt-pivot-check')
        this.checkInput = document.createElement('input')
        this.checkInput.type = 'checkbox'
        this.checkInput.value = def.id
        this.checkInput.setAttribute('aria-label', `Select ${def.label}`)
        this.checkInput.addEventListener('change', () => selection.toggle(this.checkInput.checked))
        this.checkInput.addEventListener('keydown', event => selection.key(event, this.checkInput))
        this.check.appendChild(this.checkInput)
        this.check.hidden = true
        head.appendChild(this.check)

        if (def.icon) {
            const icon = el('span', 'pvt-pivot-entry-icon')
            icon.innerHTML = def.icon
            head.appendChild(icon)
        }
        const label = el('span', 'pvt-pivot-entry-label')
        label.textContent = def.label
        this.status = el('span', 'pvt-pivot-status')
        head.append(label, this.status)

        this.breakdown = el('div', 'pvt-pivot-breakdown')
        this.errorLine = el('div', 'pvt-pivot-error')
        this.gateLine = el('div', 'pvt-pivot-gate')
        this.progress = el('div', 'pvt-pivot-progress')
        this.progress.appendChild(el('span', 'pvt-pivot-progress-bar'))
        this.narrowingHost = el('div', 'pvt-pivot-narrowing')
        this.actions = el('div', 'pvt-pivot-actions')

        this.root.append(
            head, this.breakdown, this.errorLine, this.gateLine,
            this.progress, this.narrowingHost, this.actions,
        )
        this.paint()
    }

    public element(): HTMLElement {
        return this.root
    }

    /** Whether this entry can be ticked, and whether it currently is. */
    public setSelectable(on: boolean, selected: boolean): void {
        this.check.hidden = !on
        this.checkInput.checked = on && selected
        this.root.classList.toggle('pvt-pivot-picked', on && selected)
    }

    /**
     * Run this pivot, as the tray does for each one it holds. The gate is not repeated
     * here: a run over the pivot's own cap is refused by the manager and reported on
     * this entry, which is where the analyst would look for it.
     */
    public run(): void {
        if (this.phase === 'fetching') return
        void this.fetch()
    }

    /** Entering the mode is the intent that starts the first call (D11). */
    public start(): void {
        if (this.started) return
        this.started = true
        if (!this.def.summarize) {
            this.phase = 'idle'
            this.paint()
            return
        }
        void this.ask(false)
    }

    /** Leaving the mode: nothing is in flight any more, so stop claiming it is. */
    public stop(): void {
        window.clearTimeout(this.typedTimer)
        this.token++
        this.started = false
        if (this.phase === 'summarizing' || this.phase === 'resummarizing' || this.phase === 'fetching') {
            this.phase = this.summary ? 'ready' : 'idle'
        }
        this.paint()
    }

    /**
     * The origin moved. A newly created entry has already asked about it through
     * {@link start}, so the guard is on the question rather than on who is asking:
     * clicking one node fires an unselect and a select, and the second must not ask
     * again for what the first already asked.
     */
    public originChanged(): void {
        if (this.def.origin === 'none') return
        if (this.askedFor === this.originKey()) return
        // The acknowledgement was about the origin that has just gone.
        this.ingested = undefined
        this.paint()
        this.started = true
        void this.ask(true)
    }

    /** A staged set appeared, changed or went — only the `n in triage` link moves. */
    public refreshStaged(): void {
        this.paintActions()
    }

    public destroy(): void {
        window.clearTimeout(this.typedTimer)
        this.token++
        this.root.remove()
    }

    /**
     * Ask the provider what is out there. `resummarize` keeps the previous count on
     * screen, dimmed — blanking it makes every narrowing tick look like a reset (S5).
     */
    private async ask(resummarize: boolean): Promise<void> {
        if (!this.def.summarize) return
        const token = ++this.token
        this.askedFor = this.originKey()
        const cached = this.uiManager.graph.pivots.cachedSummary(this.def.id, this.origin(), this.narrowing)
        if (cached) {
            // A cache hit skips the skeleton entirely (S2): a re-opened mode shows its
            // number at once rather than flickering through a loading state.
            this.summary = cached
            this.phase = 'ready'
            this.paint()
            return
        }

        this.phase = resummarize && this.summary ? 'resummarizing' : 'summarizing'
        this.paint()

        try {
            const summary = await this.uiManager.graph.pivots.summarize(this.def.id, this.origin(), this.narrowing)
            if (token !== this.token) return
            // `undefined` means the call was superseded, and something newer is already
            // on its way — leave the state to whoever superseded it.
            if (!summary) return
            this.summary = summary
            this.phase = 'ready'
        } catch {
            if (token !== this.token) return
            this.phase = 'failed'
        }
        this.paint()
    }

    private async fetch(): Promise<void> {
        const token = ++this.token
        this.phase = 'fetching'
        this.refusal = undefined
        this.ingested = undefined
        this.paint()

        const outcome = await this.uiManager.graph.pivots.run(this.def.id, this.origin(), this.narrowing)
        if (token !== this.token) return

        this.phase = this.summary ? 'ready' : 'idle'
        if (outcome.status === 'refused') this.refusal = outcome.refusal
        // An auto-ingest run opens no pane (D13): the toast carries the outcome and the
        // undo, and the entry only acknowledges that it happened.
        if (outcome.status === 'ingested') this.ingested = outcome.nodes.length
        // A failed or vetoed run is reported where it happened: a staged pivot's pane
        // carries the error and its retry, and an auto-ingest one is the notifier's.
        this.paint()
    }

    /* ---------- painting ---------- */

    private paint(): void {
        this.root.dataset.phase = this.phase
        this.paintStatus()
        this.paintBreakdown()
        this.paintError()
        this.paintGate()
        this.paintNarrowing()
        this.paintActions()
    }

    /**
     * The head row's right-hand side. Everything this entry has to say about itself
     * fits on the label's own line — a count, the number behind a verb, or the verb
     * itself — so the entry stays one line tall until it has facets to show.
     */
    private paintStatus(): void {
        const slot = this.status
        slot.replaceChildren()
        slot.className = 'pvt-pivot-status'

        // The error line below carries both the sentence and its Retry.
        if (this.phase === 'failed') return

        if (this.phase === 'fetching') {
            slot.classList.add('pvt-pivot-muted')
            slot.textContent = this.summary ? `Fetching ~${fmt(this.summary.total)}…` : 'Fetching…'
            return
        }

        if (this.phase === 'summarizing') {
            slot.classList.add('pvt-pivot-skeleton')
            return
        }

        if (this.summary) {
            slot.classList.add('pvt-pivot-count')
            // A re-summarize keeps the last number on screen rather than blanking it: the
            // narrowing tick that caused it must not read as a reset (S5).
            slot.classList.toggle('pvt-pivot-dim', this.phase === 'resummarizing')
            slot.textContent = this.countText(this.summary.total)
            return
        }

        if (this.ingested !== undefined) {
            slot.classList.add('pvt-pivot-ingested')
            slot.textContent = `${fmt(this.ingested)} ingested`
            return
        }

        if (this.verbInHead()) {
            slot.appendChild(this.button('Run', true, () => void this.fetch()))
            return
        }

        // Nothing asked yet, or nothing to ask: a declared potential is the only number
        // the canvas ever shows unprompted, so it is the only one that belongs here (D12).
        const declared = this.declared()
        if (!declared) return
        slot.classList.add('pvt-pivot-hint')
        slot.textContent = `~${fmt(declared)} declared`
    }

    /**
     * A pivot with no `summarize` has no count to gate on and no facets to narrow, so
     * it is a label and a verb (S7) — and the verb takes the slot the count would have
     * had, leaving the entry one line tall with nothing under it.
     *
     * Only when that slot is genuinely empty, though. A declared potential, a fetch in
     * flight, a failure or an acknowledgement all have something to say there, and the
     * verb goes back to the actions row rather than displacing it.
     */
    private verbInHead(): boolean {
        return !this.def.summarize
            && this.ingested === undefined
            && !this.declared()
            && this.phase !== 'fetching'
            && this.phase !== 'failed'
    }

    /** `~2,143`, and C2's one line for a multi-node origin — never one line per node. */
    private countText(total: number): string {
        const nodes = this.origin().length
        return nodes > 1 ? `~${fmt(total)} across ${fmt(nodes)} nodes` : `~${fmt(total)}`
    }

    private originKey(): string {
        return this.origin().map(node => node.id).join(',')
    }

    /** What the origin declared for this pivot, summed — advisory like everything else. */
    private declared(): number {
        return this.origin().reduce((sum, node) => sum + (node.getPotential(this.def.id) ?? 0), 0)
    }

    /**
     * What the total is made of, along one dimension.
     *
     * Only a `multiselect` facet's options partition the result, so only those are
     * summed here. A single-choice facet's counts are *alternatives* — what the total
     * would become under each — and reading them as a breakdown states something
     * false: passive DNS's four windows would add up to three times its own total.
     * Those counts stay where they answer the question the analyst is asking, beside
     * the option itself.
     */
    private paintBreakdown(): void {
        const facets = this.summary?.facets ?? []
        const partition = facets.find(facet => facet.type === 'multiselect')
        const counted = (partition?.options ?? []).filter(o => o.count !== undefined)
        // The label is the provider's, used verbatim like every other label in the
        // library — lower-casing one would mangle a translated noun.
        this.breakdown.textContent = counted
            .map(option => `${fmt(option.count as number)} ${option.label}`)
            .join(' · ')
        this.breakdown.hidden = counted.length === 0
    }

    /** The entry survives its own failure — one pivot going down never empties the menu. */
    private paintError(): void {
        this.errorLine.replaceChildren()
        this.errorLine.hidden = this.phase !== 'failed'
        if (this.phase !== 'failed') return

        const text = el('span', 'pvt-pivot-error-text')
        text.textContent = 'Couldn\'t reach the source.'
        const retry = this.button('Retry', false, () => {
            this.uiManager.graph.pivots.invalidate(this.def.id, this.origin())
            void this.ask(false)
        })
        retry.classList.add('pvt-pivot-retry')
        this.errorLine.append(text, retry)
    }

    /**
     * What stands between the count and a fetch, said in both directions.
     *
     * A capped pivot keeps this line from its first summary on: the refusal while the
     * count is over the cap, the cap it is now within once narrowing gets under. Both
     * are one box of the same height, because the moment it would otherwise appear and
     * disappear — ticking a facet across the cap — is the moment the analyst is aiming
     * at a checkbox, and every entry below would move under the cursor.
     */
    private paintGate(): void {
        const cap = this.def.maxCandidates
        const blocked = this.overCap() || this.refusal?.kind === 'ceiling'

        if (this.overCap()) {
            // The count itself is in the head row directly above, so the line says what
            // it means rather than repeating it — and stays one line wide, which is what
            // holds the height equal to the cleared state.
            this.gateLine.textContent = `Over the cap of ${fmt(cap as number)} — narrow further to fetch`
        } else if (this.refusal?.kind === 'ceiling') {
            this.gateLine.textContent =
                `The source returned ${fmt(this.refusal.count)} candidates, over the ${fmt(this.refusal.limit)} limit.`
                + ' Nothing was staged — narrow and run again.'
        } else if (cap !== undefined && this.summary !== undefined) {
            this.gateLine.textContent = `Within the cap of ${fmt(cap)}`
        } else {
            this.gateLine.textContent = ''
        }

        this.gateLine.classList.toggle('pvt-pivot-gate-blocked', blocked)
        this.gateLine.hidden = !this.gateLine.textContent
    }

    /** Over the pivot's own cap, judged on the freshest advisory count (D4). */
    private overCap(): boolean {
        return this.def.maxCandidates !== undefined
            && this.summary !== undefined
            && this.summary.total > this.def.maxCandidates
    }

    /**
     * Build the narrowing form from the facets the provider declared. Rebuilt only when
     * the facets themselves move — including their option counts, which are the source's
     * answer to the current narrowing (C4) — and never while a field has focus.
     */
    private paintNarrowing(): void {
        const facets = this.summary?.facets ?? []
        const signature = JSON.stringify(facets)
        if (signature === this.facetSignature) return

        if (this.form?.contains(document.activeElement)) {
            this.formStale = true
            return
        }
        this.facetSignature = signature
        this.formStale = false
        this.narrowingHost.replaceChildren()
        this.form = undefined
        if (!facets.length) return

        const form = FormFactory.createForm({ fields: facets.map(facetToField) })
        FormFactory.setValues(form, this.narrowing as FormValues)
        this.form = form
        this.narrowingHost.appendChild(form)

        form.addEventListener('submit', event => {
            event.preventDefault()
            this.commitNarrowing()
        })
        form.addEventListener('change', () => this.commitNarrowing())
        form.addEventListener('input', event => {
            const type = (event.target as HTMLElement | null)?.closest?.('[data-field-type]')
                ?.getAttribute('data-field-type')
            if (!type || !TYPED_FIELDS.has(type)) return
            window.clearTimeout(this.typedTimer)
            this.typedTimer = window.setTimeout(() => this.commitNarrowing(), TYPED_DELAY_MS)
        })
        form.addEventListener('focusout', () => {
            if (this.formStale) window.setTimeout(() => this.paintNarrowing(), 0)
        })
    }

    /** Read the form and re-ask — narrowing and the count are one question (D4). */
    private commitNarrowing(): void {
        if (!this.form) return
        window.clearTimeout(this.typedTimer)
        this.narrowing = compactNarrowing(FormFactory.getValues(this.form))
        this.refusal = undefined
        void this.ask(true)
    }

    private paintActions(): void {
        this.actions.replaceChildren()
        // Indeterminate, never a percentage: there is no streaming and no cursor (D3),
        // so a filling bar would be a lie.
        this.progress.hidden = this.phase !== 'fetching'

        if (this.phase === 'fetching') {
            this.actions.appendChild(this.button('Cancel', false, () => {
                this.uiManager.graph.pivots.cancelFetch(this.def.id)
            }))
            return
        }

        // Failure states its own sentence and its own Retry, on the error line.
        if (this.phase === 'failed') return

        if (Object.keys(this.narrowing).length) {
            this.actions.appendChild(this.button('Clear narrowing', false, () => {
                if (this.form) FormFactory.clear(this.form)
                this.narrowing = {}
                this.refusal = undefined
                void this.ask(true)
            }))
        }

        if (!this.verbInHead()) {
            const primary = this.def.summarize ? 'Fetch' : 'Run'
            const busy = this.phase === 'summarizing' || this.phase === 'resummarizing'
            const fetch = this.button(primary, true, () => void this.fetch())
            fetch.disabled = busy || this.overCap()
            this.actions.appendChild(fetch)
        }

        const staged = this.uiManager.graph.pivots.candidates(this.def.id)
        const waiting = staged?.nodes.filter(c => c.state !== 'rejected' && !c.deduped).length ?? 0
        if (staged && !staged.loading && waiting) {
            const link = this.button(`${fmt(waiting)} in triage ▸`, false, () => {
                this.uiManager.activateDockTab(TRIAGE_TAB_PREFIX + this.def.id)
            })
            link.classList.add('pvt-pivot-triage-link')
            this.actions.appendChild(link)
        }
    }

    private button(label: string, primary: boolean, onClick: () => void): HTMLButtonElement {
        const button = document.createElement('button')
        button.type = 'button'
        button.className = primary ? 'pvt-pivot-button pvt-pivot-button-primary' : 'pvt-pivot-button'
        button.textContent = label
        button.addEventListener('click', onClick)
        return button
    }
}

/* ---------- helpers ---------- */

function el(tag: string, className: string): HTMLElement {
    const element = document.createElement(tag)
    element.className = className
    return element
}

function button(title: string, onClick: () => void): HTMLButtonElement {
    const element = document.createElement('button')
    element.type = 'button'
    if (title) element.title = title
    element.addEventListener('click', onClick)
    return element
}

function strong(text: string): HTMLElement {
    const element = document.createElement('strong')
    element.textContent = text
    return element
}

function sameIds(a: Node[], b: Node[]): boolean {
    return a.length === b.length && a.every((node, index) => node.id === b[index].id)
}

/**
 * A facet as a form field. `boolean` becomes a true/false/unset dropdown for the same
 * reason the filter panel does it — a checkbox has no "unset".
 *
 * A `multiselect` is drawn as a list of checkboxes rather than a picker: its options
 * *are* the breakdown the summary just reported, so hiding them behind a menu hides
 * the numbers the analyst is narrowing by. A single-choice `select` stays a dropdown —
 * one line is all it ever shows.
 */
function facetToField(facet: PivotFacet): FieldConfig {
    const label = facet.label ?? FormFactory.niceLabelFromKey(facet.key)
    if (facet.type === 'boolean') {
        return {
            key: facet.key, label, type: 'select', allowEmpty: true, valuesAreBoolean: true,
            options: [{ label: 'true', value: 'true' }, { label: 'false', value: 'false' }],
        }
    }
    const type = facet.type === 'multiselect' ? 'checkboxes' : facet.type
    const field: FieldConfig = { key: facet.key, label, type }
    if (type === 'select' || type === 'checkboxes') {
        field.allowEmpty = true
        field.options = (facet.options ?? []).map((option): FieldOption => (
            // A checkbox row has a column for the count; a dropdown's option has only
            // its label, so that is where the number has to ride.
            type === 'checkboxes'
                ? { label: option.label, value: option.value, count: option.count }
                : {
                    label: option.count === undefined
                        ? option.label
                        : `${option.label}  ${fmt(option.count)}`,
                    value: option.value,
                }
        ))
    }
    return field
}

/**
 * Drop the keys the analyst has not actually set. An empty multiselect is not a
 * narrowing, and leaving it in would make `{type: []}` a different cache key — and a
 * different question — from asking nothing at all.
 */
function compactNarrowing(values: FormValues): PivotNarrowing {
    const narrowing: PivotNarrowing = {}
    for (const [key, value] of Object.entries(values)) {
        if (value === undefined || value === '') continue
        if (Array.isArray(value) && !value.length) continue
        if (isRange(value) && value.min === undefined && value.max === undefined) continue
        narrowing[key] = value
    }
    return narrowing
}

function isRange(value: unknown): value is { min?: number, max?: number } {
    return typeof value === 'object' && value !== null && ('min' in value || 'max' in value)
}
