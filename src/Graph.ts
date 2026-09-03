import { Node, type NodeData } from './Node'
import { Edge, type EdgeData } from './Edge'
import { createGraphRenderer } from './renderers/GraphRendererFactory'
import type { GraphRenderer, ProgressType } from './GraphRenderer'
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
import type { GraphRendererOptions } from './interfaces/RendererOptions'
import { GraphEditingManager } from './editing/GraphEditingManager'
import { NoteManager } from './NoteManager'
import { Note, type NoteOptions } from './Note'
import type { PivotickPlugin } from './interfaces/Plugin'
import { PivotManager } from './PivotManager'
import { minimap } from './plugins/minimap'

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
    private graphDepth: number
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

    private listeners: Record<keyof GraphEvents, Array<GraphEvents[keyof GraphEvents]>>
    /** Depth of nested {@link batchChanges} calls; > 0 means events are being collected. */
    private batchDepth = 0
    private batchedChanges: GraphDataChange[] = []
    private batchNeedsChange = false
    /** Subscribers to {@link onVisibleChange} — kept apart from the data event bus. */
    private changeListeners: Array<() => void> = []

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
        this.options.pivots?.forEach(pivot => this.pivots.register(pivot))
        this.UIManager = new UIManager(this, appContainer, UIManagerOptions)
        // Declared facets carry the accessor/predicate/matchMode the engine matches
        // with, so hand them over as soon as the merged UI options exist.
        this.queryEngine.setFacets(this.UIManager.getOptions().filter?.facets)
        this.queryEngine.setEdgeFacets(this.UIManager.getOptions().filter?.edgeFacets)
        this.queryEngine.setHideDisconnected(this.UIManager.getOptions().filter?.hideDisconnected === true)
        this.notifier = new Notifier(this)
        this.renderer = createGraphRenderer(this, appContainer, rendererOptions)
        this.renderer.setupRendering()

        const simulationOptions = {
            ...this.options.simulation,
            layout: this.options?.layout as LayoutOptions
        }
        this.simulation = new Simulation(this, simulationOptions)

        if (data) {
            const normalisedData = Graph.normalizeGraphData(data)
            this._setData(normalisedData?.nodes, normalisedData?.edges, normalisedData?.notes)
            // Before the layout and the first paint: a node the filters mean to hide must
            // never reach the canvas, and must not be in the graph the opening fit frames.
            this.queryEngine.applyInitialVisibility()
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
        this.renderer.fitAndCenterWhenSettled()
        this.UIManager.callGraphReady()
        this.ready()
    }

    /**
     * Normalizes graph data by:
     * 1. Building a hierarchy of nodes (including nested children)
     * 2. Creating synthetic edges for edges that point to collapsed children
     * 3. Hiding edges that connect to invisible child nodes
     *
     * Synthetic edges are placeholder edges created when an edge would point to a
     * node inside a collapsed cluster. Instead of pointing to the invisible child,
     * a synthetic edge is created pointing to the parent cluster node. When the
     * cluster is expanded, synthetic edges are hidden and actual edges are shown.
     *
     * Two shapes are synthesised:
     * - **external → collapsed child:** a synthetic edge to each ancestor cluster
     *   of the child (so it re-anchors as clusters expand).
     * - **collapsed child → collapsed child in a *different* cluster:** a single
     *   synthetic edge between the two outermost clusters, so a "collapse every
     *   group into a box" view still shows (and force-links) the box→box
     *   dependency instead of the edge vanishing. It is only shown while both
     *   clusters are collapsed; expanding either hides it (see
     *   {@link ClusterDrawer.toggleSyntheticEdges}). The re-anchored per-child edge
     *   for the partially-expanded case is not synthesised.
     *
     * @param data - The raw graph data to normalize
     * @returns Normalized graph data with synthetic edges added
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

        // Ancestor chain of a node from its immediate parent up to the outermost cluster.
        const ancestorChain = (node: Node): Node[] => {
            const chain: Node[] = []
            let cur = node.parentNode
            while (cur) { chain.push(cur); cur = cur.parentNode }
            return chain
        }

        // Generate synthetic edges for edges pointing to child in collapsed nodes
        const newEdges: Edge[] = []
        // Dedup cross-cluster stand-ins by their (representative-from, representative-to)
        // pair, keeping each one so a later real edge over the same pair can join its
        // `representedEdges` instead of being lost to the dedup.
        const crossClusterStandIns = new Map<string, Edge>()
        for (const edge of normalizedEdges) {
            if (!edge.from.isChild && edge.to.isChild && edge.to.parentNode) {

                let currentParent = edge.to.parentNode
                const visited = new Set<string>()

                while (currentParent && !visited.has(currentParent.id)) {
                    visited.add(currentParent.id)

                    const syntheticId = `synthetic-${edge.from.id}-${currentParent.id}`
                    const newEdge = new Edge(
                        syntheticId,
                        edge.from,
                        currentParent,
                        // { 'label': `${edge.from.id}-${currentParent.id}` },
                        {},
                        {},
                        null,
                        edge.to
                    )
                    if (newEdge.to.isChild) {
                        newEdge.hide()
                    }
                    // One stand-in per ancestor level, all for this one real edge — so
                    // an edge facet reads the real edge's data rather than the blank
                    // payload a synthetic carries.
                    newEdge.representedEdges = [edge]
                    newEdges.push(newEdge)

                    if (!currentParent.parentNode) break
                    currentParent = currentParent.parentNode
                }
            } else if (edge.from.isChild && edge.to.isChild) {
                // Both endpoints live inside clusters. If those clusters differ, the real
                // edge is only drawable when *both* are expanded; for every other collapse
                // state we synthesise a stand-in between the pair of nodes actually shown
                // (each endpoint's deepest visible ancestor). We pre-create the whole
                // cross-product of ancestors — one per collapse state — and let
                // ClusterDrawer.resolveCrossClusterEdges pick the visible one on toggle.
                const fromChain = [edge.from, ...ancestorChain(edge.from)]
                const toChain = [edge.to, ...ancestorChain(edge.to)]
                const fromTop = fromChain[fromChain.length - 1]
                const toTop = toChain[toChain.length - 1]
                if (fromTop.id === toTop.id) continue // same outermost cluster — intra-cluster
                // The real edge joins the family: it's the stand-in shown once both expand.
                // Tagging it hands its visibility to resolveCrossClusterEdges too (the same
                // `rep` test naturally yields "shown only when both fully expanded").
                edge.isCrossCluster = true
                edge.syntheticSourceNode = edge.from
                edge.syntheticTerminalNode = edge.to
                for (const f of fromChain) {
                    for (const t of toChain) {
                        if (f === edge.from && t === edge.to) continue // that's the real edge, tagged above
                        const syntheticId = `synthetic-${f.id}-${t.id}`
                        const existing = crossClusterStandIns.get(syntheticId)
                        if (existing) {
                            existing.representedEdges?.push(edge)
                            continue
                        }
                        const newEdge = new Edge(syntheticId, f, t, {}, {}, edge.directed, edge.to)
                        newEdge.isCrossCluster = true
                        newEdge.syntheticSourceNode = edge.from
                        newEdge.representedEdges = [edge]
                        crossClusterStandIns.set(syntheticId, newEdge)
                        newEdges.push(newEdge)
                    }
                }
            }
        }

        normalizedEdges.push(...newEdges)
        // Pick which stand-in (or the real edge) is shown for the current collapse state.
        Graph.resolveCrossClusterEdges(normalizedEdges)

        const normalisedNotes: Note[] = (data.notes ?? []).map((n) => Graph.normalizeNote(n))
            .filter((n): n is Note => n !== null)

        return {
            nodes: normalizedNodes,
            edges: normalizedEdges,
            notes: normalisedNotes,
        }
    }

    /**
     * Shows exactly the cross-cluster stand-in edge that matches the current collapse
     * state, and hides the rest. For a real child→child edge across two clusters we
     * pre-create one synthetic edge per (from-representative, to-representative) pair
     * (see {@link normalizeGraphData}); this picks the one whose endpoints are the
     * nodes actually rendered right now — each endpoint's *deepest visible ancestor*
     * (itself if every ancestor is expanded, otherwise the outermost collapsed box).
     * When both clusters are fully expanded no stand-in matches and the real edge is
     * drawn by the subgraphs instead. Called on load and on every expand/collapse.
     * @private
     */
    public static resolveCrossClusterEdges(edges: Edge[]): void {
        for (const edge of edges) {
            if (!edge.isCrossCluster || !edge.syntheticSourceNode || !edge.syntheticTerminalNode) continue
            const shouldShow =
                edge.from === edge.syntheticSourceNode.canvasRepresentative() &&
                edge.to === edge.syntheticTerminalNode.canvasRepresentative()
            if (edge.visibleIgnoringLayer !== shouldShow) {
                if (shouldShow) edge.show()
                else edge.hide()
            }
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
    public static normalizeChildren(children: RawNode[]): Node[] {
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
     * Normalizes an edge, hiding it if it connects to a child node in a collapsed cluster.
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

        if (fromNode.isChild || toNode.isChild) {
            normEdge.hide()
        }
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
    public unionChildren(parent: Node, children: RawNode[]): Node[] {
        const added = parent.unionChildren(Graph.normalizeChildren(children))
        if (!added.length) return added
        for (const child of added) this.nodes.set(child.id, child)
        this.dataBatchChanged(added.map(child => ({ type: 'node:add', node: child } as GraphDataChange)))
        this.onChange()
        return added
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
     * @param source A pivot id, or `'seed'` for data that was never pivoted.
     * @returns What was actually removed.
     */
    public removeBySource(source: string): { nodes: Node[], edges: Edge[] } {
        const nodes: Node[] = []
        const edges: Edge[] = []
        this.batchChanges(() => {
            for (const edge of [...this.edges.values()]) {
                if (!edge.hasSource(source)) continue
                if (!edge.dropSource(source)) continue
                edges.push(edge)
                this.removeEdge(edge.id)
            }
            for (const node of [...this.nodes.values()]) {
                if (!node.hasSource(source)) continue
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
        this.renderer?.update(true)
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
                        previousData: this.edges.get(newEdge.id)?.getData(),
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
        const recurseAddChildren = (node: Node) => {
            node.children.forEach((child: Node) => {
                this.nodes.set(child.id, child)
                if (child.hasChildren()) {
                    recurseAddChildren(child)
                }
            })
        }

        const changes: GraphDataChange[] = []
        nodes.forEach(node => {
            this.nodes.set(node.id, node)
            changes.push({
                type: 'node:add',
                node: node
            } as GraphDataChange)
            recurseAddChildren(node)
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
        // A container's children belong to the graph too — `_setData` has always
        // registered them, and an expanded cluster looks its children up by id.
        for (const child of node.descendants()) this.nodes.set(child.id, child)
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
        // its raw data on redo, an `updateData` — is a new object, and an edge left
        // pointing at the old one hangs off something nothing moves again.
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
     * Would this edge be drawn, if `visibleIds` were the visible nodes? The endpoint,
     * collapse and synthetic reasons only — layers are a separate veto (`layerVisible`).
     *
     * Asked twice: once by {@link setVisibleNodes} as it commits, and once by the query
     * engine *before* it commits, to find the nodes a filter left with no relation. Both
     * ask here so there is one copy of the answer. A cross-cluster stand-in is not
     * answerable — `resolveCrossClusterEdges` owns those — so callers handle them.
     * @private
     */
    edgeWouldBeVisible(edge: Edge, visibleIds: Set<string>): boolean {
        // A subgraph endpoint belongs to another graph, so it can only be read as it
        // stands; `from` / `to` are this graph's and are read off the candidate set.
        const endVisible = (subgraphNode: Node | undefined, endpoint: Node): boolean =>
            subgraphNode ? subgraphNode.visible : visibleIds.has(endpoint.id)

        const bothEndVisible = endVisible(edge.getSubgraphFromNode(), edge.from) &&
            endVisible(edge.getSubgraphToNode(), edge.to)
        const isValidSynthetic = !edge.isSynthetic || !edge.to.expanded
        return bothEndVisible && isValidSynthetic
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
            // Cross-cluster stand-ins are owned by resolveCrossClusterEdges (expansion
            // state), not by node visibility — leave their visibility as it set it.
            if (edge.isCrossCluster) return

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
     * Brings the specified node or edge into focus within the graph view.
     * 
     * @param element The `Node` or `Edge` to focus.
     */
    focusElement(element: Node | Edge | Note): void {
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
}
