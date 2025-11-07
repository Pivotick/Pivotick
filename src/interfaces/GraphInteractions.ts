import type { Edge } from '../Edge'
import type { Node } from '../Node'


export interface NodeSelection<TElement> {
    node: Node,
    element: TElement,
}

export interface EdgeSelection<TElement> {
    edge: Edge,
    element: TElement,
}

export type GraphInteractionEvents<TElement> = {
    nodeClick: (event: PointerEvent, node: Node, element: TElement) => void;
    nodeDbclick: (event: PointerEvent, node: Node, element: TElement) => void;
    nodeContextmenu: (event: PointerEvent, node: Node, element: TElement) => void;
    nodeHoverIn: (event: PointerEvent, node: Node, element: TElement) => void;
    nodeHoverOut: (event: PointerEvent, node: Node, element: TElement) => void;
    nodeSelect: (node: Node, element: TElement) => void;
    nodeBlur: (node: Node, element: TElement) => void;
    dragging: (event: MouseEvent, node: Node) => void;

    edgeClick: (event: PointerEvent, edge: Edge, element: TElement) => void;
    edgeDbclick: (event: PointerEvent, edge: Edge, element: TElement) => void;
    edgeContextmenu: (event: PointerEvent, edge: Edge, element: TElement) => void;
    edgeHoverIn: (event: PointerEvent, edge: Edge, element: TElement) => void;
    edgeHoverOut: (event: PointerEvent, edge: Edge, element: TElement) => void;
    edgeSelect: (edge: Edge, element: TElement) => void;
    edgeBlur: (edge: Edge, element: TElement) => void;

    canvasClick: (event: PointerEvent) => void;
    canvasZoom: (event: unknown) => void;
    canvasMousemove: (event: MouseEvent) => void;
    canvasContextmenu: (event: PointerEvent) => void;
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