import type { Edge } from './Edge'
import { generateSafeDomId } from './utils/ElementCreation'

export interface NodeData {
    [key: string]: undefined;
}

/**
 * Represents a single node (vertex) in a graph.
 */
export class Node<T = NodeData> {
    public readonly id: string
    private data: T
    private style: T
    private edgesOut: Set<Edge>
    private edgesIn: Set<Edge>

    // Layout/physics properties
    x?: number
    y?: number
    vx?: number
    vy?: number
    fx?: number
    fy?: number
    frozen?: boolean
    _circleRadius?: number
    private _dirty: boolean
    public readonly domID: string

    /**
     * Create a new Node instance.
     * @param id - Unique identifier for the node
     * @param data - Optional data payload associated with the node
     */
    constructor(id: string, data?: T, style?: T) {
        this.id = id
        this.domID = generateSafeDomId()
        this.data = data ?? ({} as T)
        this.style = style ?? ({} as T)
        this._dirty = true
        this.frozen = false
        this.edgesOut = new Set()
        this.edgesIn = new Set()
    }

    /**
     * Get the node's data.
     */
    getData(): T {
        return this.data
    }

    /**
     * Update the node's data.
     * @param newData - New data to set
     */
    setData(newData: T): void {
        this.data = newData
        this.markDirty()
    }

    /**
     * Merge partial data into the current node data.
     * Useful for updating only parts of the data.
     * @param partialData - Partial data object to merge
     */
    updateData(partialData: Partial<T>): void {
        this.data = { ...this.data, ...partialData }
        this.markDirty()
    }

    registerEdgeOut(edge: Edge): void {
        this.edgesOut.add(edge)
    }

    registerEdgeIn(edge: Edge): void {
        this.edgesIn.add(edge)
    }

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
    getStyle(): T {
        return this.style
    }

    /**
     * Update the node's data.
     * @param newStyle - New data to set
     */
    setStyle(newStyle: T): void {
        this.style = newStyle
        this.markDirty()
    }

    /**
     * Merge partial data into the current node data.
     * Useful for updating only parts of the data.
     * @param partialData - Partial data object to merge
     */
    updateStyle(partialStyle: Partial<T>): void {
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

    clone(): Node<T> {
        // Shallow clone (deep optional below)
        const clonedData = { ...this.data }
        const clonedStyle = { ...this.style }

        const clone = new Node<T>(this.id, clonedData, clonedStyle)

        // Copy layout/physics properties
        clone.x = this.x
        clone.y = this.y
        clone.vx = this.vx
        clone.vy = this.vy
        clone.fx = this.fx
        clone.fy = this.fy

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
}