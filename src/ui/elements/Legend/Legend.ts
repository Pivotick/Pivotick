import type { Node } from '../../../Node'
import type { FilterFacet, FilterValue, GraphFilters } from '../../../interfaces/GraphQueryEngine'
import type { LegendEntry, LegendOptions } from '../../../interfaces/GraphUI'
import { createHtmlElement } from '../../../utils/ElementCreation'
import { FormFactory } from '../../../utils/FormFactory'
import { arrowDown, selectionInverse, show } from '../../icons'
import type { UIManager } from '../../UIManager'
import { UIComponent } from '../../UIComponent'
import './legend.scss'

/** The filter key the legend writes when it isn't adopting a declared facet. */
export const RESERVED_LEGEND_FILTER_KEY = '__legend'

const DEFAULT_MAX_VISIBLE_ENTRIES = 12

/**
 * Ceilings for the *automatic* legend (the one nobody asked for). More categories
 * than this and the dimension isn't categorical — an id-like key gives one value
 * per node, and one colour each, which would otherwise pass the colour check. More
 * nodes than this and the colour sampling isn't worth paying for uninvited.
 */
const AUTO_MAX_CATEGORIES = 24
const AUTO_MAX_NODES = 5000

/** Header text for the automatic legend, whose dimension has no key name. */
const AUTO_TITLE = 'Type'

/** A legend entry with every default resolved, plus the node count behind it. */
interface ResolvedLegendEntry {
    id: string
    label: string
    color: string
    predicate: (node: Node) => boolean
    count: number
}

/** The outcome of deriving entries from a dimension of the data. */
interface DerivedEntries {
    entries: ResolvedLegendEntry[]
    /** A category resolved to more than one colour, so a swatch can only approximate. */
    conflicted: boolean
}

/**
 * The canvas legend: a key for the graph's colours that doubles as a filter.
 *
 * It is **descriptive** — it reports the colours the renderer already resolved
 * (`renderer.getNodeStyle`) and never assigns one, so the consumer keeps sole
 * ownership of node colouring. Entries come from `UI.legend.key` (derived from
 * the data), from `UI.legend.entries` (declared, possibly a function of the
 * graph), or from both.
 *
 * Clicking an entry hides its category through the {@link GraphQueryEngine}, so
 * the legend and the filter panel are two views of one filter: it writes
 * {@link RESERVED_LEGEND_FILTER_KEY} through a reserved predicate facet, or — when
 * `key` names a declared `select` / `multiselect` facet — that facet's own key.
 *
 * Shown in `full` and `light` modes only.
 */
export class Legend extends UIComponent {
    private slot?: HTMLElement
    private panel?: HTMLDivElement
    private listElement?: HTMLDivElement
    private entries: ResolvedLegendEntry[] = []
    private readonly rows = new Map<string, HTMLElement>()
    /** Entry ids the user switched off. */
    private hiddenIds = new Set<string>()
    private collapsed = false
    /** The filter key in use: the reserved one, or a declared facet's when adopted. */
    private filterKey: string = RESERVED_LEGEND_FILTER_KEY
    /** The declared facet being driven, when the legend's `key` names one. */
    private adoptedFacet?: FilterFacet
    private facetRegistered = false
    /** Set while the legend writes its own filter, so it doesn't read the echo back. */
    private applyingFilter = false
    private rebuildFrame: number | null = null
    /** Header text when `title` isn't set — depends on where the entries came from. */
    private titleFallback = 'Legend'
    /** Warnings already emitted, so rebuilds don't spam the console. */
    private readonly warned = new Set<string>()

    constructor(uiManager: UIManager) {
        super(uiManager)
    }

    /* ---------- lifecycle ---------- */

    protected onMount(container?: HTMLElement) {
        if (!container) return
        this.slot = container
        this.collapsed = this.config?.collapsed === true

        this.panel = createHtmlElement('div', { class: 'pvt-legend-panel' })
        container.appendChild(this.panel)

        // Delegated once on the panel, which survives every rebuild — per-row
        // listeners would pile up each time the entries are re-resolved.
        this.listen(this.panel, 'click', (event) => this.onPanelClick(event as MouseEvent))
    }

    private onPanelClick(event: MouseEvent) {
        const target = event.target as HTMLElement
        const action = target.closest('.pvt-legend-action') as HTMLElement | null
        if (action) {
            if (action.dataset.action === 'show-all') this.showAll()
            else if (action.dataset.action === 'invert') this.invert()
            else if (action.dataset.action === 'collapse') this.toggleCollapsed()
            return
        }

        if (!this.filterable) return
        const row = target.closest('.pvt-legend-entry') as HTMLElement | null
        if (row?.dataset.id) this.toggle(row.dataset.id, event.altKey)
    }

    protected onAfterMount() {
        const graph = this.uiManager.graph

        // Entries can be a function of the graph, and derived entries follow the data.
        const onData = () => this.queueRebuild()
        graph.on('dataBatchChanged', onData)
        this.track(() => graph.off('dataBatchChanged', onData))

        const onFilterChange = (filters: GraphFilters) => this.syncFromFilters(filters)
        graph.queryEngine.on('filterChange', onFilterChange)
        this.track(() => graph.queryEngine.off('filterChange', onFilterChange))

        // The renderer (whose styles the swatches are sampled from) and the declared
        // facets are both wired *after* the UIManager is constructed, so the first
        // resolution waits a frame rather than running inside the constructor.
        this.queueRebuild()
    }

    protected onGraphReady() {
        this.queueRebuild()
    }

    protected onDestroy() {
        if (this.rebuildFrame !== null) cancelAnimationFrame(this.rebuildFrame)
        this.rebuildFrame = null
        this.releaseFacet()
        this.panel?.remove()
        this.panel = undefined
        this.listElement = undefined
        this.rows.clear()
    }

    /* ---------- public API ---------- */

    /**
     * Re-read `UI.legend` and rebuild. Called by `graph.setLegend`, which has
     * already replaced the options block.
     */
    public refresh() {
        this.rebuild()
    }

    /* ---------- configuration ---------- */

    /**
     * `UI.legend` normalised: `false` (or `enabled: false`) means no legend, while
     * `true` / absent / an object with no `key` or `entries` all mean "work out what
     * to list" — see {@link deriveAutomatically}.
     */
    private get config(): LegendOptions | undefined {
        const declared = this.uiManager.getOptions().legend
        if (declared === false) return undefined
        if (declared === undefined || declared === true) return {}
        return declared.enabled === false ? undefined : declared
    }

    /** `UI.legend: true` — derive a legend without vetting the colours first. */
    private get forced(): boolean {
        return this.uiManager.getOptions().legend === true
    }

    private get filterable(): boolean {
        return this.config?.filterable !== false
    }

    /* ---------- rebuild ---------- */

    private queueRebuild() {
        if (this.rebuildFrame !== null) return
        this.rebuildFrame = requestAnimationFrame(() => {
            this.rebuildFrame = null
            this.rebuild()
        })
    }

    private rebuild() {
        if (!this.panel) return
        const config = this.config
        if (!config) {
            this.clear()
            return
        }

        this.resolveFilterKey(config)
        this.entries = this.resolveEntries(config)
        // An entry that vanished from the data loses its toggle state rather than
        // lingering as a hidden ghost.
        for (const id of [...this.hiddenIds]) {
            if (!this.entries.some(entry => entry.id === id)) this.hiddenIds.delete(id)
        }

        // Nothing to list (a key no node carries, an empty declaration): show nothing
        // at all rather than an empty box with a title.
        if (this.entries.length === 0) {
            this.clear()
            return
        }

        if (this.filterable) this.claimFacet()
        else this.releaseFacet()

        this.render(config)

        // Refresh the filter *value* so entries that just appeared are part of it.
        // Only when something is hidden: an empty legend must not clear a filter
        // another party (the panel, in adopted mode) owns.
        if (this.filterable && this.hiddenIds.size > 0) this.applyFilter(false)
    }

    /** Empty the legend without tearing the component down (`setLegend(undefined)`). */
    private clear() {
        // A legend that goes away must not leave nodes hidden behind it — including
        // when it was driving an adopted facet.
        if (this.hiddenIds.size > 0) this.uiManager.graph.queryEngine.removeFilter(this.filterKey)
        this.releaseFacet()
        this.entries = []
        this.hiddenIds.clear()
        this.rows.clear()
        if (this.panel) this.panel.innerHTML = ''
        this.listElement = undefined
    }

    /* ---------- entry resolution ---------- */

    private resolveEntries(config: LegendOptions): ResolvedLegendEntry[] {
        const declared = this.declaredEntries(config)
        if (declared?.length) {
            this.titleFallback = 'Legend'
            return this.fromDeclared(declared, config, this.topLevelNodes())
        }

        if (config.key !== undefined) {
            const key = config.key
            this.titleFallback = FormFactory.niceLabelFromKey(key)
            return this.derive(node => node.getData()?.[key], key, this.topLevelNodes()).entries
        }

        this.titleFallback = AUTO_TITLE
        return this.deriveAutomatically()
    }

    /** The nodes of *this* graph — a cluster's children live in its own subgraph. */
    private topLevelNodes(): Node[] {
        return this.uiManager.graph.getMutableNodes().filter(node => !node.isChild)
    }

    /**
     * The legend nobody asked for. It keys on `render.nodeTypeAccessor` — the
     * dimension the consumer already declared for `nodeStyleMap`, so it is never a
     * guess about their data — and then checks that this dimension really *is* the
     * colour dimension before showing anything (see {@link explainsColors}). A
     * legend that can't be shown truthfully isn't shown at all, and says nothing
     * about it: nobody asked. `UI.legend: true` skips the vetting.
     */
    private deriveAutomatically(): ResolvedLegendEntry[] {
        const accessor = this.uiManager.graph.renderer?.getOptions()?.nodeTypeAccessor
        if (typeof accessor !== 'function') {
            if (this.forced) {
                this.warnOnce('auto-no-accessor',
                    'Pivotick: `UI.legend: true` has nothing to list — declare `render.nodeTypeAccessor`, or give the legend a `key` / `entries`.')
            }
            return []
        }

        const nodes = this.topLevelNodes()
        if (!this.forced && nodes.length > AUTO_MAX_NODES) {
            this.warnOnce('auto-too-many-nodes',
                `Pivotick: not deriving a legend for ${nodes.length} nodes (over ${AUTO_MAX_NODES}); declare 'UI.legend' to have one anyway.`)
            return []
        }

        // Quiet: the blank-value and multi-colour warnings are for a legend the
        // consumer configured, not for one the library is merely considering.
        const derived = this.derive(node => accessor(node), 'nodeTypeAccessor', nodes, !this.forced)
        if (this.forced) return derived.entries
        return this.explainsColors(derived) ? derived.entries : []
    }

    /**
     * Does this dimension actually explain what the canvas looks like? Every
     * category must resolve to exactly one colour, there must be at least two
     * colours (or the colours aren't telling the categories apart), and few enough
     * categories to *be* categories — an id-like dimension yields one value per
     * node, each with its own colour, which would sail through the colour test.
     */
    private explainsColors(derived: DerivedEntries): boolean {
        if (derived.conflicted) return false
        const { entries } = derived
        if (entries.length < 2 || entries.length > AUTO_MAX_CATEGORIES) return false
        return new Set(entries.map(entry => entry.color)).size >= 2
    }

    private declaredEntries(config: LegendOptions): LegendEntry[] | undefined {
        const { entries } = config
        if (typeof entries !== 'function') return entries
        try {
            return entries(this.uiManager.graph)
        } catch (error) {
            this.warnOnce('entries-threw', 'Pivotick: the legend\'s entries function threw; the legend is empty.', error)
            return []
        }
    }

    /** Declared entries: `key` (when given) supplies the predicate they don't carry. */
    private fromDeclared(declared: LegendEntry[], config: LegendOptions, nodes: Node[]): ResolvedLegendEntry[] {
        const withOrder = declared.map((entry, index) => ({ entry, order: entry.order ?? index }))
        withOrder.sort((a, b) => a.order - b.order)

        return withOrder.map(({ entry }) => {
            const key = config.key
            const predicate = entry.predicate
                ?? (key !== undefined
                    ? (node: Node) => this.matchesValue(node.getData()?.[key], entry.id)
                    : undefined)
            if (!predicate) {
                this.warnOnce(`no-predicate-${entry.id}`,
                    `Pivotick: legend entry '${entry.id}' has no predicate and the legend declares no 'key', so it matches no node.`)
            }
            const safePredicate = this.guard(entry.id, predicate ?? (() => false))
            return {
                id: entry.id,
                // An id is a data *value*, so it is shown as it is — like the filter
                // panel's own option labels. Only keys get prettified.
                label: entry.label ?? entry.id,
                color: entry.color,
                predicate: safePredicate,
                count: nodes.reduce((total, node) => total + (safePredicate(node) ? 1 : 0), 0),
            }
        })
    }

    /**
     * Derived entries: one per distinct value `read` returns, each swatch sampled
     * from the colour the renderer resolved for the first node carrying that value.
     *
     * Blank values (`null` / `undefined` / `''`) get no entry — those nodes are
     * unrepresented, and the legend never hides them. A value rendering more than
     * one colour keeps the first, since the legend can only show one swatch.
     *
     * `label` names the dimension in warnings; `quiet` suppresses them for a legend
     * that is only being *considered* (see {@link deriveAutomatically}).
     */
    private derive(
        read: (node: Node) => unknown,
        label: string,
        nodes: Node[],
        quiet = false
    ): DerivedEntries {
        const safeRead = this.guardRead(label, read)
        const found = new Map<string, { color: string, count: number }>()
        let blanks = 0
        let conflicted = false

        for (const node of nodes) {
            const raw = safeRead(node)
            const values = Array.isArray(raw) ? raw : [raw]
            let represented = false

            for (const value of values) {
                if (value === null || value === undefined || value === '') continue
                represented = true
                const id = String(value)
                const color = this.sampleColor(node)
                const existing = found.get(id)
                if (!existing) {
                    found.set(id, { color, count: 1 })
                    continue
                }
                existing.count++
                if (color !== existing.color) {
                    conflicted = true
                    if (!quiet) {
                        this.warnOnce(`multi-color-${id}`,
                            `Pivotick: legend category '${id}' (${label}) renders more than one colour; the legend shows the first (${existing.color}).`)
                    }
                }
            }
            if (!represented) blanks++
        }

        if (blanks > 0 && !quiet) {
            this.warnOnce(`blank-${label}`,
                `Pivotick: ${blanks} node(s) have no '${label}', so they have no legend entry and the legend cannot hide them.`)
        }

        const entries = [...found].map(([id, { color, count }]) => ({
            id,
            label: id,
            color,
            predicate: (node: Node) => this.matchesValue(safeRead(node), id),
            count,
        }))
        return { entries, conflicted }
    }

    /** The colour the renderer actually paints this node with, as a CSS colour. */
    private sampleColor(node: Node): string {
        const color = this.uiManager.graph.renderer?.getNodeStyle(node)?.color
        if (typeof color === 'string') return color
        this.warnOnce('unresolved-color',
            'Pivotick: the renderer returned an unresolved node colour; legend swatches fall back to the theme colour.')
        return 'var(--pvt-node-color, #007acc)'
    }

    /** Derived matching: a scalar equals the id, an array contains it (stringified). */
    private matchesValue(raw: unknown, id: string): boolean {
        if (Array.isArray(raw)) return raw.some(value => String(value) === id)
        return raw !== null && raw !== undefined && String(raw) === id
    }

    /** Read a dimension without letting a consumer accessor's throw take the render down. */
    private guardRead(label: string, read: (node: Node) => unknown): (node: Node) => unknown {
        return (node: Node) => {
            try {
                return read(node)
            } catch (error) {
                this.warnOnce(`read-threw-${label}`,
                    `Pivotick: reading '${label}' for the legend threw; it lists nothing.`, error)
                return undefined
            }
        }
    }

    /** Run a consumer predicate without letting a throw take the render down. */
    private guard(id: string, predicate: (node: Node) => boolean): (node: Node) => boolean {
        return (node: Node) => {
            try {
                return predicate(node)
            } catch (error) {
                this.warnOnce(`predicate-threw-${id}`,
                    `Pivotick: legend entry '${id}' predicate threw; it will match no node.`, error)
                return false
            }
        }
    }

    private warnOnce(token: string, message: string, error?: unknown) {
        if (this.warned.has(token)) return
        this.warned.add(token)
        if (error !== undefined) console.warn(message, error)
        else console.warn(message)
    }

    /* ---------- filter wiring ---------- */

    /**
     * Decide which filter key the legend drives. When its `key` names a declared
     * `select` / `multiselect` facet, that facet is adopted so the legend and the
     * filter panel are two views of one filter; otherwise the legend owns a
     * reserved predicate facet of its own.
     */
    private resolveFilterKey(config: LegendOptions) {
        const previousKey = this.filterKey
        const declared = config.key !== undefined
            ? this.uiManager.graph.queryEngine.getFacets().find(facet => facet.key === config.key)
            : undefined

        if (declared && (declared.type === 'select' || declared.type === 'multiselect')) {
            this.adoptedFacet = declared
            this.filterKey = declared.key
        } else {
            if (declared) {
                this.warnOnce(`adopt-${declared.key}`,
                    `Pivotick: the legend's key '${declared.key}' is a declared '${declared.type}' facet, which can't hold a list of values; the legend filters on its own instead.`)
            }
            this.adoptedFacet = undefined
            this.filterKey = RESERVED_LEGEND_FILTER_KEY
        }

        // Switching keys (a setLegend with a different key) must not leave the old
        // filter behind.
        if (previousKey !== this.filterKey) {
            this.releaseFacet(previousKey)
            this.uiManager.graph.queryEngine.removeFilter(previousKey)
        }
    }

    /**
     * Register the reserved facet. Its predicate is *negative*: a node is hidden
     * when it matches a hidden entry, so a node no entry covers (a blank value) is
     * never hidden by the legend.
     */
    private claimFacet() {
        if (this.adoptedFacet || this.facetRegistered) return
        this.uiManager.graph.queryEngine.registerFacet({
            key: RESERVED_LEGEND_FILTER_KEY,
            label: 'Legend',
            type: 'multiselect',
            matchMode: 'exact',
            predicate: (node: Node, value: FilterValue) => {
                const visible = new Set(this.toIdArray(value))
                return !this.entries.some(entry => !visible.has(entry.id) && entry.predicate(node))
            },
        })
        this.facetRegistered = true
    }

    private releaseFacet(key: string = this.filterKey) {
        if (!this.facetRegistered || key !== RESERVED_LEGEND_FILTER_KEY) return
        this.uiManager.graph.queryEngine.unregisterFacet(RESERVED_LEGEND_FILTER_KEY)
        this.facetRegistered = false
    }

    private toIdArray(value: FilterValue): string[] {
        if (Array.isArray(value)) return value.map(entry => String(entry))
        if (value === undefined || value === null) return []
        if (typeof value === 'object') return []
        return [String(value)]
    }

    /**
     * Write the visible ids to the filter. Nothing hidden ⇒ the filter is removed,
     * so `getFilters()` carries no phantom entry and the filter pill stays quiet.
     */
    private applyFilter(emitEvent = true) {
        const engine = this.uiManager.graph.queryEngine
        const visible = this.entries.filter(entry => !this.hiddenIds.has(entry.id)).map(entry => entry.id)

        this.applyingFilter = true
        try {
            if (this.hiddenIds.size === 0) engine.removeFilter(this.filterKey)
            else engine.setFilter(this.filterKey, {
                value: visible,
                matchMode: this.adoptedFacet?.matchMode ?? 'exact',
            })
        } finally {
            this.applyingFilter = false
        }

        this.applyEntryStates()
        if (emitEvent) {
            this.uiManager.graph.legendToggled({
                hidden: [...this.hiddenIds],
                visible,
            })
        }
    }

    /**
     * Re-derive which entries are lit from the live filters, so the legend follows
     * `resetFilters()`, the filter panel, and programmatic `setFilter` calls.
     *
     * An **absent** filter means every entry is lit. An **empty list** means the
     * same in adopted mode (an empty multiselect is how the panel says "no
     * constraint"), but means "everything hidden" for the legend's own key.
     */
    private syncFromFilters(filters: GraphFilters) {
        if (this.applyingFilter || !this.filterable || this.entries.length === 0) return

        const config = filters[this.filterKey]
        if (config === undefined) {
            if (this.hiddenIds.size === 0) return
            this.hiddenIds.clear()
            this.applyEntryStates()
            return
        }

        const visible = this.toIdArray(config.value)
        if (visible.length === 0 && this.adoptedFacet) {
            this.hiddenIds.clear()
        } else {
            // Values the legend knows nothing about are left alone — they belong to
            // whoever set them, not to the legend.
            this.hiddenIds = new Set(this.entries.filter(entry => !visible.includes(entry.id)).map(entry => entry.id))
        }
        this.applyEntryStates()
    }

    /* ---------- interaction ---------- */

    private toggle(id: string, solo: boolean) {
        if (!this.filterable) return

        if (solo) {
            this.hiddenIds = new Set(this.entries.filter(entry => entry.id !== id).map(entry => entry.id))
        } else if (this.hiddenIds.has(id)) {
            this.hiddenIds.delete(id)
        } else {
            if (this.wouldEmptyAdopted(this.visibleCount - 1)) return
            this.hiddenIds.add(id)
        }
        this.applyFilter()
    }

    private showAll() {
        if (this.hiddenIds.size === 0) return
        this.hiddenIds.clear()
        this.applyFilter()
    }

    private invert() {
        // Inverting *replaces* the hidden set, so what stays visible is exactly what
        // is hidden right now.
        if (this.wouldEmptyAdopted(this.hiddenIds.size)) return
        this.hiddenIds = new Set(this.entries.filter(entry => !this.hiddenIds.has(entry.id)).map(entry => entry.id))
        this.applyFilter()
    }

    private get visibleCount(): number {
        return this.entries.length - this.hiddenIds.size
    }

    /**
     * An adopted facet cannot express "hide everything": an empty value list is how
     * the filter panel says *no constraint*, so writing it would show the whole graph
     * back. A toggle that would land there is refused instead (and its control
     * disabled) — the legend's own key has no such limit.
     */
    private wouldEmptyAdopted(nextVisibleCount: number): boolean {
        return this.adoptedFacet !== undefined && nextVisibleCount <= 0
    }

    private toggleCollapsed() {
        this.collapsed = !this.collapsed
        this.applyCollapsed()
    }

    private applyCollapsed() {
        this.panel?.classList.toggle('pvt-legend-collapsed', this.collapsed)
        const button = this.panel?.querySelector('.pvt-legend-collapse')
        button?.setAttribute('aria-expanded', String(!this.collapsed))
        button?.setAttribute('title', this.collapsed ? 'Expand the legend' : 'Collapse the legend')
    }

    /* ---------- rendering ---------- */

    private render(config: LegendOptions) {
        if (!this.panel) return
        this.panel.innerHTML = ''
        this.rows.clear()

        this.slot?.setAttribute('data-position', config.position ?? 'bottom-left')
        this.panel.classList.toggle('pvt-legend-static', !this.filterable)

        this.panel.appendChild(this.renderHeader(config))

        const max = config.maxVisibleEntries ?? DEFAULT_MAX_VISIBLE_ENTRIES
        this.listElement = createHtmlElement('div', {
            class: 'pvt-legend-list',
            // Cap the height in rows, then scroll — the canvas must never grow because
            // a category list got long. The quarter row of slack lets the next entry's
            // top edge peek through, which is what says "there is more below" without
            // slicing a label in half.
            style: `max-height: calc(${max + 0.25} * var(--pvt-legend-row-height))`,
        })
        for (const entry of this.entries) this.listElement.appendChild(this.renderEntry(entry, config))
        this.panel.appendChild(this.listElement)

        this.applyCollapsed()
        this.applyEntryStates()
    }

    private renderHeader(config: LegendOptions): HTMLElement {
        const title = config.title ?? this.titleFallback
        const children: HTMLElement[] = []

        if (this.filterable) {
            children.push(this.action('show-all', show, 'Show every category'))
            children.push(this.action('invert', selectionInverse, 'Invert which categories are shown'))
        }
        if (config.collapsible !== false) {
            const collapse = this.action('collapse', arrowDown, 'Collapse the legend')
            collapse.classList.add('pvt-legend-collapse')
            collapse.setAttribute('aria-expanded', 'true')
            children.push(collapse)
        }

        return createHtmlElement('div', { class: 'pvt-legend-header' }, [
            createHtmlElement('span', { class: 'pvt-legend-title', title }, [title]),
            createHtmlElement('div', { class: 'pvt-legend-actions' }, children),
        ])
    }

    private action(id: string, icon: string, title: string): HTMLElement {
        const button = createHtmlElement('button', {
            type: 'button',
            class: 'pvt-legend-action',
            'data-action': id,
            title,
        })
        button.innerHTML = icon // an inline SVG from the icon set, not user content
        return button
    }

    private renderEntry(entry: ResolvedLegendEntry, config: LegendOptions): HTMLElement {
        const swatch = createHtmlElement('span', { class: 'pvt-legend-swatch' })
        // Via the CSSOM, not an interpolated style attribute: the colour comes from
        // consumer data, and this way the browser validates it (a bogus value is
        // dropped) instead of it landing in the attribute verbatim.
        swatch.style.setProperty('--pvt-legend-swatch-color', entry.color)
        const children: HTMLElement[] = [
            swatch,
            createHtmlElement('span', { class: 'pvt-legend-label' }, [entry.label]),
        ]
        if (config.showCounts !== false) {
            children.push(createHtmlElement('span', { class: 'pvt-legend-count' }, [String(entry.count)]))
        }

        const row = this.filterable
            ? createHtmlElement('button', { type: 'button', class: 'pvt-legend-entry', 'data-id': entry.id }, children)
            : createHtmlElement('div', { class: 'pvt-legend-entry', 'data-id': entry.id }, children)
        row.classList.toggle('pvt-legend-empty', entry.count === 0)
        this.rows.set(entry.id, row)
        return row
    }

    /** Push the hidden/shown state (and what is still clickable) onto the DOM. */
    private applyEntryStates() {
        for (const [id, row] of this.rows) {
            const entry = this.entries.find(candidate => candidate.id === id)
            const hidden = this.hiddenIds.has(id)
            if (this.filterable) {
                row.setAttribute('aria-pressed', String(!hidden))
                // Refusing the toggle is better explained on the control than by a
                // click that appears to do nothing (see wouldEmptyAdopted).
                const blocked = !hidden && this.wouldEmptyAdopted(this.visibleCount - 1)
                const button = row as HTMLButtonElement
                button.disabled = blocked
                row.setAttribute('title', blocked
                    ? 'The last shown category can\'t be hidden while the legend drives the filter panel\'s facet.'
                    : hidden
                        ? `Show ${entry?.label ?? id}`
                        : `Hide ${entry?.label ?? id} (alt-click to show only this one)`)
            }
            row.classList.toggle('pvt-legend-hidden', hidden)
        }

        const invert = this.panel?.querySelector('.pvt-legend-action[data-action="invert"]') as HTMLButtonElement | null
        if (invert) invert.disabled = this.wouldEmptyAdopted(this.hiddenIds.size)
        const showAll = this.panel?.querySelector('.pvt-legend-action[data-action="show-all"]') as HTMLButtonElement | null
        if (showAll) showAll.disabled = this.hiddenIds.size === 0
    }
}
