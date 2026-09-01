import type { EdgeFullStyle, EdgeStyle, LabelStyle, PartialEdgeFullStyle } from './interfaces/RendererOptions'
import { Node } from './Node'
import { generateSafeDomId } from './utils/ElementCreation'
import { stripFunctions } from './utils/utils'
import {
    ledgerDropSource, ledgerHasSource, ledgerRevokeRun, ledgerSources, ledgerVouch,
    type SourceLedger,
} from './Provenance'

export interface EdgeData {
    [key: string]: unknown;
}

/** Serialization-safe projection of an Edge for the simulation worker — endpoints reduced to ids, so no live Node/DOM refs leak into postMessage. */
export interface SimulationEdgeDTO {
    id: string
    from: { id: string }
    to: { id: string }
    data?: EdgeData
    style?: Partial<EdgeFullStyle>
    directed: boolean | null
}

/**
 * Represents an edge (connection) between two nodes in a graph.
 */
export class Edge {
    public readonly id: string
    public from: Node
    public to: Node
    public readonly directed: boolean | null
    private data: EdgeData
    private style: Partial<EdgeFullStyle>

    visible: boolean
    /**
     * Whether this edge's layer is switched on. A veto over {@link visible}: every
     * other reason an edge is hidden (endpoints filtered out, a collapsed cluster,
     * a manual hide) is asserted through {@link show} / {@link hide}, and `show`
     * cannot bring an edge back while its layer is off.
     */
    layerVisible: boolean
    /**
     * What {@link visible} would be if every layer were on — i.e. visibility from
     * the endpoint, collapse and manual reasons alone. The simulation gates on this
     * rather than on `visible`, so switching a layer off never changes the layout.
     */
    visibleIgnoringLayer: boolean
    /**
     * For a cross-cluster stand-in: the real edges it speaks for. Stand-ins are
     * deduped by node *pair*, so one can cover several relations of several kinds;
     * it is filtered out only once every one of them is.
     */
    representedEdges?: Edge[]
    /** True if this is a synthetic edge (placeholder for collapsed cluster child) */
    isSynthetic?: boolean
    /**
     * True for the subclass of synthetic edges that stand in for a real edge whose
     * *both* endpoints are children of different clusters. Unlike the external→cluster
     * synthetic edges, these are resolved as a set (one per collapse state) by
     * {@link ClusterDrawer.resolveCrossClusterEdges} rather than the per-node toggle.
     */
    isCrossCluster?: boolean
    /** The actual child node this synthetic edge points to (for expansion logic) */
    syntheticTerminalNode?: Node
    /** For a cross-cluster synthetic edge: the real child the `from` side stands in for. */
    syntheticSourceNode?: Node
    private _original_object?: Edge
    private _subgraphFromNode?: Node
    private _subgraphToNode?: Node

    private _dirty: boolean
    /**
     * Which sources vouch for this edge, and under which runs. Absent until a pivot
     * vouches for it — an edge with no ledger came from the seed data.
     */
    private _sources?: SourceLedger
    public readonly domID: string

    /**
     * Create a new Edge instance.
     * @param id - Unique identifier for the edge
     * @param from - Source node
     * @param to - Target node
     * @param data - Optional data payload for the edge
     * @param style - Optional style for the edge
     */
    constructor(id: string, from: Node, to: Node, data?: EdgeData, style?: Partial<EdgeFullStyle>, directed: boolean | null = null, syntheticTerminalNode?: Node) {
        this.id = id
        this.domID = generateSafeDomId()
        this.from = from
        this.to = to
        this.directed = directed
        this.data = data ?? ({} as EdgeData)
        this.style = style ?? ({} as EdgeFullStyle)
        this.visible = true
        this.layerVisible = true
        this.visibleIgnoringLayer = true
        this._dirty = true
        this.isSynthetic = syntheticTerminalNode !== undefined
        this.syntheticTerminalNode = syntheticTerminalNode

        this.from.registerEdgeOut(this as Edge)
        this.to.registerEdgeIn(this as Edge)
    }

    /** Required by d3-force */
    get source(): Node {
        return this.from
    }
    get target(): Node {
        return this.to
    }

    /**
     * Get the edge's data.
     */
    getData(): EdgeData {
        return this.data
    }

    /**
     * Update the edge's data.
     * @param newData - New data to set
     */
    setData(newData: EdgeData): void {
        this.data = newData
        this.markDirty()
    }

    /**
     * Merge partial data into the current edge data.
     * @param partialData - Partial data object to merge
     */
    updateData(partialData: Partial<EdgeData>): void {
        this.data = { ...this.data, ...partialData }
        this.markDirty()
    }

    /**
     * Get the edge's style.
     */
    getStyle(): Partial<EdgeFullStyle> {
        return this.style
    }

    /**
     * Get the edge's style.
     */
    getEdgeStyle(): Partial<EdgeStyle> {
        return ((this.style as Partial<EdgeFullStyle>)?.edge) ?? {}
    }

    /**
     * Get the edge's label style if available.
     */
    getLabelStyle(): Partial<LabelStyle> {
        return ((this.style as Partial<EdgeFullStyle>)?.label) ?? {}
    }

    /**
     * Update the edge's style.
     * @param newStyle - New style to set
     */
    setStyle(newStyle: EdgeFullStyle): void {
        this.style = newStyle
        this.markDirty()
    }

    /**
     * Merge partial style into the current edge style.
     * Useful for updating only parts of the style.
     * @param partialStyle - Partial style object to merge
     */
    updateStyle(partialStyle: PartialEdgeFullStyle): void {
        const cur = this.style as Partial<EdgeFullStyle>
        const inc = partialStyle as Partial<EdgeFullStyle>
        this.style = ({
            ...cur,
            ...inc,
            edge: { ...cur.edge, ...inc.edge },
            label: { ...cur.label, ...inc.label }
        }) as Partial<EdgeFullStyle>
        this.markDirty()
    }

    getGraphElement(): SVGGElement | null {
        if (!document) return null
        return document.getElementById(`edge-${this.domID}`) as SVGGElement | null
    }
    
    setFrom(node: Node): void {
        this.from = node
    }

    setTo(node: Node): void {
        this.to = node
    }

    /**
     * Convert edge to a simple JSON object representation.
     */
    toDict(): Record<string, unknown> {
        return {
            id: this.id,
            from: this.from.id,
            to: this.to.id,
            data: this.data,
            style: this.style,
        } as Record<string, unknown>
    }

    /**
     * Structured-cloneable payload for the simulation worker; endpoints reduced to ids, keeps
     * `directed`. The style is stripped of functions — see {@link Node.toSimulationDTO}.
     */
    toSimulationDTO(): SimulationEdgeDTO {
        return {
            id: this.id,
            from: { id: this.from.id },
            to: { id: this.to.id },
            data: this.data,
            style: stripFunctions(this.style),
            directed: this.directed,
        }
    }

    clone(): Edge {
        // Shallow copies of data and style
        const clonedData = { ...this.data } as EdgeData
        const clonedStyle = { ...this.style } as EdgeFullStyle

        const clone = new Edge(
            this.id,
            this.from.clone(),
            this.to.clone(),
            clonedData,
            clonedStyle,
            this.directed
        )

        clone.visible = this.visible
        clone.layerVisible = this.layerVisible
        clone.visibleIgnoringLayer = this.visibleIgnoringLayer

        return clone
    }


    markDirty() {
        this._dirty = true
    }

    clearDirty() {
        this._dirty = false
    }

    isDirty(): boolean {
        return this._dirty
    }

    toggleVisibility(visible: boolean): void {
        if (visible) {
            this.show()
        } else {
            this.hide()
        }
        this.markDirty()
    }

    show(): void {
        this.visibleIgnoringLayer = true
        this.visible = this.layerVisible
    }

    hide(): void {
        this.visibleIgnoringLayer = false
        this.visible = false
    }

    /**
     * Switch this edge's layer on or off, re-deriving {@link visible} from the other
     * reasons it may already be hidden for. Returns whether anything changed.
     */
    setLayerVisible(layerVisible: boolean): boolean {
        if (this.layerVisible === layerVisible) return false
        this.layerVisible = layerVisible
        const nextVisible = layerVisible && this.visibleIgnoringLayer
        if (this.visible !== nextVisible) {
            this.visible = nextVisible
            this.markDirty()
        }
        return true
    }

    /**
     * Sets a reference to the original node from the main graph.
     * Used when this node is a clone in a subgraph to enable position syncing.
     * @private
     */
    setOriginalObject(obj: Edge) {
        this._original_object = obj
    }
    /**
     * Gets the reference to the original node from the main graph.
     * Returns undefined if this is not a subgraph clone.
     * @private
     */
    getOriginalObject(): Edge | undefined {
        return this._original_object
    }

    /**
     * Sets a reference to the subgraph node from the main graph.
     * Used when the FROM node has a clone in a subgraph
     * @private
     */
    setSubgraphFromNode(obj: Node) {
        this._subgraphFromNode = obj
    }
    /**
     * Sets a reference to the subgraph node from the main graph.
     * Used when the TO node has a clone in a subgraph
     * @private
     */
    setSubgraphToNode(obj: Node) {
        this._subgraphToNode = obj
    }
    /**
     * Gets the reference to the subgraph node from the main graph.
     * @private
     */
    getSubgraphFromNode(): Node | undefined {
        return this._subgraphFromNode
    }
    /**
     * Gets the reference to the subgraph node from the main graph.
     * @private
     */
    getSubgraphToNode(): Node | undefined {
        return this._subgraphToNode
    }

    // --- Provenance --------------------------------------------------------------------

    /**
     * The sources vouching for this edge — pivot ids, plus `'seed'` for data that was
     * here to begin with. Which pivot asserted a relationship is the load-bearing half
     * of provenance, so edges carry it exactly as nodes do.
     */
    getSources(): string[] {
        return ledgerSources(this._sources)
    }

    /** Whether `source` vouches for this edge. `'seed'` is true for un-pivoted data. */
    hasSource(source: string): boolean {
        return ledgerHasSource(this._sources, source)
    }

    /**
     * @private
     * Record that a pivot run vouches for this edge.
     */
    vouch(source: string, runId: string): void {
        if (!this._sources) this._sources = new Map()
        ledgerVouch(this._sources, source, runId)
    }

    /**
     * @private
     * Drop one run's vouching. Returns `true` when nothing vouches for this edge any
     * more — the caller's cue to remove it.
     */
    revokeRun(source: string, runId: string): boolean {
        return ledgerRevokeRun(this._sources, source, runId)
    }

    /**
     * @private
     * Drop a source's vouching entirely. Returns `true` when the edge is now
     * unvouched-for.
     */
    dropSource(source: string): boolean {
        return ledgerDropSource(this._sources, source)
    }
}
