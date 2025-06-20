import { type Selection } from 'd3-selection'
import { Node } from './node'
import { Edge } from './edge'

export interface InterractionCallbacks {
    /**
     * Called when a node is selected by the user.
     * @param nodeId - The ID of the selected node
     */
    onNodeSelect?: (nodeId: string) => void;

    /**
     * Called when an edge is selected by the user.
     * @param edgeId - The ID of the selected edge
     */
    onEdgeSelect?: (edgeId: string) => void;

    /**
     * Called when a node is expanded (e.g., drilled down or pivoted).
     */
    nodeExpansion?: (nodeId: string) => void;

    /**
     * Called when the graph is fully rendered or updated.
     */
    onRenderComplete?: () => void;

    /**
     * Called when a user hovers over a node.
     */
    onNodeHover?: (nodeId: string) => void;

    /**
     * Called when a user hovers over an edge.
     */
    onEdgeHover?: (edgeId: string) => void;
}

export interface NodeStyle {
    shape: 'circle' | 'square' | 'triangle' | 'hexagon' | string;
    color: string;
    size: number;
    strokeColor: string;
    strokeWidth: number;
}

export interface EdgeStyle {
    strokeColor: string;
    strokeWidth: number;
    opacity: number,
}

export interface SvgRendererOptions {
    /**
     * Custom renderer for nodes.
     * Receives node data and selection, and should return HTML or SVG element or string or directly calling d3 methods on the selection.
     */
    renderNode?: (node: Node, nodeSelection: Selection<SVGGElement, Node, null, undefined>) => HTMLElement | string | void;
    /**
     * Custom renderer for edges.
     * Receives edge data and selection, and should return HTML or SVG element or string or directly calling d3 methods on the selection.
    */
    renderEdge?: (edge: Edge, nodeSelection: Selection<SVGLineElement, Edge, null, undefined>) => HTMLElement | string | void;
    defaultNodeStyle?: NodeStyle;
    defaultEdgeStyle?: EdgeStyle;
    nodeTypeAccessor?: (node: Node) => string | undefined;
    nodeStyleMap?: Record<string, NodeStyle>;
    /** @default 0.1 */
    minZoom: number;
    /** @default 10 */
    maxZoom: number;
}

export interface SimulationOptions {
    d3Alpha: number; /** @default 1.0 */
    d3AlphaMin: number; /** @default 0.001 */
    d3AlphaDecay: number; /** @default 0.0228 */
    d3AlphaTarget: number; /** @default 0 */
    d3VelocityDecay: number; /** @default 0.4 */
    d3LinkDistance: number; /** @default 30 */
    d3ManyBodyStrength: number; /** @default -30 */
    d3ManyBodyTheta: number; /** @default 0.9 */
    d3CollideRadius: number; /** @default 1 */
    d3CollideStrength: number; /** @default 1 */
    d3CollideIterations: number; /** @default 1 */
    cooldownTime: number; /** @default 2000 */
    warmupTicks: number; /** @default 50 */
}

export interface graphData {
    nodes: Array<Node>,
    edges: Array<Edge>,
}


export interface GraphOptions {
    /**
     * Options for the rendering engine
     */
    render?: Partial<SvgRendererOptions>
    /**
     * Options for the simultion engine
     */
    simulation?: Partial<SimulationOptions>

    /**
     * Automatically resize graph container when its parent container size changes.
     * @default true
     */
    autoResize?: boolean;

    /**
     * Width of the graph container. Can be any valid CSS size string or number (pixels).
     * @default '100%'
     */
    width?: string | number;

    /**
     * Height of the graph container. Can be any valid CSS size string or number (pixels).
     * @default '100%'
     */
    height?: string | number;

    /**
     * Callbacks to handle various graph events and render hooks.
     */
    callbacks?: InterractionCallbacks;

    /**
     * Enable zooming (scroll wheel, pinch, etc.)
     *@default true
     */
    enableZoom?: boolean;

    /**
     * Enable panning (drag to move viewport)
     * @default true
     */
    enablePan?: boolean;

    /**
     * Whether to show node labels by default
     * Default: true
     */
    showLabels?: boolean;

    /**
     * Default styling options for edges (e.g., color, width)
     */
    defaultEdgeStyle?: {
        color?: string;
        width?: number;
        dashed?: boolean;
        arrowHead?: boolean;
    };

    /**
     * Whether to allow multi-select (select multiple nodes/edges)
     * @default false
     */
    multiSelect?: boolean;

    /**
     * Enable animation on node expansion or layout changes
     * @default true
     */
    animate?: boolean;

    /**
     * Initial graph layout algorithm
     * Options could be 'force-directed', 'circular', 'grid', 'tree', etc.
     * Default: 'force-directed'
     */
    layout?: 'force-directed' | 'circular' | 'grid' | 'tree' | 'random' | string;

    /**
     * Duration of layout animation in milliseconds
     * Default: 1000
     */
    layoutAnimationDuration?: number;
}
