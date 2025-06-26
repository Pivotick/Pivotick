import { type Selection } from 'd3-selection'
import { Node } from './Node'
import { Edge } from './Edge'

export interface InterractionCallbacks {
    /**
     * Called when a node is clicked.
     */
    onNodeClick?: (event: PointerEvent, node: Node, svgNode: SVGGElement) => void

    /**
     * Called when a node is double clicked.
     */
    onNodeDbclick?: (event: PointerEvent, node: Node, svgNode: SVGGElement) => void
    
    /**
     * Called when a user hovers over a node.
    */
    onNodeHoverIn?: (event: PointerEvent, node: Node, svgNode: SVGGElement) => void
    /**
     * Called when a user hovers out of a node.
    */
    onNodeHoverOut?: (event: PointerEvent, node: Node, svgNode: SVGGElement) => void

    /**
    * Called when a node is selected by the user.
    */
    onNodeSelect?: (node: Node, svgNode: SVGGElement) => void

    /**
    * Called when a node is unselected by the user.
    */
    onNodeBlur?: (node: Node, svgNode: SVGGElement) => void

    /**
     * Called when a node is expanded (e.g., drilled down or pivoted).
     */
    onNodeExpansion?: (event: PointerEvent, edge: Edge, svgNode: SVGGElement) => void

    /**
     * Called when an edge is selected by the user.
     */
    onEdgeClick?: (event: PointerEvent, edge: Edge, svgEdge: SVGPathElement) => void
    /**
     * Called when an edge is selected by the user.
     */
    onEdgeDbclick?: (event: PointerEvent, edge: Edge, svgEdge: SVGPathElement) => void

    /**
     * Called when an edge is selected by the user.
    */
    onEdgeSelect?: (edge: Edge, svgEdge: SVGPathElement) => void

    /**
    * Called when an edge is unselected by the user.
    */
    onEdgeBlur?: (edge: Edge, svgEdge: SVGPathElement) => void

    /**
     * Called when a user hovers over an edge.
     */
    onEdgeHoverIn?: (event: PointerEvent, edge: Edge, svgEdge: SVGPathElement) => void
    /**
     * Called when a user hovers over an edge.
     */
    onEdgeHoverOut?: (event: PointerEvent, edge: Edge, svgEdge: SVGPathElement) => void
}

export interface NodeStyle {
    shape: 'circle' | 'square' | 'triangle' | 'hexagon' | string
    color: string
    size: number
    strokeColor: string
    strokeWidth: number
    styleCb?: (node: Node) => Partial<NodeStyle>
}

export interface EdgeStyle {
    strokeColor: string
    strokeWidth: number
    opacity: number
    curveStyle: 'straight' | 'curved' | 'bidirectional' /** @default: bidirectional */
}

export interface GraphSvgRendererOptions {
    /**
     * Custom renderer for nodes.
     * Receives node data and selection, and should return HTML or SVG element or string or directly calling d3 methods on the selection.
     */
    renderNode?: (node: Node, nodeSelection: Selection<SVGGElement, Node, null, undefined>) => HTMLElement | string | void
    /**
     * Custom renderer for edges.
     * Receives edge data and selection, and should return HTML or SVG element or string or directly calling d3 methods on the selection.
    */
    renderEdge?: (edge: Edge, nodeSelection: Selection<SVGPathElement, Edge, null, undefined>) => HTMLElement | string | void
    defaultNodeStyle: NodeStyle
    defaultEdgeStyle: EdgeStyle
    nodeTypeAccessor?: (node: Node) => string | undefined
    nodeStyleMap?: Record<string, NodeStyle>
    /** @default 0.1 */
    minZoom: number
    /** @default 10 */
    maxZoom: number
}

export interface SimulationOptions {
    d3Alpha: number /** @default 1.0 */
    d3AlphaMin: number /** @default 0.001 */
    d3AlphaDecay: number /** @default 0.0228 */
    d3AlphaTarget: number /** @default 0 */
    d3VelocityDecay: number /** @default 0.4 */
    d3LinkDistance: number /** @default 30 */
    d3LinkStrength: number | null /** @default null */
    d3ManyBodyStrength: number /** @default -30 */
    d3ManyBodyTheta: number /** @default 0.9 */
    d3CollideRadius: number /** @default 1 */
    d3CollideStrength: number /** @default 1 */
    d3CollideIterations: number /** @default 1 */
    cooldownTime: number /** @default 2000 */
    warmupTicks: number /** @default 50 */
}

export interface graphData {
    nodes: Array<Node>,
    edges: Array<Edge>,
}


export interface GraphOptions {
    /**
     * Options for the rendering engine
     */
    render?: Partial<GraphSvgRendererOptions>
    /**
     * Options for the simultion engine
     */
    simulation?: Partial<SimulationOptions>

    /**
     * Callbacks to handle various graph events and render hooks.
     */
    callbacks?: InterractionCallbacks

    /**
     * Enable wether the graph is directed or not
     * @default true
     */
    isDirected?: boolean,

    /**
     * Automatically resize graph container when its parent container size changes.
     * @default true
     */
    autoResize?: boolean

    /**
     * Width of the graph container. Can be any valid CSS size string or number (pixels).
     * @default '100%'
     */
    width?: string | number

    /**
     * Height of the graph container. Can be any valid CSS size string or number (pixels).
     * @default '100%'
     */
    height?: string | number

    /**
     * Enable zooming (scroll wheel, pinch, etc.)
     *@default true
     */
    enableZoom?: boolean

    /**
     * Enable panning (drag to move viewport)
     * @default true
     */
    enablePan?: boolean

    /**
     * Whether to show node labels by default
     * Default: true
     */
    showLabels?: boolean

    /**
     * Default styling options for edges (e.g., color, width)
     */
    defaultEdgeStyle?: {
        color?: string
        width?: number
        dashed?: boolean
        arrowHead?: boolean
    }

    /**
     * Whether to allow multi-select (select multiple nodes/edges)
     * @default false
     */
    multiSelect?: boolean

    /**
     * Enable animation on node expansion or layout changes
     * @default true
     */
    animate?: boolean

    /**
     * Initial graph layout algorithm
     * Options could be 'force-directed', 'circular', 'grid', 'tree', etc.
     * Default: 'force-directed'
     */
    layout?: 'force-directed' | 'circular' | 'grid' | 'tree' | 'random' | string

    /**
     * Duration of layout animation in milliseconds
     * Default: 1000
     */
    layoutAnimationDuration?: number
}
