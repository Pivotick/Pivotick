import type { Graph } from './Graph'
import type { InterractionCallbacks } from './GraphOptions'
import type { Node } from './Node'
import type { Edge } from './Edge'


interface NodeSelection<TElement> {
    node: Node,
    element: TElement,
}

interface EdgeSelection<TElement> {
    edge: Edge,
    element: TElement,
}

export class GraphInteractions<TElement = unknown> {

    private graph: Graph
    private callbacks: Partial<InterractionCallbacks>

    private selectedNode: NodeSelection<TElement> | null = null
    private selectedEdge: EdgeSelection<TElement> | null = null

    constructor(graph: Graph) {
        this.graph = graph
        this.callbacks = this.graph.getCallbacks() ?? {}
    }

    public nodeClick(element: TElement, event: PointerEvent, node: Node): void {
        this.selectNode(element, node)
        if (this.callbacks.onNodeClick && typeof this.callbacks.onNodeClick === 'function') {
            this.callbacks.onNodeClick(event, node, element)
        }
    }

    public nodeDbclick(element: TElement, event: PointerEvent, node: Node): void {
        if (this.callbacks.onNodeDbclick && typeof this.callbacks.onNodeDbclick === 'function') {
            this.callbacks.onNodeDbclick(event, node, element)
        }
    }

    public nodeHoverIn = (element: TElement, event: PointerEvent, node: Node): void => {
        if (this.callbacks.onNodeHoverIn && typeof this.callbacks.onNodeHoverIn === 'function') {
            this.callbacks.onNodeHoverIn(event, node, element)
        }
    }

    public nodeHoverOut = (element: TElement, event: PointerEvent, node: Node): void => {
        if (this.callbacks.onNodeHoverOut && typeof this.callbacks.onNodeHoverOut === 'function') {
            this.callbacks.onNodeHoverOut(event, node, element)
        }
    }

    public edgeClick(element: TElement, event: PointerEvent, edge: Edge): void {
        this.selectEdge(element, edge)
        if (this.callbacks.onEdgeClick && typeof this.callbacks.onEdgeClick === 'function') {
            this.callbacks.onEdgeClick(event, edge, element)
        }
    }

    public edgeDbclick(element: TElement, event: PointerEvent, edge: Edge): void {
        if (this.callbacks.onEdgeDbclick && typeof this.callbacks.onEdgeDbclick === 'function') {
            this.callbacks.onEdgeDbclick(event, edge, element)
        }
    }

    public edgeHoverIn(element: TElement, event: PointerEvent, edge: Edge): void {
        if (this.callbacks.onEdgeHoverIn && typeof this.callbacks.onNodeHoverIn === 'function') {
            this.callbacks.onEdgeHoverIn(event, edge, element)
        }
    }

    public edgeHoverOut(element: TElement, event: PointerEvent, edge: Edge): void {
        if (this.callbacks.onEdgeHoverOut && typeof this.callbacks.onNodeHoverOut === 'function') {
            this.callbacks.onEdgeHoverOut(event, edge, element)
        }
    }

    public canvasClick(event: PointerEvent): void {
        this.unselectNode()
        this.unselectEdge()
        if (this.callbacks.onCanvasClick && typeof this.callbacks.onCanvasClick === 'function') {
            this.callbacks.onCanvasClick(event)
        }
    }

    public selectNode(element: TElement, node: Node): void {
        this.unselectNode()
        this.selectedNode = {
            node: node,
            element: element,
        }
        if (this.callbacks.onNodeSelect && typeof this.callbacks.onNodeSelect === 'function') {
            this.callbacks.onNodeSelect(node, element)
        }
    }

    public unselectNode(): void {
        if (this.selectedNode === null)
            return
        const oldSelectionNode = this.selectedNode.node
        const oldSelectionElement = this.selectedNode.element
        this.selectedNode = null
        if (this.callbacks.onNodeBlur && typeof this.callbacks.onNodeBlur === 'function') {
            this.callbacks.onNodeBlur(oldSelectionNode, oldSelectionElement)
        }
    }

    public selectEdge(element: TElement, edge: Edge): void {
        this.unselectEdge()
        this.selectedEdge = {
            edge: edge,
            element: element,
        }
        if (this.callbacks.onEdgeSelect && typeof this.callbacks.onEdgeSelect === 'function') {
            this.callbacks.onEdgeSelect(edge, element)
        }
    }

    public unselectEdge(): void {
        if (this.selectedEdge === null)
            return
        const oldSelectionNode = this.selectedEdge.edge
        const oldSelectionElement = this.selectedEdge.element
        this.selectedEdge = null
        if (this.callbacks.onEdgeBlur && typeof this.callbacks.onEdgeBlur === 'function') {
            this.callbacks.onEdgeBlur(oldSelectionNode, oldSelectionElement)
        }
    }

}