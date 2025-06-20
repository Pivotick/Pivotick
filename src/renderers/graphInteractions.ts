import type { Graph } from '../graph'
import type { InterractionCallbacks } from '../graph-options'
import type { Node } from '../node'
import type { Edge } from '../edge'
import type { SvgRenderer } from './svgRenderer'
import { select as d3Select, type Selection } from 'd3-selection'



export class GraphInteractions {

    private graph: Graph
    private renderer: SvgRenderer
    private callbacks: Partial<InterractionCallbacks>

    constructor(graph: Graph, renderer: SvgRenderer) {
        this.graph = graph
        this.renderer = renderer
        this.callbacks = this.graph.getCallbacks() ?? {}
    }

    public init() {

        this.renderer.getNodeSelection()
            .call(this.graph.simulation.createDragBehavior())

        this.renderer.getNodeSelection()
            .on('dblclick', (event: PointerEvent, node: Node) => {
                const svgNode = event.currentTarget as SVGGElement
                this.nodeDbclick(svgNode, event, node)
            })
            .on('click', (event: PointerEvent, node: Node) => {
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
                const svgEdge = event.currentTarget as SVGLineElement
                this.edgeDbclick(svgEdge, event, edge)
            })
            .on('click', (event: PointerEvent, edge: Edge) => {
                const svgEdge = event.currentTarget as SVGLineElement
                this.edgeClick(svgEdge, event, edge)
            })
            .on('mouseenter', (event: PointerEvent, edge: Edge) => {
                const svgNode = event.currentTarget as SVGLineElement
                this.edgeHoverIn(svgNode, event, edge)
            })
            .on('mouseleave', (event: PointerEvent, edge: Edge) => {
                const svgNode = event.currentTarget as SVGLineElement
                this.edgeHoverOut(svgNode, event, edge)
            })

    }

    private nodeClick(svgNode: SVGGElement, event: PointerEvent, node: Node): void {
        if (this.callbacks.onNodeClick && typeof this.callbacks.onNodeClick === 'function') {
            this.callbacks.onNodeClick(event, node, svgNode)
        }
    }

    private nodeDbclick(svgNode: SVGGElement, event: PointerEvent, node: Node): void {
        if (this.callbacks.onNodeDbclick && typeof this.callbacks.onNodeDbclick === 'function') {
            this.callbacks.onNodeDbclick(event, node, svgNode)
        }
    }

    private nodeHoverIn = (svgNode: SVGGElement, event: PointerEvent, node: Node) => {
        if (this.callbacks.onNodeHoverIn && typeof this.callbacks.onNodeHoverIn === 'function') {
            this.callbacks.onNodeHoverIn(event, node, svgNode)
        }
    }

    private nodeHoverOut = (svgNode: SVGGElement, event: PointerEvent, node: Node) => {
        if (this.callbacks.onNodeHoverOut && typeof this.callbacks.onNodeHoverOut === 'function') {
            this.callbacks.onNodeHoverOut(event, node, svgNode)
        }
    }

    private edgeClick(svgEdge: SVGLineElement, event: PointerEvent, edge: Edge): void {
        if (this.callbacks.onEdgeClick && typeof this.callbacks.onEdgeClick === 'function') {
            this.callbacks.onEdgeClick(event, edge, svgEdge)
        }
    }

    private edgeDbclick(svgEdge: SVGLineElement, event: PointerEvent, edge: Edge): void {
        if (this.callbacks.onEdgeDbclick && typeof this.callbacks.onEdgeDbclick === 'function') {
            this.callbacks.onEdgeDbclick(event, edge, svgEdge)
        }
    }

    private edgeHoverIn(svgEdge: SVGLineElement, event: PointerEvent, edge: Edge) {
        if (this.callbacks.onEdgeHoverIn && typeof this.callbacks.onNodeHoverIn === 'function') {
            this.callbacks.onEdgeHoverIn(event, edge, svgEdge)
        }
    }

    private edgeHoverOut(svgEdge: SVGLineElement, event: PointerEvent, edge: Edge) {
        if (this.callbacks.onEdgeHoverOut && typeof this.callbacks.onNodeHoverOut === 'function') {
            this.callbacks.onEdgeHoverOut(event, edge, svgEdge)
        }
    }

}