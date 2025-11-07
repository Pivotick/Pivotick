import { Node } from './Node'
import { Edge } from './Edge'
import { createGraphRenderer } from './renderers/GraphRendererFactory'
import type { GraphRenderer } from './GraphRenderer'
import { Simulation } from './Simulation'
import { UIManager } from './ui/UIManager'
import { Notifier } from './ui/Notifier'
import type { GraphOptions, GraphData } from './interfaces/GraphOptions'
import type { GraphUI } from './interfaces/GraphUI'
import type { InterractionCallbacks } from './interfaces/InterractionCallbacks'
import type { LayoutOptions } from './interfaces/LayoutOptions'


export class Graph {
    private nodes: Map<string, Node> = new Map()
    private edges: Map<string, Edge> = new Map()
    /** @private */
    public UIManager: UIManager
    public notifier: Notifier
    public renderer: GraphRenderer
    public simulation: Simulation
    /** @private */
    private options: GraphOptions

    /**
     * Initializes a graph inside the specified container using the provided data and options.
     *
     * @param container - The HTMLElement that will serve as the main container for the graph.
     * @param data - The graph data, including nodes and edges, to render.
     * @param options - Optional configuration for the graph's behavior, UI, styling, simulation, etc.
     */
    constructor(container: HTMLElement, data?: GraphData, options?: GraphOptions) {
        this.options = {
            isDirected: true,
            ...options,
        }

        const rendererOptions = {
            ...this.options.render
        }
        const UIManagerOptions = this.options.UI as GraphUI
        const appContainer = document.createElement('div')
        appContainer.id = 'pivotick-app'
        appContainer.classList.add('pivotick-graph-container')
        container.appendChild(appContainer)

        this.UIManager = new UIManager(this, appContainer, UIManagerOptions)
        this.notifier = new Notifier(this)
        this.renderer = createGraphRenderer(this, appContainer, rendererOptions)
        this.renderer.setupRendering()

        const simulationOptions = {
            ...this.options.simulation,
            layout: this.options?.layout as LayoutOptions
        }
        this.simulation = new Simulation(this, simulationOptions)

        if (data) {
            this._setData(data?.nodes, data?.edges)
            this.simulation?.update()
            this.renderer.init()
        }

        this.startAndRender()
    }

    private async startAndRender() {
        await this.simulation.start()
        this.renderer.nextTick()
        this.renderer.fitAndCenter()
        this.UIManager.callGraphReady()
    }

    /**
     * Returns the current configuration options of the graph.
     */
    getOptions(): GraphOptions {
        return this.options
    }

    /**
     * @private
     * Retrieves the callbacks defined in the options for graph interactions.
     * 
     * @returns A partial `InteractionCallbacks` object, or `undefined` if no callbacks are set.
     */
    getCallbacks(): Partial<InterractionCallbacks> | undefined {
        return this.options?.callbacks
    }

    /**
     * @private
     */
    onChange() {
        this.simulation?.update()
        this.renderer?.dataUpdate()
    }

    /**
     * Updates the graph with new nodes and/or edges.
     * 
     * Existing nodes or edges with matching IDs are replaced; new ones are added.
     * Triggers the `onChange` callback if any updates were applied.
     * 
     * @param newNodes Optional array of nodes to update or add.
     * @param newEdges Optional array of edges to update or add.
     * Triggers `onChange`
     */
    updateData(newNodes?: Array<Node>, newEdges?: Array<Edge>): void {
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

    /**
     * Replaces all current nodes and edges in the graph with the provided data.
     * Clears existing nodes and edges before setting the new ones.
     * Triggers the `onChange` callback after the update.
     * 
     * @param nodes Array of nodes to set. Defaults to an empty array.
     * @param edges Array of edges to set. Defaults to an empty array.
     */
    setData(nodes: Array<Node> = [], edges: Array<Edge> = []): void {
        this.nodes.clear()
        this.edges.clear()
        this._setData(nodes, edges)
        this.onChange()
    }

    /** 
     * @private
     */
    private _setData(nodes: Array<Node>, edges: Array<Edge>): void {
        nodes.forEach(node => {
            this.nodes.set(node.id, node)
        })
        edges.forEach(edge => {
            if (
                !this.nodes.has(edge.from.id) ||
                !this.nodes.has(edge.to.id)
            ) {
                console.warn(`Edge is pointing a node that doesn't exist. (${this.nodes.get(edge.from.id)}) -> (${this.nodes.get(edge.to.id)}). It has been skipped`)
                return
            }
            this.edges.set(edge.id, edge)
        })
    }

    /**
     * Adds a node to the graph.
     * 
     * @throws Error if a node with the same `id` already exists.
     * Triggers `onChange` after the node is successfully added.
     */
    addNode(node: Node): void {
        if (this.nodes.has(node.id)) {
            throw new Error(`Node with id ${node.id} already exists.`)
        }
        this.nodes.set(node.id, node)
        this.onChange()
    }

    /**
     * Retrieves a node from the graph by its ID.
     * 
     * Returns a deep clone of the node to prevent external mutations.
     * 
     * @param id The ID of the node or a Node object.
     * @returns A cloned `Node` if found, otherwise `undefined`.
     */
    getNode(id: string | Node): Node | undefined {
        const node = this._getNode(id)
        return node ? structuredClone(node) : undefined
    }

    /**
     * Retrieves a node from the graph by its ID.
     * 
     * Returns the actual node instance, allowing direct modifications.
     * 
     * **Warning:** Directly modifying nodes using this method may lead to unexpected behavior.
     * It is generally safer to use `getNode` which returns a cloned instance.
     * 
     * @param id The ID of the node or a Node object.
     * @returns The `Node` if found, otherwise `undefined`.
     */
    getMutableNode(id: string | Node): Node | undefined {
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
     * Removes a node from the graph by its ID.
     * 
     * Also removes any edges connected to the node.
     * 
     * @param id The ID of the node to remove.
     * Triggers `onChange` after the node and its edges are removed.
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
     * Adds an edge to the graph.
     * 
     * Both the source (`from`) and target (`to`) nodes must already exist in the graph.
     * Throws an error if an edge with the same ID already exists.
     * 
     * @param edge The edge to add.
     * @throws Error if the edge ID already exists or if either node does not exist.
     * Triggers `onChange` after the edge is successfully added.
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
     * Retrieves an edge from the graph by its ID.
     * 
     * Returns a deep clone of the edge to prevent external mutations.
     * 
     * @param id The ID of the edge.
     * @returns A cloned `Edge` if found, otherwise `undefined`.
     */
    getEdge(id: string): Edge | undefined {
        const edge = this.edges.get(id)
        return edge ? structuredClone(edge) : undefined
    }

    /**
     * Retrieves an edge from the graph by its ID.
     * 
     * Returns the actual edge instance, allowing direct modifications.
     * 
     * **Warning:** Directly modifying edges using this method may lead to unexpected behavior.
     * It is generally safer to use `getEdge` which returns a cloned instance.
     * 
     * @param id The ID of the edge.
     * @returns The `Edge` if found, otherwise `undefined`.
     */
    getMutableEdge(id: string): Edge | undefined {
        return this.edges.get(id)
    }

    /**
     * Removes an edge from the graph by its ID.
     * 
     * @param id The ID of the edge to remove.
     * Triggers `onChange` after the edge is removed.
     */
    removeEdge(id: string): void {
        this.edges.delete(id)
        this.onChange()
    }

    /**
     * Returns the number of nodes currently in the graph.
     * 
     * @returns The total node count.
     */
    getNodeCount(): number {
        return this.nodes.size
    }

    /**
     * Returns the number of edges currently in the graph.
     * 
     * @returns The total edge count.
     */
    getEdgeCount(): number {
        return this.edges.size
    }

    /**
     * Retrieves all nodes in the graph.
     * 
     * Returns clones of the nodes to prevent external modifications.
     * 
     * @returns An array of cloned `Node` objects.
     */
    getNodes(): Node[] {
        return Array.from(this.nodes.values()).map((node: Node) => node.clone())
    }

    /**
     * Retrieves all nodes in the graph.
     * 
     * Returns the actual node instances, allowing direct modifications.
     * 
     * @remarks
     * ⚠️ **Warning:** Modifying nodes directly may lead to unexpected behavior.
     * It is generally safer to use `getNodes`, which returns cloned instances.
     * 
     * @returns An array of `Node` objects.
     */
    getMutableNodes(): Node[] {
        return Array.from(this.nodes.values())
    }

    /**
     * Retrieves all edges in the graph.
     * 
     * Returns clones of the edges to prevent external modifications.
     * 
     * @returns An array of cloned `Edge` objects.
     */
    getEdges(): Edge[] {
        return Array.from(this.edges.values()).map((edge: Edge) => edge.clone())
    }

    /**
     * Retrieves all edges in the graph.
     * 
     * Returns the actual edge instances, allowing direct modifications.
     * 
     * @remarks
     * ⚠️ **Warning:** Modifying edges directly may lead to unexpected behavior.
     * Use {@link getEdges} instead to work with safe clones.
     * 
     * @returns An array of `Edge` objects.
     */
    getMutableEdges(): Edge[] {
        return Array.from(this.edges.values())
    }

    /**
     * Finds all edges originating from a given node.
     * 
     * Returns cloned edges to prevent external modifications.
     * 
     * @param node The node or node ID to find outgoing edges from.
     * @returns An array of `Edge` objects whose `from` node matches the query.
     */
    getEdgesFromNode(node: string | Node): Edge[] {
        const found: Node | undefined = this._getNode(node)
        if (!found)
            return []
        return this.getEdges().filter(edge => edge.from.id === found.id)
    }

    /**
     * Finds all edges pointing to a given node.
     * 
     * Returns cloned edges to prevent external modifications.
     * 
     * @param node The node or node ID to find incoming edges to.
     * @returns An array of `Edge` objects whose `to` node matches the query.
     */
    getEdgesToNode(node: string | Node): Edge[] {
        const found: Node | undefined = this._getNode(node)
        if (!found)
            return []
        return this.getEdges().filter(edge => edge.to.id === found.id)
    }

    /**
     * Retrieves all nodes directly connected from the given node.
     * 
     * Returns cloned nodes to prevent external modifications.
     * 
     * @param node The node or node ID to find connections from.
     * @returns An array of `Node` objects directly connected from the given node.
     */
    getConnectedNodes(node: string | Node): Node[] {
        const found: Node | undefined = this._getNode(node)
        if (!found)
            return []
        const edgesFrom = this.getEdgesFromNode(found.id)
        const connectedNodes = edgesFrom.map(edge => edge.to)
        return connectedNodes
    }

    /**
     * Trigger the next render update of the graph.
     */
    nextTick(): void {
        this.renderer?.nextTick()
    }

    /**
     * @private
     */
    updateLayoutProgress(progress: number, elapsedTime: number): void {
        this.renderer?.updateLayoutProgress(progress, elapsedTime)
    }

    /**
     * Brings the specified node or edge into focus within the graph view.
     * 
     * @param element The `Node` or `Edge` to focus.
     */
    focusElement(element: Node | Edge): void {
        this.renderer.focusElement(element)
    }

    /**
     * Selects a given node or edge in the graph.
     * 
     * @param element The `Node` or `Edge` to select.
     */
    selectElement(element: Node | Edge): void {
        if (element instanceof Edge) {
            this.renderer.getGraphInteraction().selectEdge(element.getGraphElement(), element)
            return
        } else if (element instanceof Node) {
            this.renderer.getGraphInteraction().selectNode(element.getGraphElement(), element)
            return
        }
        console.log(element)
    }
}
