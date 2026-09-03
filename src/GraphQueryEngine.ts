import { Node } from './Node'
import type { Edge } from './Edge'
import type { Graph } from './Graph'
import type {
    GraphQueryEvents, GraphFilters, FilterFieldConfig, FilterFacet, FilterValue, FilterMatchMode,
    EdgeFacet, EdgeFacetValue, FacetMatching,
} from './interfaces/GraphQueryEngine'


const MANUALLY_HIDDEN_FILTER_KEY = 'manually_hidden'
/**
 * How an edge filter's key is namespaced inside the one {@link GraphFilters} record,
 * so `resetFilters` and the filter pill cover both scopes and a node facet and an edge
 * facet may share a key name. An internal encoding: `setEdgeFilter` and friends add and
 * strip it, and it never reaches consumer code.
 */
export const EDGE_FILTER_PREFIX = 'edge:'
export class GraphQueryEngine {
    private graph: Graph
    private listeners: Record<keyof GraphQueryEvents, Array<GraphQueryEvents[keyof GraphQueryEvents]>>

    private filters: GraphFilters = {}
    private excludedNodeIds = new Set<string>()
    private hiddenNodeCount: number = 0
    /** Declared facets, by key — how to read and match a filter (see `UI.filter.facets`). */
    private facets = new Map<string, FilterFacet>()
    /**
     * Facets owned by the library's own UI (the canvas legend). Kept apart from the
     * declared ones so `setFacets` can't clobber them and they never show up in
     * `getFacets()` — which is the consumer's declaration, not ours.
     */
    private reservedFacets = new Map<string, FilterFacet>()
    /** Patterns compiled once per filter application, not once per node (`null` = unusable). */
    private regexCache = new Map<string, RegExp | null>()
    /** Facet keys whose accessor/predicate has thrown, so we warn once rather than per node. */
    private brokenFacets = new Set<string>()
    /** Declared edge facets, by bare key — the graph's relation *layers*. */
    private edgeFacets = new Map<string, EdgeFacet>()
    /** Edge facets owned by the library's own UI (an `edge`-scoped legend section). */
    private reservedEdgeFacets = new Map<string, EdgeFacet>()
    /** How many edges the active edge filters hide (layer reasons only). */
    private hiddenEdgeCount: number = 0
    /** Whether nodes left with no visible edge are hidden (`UI.filter.hideDisconnected`). */
    private hideDisconnected: boolean = false
    /** How many nodes that rule is hiding — what the View flyout's switch reports. */
    private disconnectedNodeCount: number = 0

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

    /**
     * Register a facet the library itself owns — the legend's, so its filter key
     * matches through a predicate instead of a raw data key. Additive: it survives
     * {@link setFacets} and stays out of {@link getFacets}.
     */
    registerFacet(facet: FilterFacet) {
        this.reservedFacets.set(facet.key, facet)
        if (this.filters[facet.key] !== undefined) this.apply()
    }

    /** Drop a reserved facet, and any filter that was relying on it to match. */
    unregisterFacet(key: string) {
        if (!this.reservedFacets.delete(key)) return
        this.removeFilter(key)
    }

    /** Declared facets plus the library's own — what filters are actually matched with. */
    private allFacets(): FilterFacet[] {
        return [...this.facets.values(), ...this.reservedFacets.values()]
    }

    private facetFor(key: string): FilterFacet | undefined {
        return this.facets.get(key) ?? this.reservedFacets.get(key)
    }

    /**
     * Declare the edge facets — the graph's relation layers (normally from
     * `UI.filter.edgeFacets`). Replaces any previous declaration, and re-applies when
     * an edge filter is already active.
     */
    setEdgeFacets(facets: EdgeFacet[] | undefined) {
        this.edgeFacets = new Map((facets ?? []).map((facet) => [facet.key, facet]))
        if (this.hasEdgeFilters()) this.apply()
    }

    getEdgeFacets(): EdgeFacet[] {
        return [...this.edgeFacets.values()]
    }

    /**
     * Register an edge facet the library itself owns — an `edge`-scoped legend
     * section's. Additive: it survives {@link setEdgeFacets} and stays out of
     * {@link getEdgeFacets}.
     */
    registerEdgeFacet(facet: EdgeFacet) {
        this.reservedEdgeFacets.set(facet.key, facet)
        if (this.filters[EDGE_FILTER_PREFIX + facet.key] !== undefined) this.apply()
    }

    /** Drop a reserved edge facet, and any filter that was relying on it to match. */
    unregisterEdgeFacet(key: string) {
        if (!this.reservedEdgeFacets.delete(key)) return
        this.removeEdgeFilter(key)
    }

    /** Declared edge facets plus the library's own — what edge filters are matched with. */
    private allEdgeFacets(): EdgeFacet[] {
        return [...this.edgeFacets.values(), ...this.reservedEdgeFacets.values()]
    }

    private edgeFacetFor(key: string): EdgeFacet | undefined {
        return this.edgeFacets.get(key) ?? this.reservedEdgeFacets.get(key)
    }

    private hasEdgeFilters(): boolean {
        return Object.keys(this.filters).some((key) => key.startsWith(EDGE_FILTER_PREFIX))
    }

    /** Set an edge filter. `key` is the facet's own — the namespacing is internal. */
    setEdgeFilter(key: string, value: FilterFieldConfig) {
        this.setFilter(EDGE_FILTER_PREFIX + key, value)
    }

    removeEdgeFilter(key: string) {
        this.removeFilter(EDGE_FILTER_PREFIX + key)
    }

    /** The active edge filters, keyed by the facet's own key. */
    getEdgeFilters(): GraphFilters {
        const edgeFilters: GraphFilters = {}
        for (const [key, config] of Object.entries(this.filters)) {
            if (!key.startsWith(EDGE_FILTER_PREFIX)) continue
            edgeFilters[key.slice(EDGE_FILTER_PREFIX.length)] = config
        }
        return edgeFilters
    }

    /** How many edges the active edge filters hide. Endpoint-hidden edges don't count. */
    getHiddenEdgeCount(): number {
        return this.hiddenEdgeCount
    }

    /**
     * The distinct values an edge facet reads across the graph's real edges, sorted —
     * what a `select` / `multiselect` edge facet is populated with when it declares no
     * options of its own. Synthetic stand-ins are skipped: they carry no data, and the
     * real edges they speak for are read directly.
     */
    getEdgeFacetValues(key: string): EdgeFacetValue[] {
        const facet = this.edgeFacetFor(key)
        const found = new Map<string, { count: number, sample: Edge }>()
        for (const edge of this.realEdges()) {
            const raw = this.readEdgeValue(edge, key, facet)
            for (const value of Array.isArray(raw) ? raw : [raw]) {
                if (value === null || value === undefined || value === '') continue
                const id = String(value)
                const existing = found.get(id)
                // The first edge carrying a value is its sample — what a swatch asks the
                // renderer to resolve a style from.
                if (existing) existing.count++
                else found.set(id, { count: 1, sample: edge })
            }
        }
        return [...found]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([value, { count, sample }]) => ({ value, count, sample }))
    }

    /** The graph's real edges — every synthetic stand-in excluded. */
    private realEdges(): Edge[] {
        return this.graph.getMutableEdges().filter((edge) => !edge.representedEdges?.length)
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

    /**
     * Replace the filters `ownedKeys` hold with `filters`, leaving every other key
     * untouched. What the filter panel applies with: a key the panel's form does not
     * own — a legend section's, a live edge layer's — must survive pressing its button.
     */
    replaceFilters(ownedKeys: string[], filters: GraphFilters) {
        for (const key of ownedKeys) delete this.filters[key]
        for (const [key, value] of Object.entries(filters)) {
            if (value === undefined) continue
            this.filters[key] = value
        }
        this.apply()
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

        // Only a hide that changed the set is an act. The hide that *survives* is the
        // one worth recording at all: `graph.hideNode()` is wiped by the next
        // re-derive, so an entry for it would reverse something already reverted.
        if (!this.excludedNodeIds.has(node.id)) {
            this.excludedNodeIds.add(node.id)
            this.graph.history.recordVisibility(node.id, true)
        }
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

        if (this.excludedNodeIds.delete(node.id)) this.graph.history.recordVisibility(node.id, false)
        this.apply()

        this.emit('filterRemove', MANUALLY_HIDDEN_FILTER_KEY)
        this.emit('filterChange', this.getFilters())
    }

    clearNodeExclusions() {
        this.excludedNodeIds.clear()
        this.apply()
        this.emit('filterRemove', MANUALLY_HIDDEN_FILTER_KEY)
        this.emit('filterChange', this.getFilters())
    }

    getExcludedNodeCount(): number {
        return this.excludedNodeIds.size
    }

    /** The ids of the durably hidden nodes, whether or not they are still in the graph. */
    getExcludedNodeIds(): string[] {
        return [...this.excludedNodeIds]
    }

    getExcludedNodes(): Node[] {
        return [...this.excludedNodeIds]
            .map((id) => this.graph.getMutableNode(id))
            .filter((node: undefined | Node) => {
                return node !== undefined
            })
    }

    /** How many of *this* graph's nodes the active filters hide (children excluded). */
    getHiddenNodeCount() {
        return this.hiddenNodeCount
    }

    /**
     * Hide, or stop hiding, the nodes left with no visible edge. Unlike a layer toggle
     * this moves the graph: a hidden node leaves the simulation, so the rest re-settle.
     */
    setHideDisconnected(hide: boolean) {
        if (this.hideDisconnected === hide) return
        this.hideDisconnected = hide

        // Set from `UI.filter.hideDisconnected` before any data exists; the constructor's
        // own {@link applyInitialVisibility} is what puts it into effect.
        if (this.graph.getMutableNodes().length === 0) return

        this.apply()
        this.emit('filterChange', this.getFilters())
    }

    isHideDisconnected(): boolean {
        return this.hideDisconnected
    }

    /** How many nodes are hidden for having no visible edge. `0` when the rule is off. */
    getDisconnectedNodeCount(): number {
        return this.disconnectedNodeCount
    }

    /**
     * Re-derive visibility from the current filters. Filters are otherwise applied only
     * when one changes, so a graph whose nodes or edges moved underneath it can be stale
     * — adding an edge doesn't bring back the node that was hidden for lacking one.
     *
     * Re-deriving also **undoes a manual `graph.hideNode()`**, which nothing remembers;
     * {@link excludeNode} is the hide that survives.
     */
    reapply() {
        this.apply()
        this.emit('filterChange', this.getFilters())
    }

    /**
     * The first pass, run by `Graph`'s constructor before the layout and the first paint:
     * with {@link setHideDisconnected} on, a node with no relation must never reach the
     * canvas, nor be in the graph the opening fit frames. Quiet, and a no-op otherwise.
     * @private
     */
    applyInitialVisibility() {
        if (!this.hideDisconnected) return
        this.apply(false)
    }

    private apply(notify = true) {
        this.regexCache.clear() // patterns are compiled once per application, below
        // A cluster's children are filtered in their own subgraph, so they can be
        // neither shown nor hidden here — match and count this graph's nodes only.
        const nodesInCurrentGraph = this.graph.getMutableNodes()
            .filter(node => node.childrenDepth === 0)

        const visibleNodesInCurrentGraph = nodesInCurrentGraph
            .filter(node => this.nodeMatchesFilters(node)) // nodes that match the filter

        this.hiddenNodeCount = nodesInCurrentGraph.length - visibleNodesInCurrentGraph.length
        this.applyFiltersOnSubgraph()

        // Layers first, so setVisibleNodes' recompute lands on the final flag; it fires
        // the graph's change hook itself when node visibility moved, which is why the
        // edge-only case has to ask for a repaint of its own.
        const layersChanged = this.applyEdgeLayers()
        // Then the disconnected rule, which needs those final layer flags — and has to
        // run before the commit, since that is what makes an endpoint reason true.
        const visibleNodes = this.dropDisconnectedNodes(visibleNodesInCurrentGraph)
        const nodesChanged = this.graph.setVisibleNodes(visibleNodes, notify)
        if (notify && layersChanged && !nodesChanged) this.graph.edgeVisibilityChanged()
    }

    /**
     * Drop the nodes {@link setHideDisconnected} hides: the ones with no visible edge
     * left. Asked of the *candidate* set rather than of `edge.visible`, because the
     * endpoint reason is only committed afterwards, by `setVisibleNodes`.
     *
     * One pass is already the fixed point: a node with no visible edge hides no visible
     * edge when it goes, so removing it can strand nobody.
     */
    private dropDisconnectedNodes(candidates: Node[]): Node[] {
        if (!this.hideDisconnected) {
            this.disconnectedNodeCount = 0
            return candidates
        }

        const candidateIds = new Set(candidates.map((node) => node.id))
        // The node the canvas actually shows for an endpoint: a relation into an open
        // cluster's child is drawn, and it keeps the *cluster* on screen — the child is
        // not one of this graph's nodes.
        const onCanvas = (node: Node): Node => {
            let current = node
            while (current.childrenDepth > 0 && current.parentNode) current = current.parentNode
            return current
        }

        const connected = new Set<string>()
        for (const edge of this.graph.getMutableEdges()) {
            // A cross-cluster stand-in's visibility is the cluster drawer's answer, not
            // one we can predict — read it, and still ask that both ends survived the
            // node filters. `edge.visible` already folds in its layer.
            const drawn = edge.isCrossCluster
                ? edge.visible && candidateIds.has(edge.from.id) && candidateIds.has(edge.to.id)
                : edge.layerVisible && this.graph.edgeWouldBeVisible(edge, candidateIds)
            if (!drawn) continue

            connected.add(onCanvas(edge.from).id)
            connected.add(onCanvas(edge.to).id)
        }

        const kept = candidates.filter((node) => connected.has(node.id))
        this.disconnectedNodeCount = candidates.length - kept.length
        return kept
    }

    /**
     * Push the active edge filters onto every edge's layer flag. Returns whether any
     * edge moved, so the caller can repaint without disturbing the simulation — a
     * layer is a lens, and hiding one must not change the layout.
     */
    private applyEdgeLayers(): boolean {
        const filtering = this.hasEdgeFilters()
        let changed = false
        let hidden = 0

        for (const edge of this.graph.getMutableEdges()) {
            const layerOn = !filtering || this.edgeMatchesFilters(edge)
            if (edge.setLayerVisible(layerOn)) changed = true
            if (!layerOn) hidden++
        }

        this.hiddenEdgeCount = hidden
        return changed
    }

    /**
     * Does this edge survive the active edge filters? A synthetic stand-in carries no
     * data of its own — it speaks for real edges, and survives while any of them does.
     */
    private edgeMatchesFilters(edge: Edge): boolean {
        const represented = edge.representedEdges
        if (represented?.length) return represented.some((real) => this.edgeMatchesFilters(real))

        for (const [key, value] of Object.entries(this.filters)) {
            if (!key.startsWith(EDGE_FILTER_PREFIX)) continue

            // An empty pick hides the layer outright. A node multiselect reads an empty
            // list as "no constraint" — that is how the panel's form says *unset* — but a
            // layer control writes exactly what stays on, so nothing has to mean nothing.
            if (Array.isArray(value.value) && value.value.length === 0) return false

            const bareKey = key.slice(EDGE_FILTER_PREFIX.length)
            const facet = this.edgeFacetFor(bareKey)
            if (facet?.predicate) {
                if (!this.runFacetFn(key, () => facet.predicate!(edge, value.value))) return false
                continue
            }

            const edgeValue = this.readEdgeValue(edge, bareKey, facet)
            const matching: FacetMatching = {
                key: bareKey,
                // A layer is a multiselect unless the facet says otherwise — the same
                // default the panel builds its control from.
                type: facet?.type ?? 'multiselect',
                matchMode: facet?.matchMode,
            }
            if (!this.matches(edgeValue, value, matching)) return false
        }
        return true
    }

    /** Read an edge facet's dimension off an edge: its `accessor`, else the data key. */
    private readEdgeValue(edge: Edge, key: string, facet?: EdgeFacet): unknown {
        if (facet?.accessor) {
            return this.runFacetFn(EDGE_FILTER_PREFIX + key, () => facet.accessor!(edge))
        }
        return (edge.getData() as Record<string, unknown> | undefined)?.[key]
    }

    public applyFiltersOnSubgraph() {
        const mainFilters = this.getFilters()
        // The legend's reserved facet goes down with the declared ones: its filter key
        // travels in `mainFilters`, and without the facet the subgraph would match it
        // against a data key that doesn't exist and hide every child node.
        const facets = this.allFacets()
        // Edge facets travel the same way: a subgraph's edges are its own, and without
        // the declaration an `edge:` filter key would match against a data key that
        // doesn't exist and blank every relation inside an expanded cluster.
        const edgeFacets = this.allEdgeFacets()

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
                    subgraph.queryEngine.setEdgeFacets(edgeFacets)
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
            // Edge layers select edges, never nodes: a node with no visible edge left
            // stays on the canvas (hiding it is a node filter's decision).
            if (key.startsWith(EDGE_FILTER_PREFIX)) continue

            const facet = this.facetFor(key)
            if (facet?.predicate) {
                if (!this.runFacetFn(key, () => facet.predicate!(node, value.value))) return false
                continue
            }

            const nodeValue = facet?.accessor
                ? this.runFacetFn(key, () => facet.accessor!(node))
                : node.getData()[key]
            if (!this.matches(nodeValue, value, facet)) return false
        }
        return true
    }

    /**
     * Run a consumer-supplied accessor/predicate without letting a throw take the
     * whole render down: the facet stops matching and we warn once for that key.
     * Keyed by the *filter* key, so a node and an edge facet of the same name are
     * reported apart.
     */
    private runFacetFn<T>(key: string, fn: () => T): T | undefined {
        try {
            return fn()
        } catch (error) {
            if (!this.brokenFacets.has(key)) {
                this.brokenFacets.add(key)
                console.warn(`Pivotick: filter facet '${key}' threw; it will not match anything.`, error)
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

    private matches(nodeValue: unknown, filterConfig: FilterFieldConfig, facet?: FacetMatching): boolean {
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
