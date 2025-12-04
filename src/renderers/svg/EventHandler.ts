import type { Graph } from '../../Graph'
import type { GraphSvgRenderer } from './GraphSvgRenderer'
import type { Node } from '../../Node'
import type { Edge } from '../../Edge'
import type { GraphInteractions } from '../../GraphInteractions'

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

    public update(): void {
        // TODO: Only add registration to new nodes
        this.registerListeners()
    }

    public registerListeners(): void {
        if (this.renderer.getOptions().dragEnabled) {
            this.renderer.getNodeSelection()
                .call(this.graph.simulation.createDragBehavior())
        }

        this.renderer.getNodeSelection()
            .on('dblclick.node', (event: PointerEvent, node: Node) => {
                event.stopPropagation()
                const svgNode = event.currentTarget as SVGGElement
                this.graphInteraction?.nodeDbclick(svgNode, event, node)
            })
            .on('click.node', (event: PointerEvent, node: Node) => {
                event.stopPropagation()
                const svgNode = event.currentTarget as SVGGElement
                this.graphInteraction?.nodeClick(svgNode, event, node)
            })
            .on('contextmenu.node', (event: PointerEvent, node: Node) => {
                event.preventDefault()
                event.stopPropagation()
                const svgNode = event.currentTarget as SVGGElement
                this.graphInteraction?.nodeContextmenu(svgNode, event, node)
            })
            .on('mouseenter.node', (event: PointerEvent, node: Node) => {
                const svgNode = event.currentTarget as SVGGElement
                this.graphInteraction?.nodeHoverIn(svgNode, event, node)
            })
            .on('mouseleave.node', (event: PointerEvent, node: Node) => {
                const svgNode = event.currentTarget as SVGGElement
                this.graphInteraction?.nodeHoverOut(svgNode, event, node)
            })
            .on('dragging.node', (event: PointerEvent, node: Node) => {
                this.graphInteraction?.dragging(event, node)
            })

        this.renderer.getEdgeSelection()
            .on('dblclick.edge', (event: PointerEvent, edge: Edge) => {
                event.stopPropagation()
                const svgEdge = event.currentTarget as SVGPathElement
                this.graphInteraction?.edgeDbclick(svgEdge, event, edge)
            })
            .on('click.edge', (event: PointerEvent, edge: Edge) => {
                event.stopPropagation()
                const svgEdge = event.currentTarget as SVGPathElement
                this.graphInteraction?.edgeClick(svgEdge, event, edge)
            })
            .on('contextmenu.edge', (event: PointerEvent, edge: Edge) => {
                event.preventDefault()
                event.stopPropagation()
                const svgEdge = event.currentTarget as SVGPathElement
                this.graphInteraction?.edgeContextmenu(svgEdge, event, edge)
            })
            .on('mouseenter.edge', (event: PointerEvent, edge: Edge) => {
                const svgNode = event.currentTarget as SVGPathElement
                this.graphInteraction?.edgeHoverIn(svgNode, event, edge)
            })
            .on('mouseleave.edge', (event: PointerEvent, edge: Edge) => {
                const svgNode = event.currentTarget as SVGPathElement
                this.graphInteraction?.edgeHoverOut(svgNode, event, edge)
            })

        this.renderer.getCanvasSelection()
            .on('click.canvas', (event: PointerEvent) => {
                this.graphInteraction?.canvasClick(event)
            })
            .on('contextmenu.canvas', (event: PointerEvent) => {
                event.preventDefault()
                this.graphInteraction?.canvasContextmenu(event)
            })
            .on('mousemove.canvas', (event: PointerEvent) => {
                this.graphInteraction?.canvasMousemove(event)
            })
    }
}