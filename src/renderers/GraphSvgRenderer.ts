import { select as d3Select, type Selection } from 'd3-selection'
import { zoom as d3Zoom, type ZoomBehavior } from 'd3-zoom'
import { Edge, type EdgeData } from '../Edge'
import { Node } from '../Node'
import type { Graph } from '../Graph'
import type { EdgeStyle, NodeStyle, GraphSvgRendererOptions } from '../GraphOptions'
import merge from 'lodash.merge'
import { GraphInteractions } from './GraphInteractions'


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
    },
} satisfies GraphSvgRendererOptions

export class GraphSvgRenderer {
    private container: HTMLElement
    private graph: Graph
    private zoom: ZoomBehavior<SVGSVGElement, unknown>
    private graphInteraction: GraphInteractions

    private nodeDrawer: NodeDrawer
    private edgeDrawer: EdgeDrawer

    private options: GraphSvgRendererOptions
    private svgCanvas: SVGSVGElement

    private svg: Selection<SVGSVGElement, unknown, null, undefined>
    private zoomGroup: Selection<SVGGElement, unknown, null, undefined>
    private edgeGroup: Selection<SVGGElement, unknown, null, undefined>
    private nodeGroup: Selection<SVGGElement, unknown, null, undefined>
    private defs: Selection<SVGDefsElement, unknown, null, undefined>
    private marker: Selection<SVGMarkerElement, unknown, null, undefined>

    private nodeGroupSelection!: Selection<SVGGElement, Node, SVGGElement, unknown>
    private edgeGroupSelection!: Selection<SVGPathElement, Edge, SVGGElement, unknown>
    private nodeSelection!: Selection<SVGGElement, Node, SVGGElement, unknown>
    private edgeSelection!: Selection<SVGPathElement, Edge, SVGGElement, unknown>

    constructor(graph: Graph, container: HTMLElement, options: Partial<GraphSvgRendererOptions>) {
        this.graph = graph
        this.container = container

        this.options = merge({}, DEFAULT_RENDERER_OPTIONS, options)

        this.graphInteraction = new GraphInteractions(this.graph, this)
        this.nodeDrawer = new NodeDrawer(this.options, this.graph)
        this.edgeDrawer = new EdgeDrawer(this.options, this.graph)

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
        this.marker = this.defs.append('marker')
        this.renderMarkers()

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
        const nodes = this.graph.getNodes()
        this.nodeGroupSelection = this.nodeGroup
            .selectAll<SVGGElement, Node>('g.node-shape')

        this.nodeSelection = this.nodeGroupSelection
            .data(nodes)
            .join(
                (enter) => enter
                    .append('g').classed('node-shape', true)
                    .each((node: Node, i: number, nodes: ArrayLike<SVGGElement>) => {
                        const selection = d3Select<SVGGElement, Node>(nodes[i])
                        this.nodeDrawer.renderNode(selection, node)
                    }),
                update => update
                    .each((node: Node, i: number, nodes: ArrayLike<SVGGElement>) => {
                        const selection = d3Select<SVGGElement, Node>(nodes[i])
                        this.nodeDrawer.renderNode(selection, node)
                    }),
                exit => exit.remove()
            )

        const edges = this.graph.getEdges()
        this.edgeGroupSelection = this.edgeGroup
            .selectAll<SVGPathElement, Edge>('path')

        this.edgeSelection = this.edgeGroupSelection
            .data(edges)
            .join(
                (enter) => enter
                    .append('path')
                    .each((edge: Edge, i: number, edges: ArrayLike<SVGPathElement>) => {
                        const selection = d3Select<SVGPathElement, Edge>(edges[i])
                        this.edgeDrawer.renderEdge(selection, edge)
                    }),
                update => update
                    .each((edge: Edge, i: number, edges: ArrayLike<SVGPathElement>) => {
                        const selection = d3Select<SVGPathElement, Edge>(edges[i])
                        this.edgeDrawer.renderEdge(selection, edge)
                    }),
                exit => exit.remove()
            )

        this.graphInteraction.init()
    }

    public getCanvas(): SVGSVGElement {
        return this.svgCanvas
    }

    public getCanvasSelection(): Selection<SVGSVGElement, unknown, null, undefined> {
        return this.svg
    }

    public updatePositions(): void {
        this.updateEdgePositions() // Render edges first so nodes are drawn on top of them
        this.updateNodePositions()
    }

    public updateNodePositions(): void {
        this.nodeSelection
            .attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`)
    }

    public getNodeSelection(): Selection<SVGGElement, Node, SVGGElement, unknown> {
        return this.nodeSelection
    }

    public getEdgeSelection(): Selection<SVGPathElement, Edge, SVGGElement, unknown> {
        return this.edgeSelection
    }

    private updateEdgePositions(): void {
        this.edgeSelection
            .attr('d', (d: Edge): string | null => {
                const { from, to } = d

                if (!from.x || !from.y || !to.x || !to.y)
                    return null

                const draw_offset = 4 // Distance from which to end the edge
                if (from === to) { // self-loop
                    const x = from.x ?? 0
                    const y = from.y ?? 0
                    const nodeRadius = this.nodeDrawer.computeNodeStyle(from).size
                    const control_point_radius = 6 * nodeRadius

                    // 80° NE
                    const angle1 = (80 * Math.PI) / 180
                    const cx1 = x + control_point_radius * Math.cos(angle1)
                    const cy1 = y - control_point_radius * Math.sin(angle1)

                    // 10° NE
                    const angle2 = (10 * Math.PI) / 180
                    const cx2 = x + control_point_radius * Math.cos(angle2)
                    const cy2 = y - control_point_radius * Math.sin(angle2)

                    // Start point offset by (r + draw_offset) in angle1 direction
                    const startX = x + (nodeRadius) * Math.cos(angle1)
                    const startY = y - (nodeRadius) * Math.sin(angle1)

                    // End point offset by (r + draw_offset) in angle2 direction
                    const endX = x + (nodeRadius + draw_offset) * Math.cos(angle2)
                    const endY = y - (nodeRadius + draw_offset) * Math.sin(angle2)

                    return `M ${startX} ${startY} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${endX} ${endY}`
                }

                // Direction angle from source to target
                const dx = to.x - from.x
                const dy = to.y - from.y
                const distance = Math.sqrt(dx * dx + dy * dy)
                const normX = dx / distance
                const normY = dy / distance

                // Compute source/target node radius
                const rFrom = this.nodeDrawer.computeNodeStyle(from).size
                const rTo = this.nodeDrawer.computeNodeStyle(to).size

                // Offset both ends of the line
                const startX = from.x + (rFrom + draw_offset) * normX
                const startY = from.y + (rFrom + draw_offset) * normY
                const endX = to.x - (rTo + draw_offset) * normX
                const endY = to.y - (rTo + draw_offset) * normY

                return `M ${startX},${startY} L ${endX},${endY}`
            })
    }

    private renderMarkers(): void {
        this.marker
            .attr('id', 'arrow')
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', 5) // Or play with norm and node radius..
            .attr('refY', 0)
            .attr('markerWidth', 6)
            .attr('markerHeight', 6)
            .attr('markerUnits', 'userSpaceOnUse')
            .attr('orient', 'auto')
        this.marker
            .append('path')
            .attr('d', 'M0,-5L10,0L0,5')
            .attr('fill', '#999')
    }

}

class NodeDrawer {

    private graph: Graph
    private rendererOptions: GraphSvgRendererOptions
    private renderNodeCB?: GraphSvgRendererOptions['renderNode']

    public constructor(rendererOptions: GraphSvgRendererOptions, graph: Graph) {
        this.graph = graph
        this.rendererOptions = rendererOptions
        this.renderNodeCB = this.rendererOptions?.renderNode
    }

    public mergeNodeStylingOptions(style: Partial<NodeStyle>): NodeStyle {
        const mergedStyle = {
            shape: style?.shape ?? this.rendererOptions.defaultNodeStyle.shape,
            strokeColor: style?.strokeColor ?? this.rendererOptions.defaultNodeStyle.strokeColor,
            strokeWidth: style?.strokeWidth ?? this.rendererOptions.defaultNodeStyle.strokeWidth,
            size: style?.size ?? this.rendererOptions.defaultNodeStyle.size,
            color: style?.color ?? this.rendererOptions.defaultNodeStyle.color,
        }
        return mergedStyle
    }

    public renderNode(theNodeSelection: Selection<SVGGElement, Node, null, undefined>, node: Node): void {
        if (this.renderNodeCB) {
            const rendered = this?.renderNodeCB?.(node, theNodeSelection)
            const fo = theNodeSelection.append('foreignObject')
                .attr('width', 40)  // FIXME: calculate the correct size of the FO based on the rendered content
                .attr('height', 40)

            if (typeof rendered === 'string') {
                fo.html(rendered)
            } else if (rendered instanceof HTMLElement) {
                fo.node()?.append(rendered)
            }
            // In here, we could add support of other lightweight framework such as jQuery, Vue.js, ..
        } else {
            this.defaultNodeRender(theNodeSelection, node)
        }
    }

    public defaultNodeRender(nodeSelection: Selection<SVGGElement, Node, null, undefined>, node: Node): void {
        const style = this.computeNodeStyle(node)
        this.genericNodeRender(nodeSelection, style)
    }

    public computeNodeStyle(node: Node): NodeStyle {
        let styleFromStyleMap: Partial<NodeStyle> = {}
        if (this.rendererOptions.nodeStyleMap && typeof this.rendererOptions.nodeTypeAccessor === 'function') {
            const nodeType = this.rendererOptions.nodeTypeAccessor(node)
            if (nodeType) {
                styleFromStyleMap = this.rendererOptions.nodeStyleMap[nodeType] ?? {}
            }
        }

        let styleFromNode
        if (node.getStyle()?.styleCb) {
            styleFromNode = node.getStyle().styleCb(node)
        } else {
            styleFromNode = {
                shape: node.getStyle()?.shape ?? styleFromStyleMap?.shape,
                strokeColor: node.getStyle()?.strokeColor ?? styleFromStyleMap?.strokeColor,
                strokeWidth: node.getStyle()?.strokeWidth ?? styleFromStyleMap?.strokeWidth,
                size: node.getStyle()?.size ?? styleFromStyleMap?.size,
                color: node.getStyle()?.color ?? styleFromStyleMap?.color,
            }
        }
        return this.mergeNodeStylingOptions(styleFromNode)
    }

    public genericNodeRender(nodeSelection: Selection<SVGGElement, Node, null, undefined>, style: NodeStyle): void {
        let actualShape = style.shape
        if (style.shape == 'square') {
            actualShape = 'rect'
        } else if (['triangle', 'hexagon',].includes(style.shape)) {
            actualShape = 'path'
        }

        const renderedNode = nodeSelection
            .append(actualShape)
            .attr('stroke', style.strokeColor)
            .attr('stroke-width', style.strokeWidth)
            .attr('fill', style.color)

        switch (style.shape) {
            case 'circle':
                renderedNode.attr('r', style.size)
                break
            case 'square':
                renderedNode
                    .attr('width', style.size * 2)
                    .attr('height', style.size * 2)
                    .attr('x', -style.size)
                    .attr('y', -style.size)
                break
            case 'triangle':
                {
                    const trianglePath = [
                        [0, -style.size],
                        [style.size, style.size],
                        [-style.size, style.size]
                    ].map(p => p.join(',')).join(' ')
                    renderedNode
                        .attr('d', `M${trianglePath}Z`)
                    break
                }
            case 'hexagon':
                {
                    const angle = Math.PI / 3 // 60°
                    const hexPoints = Array.from({ length: 6 }, (_, i) => {
                        const a = angle * i
                        return [Math.cos(a) * style.size, Math.sin(a) * style.size]
                    }).map(p => p.join(',')).join(' ')
                    renderedNode
                        .attr('d', `M${hexPoints}Z`)
                    break
                }
            default:
                renderedNode.attr('r', style.size)
                break
        }
    }

}

class EdgeDrawer {

    private graph: Graph
    private rendererOptions: GraphSvgRendererOptions
    private renderEdgeCB?: GraphSvgRendererOptions['renderEdge']

    public constructor(rendererOptions: GraphSvgRendererOptions, graph: Graph) {
        this.graph = graph
        this.rendererOptions = rendererOptions
        this.renderEdgeCB = this.rendererOptions?.renderEdge
    }

    public renderEdge(theEdgeSelection: Selection<SVGPathElement, Edge, null, undefined>, edge: Edge): void {
        if (this.renderEdgeCB) {
            const rendered = this?.renderEdgeCB?.(edge, theEdgeSelection)
            const fo = theEdgeSelection.append('foreignObject')
                .attr('width', 40)  // FIXME: calculate the correct size of the FO based on the rendered content
                .attr('height', 40)

            if (typeof rendered === 'string') {
                fo.html(rendered)
            } else if (rendered instanceof HTMLElement) {
                fo.node()?.append(rendered)
            }
            // In here, we could add support of other lightweight framework such as jQuery, Vue.js, ..
        } else {
            this.defaultEdgeRender(theEdgeSelection, edge)
        }

        if (this.graph.getOptions().isDirected || edge.directed) {
            this.drawEdgeMarker(theEdgeSelection, edge)
        }
    }

    public defaultEdgeRender(edgeSelection: Selection<SVGPathElement, Edge, null, undefined>, edge: Edge): void {
        const styleFromEdge = {
            strokeColor: edge.getStyle()?.strokeColor,
            strokeWidth: edge.getStyle()?.strokeWidth,
            opacity: edge.getStyle()?.color,
        }
        const style = this.mergeEdgeStylingOptions(styleFromEdge)
        this.genericEdgeRender(edgeSelection, style)
    }

    public mergeEdgeStylingOptions(style: Partial<EdgeStyle>): EdgeStyle {
        const mergedStyle = {
            strokeColor: style?.strokeColor ?? this.rendererOptions.defaultEdgeStyle.strokeColor,
            strokeWidth: style?.strokeWidth ?? this.rendererOptions.defaultEdgeStyle.strokeWidth,
            opacity: style?.opacity ?? this.rendererOptions.defaultEdgeStyle.opacity,
        }
        return mergedStyle
    }

    public genericEdgeRender(edgeSelection: Selection<SVGPathElement, Edge, null, undefined>, style: EdgeStyle): void {
        edgeSelection
            .attr('stroke', style.strokeColor)
            .attr('stroke-width', style.strokeWidth)
            .attr('stroke-opacity', style.opacity)
    }

    public drawEdgeMarker(edgeSelection: Selection<SVGPathElement, Edge<EdgeData>, null, undefined>, edge: Edge<EdgeData>): void {
        edgeSelection
            .attr('marker-end', 'url(#arrow)')
    }

}