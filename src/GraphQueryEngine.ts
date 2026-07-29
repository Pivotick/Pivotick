import { Node } from './Node'
import type { Graph } from './Graph'
import type {
    GraphQueryEvents, GraphFilters, FilterFieldConfig, FilterFacet, FilterValue, FilterMatchMode,
} from './interfaces/GraphQueryEngine'


const MANUALLY_HIDDEN_FILTER_KEY = 'manually_hidden'
export class GraphQueryEngine {
    private graph: Graph
    private listeners: Record<keyof GraphQueryEvents, Array<GraphQueryEvents[keyof GraphQueryEvents]>>

    private filters: GraphFilters = {}
    private excludedNodeIds = new Set<string>()
    private hiddenNodeCount: number = 0
    /** Declared facets, by key — how to read and match a filter (see `UI.filter.facets`). */
    private facets = new Map<string, FilterFacet>()
    /** Patterns compiled once per filter application, not once per node (`null` = unusable). */
    private regexCache = new Map<string, RegExp | null>()
    /** Facet keys whose accessor/predicate has thrown, so we warn once rather than per node. */
    private brokenFacets = new Set<string>()

    constructor(graph: Graph) {
        this.graph = graph
        this.listeners = {
            filterAdd: [], filterRemove: [], filterReset: [], filterChange: [],
        }
    }

    public on<K extends keyof GraphQueryEvents>(
            event: K,
        handler: GraphQueryEvents[K]
    ): void {
        this.listeners[event].push(handler)
    }
    
    public off<K extends keyof GraphQueryEvents>(
            event: K,
        handler: GraphQueryEvents[K]
    ): void {
        this.listeners[event] = this.listeners[event].filter(h => h !== handler)
    }
    
    private emit<K extends keyof GraphQueryEvents>(
            event: K,
        ...args: Parameters<GraphQueryEvents[K]>
    ): void {
        for (const handler of this.listeners[event]) {
            (handler as (...args: Parameters<GraphQueryEvents[K]>) => void)(...args)
        }
    }

    /**
     * Declare the facets filters are matched with (normally from `UI.filter.facets`).
     * Replaces any previous declaration, and re-applies when filters are already active.
     */
    setFacets(facets: FilterFacet[] | undefined) {
        this.facets = new Map((facets ?? []).map((facet) => [facet.key, facet]))
        this.brokenFacets.clear()
        if (Object.keys(this.filters).length > 0) this.apply()
    }

    getFacets(): FilterFacet[] {
        return [...this.facets.values()]
    }

    getFilters(): GraphFilters {
        const manuallyHidenFilter: FilterFieldConfig = {
            value: [...this.excludedNodeIds],
            matchMode: 'exact'
        }
        return { ...this.filters, manuallyHidden: manuallyHidenFilter }
    }

    setFilters(filters: GraphFilters) {
        for (const [key, value] of Object.entries(filters)) {
            if (value === undefined) {
                this.removeFilter(key)
                return
            }

            this.filters[key] = value
        }
        this.apply()
        this.emit('filterChange', this.getFilters())
    }

    setFilter(key: string, value: FilterFieldConfig) {
        if (value === undefined) {
            this.removeFilter(key)
            return
        }

        this.filters[key] = value
        this.apply()

        this.emit('filterAdd', key, value)
        this.emit('filterChange', this.getFilters())
    }

    removeFilter(key: string) {
        if (!(key in this.filters)) return

        delete this.filters[key]
        this.apply()

        this.emit('filterRemove', key)
        this.emit('filterChange', this.getFilters())
    }

    resetFilters() {
        this.filters = {}
        this.apply()

        this.emit('filterReset')
        this.emit('filterChange', this.getFilters())

    }

    excludeNode(nodeOrId: string | Node) {
        // getMutableNode (not getNode, which returns a clone) so apply() hides the real node
        const node = this.graph.getMutableNode(nodeOrId)
        if (node === undefined) return

        this.excludedNodeIds.add(node.id)
        const manuallyHidenFilter: FilterFieldConfig = {
            value: node.id,
            matchMode: 'exact'
        }
        this.apply()

        this.emit('filterAdd', MANUALLY_HIDDEN_FILTER_KEY, manuallyHidenFilter)
        this.emit('filterChange', this.getFilters())
    }

    includeNode(nodeOrId: string | Node) {
        const node = this.graph.getMutableNode(nodeOrId)
        if (node === undefined) return

        this.excludedNodeIds.delete(node.id)
        this.apply()

        this.emit('filterRemove', MANUALLY_HIDDEN_FILTER_KEY)
        this.emit('filterChange', this.getFilters())
    }

    clearNodeExclusions() {
        this.hiddenNodeCount += this.excludedNodeIds.size
        this.excludedNodeIds.clear()
        this.apply()
        this.emit('filterRemove', MANUALLY_HIDDEN_FILTER_KEY)
        this.emit('filterChange', this.getFilters())
    }

    getExcludedNodeCount(): number {
        return this.excludedNodeIds.size
    }

    getExcludedNodes(): Node[] {
        return [...this.excludedNodeIds]
            .map((id) => this.graph.getMutableNode(id))
            .filter((node: undefined | Node) => {
                return node !== undefined
            })
    }

    getHiddenNodeCount() {
        return this.hiddenNodeCount
    }

    private apply() {
        this.regexCache.clear() // patterns are compiled once per application, below
        const nodes = this.graph.getMutableNodes()
        const visibleNodes = nodes
            .filter(node => this.nodeMatchesFilters(node)) // nodes that match the filter

        const visibleNodesInCurrentGraph = visibleNodes
            .filter(node => node.childrenDepth === 0) // children filtering is done in their own graph

        this.hiddenNodeCount = nodes.length - visibleNodesInCurrentGraph.length
        this.applyFiltersOnSubgraph()

        this.graph.setVisibleNodes(visibleNodesInCurrentGraph)
    }

    public applyFiltersOnSubgraph() {
        const mainFilters = this.getFilters()
        const facets = this.getFacets()

        this.graph.getMutableNodes()
            .filter(node => node.childrenDepth === 0)
            .forEach((node) => {
                const subgraph = node.getSubgraph()
                if (node.isParent && subgraph) {
                    subgraph.queryEngine.resetFilters()
                    // A subgraph is built with fresh UI options, so it never sees the
                    // consumer's `UI.filter.facets` — hand the declaration down here or
                    // accessor/predicate facets would silently fall back to data keys.
                    // (After the reset, so it doesn't apply on its way in.)
                    subgraph.queryEngine.setFacets(facets)
                    subgraph.queryEngine.setFilters(mainFilters)
                }
            })
    }

    private nodeMatchesFilters(node: Node): boolean {
        if (this.excludedNodeIds.has(node.id)) {
            return false
        }
        for (const [key, value] of Object.entries(this.filters)) {
            if (key === 'manuallyHidden') continue

            const facet = this.facets.get(key)
            if (facet?.predicate) {
                if (!this.runFacetFn(facet, () => facet.predicate!(node, value.value))) return false
                continue
            }

            const nodeValue = facet?.accessor
                ? this.runFacetFn(facet, () => facet.accessor!(node))
                : node.getData()[key]
            if (!this.matches(nodeValue, value, facet)) return false
        }
        return true
    }

    /**
     * Run a consumer-supplied accessor/predicate without letting a throw take the
     * whole render down: the facet stops matching and we warn once for that key.
     */
    private runFacetFn<T>(facet: FilterFacet, fn: () => T): T | undefined {
        try {
            return fn()
        } catch (error) {
            if (!this.brokenFacets.has(facet.key)) {
                this.brokenFacets.add(facet.key)
                console.warn(`Pivotick: filter facet '${facet.key}' threw; it will not match any node.`, error)
            }
            return undefined
        }
    }

    /** Compile a `regex` facet's pattern (case-insensitive), memoised for this application. */
    private compileRegex(pattern: string): RegExp | null {
        const cached = this.regexCache.get(pattern)
        if (cached !== undefined) return cached

        let compiled: RegExp | null = null
        try {
            compiled = new RegExp(pattern, 'i')
        } catch {
            // The panel validates before applying; a bad pattern can only arrive from
            // a programmatic setFilter, and must not throw out of apply().
            console.warn(`Pivotick: invalid filter pattern '${pattern}' ignored.`)
        }
        this.regexCache.set(pattern, compiled)
        return compiled
    }

    private matches(nodeValue: unknown, filterConfig: FilterFieldConfig, facet?: FilterFacet): boolean {
        if (filterConfig === undefined) return true
        if (nodeValue === undefined || nodeValue === null) return false

        const filterValue = filterConfig.value
        const matchMode = filterConfig?.matchMode ?? facet?.matchMode ?? 'exact'

        // A regex facet tests its pattern against the node value — or against any
        // element, when the node value is an array.
        if (facet?.type === 'regex' && typeof filterValue === 'string') {
            const pattern = this.compileRegex(filterValue)
            if (!pattern) return true // unusable pattern: don't hide the graph behind it
            return Array.isArray(nodeValue)
                ? nodeValue.some((element) => pattern.test(String(element)))
                : pattern.test(String(nodeValue))
        }

        // Array node value (tags, categories, …) ⇒ set membership rather than equality.
        if (Array.isArray(nodeValue)) {
            return this.matchesArrayNodeValue(nodeValue, filterValue, matchMode)
        }

        if (typeof filterValue === 'string') {
            return matchMode === 'partial' ? String(nodeValue).includes(filterValue) : nodeValue === filterValue
        }

        if (typeof filterValue === 'number') {
            return nodeValue === filterValue
        }

        if (typeof filterValue === 'boolean') {
            return nodeValue === filterValue
        }

        if (Array.isArray(filterValue)) {
            if (filterValue.length === 0) return true
            // A multiselect matches when the node's value is one of the picks; 'all'
            // can only hold for a scalar when every pick *is* that value.
            return matchMode === 'all'
                ? filterValue.every((value) => value === nodeValue)
                : filterValue.includes(nodeValue as never)
        }

        if (typeof filterValue === 'object' && filterValue !== null) {
            const { min, max } = filterValue
            if (typeof nodeValue !== 'number') return false
            if (min !== undefined && nodeValue < min) return false
            if (max !== undefined && nodeValue > max) return false
            return true
        }

        return false
    }

    /**
     * Match an **array** node value: `'all'` requires every selected value to be
     * present, anything else is any-of. `'partial'` compares elements by substring.
     */
    private matchesArrayNodeValue(nodeValue: unknown[], filterValue: FilterValue, matchMode: FilterMatchMode): boolean {
        if (filterValue === undefined) return true

        const contains = (value: unknown): boolean => matchMode === 'partial'
            ? nodeValue.some((element) => String(element).includes(String(value)))
            : nodeValue.some((element) => element === value)

        if (Array.isArray(filterValue)) {
            if (filterValue.length === 0) return true
            return matchMode === 'all' ? filterValue.every(contains) : filterValue.some(contains)
        }

        // A range filter matches when any element falls inside it.
        if (typeof filterValue === 'object' && filterValue !== null) {
            const { min, max } = filterValue
            return nodeValue.some((element) => typeof element === 'number'
                && (min === undefined || element >= min)
                && (max === undefined || element <= max))
        }

        return contains(filterValue)
    }
}
