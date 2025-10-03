import type { Graph } from '../../Graph'
import type { GraphInteractions } from '../../GraphInteractions'
import type { GraphSvgRenderer } from './GraphSvgRenderer'
import type { Node } from '../../Node'
import type { Edge } from '../../Edge'

export class EventHandler {
    private graph: Graph
    private renderer!: GraphSvgRenderer
    private graphInteraction!: GraphInteractions<SVGGElement | SVGPathElement>

    constructor(graph: Graph) {
        this.graph = graph
    }

    public init(renderer: GraphSvgRenderer, graphInteraction: GraphInteractions<SVGGElement | SVGPathElement>): void {
        this.renderer = renderer
        this.graphInteraction = graphInteraction

        this.registerListeners()
    }

    public registerListeners(): void {
        this.renderer.getNodeSelection()
            .call(this.graph.simulation.createDragBehavior())

        this.renderer.getNodeSelection()
            .on('dblclick', (event: PointerEvent, node: Node) => {
                event.stopPropagation()
                const svgNode = event.currentTarget as SVGGElement
                this.graphInteraction?.nodeDbclick(svgNode, event, node)
            })
            .on('click', (event: PointerEvent, node: Node) => {
                event.stopPropagation()
                const svgNode = event.currentTarget as SVGGElement
                this.graphInteraction?.nodeClick(svgNode, event, node)
            })
            .on('contextmenu', (event: PointerEvent, node: Node) => {
                event.preventDefault()
                event.stopPropagation()
                const svgNode = event.currentTarget as SVGGElement
                this.graphInteraction?.nodeContextmenu(svgNode, event, node)
            })
            .on('mouseenter', (event: PointerEvent, node: Node) => {
                const svgNode = event.currentTarget as SVGGElement
                this.graphInteraction?.nodeHoverIn(svgNode, event, node)
            })
            .on('mouseleave', (event: PointerEvent, node: Node) => {
                const svgNode = event.currentTarget as SVGGElement
                this.graphInteraction?.nodeHoverOut(svgNode, event, node)
            })
            .on('dragging', (event: PointerEvent, node: Node) => {
                this.graphInteraction?.dragging(event, node)
            })

        this.renderer.getEdgeSelection()
            .on('dblclick', (event: PointerEvent, edge: Edge) => {
                event.stopPropagation()
                const svgEdge = event.currentTarget as SVGPathElement
                this.graphInteraction?.edgeDbclick(svgEdge, event, edge)
            })
            .on('click', (event: PointerEvent, edge: Edge) => {
                event.stopPropagation()
                const svgEdge = event.currentTarget as SVGPathElement
                this.graphInteraction?.edgeClick(svgEdge, event, edge)
            })
            .on('contextmenu', (event: PointerEvent, edge: Edge) => {
                event.preventDefault()
                event.stopPropagation()
                const svgEdge = event.currentTarget as SVGPathElement
                this.graphInteraction?.edgeContextmenu(svgEdge, event, edge)
            })
            .on('mouseenter', (event: PointerEvent, edge: Edge) => {
                const svgNode = event.currentTarget as SVGPathElement
                this.graphInteraction?.edgeHoverIn(svgNode, event, edge)
            })
            .on('mouseleave', (event: PointerEvent, edge: Edge) => {
                const svgNode = event.currentTarget as SVGPathElement
                this.graphInteraction?.edgeHoverOut(svgNode, event, edge)
            })

        this.renderer.getCanvasSelection()
            .on('click', (event: PointerEvent) => {
                this.graphInteraction?.canvasClick(event)
            })
            .on('contextmenu', (event: PointerEvent) => {
                event.preventDefault()
                this.graphInteraction?.canvasContextmenu(event)
            })
            .on('mousemove', (event: PointerEvent) => {
                this.graphInteraction?.canvasMousemove(event)
            })
    }
}