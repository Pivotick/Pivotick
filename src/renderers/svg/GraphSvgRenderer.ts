import { select as d3Select, type Selection } from 'd3-selection'
import { zoom as d3Zoom, type ZoomBehavior, zoomIdentity as d3ZoomIdentity } from 'd3-zoom'
import { Edge } from '../../Edge'
import { Node } from '../../Node'
import { NodeDrawer } from './NodeDrawer'
import { EdgeDrawer } from './EdgeDrawer'
import { EventHandler } from './EventHandler'
import type { Graph } from '../../Graph'
import merge from 'lodash.merge'
import { GraphInteractions } from '../../GraphInteractions'
import { GraphRenderer } from '../../GraphRenderer'
import { SelectionBox } from './SelectionBox'
import type { EdgeStyle, GraphRendererOptions, LabelStyle, MarkerStyleMap, NodeStyle } from '../../interfaces/RendererOptions'

/**
 * @default
{
    arrow: {
        pathD: 'M0,-5L10,0L0,5',
        viewBox: '0 -5 10 10',
        refX: 5,
        refY: 0,
        markerWidth: 6,
        markerHeight: 6,
        markerUnits: 'userSpaceOnUse',
        orient: 'auto',
        fill: 'var(--pivotick-edge-stroke, #999)',
        selected: {
            fill: 'var(--pivotick-edge-selected-stroke, #007acc)',
            markerWidth: 12,
            markerHeight: 12,
            refX: 6,
        }
    },
    circle: {
        pathD: 'M5,5m-3,0a3,3 0 1,0 6,0a3,3 0 1,0 -6,0',
        viewBox: '0 0 10 10',
        refX: 5,
        refY: 5,
        markerWidth: 10,
        markerHeight: 10,
        markerUnits: 'userSpaceOnUse',
        orient: 0,
        fill: 'var(--pivotick-edge-stroke, #999)',
        selected: {
            fill: 'var(--pivotick-edge-selected-stroke, #007acc)',
            markerWidth: 16,
            markerHeight: 16,
        }
    },
    diamond: {
        pathD: 'M0,-4L4,0L0,4L-4,0Z',
        viewBox: '-5 -5 10 10',
        refX: 0,
        refY: 0,
        markerWidth: 8,
        markerHeight: 8,
        markerUnits: 'userSpaceOnUse',
        orient: 0,
        fill: 'var(--pivotick-edge-stroke, #999)',
        selected: {
            fill: 'var(--pivotick-edge-selected-stroke, #007acc)',
            markerWidth: 14,
            markerHeight: 14,
        }
    }
}
 */
export const defaultMarkerStyleMap: MarkerStyleMap = {
    arrow: {
        pathD: 'M0,-5L10,0L0,5',
        viewBox: '0 -5 10 10',
        refX: 5,
        refY: 0,
        markerWidth: 6,
        markerHeight: 6,
        markerUnits: 'userSpaceOnUse',
        orient: 'auto',
        fill: 'var(--pivotick-edge-stroke, #999)',
        selected: {
            fill: 'var(--pivotick-edge-selected-stroke, #007acc)',
            markerWidth: 12,
            markerHeight: 12,
            refX: 6,
        }
    },
    circle: {
        pathD: 'M5,5m-3,0a3,3 0 1,0 6,0a3,3 0 1,0 -6,0',
        viewBox: '0 0 10 10',
        refX: 5,
        refY: 5,
        markerWidth: 10,
        markerHeight: 10,
        markerUnits: 'userSpaceOnUse',
        orient: 0,
        fill: 'var(--pivotick-edge-stroke, #999)',
        selected: {
            fill: 'var(--pivotick-edge-selected-stroke, #007acc)',
            markerWidth: 16,
            markerHeight: 16,
        }
    },
    diamond: {
        pathD: 'M0,-4L4,0L0,4L-4,0Z',
        viewBox: '-5 -5 10 10',
        refX: 0,
        refY: 0,
        markerWidth: 8,
        markerHeight: 8,
        markerUnits: 'userSpaceOnUse',
        orient: 0,
        fill: 'var(--pivotick-edge-stroke, #999)',
        selected: {
            fill: 'var(--pivotick-edge-selected-stroke, #007acc)',
            markerWidth: 14,
            markerHeight: 14,
        }
    }
}

/**
 * @default
{
    shape: 'circle',
    size: 10,
    strokeWidth: 2,
    color: 'var(--pivotick-node-color, #007acc)',
    strokeColor: 'var(--pivotick-node-stroke, #fff)',
    fontFamily: 'var(--pivotick-label-font, system-ui, sans-serif)',
    textColor: 'var(--pivotick-node-text-color, #fff)',
    iconUnicode: undefined,
    iconClass: undefined,
    svgIcon: undefined,
    imagePath: undefined,
    text: undefined,
}
 */
export const defaultNodeStyle: NodeStyle = {
    shape: 'circle',
    size: 10,
    strokeWidth: 2,
    color: 'var(--pivotick-node-color, #007acc)',
    strokeColor: 'var(--pivotick-node-stroke, #fff)',
    fontFamily: 'var(--pivotick-label-font, system-ui, sans-serif)',
    textColor: 'var(--pivotick-node-text-color, #fff)',
    iconUnicode: undefined,
    iconClass: undefined,
    svgIcon: undefined,
    imagePath: undefined,
    text: undefined,
}

/**
 * @default
{
    strokeWidth: 2,
    opacity: 1.0,
    curveStyle: 'bidirectional',
    dashed: false,
    animateDash: true,
    rotateLabel: false,
    markerEnd: 'arrow',
    markerStart: undefined,
    strokeColor: 'var(--pivotick-edge-color, #999)',
}
 */
export const defaultEdgeStyle: EdgeStyle = {
    strokeWidth: 2,
    opacity: 1.0,
    curveStyle: 'bidirectional',
    dashed: false,
    animateDash: true,
    rotateLabel: false,
    markerEnd: 'arrow',
    markerStart: undefined,
    strokeColor: 'var(--pivotick-edge-color, #999)',
}

/**
 * @default
{
    fontSize: 12,
    fontFamily: 'var(--pivotick-label-font, system-ui, sans-serif)',
    color: 'var(--pivotick-edge-label-color, #333)',
    backgroundColor: 'var(--pivotick-edge-label-bg, #ffffffa0)',
}
 */
export const defaultLabelStyle: LabelStyle = {
    fontSize: 12,
    fontFamily: 'var(--pivotick-label-font, system-ui, sans-serif)',
    color: 'var(--pivotick-edge-label-color, #333)',
    backgroundColor: 'var(--pivotick-edge-label-bg, #ffffffa0)',
}

const DEFAULT_RENDERER_OPTIONS = {
    type: 'svg',
    minZoom: 0.1,
    maxZoom: 10,
    defaultNodeStyle: defaultNodeStyle,
    defaultEdgeStyle: defaultEdgeStyle,
    defaultLabelStyle: defaultLabelStyle,
    markerStyleMap: defaultMarkerStyleMap
} satisfies GraphRendererOptions


export class GraphSvgRenderer extends GraphRenderer {
    protected options: GraphRendererOptions

    private zoom: ZoomBehavior<SVGSVGElement, unknown>
    private eventHandler: EventHandler
    private selectionBox: SelectionBox
    
    public graphInteraction: GraphInteractions<SVGGElement | SVGPathElement>
    public nodeDrawer: NodeDrawer
    public edgeDrawer: EdgeDrawer

    private svgCanvas: SVGSVGElement
    // private progressBar: SVGRectElement

    private svg: Selection<SVGSVGElement, unknown, null, undefined>
    private zoomGroup: Selection<SVGGElement, unknown, null, undefined>
    private edgeGroup: Selection<SVGGElement, unknown, null, undefined>
    private nodeGroup: Selection<SVGGElement, unknown, null, undefined>
    private selectionBoxGroup: Selection<SVGGElement, unknown, null, undefined>
    private defs: Selection<SVGDefsElement, unknown, null, undefined>

    private nodeGroupSelection!: Selection<SVGGElement, Node, SVGGElement, unknown>
    private edgeGroupSelection!: Selection<SVGPathElement, Edge, SVGGElement, unknown>
    private nodeSelection!: Selection<SVGGElement, Node, SVGGElement, unknown>

    private edgeSelection!: Selection<SVGGElement, Edge, SVGGElement, unknown>

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
        this.svgCanvas.setAttribute('class', 'pivotick-canvas')

        this.getCanvasContainer().appendChild(this.svgCanvas)
        this.svg = d3Select(this.svgCanvas)

        this.zoomGroup = this.svg.append('g').attr('class', 'zoom-layer hidden')
        this.edgeGroup = this.zoomGroup.append('g').attr('class', 'edges')
        this.selectionBoxGroup = this.svg.append('g').attr('class', 'selection-box')
        this.nodeGroup = this.zoomGroup.append('g').attr('class', 'nodes')
        this.defs = this.svg.append('defs')
        this.edgeDrawer.renderDefinitions(this.defs)

        this.zoom = d3Zoom<SVGSVGElement, unknown>()
        this.svg.call(this.zoom)
        this.svg.on('dblclick.zoom', null)
        this.zoom
            .filter((event) => {
                if (event.ctrlKey || event.shiftKey || event.altKey)
                    return false
                const target = event.target as HTMLElement
                return !(target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')
            })
            .scaleExtent([this.options.minZoom, this.options.maxZoom])
            .on('zoom', (event) => {
                this.zoomGroup.attr('transform', event.transform)
                this.graphInteraction.canvasZoom(event)
            })

        this.selectionBox = new SelectionBox(this, this.svgCanvas, this.selectionBoxGroup.node())
    }

    public setupRendering(): void {
        this.createSvgProgressBar()
    }

    public getZoomBehavior(): ZoomBehavior<SVGSVGElement, unknown> {
        return this.zoom
    }

    public getSelectionBox(): SelectionBox {
        return this.selectionBox
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
                            node.clearDirty()
                            const selection = d3Select<SVGGElement, Node>(nodes[i])
                            selection.attr('id', `node-${node.domID}`)
                            this.nodeDrawer.render(selection, node)
                        })
                },
                (update) => {
                    return update.each((node: Node, i: number, nodes: ArrayLike<SVGGElement>) => {
                        if (node.isDirty()) {
                            node.clearDirty()
                            const selection = d3Select<SVGGElement, Node>(nodes[i])
                            selection.selectChildren().remove()
                            this.nodeDrawer.render(selection, node)
                        }
                    })
                },
                exit => exit.remove()
            )

        const edges = this.graph.getMutableEdges()
        this.edgeGroupSelection = this.edgeGroup
            .selectAll<SVGPathElement, Edge>('g.edge-group')

        this.edgeSelection = this.edgeGroupSelection
            .data(edges, (edge: Edge) => edge.id)
            .join(
                (enter) => enter
                    .append('g').classed('edge-group', true)
                    .each((edge: Edge, i: number, edges: ArrayLike<SVGGElement>) => {
                        edge.clearDirty()
                        const selection = d3Select<SVGGElement, Edge>(edges[i])
                        selection.attr('id', `edge-${edge.domID}`)
                        this.edgeDrawer.render(selection, edge)
                    }),
                update => update
                    .each((edge: Edge, i: number, edges: ArrayLike<SVGPathElement>) => {
                        if (edge.isDirty()) {
                            edge.clearDirty()
                            const selection = d3Select<SVGGElement, Edge>(edges[i])
                            selection.selectChildren().remove()
                            this.edgeDrawer.render(selection, edge)
                        }
                    }),
                exit => exit.remove()
            )
    }

    public getCanvasSelection(): Selection<SVGSVGElement, unknown, null, undefined> {
        return this.svg
    }

    public getZoomGroup(): SVGGElement | null {
        return this.zoomGroup.node()
    }

    public nextTick(): void {
        this.updateEdgePositions() // Render edges first so nodes are drawn on top of them
        this.updateNodePositions()
    }

    public zoomIn(): void {
        const zoomBehavior = this.getZoomBehavior()
        const canvas = this.getCanvasSelection()

        if (!zoomBehavior || !canvas) return
        canvas.transition().duration(300).call(zoomBehavior.scaleBy, 1.5)
    }

    public zoomOut(): void {
        const zoomBehavior = this.getZoomBehavior()
        const canvas = this.getCanvasSelection()

        if (!zoomBehavior || !canvas) return
        canvas.transition().duration(300).call(zoomBehavior.scaleBy, 0.667)
    }

    public fitAndCenter(): void {
        const zoomBehavior = this.getZoomBehavior()
        const canvas = this.getCanvasSelection()
        const svgEl = canvas.node() as SVGSVGElement
        const zoomLayerEl = canvas.select('.zoom-layer').node() as SVGGElement

        if (!zoomBehavior || !svgEl || !zoomLayerEl) return

        const bounds = zoomLayerEl.getBBox()
        if (bounds.width == 0 || bounds.height == 0) return

        const fullWidth = svgEl.clientWidth
        const fullHeight = svgEl.clientHeight
        const width = bounds.width
        const height = bounds.height

        // Midpoint of content
        const midX = bounds.x + width / 2
        const midY = bounds.y + height / 2

        // Scale so that content fits (with some padding)
        let scale = Math.min(
            fullWidth / width,
            fullHeight / height
        ) * 0.8
        scale = Math.min(scale, 3)

        const translateX = fullWidth / 2 - scale * midX
        const translateY = fullHeight / 2 - scale * midY

        const transform = d3ZoomIdentity
            .translate(translateX, translateY)
            .scale(scale)

        canvas.transition().duration(300).call(zoomBehavior.transform, transform)
    }

    public focusElement(element: Node | Edge): void {
        const targetEl: SVGGElement | null = element.getGraphElement()
        const zoomBehavior = this.getZoomBehavior()
        const canvas = this.getCanvasSelection()
        const svgEl = canvas.node() as SVGSVGElement
        const zoomLayerEl = canvas.select('.zoom-layer').node() as SVGGElement

        if (!zoomBehavior || !svgEl || !zoomLayerEl || !targetEl) return
        const svgBounds = zoomLayerEl.getBBox()

        const fullWidth = svgEl.clientWidth
        const fullHeight = svgEl.clientHeight
        const width = svgBounds.width
        const height = svgBounds.height

        const transformList = targetEl.transform.baseVal

        let dx = 0, dy = 0
        if (transformList.numberOfItems > 0) {
            const t = transformList.getItem(0) // assumes only one transform (translate/scale)

            dx = t.matrix.e
            dy = t.matrix.f
        }

        const scale = Math.min(
            fullWidth / width,
            fullHeight / height
        ) * 1.5
        const translateX = fullWidth / 2 - scale * dx
        const translateY = fullHeight / 2 - scale * dy

        const transform = d3ZoomIdentity
            .translate(translateX, translateY)
            .scale(scale)

        canvas.transition().duration(300).call(zoomBehavior.transform, transform)
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

    // @ts-expect-error fixme: Don't really understand the typescript error below
    public getGraphInteraction(): GraphInteractions<SVGGElement | SVGPathElement> {
        return this.graphInteraction
    }

    public getEventHandler(): EventHandler {
        return this.eventHandler
    }
}
