import type { EdgeFullStyle, EdgeStyle, LabelStyle, StyleUpdate } from './GraphOptions'
import { Node } from './Node'
import { generateSafeDomId } from './utils/ElementCreation'

export interface EdgeData {
    [key: string]: unknown;
}

/**
 * Represents an edge (connection) between two nodes in a graph.
 */
export class Edge<T = EdgeData, U = EdgeFullStyle> {
    public readonly id: string
    public from: Node
    public to: Node
    public readonly directed: boolean | null
    private data: T
    private style: U
    private _dirty: boolean
    public readonly domID: string

    /**
     * Create a new Edge instance.
     * @param id - Unique identifier for the edge
     * @param from - Source node
     * @param to - Target node
     * @param data - Optional data payload for the edge
     * @param style - Optional style for the edge
     */
    constructor(id: string, from: Node, to: Node, data?: T, style?: U, directed: boolean | null = null) {
        this.id = id
        this.domID = generateSafeDomId()
        this.from = from
        this.to = to
        this.directed = directed
        this.data = data ?? ({} as T)
        this.style = style ?? ({} as U)
        this._dirty = true

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
    getData(): T {
        return this.data
    }

    /**
     * Update the edge's data.
     * @param newData - New data to set
     */
    setData(newData: T): void {
        this.data = newData
        this.markDirty()
    }

    /**
     * Merge partial data into the current edge data.
     * @param partialData - Partial data object to merge
     */
    updateData(partialData: Partial<T>): void {
        this.data = { ...this.data, ...partialData }
        this.markDirty()
    }

    /**
     * Get the edge's style.
     */
    getStyle(): U {
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
    setStyle(newStyle: U): void {
        this.style = newStyle
        this.markDirty()
    }

    /**
     * Merge partial style into the current edge style.
     * Useful for updating only parts of the style.
     * @param partialStyle - Partial style object to merge
     */
    updateStyle(partialStyle: Partial<StyleUpdate>): void {
        this.style = { ...this.style, ...partialStyle }
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
    toJSON() {
        return {
            id: this.id,
            from: this.from.id,
            to: this.to.id,
            data: this.data,
        }
    }

    clone(): Edge<T, U> {
        // Shallow copies of data and style
        const clonedData = { ...this.data } as T
        const clonedStyle = { ...this.style } as U

        return new Edge<T, U>(
            this.id,
            this.from.clone(),
            this.to.clone(),
            clonedData,
            clonedStyle,
            this.directed
        )
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
}
