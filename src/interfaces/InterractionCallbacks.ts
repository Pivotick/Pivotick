import type { Edge } from '../Edge'
import type { Node, NodeData } from '../Node'
import type { NodeSelection } from './GraphInteractions'
import type { NodeEditSession } from '../editing/NodeEditSession'
import type { Note } from '../Note'

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
    * Called when nodes are selected by the user.
    */
    onNodesSelect?: (selection: NodeSelection<TElement>[]) => void

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
     * Called when a node drag ends.
     */
    onNodeDragended?: (event: MouseEvent, node: Node) => void

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
     * Called when a note is clicked.
     */
    onNoteClick?: (event: PointerEvent, note: Note, element: TElement) => void

    /**
     * Called when a note is double clicked.
     */
    onNoteDbclick?: (event: PointerEvent, note: Note, element: TElement) => void

    /**
     * Called when a note is right clicked.
     */
    onNoteContextmenu?: (event: PointerEvent, note: Note, element: TElement) => void

    /**
     * Called when a user hovers over a note.
    */
    onNoteHoverIn?: (event: PointerEvent, note: Note, element: TElement) => void
    /**
     * Called when a user hovers out of a note.
    */
    onNoteHoverOut?: (event: PointerEvent, note: Note, element: TElement) => void

    /**
     * Called when the canvas is clicked.
     */
    onCanvasClick?: (event: PointerEvent) => void

    /**
     * Called when the canvas is about to be zoomed.
     */
    onCanvasBeforeZoom?: (event: unknown) => void

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

    /**
     * Called when a node edit session starts. Act as a UI hook.
     * @returns A HTML Div that will be injected in the modal's body
     * @param session The node edit session
     */
    onNodeEdit?: (session: NodeEditSession) => HTMLDivElement
    /**
     * Called when an node edit session is about to be commited
     * Act as a validation/interception hook.
     * @returns boolean indicating if the commit should proceed or not
     */
    onBeforeNodeEditCommit?: (context: NodeEditCommitContext) => boolean | Promise<boolean>
    /**
     * Called when an node edit session gets cancelled
     */
    onNodeEditCancel?: (node: Node) => void
}

export interface NodeEditCommitContext {
    node: Node
    previousData: NodeData
    nextData: NodeData
    session: NodeEditSession
}