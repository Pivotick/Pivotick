import { Node } from './Node'

export interface EdgeData {
    [key: string]: any;
}

/**
 * Represents an edge (connection) between two nodes in a graph.
 */
export class Edge<T = EdgeData> {
    public readonly id: string
    public readonly from: Node
    public readonly to: Node
    public readonly directed: boolean | null
    private data: T
    private style: T

    /**
     * Create a new Edge instance.
     * @param id - Unique identifier for the edge
     * @param from - Source node
     * @param to - Target node
     * @param data - Optional data payload for the edge
     */
    constructor(id: string, from: Node, to: Node, data?: T, style?: T, directed: boolean | null = null) {
        this.id = id
        this.from = from
        this.to = to
        this.directed = directed
        this.data = data ?? ({} as T)
        this.style = style ?? ({} as T)
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
    }

    /**
     * Merge partial data into the current edge data.
     * @param partialData - Partial data object to merge
     */
    updateData(partialData: Partial<T>): void {
        this.data = { ...this.data, ...partialData }
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
    }

    /**
     * Merge partial data into the current node data.
     * Useful for updating only parts of the data.
     * @param partialData - Partial data object to merge
     */
    updateStyle(partialStyle: Partial<T>): void {
        this.style = { ...this.style, ...partialStyle }
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

    clone(): Edge<T> {
        // Shallow copies of data and style
        const clonedData = { ...this.data }
        const clonedStyle = { ...this.style }

        return new Edge<T>(
            this.id,
            this.from,
            this.to,
            clonedData,
            clonedStyle,
            this.directed
        )
    }
}
