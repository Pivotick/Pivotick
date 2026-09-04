import type { Edge } from './Edge'
import type { Graph } from './Graph'
import { SUMMARY_POTENTIAL } from './interfaces/Pivot'
import type { NodeStyle } from './interfaces/RendererOptions'
import { generateSafeDomId } from './utils/ElementCreation'
import { rectRadiusAlongDirection } from './utils/GeometryHelper'
import { stripFunctions } from './utils/utils'
import {
    ledgerClone, ledgerDropSource, ledgerHasSource, ledgerRevokeRun, ledgerSources, ledgerVouch,
    type SourceLedger,
} from './Provenance'

export interface NodeData {
    [key: string]: unknown;
}

/** Half-extents of a node's rectangular border, measured from its centre. */
export interface NodeBorderBox {
    halfWidth: number
    halfHeight: number
}

/** Serialization-safe, layout-only projection of a Node for the simulation worker — no parentNode/children/_subgraph, so postMessage can always clone it. */
export interface SimulationNodeDTO {
    id: string
    data: NodeData
    style: Partial<NodeStyle>
    weight?: number
    _circleRadius: number
    x?: number
    y?: number
    vx?: number
    vy?: number
    fx?: number
    fy?: number
}

/**
 * Represents a single node (vertex) in a graph.
 */
export class Node {
    public readonly id: string
    private data: NodeData
    public children: Node[]
    private style: Partial<NodeStyle>
    private edgesOut: Set<Edge>
    private edgesIn: Set<Edge>
    public defaultCircleRadius = 10

    // Layout/physics properties
    x?: number
    y?: number
    vx?: number
    vy?: number
    fx?: number
    fy?: number
    weight?: number
    frozen?: boolean
    visible: boolean
    expanded?: boolean
    /** True if this node is a child within a collapsed cluster */
    isChild: boolean
    childrenDepth: number
    /** True if this node has child nodes */
    isParent: boolean
    /** Reference to the parent cluster node (if this node is a child) */
    parentNode?: Node
    /**
     * Reference to the main graph node when this node is a clone in a subgraph.
     * Used for syncing position updates from subgraph back to main graph.
     */
    private _original_object?: Node
    /**
     * Reference to the deepest sub graph node.
     * Used for checking state of this node in its subgraph
     */
    private _deepest_node_clone?: Node
    /** The subgraph graph instance created when expanding this node */
    private _subgraph?: Graph
    private _circleRadius = this.defaultCircleRadius
    private _circleRadiusCollapsed = this.defaultCircleRadius
    /** Measured rectangular border; unset means the node is anchored as a circle. */
    private _border?: NodeBorderBox
    private _dirty: boolean
    /**
     * Which sources vouch for this node, and under which runs. Absent until a pivot
     * vouches for it — a node with no ledger came from the seed data.
     */
    private _sources?: SourceLedger
    /** Potential a data source *declared* on this node, per pivot id. */
    private _potential?: Map<string, number>
    public readonly domID: string

    /**
     * Create a new Node instance.
     * @param id - Unique identifier for the node
     * @param data - Optional data payload associated with the node
     */
    constructor(id: string, data?: NodeData, style?: Partial<NodeStyle>, domID: string = generateSafeDomId(), children: Node[] = []) {
        this.id = id
        this.domID = domID
        this.data = data ?? ({} as NodeData)
        this.style = style ?? ({} as Partial<NodeStyle>)
        this.children = []
        this.isParent = false
        this.setChildren(children)
        this._dirty = true
        this.frozen = false
        this.visible = true
        this.expanded = false
        this.isChild = false
        this.childrenDepth = 0
        this.edgesOut = new Set()
        this.edgesIn = new Set()
    }

    /**
     * Get the node's data.
     */
    getData(): NodeData {
        return this.data
    }

    /**
     * Update the node's data.
     * @param newData - New data to set
     */
    setData(newData: NodeData): void {
        this.data = newData
        this.markDirty()
    }

    /**
     * Merge partial data into the current node data.
     * Useful for updating only parts of the data.
     * @param partialData - Partial data object to merge
     */
    updateData(partialData: Partial<NodeData>): void {
        this.data = { ...this.data, ...partialData }
        this.markDirty()
    }

    /**
     * @private
     */
    registerEdgeOut(edge: Edge): void {
        this.edgesOut.add(edge)
    }

    /**
     * @private
     */
    registerEdgeIn(edge: Edge): void {
        this.edgesIn.add(edge)
    }

    /**
     * @private
     * Stop counting this edge — for one re-pointed away from this node, which would
     * otherwise keep inflating its degree and its neighbour list.
     */
    unregisterEdge(edge: Edge): void {
        this.edgesOut.delete(edge)
        this.edgesIn.delete(edge)
    }

    /**
     * @private
     */
    emptyEdges(): void {
        this.edgesOut.clear()
        this.edgesIn.clear()
    }

    getConnectedNodes(): Node[] {
        return [...this.edgesOut].map(edge => {
            return edge.to
        })
    }

    getConnectingNodes(): Node[] {
        return [...this.edgesIn].map(edge => {
            return edge.from
        })
    }

    getEdgesOut(): Edge[] {
        return [...this.edgesOut]
    }

    getEdgesIn(): Edge[] {
        return [...this.edgesIn]
    }

    /**
     * Get the node's data.
     */
    getStyle(): Partial<NodeStyle> {
        return this.style
    }

    /**
     * Update the node's data.
     * @param newStyle - New data to set
     */
    setStyle(newStyle: Partial<NodeStyle>): void {
        this.style = newStyle
        this.markDirty()
    }

    /**
     * Merge partial data into the current node data.
     * Useful for updating only parts of the data.
     * @param partialStyle - Partial data object to merge
     */
    updateStyle(partialStyle: Partial<NodeStyle>): void {
        this.style = { ...this.style, ...partialStyle }
        this.markDirty()
    }

    getGraphElement(): SVGGElement | null {
        if (!document) return null
        return document.getElementById(`node-${this.domID}`) as SVGGElement | null
    }

    /**
     * Convert node to a simple JSON object representation.
     * @param dataOnly - default: false
     */
    toDict(dataOnly = false): Record<string, unknown> {
        const obj: Record<string, unknown> = {
            id: this.id,
            data: this.data,
            style: this.style,
            weight: this.weight,
            // expanded: this.expanded,
        }
        if (!dataOnly) {
            obj.x = this.x
            obj.y = this.y
            obj.vx = this.vx
            obj.vy = this.vy
            obj.fx = this.fx
            obj.fy = this.fy
        }

        if (this.hasChildren()) {
            obj.children = this.children.map((n) => n.toDict(dataOnly))
        }
        return obj
    }

    /**
     * Structured-cloneable payload for the simulation worker (no live parent/children/_subgraph
     * refs, unlike `clone()`). The style is stripped of functions: every resolvable channel may
     * hold one, and no force reads them, so sending them only risks a `DataCloneError`.
     */
    toSimulationDTO(): SimulationNodeDTO {
        return {
            id: this.id,
            data: this.data,
            style: stripFunctions(this.style),
            weight: this.weight,
            _circleRadius: this._circleRadius,
            x: this.x,
            y: this.y,
            vx: this.vx,
            vy: this.vy,
            fx: this.fx,
            fy: this.fy,
        }
    }

    clone(): Node {
        // Shallow clone (deep optional below)
        const clonedData = { ...this.data }
        const clonedStyle = { ...this.style }

        const clone = new Node(this.id, clonedData, clonedStyle)

        // Copy layout/physics properties
        clone.x = this.x
        clone.y = this.y
        clone.vx = this.vx
        clone.vy = this.vy
        clone.fx = this.fx
        clone.fy = this.fy
        clone.weight = this.weight
        clone.frozen = this.frozen
        clone.visible = this.visible
        clone.expanded = this.expanded
        clone.isChild = this.isChild
        clone.childrenDepth = this.childrenDepth
        clone.isParent = this.isParent
        clone.parentNode = this.parentNode
        clone._circleRadius = this._circleRadius
        clone.children = this.children.map((n) => n.clone())
        if (this._sources) clone._sources = new Map([...this._sources].map(([s, r]) => [s, [...r]]))
        if (this._potential) clone._potential = new Map(this._potential)

        return clone
    }

    /**
     * @private
     */
    markDirty() {
        this._dirty = true
    }

    /**
     * @private
     */
    clearDirty() {
        this._dirty = false
    }
    /**
     * @private
     */
    isDirty(): boolean {
        return this._dirty
    }

    freeze(): void {
        this.frozen = true
        this.fx = this.x
        this.fy = this.y
    }

    unfreeze(): void {
        this.frozen = false
        this.fx = undefined
        this.fy = undefined
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
        this.visible = true
    }

    hide(): void {
        this.visible = false
    }

    toggleExpand(expanded?: boolean): void {
        if (expanded === undefined) {
            if (this.expanded) {
                this.collapse()
            } else {
                this.expand()
            }
        } else {
            if (expanded) {
                this.expand()
            } else {
                this.collapse()
            }
        }
        this.markDirty()
    }

    expand(): void {
        this.expanded = true
        if (this._original_object) {
            this._original_object.expanded = true
        }
    }

    collapse(): void {
        this.expanded = false
        if (this._original_object) {
            this._original_object.expanded = false
        }
    }

    degree(): number {
        return this.edgesOut.size + this.edgesIn.size
    }

    /** The node's clusters, outermost first — empty for a node of the root graph. */
    ancestorChain(): Node[] {
        const chain: Node[] = []
        let current = this.parentNode
        while (current) {
            chain.unshift(current)
            current = current.parentNode
        }
        return chain
    }

    /**
     * The node the canvas actually draws for this one: itself when every cluster above it
     * is expanded, otherwise the outermost collapsed cluster — the box hiding it.
     *
     * This answers "which dot on screen stands for this node", not "is it visible": an
     * expanded cluster renders a *separate* subgraph built from `toDict()` data, so a
     * nested node is never drawn by this graph even when its cluster is open.
     */
    canvasRepresentative(): Node {
        for (const ancestor of this.ancestorChain()) {
            if (!ancestor.expanded) return ancestor
        }
        return this
    }

    /**
     * Set the node's circle radius. Also drops any measured rectangular border:
     * the radius is the coarser fact, so every caller that resizes a node keeps
     * anchoring correct by default, and only the drawers that know the rendered
     * shape opt back in through {@link setBorderBox}.
     */
    setCircleRadius(radius: number): void {
        this._circleRadius = radius
        this._border = undefined
    }

    getCircleRadius(): number {
        return this._circleRadius
    }

    setCircleRadiusCollapsed(radius: number): void {
        this._circleRadiusCollapsed = radius
    }

    getCircleRadiusCollapsed(): number {
        return this._circleRadiusCollapsed
    }

    /**
     * Declare that the node's border is the centred `width`×`height` rectangle it
     * actually renders as, so edges stop on it instead of on the bounding circle.
     * Call it *after* {@link setCircleRadius}, which clears it.
     */
    setBorderBox(width: number, height: number): void {
        this._border = { halfWidth: width / 2, halfHeight: height / 2 }
    }

    /**
     * The node's rectangular border grown by `outset`, or `undefined` when the
     * node is anchored as a circle.
     */
    getBorderBox(outset = 0): NodeBorderBox | undefined {
        if (!this._border) return undefined
        return { halfWidth: this._border.halfWidth + outset, halfHeight: this._border.halfHeight + outset }
    }

    /**
     * Distance from the node's centre to its border along the unit direction
     * `(dirX, dirY)`, grown by `outset` — where an edge leaving in that direction
     * should start. Rectangular for a measured node, the circle radius otherwise.
     * Deliberately free of style resolution: this runs for both ends of every
     * edge on every tick.
     */
    getBorderDistance(dirX: number, dirY: number, outset = 0): number {
        const border = this._border
        if (!border) return this._circleRadius + outset
        return rectRadiusAlongDirection(border.halfWidth + outset, border.halfHeight + outset, dirX, dirY)
    }

    // --- Provenance and declared potential ---------------------------------------------

    /**
     * The sources vouching for this node — pivot ids, plus `'seed'` for data that
     * was here to begin with. A node can be vouched for by several pivots at once,
     * and `graph.removeBySource` deletes it only when the last one goes.
     */
    getSources(): string[] {
        return ledgerSources(this._sources)
    }

    /** Whether `source` vouches for this node. `'seed'` is true for un-pivoted data. */
    hasSource(source: string): boolean {
        return ledgerHasSource(this._sources, source)
    }

    /**
     * @private
     * Record that a pivot run vouches for this node.
     */
    vouch(source: string, runId: string): void {
        if (!this._sources) this._sources = new Map()
        ledgerVouch(this._sources, source, runId)
    }

    /**
     * @private
     * Drop one run's vouching. Returns `true` when nothing vouches for this node any
     * more — the caller's cue to remove it.
     */
    revokeRun(source: string, runId: string): boolean {
        return ledgerRevokeRun(this._sources, source, runId)
    }

    /**
     * @private
     * Drop a source's vouching entirely. Returns `true` when the node is now
     * unvouched-for.
     */
    dropSource(source: string): boolean {
        return ledgerDropSource(this._sources, source)
    }

    /**
     * @private
     * A copy of the vouching, for a history preview to play against.
     */
    cloneLedger(): SourceLedger {
        return ledgerClone(this._sources)
    }

    /**
     * Declare how much more there is for this node, without asking for any of it —
     * what the rim badge shows. `0` clears the declaration.
     *
     * With a pivot id it is that pivot's number, and its badge opens that pivot. With
     * a count alone it is the total across everything, which is the number the
     * `'summary'` rim badge prefers — the one to declare when there are more providers
     * than a rim could ever name.
     *
     * Marks the node dirty like every other setter here, so the badge appears on the
     * next render — call `graph.renderer.update()` if nothing else is about to.
     *
     * ```ts
     * node.setPotential('correlations', 2143) // this provider has this much
     * node.setPotential(2199)                 // everything has this much
     * ```
     */
    setPotential(count: number): void
    setPotential(pivotId: string, count: number): void
    setPotential(pivotIdOrCount: string | number, maybeCount?: number): void {
        const pivotId = typeof pivotIdOrCount === 'string' ? pivotIdOrCount : SUMMARY_POTENTIAL
        const count = typeof pivotIdOrCount === 'string' ? (maybeCount ?? 0) : pivotIdOrCount
        if (!count) {
            this._potential?.delete(pivotId)
            if (this._potential?.size === 0) this._potential = undefined
            this.markDirty()
            return
        }
        if (!this._potential) this._potential = new Map()
        this._potential.set(pivotId, count)
        this.markDirty()
    }

    /**
     * The potential declared for one pivot, or — with no argument — the total declared
     * for no particular pivot. `undefined` when none was.
     */
    getPotential(pivotId: string = SUMMARY_POTENTIAL): number | undefined {
        return this._potential?.get(pivotId)
    }

    /** Every declared potential on this node, keyed by pivot id. */
    getPotentials(): Map<string, number> {
        return new Map(this._potential ?? [])
    }

    setChildren(children: Node[]): void {
        this.children = children
        if (this.hasChildren()) {
            this.isParent = true
        } else {
            this.isParent = false
        }
    }

    /**
     * Merge `children` in by id: new ones are added, matching ones are left
     * untouched — their own children merged in turn — and none are ever removed. The
     * union is how a pivot re-discovering a container adds what it found without
     * disturbing what is already there.
     *
     * @returns every node newly added, at any depth, so the caller can register and
     * tag them.
     */
    unionChildren(children: Node[]): Node[] {
        const added: Node[] = []
        const byId = new Map(this.children.map(child => [child.id, child]))
        for (const incoming of children) {
            const existing = byId.get(incoming.id)
            if (existing) {
                // An id match keeps what is already there; only new structure travels.
                added.push(...existing.unionChildren(incoming.children))
                continue
            }
            this.children.push(incoming)
            this.claim(incoming)
            byId.set(incoming.id, incoming)
            added.push(incoming, ...incoming.descendants())
        }
        this.isParent = this.hasChildren()
        this.markDirty()
        return added
    }

    /**
     * Drop one child, and its own subtree with it. Returns the removed child so the
     * caller can clean up after its descendants.
     */
    removeChildById(id: string): Node | undefined {
        const index = this.children.findIndex(child => child.id === id)
        if (index < 0) return undefined
        const [child] = this.children.splice(index, 1)
        this.isParent = this.hasChildren()
        if (!this.isParent) this.expanded = false
        this.markDirty()
        return child
    }

    /** Every node below this one, depth first. */
    descendants(): Node[] {
        return this.children.flatMap(child => [child, ...child.descendants()])
    }

    /**
     * Mark a subtree as ours: the parent link, the depth and the hidden state a
     * collapsed cluster's contents carry.
     */
    private claim(child: Node): void {
        child.markAsChild(this, this.childrenDepth + 1)
        child.hide()
        for (const grandchild of child.children) child.claim(grandchild)
    }

    hasChildren(): boolean {
        return this.children.length > 0
    }

    markAsChild(parentNode: Node, childrenDepth: number): void {
        this.isChild = true
        this.childrenDepth = childrenDepth
        this.parentNode = parentNode
    }

    markAsParent(): void {
        this.isParent = true
    }

    /**
     * Sets the subgraph instance (when opening a cluster).
     * @private
     */
    setSubgraph(subgraph: Graph) {
        this._subgraph = subgraph
    }
    /**
     * Gets the subgraph instance created from this node.
     * Returns undefined if this node didn't created a subgraph.
     * @private
     */
    getSubgraph(): Graph | undefined {
        return this._subgraph
    }

    /**
     * Sets a reference to the original node from the main graph.
     * Used when this node is a clone in a subgraph to enable position syncing.
     * @private
     */
    setOriginalObject(obj: Node) {
        this._original_object = obj
    }
    /**
     * Gets the reference to the original node from the main graph.
     * Returns undefined if this is not a subgraph clone.
     * @private
     */
    getOriginalObject(): Node | undefined {
        return this._original_object
    }

    /**
     * Sets a reference to the original node from the main graph.
     * Used when this node is a clone in a subgraph to enable position syncing.
     * @private
     */
    setDeepestNodeClone(obj: Node) {
        this._deepest_node_clone = obj
    }
    /**
     * Gets the reference to the original node from the main graph.
     * Returns undefined if this is not a subgraph clone.
     * @private
     */
    getDeepestNodeClone(): Node | undefined {
        return this._deepest_node_clone
    }
}