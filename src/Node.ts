export interface NodeData {
    // Define any properties your node data should have,
    // or keep it generic for flexibility.
    [key: string]: any;
}

/**
 * Represents a single node (vertex) in a graph.
 */
export class Node<T = NodeData> {
    public readonly id: string
    private data: T
    private style: T

    // Layout/physics properties
    x?: number
    y?: number
    vx?: number
    vy?: number
    fx?: number
    fy?: number
    _circleRadius?: number
    private _dirty:boolean

    /**
     * Create a new Node instance.
     * @param id - Unique identifier for the node
     * @param data - Optional data payload associated with the node
     */
    constructor(id: string, data?: T, style?: T) {
        this.id = id
        this.data = data ?? ({} as T)
        this.style = style ?? ({} as T)
        this._dirty = true
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
        return document.getElementById(`node-${this.id}`) as SVGGElement | null
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
}