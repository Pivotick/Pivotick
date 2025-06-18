import { Node } from './node';

export interface EdgeData {
    [key: string]: any;
}

/**
 * Represents an edge (connection) between two nodes in a graph.
 */
export class Edge<T = EdgeData> {
    public readonly id: string;
    public readonly from: Node;
    public readonly to: Node;
    private data: T;

    /**
     * Create a new Edge instance.
     * @param id - Unique identifier for the edge
     * @param from - Source node
     * @param to - Target node
     * @param data - Optional data payload for the edge
     */
    constructor(id: string, from: Node, to: Node, data?: T) {
        this.id = id;
        this.from = from;
        this.to = to;
        this.data = data ?? ({} as T);
    }

    /** Required by d3-force */
    get source(): Node {
        return this.from;
    }
    get target(): Node {
        return this.to;
    }

    /**
     * Get the edge's data.
     */
    getData(): T {
        return this.data;
    }

    /**
     * Update the edge's data.
     * @param newData - New data to set
     */
    setData(newData: T): void {
        this.data = newData;
    }

    /**
     * Merge partial data into the current edge data.
     * @param partialData - Partial data object to merge
     */
    updateData(partialData: Partial<T>): void {
        this.data = { ...this.data, ...partialData };
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
        };
    }
}
