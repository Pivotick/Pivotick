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

type GraphInteractionEvents<TElement> = {
    nodeClick: (event: PointerEvent, node: Node, element: TElement) => void;
    nodeDbclick: (event: PointerEvent, node: Node, element: TElement) => void;
    nodeHoverIn: (event: PointerEvent, node: Node, element: TElement) => void;
    nodeHoverOut: (event: PointerEvent, node: Node, element: TElement) => void;
    nodeSelect: (node: Node, element: TElement) => void;
    nodeBlur: (node: Node, element: TElement) => void;

    edgeClick: (event: PointerEvent, edge: Edge, element: TElement) => void;
    edgeDbclick: (event: PointerEvent, edge: Edge, element: TElement) => void;
    edgeHoverIn: (event: PointerEvent, edge: Edge, element: TElement) => void;
    edgeHoverOut: (event: PointerEvent, edge: Edge, element: TElement) => void;
    edgeSelect: (edge: Edge, element: TElement) => void;
    edgeBlur: (edge: Edge, element: TElement) => void;

    canvasClick: (event: PointerEvent) => void;

    selectNode: (node: Node, element: TElement) => void;
    unselectNode: (node: Node, element: TElement) => void;
    selectEdge: (edge: Edge, element: TElement) => void;
    unselectEdge: (edge: Edge, element: TElement) => void;
}

export class GraphInteractions<TElement = unknown> {

    private graph: Graph
    private callbacks: Partial<InterractionCallbacks>
    private listeners: { [K in keyof GraphInteractionEvents<TElement>]: GraphInteractionEvents<TElement>[K][] }

    private selectedNode: NodeSelection<TElement> | null = null
    private selectedEdge: EdgeSelection<TElement> | null = null

    constructor(graph: Graph) {
        this.graph = graph
        this.callbacks = this.graph.getCallbacks() ?? {}
        this.listeners = {
            nodeClick: [], nodeDbclick: [], nodeHoverIn: [], nodeHoverOut: [],
            nodeSelect: [], nodeBlur: [],
            edgeClick: [], edgeDbclick: [], edgeHoverIn: [], edgeHoverOut: [],
            edgeSelect: [], edgeBlur: [],
            canvasClick: [],
            selectNode: [], unselectNode: [], selectEdge: [], unselectEdge: [],
        }
    }

    public on<K extends keyof GraphInteractionEvents<TElement>>(
        event: K,
        handler: GraphInteractionEvents<TElement>[K]
    ): void {
        this.listeners[event].push(handler)
    }

    public off<K extends keyof GraphInteractionEvents<TElement>>(
        event: K,
        handler: GraphInteractionEvents<TElement>[K]
    ): void {
        this.listeners[event] = this.listeners[event].filter(h => h !== handler)
    }

    private emit<K extends keyof GraphInteractionEvents<TElement>>(
        event: K,
        ...args: Parameters<GraphInteractionEvents<TElement>[K]>
    ): void {
        for (const handler of this.listeners[event]) {
            handler(...args)
        }
    }

    public nodeClick(element: TElement, event: PointerEvent, node: Node): void {
        this.selectNode(element, node)
        this.emit('nodeClick', event, node, element)
        if (this.callbacks.onNodeClick && typeof this.callbacks.onNodeClick === 'function') {
            this.callbacks.onNodeClick(event, node, element)
        }
    }

    public nodeDbclick(element: TElement, event: PointerEvent, node: Node): void {
        this.emit('nodeDbclick', event, node, element)
        if (this.callbacks.onNodeDbclick && typeof this.callbacks.onNodeDbclick === 'function') {
            this.callbacks.onNodeDbclick(event, node, element)
        }
    }

    public nodeHoverIn = (element: TElement, event: PointerEvent, node: Node): void => {
        this.emit('nodeHoverIn', event, node, element)
        if (this.callbacks.onNodeHoverIn && typeof this.callbacks.onNodeHoverIn === 'function') {
            this.callbacks.onNodeHoverIn(event, node, element)
        }
    }

    public nodeHoverOut = (element: TElement, event: PointerEvent, node: Node): void => {
        this.emit('nodeHoverOut', event, node, element)
        if (this.callbacks.onNodeHoverOut && typeof this.callbacks.onNodeHoverOut === 'function') {
            this.callbacks.onNodeHoverOut(event, node, element)
        }
    }

    public edgeClick(element: TElement, event: PointerEvent, edge: Edge): void {
        this.selectEdge(element, edge)
        this.emit('edgeClick', event, edge, element)
        if (this.callbacks.onEdgeClick && typeof this.callbacks.onEdgeClick === 'function') {
            this.callbacks.onEdgeClick(event, edge, element)
        }
    }

    public edgeDbclick(element: TElement, event: PointerEvent, edge: Edge): void {
        this.emit('edgeDbclick', event, edge, element)
        if (this.callbacks.onEdgeDbclick && typeof this.callbacks.onEdgeDbclick === 'function') {
            this.callbacks.onEdgeDbclick(event, edge, element)
        }
    }

    public edgeHoverIn(element: TElement, event: PointerEvent, edge: Edge): void {
        this.emit('edgeHoverIn', event, edge, element)
        if (this.callbacks.onEdgeHoverIn && typeof this.callbacks.onNodeHoverIn === 'function') {
            this.callbacks.onEdgeHoverIn(event, edge, element)
        }
    }

    public edgeHoverOut(element: TElement, event: PointerEvent, edge: Edge): void {
        this.emit('edgeHoverOut', event, edge, element)
        if (this.callbacks.onEdgeHoverOut && typeof this.callbacks.onNodeHoverOut === 'function') {
            this.callbacks.onEdgeHoverOut(event, edge, element)
        }
    }

    public canvasClick(event: PointerEvent): void {
        this.unselectNode()
        this.unselectEdge()
        this.emit('canvasClick', event)
        if (this.callbacks.onCanvasClick && typeof this.callbacks.onCanvasClick === 'function') {
            this.callbacks.onCanvasClick(event)
        }
    }

    public selectNode(element: TElement, node: Node): void {
        this.unselectAll()
        this.selectedNode = {
            node: node,
            element: element,
        }
        this.emit('selectNode', node, element)
        if (this.callbacks.onNodeSelect && typeof this.callbacks.onNodeSelect === 'function') {
            this.callbacks.onNodeSelect(node, element)
        }
        node.markDirty()
        this.refreshRendering()
    }

    public unselectNode(): void {
        if (this.selectedNode === null)
            return
        this.selectedNode.node.markDirty()
        const oldSelectionNode = this.selectedNode.node
        const oldSelectionElement = this.selectedNode.element
        this.selectedNode = null
        this.emit('unselectNode', oldSelectionNode, oldSelectionElement)
        if (this.callbacks.onNodeBlur && typeof this.callbacks.onNodeBlur === 'function') {
            this.callbacks.onNodeBlur(oldSelectionNode, oldSelectionElement)
        }
        this.refreshRendering()
    }

    public selectEdge(element: TElement, edge: Edge): void {
        this.unselectAll()
        this.selectedEdge = {
            edge: edge,
            element: element,
        }
        this.emit('selectEdge', edge, element)
        if (this.callbacks.onEdgeSelect && typeof this.callbacks.onEdgeSelect === 'function') {
            this.callbacks.onEdgeSelect(edge, element)
        }
        edge.markDirty()
        this.refreshRendering()
    }

    public unselectEdge(): void {
        if (this.selectedEdge === null)
            return
        this.selectedEdge.edge.markDirty()
        const oldSelectionEdge = this.selectedEdge.edge
        const oldSelectionElement = this.selectedEdge.element
        this.selectedEdge = null
        this.emit('unselectEdge', oldSelectionEdge, oldSelectionElement)
        if (this.callbacks.onEdgeBlur && typeof this.callbacks.onEdgeBlur === 'function') {
            this.callbacks.onEdgeBlur(oldSelectionEdge, oldSelectionElement)
        }
        this.refreshRendering()
    }

    public unselectAll(): void {
        this.unselectNode()
        this.unselectEdge()
    }

    public refreshRendering(): void {
        this.graph.renderer.dataUpdate()
        this.graph.renderer.tickUpdate()
    }

    public getSelectedNode(): NodeSelection<TElement> | null {
        return this.selectedNode
    }

    public getSelectedEdge(): EdgeSelection<TElement> | null {
        return this.selectedEdge
    }

}