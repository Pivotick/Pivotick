import { type Selection } from 'd3-selection'
import { Node } from "./node";
import { Edge } from "./edge";

export interface GraphCallbacks {
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
     * Custom renderer for nodes.
     * Receives node data and should return HTML or SVG element or string or directly calling d3 methods on the selection.
     */
    renderNode?: (node: Node, nodeSelection: Selection<SVGCircleElement, Node, null, undefined>) => HTMLElement | string | void;

    /**
     * Custom renderer for edges.
     * Receives edge data and should return HTML or SVG element or string or directly calling d3 methods on the selection.
     */
    renderEdge?: (edge: Edge, nodeSelection: Selection<SVGLineElement, Edge, null, undefined>) => HTMLElement | string | void;

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

export interface SvgRendererOptions {
    renderNode?: Function;
    renderEdge?: Function;
    /** @default 0.1 */
    minZoom: number;
    /** @default 10 */
    maxZoom: number;
}


export interface GraphOptions {
    /**
     * Options for the rendering engine
     */
    render?: Partial<SvgRendererOptions>


    /**
     * Automatically resize graph container when its parent container size changes.
     * Default: true
     */
    autoResize?: boolean;

    /**
     * Width of the graph container. Can be any valid CSS size string or number (pixels).
     * Default: '100%'
     */
    width?: string | number;

    /**
     * Height of the graph container. Can be any valid CSS size string or number (pixels).
     * Default: '100%'
     */
    height?: string | number;

    /**
     * Callbacks to handle various graph events and render hooks.
     */
    callbacks?: GraphCallbacks;

    /**
     * Enable zooming (scroll wheel, pinch, etc.)
     * Default: true
     */
    enableZoom?: boolean;

    /**
     * Enable panning (drag to move viewport)
     * Default: true
     */
    enablePan?: boolean;

    /**
     * Minimum zoom scale allowed
     * Default: 0.1
     */
    minZoom?: number;

    /**
     * Maximum zoom scale allowed
     * Default: 4
     */
    maxZoom?: number;

    /**
     * Whether to show node labels by default
     * Default: true
     */
    showLabels?: boolean;

    /**
     * Default styling options for nodes (e.g., color, size)
     */
    defaultNodeStyle?: {
        color?: string;
        size?: number;
        shape?: 'circle' | 'square' | 'triangle' | 'hexagon' | string;
        borderColor?: string;
        borderWidth?: number;
    };

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
     * Default: false
     */
    multiSelect?: boolean;

    /**
     * Enable animation on node expansion or layout changes
     * Default: true
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
