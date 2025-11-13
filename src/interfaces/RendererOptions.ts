import type { Edge } from '../Edge'
import type { Node } from '../Node'
import type { IconClass, IconUnicode, ImagePath, SVGIcon } from './GraphUI'

/**
 * @category Main Options
 */
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
     * @defaultValue {@link defaultNodeStyleValue}
     */
    defaultNodeStyle: NodeStyle
    /**
     * The default edge style to be applied on all nodes
     * @defaultValue {@link defaultEdgeStyleValue}
     */
    defaultEdgeStyle: EdgeStyle
    /**
     * The default edge's label style to be applied on all nodes
     * @defaultValue {@link defaultLabelStyleValue}
     */
    defaultLabelStyle: LabelStyle
    /**
     * Defines custom styles for marker shapes used in the graph.
     * 
     * Each key is a marker type (e.g., `'diamond'`, `'arrow'`) and maps to a `MarkerStyle` object.
     * 
     * @defaultValue {@link defaultMarkerStyleMap}
     * @example
     * ```ts
     * markerStyleMap: {
     *   'diamond': {
     *     fill: '#44c77f',
     *   },
     * }
     * ```
     */
    markerStyleMap?: MarkerStyleMap
    /**
     * Function to access the type of a node. Used in 
     * 
     * Used to style nodes based on their type.
     * @remarks
     * Used in conjuction with {@link nodeStyleMap}
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
     * Used in conjuction with {@link nodeTypeAccessor}
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

/**
 * - `'svg'` - Uses SVG elements for rendering
 * - `'canvas'` - Uses the HTML canvas for rendering (barely supported)
 * @default 'svg'
 */
export type RendererType = 'svg' | 'canvas'


/**
 * Represents one of the predefined, common node shapes.
 * These can be rendered using basic SVG elements like <circle>, <rect>, or <polygon>.
 */
export type StandardShape = 'circle' | 'square' | 'triangle' | 'hexagon'

/**
 * Represents a node with a custom SVG path.
 * The `d` property corresponds directly to the `d` attribute of an SVG <path> element,
 * allowing fully custom shapes.
 * 
 * @example
 * ```ts
 * {
 *   d: "M 0 -10 L 10 10 L -10 10 Z"
 * }
 * ```
 */
export interface CustomNodeShape {
    d: string  // represents the `d` attribute of <path>
}

export type NodeShape = StandardShape | CustomNodeShape

export interface NodeStyle {
    /**
     * The shape of the node, either a standard shape or a custom SVG path
     * @default circle
     */
    shape: NodeShape
    /**
     * The main color of the node
     * @default 'var(--pivotick-node-color, #007acc)'
     */
    color: string
    /** @default 10 */
    size: number
    /** @default 'var(--pivotick-node-stroke, #fff)' */
    strokeColor: string
    /** @default 2 */
    strokeWidth: number
    /** @default 'var(--pivotick-label-font, system-ui, sans-serif)' */
    fontFamily: string
    /** @default 'var(--pivotick-node-text-color, #fff)' */
    textColor: string
    iconClass?: IconClass,
    iconUnicode?: IconUnicode,
    svgIcon?: SVGIcon,
    imagePath?: ImagePath,
    /**
     * The text to be used inside the node as an `SVGText` element
     */
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
 * @default 'bidirectional'
 */
export type CurveStyle = 'straight' | 'curved' | 'bidirectional'
export interface EdgeStyle {
    /** @default 'var(--pivotick-edge-color, #999)' */
    strokeColor: string
    /** @default 2 */
    strokeWidth: number
    /** @default 1.0 */
    opacity: number
    /** @default bidirectional */
    curveStyle: CurveStyle
    /**
     * Whether the stroke is dashed 
     * @default false
     */
    dashed?: boolean
    /**
     * Whether the dash should be animated (e.g., animation moving along the path)
     * @default: true 
     */
    animateDash?: boolean
    /**
     * Keeps labels horizontally aligned to the viewport
     * @default false
     * */
    rotateLabel: boolean
    /**
     * Which end marker should the edge use
     * @default arrow
     */
    markerEnd?: ((edge: Edge) => string) | string
    /**
     * Which start marker should the edge use
     * @default undefined
     */
    markerStart?: ((edge: Edge) => string) | string
    styleCb?: (edge: Edge) => Partial<EdgeStyle>
}

export interface LabelStyle {
    /** @default #ffffff90 */
    backgroundColor: string
    /** @default 12 */
    fontSize: number
    /** @default system-ui, sans-serif */
    fontFamily: string
    /** @default #333 */
    color: string
    styleCb?: (edge: Edge) => Partial<LabelStyle>
    labelAccessor?: (edge: Edge) => HTMLElement | string | void
}

/**
 * Define the styling of an Edge marker.
 */
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
 * A map of all available edge marker styles.
 *
 * Custom markers can be added here and referenced by `markerStart` or `markerEnd`
 * in {@link EdgeStyle}.
 * 
 * @defaultValue {@link defaultMarkerStyleMap}
 */
export type MarkerStyleMap = Record<string, MarkerStyle>
