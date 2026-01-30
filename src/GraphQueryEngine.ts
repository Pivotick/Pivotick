import type { Node } from './Node'
import type { Graph } from './Graph'
import type { GraphQueryEvents, GraphFilters, FilterValue } from './interfaces/GraphQueryEngine'


export class GraphQueryEngine {
    private graph: Graph
    private listeners: Record<keyof GraphQueryEvents, Array<GraphQueryEvents[keyof GraphQueryEvents]>>

    private filters: GraphFilters = {}

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
        return { ...this.filters }
    }

    setFilters(filters: GraphFilters) {
        for (const [key, value] of Object.entries(filters)) {
            this.setFilter(key, value)
        }
    }

    setFilter(key: string, value: FilterValue) {
        if (value === undefined) {
            this.removeFilter(key)
            return
        }

        this.filters[key] = value

        this.emit('filterAdd', key, value)
        this.emit('filterChange', this.getFilters())

        this.apply()
    }

    removeFilter(key: string) {
        if (!(key in this.filters)) return

        delete this.filters[key]

        this.emit('filterRemove', key)
        this.emit('filterChange', this.getFilters())

        this.apply()
    }

    resetFilters() {
        this.filters = {}

        this.emit('filterReset')
        this.emit('filterChange', {})

        this.apply()
    }

    private apply() {
        const nodes = this.graph.getMutableNodes()
        const visibleNodes = nodes.filter(node => this.nodeMatchesFilters(node))
        this.graph.setVisibleNodes(visibleNodes)
    }

    private nodeMatchesFilters(node: Node): boolean {
        for (const [key, value] of Object.entries(this.filters)) {
            const nodeValue = node.getData()[key]
            if (!this.matches(nodeValue, value)) return false
        }
        return true
    }

    private matches(nodeValue: undefined, filterValue: FilterValue): boolean {
        if (filterValue === undefined) return true
        if (nodeValue === undefined) return false

        if (typeof filterValue === 'string') {
            return String(nodeValue).includes(filterValue)
        }

        if (typeof filterValue === 'number') {
            return nodeValue === filterValue
        }

        if (typeof filterValue === 'boolean') {
            return nodeValue === filterValue
        }

        if (Array.isArray(filterValue)) {
            return filterValue.includes(nodeValue)
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
