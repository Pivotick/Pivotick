import { UIComponent } from '../../ui/UIComponent'
import type { UIManager } from '../../ui/UIManager'
import type { Edge } from '../../Edge'
import type { Node } from '../../Node'
import type { EventLogKind, EventLogOptions } from './options'
import './eventLog.scss'

/** One recorded emission. */
interface Entry {
    at: Date
    kind: EventLogKind
    /** The event's name, verbatim off the bus. */
    type: string
    /** A one-line subject: which node, which filter, how many. */
    detail: string
}

const DEFAULT_LIMIT = 500
const ALL_KINDS: EventLogKind[] = ['data', 'filter', 'selection']

/** Every kind, as offered by the toolbar's filter. */
const KIND_LABELS: Record<EventLogKind, string> = {
    data: 'Data',
    filter: 'Filters',
    selection: 'Selection',
}

/** A node or edge in one word: its label if it has one, else its id. */
function subject(element: Node | Edge): string {
    const label = element.getData()?.label
    return typeof label === 'string' && label ? label : element.id
}

/** Which keys differ between two data objects — what `nodeChange` actually changed. */
function changedKeys(before: Record<string, unknown>, after: Record<string, unknown>): string {
    const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])
    const moved = [...keys].filter(key => before?.[key] !== after?.[key])
    return moved.length ? moved.join(', ') : '(no visible change)'
}

/**
 * The event log: what the graph is emitting, newest first.
 *
 * It exists to be **the dock's second occupant** — the proof that `addDockTab` is enough
 * to build a pane with, rather than a hole shaped like the table. It shares the region's
 * row, height and fold with whatever else is registered, and it is built on the public
 * event buses only (`graph.on`, `queryEngine.on`, the interaction bus), exactly as
 * privileged as a plugin anyone else writes.
 *
 * Note the deliberate contrast with the table's use of the same two activation hooks: the
 * table **stops working** when it is off screen and re-derives on return, because its
 * content is a function of the graph's current state. The log cannot do that — an event
 * is gone once it has fired — so it keeps **recording** while hidden and only stops
 * *painting*, flushing what it missed when it comes back. Two opposite strategies on one
 * pair of hooks is the evidence the hooks aren't table-shaped.
 */
export class EventLog extends UIComponent {
    private readonly options: EventLogOptions

    private list?: HTMLDivElement
    private empty?: HTMLParagraphElement
    private pauseButton?: HTMLButtonElement
    private countLabel?: HTMLSpanElement

    /** Newest first. Capped at {@link EventLogOptions.limit}. */
    private entries: Entry[] = []
    private paused: boolean
    /** The kind on show, or `null` for all of them. */
    private shown: EventLogKind | null = null
    /** Whether this tab is the one the dock is showing — see the class note. */
    private active = false
    /** Entries recorded while hidden, still to be painted. */
    private pending = 0
    private disposeTab?: () => void

    constructor(uiManager: UIManager, options: EventLogOptions = {}) {
        super(uiManager)
        this.options = options
        this.paused = options.paused === true
    }

    private get limit(): number {
        return this.options.limit ?? DEFAULT_LIMIT
    }

    private get kinds(): EventLogKind[] {
        return this.options.kinds ?? ALL_KINDS
    }

    /* ---------- lifecycle ---------- */

    protected onMount() {
        // No slot of its own: the pane is a dock tab, and the dock decides where it goes.
        // Registering is also what *builds* the region when the table is switched off.
        this.disposeTab = this.uiManager.addDockTab({
            id: this.options.id,
            label: this.options.label ?? 'Events',
            order: this.options.order,
            render: () => this.renderBody(),
            toolbar: () => this.buildToolbar(),
            onActivate: () => {
                this.active = true
                // Paint whatever arrived while nobody was looking.
                if (this.pending) this.renderList()
                this.pending = 0
            },
            onDeactivate: () => { this.active = false },
        })
    }

    protected onAfterMount() {
        const graph = this.uiManager.graph

        if (this.kinds.includes('data')) {
            this.watch(graph, 'ready', () => this.record('data', 'ready', ''))
            this.watch(graph, 'nodeAdd', (node: Node) => this.record('data', 'nodeAdd', subject(node)))
            this.watch(graph, 'nodeRemove', (node: Node) => this.record('data', 'nodeRemove', subject(node)))
            this.watch(graph, 'nodeChange', (node: Node, before: Record<string, unknown>, after: Record<string, unknown>) =>
                this.record('data', 'nodeChange', `${subject(node)} — ${changedKeys(before, after)}`))
            this.watch(graph, 'edgeAdd', (edge: Edge) => this.record('data', 'edgeAdd', `${edge.from.id} → ${edge.to.id}`))
            this.watch(graph, 'edgeRemove', (edge: Edge) => this.record('data', 'edgeRemove', `${edge.from.id} → ${edge.to.id}`))
            this.watch(graph, 'edgeChange', (edge: Edge) => this.record('data', 'edgeChange', subject(edge)))
            this.watch(graph, 'noteAdd', (note: { id: string }) => this.record('data', 'noteAdd', note.id))
            this.watch(graph, 'noteRemove', (note: { id: string }) => this.record('data', 'noteRemove', note.id))
            this.watch(graph, 'noteChange', (note: { id: string }) => this.record('data', 'noteChange', note.id))
            this.watch(graph, 'dataBatchChanged', (changes: unknown[]) =>
                this.record('data', 'dataBatchChanged', `${changes.length} change${changes.length === 1 ? '' : 's'}`))
        }

        if (this.kinds.includes('filter')) {
            const engine = this.uiManager.graph.queryEngine
            this.watch(engine, 'filterAdd', (key: string, value: unknown) =>
                this.record('filter', 'filterAdd', `${key} = ${describe(value)}`))
            this.watch(engine, 'filterRemove', (key: string) => this.record('filter', 'filterRemove', key))
            this.watch(engine, 'filterChange', (filters: unknown) =>
                this.record('filter', 'filterChange', `${Object.keys(filters ?? {}).length} active`))
            this.watch(engine, 'filterReset', () => this.record('filter', 'filterReset', ''))
        }
    }

    protected onGraphReady() {
        // The renderer — and so the interaction bus — does not exist until after the UI is
        // built, which is why the selection is wired here rather than in afterMount.
        if (!this.kinds.includes('selection')) return
        this.trackInteraction('selectNode', (node) => this.record('selection', 'selectNode', subject(node as Node)))
        this.trackInteraction('unselectNode', (node) => this.record('selection', 'unselectNode', subject(node as Node)))
        this.trackInteraction('selectNodes', (nodes) =>
            this.record('selection', 'selectNodes', `${(nodes as unknown[]).length} nodes`))
        this.trackInteraction('unselectNodes', (nodes) =>
            this.record('selection', 'unselectNodes', `${(nodes as unknown[]).length} nodes`))
    }

    /**
     * Subscribe to one of the graph's `on`/`off` buses and unsubscribe on destroy. Typed
     * loosely on purpose: the two buses have unrelated event maps, and the log's job is
     * to be indiscriminate about them.
     */
    private watch(
        bus: { on: (event: never, handler: never) => void, off: (event: never, handler: never) => void },
        event: string,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        handler: (...args: any[]) => void,
    ): void {
        bus.on(event as never, handler as never)
        this.track(() => bus.off(event as never, handler as never))
    }

    /* ---------- recording ---------- */

    private record(kind: EventLogKind, type: string, detail: string): void {
        if (this.paused) return
        this.entries.unshift({ at: new Date(), kind, type, detail })
        if (this.entries.length > this.limit) this.entries.length = this.limit

        // Recording never stops with the tab; only painting does. An event is gone once it
        // has fired, so a log that slept through it has lost it for good.
        if (!this.active) {
            this.pending++
            return
        }
        this.renderList()
    }

    /* ---------- the pane ---------- */

    private renderBody(): HTMLElement {
        const body = document.createElement('div')
        body.className = 'pvt-eventlog'

        this.empty = document.createElement('p')
        this.empty.className = 'pvt-eventlog-empty'
        this.empty.textContent = 'Nothing yet. Move the graph, filter it, or select something.'
        body.appendChild(this.empty)

        this.list = document.createElement('div')
        this.list.className = 'pvt-eventlog-list'
        body.appendChild(this.list)

        this.renderList()
        return body
    }

    private visibleEntries(): Entry[] {
        return this.shown ? this.entries.filter(entry => entry.kind === this.shown) : this.entries
    }

    private renderList(): void {
        const list = this.list
        if (!list) return

        const entries = this.visibleEntries()
        if (this.empty) this.empty.hidden = entries.length > 0
        if (this.countLabel) {
            this.countLabel.textContent = `${entries.length} event${entries.length === 1 ? '' : 's'}`
        }

        list.innerHTML = ''
        for (const entry of entries) {
            const row = document.createElement('div')
            row.className = 'pvt-eventlog-row'
            row.dataset.kind = entry.kind

            const time = document.createElement('span')
            time.className = 'pvt-eventlog-time'
            time.textContent = entry.at.toTimeString().slice(0, 8)

            const type = document.createElement('span')
            type.className = 'pvt-eventlog-type'
            type.textContent = entry.type

            const detail = document.createElement('span')
            detail.className = 'pvt-eventlog-detail'
            detail.textContent = entry.detail

            row.append(time, type, detail)
            list.appendChild(row)
        }
    }

    /**
     * Pause, Clear and a kind filter. Rebuilt on every activation, like the table's, so
     * the controls always read the log's current state.
     */
    private buildToolbar(): HTMLElement[] {
        this.countLabel = document.createElement('span')
        this.countLabel.className = 'pvt-eventlog-count'

        const choice = document.createElement('div')
        choice.className = 'pvt-eventlog-kind-wrap'
        const select = document.createElement('select')
        select.className = 'pvt-eventlog-kind'
        select.title = 'Show one kind of event'
        for (const [value, label] of [['', 'All events'], ...this.kinds.map(k => [k, KIND_LABELS[k]])] as [string, string][]) {
            const option = document.createElement('option')
            option.value = value
            option.textContent = label
            option.selected = value === (this.shown ?? '')
            select.appendChild(option)
        }
        select.addEventListener('change', () => {
            this.shown = (select.value || null) as EventLogKind | null
            this.renderList()
        })
        choice.appendChild(select)

        this.pauseButton = document.createElement('button')
        this.pauseButton.type = 'button'
        this.pauseButton.className = 'pvt-eventlog-pause'
        this.syncPauseButton()
        this.pauseButton.addEventListener('click', () => {
            this.paused = !this.paused
            this.syncPauseButton()
        })

        const clear = document.createElement('button')
        clear.type = 'button'
        clear.className = 'pvt-eventlog-clear'
        clear.textContent = 'Clear'
        clear.title = 'Drop every entry recorded so far'
        clear.addEventListener('click', () => {
            this.entries = []
            this.pending = 0
            this.renderList()
        })

        this.renderList()
        return [this.countLabel, choice, this.pauseButton, clear]
    }

    private syncPauseButton(): void {
        const button = this.pauseButton
        if (!button) return
        button.textContent = this.paused ? 'Resume' : 'Pause'
        button.title = this.paused ? 'Start recording again' : 'Stop recording (the list stays)'
        button.classList.toggle('active', this.paused)
    }

    protected onDestroy() {
        // Unregistering takes the pane out of the dock, and empties the region if this was
        // the only tab in it.
        this.disposeTab?.()
        this.disposeTab = undefined
        this.entries = []
        this.pending = 0
        this.active = false
        this.list = undefined
        this.empty = undefined
        this.pauseButton = undefined
        this.countLabel = undefined
    }

    /** What the log has recorded, newest first — for tests and for a consumer's own export. */
    public getEntries(): ReadonlyArray<{ at: Date, kind: EventLogKind, type: string, detail: string }> {
        return [...this.entries]
    }
}

/** A filter value in one short phrase, whatever shape it arrived in. */
function describe(value: unknown): string {
    if (value === null || value === undefined) return '—'
    if (Array.isArray(value)) return `${value.length} value${value.length === 1 ? '' : 's'}`
    if (typeof value === 'object') return '{…}'
    return String(value)
}
