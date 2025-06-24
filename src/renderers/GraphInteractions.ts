import type { Graph } from '../Graph'
import type { InterractionCallbacks } from '../GraphOptions'
import type { Node, NodeData } from '../Node'
import type { Edge } from '../Edge'
import type { GraphSvgRenderer } from './GraphSvgRenderer'
import { select as d3Select, type Selection } from 'd3-selection'


interface NodeSelection {
    node: Node,
    svgNode: SVGGElement,
}

interface EdgeSelection {
    edge: Edge,
    svgEdge: SVGPathElement,
}


export class GraphInteractions {

    private graph: Graph
    private renderer: GraphSvgRenderer
    private callbacks: Partial<InterractionCallbacks>

    private selectedNode: NodeSelection | null = null
    private selectedEdge: EdgeSelection | null = null

    constructor(graph: Graph, renderer: GraphSvgRenderer) {
        this.graph = graph
        this.renderer = renderer
        this.callbacks = this.graph.getCallbacks() ?? {}
    }

    public init() {

        this.renderer.getNodeSelection()
            .call(this.graph.simulation.createDragBehavior())

        this.renderer.getNodeSelection()
            .on('dblclick', (event: PointerEvent, node: Node) => {
                event.stopPropagation()
                const svgNode = event.currentTarget as SVGGElement
                this.nodeDbclick(svgNode, event, node)
            })
            .on('click', (event: PointerEvent, node: Node) => {
                event.stopPropagation()
                const svgNode = event.currentTarget as SVGGElement
                this.nodeClick(svgNode, event, node)
            })
            .on('mouseenter', (event: PointerEvent, node: Node) => {
                const svgNode = event.currentTarget as SVGGElement
                this.nodeHoverIn(svgNode, event, node)
            })
            .on('mouseleave', (event: PointerEvent, node: Node) => {
                const svgNode = event.currentTarget as SVGGElement
                this.nodeHoverOut(svgNode, event, node)
            })

        this.renderer.getEdgeSelection()
            .on('dblclick', (event: PointerEvent, edge: Edge) => {
                event.stopPropagation()
                const svgEdge = event.currentTarget as SVGPathElement
                this.edgeDbclick(svgEdge, event, edge)
            })
            .on('click', (event: PointerEvent, edge: Edge) => {
                event.stopPropagation()
                const svgEdge = event.currentTarget as SVGPathElement
                this.edgeClick(svgEdge, event, edge)
            })
            .on('mouseenter', (event: PointerEvent, edge: Edge) => {
                const svgNode = event.currentTarget as SVGPathElement
                this.edgeHoverIn(svgNode, event, edge)
            })
            .on('mouseleave', (event: PointerEvent, edge: Edge) => {
                const svgNode = event.currentTarget as SVGPathElement
                this.edgeHoverOut(svgNode, event, edge)
            })

        this.renderer.getCanvasSelection()
            .on('click', () => {
                this.unselectNode()
                this.unselectEdge()
            })

    }

    private nodeClick(svgNode: SVGGElement, event: PointerEvent, node: Node): void {
        this.selectNode(svgNode, node)
        if (this.callbacks.onNodeClick && typeof this.callbacks.onNodeClick === 'function') {
            this.callbacks.onNodeClick(event, node, svgNode)
        }
    }

    private nodeDbclick(svgNode: SVGGElement, event: PointerEvent, node: Node): void {
        if (this.callbacks.onNodeDbclick && typeof this.callbacks.onNodeDbclick === 'function') {
            this.callbacks.onNodeDbclick(event, node, svgNode)
        }
    }

    private nodeHoverIn = (svgNode: SVGGElement, event: PointerEvent, node: Node): void => {
        if (this.callbacks.onNodeHoverIn && typeof this.callbacks.onNodeHoverIn === 'function') {
            this.callbacks.onNodeHoverIn(event, node, svgNode)
        }
    }

    private nodeHoverOut = (svgNode: SVGGElement, event: PointerEvent, node: Node): void => {
        if (this.callbacks.onNodeHoverOut && typeof this.callbacks.onNodeHoverOut === 'function') {
            this.callbacks.onNodeHoverOut(event, node, svgNode)
        }
    }

    private edgeClick(svgEdge: SVGPathElement, event: PointerEvent, edge: Edge): void {
        this.selectEdge(svgEdge, edge)
        if (this.callbacks.onEdgeClick && typeof this.callbacks.onEdgeClick === 'function') {
            this.callbacks.onEdgeClick(event, edge, svgEdge)
        }
    }

    private edgeDbclick(svgEdge: SVGPathElement, event: PointerEvent, edge: Edge): void {
        if (this.callbacks.onEdgeDbclick && typeof this.callbacks.onEdgeDbclick === 'function') {
            this.callbacks.onEdgeDbclick(event, edge, svgEdge)
        }
    }

    private edgeHoverIn(svgEdge: SVGPathElement, event: PointerEvent, edge: Edge): void {
        if (this.callbacks.onEdgeHoverIn && typeof this.callbacks.onNodeHoverIn === 'function') {
            this.callbacks.onEdgeHoverIn(event, edge, svgEdge)
        }
    }

    private edgeHoverOut(svgEdge: SVGPathElement, event: PointerEvent, edge: Edge): void {
        if (this.callbacks.onEdgeHoverOut && typeof this.callbacks.onNodeHoverOut === 'function') {
            this.callbacks.onEdgeHoverOut(event, edge, svgEdge)
        }
    }

    private selectNode(svgNode: SVGGElement, node: Node): void {
        this.unselectNode()
        this.selectedNode = {
            node: node,
            svgNode: svgNode,
        }
        if (this.callbacks.onNodeSelect && typeof this.callbacks.onNodeSelect === 'function') {
            this.callbacks.onNodeSelect(node, svgNode)
        }
    }

    private unselectNode(): void {
        if (this.selectedNode === null)
            return
        const oldSelectionNode = this.selectedNode.node
        const oldSelectionSvgNode = this.selectedNode.svgNode
        this.selectedNode = null
        if (this.callbacks.onNodeBlur && typeof this.callbacks.onNodeBlur === 'function') {
            this.callbacks.onNodeBlur(oldSelectionNode, oldSelectionSvgNode)
        }
    }

    private selectEdge(svgEdge: SVGPathElement, edge: Edge): void {
        this.unselectEdge()
        this.selectedEdge = {
            edge: edge,
            svgEdge: svgEdge,
        }
        if (this.callbacks.onEdgeSelect && typeof this.callbacks.onEdgeSelect === 'function') {
            this.callbacks.onEdgeSelect(edge, svgEdge)
        }
    }

    private unselectEdge(): void {
        if (this.selectedEdge === null)
            return
        const oldSelectionNode = this.selectedEdge.edge
        const oldSelectionSvgNode = this.selectedEdge.svgEdge
        this.selectedEdge = null
        if (this.callbacks.onEdgeBlur && typeof this.callbacks.onEdgeBlur === 'function') {
            this.callbacks.onEdgeBlur(oldSelectionNode, oldSelectionSvgNode)
        }
    }

}