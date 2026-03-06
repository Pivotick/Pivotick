import { Node, type NodeData } from './Node'
import { Edge, type EdgeData } from './Edge'
import { createGraphRenderer } from './renderers/GraphRendererFactory'
import type { GraphRenderer, ProgressType } from './GraphRenderer'
import { Simulation } from './Simulation'
import { UIManager } from './ui/UIManager'
import { Notifier } from './ui/Notifier'
import type { GraphOptions, GraphData, RelaxedGraphData, RawNode, RawEdge, GraphEvents, GraphDataChange } from './interfaces/GraphOptions'
import type { GraphUI } from './interfaces/GraphUI'
import type { InterractionCallbacks } from './interfaces/InterractionCallbacks'
import type { LayoutOptions } from './interfaces/LayoutOptions'
import { generateSafeDomId } from './utils/ElementCreation'
import { GraphQueryEngine } from './GraphQueryEngine'
import type { GraphRendererOptions } from './interfaces/RendererOptions'


export class Graph {
    private nodes: Map<string, Node> = new Map()
    private edges: Map<string, Edge> = new Map()
    /** @private */
    public UIManager: UIManager
    public notifier: Notifier
    public renderer: GraphRenderer
    public simulation: Simulation
    public queryEngine: GraphQueryEngine
    /** @private */
    private options: GraphOptions
    private app_id: string
    
    private listeners: Record<keyof GraphEvents, Array<GraphEvents[keyof GraphEvents]>>

    /**
     * Initializes a graph inside the specified container using the provided data and options.
     *
     * @param container - The HTMLElement that will serve as the main container for the graph.
     * @param data - The graph data, including nodes and edges, to render.
     * @param options - Optional configuration for the graph's behavior, UI, styling, simulation, etc.
     */
    constructor(container: HTMLElement, data?: RelaxedGraphData, options?: Partial<GraphOptions>) {
        this.listeners = {
            ready: [],
            nodeAdd: [], nodeRemove: [], nodeChange: [], edgeAdd: [], edgeRemove: [], edgeChange: [], dataBatchChanged: [],
        }

        this.options = {
            isDirected: true,
            ...options,
        }

        if (this.options.UI?.mode === 'static') {
            if (!this.options.simulation) this.options.simulation = {}
            this.options.simulation.enabled = false
            this.options.simulation.useWorker = false
            
            if (!this.options.render) this.options.render = {}
            this.options.render.zoomEnabled = false
            this.options.render.zoomAnimation = false
            this.options.render.dragEnabled = false
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            if (!this.options.render.selectionBox) this.options.render.selectionBox = {}
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            this.options.render.selectionBox.enabled = false
            
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            if (!this.options.UI.tooltip) this.options.UI.tooltip = {}
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            this.options.UI.tooltip.enabled = false
            if (!this.options.UI.contextMenu) this.options.UI.contextMenu = {}
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            this.options.UI.contextMenu.enabled = false
        }

        const rendererOptions = {
            ...this.options.render
        } as Partial<GraphRendererOptions> 
        const UIManagerOptions = this.options.UI as GraphUI
        const appContainer = document.createElement('div')
        this.app_id = generateSafeDomId(8, 'pivotick-app-')
        appContainer.id = this.app_id
        appContainer.classList.add('pivotick')
        container.appendChild(appContainer)

        this.queryEngine = new GraphQueryEngine(this)
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
            const normalisedData = this.normalizeGraphData(data)
            this._setData(normalisedData?.nodes, normalisedData?.edges)
            this.simulation?.update()
            this.renderer.init()
            this.renderer.fitAndCenter(1)
        }

        this.startAndRender()
    }

    public on<K extends keyof GraphEvents>(
        event: K,
        handler: GraphEvents[K]
    ): void {
        this.listeners[event].push(handler)
    }

    public off<K extends keyof GraphEvents>(
        event: K,
        handler: GraphEvents[K]
    ): void {
        this.listeners[event] = this.listeners[event].filter(h => h !== handler)
    }

    private emit<K extends keyof GraphEvents>(
        event: K,
        ...args: Parameters<GraphEvents[K]>
    ): void {
        for (const handler of this.listeners[event]) {
            (handler as (...args: Parameters<GraphEvents[K]>) => void)(...args)
        }
    }

    private async startAndRender() {
        await this.simulation.start()
        await this.simulation.waitForSimulationStop()
        this.renderer.nextTick()
        this.renderer.fitAndCenter()
        this.UIManager.callGraphReady()
        this.ready()
    }

    private normalizeGraphData(data: GraphData | RelaxedGraphData): GraphData {
        const normalizedNodes = data.nodes.map((n) => this.normalizeNode(n))
        const nodesByID = new Map(normalizedNodes.map(node => [node.id, node]))
        const normalizedEdges = data.edges
            .map(e => {
                if (e instanceof Edge) return e

                const fromNode = nodesByID.get(e.from.toString())
                const toNode = nodesByID.get(e.to.toString())

                // Skip edges if either node doesn't exist
                if (!fromNode || !toNode) return null

                return new Edge(
                    e.id?.toString() ?? `${e.from}-${e.to}`,
                    fromNode,
                    toNode,
                    e.data,
                    e.style
                )
            })
            .filter((e): e is Edge => e !== null)

        return {
            nodes: normalizedNodes,
            edges: normalizedEdges,
        }
    }

    private normalizeNode(n: RawNode | Node): Node {
        let children: Node[] = []
        if (!(n instanceof Node) && n.children) {
            children = n.children.map((n) => {
                const nNode = this.normalizeNode(n)
                nNode.markAsChild()
                return nNode
            })
        }
        const normNode = n instanceof Node ? n : new Node(n.id.toString(), n.data, n.style, n.domID, children)
        normNode.weight = n.weight
        return normNode
    }

    private normalizeEdge(e: RawEdge | Edge): Edge | null {
        if (e instanceof Edge) return e

        const fromNode = this.nodes.get(e.from.toString())
        const toNode = this.nodes.get(e.to.toString())

        // Skip edges if either node doesn't exist
        if (!fromNode || !toNode) return null

        return new Edge(
            e.id?.toString() ?? `${e.from}-${e.to}`,
            fromNode,
            toNode,
            e.data,
            e.style
        )
    }


    private ready() {
        this.emit('ready')
    }

    private nodeAdd(node: Node): void {
        this.emit('nodeAdd', node)
    }

    private nodeRemove(node: Node): void {
        this.emit('nodeRemove', node)
    }

    private nodeChange(node: Node, previousData: NodeData, nextData: NodeData): void {
        this.emit('nodeChange', node, previousData, nextData)
    }

    private edgeAdd(edge: Edge): void {
        this.emit('edgeAdd', edge)
    }

    private edgeRemove(edge: Edge): void {
        this.emit('edgeRemove', edge)
    }

    private edgeChange(edge: Edge, previousData: EdgeData, nextData: EdgeData): void {
        this.emit('edgeChange', edge, previousData, nextData)
    }

    private dataBatchChanged(changes: GraphDataChange[]): void {
        if (changes) {
            this.emit('dataBatchChanged', changes)
            changes.forEach(c => {
                switch (c.type) {
                    case 'node:add':
                        this.nodeAdd(c.node)
                        break
                    case 'node:change':
                        this.nodeChange(c.node, c.previousData, c.nextData)
                        break
                    case 'node:remove':
                        this.nodeRemove(c.node)
                        break
                    case 'edge:add':
                        this.edgeAdd(c.edge)
                        break
                    case 'edge:change':
                        this.edgeChange(c.edge, c.previousData, c.nextData)
                        break
                    case 'edge:remove':
                        this.edgeRemove(c.edge)
                        break
                
                    default:
                        break
                }
            })
        }
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
        this.renderer?.update(true)
        this.simulation?.update()
        this.renderer?.nextTick()
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
    updateData(newNodes?: Array<Node>, newEdges?: Array<Edge>, triggerChangeEvent=true): void {
        const changes: GraphDataChange[] = []

        if (newNodes) {
            newNodes.forEach(newNode => {
                if (this.nodes.has(newNode.id)) {
                    changes.push({
                        type: 'node:change',
                        node: newNode,
                        previousData: this.nodes.get(newNode.id)?.getData(),
                        nextData: newNode.getData(),
                    } as GraphDataChange)
                    this.nodes.set(newNode.id, newNode)
                } else {
                    this.addNode(newNode)
                    changes.push({
                        type: 'node:add',
                        node: newNode
                    } as GraphDataChange)
                }
            })
        }
        if (newEdges) {
            newEdges.forEach(newEdge => {
                if (this.edges.has(newEdge.id)) {
                    changes.push({
                        type: 'edge:change',
                        edge: newEdge,
                        previousData: this.nodes.get(newEdge.id)?.getData(),
                        nextData: newEdge.getData(),
                    } as GraphDataChange)
                    this.edges.set(newEdge.id, newEdge)
                } else {
                    this.addEdge(newEdge)
                    changes.push({
                        type: 'edge:add',
                        edge: newEdge
                    } as GraphDataChange)
                }
            })
        }
        if (newNodes || newEdges) {
            this.onChange()
        }

        if (triggerChangeEvent) {
            this.dataBatchChanged(changes)
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
        const normalisedData = this.normalizeGraphData({ nodes: nodes, edges: edges})
        this._setData(normalisedData?.nodes, normalisedData?.edges)
        this.onChange()
        this.startAndRender()
    }

    /** 
     * @private
     */
    private _setData(nodes: Array<Node>, edges: Array<Edge>): void {
        // const recurseAddChildren = (node: Node) => {
        //     node.children.forEach((child: Node) => {
        //         this.nodes.set(child.id, child)
        //     })
        // }

        const changes: GraphDataChange[] = []
        nodes.forEach(node => {
            this.nodes.set(node.id, node)
            changes.push({
                type: 'node:add',
                node: node
            } as GraphDataChange)
            // recurseAddChildren(node)
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
            changes.push({
                type: 'edge:add',
                edge: edge
            } as GraphDataChange)
        })
        this.dataBatchChanged(changes)
    }

    /**
     * Adds a node to the graph.
     * 
     * @throws Error if a node with the same `id` already exists.
     * Triggers `onChange` after the node is successfully added.
     */
    addNode(n: RawNode | Node): Node {
        const node = this.normalizeNode(n)
        if (this.nodes.has(node.id)) {
            throw new Error(`Node with id ${node.id} already exists.`)
        }
        this.nodes.set(node.id, node)
        this.dataBatchChanged([{
            type: 'node:add',
            node: node
        } as GraphDataChange])
        this.onChange()
        return node
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
        this.dataBatchChanged([{
            type: 'node:remove',
            node: this.nodes.get(id)
        } as GraphDataChange])
        this.nodes.delete(id)

        // Remove edges connected to this node
        for (const [edgeId, edge] of this.edges) {
            if (edge.from.id === id || edge.to.id === id) {
                this.dataBatchChanged([{
                    type: 'edge:remove',
                    edge: this.edges.get(edgeId)
                } as GraphDataChange])
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
     * @param e The edge to add.
     * @throws Error if the edge ID already exists or if either node does not exist.
     * Triggers `onChange` after the edge is successfully added.
     */
    addEdge(e: RawEdge | Edge): Edge {
        const edge = this.normalizeEdge(e)

        if (!edge) {
            throw new Error('Either of the from or to nodes do not exist')
        }
        if (this.edges.has(edge.id)) {
            throw new Error(`Edge with id ${edge.id} already exists.`)
        }
        if (!this.nodes.has(edge.from.id) || !this.nodes.has(edge.to.id)) {
            throw new Error('Both nodes must exist in the graph before adding an edge.')
        }
        this.edges.set(edge.id, edge)
        this.dataBatchChanged([{
            type: 'edge:add',
            edge: edge
        } as GraphDataChange])
        this.onChange()
        return edge
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
        if (!this.edges.has(id)) return
        this.dataBatchChanged([{
            type: 'edge:remove',
            edge: this.edges.get(id)
        } as GraphDataChange])
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
     * Retrieves all visible nodes in the graph. Recursively adding visible children
     * 
     * Returns the actual node instances, allowing direct modifications.
     * 
     * @remarks
     * ⚠️ **Warning:** Modifying nodes directly may lead to unexpected behavior.
     * It is generally safer to use `getNodes`, which returns cloned instances.
     * 
     * @returns An array of `Node` objects.
     */
    getMutableVisibleNodes(): Node[] {
        function flattenNodes(nodes: Node[], parentNode: Node): Node[] {
            const flat: Node[] = []
            nodes.forEach((node, i) => {
                if (!node.x || !node.y) {
                    const r = 24
                    const count = parentNode.children.length
                    const angle = (i / count) * 2 * Math.PI
                    node.x = (parentNode.x ?? 0) + r * Math.cos(angle - Math.PI / 2)
                    node.y = (parentNode.y ?? 0) + r * Math.sin(angle - Math.PI / 2)
                }
                flat.push(node)
                if (node.expanded && node.children.length) {
                    flat.push(...flattenNodes(node.children, node))
                }
            })
            return flat
        }

        return this.getMutableNodes().filter(node => node.visible)
        const nodes: Node[] = []
        this.getMutableNodes().filter(node => node.visible).forEach(node => {
            nodes.push(node)
            if (node.expanded && node.hasChildren()) {
                nodes.push(...flattenNodes(node.children, node))
            }
        })
        return nodes
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

    setVisibleNodes(nodes: Node[]) {
        const visibleSet = new Set(nodes.map(n => n.id))

        let changed = false
        this.nodes.forEach(n => {
            const shouldBeVisible = visibleSet.has(n.id)
            if (n.visible !== shouldBeVisible) {
                n.toggleVisibility(shouldBeVisible)
                changed = true
            }
        })

        this.edges.forEach(edge => {
            const shouldBeVisible = edge.from.visible && edge.to.visible
            if (edge.visible !== shouldBeVisible) {
                edge.toggleVisibility(shouldBeVisible)
            }
        })

        if (changed) this.onChange()
    }

    hideNode(node: Node) {
        node.hide()
        node.getEdgesOut().forEach(e => {
            e.hide()
        })
        node.getEdgesIn().forEach(e => {
            e.hide()
        })
        this.onChange()
    }

    showNode(node: Node) {
        node.show()
        node.getEdgesOut().forEach(e => {
            if (e.target.visible) e.show()
        })
        node.getEdgesIn().forEach(e => {
            if (e.from.visible) e.show()
        })
        this.onChange()
    }

    toggleExpandNode(node: Node) {
        node.toggleExpand()
        this.onChange()
    }

    toggleExpandNodes(nodes: Node[]) {
        nodes.forEach(node => {
            node.toggleExpand()
        })
        this.onChange()
    }

    /**
     * Trigger the next render update of the graph.
     */
    nextTick(): void {
        this.renderer?.nextTick()
    }

    /**
     * Trigger the next render update of the graph for the passed subjects.
     */
    nextTickFor(nodes: Node[]): void {
        this.renderer?.nextTickFor(nodes)
    }

    /**
     * Destroy all UI components.
     */
    destroy(): void {
        this.UIManager.destroy()
    }

    /**
     * The ID of the app
     */
    getAppID(): string {
        return this.app_id
    }

    /**
     * @private
     */
    updateLayoutProgress(progress: number, elapsedTime: number, progressType: ProgressType): void {
        this.renderer?.updateLayoutProgress(progress, elapsedTime, progressType)
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
    }

    /**
     * Add a highligh class to the given node or edge
     * 
     * @param element The `Node` or `Edge` to highligh.
     */
    highlightElement(element: Node | Edge): void {
        this.renderer.highlightElement(element)
    }

    /**
     * Remove a highligh class to the given node or edge
     * 
     * @param element The `Node` or `Edge` to select.
     */
    unHighlightElement(element: Node | Edge): void {
        this.renderer.unHighlightElement(element)
    }
}
