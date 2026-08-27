/* eslint-disable */
// @ts-nocheck
import { type Selection } from 'd3-selection'
import { Edge, type EdgeData } from '../../Edge'
import type { EdgeStyle, GraphRendererOptions } from '../../GraphOptions'
import { getArcIntersectionWithCircle, type ArcParams, type Circle } from '../../utils/GeometryHelper'
import type { Graph } from '../../Graph'
import { edgeTypeGetter } from '../../utils/GraphGetters'

export class EdgeDrawer {

    private graph: Graph
    private rendererOptions: GraphRendererOptions
    private renderLabelCB?: GraphRendererOptions['renderLabelCB']

    public constructor(rendererOptions: GraphRendererOptions, graph: Graph) {
        this.graph = graph
        this.rendererOptions = rendererOptions
        this.renderLabelCB = this.rendererOptions?.renderLabelCB
    }

    render(ctx: CanvasRenderingContext2D, edge: Edge): void {
        ctx.beginPath()
        ctx.moveTo(edge.source.x ?? 0, edge.source.y ?? 0)
        ctx.lineTo(edge.target.x ?? 0, edge.target.y ?? 0)
        ctx.strokeStyle = this.rendererOptions.defaultEdgeStyle.strokeColor
        ctx.globalAlpha = this.rendererOptions.defaultEdgeStyle.opacity
        ctx.lineWidth = this.rendererOptions.defaultEdgeStyle.strokeWidth
        ctx.stroke()
        ctx.globalAlpha = 1
    }

    private defaultEdgeRender(edgeSelection: Selection<SVGPathElement, Edge, null, undefined>, edge: Edge): void {
        const style = this.getEdgeStyle(edge)
        this.genericEdgeRender(edgeSelection, style)

        if (this.graph.getOptions().isDirected || edge.directed) {
            this.drawEdgeMarker(edgeSelection, style)
        }
    }

    /**
     * The style this renderer paints an edge with. It resolves the four properties the
     * canvas renderer actually draws — a legend keyed on it therefore shows solid,
     * markerless swatches here, which is the truthful key for what lands on screen.
     */
    public getEdgeStyle(edge: Edge): EdgeStyle {
        let styleFromEdge
        const fromStyleMap = this.styleFromKindMap(edge)
        if (edge.getStyle()?.styleCb) {
            styleFromEdge = edge.getStyle().styleCb(edge)
        } else {
            styleFromEdge = {
                strokeColor: edge.getStyle()?.strokeColor ?? fromStyleMap.strokeColor,
                strokeWidth: edge.getStyle()?.strokeWidth ?? fromStyleMap.strokeWidth,
                opacity: edge.getStyle()?.opacity ?? fromStyleMap.opacity,
                curveStyle: edge.getStyle()?.curveStyle ?? fromStyleMap.curveStyle,
            }
        }
        return this.mergeEdgeStylingOptions(styleFromEdge, edge)
    }

    /** `render.edgeStyleMap`'s entry for this edge's kind, empty when it declares none. */
    private styleFromKindMap(edge: Edge): Partial<EdgeStyle> {
        const { edgeStyleMap, edgeTypeAccessor } = this.rendererOptions
        if (!edgeStyleMap) return {}
        const kind = edgeTypeGetter(edge, edgeTypeAccessor)
        return kind !== undefined ? edgeStyleMap[kind] ?? {} : {}
    }

    private mergeEdgeStylingOptions(style: Partial<EdgeStyle>, edge: Edge): EdgeStyle {
        const defaults = this.rendererOptions.defaultEdgeStyle
        const fromDefaultCb = defaults.styleCb?.(edge) ?? {}
        const mergedStyle = {
            strokeColor: style?.strokeColor ?? fromDefaultCb.strokeColor ?? defaults.strokeColor,
            strokeWidth: style?.strokeWidth ?? fromDefaultCb.strokeWidth ?? defaults.strokeWidth,
            opacity: style?.opacity ?? fromDefaultCb.opacity ?? defaults.opacity,
            curveStyle: style?.curveStyle ?? fromDefaultCb.curveStyle ?? defaults.curveStyle,
        }
        return mergedStyle
    }

    private genericEdgeRender(edgeSelection: Selection<SVGPathElement, Edge, null, undefined>, style: EdgeStyle): void {
        edgeSelection
            .attr('stroke', style.strokeColor)
            .attr('stroke-width', style.strokeWidth)
            .attr('stroke-opacity', style.opacity)
    }

    private drawEdgeMarker(edgeSelection: Selection<SVGPathElement, Edge<EdgeData>, null, undefined>, style: EdgeStyle): void {
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

        const edgeStyle = this.getEdgeStyle(edge)

        if (edgeStyle.curveStyle === 'straight') {
            return this.linkStraight(edge)
        } else if (edgeStyle.curveStyle === 'curved') {
            return this.linkArc(edge)
        } else {
            if (connectedNodes.filter((node: { id: string }) => node.id === from.id).length > 0) {
                // The other node has also an edge to the source node
                return this.linkArc(edge)
            }
            return this.linkStraight(edge)
        }

    }

    private linkSelfLoop(edge: Edge): string | null {
        const { from, to } = edge

        if (!from.x || !from.y || !to.x || !to.y || from !== to)
            return null

        const drawOffset = 4 // Distance from which to end the edge

        const x = from.x ?? 0
        const y = from.y ?? 0
        const nodeRadius = this.graphSvgRenderer.nodeDrawer.getNodeStyle(from).size
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

    private linkStraight(edge: Edge): string | null {
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
        const rFrom = this.graphSvgRenderer.nodeDrawer.getNodeStyle(from).size
        const rTo = this.graphSvgRenderer.nodeDrawer.getNodeStyle(to).size

        // Offset both ends of the line
        const startX = from.x + (rFrom + drawOffset) * normX
        const startY = from.y + (rFrom + drawOffset) * normY
        const endX = to.x - (rTo + drawOffset) * normX
        const endY = to.y - (rTo + drawOffset) * normY

        return `M ${startX},${startY} L ${endX},${endY}`
    }

    private linkArc(edge: Edge): string | null {
        const { from, to } = edge

        if (!from.x || !from.y || !to.x || !to.y)
            return null

        const r = Math.hypot(to.x - from.x, to.y - from.y)

        const drawOffset = 4 // Distance from which to end the edge
        const rTo = this.graphSvgRenderer.nodeDrawer.getNodeStyle(to).size
        const rTotalOffset = rTo + drawOffset

        const arcParams: ArcParams = {
            from: { x: from.x, y: from.y },
            to: { x: to.x, y: to.y },
            rx: r,
            ry: r,
            xAxisRotation: 0,
            largeArcFlag: false,
            sweepFlag: true,
        }
        const circle: Circle = {
            cx: to.x,
            cy: to.y,
            r: rTotalOffset,
        }
        const intersection = getArcIntersectionWithCircle(arcParams, circle)

        if (intersection)
            return `
                M${from.x},${from.y}
                A${r},${r} 0 0,1 ${intersection.x},${intersection.y}
            `

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
