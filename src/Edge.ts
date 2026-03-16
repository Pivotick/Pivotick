import type { EdgeFullStyle, EdgeStyle, LabelStyle, PartialEdgeFullStyle } from './interfaces/RendererOptions'
import { Node } from './Node'
import { generateSafeDomId } from './utils/ElementCreation'

export interface EdgeData {
    [key: string]: undefined;
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
    isSynthetic?: boolean

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
    constructor(id: string, from: Node, to: Node, data?: EdgeData, style?: Partial<EdgeFullStyle>, directed: boolean | null = null, isSynthetic =false) {
        this.id = id
        this.domID = generateSafeDomId()
        this.from = from
        this.to = to
        this.directed = directed
        this.data = data ?? ({} as EdgeData)
        this.style = style ?? ({} as EdgeFullStyle)
        this.visible = true
        this._dirty = true
        this.isSynthetic = isSynthetic

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
        this.style = ({
            ...(this.style as Partial<EdgeFullStyle>),
            ...(partialStyle as Partial<EdgeFullStyle>)
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
        this.visible = true
    }

    hide(): void {
        this.visible = false
    }
}
