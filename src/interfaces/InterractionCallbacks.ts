import type { Edge } from '../Edge'
import type { Node } from '../Node'

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