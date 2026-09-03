import type { PivotCandidateSet, PivotRunOutcome } from '../../../interfaces/Pivot'
import { NotificationLevel } from '../../Notifier'
import type { NotificationHandle } from '../../Notifier'
import { closeIcon, sparkles } from '../../icons'
import { UIComponent } from '../../UIComponent'
import type { UIManager } from '../../UIManager'
import { TriagePane } from './TriagePane'

/** The one dock tab every staged set shares. Providers are tabs *inside* it. */
export const TRIAGE_TAB_ID = 'pivot-triage'

/** The review tab sits after the built-in table rather than in front of it. */
const TAB_ORDER = 10

const fmt = (value: number): string => value.toLocaleString()

/** One provider in the strip: the row, and the parts of it that change on their own. */
interface StripItem {
    root: HTMLElement
    main: HTMLButtonElement
    icon: HTMLElement
    label: HTMLElement
    count: HTMLElement
    close: HTMLButtonElement
    /** The glyph markup already in place, so a repaint does not re-parse it. */
    drawn?: string
}

/**
 * Keeps the dock in step with what is staged for triage: **one** review tab, holding a
 * pane per pivot that has been run and not yet cleared (D27), each created the moment
 * its `fetch` starts so a slow fetch and a failed one both have somewhere to live.
 *
 * One tab rather than one per pivot because the providers are a queue, not a set of
 * unrelated panes: a single click on *Run 6* in the panel's tray starts six fetches, and
 * six tabs in the dock's own strip crowd out the table and read as six different kinds
 * of thing. They are one kind — candidates waiting for a verdict — so they are a
 * vertical strip down the side of one pane, where fifty of them still fit and each one
 * carries its own count and its own way out.
 *
 * It owns no candidate state — {@link PivotManager} does — and adds none of its own
 * beyond which provider is on show. What it does own is the two things a pane cannot:
 * the ingest call, and the toast that follows it with the run's undo on it.
 */
export class PivotTriage extends UIComponent {
    private readonly panes = new Map<string, TriagePane>()
    /** Runs already announced, so a redo does not toast the same ingest twice. */
    private readonly reported = new Set<string>()

    /** The provider on show. Null only while nothing is staged. */
    private selected: string | null = null
    /** The last selection the strip scrolled to, so it only ever scrolls on a change. */
    private shown: string | null = null
    /** Whether the review tab is the one the dock is showing. */
    private visible = false

    private disposeTab?: () => void

    /* ---------- the pane's own chrome, built once and kept ---------- */
    private root?: HTMLElement
    private strip?: HTMLElement
    private host?: HTMLElement
    /**
     * The pane's half of the dock's header row. One element for the life of the tab,
     * refilled as the selection moves: asking the dock to rebuild the tab instead —
     * which is how the data table swaps its own controls — detaches the body, and with
     * it the analyst's place in the queue.
     */
    private tools?: HTMLElement
    /** Strip rows by pivot id, in strip order — so a count repaints one row, not fifty. */
    private readonly items = new Map<string, StripItem>()

    constructor(uiManager: UIManager) {
        super(uiManager)
    }

    private get pivots() {
        return this.uiManager.graph.pivots
    }

    protected onAfterMount(): void {
        this.track(this.pivots.on(change => {
            // 'registry' matters too: unregistering a pivot drops its candidates.
            if (change === 'candidates' || change === 'registry') this.sync()
            if (change === 'runs') this.reportUnannounced()
        }))
        this.sync()
    }

    protected onDestroy(): void {
        this.closeTab()
        this.panes.clear()
    }

    /**
     * Bring a provider's candidates into view — the route the panel's *N in triage ▸*
     * link takes. A no-op for a pivot with nothing staged.
     */
    public reveal(pivotId: string): void {
        if (!this.panes.has(pivotId)) return
        this.select(pivotId)
        this.uiManager.activateDockTab(TRIAGE_TAB_ID)
    }

    /* ---------- what is staged, and the tab that holds it ---------- */

    /** Add what is new, update what is there, drop what is gone. */
    private sync(): void {
        const staged = this.pivots.staged()
        const live = new Set(staged.map(set => set.pivotId))

        for (const pivotId of [...this.panes.keys()]) {
            if (live.has(pivotId)) continue
            this.panes.get(pivotId)?.deactivate()
            this.panes.delete(pivotId)
        }

        /** The last set to arrive, which is the one the analyst just asked for. */
        let arrived: string | undefined
        for (const set of staged) {
            const pane = this.panes.get(set.pivotId)
            if (pane) {
                pane.update(set)
                continue
            }
            this.panes.set(set.pivotId, this.build(set))
            arrived = set.pivotId
        }

        if (!staged.length) return this.closeTab()

        // Hands over to the neighbour below in the strip, then above: closing a provider
        // sends the analyst to the next one waiting, not back to the top of a queue.
        if (!this.selected || !live.has(this.selected)) {
            const order = [...this.items.keys()]
            const at = this.selected ? order.indexOf(this.selected) : -1
            this.selected = order.slice(at + 1).find(id => live.has(id))
                ?? order.slice(0, Math.max(at, 0)).reverse().find(id => live.has(id))
                ?? staged[0].pivotId
        }

        this.openTab()
        this.paint()
        this.relabel()
        // The analyst asked for this fetch, so its results come to the front — and the
        // dock unfolds if it was away. Only for a set that has just arrived: a later
        // update must not yank them out of whatever they were reading.
        if (arrived) this.reveal(arrived)
    }

    private build(set: PivotCandidateSet): TriagePane {
        return new TriagePane(set, {
            pivots: this.pivots,
            ingest: pivotId => void this.ingest(pivotId),
            rerun: from => void this.pivots.run(from.pivotId, from.origin, from.narrowing),
            close: pivotId => this.pivots.discard(pivotId),
            counted: pivotId => {
                const current = this.pivots.candidates(pivotId)
                if (current) this.paintItem(current)
                this.relabel()
            },
        })
    }

    /** Registered on the first staged set, and only then: no pivot run, no tab. */
    private openTab(): void {
        if (this.disposeTab) return
        this.disposeTab = this.uiManager.addDockTab({
            id: TRIAGE_TAB_ID,
            label: this.tabLabel(),
            // The rail mode's own glyph, so the review pane is recognisable as the
            // Pivot mode's pane among the dock's others.
            icon: sparkles,
            order: TAB_ORDER,
            render: () => {
                this.visible = true
                return this.body()
            },
            toolbar: () => [this.toolbar()],
            onActivate: () => {
                this.visible = true
                this.pane()?.activate()
            },
            onDeactivate: () => {
                this.visible = false
                this.pane()?.deactivate()
            },
        })
    }

    private closeTab(): void {
        this.disposeTab?.()
        this.disposeTab = undefined
        this.visible = false
        this.selected = null
        this.shown = null
        for (const item of this.items.values()) item.root.remove()
        this.items.clear()
        this.host?.replaceChildren()
    }

    /** The tab carries the whole queue's count; the strip breaks it down per provider. */
    private relabel(): void {
        if (this.disposeTab) this.uiManager.setDockTabLabel(TRIAGE_TAB_ID, this.tabLabel())
    }

    private tabLabel(): string {
        let waiting = 0
        for (const pane of this.panes.values()) waiting += pane.waiting()
        return waiting > 0 ? `Review (${fmt(waiting)})` : 'Review'
    }

    private pane(): TriagePane | undefined {
        return this.selected ? this.panes.get(this.selected) : undefined
    }

    /* ---------- the review pane: a provider strip, and the pane on show ---------- */

    private body(): HTMLElement {
        if (!this.root) {
            this.root = document.createElement('div')
            this.root.className = 'pvt-review'

            this.strip = document.createElement('div')
            this.strip.className = 'pvt-review-strip'
            this.strip.setAttribute('role', 'tablist')
            this.strip.setAttribute('aria-orientation', 'vertical')
            this.strip.setAttribute('aria-label', 'Staged providers')
            // Delegated: the strip is redrawn as providers come and go, and a listener
            // per row would accumulate behind it.
            this.listen(this.strip, 'click', event => {
                const target = event.target as HTMLElement | null
                const row = target?.closest<HTMLElement>('.pvt-review-tab')
                const pivotId = row?.dataset.pivot
                if (!pivotId) return
                if (target?.closest('.pvt-review-close')) return this.pivots.discard(pivotId)
                this.select(pivotId)
            })
            // Arrow keys walk the queue, the same way the panel's provider list walks.
            this.listen(this.strip, 'keydown', event => this.onStripKey(event as KeyboardEvent))
            this.root.appendChild(this.strip)

            this.host = document.createElement('div')
            this.host.className = 'pvt-review-host'
            this.root.appendChild(this.host)
        }
        this.paint()
        return this.root
    }

    /** Draw the strip and show the selected pane. A no-op before the dock asks for a body. */
    private paint(): void {
        if (!this.root || !this.host) return
        this.paintStrip()

        // Only when the selection itself moved: a count arriving from another provider
        // must not drag the analyst back from wherever they scrolled the queue to.
        if (this.selected !== this.shown) {
            this.shown = this.selected
            this.scrollToSelected()
        }

        const pane = this.pane()
        if (!pane) return void this.host.replaceChildren()
        if (pane.root.parentElement !== this.host) this.host.replaceChildren(pane.root)
        if (this.visible) pane.activate()
    }

    /**
     * Keep the provider on show inside the strip's own scroll. A queue of fifty scrolls,
     * and a fetch that selects itself off the bottom of it has arrived invisibly.
     */
    private scrollToSelected(): void {
        const strip = this.strip
        const item = this.selected ? this.items.get(this.selected) : undefined
        if (!strip || !item) return
        // Read in the strip's own coordinates — it is the offset parent — rather than
        // from a client rect, which is measured through whatever is transforming it.
        const top = item.root.offsetTop
        const bottom = top + item.root.offsetHeight
        if (top < strip.scrollTop) strip.scrollTop = top
        else if (bottom > strip.scrollTop + strip.clientHeight) strip.scrollTop = bottom - strip.clientHeight
    }

    /** Arrow keys walk the providers; Home and End jump to the ends of the queue. */
    private onStripKey(event: KeyboardEvent): void {
        const order = [...this.items.keys()]
        if (!order.length) return
        const at = this.selected ? order.indexOf(this.selected) : -1
        const next = event.key === 'ArrowDown' ? order[Math.min(at + 1, order.length - 1)]
            : event.key === 'ArrowUp' ? order[Math.max(at - 1, 0)]
                : event.key === 'Home' ? order[0]
                    : event.key === 'End' ? order[order.length - 1]
                        : undefined
        if (next === undefined) return
        event.preventDefault()
        this.select(next)
        // After the selection, not before: painting the strip moves the rows, and moving
        // the element the focus is in takes the focus with it.
        this.items.get(next)?.main.focus()
    }

    private select(pivotId: string): void {
        if (this.selected === pivotId || !this.panes.has(pivotId)) return
        this.pane()?.deactivate()
        this.selected = pivotId
        this.paint()
        // The row search, the regex toggle and Re-run all belong to the provider on
        // show, so they go with it.
        this.fillTools()
    }

    /**
     * The controls the dock draws in its header row on this pane's behalf. `display:
     * contents`, so what is inside lays out as if the dock's header held it directly.
     */
    private toolbar(): HTMLElement {
        if (!this.tools) {
            this.tools = document.createElement('div')
            this.tools.className = 'pvt-review-tools'
        }
        this.fillTools()
        return this.tools
    }

    private fillTools(): void {
        this.tools?.replaceChildren(...(this.pane()?.toolbar() ?? []))
    }

    /**
     * Drawn even for a single provider, unlike the dock's own strip: this is where a
     * provider is named, where its count lives and where its way out is, none of which
     * the tab says any more.
     */
    private paintStrip(): void {
        const strip = this.strip
        if (!strip) return
        const staged = this.pivots.staged()
        const live = new Set(staged.map(set => set.pivotId))

        for (const [pivotId, item] of [...this.items]) {
            if (live.has(pivotId)) continue
            item.root.remove()
            this.items.delete(pivotId)
        }

        // A ragged left edge is worse than a reserved slot, so once anything in the
        // queue has a glyph every row keeps room for one.
        const glyphs = staged.some(set => this.pivots.get(set.pivotId)?.icon)
        strip.classList.toggle('pvt-review-strip-icons', glyphs)

        for (const set of staged) {
            const item = this.items.get(set.pivotId) ?? this.createItem(set)
            this.paintItem(set)
            // Appending an element already in place moves it, so this is also the sort.
            strip.appendChild(item.root)
        }
    }

    private createItem(set: PivotCandidateSet): StripItem {
        const root = document.createElement('div')
        root.className = 'pvt-review-tab'
        root.dataset.pivot = set.pivotId
        // The row is a wrapper rather than the control itself: closing is a control of
        // its own, and one button cannot live inside another.
        root.setAttribute('role', 'presentation')

        const main = document.createElement('button')
        main.type = 'button'
        main.className = 'pvt-review-main'
        main.setAttribute('role', 'tab')

        const icon = document.createElement('span')
        icon.className = 'pvt-review-icon'
        icon.setAttribute('aria-hidden', 'true')
        const label = document.createElement('span')
        label.className = 'pvt-review-label'
        const count = document.createElement('span')
        count.className = 'pvt-review-count'
        main.append(icon, label, count)

        const close = document.createElement('button')
        close.type = 'button'
        close.className = 'pvt-review-close'
        close.innerHTML = closeIcon
        root.append(main, close)

        const item: StripItem = { root, main, icon, label, count, close }
        this.items.set(set.pivotId, item)
        return item
    }

    /** One row's live parts: its glyph, its name, its count, and whether it is on show. */
    private paintItem(set: PivotCandidateSet): void {
        const item = this.items.get(set.pivotId)
        if (!item) return
        const waiting = this.panes.get(set.pivotId)?.waiting() ?? 0

        // Trusted, exactly like the glyph a dock tab or a rail mode is given.
        const icon = this.pivots.get(set.pivotId)?.icon ?? ''
        if (item.drawn !== icon) {
            item.drawn = icon
            item.icon.innerHTML = icon
        }

        item.label.textContent = set.label
        const on = this.selected === set.pivotId
        item.main.classList.toggle('active', on)
        item.main.setAttribute('aria-selected', String(on))
        // One tab stop for the whole queue, however long it is: fifty providers would
        // otherwise put a hundred stops between the dock and the table. The arrows move
        // between them, which is what a tablist is for.
        item.main.tabIndex = on ? 0 : -1
        item.close.tabIndex = on ? 0 : -1

        // A set with no rows to count is in one of two states, and the row says which.
        const failed = Boolean(set.error || set.refused)
        item.root.classList.toggle('pvt-review-tab-failed', failed)
        item.count.textContent = set.loading ? '…' : failed ? '!' : waiting ? fmt(waiting) : ''

        // Also the accessible name, since '…' and '!' are marks rather than words.
        const summary = set.loading ? 'fetching'
            : failed ? 'the fetch failed'
                : waiting ? `${fmt(waiting)} waiting for a verdict`
                    : 'nothing waiting'
        item.main.title = `${set.label} — ${summary}`
        item.main.setAttribute('aria-label', `${set.label} — ${summary}`)
        item.close.setAttribute('aria-label', `Close ${set.label}`)
        item.close.title = 'Drop these candidates. Nothing is rejected.'
    }

    /* ---------- ingest, and the undo that follows it ---------- */

    /**
     * An ingest that did not come through a pane still landed nodes on the canvas —
     * an auto-ingest pivot (D13), or a consumer calling `pivots.ingest` itself. It gets
     * the same toast, and the same undo on it, because the analyst has the same problem.
     */
    private reportUnannounced(): void {
        const latest = this.uiManager.graph.history.entries().find(entry => entry.kind === 'pivot')
        if (!latest || this.reported.has(latest.id)) return
        this.reported.add(latest.id)
        this.toastIngest(latest.id, latest.nodeIds.length, 0, latest.edgeIds.length)
    }

    private async ingest(pivotId: string): Promise<void> {
        const set = this.pivots.candidates(pivotId)
        // What was asked for, so a hook that narrowed the batch can be reported as such.
        const asked = set ? set.nodes.filter(c => c.state === 'marked' && !c.deduped).length : 0
        // Claimed before the call, not after: `ingest` announces the run on its way
        // through, and the run listener would otherwise toast it a second time.
        if (set) this.reported.add(set.runId)

        let outcome: PivotRunOutcome
        try {
            outcome = await this.pivots.ingest(pivotId)
        } catch (error) {
            this.uiManager.graph.notifier.error('Ingest failed', String((error as Error)?.message ?? error))
            return
        }

        if (outcome.status === 'vetoed') {
            this.uiManager.graph.notifier.info('Ingest cancelled')
            return
        }

        this.reported.add(outcome.runId)
        this.dismissIfDone(pivotId)
        this.toastIngest(outcome.runId, outcome.nodes.length, asked, outcome.edges.length)
    }

    /**
     * Triage over, pane gone: an ingest that took the last row otherwise leaves a pane
     * holding nothing but a *Close*, one more click for a report the toast carries.
     *
     * A re-run keeps it open, fetching or waiting for a verdict — those candidates are
     * reachable from the banner inside this pane and nowhere else.
     */
    private dismissIfDone(pivotId: string): void {
        const set = this.pivots.candidates(pivotId)
        if (!set || set.loading || set.pending) return
        if (this.panes.get(pivotId)?.finished()) this.pivots.discard(pivotId)
    }

    private toastIngest(runId: string, landed: number, asked: number, edges: number): void {
        if (!landed && !edges) {
            this.uiManager.graph.notifier.info('Nothing was ingested')
            return
        }
        this.uiManager.graph.notifier.success(ingestTitle(landed, asked, edges), undefined, {
            action: { label: 'Undo', onClick: toast => this.undo(runId, toast) },
        })
    }

    private undo(runId: string, toast: NotificationHandle): void {
        const history = this.uiManager.graph.history
        // The run's id is its entry's, so this reaches the ingest the toast is about —
        // and, contiguously, anything done since.
        if (!history.undo(runId).length) {
            toast.update({ level: NotificationLevel.Warning, title: 'Nothing left to undo', action: null })
            return
        }
        toast.update({
            title: 'Undone',
            action: {
                label: 'Redo',
                onClick: next => {
                    history.redo()
                    next.update({ title: 'Redone', action: null })
                },
            },
        })
    }
}

/** `Ingested 12 nodes, 14 edges` — or `9 of 12` when a hook landed fewer than asked. */
function ingestTitle(landed: number, asked: number, edges: number): string {
    // A run whose whole result was edges between nodes already on canvas. Saying
    // `0 nodes` first would lead with the half that never had anything in it.
    if (!landed && edges) return `Ingested ${edges.toLocaleString()} ${edges === 1 ? 'edge' : 'edges'}`
    const nodes = asked && landed < asked
        ? `Ingested ${landed.toLocaleString()} of ${asked.toLocaleString()} nodes`
        : `Ingested ${landed.toLocaleString()} ${landed === 1 ? 'node' : 'nodes'}`
    if (!edges) return nodes
    return `${nodes}, ${edges.toLocaleString()} ${edges === 1 ? 'edge' : 'edges'}`
}
