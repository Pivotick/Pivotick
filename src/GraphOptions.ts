import { Node } from './Node'
import { Edge } from './Edge'
import type { Simulation } from './Simulation'
import type { IconClass, IconUnicode, ImagePath, SVGIcon, UIVariant } from './utils/ElementCreation'
import type { TreeLayoutAlgorithm } from './plugins/layout/Tree'
import type { UIElement } from './ui/UIManager'

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
     * Called when a node is right clicked.
     */
    onNodeContextmenu?: (event: PointerEvent, node: Node, element: TElement) => void
    
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
     * Called when a node is dragged.
     */
    onNodeDragging?: (event: MouseEvent, node: Node) => void

    /**
     * Called when an edge is selected by the user.
     */
    onEdgeClick?: (event: PointerEvent, edge: Edge, element: TElement) => void
    /**
     * Called when an edge is selected by the user.
     */
    onEdgeDbclick?: (event: PointerEvent, edge: Edge, element: TElement) => void
    /**
     * Called when an edge is right clicked.
     */
    onEdgeContextmenu?: (event: PointerEvent, edge: Edge, element: TElement) => void

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

    /**
     * Called when the canvas is zoomed.
     */
    onCanvasZoom?: (event: unknown) => void

    /**
     * Called when the canvas is right clicked.
     */
    onCanvasContextmenu?: (event: PointerEvent) => void

    /**
     * Called when the mouse move over the canvas.
     */
    onCanvasMousemove?: (event: MouseEvent) => void

    /**
     * Called when the simulation ticks.
     */
    onSimulationTick?: () => void

    /**
     * Called when the every tenth of simulation ticks.
     */
    onSimulationSlowTick?: () => void
}

/**
 * Represents one of the predefined, common node shapes.
 * These can be rendered using basic SVG elements like <circle>, <rect>, or <polygon>.
 */
export type StandardShape = 'circle' | 'square' | 'triangle' | 'hexagon'

/**
 * Represents a node with a custom SVG path.
 * The `d` property corresponds directly to the `d` attribute of an SVG <path> element,
 * allowing fully custom shapes.
 */
export interface CustomNodeShape {
    d: string  // represents the `d` attribute of <path>
}
export type NodeShape = StandardShape | CustomNodeShape
export interface NodeStyle {
    /** The shape of the node, either a standard shape or a custom SVG path */
    shape: NodeShape
    color: string
    size: number
    strokeColor: string
    strokeWidth: number
    fontFamily: string
    textColor: string
    iconClass?: IconClass,
    iconUnicode?: IconUnicode,
    svgIcon?: SVGIcon,
    imagePath?: ImagePath,
    text?: string,
    /**
     * Callback to dynamically override style properties based on the node.
     */
    styleCb?: (node: Node) => Partial<NodeStyle>
}

export interface EdgeFullStyle {
    edge: EdgeStyle,
    label: LabelStyle,
}

export interface PartialEdgeFullStyle {
    edge?: Partial<EdgeStyle>
    node?: Partial<NodeStyle>
}

/**
 * - 'straight': The edge will go in a straight line from A to B
 * - 'curved': The edge will always be curved from A to B
 * - 'bidirectional': The edge will be curved only if there is a birectional relation between A and B. So, from A to B and B to A
 */
export type CurveStyle = 'straight' | 'curved' | 'bidirectional'
export interface EdgeStyle {
    strokeColor: string
    strokeWidth: number
    opacity: number
    curveStyle: CurveStyle /** @default: bidirectional */
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

/**
 * - `'svg'` - Uses SVG elements for rendering
 * - `'canvas'` - Uses the HTML canvas for rendering (barely supported)
 * @default 'svg'
 */
export type RendererType = 'svg' | 'canvas'

export interface GraphRendererOptions {
    /**
     * Defines the rendering method used by the graph.
     *
     */
    type: RendererType,
    /**
     * Custom renderer for nodes.
     * 
     * Allows full control over how a node is displayed
     * The function can return either:
     * - An `HTMLElement` to be used as the node, or
     * - A string to render inside the node
     * 
     * @example
     * ```ts
     * renderNode: (node: Node): HTMLElement | string | void => {
     *   const size = 12;
     *   const style = [
     *     'display:block',
     *     `width:${size}px`,
     *     `height:${size}px`,
     *     'background-color:#907acc',
     *     'border: 2px solid #fff',
     *     'border-radius:50%',
     *     'opacity: 1',
     *   ].join(';');
     * 
     *   return `<span style="${style}"></span>`;
     * }
     * ```
     */
    renderNode?: (node: Node) => HTMLElement | string | void
    /**
     * Custom renderer for edge labels.
     * 
     * Allows full control over how edge labels are displayed.
     * The function can return either:
     * - An `HTMLElement` to be used as the edge's label, or
     * - A string to render inside the label
     * 
     * @example
     * ```ts
     * renderLabel: (edge: Edge): HTMLElement | string | void => {
     *   const style = [
     *     'display:inline-block',
     *     'background-color:#907acc',
     *     'border: 2px solid #fff',
     *     'border-radius:50%',
     *     'opacity: 1',
     *   ].join(';');
     * 
     *   const text = edge.getData().label;
     *   return `<span style="${style}">${text}</span>`;
     * }
     * ```
     */
    renderLabel?: (edge: Edge) => HTMLElement | string | void
    /**
     * The default node style to be applied on all nodes
     */
    defaultNodeStyle: NodeStyle
    /**
     * The default edge style to be applied on all nodes
     */
    defaultEdgeStyle: EdgeStyle
    /**
     * The default edge's label style to be applied on all nodes
     */
    defaultLabelStyle: LabelStyle
    /**
     * Defines custom styles for marker shapes used in the graph.
     * 
     * Each key is a marker type (e.g., `'diamond'`, `'arrow'`) and maps to a `MarkerStyle` object.
     * 
     * @example
     * ```ts
     * markerStyleMap: {
     *   'diamond': {
     *     fill: '#44c77f',
     *   },
     * }
     * ```
     */
    markerStyleMap?: Record<string, MarkerStyle>
    /**
     * Function to access the type of a node. Used in 
     * 
     * Used to style nodes based on their type.
     * @remarks
     * Used in conjuction with `nodeStyleMap`
     * 
     * @example
     * ```ts
     * nodeTypeAccessor: (node) => node.getData()?.type
     * ```
     */
    nodeTypeAccessor?: (node: Node) => string | undefined
    /**
     * Maps node types to their styles.
     * 
     * Each key is a node type (as returned by `nodeTypeAccessor`) and maps to a `NodeStyle` object.
     * 
     * @remarks
     * Used in conjuction with `nodeTypeAccessor`
     * 
     * @example
     * ```ts
     * nodeStyleMap: {
     *   'hub': { shape: 'hexagon', color: '#aaa', size: 30 },
     *   'spoke': { shape: 'triangle', color: '#f00' },
     * }
     * ```
     */
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
    d3CenterStrength: number /** @default 1 */
    d3GravityStrength: number /** @default 0.001 */
    cooldownTime: number /** @default 2000 */
    warmupTicks: number | 'auto' /** @default auto */
    freezeNodesOnDrag: boolean /** @default true */

    layout: LayoutOptions
    callbacks?: SimulationCallbacks
}

export interface SimulationCallbacks {
    /**
     * Called when the simulation initialize
     */
    onInit?: (simulation: Simulation) => void
    /**
     * Called when the simulation starts
     */
    onStart?: (simulation: Simulation) => void
    /**
     * Called when the simulation stops
     */
    onStop?: (simulation: Simulation) => void
    /**
     * Called when the simulation ticks
     */
    onTick?: (simulation: Simulation) => void
}

export interface graphData {
    nodes: Node[],
    edges: Edge[],
}

export type LayoutType = 'force' | 'tree'


export interface BaseLayoutOptions {
    type: LayoutType /** @default force */
}

export type LayoutOptions = ForceLayoutOptions | TreeLayoutOptions

export interface ForceLayoutOptions extends BaseLayoutOptions {
    type: 'force'
}
export interface TreeLayoutOptions extends BaseLayoutOptions {
    type: 'tree'
    rootId?: string /** @default: undefined */
    strength?: number /** @default: 0.1 */
    radial?: boolean /** @default: false */
    horizontal?: boolean /** @default: false */
    rootIdAlgorithmFinder: TreeLayoutAlgorithm
    radialGap: number /** @default: 750 */
    flipEdgeDirection: boolean /** @default: false */
}

/**
 * - `"viewer"`: Navigate the graph (pan, zoom, drag), no UI panels.
 * - `"full"`: Full UI and interactions.
 * - `"light"`: Minimal UI, interactions enabled.
 * - `"static"`: Static graph, no UI, no interactions.
 */
export type GraphUIMode = 'viewer' | 'full' | 'light' | 'static';

/**
 * Define what should be displayed in the sidebar's main header slot for node or edges.
 */
export interface MainHeader {
    nodeHeaderMap: HeaderMapEntry<Node>
    edgeHeaderMap: HeaderMapEntry<Edge>
}

/**
 * Mapping functions to extract a node/edge's title and subtitle.
 *
 * Example for node. Replace with edge for edge mapping.
 * @default
 * title   = node.getData().label || "Could not resolve title"
 * subtitle= node.getData().description || "Could not resolve subtitle"
 */
export interface HeaderMapEntry<T> {
    title: ((element: T) => string) | string,
    subtitle: ((element: T) => string) | string,
}

/**
 * Represents a single property entry to display in the properties panel.
 * 
 * - `name` is the label or key of the property.
 * - `value` is the value associated to the key for the node or edge.
 */
export interface PropertyEntry {
    name: ((element: Node | Edge | null) => HTMLElement | string) | HTMLElement | string,
    value: ((element: Node | Edge | null) => HTMLElement | string) | HTMLElement | string,
}

/**
 * Represents the configuration for the properties panel in the graph UI's sidebar
 * 
 * Defines how to compute and display properties for nodes and edges.
 * @default All key/value pairs from node.getData() or edge.getData()
 */
export interface PropertiesPanel {
    /**
     * A function that computes the list of node properties to display
     *
     * @default All key/value pairs from node.getData()
     */
    nodePropertiesMap: ((node: Node) => Array<PropertyEntry>)
    /**
     * A function that computes the list of edge properties to display
     *
     * @default All key/value pairs from edge.getData()
     */
    edgePropertiesMap: ((edge: Edge) => Array<PropertyEntry>)
}

/**
 * Additional panel in the graph UI's sidebar.
 * 
 * Both `title` and `content` can be:
 * - A string or `HTMLElement` for static content, or
 * - A function returning a string or `HTMLElement` for dynamic content based on the current selected node or edge.
 */
export interface ExtraPanel {
    title: ((element: Node | Edge | null) => HTMLElement | string) | HTMLElement | string,
    content: ((element: Node | Edge | null) => HTMLElement | string) | HTMLElement | string,
}

export interface GraphUI {
    mode: GraphUIMode,
    mainHeader: MainHeader,
    propertiesPanel: PropertiesPanel,
    extraPanels: ExtraPanel[],
    tooltip: {
        enable?: boolean /** @default true */
        /**
         * Custom renderer for node tooltips. This content is added after the default tooltip
         * @default undefined
         */
       renderNodeExtra?: (node: Node) => HTMLElement | string,
        /**
        * Custom renderer for edge tooltips. This content is added after the default tooltip
        * @default undefined
        */
        renderEdgeExtra?: (edge: Edge) => HTMLElement | string,
        nodeHeaderMap: Partial<HeaderMapEntry<Node>>,
        edgeHeaderMap: Partial<HeaderMapEntry<Edge>>,
        nodePropertiesMap: ((node: Node) => Array<PropertyEntry>),
        edgePropertiesMap: ((edge: Edge) => Array<PropertyEntry>),
        /**
        * Custom renderer for the tooltip. This content will override the default tooltip
        * @default undefined
        * @example
        * (element) => `element id: ${element.id}`
        */
        render?: ((element: Node | Edge) => HTMLElement | string) | HTMLElement | string,
    },
    contextMenu: {
        enable?: boolean /** @default true */
        menuNode?: {
            topbar?: MenuQuickActionItemOptions[],
            menu?: MenuActionItemOptions[],
        },
        menuEdge?: {
            topbar?: MenuQuickActionItemOptions[],
            menu?: MenuActionItemOptions[],
        },
        menuCanvas?: {
            topbar?: MenuQuickActionItemOptions[],
            menu?: MenuActionItemOptions[],
        },
    },
    selectionMenu: {
        menuNode?: {
            topbar?: MenuQuickActionItemOptions[],
            menu?: MenuActionItemOptions[],
        }
    }
}

/**
 * Options to define an action item in a menu.
 * Can be used in contextual menus or multi-select menus.
 */
export type MenuActionItemOptions<TThis extends UIElement = UIElement> = {
    /** Unicode character for the icon (optional) */
    iconUnicode?: IconUnicode,
    iconClass?: IconClass,
    svgIcon?: SVGIcon,
    imagePath?: ImagePath,
    text?: string,
    title: string,
    variant: UIVariant,
    visible: boolean | ((element: Node | Edge | null) => boolean)
    onclick: (this: TThis, evt: PointerEvent | MouseEvent, element?: Node | Node[] | Edge | Edge[] | null) => void
}
export type MenuQuickActionItemOptions = MenuActionItemOptions & {
    flushRight?: boolean;
}

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
    UI?: Partial<GraphUI>,

    /**
     * Whether to allow multi-select (select multiple nodes/edges)
     * @default false
     */
    multiSelect?: boolean
}
