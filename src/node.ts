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

    // Layout/physics properties (optional)
    x?: number
    y?: number
    vx?: number
    vy?: number
    fx?: number
    fy?: number

    /**
     * Create a new Node instance.
     * @param id - Unique identifier for the node
     * @param data - Optional data payload associated with the node
     */
    constructor(id: string, data?: T) {
        this.id = id
        this.data = data ?? ({} as T)
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
    }

    /**
     * Merge partial data into the current node data.
     * Useful for updating only parts of the data.
     * @param partialData - Partial data object to merge
     */
    updateData(partialData: Partial<T>): void {
        this.data = { ...this.data, ...partialData }
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
        }
    }
}
  