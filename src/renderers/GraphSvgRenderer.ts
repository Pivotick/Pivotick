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
        curveStyle: 'bidirectional',
    },
} satisfies GraphSvgRendererOptions

export class GraphSvgRenderer {
    private container: HTMLElement
    private graph: Graph
    private zoom: ZoomBehavior<SVGSVGElement, unknown>
    private graphInteraction: GraphInteractions

    public nodeDrawer: NodeDrawer
    public edgeDrawer: EdgeDrawer

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
        this.edgeDrawer.renderMarkers(this.defs)

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
        this.update()
        this.graphInteraction.init()
    }

    public update(): void {
        const nodes = this.graph.getNodes()
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
                            this.nodeDrawer.renderNode(selection, node)
                        })
                },
                (update) => {
                    return update.each((node: Node, i: number, nodes: ArrayLike<SVGGElement>) => {
                        const selection = d3Select<SVGGElement, Node>(nodes[i])
                        selection.selectChildren().remove()
                        this.nodeDrawer.renderNode(selection, node)
                    })
                },
                exit => exit.remove()
            )

        const edges = this.graph.getEdges()
        this.edgeGroupSelection = this.edgeGroup
            .selectAll<SVGPathElement, Edge>('path')

        this.edgeSelection = this.edgeGroupSelection
            .data(edges, (edge: Edge) => edge.id)
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
                        selection.selectChildren().remove()
                        this.edgeDrawer.renderEdge(selection, edge)
                    }),
                exit => exit.remove()
            )
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
            .attr('d', (edge: Edge): string | null => {
                return this.edgeDrawer.linkPathRouter(edge)
            })
    }

}

class NodeDrawer {

    private graph: Graph
    private rendererOptions: GraphSvgRendererOptions
    private graphSvgRenderer: GraphSvgRenderer
    private renderNodeCB?: GraphSvgRendererOptions['renderNode']

    public constructor(rendererOptions: GraphSvgRendererOptions, graph: Graph, graphSvgRenderer: GraphSvgRenderer) {
        this.graphSvgRenderer = graphSvgRenderer
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
    private graphSvgRenderer: GraphSvgRenderer
    private renderEdgeCB?: GraphSvgRendererOptions['renderEdge']

    public constructor(rendererOptions: GraphSvgRendererOptions, graph: Graph, graphSvgRenderer: GraphSvgRenderer) {
        this.graphSvgRenderer = graphSvgRenderer
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
    }

    public defaultEdgeRender(edgeSelection: Selection<SVGPathElement, Edge, null, undefined>, edge: Edge): void {
        const styleFromEdge = {
            strokeColor: edge.getStyle()?.strokeColor,
            strokeWidth: edge.getStyle()?.strokeWidth,
            opacity: edge.getStyle()?.color,
            curveStyle: edge.getStyle()?.curveStyle,
        }
        const style = this.mergeEdgeStylingOptions(styleFromEdge)
        this.genericEdgeRender(edgeSelection, style)

        if (this.graph.getOptions().isDirected || edge.directed) {
            this.drawEdgeMarker(edgeSelection, style)
        }
    }

    public mergeEdgeStylingOptions(style: Partial<EdgeStyle>): EdgeStyle {
        const mergedStyle = {
            strokeColor: style?.strokeColor ?? this.rendererOptions.defaultEdgeStyle.strokeColor,
            strokeWidth: style?.strokeWidth ?? this.rendererOptions.defaultEdgeStyle.strokeWidth,
            opacity: style?.opacity ?? this.rendererOptions.defaultEdgeStyle.opacity,
            curveStyle: style?.curveStyle ?? this.rendererOptions.defaultEdgeStyle.curveStyle,
        }
        return mergedStyle
    }

    public genericEdgeRender(edgeSelection: Selection<SVGPathElement, Edge, null, undefined>, style: EdgeStyle): void {
        edgeSelection
            .attr('stroke', style.strokeColor)
            .attr('stroke-width', style.strokeWidth)
            .attr('stroke-opacity', style.opacity)
    }

    public drawEdgeMarker(edgeSelection: Selection<SVGPathElement, Edge<EdgeData>, null, undefined>, style: EdgeStyle): void {
        edgeSelection
            .attr('marker-end', 'url(#arrow)')
    }

    public linkPathRouter(edge: Edge): string | null {
        const { from, to } = edge

        if (!from.x || !from.y || !to.x || !to.y)
            return null

        if (from === to) // self-loop
            return this.linkSelfLoop(edge)

        const connectedNodes = this.graph.getConnectedNodes(to)
        if (connectedNodes.filter((node) => node.id === from.id).length > 0) {
            // The other node has also an edge to the source node
            return this.linkArc(edge)
        }
        return this.linkStraight(edge)
    }

    protected linkSelfLoop(edge: Edge): string | null {
        const { from, to } = edge

        if (!from.x || !from.y || !to.x || !to.y || from !== to)
            return null

        const drawOffset = 4 // Distance from which to end the edge

        const x = from.x ?? 0
        const y = from.y ?? 0
        const nodeRadius = this.graphSvgRenderer.nodeDrawer.computeNodeStyle(from).size
        const control_point_radius = 6 * nodeRadius

        // 80° NE
        const angle1 = (80 * Math.PI) / 180
        const cx1 = x + control_point_radius * Math.cos(angle1)
        const cy1 = y - control_point_radius * Math.sin(angle1)

        // 10° NE
        const angle2 = (10 * Math.PI) / 180
        const cx2 = x + control_point_radius * Math.cos(angle2)
        const cy2 = y - control_point_radius * Math.sin(angle2)

        // Start point offset by (r + drawOffset) in angle1 direction
        const startX = x + (nodeRadius) * Math.cos(angle1)
        const startY = y - (nodeRadius) * Math.sin(angle1)

        // End point offset by (r + drawOffset) in angle2 direction
        const endX = x + (nodeRadius + drawOffset) * Math.cos(angle2)
        const endY = y - (nodeRadius + drawOffset) * Math.sin(angle2)

        return `M ${startX} ${startY} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${endX} ${endY}`
    }

    protected linkStraight(edge: Edge): string | null {
        const { from, to } = edge

        if (!from.x || !from.y || !to.x || !to.y)
            return null

        const drawOffset = 4 // Distance from which to end the edge

        // Direction angle from source to target
        const dx = to.x - from.x
        const dy = to.y - from.y
        const distance = Math.sqrt(dx * dx + dy * dy)
        const normX = dx / distance
        const normY = dy / distance

        // Compute source/target node radius
        const rFrom = this.graphSvgRenderer.nodeDrawer.computeNodeStyle(from).size
        const rTo = this.graphSvgRenderer.nodeDrawer.computeNodeStyle(to).size

        // Offset both ends of the line
        const startX = from.x + (rFrom + drawOffset) * normX
        const startY = from.y + (rFrom + drawOffset) * normY
        const endX = to.x - (rTo + drawOffset) * normX
        const endY = to.y - (rTo + drawOffset) * normY

        return `M ${startX},${startY} L ${endX},${endY}`
    }

    protected linkArc(edge: Edge): string | null {
        const { from, to } = edge

        if (!from.x || !from.y || !to.x || !to.y)
            return null

        const r = Math.hypot(to.x - from.x, to.y - from.y)
        const arcParams: ArcParams = {
            from: { x: from.x, y: from.y },
            to: { x: to.x, y: to.y },
            rx: r,
            ry: r,
            xAxisRotation: 0,
            largeArcFlag: false,
            sweepFlag: true,
          }

        const drawOffset = 4 // Distance from which to end the edge
        const rTo = this.graphSvgRenderer.nodeDrawer.computeNodeStyle(to).size
        const rTotalOffset = rTo + drawOffset

        const arcCenter = getArcCenter(arcParams)

        if (arcCenter.rx === arcCenter.ry && arcCenter.xAxisRotation === 0) {
            // Circular arc shortcut
            const intersections = circleCircleIntersections(
                arcCenter.cx,
                arcCenter.cy,
                arcCenter.rx,
                arcParams.to,
                rTotalOffset
            )

            const validIntersection = pickValidArcIntersection(intersections, arcCenter)
            if (!validIntersection)
                return ''

            return `
                M${from.x},${from.y}
                A${r},${r} 0 0,1 ${validIntersection.x},${validIntersection.y}
            `
        } else {
            console.log('Arc is elliptical or rotated, numerical methods needed for intersection.')
        }

        return ''
    }

    public renderMarkers(defsContainer: Selection<SVGDefsElement, unknown, null, undefined>): void {
        const markerForStraight = defsContainer.append('marker')
        markerForStraight
            .attr('id', 'arrow')
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', 5) // Or play with norm and node radius..
            .attr('refY', 0)
            .attr('markerWidth', 6)
            .attr('markerHeight', 6)
            .attr('markerUnits', 'userSpaceOnUse')
            .attr('orient', 'auto')
        markerForStraight
            .append('path')
            .attr('d', 'M0,-5L10,0L0,5')
            .attr('fill', '#999')
    }
}


interface Point {
    x: number;
    y: number;
}

interface ArcParams {
    rx: number;
    ry: number;
    xAxisRotation: number; // degrees
    largeArcFlag: boolean;
    sweepFlag: boolean;
    from: Point;
    to: Point;
}

interface ArcCenterResult {
    cx: number;
    cy: number;
    startAngle: number; // radians
    deltaAngle: number; // radians
    rx: number;
    ry: number;
    xAxisRotation: number; // radians
}

/**
 * Converts degrees to radians.
 */
function degToRad(degrees: number): number {
    return (degrees * Math.PI) / 180
}

/**
 * Normalize angle to [0, 2π)
 */
function normalizeAngle(angle: number): number {
    while (angle < 0) angle += 2 * Math.PI
    while (angle >= 2 * Math.PI) angle -= 2 * Math.PI
    return angle
}

/**
 * Recover ellipse center and angles from SVG arc parameters.
 * Based on SVG implementation notes: https://www.w3.org/TR/SVG/implnote.html#ArcImplementationNotes
 */
function getArcCenter(params: ArcParams): ArcCenterResult {
    const { rx, ry, xAxisRotation, largeArcFlag, sweepFlag, from, to } = params
    const φ = degToRad(xAxisRotation)
    const cosφ = Math.cos(φ)
    const sinφ = Math.sin(φ)

    // Step 1: Compute (x1', y1')
    const dx = (from.x - to.x) / 2
    const dy = (from.y - to.y) / 2

    const x1p = cosφ * dx + sinφ * dy
    const y1p = -sinφ * dx + cosφ * dy

    // Ensure radii are large enough
    let rxsq = rx * rx
    let rysq = ry * ry
    const x1psq = x1p * x1p
    const y1psq = y1p * y1p

    // Correct radii if too small
    const radicant = x1psq / rxsq + y1psq / rysq
    if (radicant > 1) {
        const scale = Math.sqrt(radicant)
        rx *= scale
        ry *= scale
        rxsq = rx * rx
        rysq = ry * ry
    }

    // Step 2: Compute (cx', cy')
    const sign = (largeArcFlag !== sweepFlag) ? 1 : -1
    const numerator = rxsq * rysq - rxsq * y1psq - rysq * x1psq
    const denominator = rxsq * y1psq + rysq * x1psq
    const coef = sign * Math.sqrt(Math.max(0, numerator / denominator))

    const cxp = coef * ((rx * y1p) / ry)
    const cyp = coef * (-(ry * x1p) / rx)

    // Step 3: Compute (cx, cy) from (cx', cy')
    const cx = cosφ * cxp - sinφ * cyp + (from.x + to.x) / 2
    const cy = sinφ * cxp + cosφ * cyp + (from.y + to.y) / 2

    // Step 4: Compute start angle and delta angle
    // Vector angle helper
    function vectorAngle(ux: number, uy: number, vx: number, vy: number): number {
        const dot = ux * vx + uy * vy
        const len = Math.sqrt(ux * ux + uy * uy) * Math.sqrt(vx * vx + vy * vy)
        let ang = Math.acos(Math.min(Math.max(dot / len, -1), 1)) // clamp due to floating errors
        if (ux * vy - uy * vx < 0) ang = -ang
        return ang
    }

    // Compute start angle
    const vx1 = (x1p - cxp) / rx
    const vy1 = (y1p - cyp) / ry
    const vx2 = (-x1p - cxp) / rx
    const vy2 = (-y1p - cyp) / ry

    let startAngle = vectorAngle(1, 0, vx1, vy1)
    let deltaAngle = vectorAngle(vx1, vy1, vx2, vy2)

    if (!sweepFlag && deltaAngle > 0) {
        deltaAngle -= 2 * Math.PI
    } else if (sweepFlag && deltaAngle < 0) {
        deltaAngle += 2 * Math.PI
    }

    startAngle = normalizeAngle(startAngle)
    deltaAngle = normalizeAngle(deltaAngle)

    return {
        cx,
        cy,
        startAngle,
        deltaAngle,
        rx,
        ry,
        xAxisRotation: φ,
    }
  }

/**
* Find intersection points between two circles:
* Circle 1: center (cx, cy), radius r
* Circle 2: center (to.x, to.y), radius rTo
* Returns 0, 1 or 2 intersection points as array of Points.
*/
function circleCircleIntersections(
    cx: number,
    cy: number,
    r: number,
    to: Point,
    rTo: number
): Point[] {
    const dx = to.x - cx
    const dy = to.y - cy
    const d = Math.sqrt(dx * dx + dy * dy)

    // No solution cases
    if (d > r + rTo) return [] // Circles too far apart
    if (d < Math.abs(r - rTo)) return [] // One circle inside the other
    if (d === 0 && r === rTo) return [] // Circles coincide

    // Find intersection points
    const a = (r * r - rTo * rTo + d * d) / (2 * d)
    const h = Math.sqrt(r * r - a * a)

    const xm = cx + (a * dx) / d
    const ym = cy + (a * dy) / d

    const xs1 = xm + (h * dy) / d
    const ys1 = ym - (h * dx) / d

    const xs2 = xm - (h * dy) / d
    const ys2 = ym + (h * dx) / d

    if (h === 0) {
        return [{ x: xs1, y: ys1 }] // One intersection (tangent)
    }

    return [
        { x: xs1, y: ys1 },
        { x: xs2, y: ys2 },
    ]
  }

function isAngleOnArc(
    angle: number,
    start: number,
    delta: number
): boolean {
    angle = normalizeAngle(angle)
    start = normalizeAngle(start)
    const end = normalizeAngle(start + delta)

    if (delta >= 0) {
        if (start <= end) {
            return angle >= start && angle <= end
        } else {
            // Wrap around 2π
            return angle >= start || angle <= end
        }
    } else {
        if (end <= start) {
            return angle <= start && angle >= end
        } else {
            // Wrap around 0
            return angle <= start || angle >= end
        }
    }
}

function pickValidArcIntersection(
    intersections: Point[],
    arc: ArcCenterResult
): Point | null {
    const { cx, cy, startAngle, deltaAngle } = arc

    for (const pt of intersections) {
        const angle = Math.atan2(pt.y - cy, pt.x - cx)
        if (isAngleOnArc(angle, startAngle, deltaAngle)) {
            return pt
        }
    }

    return null // none match (unlikely)
}
  