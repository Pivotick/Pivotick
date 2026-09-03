import type { Edge } from '../../../Edge'
import type { Node } from '../../../Node'
import { EDGE_FILTER_PREFIX } from '../../../GraphQueryEngine'
import type { EdgeFacet, FilterFacet, FilterValue, GraphFilters } from '../../../interfaces/GraphQueryEngine'
import type { LegendEntry, LegendScope, LegendSection } from '../../../interfaces/GraphUI'
import { createHtmlElement } from '../../../utils/ElementCreation'
import { FormFactory } from '../../../utils/FormFactory'
import { createEdgeSwatch } from '../../components/EdgeSwatch'
import { arrowDown, selectionInverse, show } from '../../icons'
import type { UIManager } from '../../UIManager'

const DEFAULT_MAX_VISIBLE_ENTRIES = 12

/**
 * Ceilings for the *automatic* legend (the one nobody asked for). More categories
 * than this and the dimension isn't categorical — an id-like key gives one value
 * per node, and one colour each, which would otherwise pass the colour check. More
 * nodes than this and the colour sampling isn't worth paying for uninvited.
 */
const AUTO_MAX_CATEGORIES = 24
const AUTO_MAX_NODES = 5000

/** Header text for the automatic section, whose dimension has no key name. */
const AUTO_TITLE = 'Type'

/** What a section keys on: nodes, or the graph's relations. */
type LegendItem = Node | Edge

/** A legend entry with every default resolved, plus the element count behind it. */
interface ResolvedLegendEntry {
    id: string
    label: string
    color: string
    predicate: (item: LegendItem) => boolean
    count: number
    /**
     * For an `edge` section: an edge carrying this value, whose resolved style the line
     * swatch is drawn from. Absent for declared entries, which bring their own colour.
     */
    sample?: Edge
}

/** The outcome of deriving entries from a dimension of the data. */
interface DerivedEntries {
    entries: ResolvedLegendEntry[]
    /** A category resolved to more than one colour, so a swatch can only approximate. */
    conflicted: boolean
}

/** What a section's action buttons ask for. */
type SectionAction = 'show-all' | 'invert' | 'collapse'

/**
 * One section of the canvas legend: a key for one dimension of the data, and the
 * filter that dimension drives.
 *
 * A section owns exactly one filter key — its own reserved facet, or a declared
 * `select` / `multiselect` facet it adopts when the section's `key` names one — so
 * several sections filter *independently* and the query engine ands them together.
 *
 * It is **descriptive**: swatches are sampled from the colour the renderer already
 * resolved (`renderer.getNodeStyle`), never assigned.
 *
 * Not a {@link UIComponent}: sections come and go with the config, and the
 * composite tree has no way to drop a child again. The {@link Legend} owns them,
 * keyed by {@link id}, and calls {@link dispose} when one leaves the config.
 */
export class LegendSectionView {
    /** Stable identity: the filter-key suffix and the `legendToggle` section field. */
    public readonly id: string

    private readonly uiManager: UIManager
    private config: LegendSection = {}
    /** Derive from `nodeTypeAccessor` without vetting the colours first. */
    private forced = false

    private entries: ResolvedLegendEntry[] = []
    private readonly rows = new Map<string, HTMLElement>()
    /** Entry ids the user switched off. */
    private hiddenIds = new Set<string>()
    /** The entry the pointer is on, while it is emphasising the canvas. */
    private hoveredId?: string
    private collapsed = false
    /** Set once `collapsed` has been seeded, so a rebuild doesn't unfold the section. */
    private collapseSeeded = false
    /** Whether alt-clicking this section's chevron folds every section — a stack of one has nothing to offer. */
    private collapseAllOffered = false

    /** This section's own filter key, used unless a declared facet is adopted. */
    public readonly reservedKey: string
    /** The filter key in use: the reserved one, or a declared facet's when adopted. */
    private filterKey: string
    /** The declared facet being driven, when the section's `key` names one. */
    private adoptedFacet?: FilterFacet | EdgeFacet
    private facetRegistered = false
    /** Set while the section writes its own filter, so it doesn't read the echo back. */
    private applyingFilter = false

    /** Header text when `title` isn't set — depends on where the entries came from. */
    private titleFallback = 'Legend'
    /** Warnings already emitted, so rebuilds don't spam the console. */
    private readonly warned = new Set<string>()

    private block?: HTMLElement
    private listElement?: HTMLDivElement

    constructor(uiManager: UIManager, id: string, reservedKey: string) {
        this.uiManager = uiManager
        this.id = id
        this.reservedKey = reservedKey
        this.filterKey = reservedKey
    }

    /* ---------- configuration ---------- */

    /**
     * Adopt the section's latest options. `collapsed` seeds the fold state once and
     * then belongs to the user — a `dataBatchChanged` must not pop a folded section
     * back open.
     */
    public setConfig(config: LegendSection, forced: boolean) {
        this.config = config
        this.forced = forced
        if (!this.collapseSeeded) {
            this.collapsed = config.collapsed === true
            this.collapseSeeded = true
        }
    }

    private get filterable(): boolean {
        return this.config.filterable !== false
    }

    private get highlightsOnHover(): boolean {
        return this.config.highlightOnHover !== false
    }

    /** Which collection this section keys on, and therefore which facets it drives. */
    private get scope(): LegendScope {
        return this.config.scope === 'edge' ? 'edge' : 'node'
    }

    /** The key the query engine holds this section's filter under. */
    private get engineKey(): string {
        return this.scope === 'edge' ? EDGE_FILTER_PREFIX + this.filterKey : this.filterKey
    }

    /**
     * The elements this section lists. A cluster's children live in its own subgraph,
     * and a synthetic stand-in carries no data — so neither is listed here; the real
     * edges a stand-in speaks for are counted directly.
     */
    private items(): LegendItem[] {
        const graph = this.uiManager.graph
        return this.scope === 'edge'
            ? graph.getMutableEdges().filter(edge => !edge.representedEdges?.length)
            : graph.getMutableNodes().filter(node => !node.isChild)
    }

    /** The header text: declared, else derived from wherever the entries came from. */
    public get title(): string {
        return this.config.title ?? this.titleFallback
    }

    public get isCollapsed(): boolean {
        return this.collapsed
    }

    /* ---------- rebuild ---------- */

    /**
     * Re-resolve the entries against the live graph and claim (or release) the filter
     * facet. Returns how many entries there are: a section with none renders nothing
     * at all rather than an empty box with a title, so the {@link Legend} skips it.
     */
    public resolve(): number {
        this.resolveFilterKey()
        this.entries = this.resolveEntries()

        // An entry that vanished from the data loses its toggle state rather than
        // lingering as a hidden ghost.
        const hadHidden = this.hiddenIds.size > 0
        for (const id of [...this.hiddenIds]) {
            if (!this.entries.some(entry => entry.id === id)) this.hiddenIds.delete(id)
        }

        if (this.entries.length === 0) {
            // Nothing left to list: this section must not leave nodes hidden behind it.
            if (hadHidden) this.removeOwnFilter(this.filterKey)
            this.hiddenIds.clear()
            this.releaseFacet()
            this.rows.clear()
            this.block = undefined
            this.listElement = undefined
            return 0
        }

        if (this.filterable) this.claimFacet()
        else this.releaseFacet()

        return this.entries.length
    }

    /**
     * Refresh the filter *value* so entries that just appeared are part of it. Only
     * when something is hidden: a section with nothing switched off must not clear a
     * filter another party (the panel, in adopted mode) owns.
     */
    public refreshFilter() {
        if (this.filterable && this.hiddenIds.size > 0) this.applyFilter(false)
    }

    /** Drop everything this section holds — its facet, and any filter it was driving. */
    public dispose() {
        this.endHover()
        if (this.hiddenIds.size > 0) this.removeOwnFilter(this.filterKey)
        this.releaseFacet()
        this.hiddenIds.clear()
        this.entries = []
        this.rows.clear()
        this.block?.remove()
        this.block = undefined
        this.listElement = undefined
    }

    /* ---------- entry resolution ---------- */

    private resolveEntries(): ResolvedLegendEntry[] {
        const declared = this.declaredEntries()
        if (declared?.length) {
            this.titleFallback = 'Legend'
            return this.fromDeclared(declared, this.items())
        }

        const key = this.config.key
        if (key !== undefined) {
            this.titleFallback = FormFactory.niceLabelFromKey(key)
            return this.derive(item => readItemData(item, key), key, this.items()).entries
        }

        this.titleFallback = AUTO_TITLE
        return this.deriveAutomatically()
    }

    /**
     * The section with neither `key` nor `entries`. It keys on
     * `render.nodeTypeAccessor` — the dimension the consumer already declared for
     * `nodeStyleMap`, so it is never a guess about their data.
     *
     * For the legend nobody asked for it then checks that this dimension really *is*
     * the colour dimension (see {@link explainsColors}): a legend that can't be shown
     * truthfully isn't shown at all, and says nothing about it. Inside a declared
     * group — or under `UI.legend: true` — the section was asked for, so the vetting
     * is skipped.
     */
    private deriveAutomatically(): ResolvedLegendEntry[] {
        const options = this.uiManager.graph.renderer?.getOptions()
        const edgeScope = this.scope === 'edge'
        const accessorName = edgeScope ? 'edgeTypeAccessor' : 'nodeTypeAccessor'
        const accessor = edgeScope ? options?.edgeTypeAccessor : options?.nodeTypeAccessor
        if (typeof accessor !== 'function') {
            if (this.forced) {
                this.warnOnce('auto-no-accessor',
                    `Pivotick: this legend has nothing to list — declare \`render.${accessorName}\`, or give the section a \`key\` / \`entries\`.`)
            }
            return []
        }

        const items = this.items()
        if (!this.forced && items.length > AUTO_MAX_NODES) {
            this.warnOnce('auto-too-many-nodes',
                `Pivotick: not deriving a legend for ${items.length} elements (over ${AUTO_MAX_NODES}); declare 'UI.legend' to have one anyway.`)
            return []
        }

        // Quiet: the blank-value and multi-colour warnings are for a legend the
        // consumer configured, not for one the library is merely considering.
        const read = accessor as (item: LegendItem) => string | undefined
        const derived = this.derive(item => read(item), accessorName, items, !this.forced)
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

    private declaredEntries(): LegendEntry[] | undefined {
        const { entries } = this.config
        if (typeof entries !== 'function') return entries
        try {
            return entries(this.uiManager.graph)
        } catch (error) {
            this.warnOnce('entries-threw', 'Pivotick: the legend\'s entries function threw; the section is empty.', error)
            return []
        }
    }

    /** Declared entries: `key` (when given) supplies the predicate they don't carry. */
    private fromDeclared(declared: LegendEntry[], items: LegendItem[]): ResolvedLegendEntry[] {
        const withOrder = declared.map((entry, index) => ({ entry, order: entry.order ?? index }))
        withOrder.sort((a, b) => a.order - b.order)

        return withOrder.map(({ entry }) => {
            const key = this.config.key
            const declaredPredicate = entry.predicate as ((item: LegendItem) => boolean) | undefined
            const predicate = declaredPredicate
                ?? (key !== undefined
                    ? (item: LegendItem) => this.matchesValue(readItemData(item, key), entry.id)
                    : undefined)
            if (!predicate) {
                this.warnOnce(`no-predicate-${entry.id}`,
                    `Pivotick: legend entry '${entry.id}' has no predicate and its section declares no 'key', so it matches nothing.`)
            }
            const safePredicate = this.guard(entry.id, predicate ?? (() => false))
            return {
                id: entry.id,
                // An id is a data *value*, so it is shown as it is — like the filter
                // panel's own option labels. Only keys get prettified.
                label: entry.label ?? entry.id,
                color: entry.color,
                predicate: safePredicate,
                count: items.reduce((total, item) => total + (safePredicate(item) ? 1 : 0), 0),
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
     * `label` names the dimension in warnings; `quiet` suppresses them for a section
     * that is only being *considered* (see {@link deriveAutomatically}).
     */
    private derive(
        read: (item: LegendItem) => unknown,
        label: string,
        items: LegendItem[],
        quiet = false
    ): DerivedEntries {
        const safeRead = this.guardRead(label, read)
        const found = new Map<string, { color: string, count: number, sample?: Edge }>()
        let blanks = 0
        let conflicted = false

        for (const item of items) {
            const raw = safeRead(item)
            const values = Array.isArray(raw) ? raw : [raw]
            let represented = false

            for (const value of values) {
                if (value === null || value === undefined || value === '') continue
                represented = true
                const id = String(value)
                const color = this.sampleColor(item)
                const existing = found.get(id)
                if (!existing) {
                    // The first element carrying a value is the one an edge swatch
                    // resolves its dash and marker from, not just its colour.
                    found.set(id, { color, count: 1, sample: this.scope === 'edge' ? item as Edge : undefined })
                    continue
                }
                existing.count++
                if (color !== existing.color) {
                    conflicted = true
                    if (!quiet) {
                        // Expected of a section keyed on a dimension the *colours* don't
                        // encode (provenance next to node kind), so the message names the fix.
                        this.warnOnce(`multi-color-${id}`,
                            `Pivotick: legend category '${id}' (${label}) renders more than one colour; the legend shows the first (${existing.color}). Declare 'entries' to give this section swatches of its own.`)
                    }
                }
            }
            if (!represented) blanks++
        }

        if (blanks > 0 && !quiet) {
            const noun = this.scope === 'edge' ? 'edge' : 'node'
            this.warnOnce(`blank-${label}`,
                `Pivotick: ${blanks} ${noun}(s) have no '${label}', so they have no legend entry and the legend cannot hide them.`)
        }

        const entries = [...found].map(([id, { color, count, sample }]) => ({
            id,
            label: id,
            color,
            predicate: (item: LegendItem) => this.matchesValue(safeRead(item), id),
            count,
            sample,
        }))
        return { entries, conflicted }
    }

    /**
     * The colour the renderer actually paints this element with, as a CSS colour — a
     * node's fill, or an edge's stroke.
     */
    private sampleColor(item: LegendItem): string {
        const renderer = this.uiManager.graph.renderer
        const color = this.scope === 'edge'
            ? renderer?.getEdgeStyle(item as Edge)?.strokeColor
            : renderer?.getNodeStyle(item as Node)?.color
        if (typeof color === 'string') return color

        const fallback = this.scope === 'edge'
            ? 'var(--pvt-edge-stroke, #999)'
            : 'var(--pvt-node-color, #007acc)'
        this.warnOnce('unresolved-color',
            'Pivotick: the renderer returned an unresolved colour; legend swatches fall back to the theme colour.')
        return fallback
    }

    /** Derived matching: a scalar equals the id, an array contains it (stringified). */
    private matchesValue(raw: unknown, id: string): boolean {
        if (Array.isArray(raw)) return raw.some(value => String(value) === id)
        return raw !== null && raw !== undefined && String(raw) === id
    }

    /** Read a dimension without letting a consumer accessor's throw take the render down. */
    private guardRead(label: string, read: (item: LegendItem) => unknown): (item: LegendItem) => unknown {
        return (item: LegendItem) => {
            try {
                return read(item)
            } catch (error) {
                this.warnOnce(`read-threw-${label}`,
                    `Pivotick: reading '${label}' for the legend threw; it lists nothing.`, error)
                return undefined
            }
        }
    }

    /** Run a consumer predicate without letting a throw take the render down. */
    private guard(id: string, predicate: (item: LegendItem) => boolean): (item: LegendItem) => boolean {
        return (item: LegendItem) => {
            try {
                return predicate(item)
            } catch (error) {
                this.warnOnce(`predicate-threw-${id}`,
                    `Pivotick: legend entry '${id}' predicate threw; it will match nothing.`, error)
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
     * Decide which filter key this section drives. When its `key` names a declared
     * `select` / `multiselect` facet, that facet is adopted so the section and the
     * filter panel are two views of one filter; otherwise the section owns a
     * reserved predicate facet of its own.
     */
    private resolveFilterKey() {
        const previousKey = this.filterKey
        const key = this.config.key
        const engine = this.uiManager.graph.queryEngine
        const declared: FilterFacet | EdgeFacet | undefined = key === undefined
            ? undefined
            : this.scope === 'edge'
                ? engine.getEdgeFacets().find(facet => facet.key === key)
                : engine.getFacets().find(facet => facet.key === key)
        // An edge facet's type is optional and defaults to the multiselect a layer is.
        const declaredType = declared === undefined
            ? undefined
            : declared.type ?? (this.scope === 'edge' ? 'multiselect' : undefined)

        if (declared && (declaredType === 'select' || declaredType === 'multiselect')) {
            this.adoptedFacet = declared
            this.filterKey = declared.key
        } else {
            if (declared) {
                this.warnOnce(`adopt-${declared.key}`,
                    `Pivotick: the legend's key '${declared.key}' is a declared '${declaredType}' facet, which can't hold a list of values; the legend filters on its own instead.`)
            }
            this.adoptedFacet = undefined
            this.filterKey = this.reservedKey
        }

        // Switching keys (a setLegend with a different key) must not leave the old
        // filter behind.
        if (previousKey !== this.filterKey) {
            this.releaseFacet(previousKey)
            this.removeOwnFilter(previousKey)
        }
    }

    /** Drop the filter under a bare key, on whichever side of the engine it lives. */
    private removeOwnFilter(key: string) {
        const engine = this.uiManager.graph.queryEngine
        if (this.scope === 'edge') engine.removeEdgeFilter(key)
        else engine.removeFilter(key)
    }

    /**
     * Register the reserved facet. Its predicate is *negative*: a node is hidden
     * when it matches a hidden entry, so a node no entry covers (a blank value) is
     * never hidden by the legend.
     */
    private claimFacet() {
        if (this.adoptedFacet || this.facetRegistered) return
        const engine = this.uiManager.graph.queryEngine
        const predicate = (item: LegendItem, value: FilterValue) => {
            const visible = new Set(this.toIdArray(value))
            return !this.entries.some(entry => !visible.has(entry.id) && entry.predicate(item))
        }
        const facet = {
            key: this.reservedKey,
            label: this.title,
            type: 'multiselect' as const,
            matchMode: 'exact' as const,
        }

        if (this.scope === 'edge') {
            engine.registerEdgeFacet({ ...facet, predicate: (edge, value) => predicate(edge, value) })
        } else {
            engine.registerFacet({ ...facet, predicate: (node, value) => predicate(node, value) })
        }
        this.facetRegistered = true
    }

    private releaseFacet(key: string = this.filterKey) {
        if (!this.facetRegistered || key !== this.reservedKey) return
        const engine = this.uiManager.graph.queryEngine
        if (this.scope === 'edge') engine.unregisterEdgeFacet(this.reservedKey)
        else engine.unregisterFacet(this.reservedKey)
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
            const config = { value: visible, matchMode: this.adoptedFacet?.matchMode ?? 'exact' as const }
            if (this.hiddenIds.size === 0) this.removeOwnFilter(this.filterKey)
            else if (this.scope === 'edge') engine.setEdgeFilter(this.filterKey, config)
            else engine.setFilter(this.filterKey, config)
        } finally {
            this.applyingFilter = false
        }

        this.applyEntryStates()
        // Filtering redrew the canvas under the pointer: the elements of a category
        // just switched off are gone, and those of one switched back on are new.
        this.refreshHover()
        if (emitEvent) {
            this.uiManager.graph.legendToggled({
                section: this.id,
                hidden: [...this.hiddenIds],
                visible,
            })
        }
    }

    /**
     * Re-derive which entries are lit from the live filters, so the section follows
     * `resetFilters()`, the filter panel, and programmatic `setFilter` calls.
     *
     * An **absent** filter means every entry is lit. An **empty list** means the
     * same in adopted mode (an empty multiselect is how the panel says "no
     * constraint"), but means "everything hidden" for a section's own key.
     */
    public syncFromFilters(filters: GraphFilters) {
        if (this.applyingFilter || !this.filterable || this.entries.length === 0) return

        const config = filters[this.engineKey]
        if (config === undefined) {
            if (this.hiddenIds.size === 0) return
            this.hiddenIds.clear()
            this.applyEntryStates()
            return
        }

        const visible = this.toIdArray(config.value)
        // An empty list means "no constraint" only for a node multiselect, which is how
        // the filter panel's form spells *unset*. An edge layer control writes exactly
        // what stays on, so for an edge section it means every layer is off.
        if (visible.length === 0 && this.adoptedFacet && this.scope !== 'edge') {
            this.hiddenIds.clear()
        } else {
            // Values the section knows nothing about are left alone — they belong to
            // whoever set them, not to the legend.
            this.hiddenIds = new Set(this.entries.filter(entry => !visible.includes(entry.id)).map(entry => entry.id))
        }
        this.applyEntryStates()
    }

    /* ---------- interaction ---------- */

    /** A click on one of this section's header buttons. */
    public onAction(action: SectionAction) {
        if (action === 'show-all') this.showAll()
        else if (action === 'invert') this.invert()
        else if (action === 'collapse') this.setCollapsed(!this.collapsed)
    }

    /** A click on one of this section's entries; `solo` is the alt-click. */
    public onEntryClick(id: string, solo: boolean) {
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

    /**
     * The pointer is on one of this section's entries: read that category off the
     * canvas — its elements keep their look, everything else dims. Held until
     * {@link endHover}; moving between rows just replaces the set.
     */
    public onEntryHover(id: string) {
        if (!this.highlightsOnHover || this.hoveredId === id) return
        this.hoveredId = id
        this.emphasise(id)
    }

    /** The pointer left: the canvas reads normally again. No-op unless it was here. */
    public endHover() {
        if (this.hoveredId === undefined) return
        this.hoveredId = undefined
        this.uiManager.graph.clearEmphasis()
    }

    /**
     * Re-read the hovered category off entries that were re-derived under the pointer.
     * No-op unless this section holds the hover.
     */
    public refreshHover() {
        if (this.hoveredId !== undefined) this.emphasise(this.hoveredId)
    }

    /**
     * Hand the canvas the elements one entry stands for. An id that no longer resolves
     * — the entries were re-derived under the pointer — emphasises nothing, which is
     * how the emphasis is dropped rather than left pointing at the previous data.
     */
    private emphasise(id: string) {
        const entry = this.entries.find(candidate => candidate.id === id)
        this.uiManager.graph.emphasiseElements(entry ? this.items().filter(entry.predicate) : [])
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
     * disabled) — a section's own key has no such limit.
     */
    private wouldEmptyAdopted(nextVisibleCount: number): boolean {
        // Edge scope has no such limit: the engine reads an empty edge pick as "every
        // layer off", which is exactly what the toggle means.
        if (this.scope === 'edge') return false
        return this.adoptedFacet !== undefined && nextVisibleCount <= 0
    }

    public setCollapsed(collapsed: boolean) {
        if (this.collapsed === collapsed) return
        this.collapsed = collapsed
        this.applyCollapsed()
    }

    private applyCollapsed() {
        this.block?.classList.toggle('pvt-legend-collapsed', this.collapsed)
        const button = this.block?.querySelector('.pvt-legend-collapse')
        button?.setAttribute('aria-expanded', String(!this.collapsed))
        button?.setAttribute('title', this.collapseTitle())
    }

    /* ---------- rendering ---------- */

    /** Build this section's block. Only called when {@link resolve} found entries. */
    public render(): HTMLElement {
        this.rows.clear()
        const block = createHtmlElement('div', {
            class: 'pvt-legend-section',
            'data-section': this.id,
        })
        block.classList.toggle('pvt-legend-static', !this.filterable)
        block.classList.toggle('pvt-legend-highlights', this.highlightsOnHover)
        this.block = block

        block.appendChild(this.renderHeader())

        const max = this.config.maxVisibleEntries ?? DEFAULT_MAX_VISIBLE_ENTRIES
        this.listElement = createHtmlElement('div', {
            class: 'pvt-legend-list',
            // Cap the height in rows, then scroll — the canvas must never grow because
            // a category list got long. The half row of slack lets the next entry's
            // swatch peek through, which is what says "there is more below" without
            // slicing a label in half. Half, not a quarter: a row's first 6.5px are
            // the swatch's own leading space, so less than that shows nothing at all.
            style: `max-height: calc(${max + 0.5} * var(--pvt-legend-row-height))`,
        })
        for (const entry of this.entries) this.listElement.appendChild(this.renderEntry(entry))
        block.appendChild(this.listElement)

        this.applyCollapsed()
        this.applyEntryStates()
        return block
    }

    /** Told by the {@link Legend} whether alt-clicking the chevron folds every section. */
    public setCollapseAllOffered(offered: boolean) {
        this.collapseAllOffered = offered
    }

    private collapseTitle(): string {
        const base = this.collapsed ? 'Expand this section' : 'Collapse this section'
        return this.collapseAllOffered ? `${base} (alt-click for every section)` : base
    }

    private renderHeader(): HTMLElement {
        const title = this.title
        const children: HTMLElement[] = []

        if (this.filterable) {
            children.push(this.action('show-all', show, 'Show every category'))
            children.push(this.action('invert', selectionInverse, 'Invert which categories are shown'))
        }
        if (this.config.collapsible !== false) {
            const collapse = this.action('collapse', arrowDown, this.collapseTitle())
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

    /**
     * An entry's key: a dot for a node, a **line** for an edge — stroke colour, dash
     * and marker as the renderer resolved them. Both sit in the same fixed-width slot,
     * so a card stacking node and edge sections keeps its labels on one line.
     */
    private renderSwatch(entry: ResolvedLegendEntry): HTMLElement {
        if (this.scope === 'edge') {
            // A derived entry samples a real edge, so dash and marker come along; a
            // declared one brought only a colour, so it gets a plain rule in it.
            const style = entry.sample !== undefined
                ? this.uiManager.graph.renderer?.getEdgeStyle(entry.sample)
                : undefined
            return createEdgeSwatch(style ?? { strokeColor: entry.color }, 'pvt-legend-swatch-line')
        }

        const swatch = createHtmlElement('span', { class: 'pvt-legend-swatch' })
        // Via the CSSOM, not an interpolated style attribute: the colour comes from
        // consumer data, and this way the browser validates it (a bogus value is
        // dropped) instead of it landing in the attribute verbatim.
        swatch.style.setProperty('--pvt-legend-swatch-color', entry.color)
        return swatch
    }

    private renderEntry(entry: ResolvedLegendEntry): HTMLElement {
        const children: HTMLElement[] = [
            this.renderSwatch(entry),
            createHtmlElement('span', { class: 'pvt-legend-label' }, [entry.label]),
        ]
        if (this.config.showCounts !== false) {
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

        const invert = this.block?.querySelector('.pvt-legend-action[data-action="invert"]') as HTMLButtonElement | null
        if (invert) invert.disabled = this.wouldEmptyAdopted(this.hiddenIds.size)
        const showAll = this.block?.querySelector('.pvt-legend-action[data-action="show-all"]') as HTMLButtonElement | null
        if (showAll) showAll.disabled = this.hiddenIds.size === 0
    }
}

/**
 * A data key off either kind of element. `Node` and `Edge` both carry `getData()`, and
 * a section reads whichever collection its scope names.
 */
function readItemData(item: LegendItem, key: string): unknown {
    return (item.getData() as Record<string, unknown> | undefined)?.[key]
}
