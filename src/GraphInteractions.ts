import type { Graph } from './Graph'
import type { InterractionCallbacks } from './GraphOptions'
import type { Node } from './Node'
import type { Edge } from './Edge'


export interface NodeSelection<TElement> {
    node: Node,
    element: TElement,
}

export interface EdgeSelection<TElement> {
    edge: Edge,
    element: TElement,
}

type GraphInteractionEvents<TElement> = {
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

    selectNode: (node: Node, element: TElement) => void;
    unselectNode: (node: Node, element: TElement) => void;
    selectNodes: (nodes: NodeSelection<TElement>[]) => void;
    unselectNodes: (nodes: NodeSelection<TElement>[]) => void;

    selectEdge: (edge: Edge, element: TElement) => void;
    unselectEdge: (edge: Edge, element: TElement) => void;
    selectEdges: (edges: EdgeSelection<TElement>[]) => void;
    unselectEdges: (edges: EdgeSelection<TElement>[]) => void;
}

export class GraphInteractions<TElement = unknown> {

    private graph: Graph
    private callbacks: Partial<InterractionCallbacks>
    private listeners: Record<keyof GraphInteractionEvents<TElement>, Array<GraphInteractionEvents<TElement>[keyof GraphInteractionEvents<TElement>]>>

    private selectedNode: NodeSelection<TElement> | null = null
    private selectedEdge: EdgeSelection<TElement> | null = null
    private selectedNodes: NodeSelection<TElement>[] = []
    private selectedEdges: EdgeSelection<TElement>[] = []

    constructor(graph: Graph) {
        this.graph = graph
        this.callbacks = this.graph.getCallbacks() ?? {}
        this.listeners = {
            nodeClick: [], nodeDbclick: [], nodeHoverIn: [], nodeHoverOut: [],
            nodeSelect: [], nodeBlur: [], dragging: [], nodeContextmenu: [],
            edgeClick: [], edgeDbclick: [], edgeHoverIn: [], edgeHoverOut: [],
            edgeSelect: [], edgeBlur: [], edgeContextmenu: [],
            canvasClick: [], canvasMousemove: [], canvasContextmenu: [], canvasZoom: [],
            selectNode: [], unselectNode: [], selectEdge: [], unselectEdge: [],
            selectNodes: [], unselectNodes: [], selectEdges: [], unselectEdges: [],
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

    public getGraph(): Graph {
        return this.graph
    }

    private emit<K extends keyof GraphInteractionEvents<TElement>>(
        event: K,
        ...args: Parameters<GraphInteractionEvents<TElement>[K]>
    ): void {
        for (const handler of this.listeners[event]) {
            (handler as (...args: Parameters<GraphInteractionEvents<TElement>[K]>) => void)(...args)
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

    public nodeContextmenu(element: TElement, event: PointerEvent, node: Node): void {
        this.emit('nodeContextmenu', event, node, element)
        if (this.callbacks.onNodeContextmenu && typeof this.callbacks.onNodeContextmenu === 'function') {
            this.callbacks.onNodeContextmenu(event, node, element)
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

    public dragging = (event: PointerEvent, node: Node): void => {
        this.emit('dragging', event, node)
        if (this.callbacks.onNodeDragging && typeof this.callbacks.onNodeDragging === 'function') {
            this.callbacks.onNodeDragging(event, node)
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

    public edgeContextmenu(element: TElement, event: PointerEvent, edge: Edge): void {
        this.emit('edgeContextmenu', event, edge, element)
        if (this.callbacks.onEdgeContextmenu && typeof this.callbacks.onEdgeContextmenu === 'function') {
            this.callbacks.onEdgeContextmenu(event, edge, element)
        }
    }

    public edgeHoverIn(element: TElement, event: PointerEvent, edge: Edge): void {
        this.emit('edgeHoverIn', event, edge, element)
        if (this.callbacks.onEdgeHoverIn && typeof this.callbacks.onEdgeHoverIn === 'function') {
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
        this.unselectAll()
        this.emit('canvasClick', event)
        if (this.callbacks.onCanvasClick && typeof this.callbacks.onCanvasClick === 'function') {
            this.callbacks.onCanvasClick(event)
        }
    }

    public canvasZoom(event: unknown): void {
        this.unselectAll()
        this.emit('canvasZoom', event)
        if (this.callbacks.onCanvasZoom && typeof this.callbacks.onCanvasZoom === 'function') {
            this.callbacks.onCanvasZoom(event)
        }
    }

    public canvasContextmenu(event: PointerEvent): void {
        this.emit('canvasContextmenu', event)
        if (this.callbacks.onCanvasContextmenu && typeof this.callbacks.onCanvasContextmenu === 'function') {
            this.callbacks.onCanvasContextmenu(event)
        }
    }

    public canvasMousemove(event: MouseEvent): void {
        this.emit('canvasMousemove', event)
        if (this.callbacks.onCanvasMousemove && typeof this.callbacks.onCanvasMousemove === 'function') {
            this.callbacks.onCanvasMousemove(event)
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

    public selectNodes(selection: Array<[Node, TElement]>): void {
        this.unselectAll()
        this.selectedNodes = selection.map((selection) => {
            return {
                node: selection[0],
                element: selection[1],
            }
        })
        this.emit('selectNodes', this.selectedNodes)
        this.selectedNodes.forEach(({ node, element }) => {
            if (this.callbacks.onNodeSelect && typeof this.callbacks.onNodeSelect === 'function') {
                this.callbacks.onNodeSelect(node, element)
            }
            node.markDirty()
        })
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

    public selectEdges(selection: Array<[Edge, TElement]>): void {
        this.unselectAll()
        this.selectedEdges = selection.map((selection) => {
            return {
                edge: selection[0],
                element: selection[1],
            }
        })
        this.emit('selectEdges', this.selectedEdges)
        this.selectedEdges.forEach(({ edge, element }) => {
            if (this.callbacks.onEdgeSelect && typeof this.callbacks.onEdgeSelect === 'function') {
                this.callbacks.onEdgeSelect(edge, element)
            }
            edge.markDirty()
        })
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
        this.clearNodeSelectionList()
        this.clearEdgeSelectionList()
        this.refreshRendering()
    }

    public clearNodeSelectionList(): void {
        this.emit('unselectNodes', this.selectedNodes)
        this.selectedNodes.forEach(({ node, element }) => {
            if (this.callbacks.onNodeBlur && typeof this.callbacks.onNodeBlur === 'function') {
                this.callbacks.onNodeBlur(node, element)
            }
            node.markDirty()
        })
        this.selectedNodes = []
    }

    public clearEdgeSelectionList(): void {
        this.emit('unselectEdges', this.selectedEdges)
        this.selectedEdges.forEach(({ edge, element }) => {
            if (this.callbacks.onEdgeBlur && typeof this.callbacks.onEdgeBlur === 'function') {
                this.callbacks.onEdgeBlur(edge, element)
            }
            edge.markDirty()
        })
        this.selectedEdges = []
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

    public getSelectedNodeIDs(): string[] | null {
        return this.selectedNodes?.map(selection => selection.node.id) ?? null
    }

    public getSelectedEdgeIDs(): string[] | null {
        return this.selectedEdges?.map(selection => selection.edge.id) ?? null
    }

}