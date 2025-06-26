import { Node } from './Node'
import { Edge } from './Edge'
import type { graphData, GraphOptions, InterractionCallbacks } from './GraphOptions'
import { GraphSvgRenderer } from './renderers/svg/GraphSvgRenderer'
import { Simulation } from './Simulation'


export class Graph {
    private nodes: Map<string, Node> = new Map()
    private edges: Map<string, Edge> = new Map()
    public renderer: GraphSvgRenderer
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
        this.renderer = new GraphSvgRenderer(this, container, rendererOptions)

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
        this.renderer.updatePositions()
    }

    getOptions(): GraphOptions {
        return this.options
    }

    getCallbacks(): Partial<InterractionCallbacks> | undefined {
        return this.options?.callbacks
    }

    onChange() {
        this.simulation?.update()
        this.renderer?.update()
    }

    updateData(newNodes?: Array<Node>, newEdges?: Array<Edge>): void{
        if (newNodes) {
            newNodes.forEach(newNode => {
                if (this.nodes.has(newNode.id)) {
                    this.nodes.set(newNode.id, newNode)
                } else {
                    this.addNode(newNode)
                }
            })
        }
        if (newEdges) {
            newEdges.forEach(newEdge => {
                if (this.edges.has(newEdge.id)) {
                    this.edges.set(newEdge.id, newEdge)
                } else {
                    this.addEdge(newEdge)
                }
            })
        }
        if (newNodes || newEdges) {
            this.onChange()
        }
    }

    setData(nodes: Array<Node> = [], edges: Array<Edge> = []): void {
        this.nodes.clear()
        this.edges.clear()
        this._setData(nodes, edges)
        this.onChange()
    }

    _setData(nodes: Array<Node>, edges: Array<Edge>): void {
        nodes.forEach(node => {
            this.nodes.set(node.id, node)
        })
        edges.forEach(edge => {
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
    getNode(id: string | Node): Node | undefined {
        return this._getNode(id)
    }


    private _getNode(id: string | Node): Node | undefined {
        if (typeof id === 'string') {
            const node = this.nodes.get(id)
            if (!node) {
                return undefined
            }
            return node
        } else if (id instanceof Node) {
            return id
        } else {
            return undefined
        }
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
     * Find edges going out of a given node id.
     */
    getEdgesFromNode(queryNode: string | Node): Edge[] {
        const node: Node | undefined = this.getNode(queryNode)
        if (!node)
            return []
        return this.getEdges().filter(edge => edge.from.id === node.id)
    }

    /**
     * Find edges going to a given node id.
     */
    getEdgesToNode(queryNode: string | Node): Edge[] {
        const node: Node | undefined = this.getNode(queryNode)
        if (!node)
            return []
        return this.getEdges().filter(edge => edge.to.id === node.id)
    }

    /**
     * Get nodes connected to the given node id
     */
    getConnectedNodes(queryNode: string | Node): Node[] {
        const node: Node | undefined = this.getNode(queryNode)
        if (!node)
            return []
        const edgesFrom = this.getEdgesFromNode(node.id)
        const connectedNodes = edgesFrom.map(edge => edge.to)
        return connectedNodes
    }

    updatePositions(): void {
        this.renderer?.updatePositions()
    }
}
