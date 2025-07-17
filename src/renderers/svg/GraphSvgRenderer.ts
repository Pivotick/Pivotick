import { select as d3Select, type Selection } from 'd3-selection'
import { zoom as d3Zoom, type ZoomBehavior } from 'd3-zoom'
import { Edge } from '../../Edge'
import { Node } from '../../Node'
import { NodeDrawer } from './NodeDrawer'
import { EdgeDrawer } from './EdgeDrawer'
import { EventHandler } from './EventHandler'
import type { Graph } from '../../Graph'
import type { GraphRendererOptions } from '../../GraphOptions'
import merge from 'lodash.merge'
import { GraphInteractions } from '../../GraphInteractions'
import { GraphRenderer } from '../../GraphRenderer'


const DEFAULT_RENDERER_OPTIONS = {
    type: 'svg',
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
        opacity: 1.0,
        curveStyle: 'bidirectional',
        rotateLabel: false,
        markerEnd: 'default_arrow',
        markerStart: undefined,
    },
    defaultLabelStyle: {
        backgroundColor: '#ffffff90',
        fontSize: 12,
        color: '#333',
    },
    markerStyleMap: {
        'circle': {
            size: 10,
            fill: '#999',
            pathD: 'M5,5m-3,0a3,3 0 1,0 6,0a3,3 0 1,0 -6,0',
            viewBox: '0 0 10 10',
            refX: 5,
            refY: 5,
            markerUnits: 'userSpaceOnUse',
            orient: 0
        },
        'diamond': {
            size: 8,
            fill: '#999',
            pathD: 'M0,-4L4,0L0,4L-4,0Z',
            viewBox: '-5 -5 10 10',
            refX: 0,
            refY: 0,
            markerUnits: 'userSpaceOnUse',
            orient: 0
        }
    },
} satisfies GraphRendererOptions

export class GraphSvgRenderer extends GraphRenderer {
    protected options: GraphRendererOptions

    private zoom: ZoomBehavior<SVGSVGElement, unknown>
    private graphInteraction: GraphInteractions<SVGGElement | SVGPathElement>
    private eventHandler: EventHandler

    public nodeDrawer: NodeDrawer
    public edgeDrawer: EdgeDrawer

    private svgCanvas: SVGSVGElement
    // private progressBar: SVGRectElement

    private svg: Selection<SVGSVGElement, unknown, null, undefined>
    private zoomGroup: Selection<SVGGElement, unknown, null, undefined>
    private edgeGroup: Selection<SVGGElement, unknown, null, undefined>
    private nodeGroup: Selection<SVGGElement, unknown, null, undefined>
    private defs: Selection<SVGDefsElement, unknown, null, undefined>

    private nodeGroupSelection!: Selection<SVGGElement, Node, SVGGElement, unknown>
    private edgeGroupSelection!: Selection<SVGPathElement, Edge, SVGGElement, unknown>
    private nodeSelection!: Selection<SVGGElement, Node, SVGGElement, unknown>

    /**
     * I tried to add a label to a link
     * So I had to wrap the svg' path into a group
     * Which messed up the rendering since it's not the path but the group that's tied to the update position function
     * Trying to fix this right now.
     */
    
    private edgeSelection!: Selection<SVGGElement, Edge, SVGGElement, unknown>

    // private layoutProgress = 0

    constructor(graph: Graph, container: HTMLElement, graphInteraction: GraphInteractions<SVGGElement | SVGPathElement>, options: Partial<GraphRendererOptions>) {
        super(graph, container, options)

        this.options = merge({}, DEFAULT_RENDERER_OPTIONS, options)

        this.graphInteraction = graphInteraction
        this.eventHandler = new EventHandler(this.graph)
        this.nodeDrawer = new NodeDrawer(this.options, this.graph, this)
        this.edgeDrawer = new EdgeDrawer(this.options, this.graph, this)

        this.svgCanvas = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
        this.svgCanvas.setAttribute('width', '100%')
        this.svgCanvas.setAttribute('height', '100%')
        this.svgCanvas.setAttribute('fill', 'none')

        this.container.appendChild(this.svgCanvas)
        this.svg = d3Select(this.svgCanvas)

        this.zoomGroup = this.svg.append('g').attr('class', 'zoom-layer')
        this.edgeGroup = this.zoomGroup.append('g').attr('class', 'edges')
        this.nodeGroup = this.zoomGroup.append('g').attr('class', 'nodes')
        this.defs = this.svg.append('defs')
        this.edgeDrawer.renderDefinitions(this.defs)

        this.zoom = d3Zoom<SVGSVGElement, unknown>()
        this.svg.call(this.zoom)
        this.svg.on('dblclick.zoom', null)
        this.zoom
            .scaleExtent([this.options.minZoom, this.options.maxZoom])
            .on('zoom', (event) => {
                this.zoomGroup.attr('transform', event.transform)
            })

    }

    public init(): void {
        this.dataUpdate()
        this.eventHandler.init(this, this.graphInteraction)
    }

    public dataUpdate(): void {
        const nodes = this.graph.getMutableNodes()
        this.nodeGroupSelection = this.nodeGroup
            .selectAll<SVGGElement, Node>('g.node-shape')

        this.nodeSelection = this.nodeGroupSelection
            .data(nodes, (node: Node) => node.id)
            .join(
                (enter) => {
                    return enter
                        .append('g').classed('node-shape', true)
                        .each((node: Node, i: number, nodes: ArrayLike<SVGGElement>) => {
                            const selection = d3Select<SVGGElement, Node>(nodes[i])
                            this.nodeDrawer.render(selection, node)
                        })
                },
                (update) => {
                    return update.each((node: Node, i: number, nodes: ArrayLike<SVGGElement>) => {
                        const selection = d3Select<SVGGElement, Node>(nodes[i])
                        selection.selectChildren().remove()
                        this.nodeDrawer.render(selection, node)
                    })
                },
                exit => exit.remove()
            )

        const edges = this.graph.getEdges()
        this.edgeGroupSelection = this.edgeGroup
            .selectAll<SVGPathElement, Edge>('g.edge-group')

        this.edgeSelection = this.edgeGroupSelection
            .data(edges, (edge: Edge) => edge.id)
            .join(
                (enter) => enter
                    .append('g').classed('edge-group', true)
                    .each((edge: Edge, i: number, edges: ArrayLike<SVGGElement>) => {
                        const selection = d3Select<SVGGElement, Edge>(edges[i])
                        this.edgeDrawer.render(selection, edge)
                    }),
                update => update
                    .each((edge: Edge, i: number, edges: ArrayLike<SVGPathElement>) => {
                        const selection = d3Select<SVGGElement, Edge>(edges[i])
                        selection.selectChildren().remove()
                        this.edgeDrawer.render(selection, edge)
                    }),
                exit => exit.remove()
            )
    }

    public getCanvasSelection(): Selection<SVGSVGElement, unknown, null, undefined> {
        return this.svg
    }

    public tickUpdate(): void {
        this.updateEdgePositions() // Render edges first so nodes are drawn on top of them
        this.updateNodePositions()
    }

    private updateNodePositions(): void {
        this.nodeDrawer.updatePositions(this.nodeSelection)
    }

    private updateEdgePositions(): void {
        this.edgeDrawer.updatePositions(this.edgeSelection)
    }

    public getNodeSelection(): Selection<SVGGElement, Node, SVGGElement, unknown> {
        return this.nodeSelection
    }

    public getEdgeSelection(): Selection<SVGGElement, Edge, SVGGElement, unknown> {
        return this.edgeSelection
    }
}
