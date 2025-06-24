import { Node } from './node'
import { Edge } from './edge'
import type { graphData, GraphOptions, InterractionCallbacks } from './graph-options'
import { SvgRenderer } from './renderers/svgRenderer'
import { Simulation } from './simulation'


export class Graph {
    private nodes: Map<string, Node> = new Map()
    private edges: Map<string, Edge> = new Map()
    public renderer: SvgRenderer
    public simulation: Simulation
    private options: GraphOptions

    constructor(container: HTMLElement, data?: graphData, options?: GraphOptions) {
        this.options = {
            isDirected: true,
            ...options,
        }

        const rendererOptions = {
            ...this.options.render
        }
        this.renderer = new SvgRenderer(this, container, rendererOptions)

        const simulationOptions = {
            ...this.options.simulation
        }
        this.simulation = new Simulation(this, simulationOptions)

        if (data) {
            this._setData(data?.nodes, data?.edges)
            this.simulation?.update()
            this.renderer.init()
        }

        this.simulation.start()
        this.renderer.render()
    }

    getOptions(): GraphOptions {
        return this.options
    }

    getCallbacks(): Partial<InterractionCallbacks> | undefined {
        return this.options?.callbacks
    }

    onChange() {
        this.simulation?.update()
    }

    setData(nodes: Array<Node>, edges: Array<Edge>): void {
        this._setData(nodes, edges)
        this.onChange()
    }

    _setData(nodes: Array<Node>, edges: Array<Edge>): void {
        nodes.forEach(node => {
            if (this.nodes.has(node.id)) {
                throw new Error(`Node with id ${node.id} already exists.`)
            }
            this.nodes.set(node.id, node)
        })
        edges.forEach(edge => {
            if (this.edges.has(edge.id)) {
                throw new Error(`Edge with id ${edge.id} already exists.`)
            }
            if (!this.nodes.has(edge.from.id) || !this.nodes.has(edge.to.id)) {
                throw new Error('Both nodes must exist in the graph before adding an edge.')
            }
            this.edges.set(edge.id, edge)
        })
    }

    /**
     * Add a node to the graph.
     * Throws an error if a node with the same id exists.
     */
    addNode(node: Node): void {
        if (this.nodes.has(node.id)) {
            throw new Error(`Node with id ${node.id} already exists.`)
        }
        this.nodes.set(node.id, node)
        this.onChange()
    }

    /**
     * Get a node by its id.
     */
    getNode(id: string): Node | undefined {
        return this.nodes.get(id)
    }

    /**
     * Remove a node and its associated edges.
     */
    removeNode(id: string): void {
        if (!this.nodes.has(id)) return
        this.nodes.delete(id)

        // Remove edges connected to this node
        for (const [edgeId, edge] of this.edges) {
            if (edge.from.id === id || edge.to.id === id) {
                this.edges.delete(edgeId)
            }
        }
        this.onChange()
    }

    /**
     * Add an edge to the graph.
     * Throws if the edge id exists or if nodes don’t exist.
     */
    addEdge(edge: Edge): void {
        if (this.edges.has(edge.id)) {
            throw new Error(`Edge with id ${edge.id} already exists.`)
        }
        if (!this.nodes.has(edge.from.id) || !this.nodes.has(edge.to.id)) {
            throw new Error('Both nodes must exist in the graph before adding an edge.')
        }
        this.edges.set(edge.id, edge)
        this.onChange()
    }

    /**
     * Get an edge by id.
     */
    getEdge(id: string): Edge | undefined {
        return this.edges.get(id)
    }

    /**
     * Remove an edge by id.
     */
    removeEdge(id: string): void {
        this.edges.delete(id)
        this.onChange()
    }

    /**
     * Get all nodes in the graph.
     */
    getNodes(): Node[] {
        return Array.from(this.nodes.values())
    }

    /**
     * Get all edges in the graph.
     */
    getEdges(): Edge[] {
        return Array.from(this.edges.values())
    }

    /**
     * Find edges connected to a given node id.
     */
    getEdgesFromNode(nodeId: string): Edge[] {
        return this.getEdges().filter(edge => edge.from.id === nodeId)
    }

    getEdgesToNode(nodeId: string): Edge[] {
        return this.getEdges().filter(edge => edge.to.id === nodeId)
    }

    render(): void {
        this.renderer?.render()
    }
}
