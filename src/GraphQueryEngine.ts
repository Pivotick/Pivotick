import { Node } from './Node'
import type { Graph } from './Graph'
import type { GraphQueryEvents, GraphFilters, FilterFieldConfig } from './interfaces/GraphQueryEngine'


const MANUALLY_HIDDEN_FILTER_KEY = 'manually_hidden'
export class GraphQueryEngine {
    private graph: Graph
    private listeners: Record<keyof GraphQueryEvents, Array<GraphQueryEvents[keyof GraphQueryEvents]>>

    private filters: GraphFilters = {}
    private excludedNodeIds = new Set<string>()
    private hiddenNodeCount: number = 0

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
        let node
        if (nodeOrId instanceof Node) {
            node = nodeOrId
        } else {
            node = this.graph.getNode(nodeOrId)
        }
        if (node === undefined) return

        this.excludedNodeIds.add(node.id)
        this.hiddenNodeCount++
        const manuallyHidenFilter: FilterFieldConfig = {
            value: node.id,
            matchMode: 'exact'
        }
        this.graph.hideNode(node)

        this.emit('filterAdd', MANUALLY_HIDDEN_FILTER_KEY, manuallyHidenFilter)
        this.emit('filterChange', this.getFilters())
    }

    includeNode(nodeOrId: string | Node) {
        let node
        if (nodeOrId instanceof Node) {
            node = nodeOrId
        } else {
            node = this.graph.getNode(nodeOrId)
        }
        if (node === undefined) return
        this.excludedNodeIds.delete(node.id)
        this.hiddenNodeCount--
        this.graph.showNode(node)

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
        const nodes = this.graph.getMutableNodes()
        const visibleNodes = nodes
            .filter(node => this.nodeMatchesFilters(node)) // nodes that match the filter

        const visibleNodesInCurrentGraph = visibleNodes
            .filter(node => node.childrenDepth === 0) // children filtering is done in their own graph

        this.hiddenNodeCount = nodes.length - visibleNodesInCurrentGraph.length
        this.graph.setVisibleNodes(visibleNodesInCurrentGraph)

        this.applyFiltersOnSubgraph()
    }

    public applyFiltersOnSubgraph() {
        const mainFilters = this.getFilters()
        this.graph.getMutableNodes()
            .filter(node => node.childrenDepth === this.graph.getGraphDepth())
            .forEach((node) => {
                const subgraph = node.getSubgraph()
                if (node.isParent && subgraph) {
                    subgraph.queryEngine.resetFilters()
                    subgraph.queryEngine.setFilters(mainFilters)
                    subgraph.queryEngine.applyFiltersOnSubgraph()
                }
            })
    }

    private nodeMatchesFilters(node: Node): boolean {
        if (this.excludedNodeIds.has(node.id)) {
            return false
        }
        for (const [key, value] of Object.entries(this.filters)) {
            if (key === 'manuallyHidden') continue

            const nodeValue = node.getData()[key]
            if (!this.matches(nodeValue, value)) return false
        }
        return true
    }

    private matches(nodeValue: unknown, filterConfig: FilterFieldConfig): boolean {
        if (filterConfig === undefined) return true
        if (nodeValue === undefined) return false

        const filterValue = filterConfig.value
        const matchMode = filterConfig?.matchMode ?? 'partial'

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
            return matchMode === 'partial' ? filterValue.includes(nodeValue as never) : nodeValue === filterValue
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
}
