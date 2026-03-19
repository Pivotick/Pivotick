import type { Edge } from './Edge'
import type { NodeStyle } from './interfaces/RendererOptions'
import { generateSafeDomId } from './utils/ElementCreation'

export interface NodeData {
    [key: string]: unknown;
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
    isChild: boolean
    isParent: boolean
    parentNode?: Node
    _original_object?: Node
    private _circleRadius = this.defaultCircleRadius
    private _circleRadiusCollapsed = this.defaultCircleRadius
    private _dirty: boolean
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
            expanded: this.expanded,
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
        clone.isParent = this.isParent
        clone.parentNode = this.parentNode
        clone._circleRadius = this._circleRadius
        clone.children = this.children.map((n) => n.clone())

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

    setCircleRadius(radius: number): void {
        this._circleRadius = radius
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

    setChildren(children: Node[]): void {
        this.children = children
        if (this.hasChildren()) {
            this.isParent = true
        } else {
            this.isParent = false
        }
    }

    hasChildren(): boolean {
        return this.children.length > 0
    }

    markAsChild(parentNode: Node): void {
        this.isChild = true
        this.parentNode = parentNode
    }

    markAsParent(): void {
        this.isParent = true
    }
}