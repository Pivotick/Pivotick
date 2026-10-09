import { Node, type NodeData } from './Node'
import { Edge, type EdgeData } from './Edge'
import { createGraphRenderer } from './renderers/GraphRendererFactory'
import type { GraphForecast, GraphRenderer, ProgressType } from './GraphRenderer'
import { Simulation } from './Simulation'
import { UIManager } from './ui/UIManager'
import { Notifier } from './ui/Notifier'
import type { GraphOptions, GraphData, RelaxedGraphData, RawNode, RawEdge, GraphEvents, GraphDataChange } from './interfaces/GraphOptions'
import type { GraphUI, LegendGroupOptions, LegendOptions, LegendToggleState } from './interfaces/GraphUI'
import type { InterractionCallbacks } from './interfaces/InterractionCallbacks'
import type { LayoutOptions } from './interfaces/LayoutOptions'
import { generateSafeDomId } from './utils/ElementCreation'
import { GraphQueryEngine } from './GraphQueryEngine'
import { GraphHistory } from './GraphHistory'
import type { EdgeFullStyle, GraphRendererOptions } from './interfaces/RendererOptions'
import { GraphEditingManager } from './editing/GraphEditingManager'
import { NoteManager } from './NoteManager'
import { Note, type NoteOptions } from './Note'
import type { PivotickPlugin } from './interfaces/Plugin'
import { PivotManager } from './PivotManager'
import { minimap } from './plugins/minimap'
import { ClusterProjection, type ClusterPull, type ProjectedLine, type TopVisible } from './ClusterProjection'
import { Simplification } from './Simplification/Simplification'

export class Graph {
    private nodes: Map<string, Node> = new Map()
    private edges: Map<string, Edge> = new Map()
    /** @private */
    public UIManager: UIManager
    public noteManager: NoteManager
    public notifier: Notifier
    public renderer: GraphRenderer
    public simulation: Simulation
    public queryEngine: GraphQueryEngine
    /** @private */
    private options: GraphOptions
    private app_id: string
    private parentGraph?: Graph
    /** For a nested graph: the real node of the open cluster whose children it draws. */
    private clusterOwner?: Node
    private graphDepth: number
    /** What the canvas draws for each real edge, given which clusters are open. */
    private readonly projection = new ClusterProjection(this)
    public readonly editing: GraphEditingManager
    /**
     * The pivot runtime: register enrichments, run them, triage what they return,
     * and undo a whole run. Lives on `Graph` rather than the UI because pivots
     * produce *data* — and because it has to exist before the UI is built.
     */
    public readonly pivots: PivotManager
    /**
     * What the canvas holds and shows, and how it came to: every ingest, deletion,
     * durable hide and hand-drawn element, contiguously reversible. Bounded and
     * session-scoped — it does not survive a reload.
     */
    public readonly history: GraphHistory
    /**
     * Folds nodes that play the same role into one group drawn in their place. The groups
     * are view state: `getNodes()`, `getEdges()`, the table and the history see the members.
     */
    public readonly simplify: Simplification

    private listeners: Record<keyof GraphEvents, Array<GraphEvents[keyof GraphEvents]>>
    /** Depth of nested {@link batchChanges} calls; > 0 means events are being collected. */
    private batchDepth = 0
    private batchedChanges: GraphDataChange[] = []
    private batchNeedsChange = false
    /** Subscribers to {@link onVisibleChange} — kept apart from the data event bus. */
    private changeListeners: Array<() => void> = []
    /** Set while {@link onChange} runs, which updates the simulation itself. */
    private changing = false

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
            nodeAdd: [], nodeRemove: [], nodeChange: [], edgeAdd: [], edgeRemove: [], edgeChange: [],
            noteAdd: [], noteRemove: [], noteChange: [],
            dataBatchChanged: [], legendToggle: [],
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

        this.graphDepth = 0
        this.clusterOwner = this.options.clusterOwner
        if (this.options.parentGraph) {
            this.setParentGraph(this.options.parentGraph)
            let pg = this.parentGraph
            while (pg) {
                pg = pg.parentGraph
                this.graphDepth++
            }
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

        this.noteManager = new NoteManager(this)
        // Before everything that records into it: the query engine's hides, the editing
        // manager's deletes and creations, and every pivot ingest are all entries.
        this.history = new GraphHistory(this)
        this.queryEngine = new GraphQueryEngine(this)
        this.editing = new GraphEditingManager(this)
        // Before the UI: whether any pivot is registered decides whether the Pivot
        // rail mode exists at all, and the rail is built inside `new UIManager`.
        this.pivots = new PivotManager(this)
        if (typeof this.options.pivotCandidateCeiling === 'number') {
            this.pivots.candidateCeiling = this.options.pivotCandidateCeiling
        }
        if (typeof this.options.pivotQuickIngestLimit === 'number') {
            this.pivots.quickIngestLimit = this.options.pivotQuickIngestLimit
        }
        if (this.options.pivotIngestGrouped) this.pivots.ingestGrouped = true
        if (this.options.pivotRimBadge) {
            this.pivots.rimBadge = this.options.pivotRimBadge
        }
        if (this.options.pivotRimBadgeVisible) {
            this.pivots.rimBadgeVisible = this.options.pivotRimBadgeVisible
        }
        if (this.options.pivotMarkUnsaved === true) {
            this.pivots.markUnsaved = true
        }
        if (this.options.pivotSaveControls === false) {
            this.pivots.saveControls = false
        }
        this.options.pivots?.forEach(pivot => this.pivots.register(pivot))
        // Before the UI too: the Simplify rail mode reads its rules.
        this.simplify = new Simplification(this, this.options.UI?.simplify, this.options.UI?.mode)
        this.simplify.manualHistory = (before, label, members) =>
            this.history.recordGroup(label, before, this.simplify.getManualGroups(), members)
        this.UIManager = new UIManager(this, appContainer, UIManagerOptions)
        // Declared facets carry the accessor/predicate/matchMode the engine matches
        // with, so hand them over as soon as the merged UI options exist.
        this.queryEngine.setFacets(this.UIManager.getOptions().filter?.facets)
        this.queryEngine.setEdgeFacets(this.UIManager.getOptions().filter?.edgeFacets)
        this.queryEngine.setHideDisconnected(this.UIManager.getOptions().filter?.hideDisconnected === true)
        this.notifier = new Notifier(this)
        this.renderer = createGraphRenderer(this, appContainer, rendererOptions)
        this.renderer.setupRendering()

        // Two places name the layout; the top-level one wins when both do.
        const simulationOptions = {
            ...this.options.simulation,
            layout: (this.options?.layout ?? this.options.simulation?.layout) as LayoutOptions
        }
        this.simulation = new Simulation(this, simulationOptions)

        if (data) {
            const normalisedData = Graph.normalizeGraphData(data)
            this._setData(normalisedData?.nodes, normalisedData?.edges, normalisedData?.notes)
            // Before the layout and the first paint: a node the filters mean to hide must
            // never reach the canvas, and must not be in the graph the opening fit frames.
            this.queryEngine.applyInitialVisibility()
            // Groups too, so the first layout and the opening fit see the folded graph.
            this.refreshProjection()
            this.simulation?.update()
            this.renderer.init()
            this.renderer.fitAndCenter(1)
        }

        this.options.plugins?.forEach(plugin => this.use(plugin))
        this.installModePlugins()

        this.startAndRender()
    }

    /**
     * The plugins the chosen mode brings along, installed once `options.plugins`
     * has had first claim on the name — a consumer's own `minimap({ width: 240 })`
     * must win, and `installPlugin` drops whichever copy arrives second.
     */
    private installModePlugins() {
        const ui = this.UIManager.getOptions()
        const declared = ui.minimap
        if (declared === false || this.UIManager.hasPlugin('minimap')) return
        // Asked for explicitly it goes up in any mode; left out, only `full` gets one —
        // the mode that already brings a header, a sidebar, a rail and a legend.
        if (declared === undefined && ui.mode !== 'full') return

        const options = typeof declared === 'object' ? declared : {}
        // 'auto' unless overridden: a minimap nobody asked for has to be able to get out
        // of the way. An explicit `collapsed` in the options wins.
        this.use(minimap({ collapsed: 'auto', ...options }))
    }

    /**
     * Install a {@link PivotickPlugin}. Can be called at any time — the plugin's
     * UI elements are caught up to the current lifecycle phase. Returns `this`
     * for chaining.
     */
    public use(plugin: PivotickPlugin): this {
        this.UIManager.installPlugin(plugin)
        return this
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
        // Before `ready`, so a host reading or setting the view then finds the opening fit done.
        await this.renderer.fitAndCenterWhenSettled()
        this.UIManager.callGraphReady()
        this.ready()
    }

    /**
     * Normalizes graph data: builds the node hierarchy, nested children included, and
     * resolves each edge's endpoints. Edges into a cluster are kept as they are; what the
     * canvas draws for them while clusters are closed is {@link ClusterProjection}'s job.
     *
     * @param data - The raw graph data to normalize
     * @returns Normalized graph data
     * @private
     */
    public static normalizeGraphData(data: GraphData | RelaxedGraphData): GraphData {
        const normalizedNodes = data.nodes.map((n) => Graph.normalizeNode(n))
        const childrenNodesByID = new Map()
        const recurseAddChildren = (node: Node) => {
            node.children.forEach((child: Node) => {
                childrenNodesByID.set(child.id, child)
                if (child.hasChildren()) {
                    recurseAddChildren(child)
                }
            })
        }
        normalizedNodes.forEach((node: Node) => {
            recurseAddChildren(node)
        })
        const baseNodesByID = new Map(normalizedNodes.map(node => [node.id, node]))
        const nodesByID = new Map([...baseNodesByID, ...childrenNodesByID])

        const normalizedEdges: Edge[] = data.edges.map((e) => Graph.normalizeEdge(e, nodesByID))
            .filter((e): e is Edge => e !== null)

        const normalisedNotes: Note[] = (data.notes ?? []).map((n) => Graph.normalizeNote(n))
            .filter((n): n is Note => n !== null)

        return {
            nodes: normalizedNodes,
            edges: normalizedEdges,
            notes: normalisedNotes,
        }
    }

    /**
     * Normalizes a node, marking its children and hiding them.
     * @private
     */
    /**
     * @private
     * Normalize plain child data into `Node`s — what {@link unionChildren} merges in.
     * Each one is re-parented by the union itself, so the depth here is provisional.
     */
    public static normalizeChildren(children: Array<RawNode | Node>): Node[] {
        return children.map(child => Graph.normalizeNode(child, 1))
    }

    private static normalizeNode(n: RawNode | Node, depth=0): Node {
        let children: Node[] = []
        if (!(n instanceof Node) && n.children) {
            children = n.children.map((n) => {
                const nNode = Graph.normalizeNode(n, depth+1)
                return nNode
            })
        }
        const normNode = n instanceof Node ? n : new Node(n.id.toString(), n.data, n.style, n.domID, children)
        // Honour caller-supplied initial positions so a layout can be seeded
        if (!(n instanceof Node)) {
            if (typeof n.x === 'number') normNode.x = n.x
            if (typeof n.y === 'number') normNode.y = n.y
            if (typeof n.fx === 'number') normNode.fx = n.fx
            if (typeof n.fy === 'number') normNode.fy = n.fy
        }
        normNode.children.forEach((child: Node) => {
            child.markAsChild(normNode, depth+1)
            child.hide()
        })
        normNode.weight = n.weight
        normNode.expanded = n.expanded ?? false
        return normNode
    }

    /**
     * Normalizes an edge.
     * @private
     */
    private static normalizeEdge(e: RawEdge | Edge, allNodes: Map<string, Node>): Edge | null {
        if (e instanceof Edge) return e

        const nodeMap = allNodes
        
        const fromNode = nodeMap.get(e.from.toString())
        const toNode = nodeMap.get(e.to.toString())

        // Skip edges if either node doesn't exist
        if (!fromNode || !toNode) return null

        const normEdge = new Edge(
            e.id?.toString() ?? `${e.from}-${e.to}`,
            fromNode,
            toNode,
            e.data,
            e.style
        )
        return normEdge
    }

    private static normalizeNote(n: NoteOptions | Note): Note | null {
        if (n instanceof Note) return n
        
        const normNote = new Note(n)
        return normNote
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

    public noteAdd(note: Note): void {
        this.emit('noteAdd', note)
    }
    public noteChange(note: Note): void {
        this.emit('noteChange', note)
    }
    public noteRemove(note: Note): void {
        this.emit('noteRemove', note)
    }

    /**
     * @private
     * Announce that a legend entry was toggled. Called by the legend after it has
     * applied its filter, so a consumer can persist the user's choice.
     */
    public legendToggled(state: LegendToggleState): void {
        this.emit('legendToggle', state)
    }

    /**
     * Replace the canvas legend at runtime — the imperative twin of `UI.legend`.
     * A graph that started without one gets it built on the spot; `false` empties
     * the legend and drops its filter, and `true` / `undefined` fall back to
     * deriving one from `render.nodeTypeAccessor`. Pass a
     * {@link LegendGroupOptions} to key the graph on several dimensions at once.
     *
     * @param config - The legend to show, or `false` to remove it.
     */
    public setLegend(config?: LegendOptions | LegendGroupOptions | boolean): void {
        this.UIManager.setLegend(config)
    }

    /**
     * @private
     * Announce that a node's data was replaced in place — emits `nodeChange` plus a
     * `dataBatchChanged` entry. Used by the interactive node editor, which mutates the
     * live node rather than going through {@link updateData}.
     */
    public nodeDataChanged(node: Node, previousData: NodeData, nextData: NodeData): void {
        this.dataBatchChanged([{
            type: 'node:change',
            node,
            previousData,
            nextData,
        } as GraphDataChange])
    }

    /**
     * @private
     * The edge twin of {@link nodeDataChanged} — emits `edgeChange` plus a
     * `dataBatchChanged` entry for an edge whose data was replaced in place.
     */
    public edgeDataChanged(edge: Edge, previousData: EdgeData, nextData: EdgeData): void {
        this.dataBatchChanged([{
            type: 'edge:change',
            edge,
            previousData,
            nextData,
        } as GraphDataChange])
    }

    /**
     * @private
     * Run `fn` with data notifications coalesced: everything it adds or removes
     * lands as **one** `dataBatchChanged` and one re-render, instead of one per
     * element. Ingesting twelve nodes and twelve edges is one event, not twenty-four.
     *
     * Nests safely, and the model itself is mutated as it always was — only the
     * announcing waits.
     */
    public batchChanges<T>(fn: () => T): T {
        this.batchDepth++
        try {
            return fn()
        } finally {
            this.batchDepth--
            if (this.batchDepth === 0) {
                const changes = this.batchedChanges
                this.batchedChanges = []
                const needsChange = this.batchNeedsChange
                this.batchNeedsChange = false
                if (changes.length) this.dataBatchChanged(changes)
                if (needsChange) this.onChange()
            }
        }
    }

    /**
     * @private
     * Merge plain child data into a node already on canvas, by id: new children are
     * added, matching ones are left untouched, none are removed — and the union
     * recurses. Registers what was added in the graph's own node map.
     *
     * The added children are announced on the data bus: unlike the nested children of
     * a node being *loaded*, these arrive while the graph is live, and a surface
     * showing a container's contents has no other way to hear about them.
     *
     * @returns every node newly added, at any depth.
     */
    public unionChildren(parent: Node, children: Array<RawNode | Node>): Node[] {
        const merged = parent.unionChildren(Graph.normalizeChildren(children))
        if (!merged.length) return merged
        this.registerChildren(parent)
        // A merged-in child whose id was already taken has been dropped again, so it
        // is not something this call added.
        const added = merged.filter(child => this.nodes.get(child.id) === child)
        if (!added.length) return added
        this.dataBatchChanged(added.map(child => ({ type: 'node:add', node: child } as GraphDataChange)))
        this.onChange()
        return added
    }

    /**
     * @private
     * Register a container's children under their ids, depth first.
     *
     * An id the graph already holds is **not** taken over. The node on canvas is the
     * one its edges, the simulation and the DOM binding are all using, and writing a
     * container's child over it strands every one of them: the edges go on pointing at
     * an object nothing moves again, and the id now names something hidden inside a
     * cluster. So the collision is resolved the other way — the child is dropped from
     * its container and the node on canvas stands, which is the rule an id-matched
     * candidate already gets one level up.
     */
    private registerChildren(parent: Node): void {
        for (const child of [...parent.children]) {
            const held = this.nodes.get(child.id)
            if (held && held !== child) {
                parent.removeChildById(child.id)
                continue
            }
            this.nodes.set(child.id, child)
            this.registerChildren(child)
        }
    }

    /**
     * @private
     * Remove a node wherever it lives: a container's child comes out of its parent as
     * well as out of the graph, a top-level node is an ordinary removal.
     */
    public dropNode(node: Node): void {
        if (node.parentNode) this.removeChildNode(node.parentNode, node.id)
        else this.removeNode(node.id)
    }

    /**
     * @private
     * Remove one child of a container, and its own subtree with it — the only way a
     * union-added child goes, and only ever because nothing vouches for it any more.
     */
    public removeChildNode(parent: Node, childId: string): void {
        const child = parent.removeChildById(childId)
        if (!child) return
        for (const node of [child, ...child.descendants()]) this.removeNode(node.id)
        parent.markDirty()
        this.onChange()
    }

    /**
     * Remove everything a source vouches for. An element several sources vouch for
     * survives, one claim lighter — the same uniform rule pivot undo follows, and the
     * only way anything a pivot brought is removed.
     *
     * It is a forward operation, and one entry in {@link history}: undoing it puts back
     * what left and hands the source's claim back to what stayed.
     *
     * @param source A pivot id, or `'seed'` for data that was never pivoted.
     * @returns What was actually removed.
     */
    public removeBySource(source: string): { nodes: Node[], edges: Edge[] } {
        const nodesBefore = [...this.nodes.values()]
        const edgesBefore = [...this.edges.values()]
        const vouched = {
            nodes: nodesBefore.filter(node => node.hasSource(source)),
            edges: edgesBefore.filter(edge => edge.hasSource(source)),
        }
        // Read before anything is dropped: the drop is what empties these.
        const claims = {
            nodes: vouched.nodes.map(node => ({ id: node.id, ledger: node.cloneLedger() })),
            edges: vouched.edges.map(edge => ({ id: edge.id, ledger: edge.cloneLedger() })),
        }
        const parents = new Map<string, string>()
        for (const node of nodesBefore) if (node.parentNode) parents.set(node.id, node.parentNode.id)

        const removed = this.dropSource(source, vouched.nodes, vouched.edges)

        // Everything that left, not only what the source alone vouched for: a node's
        // edges and its subtree go with it, and the undo has to bring them back too.
        const gone = {
            nodes: nodesBefore.filter(node => this.nodes.get(node.id) !== node),
            edges: edgesBefore.filter(edge => this.edges.get(edge.id) !== edge),
        }
        const goneIds = new Set(gone.nodes.map(node => node.id))
        this.history.recordRemoval(source, claims, {
            ...gone,
            parents: new Map([...parents].filter(([id]) => goneIds.has(id))),
        })
        return removed
    }

    /**
     * @private
     * Drop `source`'s claim on these elements and remove whatever nothing vouches for
     * any more — the rule behind {@link removeBySource}, and its redo.
     */
    public dropSource(source: string, vouchedNodes: Node[], vouchedEdges: Edge[]): { nodes: Node[], edges: Edge[] } {
        const nodes: Node[] = []
        const edges: Edge[] = []
        this.batchChanges(() => {
            for (const edge of vouchedEdges) {
                if (!edge.dropSource(source)) continue
                edges.push(edge)
                this.removeEdge(edge.id)
            }
            for (const node of vouchedNodes) {
                if (!node.dropSource(source)) continue
                nodes.push(node)
                this.dropNode(node)
            }
        })
        return { nodes, edges }
    }

    private dataBatchChanged(changes: GraphDataChange[]): void {
        if (this.batchDepth > 0) {
            if (changes) this.batchedChanges.push(...changes)
            return
        }
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
                    case 'note:add':
                        this.noteAdd(c.note)
                        break
                    case 'note:change':
                        this.noteChange(c.note)
                        break
                    case 'note:remove':
                        this.noteRemove(c.note)
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
        if (this.batchDepth > 0) {
            this.batchNeedsChange = true
            return
        }
        this.changing = true
        try {
            this.renderer?.update(true)
        } finally {
            this.changing = false
        }
        this.simulation?.update()
        this.renderer?.nextTick()
        // Last, so a listener reads the settled graph: the cluster drawer does its
        // expand/collapse work inside `renderer.update`, above.
        for (const listener of this.changeListeners) listener()
    }

    /**
     * Subscribe to {@link onChange} — the funnel every visible-graph change passes
     * through: add/remove, filter, cluster expand/collapse, manual hide. For UI that has
     * to re-read what is on the canvas when nothing more specific is emitted; a cluster
     * opening announces itself no other way, and on a pinned graph there are no
     * simulation ticks to fall back on either. Returns its own unsubscribe.
     * @private
     */
    onVisibleChange(listener: () => void): () => void {
        this.changeListeners.push(listener)
        return () => {
            this.changeListeners = this.changeListeners.filter((candidate) => candidate !== listener)
        }
    }

    /**
     * Updates the graph with new nodes and/or edges.
     *
     * An id the graph already holds is updated **in place**: what the element *is* —
     * its data, style and weight — becomes what you handed over, while the object
     * itself keeps its identity. It has to work that way. Its edges, the simulation
     * and the DOM binding all hold that object, and so does everything it has learned
     * since it was built: which sources vouch for it, where it sits, whether it is
     * pinned. A position on the incoming element still wins, so `updateData` can move
     * something as well as refresh it. Unknown ids are added.
     *
     * A container's `children` are not restructured here — pass the container through
     * {@link removeNode} and {@link addNode} to change what it holds.
     *
     * The whole call is one batch: one `dataBatchChanged` listing every add and change in
     * the order given, then one re-render, however many elements it carries.
     *
     * @param newNodes Optional array of nodes to update or add.
     * @param newEdges Optional array of edges to update or add.
     * @param triggerChangeEvent Announce the in-place changes. Adds are announced either way.
     */
    updateData(newNodes?: Array<Node>, newEdges?: Array<Edge>, triggerChangeEvent=true): void {
        // Batched, or every added element re-renders the whole graph on its own.
        this.batchChanges(() => {
            newNodes?.forEach(newNode => {
                const existing = this.nodes.get(newNode.id)
                if (!existing) {
                    // Announces itself.
                    this.addNode(newNode)
                    return
                }
                if (triggerChangeEvent) this.dataBatchChanged([{
                    type: 'node:change',
                    node: existing,
                    previousData: existing.getData(),
                    nextData: newNode.getData(),
                }])
                this.applyNodeUpdate(existing, newNode)
            })
            newEdges?.forEach(newEdge => {
                const existing = this.edges.get(newEdge.id)
                if (!existing) {
                    this.addEdge(newEdge)
                    return
                }
                if (triggerChangeEvent) this.dataBatchChanged([{
                    type: 'edge:change',
                    edge: existing,
                    previousData: existing.getData(),
                    nextData: newEdge.getData(),
                }])
                this.applyEdgeUpdate(existing, newEdge)
            })
            if (newNodes || newEdges) this.onChange()
        })
    }

    /**
     * Apply an incoming node onto the one the graph is using. Data, style and weight
     * are what the caller handed over; a position is copied only when the incoming
     * node has one, because a caller who built a bare `new Node(id, data)` means
     * "refresh this" and not "forget where it is".
     */
    private applyNodeUpdate(existing: Node, incoming: Node): void {
        // The simulation announces a finished layout pass by handing the graph its own
        // nodes back. There is nothing to copy from an object onto itself, and marking
        // it dirty for a change that did not happen makes the renderer re-measure.
        if (existing === incoming) return
        existing.setData(incoming.getData())
        existing.setStyle(incoming.getStyle())
        existing.weight = incoming.weight
        if (incoming.x !== undefined) existing.x = incoming.x
        if (incoming.y !== undefined) existing.y = incoming.y
        if (incoming.fx !== undefined) existing.fx = incoming.fx
        if (incoming.fy !== undefined) existing.fy = incoming.fy
    }

    /**
     * The edge twin. Endpoints are resolved by id against the graph's own nodes, so
     * an edge built against copies still ends up on the real ones; and an edge moved
     * to different endpoints stops being counted by the pair it used to join.
     */
    private applyEdgeUpdate(existing: Edge, incoming: Edge): void {
        if (existing === incoming) return
        existing.setData(incoming.getData())
        existing.setStyle(incoming.getStyle() as EdgeFullStyle)

        // Building an Edge registers it on its endpoints, and this one is about to be
        // thrown away: left counted, every degree and neighbour list it touches is one
        // too high.
        incoming.from.unregisterEdge(incoming)
        incoming.to.unregisterEdge(incoming)

        const from = this.nodes.get(incoming.from.id)
        const to = this.nodes.get(incoming.to.id)
        if (!from || !to) return
        if (existing.from !== from) existing.from.unregisterEdge(existing)
        if (existing.to !== to) existing.to.unregisterEdge(existing)
        existing.bindEndpoints(from, to)
    }

    /**
     * Replaces all current nodes and edges in the graph with the provided data.
     * Clears existing nodes and edges before setting the new ones.
     * Triggers the `onChange` callback after the update.
     * 
     * @param nodes Array of nodes to set. Defaults to an empty array.
     * @param edges Array of edges to set. Defaults to an empty array.
     */
    setData(nodes: Array<Node> = [], edges: Array<Edge> = [], notes: Array<Note> = []): void {
        this.nodes.clear()
        this.edges.clear()
        this.noteManager.clear()
        const normalisedData = Graph.normalizeGraphData({ nodes: nodes, edges: edges, notes: notes})
        this._setData(normalisedData?.nodes, normalisedData?.edges, normalisedData?.notes)
        this.onChange()
        this.startAndRender()
    }

    /** 
     * @private
     */
    private _setData(nodes: Array<Node>, edges: Array<Edge>, notes: Array<Note>): void {
        const changes: GraphDataChange[] = []
        nodes.forEach(node => {
            this.nodes.set(node.id, node)
            changes.push({
                type: 'node:add',
                node: node
            } as GraphDataChange)
            this.registerChildren(node)
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

        notes.forEach(note => {
            this.noteManager.addNote(note, true)
        })
    }

    /**
     * Adds a node to the graph.
     * 
     * @throws Error if a node with the same `id` already exists.
     * Triggers `onChange` after the node is successfully added.
     */
    addNode(n: RawNode | Node): Node {
        const node = Graph.normalizeNode(n)
        if (this.nodes.has(node.id)) {
            throw new Error(`Node with id ${node.id} already exists.`)
        }
        this.nodes.set(node.id, node)
        // A container's children belong to the graph too: an expanded cluster looks
        // them up by id.
        this.registerChildren(node)
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
        const edge = Graph.normalizeEdge(e, this.nodes)

        if (!edge) {
            throw new Error('Either of the from or to nodes do not exist')
        }
        if (this.edges.has(edge.id)) {
            throw new Error(`Edge with id ${edge.id} already exists.`)
        }
        const from = this.nodes.get(edge.from.id)
        const to = this.nodes.get(edge.to.id)
        if (!from || !to) {
            throw new Error('Both nodes must exist in the graph before adding an edge.')
        }
        // An Edge instance remembers endpoint *objects*, and the graph may hold other
        // ones under those ids: a node dropped and re-created — a pivot replayed from
        // its raw data on redo — is a new object, and an edge left pointing at the old
        // one hangs off something nothing moves again.
        edge.bindEndpoints(from, to)
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
        return Array.from(this.nodes.values())
            .filter((node: Node) => !node.isChild)
            .map((node: Node) => node.clone())
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
            // .filter((node: Node) => !node.isChild)
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
        return this.getMutableNodes().filter(node => node.visible)

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
        return Array.from(this.edges.values())
            .map((edge: Edge) => edge.clone())
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
     * Retrieves all visible edges in the graph.
     * 
     * Returns the actual edge instances, allowing direct modifications.
     * 
     * @remarks
     * ⚠️ **Warning:** Modifying edges directly may lead to unexpected behavior.
     * Use {@link getEdges} instead to work with safe clones.
     * 
     * @returns An array of `Edge` objects.
     */
    getMutableVisibleEdges(): Edge[] {
        return this.getMutableEdges().filter(edge => edge.visible)
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

    getNotes(): Note[] {
        return this.noteManager.getNotes()
    }

    getNote(id: string): Note | undefined {
        return this.noteManager.getNote(id)
    }

    /**
     * Adds a note to the graph and draws it. Takes the same options as `data.notes`
     * (what {@link Note.toJSON} returns), or a `Note`. Emits `noteAdd`.
     *
     * @throws Error if a note with the same `id` already exists.
     * @returns the note, or `undefined` while `UI.notes.enabled` is `false`.
     */
    addNote(n: NoteOptions | Note): Note | undefined {
        const note = Graph.normalizeNote(n)
        if (!note) return undefined
        if (this.noteManager.hasNote(note.id)) {
            throw new Error(`Note with id ${note.id} already exists.`)
        }
        return this.noteManager.addNote(note) ? note : undefined
    }

    /**
     * Replaces the graph's notes, leaving nodes and edges alone. Notes are matched by
     * id: one already on the canvas is updated in place, so its drawing stays bound
     * to it, one not in `notes` is removed, and a new one is added.
     *
     * @throws Error if two entries share an id. Nothing is changed then.
     * @returns the notes now on the graph, in the order given.
     */
    setNotes(notes: Array<NoteOptions | Note>): Note[] {
        const ids = new Set<string>()
        for (const n of notes) {
            if (n.id === undefined) continue
            if (ids.has(n.id)) throw new Error(`Note id ${n.id} appears twice.`)
            ids.add(n.id)
        }
        return this.batchChanges(() => {
            for (const note of this.noteManager.getNotes()) {
                if (!ids.has(note.id)) this.noteManager.removeNote(note)
            }
            const result: Note[] = []
            for (const n of notes) {
                const existing = n.id !== undefined ? this.noteManager.getNote(n.id) : undefined
                if (existing) {
                    if (existing !== n) this.updateNote(existing, n instanceof Note ? n.toJSON() : n)
                    result.push(existing)
                } else {
                    const added = this.addNote(n)
                    if (added) result.push(added)
                }
            }
            return result
        })
    }

    /**
     * Make `note` what `new Note(options)` would be, keeping the instance. Emits
     * `noteChange` only when something changed.
     */
    private updateNote(note: Note, options: NoteOptions): void {
        const next = new Note({ ...options, id: note.id }, note.domID)
        const moved = note.x !== next.x || note.y !== next.y
        const drawn = ['width', 'height', 'content', 'color', 'surface'] as const
        const bodyChanged = drawn.some(field => note[field] !== next[field])
        const before = note.getAttachedElement()
        const after = next.getAttachedElement()
        const attachmentChanged = before?.type !== after?.type || before?.id !== after?.id
        if (!moved && !bodyChanged && !attachmentChanged) return

        // A move needs no rebuild: every render tick places notes from x and y.
        note.setPosition(next.x, next.y)
        note.setSize(next.width, next.height)
        note.content = next.content
        note.color = next.color
        note.surface = next.surface
        if (attachmentChanged) note.setAttachedElement(after ? { ...after } : undefined)
        if (bodyChanged) {
            note.markDirty()
            // A rebuild draws the link too; while editing there is no rebuild, so the
            // link refreshes on its own.
            if (!note.isEditing()) note.clearAttachmentDirty()
        }
        this.noteManager.editNote(note)
    }

    /**
     * Would this edge count, if `visibleIds` were the visible top-level nodes? The
     * endpoint reasons only: layers are a separate veto (`layerVisible`), and where a
     * closed cluster puts the line is {@link ClusterProjection}'s concern.
     *
     * Asked by {@link setVisibleNodes} as it commits, so the flag agrees with the
     * projection's own test.
     * @private
     */
    edgeWouldBeVisible(edge: Edge, visibleIds: Set<string>): boolean {
        return this.projection.edgePasses(edge, (node) => visibleIds.has(node.id))
    }

    /**
     * Returns whether anything moved, so an edge-only filter change can repaint itself.
     * `notify` is off for the query engine's first pass, which runs before anything is
     * drawn — the constructor's own `simulation.update()` / `renderer.init()` follow it.
     */
    setVisibleNodes(nodes: Node[], notify = true): boolean {
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
            const shouldBeVisible = this.edgeWouldBeVisible(edge, visibleSet)
            // Compared against `visibleIgnoringLayer`, not `visible`: this decides the
            // endpoint reason only, and an edge already dark because its layer is off
            // must not be reported as a change on every reapplication.
            if (edge.visibleIgnoringLayer !== shouldBeVisible) {
                edge.toggleVisibility(shouldBeVisible)
                changed = true
            }
        })

        if (changed && notify) this.onChange()
        return changed
    }

    /**
     * Repaint after an edge-layer change. Deliberately not {@link onChange}: layers
     * don't touch the link force (see `Simulation.getActiveEdges`), so restarting the
     * simulation would move the graph for no reason.
     */
    edgeVisibilityChanged() {
        this.renderer?.update(true)
        this.renderer?.nextTick()
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
        this.simplify.destroy()
        this.pivots.destroy()
        // Stop ticking before the DOM it renders into goes away.
        this.simulation.destroy()
        this.UIManager.destroy()
        this.renderer.destroy()
    }

    /**
     * The ID of the app
     */
    getAppID(): string {
        return this.app_id
    }

    /**
     * @private
     * Set the parent graph instance if this instance is nested as a subgraph
     */
    public setParentGraph(parentGraph: Graph): void {
        this.parentGraph = parentGraph
    }

    /**
     * @private
     * Set the parent graph instance if this instance is nested as a subgraph
     */
    public getParentGraph(): Graph | undefined {
        return this.parentGraph
    }

    /** @private The graph at the top of the nesting, whose canvas draws every edge. */
    public getRootGraph(): Graph {
        return this.parentGraph ? this.parentGraph.getRootGraph() : this
    }

    /**
     * @private
     * Recompute what the canvas draws and pulls from the real edges and the open clusters.
     * Run by the root renderer before each redraw; a nested graph has nothing to project.
     */
    public refreshProjection(): void {
        if (this.parentGraph) return
        const regrouped = this.simplify.recompute()
        this.projection.refresh()
        // A redraw outside onChange (a note attached, say) still has to hand the simulation
        // its new set of nodes; onChange does that itself right after.
        if (regrouped && !this.changing && this.simulation) queueMicrotask(() => this.simulation.update())
    }

    /**
     * @private
     * The nodes the main canvas draws: the top-level nodes that pass the filters and are
     * not folded, and the closed groups standing in for the folded ones. A nested graph
     * draws its own nodes only.
     */
    public getCanvasNodes(): Node[] {
        const nodes = this.getMutableNodes().filter(node => node.onCanvas)
        if (this.parentGraph) return nodes
        return [...nodes, ...this.simplify.getDrawnGroups()]
    }

    /** @private A node of this graph, or a group the main canvas draws, by id. */
    public getCanvasNode(id: string): Node | undefined {
        return this.nodes.get(id) ?? (this.parentGraph ? undefined : this.simplify.getGroupNode(id))
    }

    /** @private Whether both real ends of this edge pass the filters. */
    public edgeCounts(edge: Edge): boolean {
        return this.projection.edgePasses(edge, (node) => node.visible)
    }

    /**
     * @private
     * The edges the canvas draws: real edges, and stand-ins for the ones whose ends are
     * folded into closed clusters. Only the root graph draws edges; a nested graph returns none.
     */
    public getDrawnEdges(): Edge[] {
        return this.parentGraph ? [] : this.projection.getDrawnEdges()
    }

    /**
     * @private
     * The lines the canvas would draw if `topVisible` said which top-level nodes are
     * shown. Pure, so the filters can ask before they commit.
     */
    public projectLines(topVisible: TopVisible): ProjectedLine[] {
        return this.projection.project(topVisible)
    }

    /** @private The line the canvas draws for this real edge, a stand-in when its ends are folded. */
    public getDrawnLine(edge: Edge): Edge | undefined {
        return this.parentGraph ? undefined : this.projection.getDrawnLine(edge)
    }

    /** @private The drawn edges ending on any of these nodes. */
    public getDrawnEdgesTouching(nodes: Node[]): Edge[] {
        return this.parentGraph ? [] : this.projection.getDrawnEdgesTouching(nodes)
    }

    /** @private The physics pulls between this graph's own nodes, from the root projection. */
    public getClusterPulls(): ClusterPull[] {
        const root = this.getRootGraph()
        return root.projection.getPulls(this.parentGraph ? (this.clusterOwner ?? null) : null)
    }

    /**
     * @private
     * The object the canvas draws for this node: itself on the main canvas, otherwise its
     * copy in the nested graph of the open cluster holding it.
     */
    public getDrawnCopy(node: Node): Node {
        let graph: Graph = this.getRootGraph()
        for (const ancestor of node.ancestorChain()) {
            const nested = graph.getMutableNode(ancestor.id)?.getSubgraph()
            if (!nested) return node
            graph = nested
        }
        return graph.getMutableNode(node.id) ?? node
    }

    public getGraphDepth(): number {
        return this.graphDepth
    }

    /**
     * @private
     */
    updateLayoutProgress(progress: number, elapsedTime: number, progressType: ProgressType): void {
        this.renderer?.updateLayoutProgress(progress, elapsedTime, progressType)
    }

    /**
     * Brings the specified node or edge into focus within the graph view. A node hidden in
     * a closed cluster or group brings that cluster or group into focus.
     *
     * @param element The `Node` or `Edge` to focus.
     */
    focusElement(element: Node | Edge | Note): void {
        this.renderer.focusElement(element)
    }

    /**
     * Selects a given node or edge in the graph. A node hidden in a closed cluster or group
     * is still the one selected; the canvas lights the cluster or group drawn for it.
     *
     * @param element The `Node` or `Edge` to select.
     */
    selectElement(element: Node | Edge): void {
        if (element instanceof Edge) {
            this.renderer.getGraphInteraction().selectEdge(element.getGraphElement(), element)
        } else if (element instanceof Node) {
            this.renderer.getGraphInteraction().selectNode(element.getGraphElement(), element)
        }
    }

    /**
     * Selects several nodes, or several edges, replacing the current selection — the
     * plural {@link selectElement}, resolving each element's rendered handle for you.
     *
     * Nodes and edges cannot be selected together (the interaction layer clears one kind
     * when the other is set), so a mixed array selects the **nodes** and warns.
     *
     * @param elements The `Node`s or `Edge`s to select. An empty array clears the selection.
     */
    selectElements(elements: Array<Node | Edge>): void {
        const interaction = this.renderer.getGraphInteraction()
        if (elements.length === 0) return interaction.unselectAll()

        const nodes = elements.filter((element): element is Node => element instanceof Node)
        const edges = elements.filter((element): element is Edge => element instanceof Edge)

        if (nodes.length && edges.length) {
            console.warn('Pivotick: selectElements cannot select nodes and edges together; selecting the nodes only.')
        }

        if (nodes.length) {
            interaction.selectNodes(nodes.map(node => ({ node, element: node.getGraphElement() })))
        } else if (edges.length) {
            interaction.selectEdges(edges.map(edge => [edge, edge.getGraphElement()] as [Edge, unknown]))
        }
    }

    /**
     * Adds nodes to the current selection, leaving what is already selected in place.
     * Already-selected nodes are ignored.
     *
     * Nodes only: the interaction layer has no additive setter for edges, which can only
     * be selected as a whole set via {@link selectElements}.
     *
     * @param nodes The `Node`s to add.
     */
    addToSelection(nodes: Node[]): void {
        this.renderer.getGraphInteraction()
            .addNodesToSelection(nodes.map(node => ({ node, element: node.getGraphElement() })))
    }

    /**
     * Removes nodes from the current selection, leaving the rest of it in place.
     * Nodes only, on the same terms as {@link addToSelection}.
     *
     * @param nodes The `Node`s to remove.
     */
    removeFromSelection(nodes: Node[]): void {
        this.renderer.getGraphInteraction()
            .removeNodesFromSelection(nodes.map(node => ({ node, element: node.getGraphElement() })))
    }

    /**
     * Opens the data dock — the graph's rows as a sortable, selectable grid split off
     * the bottom of the canvas. `full` mode only, and only when `UI.table` allows it;
     * a no-op otherwise.
     *
     * The dock can hold panes other than the table now, so this also brings the table's
     * pane to the front: the call is named for the table and should show you one. Reach
     * for `UIManager.dock` or `activateDockTab()` to drive the region without that.
     */
    openTable(): void {
        this.UIManager.dock?.setOpen(true)
        const tableTab = this.UIManager.table?.dockTabId()
        if (tableTab) this.UIManager.activateDockTab(tableTab)
    }

    /** Closes the data dock. */
    closeTable(): void {
        this.UIManager.dock?.setOpen(false)
    }

    /** Opens the data dock if it is closed, closes it if it is open. */
    toggleTable(): void {
        this.UIManager.dock?.toggleOpen()
    }

    /**
     * Deselect all
     */
    deselectAll(): void {
        this.renderer.getGraphInteraction().unselectAll()
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

    /**
     * Remove any highligh class from any nodes or edges
     * 
     */
    clearHighlightedElements(): void {
        this.renderer.clearHighlightedElements()
    }

    /**
     * Pick a **set** of elements out of the graph: they keep the look they already have
     * while everything else on the canvas dims, until {@link clearEmphasis}. This is
     * how hovering a legend entry reads its category off the canvas.
     *
     * Where {@link highlightElement} points at one element, this describes a group.
     * Elements that aren't drawn right now are skipped, and an empty set dims nothing.
     *
     * @param elements The `Node`s and `Edge`s to emphasise.
     */
    emphasiseElements(elements: (Node | Edge)[]): void {
        this.renderer.emphasiseElements(elements)
    }

    /** End the emphasis {@link emphasiseElements} started: the canvas reads normally again. */
    clearEmphasis(): void {
        this.renderer.clearEmphasis()
    }

    /**
     * Paint what an action *would* do, and change nothing else: the elements it would
     * take away drain in place, the ones it would hide with them, and whatever it
     * would bring back is outlined where it would land.
     *
     * Where {@link emphasiseElements} reads a set out of the canvas by receding the
     * rest, a forecast answers "what happens if I click" — so the graph has to keep
     * reading normally around the few elements that would change.
     * `graph.history.preview(...)` returns one ready-made.
     */
    showForecast(forecast: GraphForecast): void {
        this.renderer.showForecast(forecast)
    }

    /** Take the forecast down. */
    clearForecast(): void {
        this.renderer.clearForecast()
    }
}
