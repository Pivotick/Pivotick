import type { Edge } from '../Edge'
import type { Node } from '../Node'
import type { Note } from '../Note'


export interface NodeSelection<TElement> {
    node: Node,
    element: TElement,
}

export interface EdgeSelection<TElement> {
    edge: Edge,
    element: TElement,
}

export interface GraphInteractionContext {
    cancelled: boolean
    cancel(): void
}

/**
 * @category Main Options
 */
export type GraphInteractionEvents<TElement> = {
    nodeClick: (event: PointerEvent, node: Node, element: TElement, context: GraphInteractionContext) => void;
    nodeDbclick: (event: PointerEvent, node: Node, element: TElement, context: GraphInteractionContext) => void;
    nodeContextmenu: (event: PointerEvent, node: Node, element: TElement, context: GraphInteractionContext) => void;
    nodeHoverIn: (event: PointerEvent, node: Node, element: TElement) => void;
    nodeHoverOut: (event: PointerEvent, node: Node, element: TElement) => void;
    nodePointerDown: (event: PointerEvent, node: Node, element: TElement, context: GraphInteractionContext) => void;
    nodePointerUp: (event: PointerEvent, node: Node, element: TElement) => void;
    nodeSelect: (node: Node, element: TElement, context: GraphInteractionContext) => void;
    nodeBlur: (node: Node, element: TElement, context: GraphInteractionContext) => void;
    dragging: (event: MouseEvent, node: Node) => void;
    dragended: (event: MouseEvent, node: Node) => void;

    edgeClick: (event: PointerEvent, edge: Edge, element: TElement, context: GraphInteractionContext) => void;
    edgeDbclick: (event: PointerEvent, edge: Edge, element: TElement, context: GraphInteractionContext) => void;
    edgeContextmenu: (event: PointerEvent, edge: Edge, element: TElement, context: GraphInteractionContext) => void;
    edgeHoverIn: (event: PointerEvent, edge: Edge, element: TElement) => void;
    edgeHoverOut: (event: PointerEvent, edge: Edge, element: TElement) => void;
    edgeSelect: (edge: Edge, element: TElement) => void;
    edgeBlur: (edge: Edge, element: TElement) => void;

    noteClick: (event: PointerEvent, note: Note, element: TElement, context: GraphInteractionContext) => void;
    noteDbclick: (event: PointerEvent, note: Note, element: TElement, context: GraphInteractionContext) => void;
    noteContextmenu: (event: PointerEvent, note: Note, element: TElement, context: GraphInteractionContext) => void;
    noteHoverIn: (event: PointerEvent, note: Note, element: TElement) => void;
    noteHoverOut: (event: PointerEvent, note: Note, element: TElement) => void;
    notePointerDown: (event: PointerEvent, note: Note, element: TElement) => void;
    notePointerUp: (event: PointerEvent, note: Note, element: TElement) => void;
    noteHandleClick: (event: PointerEvent, note: Note, element: HTMLElement, context: GraphInteractionContext) => void;
    noteHandlePointerDown: (event: PointerEvent, note: Note, element: HTMLElement) => void;
    noteDragging: (event: PointerEvent, note: Note) => void;

    canvasClick: (event: PointerEvent, context: GraphInteractionContext) => void;
    canvasPointerDown: (event: PointerEvent) => void;
    canvasPointerUp: (event: PointerEvent) => void;
    canvasBeforeZoom: (event: unknown, context: GraphInteractionContext) => void;
    canvasZoom: (event: unknown) => void;
    canvasMousemove: (event: MouseEvent) => void;
    canvasContextmenu: (event: PointerEvent, context: GraphInteractionContext) => void;
    simulationTick: () => void;
    simulationSlowTick: () => void;

    selectNode: (node: Node, element: TElement) => void;
    unselectNode: (node: Node, element: TElement) => void;
    selectNodes: (nodes: NodeSelection<TElement>[]) => void;
    unselectNodes: (nodes: NodeSelection<TElement>[]) => void;

    selectEdge: (edge: Edge, element: TElement) => void;
    unselectEdge: (edge: Edge, element: TElement) => void;
    selectEdges: (edges: EdgeSelection<TElement>[]) => void;
    unselectEdges: (edges: EdgeSelection<TElement>[]) => void;
}
