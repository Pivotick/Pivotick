import type { Edge } from './Edge'
import type { NodeStyle } from './interfaces/RendererOptions'
import { generateSafeDomId } from './utils/ElementCreation'

export interface NodeData {
    [key: string]: undefined;
}

/**
 * Represents a single node (vertex) in a graph.
 */
export class Node {
    public readonly id: string
    private data: NodeData
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
    frozen?: boolean
    private _circleRadius = this.defaultCircleRadius
    private _dirty: boolean
    public readonly domID: string

    /**
     * Create a new Node instance.
     * @param id - Unique identifier for the node
     * @param data - Optional data payload associated with the node
     */
    constructor(id: string, data?: NodeData, style?: Partial<NodeStyle>) {
        this.id = id
        this.domID = generateSafeDomId()
        this.data = data ?? ({} as NodeData)
        this.style = style ?? ({} as Partial<NodeStyle>)
        this._dirty = true
        this.frozen = false
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
     */
    toJSON(): object {
        return {
            id: this.id,
            x: this.x,
            y: this.y,
            vx: this.vx,
            vy: this.vy,
            fx: this.fx,
            fy: this.fy,
            data: this.data,
            style: this.style,
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
        clone._circleRadius = this._circleRadius

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

    degree(): number {
        return this.edgesOut.size + this.edgesIn.size
    }

    setCircleRadius(radius: number): void {
        this._circleRadius = radius
    }

    getCircleRadius(): number {
        return this._circleRadius
    }
}