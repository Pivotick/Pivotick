import { type Selection } from 'd3-selection'
import { Node } from './Node'
import { Edge } from './Edge'

export interface InterractionCallbacks<TElement = unknown> {
    /**
     * Called when a node is clicked.
     */
    onNodeClick?: (event: PointerEvent, node: Node, element: TElement) => void

    /**
     * Called when a node is double clicked.
     */
    onNodeDbclick?: (event: PointerEvent, node: Node, element: TElement) => void
    
    /**
     * Called when a user hovers over a node.
    */
    onNodeHoverIn?: (event: PointerEvent, node: Node, element: TElement) => void
    /**
     * Called when a user hovers out of a node.
    */
    onNodeHoverOut?: (event: PointerEvent, node: Node, element: TElement) => void

    /**
    * Called when a node is selected by the user.
    */
    onNodeSelect?: (node: Node, element: TElement) => void

    /**
    * Called when a node is unselected by the user.
    */
    onNodeBlur?: (node: Node, element: TElement) => void

    /**
     * Called when a node is expanded (e.g., drilled down or pivoted).
     */
    onNodeExpansion?: (event: PointerEvent, edge: Edge, element: TElement) => void

    /**
     * Called when an edge is selected by the user.
     */
    onEdgeClick?: (event: PointerEvent, edge: Edge, element: TElement) => void
    /**
     * Called when an edge is selected by the user.
     */
    onEdgeDbclick?: (event: PointerEvent, edge: Edge, element: TElement) => void

    /**
     * Called when an edge is selected by the user.
    */
    onEdgeSelect?: (edge: Edge, element: TElement) => void

    /**
    * Called when an edge is unselected by the user.
    */
    onEdgeBlur?: (edge: Edge, element: TElement) => void

    /**
     * Called when a user hovers over an edge.
     */
    onEdgeHoverIn?: (event: PointerEvent, edge: Edge, element: TElement) => void
    /**
     * Called when a user hovers over an edge.
     */
    onEdgeHoverOut?: (event: PointerEvent, edge: Edge, element: TElement) => void

    /**
     * Called when the canvas is clicked.
     */
    onCanvasClick?: (event: PointerEvent) => void
}

export interface NodeStyle {
    shape: 'circle' | 'square' | 'triangle' | 'hexagon' | string
    color: string
    size: number
    strokeColor: string
    strokeWidth: number
    fontFamily: string
    textColor: string
    iconClass?: string,
    iconUnicode?: string,
    svgIcon?: string,
    imagePath?: string,
    text?: string,
    styleCb?: (node: Node) => Partial<NodeStyle>
}

export interface EdgeFullStyle {
    edge: EdgeStyle,
    label: LabelStyle,
}

export interface EdgeStyle {
    strokeColor: string
    strokeWidth: number
    opacity: number
    curveStyle: 'straight' | 'curved' | 'bidirectional' /** @default: bidirectional */
    dashed?: boolean /** @default: false — whether the stroke is dashed */
    animateDash?: boolean /** @default: true — whether the dash should animate (e.g., move along the path) */
    rotateLabel: boolean /** @default: false */
    markerEnd?: ((edge: Edge) => string) | string /** @default: arrow */
    markerStart?: ((edge: Edge) => string) | string /** @default: undefined */
    styleCb?: (edge: Edge) => Partial<EdgeStyle>
}

export interface LabelStyle {
    backgroundColor: string  /** @default: #ffffff90 */
    fontSize: number  /** @default: 12 */
    fontFamily: string  /** @default: system-ui, sans-serif */
    color: string  /** @default: #333 */
    styleCb?: (edge: Edge) => Partial<LabelStyle>
    labelAccessor?: (edge: Edge) => HTMLElement | string | void
}

export interface MarkerStyle {
    fill: string
    pathD: string
    viewBox: string
    refX: number
    refY: number
    markerWidth: number
    markerHeight: number
    markerUnits?: 'userSpaceOnUse' | 'strokeWidth'
    orient?: 'auto' | 'auto-start-reverse' | number
    selected?: Partial<MarkerStyle>
}

export type RendererType = 'svg' | 'canvas'

export interface GraphRendererOptions {
    type: RendererType,
    /**
     * Custom renderer for nodes.
     * Receives node data and selection, and should return HTML or SVG element or string or directly calling d3 methods on the selection.
     */
    renderNode?: (node: Node, edgeSelection: Selection<SVGForeignObjectElement, Node, null, undefined>) => HTMLElement | string | void
    /**
     * Custom renderer for edge labels.
     * Receives edge data and selection, and should return HTML or SVG element or string or directly calling d3 methods on the selection.
    */
    renderLabel?: (edge: Edge, edgeSelection: Selection<SVGForeignObjectElement, Edge, null, undefined>) => HTMLElement | string | void
    defaultNodeStyle: NodeStyle
    defaultEdgeStyle: EdgeStyle
    defaultLabelStyle: LabelStyle
    markerStyleMap?: Record<string, MarkerStyle>
    nodeTypeAccessor?: (node: Node) => string | undefined
    nodeStyleMap?: Record<string, NodeStyle>
    /** @default 0.1 */
    minZoom: number
    /** @default 10 */
    maxZoom: number
}

export interface SimulationOptions {
    /** Note: These may be scalled based on the amount of node and canvas size */
    d3Alpha: number /** @default 1.0 */
    d3AlphaMin: number /** @default 0.001 */
    d3AlphaDecay: number /** @default 0.0228 */
    d3AlphaTarget: number /** @default 0 */
    d3VelocityDecay: number /** @default 0.4 */
    d3LinkDistance: number /** @default 30 */
    d3LinkStrength: number | null /** @default null */
    d3ManyBodyStrength: number /** @default -30 */
    d3ManyBodyTheta: number /** @default 0.9 */
    d3CollideRadius: number /** @default 12 */
    d3CollideStrength: number /** @default 1 */
    d3CollideIterations: number /** @default 1 */
    cooldownTime: number /** @default 2000 */
    warmupTicks: number | 'auto' /** @default auto */

    layout?: LayoutOptions
}

export interface graphData {
    nodes: Array<Node>,
    edges: Array<Edge>,
}

export type LayoutType = 'force' | 'tree'


export interface BaseLayoutOptions {
    type: LayoutType /** @default force */
}


export type LayoutOptions = TreeLayoutOptions | ForceLayoutOptions

export interface ForceLayoutOptions extends BaseLayoutOptions {
    type: 'force'
}
export interface TreeLayoutOptions extends BaseLayoutOptions {
    type: 'tree'
    rootId?: string /** @default: undefined */
    strength?: number /** @default: 0.1 */
    radial?: boolean /** @default: false */
}

/**
 * - `"viewer"`: Navigate the graph (pan, zoom, drag), no UI panels.
 * - `"full"`: Full UI and interactions.
 * - `"light"`: Minimal UI, interactions enabled.
 * - `"static"`: Static graph, no UI, no interactions.
 */
export type GraphMode = 'viewer' | 'full' | 'light' | 'static';

export interface GraphOptions {
    /**
     * Options for the rendering engine
     */
    render?: Partial<GraphRendererOptions>
    /**
     * Options for the simultion engine
     */
    simulation?: Partial<SimulationOptions>

    /**
    * Layout-specific configuration (e.g. tree, radial, etc.)
    */
    layout?: Partial<LayoutOptions>

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
     * Graph renderer mode.
     * @default "viewer"
     */
    mode?: GraphMode,

    /**
     * Whether to allow multi-select (select multiple nodes/edges)
     * @default false
     */
    multiSelect?: boolean
}
