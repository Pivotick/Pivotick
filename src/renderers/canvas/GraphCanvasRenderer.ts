import { select as d3Select, zoom as d3Zoom, type ZoomBehavior, zoomIdentity } from 'd3'
import { Graph } from '../../Graph'
import { Node } from '../../Node'
import { Edge } from '../../Edge'
import { NodeDrawer } from './NodeDrawer'
import { EdgeDrawer } from './EdgeDrawer'
import { GraphRenderer } from '../../GraphRenderer'
import { GraphInteractions } from '../../GraphInteractions'
import type { GraphSvgRendererOptions } from '../../GraphOptions'
import merge from 'lodash.merge'

const DEFAULT_RENDERER_OPTIONS = {
    minZoom: 0.1,
    maxZoom: 10,
    defaultNodeStyle: {
        shape: 'circle',
        color: '#007acc',
        size: 10,
        strokeColor: '#fff',
        strokeWidth: 2,
    },
    defaultEdgeStyle: {
        strokeColor: '#999',
        strokeWidth: 2,
        opacity: 0.8,
        curveStyle: 'bidirectional',
    },
} satisfies GraphSvgRendererOptions

export class GraphCanvasRenderer extends GraphRenderer {
    protected options: GraphSvgRendererOptions

    private graphInteraction: GraphInteractions
    private canvas: HTMLCanvasElement
    private context: CanvasRenderingContext2D
    private zoomBehavior: ZoomBehavior<HTMLCanvasElement, unknown>
    private transform = zoomIdentity

    public nodeDrawer: NodeDrawer
    public edgeDrawer: EdgeDrawer

    constructor(graph: Graph, container: HTMLElement, options: Partial<GraphSvgRendererOptions>) {
        super(graph, container, options)

        this.options = merge({}, DEFAULT_RENDERER_OPTIONS, options)
        this.graphInteraction = new GraphInteractions(this.graph, this)

        this.canvas = document.createElement('canvas')
        this.canvas.width = container.clientWidth
        this.canvas.height = container.clientHeight
        this.context = this.canvas.getContext('2d')!

        container.appendChild(this.canvas)

        this.nodeDrawer = new NodeDrawer(this.options, this.graph)
        this.edgeDrawer = new EdgeDrawer(this.options, this.graph)

        this.zoomBehavior = d3Zoom<HTMLCanvasElement, unknown>()
            .scaleExtent([this.options.minZoom, this.options.maxZoom])
            .on('zoom', (event) => {
                this.transform = event.transform
                this.redraw()
            })

        d3Select(this.canvas).call(this.zoomBehavior)
    }

    public init(): void {
        this.graphInteraction.init()
    }

    public dataUpdate(): void {
        // Nothing to bind here, since canvas is immediate mode.
        this.redraw()
    }

    public tickUpdate(): void {
        this.redraw()
    }

    private clear(): void {
        this.context.save()
        this.context.setTransform(1, 0, 0, 1, 0, 0)
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height)
        this.context.restore()
    }

    private redraw(): void {
        this.clear()
        this.context.save()
        this.context.translate(this.transform.x, this.transform.y)
        this.context.scale(this.transform.k, this.transform.k)

        const edges = this.graph.getEdges()
        for (const edge of edges) {
            this.edgeDrawer.render(this.context, edge)
        }

        const nodes = this.graph.getMutableNodes()
        for (const node of nodes) {
            this.nodeDrawer.render(this.context, node)
        }

        this.context.restore()
    }

    public getCanvas(): HTMLCanvasElement {
        return this.canvas
    }

    public getContext(): CanvasRenderingContext2D {
        return this.context
    }
}
