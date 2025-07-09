import { type Selection, select as d3Select } from 'd3-selection'
import { Edge, type EdgeData } from '../../Edge'
import type { EdgeStyle, GraphRendererOptions, LabelStyle } from '../../GraphOptions'
import { getArcIntersectionWithCircle, type ArcParams, type Circle } from '../../utils/GeometryHelper'
import type { Graph } from '../../Graph'
import type { GraphSvgRenderer } from './GraphSvgRenderer'

export class EdgeDrawer {

    private graph: Graph
    private rendererOptions: GraphRendererOptions
    private graphSvgRenderer: GraphSvgRenderer
    private renderCB?: GraphRendererOptions['renderEdge']
    private renderLabelCB?: GraphRendererOptions['renderLabel']

    public constructor(rendererOptions: GraphRendererOptions, graph: Graph, graphSvgRenderer: GraphSvgRenderer) {
        this.graphSvgRenderer = graphSvgRenderer
        this.graph = graph
        this.rendererOptions = rendererOptions
        this.renderCB = this.rendererOptions?.renderEdge
        this.renderLabelCB = this.rendererOptions?.renderLabel
    }

    public render(theEdgeSelection: Selection<SVGGElement, Edge, null, undefined>, edge: Edge): void {
        if (this.renderCB) {
            const rendered = this?.renderCB?.(edge, theEdgeSelection)
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

    private defaultEdgeRender(edgeSelection: Selection<SVGGElement, Edge, null, undefined>, edge: Edge): void {
        const style = this.getEdgeStyle(edge)
        const labelStyle = this.getLabelStyle(edge)

        const pathSelection = this.genericEdgeRender(edgeSelection, style)
        this.labelRender(edgeSelection, edge, labelStyle)

        if (this.graph.getOptions().isDirected || edge.directed) {
            this.drawEdgeMarker(pathSelection, style)
        }
    }

    private getLabelStyle(edge: Edge): LabelStyle {
        let styleFromLabel
        const labelStyle = edge.getLabelStyle()

        if (labelStyle && labelStyle.styleCb) {
            styleFromLabel = labelStyle.styleCb(edge)
        } else {
            styleFromLabel = {
                backgroundColor: edge.getLabelStyle()?.backgroundColor,
                fontSize: edge.getLabelStyle()?.fontSize,
                color: edge.getLabelStyle()?.color,
            }
        }
        return this.mergeLabelStylingOptions(styleFromLabel)
    }


    private mergeLabelStylingOptions(style: Partial<LabelStyle>): LabelStyle {
        const mergedStyle = {
            backgroundColor: style?.backgroundColor ?? this.rendererOptions.defaultLabelStyle.backgroundColor,
            fontSize: style?.fontSize ?? this.rendererOptions.defaultLabelStyle.fontSize,
            color: style?.color ?? this.rendererOptions.defaultLabelStyle.color,
        }
        return mergedStyle
    }

    private getEdgeStyle(edge: Edge): EdgeStyle {
        let styleFromEdge
        const edgeStyle = edge.getEdgeStyle()
        if (edgeStyle && edgeStyle.styleCb) {
            styleFromEdge = edgeStyle.styleCb(edge)
        } else {
            styleFromEdge = {
                strokeColor: edgeStyle?.strokeColor,
                strokeWidth: edgeStyle?.strokeWidth,
                opacity: edgeStyle?.opacity,
                curveStyle: edgeStyle?.curveStyle,
                rotateLabel: edgeStyle?.rotateLabel,
            }
        }
        return this.mergeEdgeStylingOptions(styleFromEdge)
    }

    private mergeEdgeStylingOptions(style: Partial<EdgeStyle>): EdgeStyle {
        const mergedStyle = {
            strokeColor: style?.strokeColor ?? this.rendererOptions.defaultEdgeStyle.strokeColor,
            strokeWidth: style?.strokeWidth ?? this.rendererOptions.defaultEdgeStyle.strokeWidth,
            opacity: style?.opacity ?? this.rendererOptions.defaultEdgeStyle.opacity,
            curveStyle: style?.curveStyle ?? this.rendererOptions.defaultEdgeStyle.curveStyle,
            rotateLabel: style?.rotateLabel ?? this.rendererOptions.defaultEdgeStyle.rotateLabel,
        }
        return mergedStyle
    }

    private genericEdgeRender(edgeSelection: Selection<SVGGElement, Edge, null, undefined>, style: EdgeStyle): Selection<SVGPathElement, Edge, null, undefined> {
        return edgeSelection
            .append('path')
            .attr('stroke', style.strokeColor)
            .attr('stroke-width', style.strokeWidth)
            .attr('stroke-opacity', style.opacity)
    }

    private drawEdgeMarker(edgeSelection: Selection<SVGPathElement, Edge<EdgeData>, null, undefined>, style: EdgeStyle): void {
        edgeSelection
            .attr('marker-end', 'url(#arrow)')
    }

    public updatePositions(edgeGroupSelection: Selection<SVGGElement, Edge, SVGGElement, unknown>): void {
        const edgePathSelection = edgeGroupSelection.selectAll<SVGPathElement, Edge>('path')
        const edgeLabelSelection = edgeGroupSelection.selectAll<SVGGElement, Edge>('g.label-container')

        edgePathSelection.attr('d', (edge: Edge): string | null => {
                return this.linkPathRouter(edge)
            })
        
        edgeLabelSelection.attr('transform', (edge: Edge, i, labels) => {
            const { from, to } = edge
            const style = this.getEdgeStyle(edge)

            const labelGroup = labels[i].parentNode
            let pathEl: SVGPathElement | null = null
            if (labelGroup && labelGroup instanceof Element) {
                pathEl = d3Select(labelGroup as Element).select('path').node() as SVGPathElement
            }

            let midX, midY
            if (pathEl) {
                const length = pathEl.getTotalLength()
                const point = pathEl.getPointAtLength(length / 2)
                midX = point.x
                midY = point.y
                if (from === to) { // self-loop
                    midX += 12
                    midY -= 4
                }
            } else {
                const x1 = edge.source.x ?? 0
                const y1 = edge.source.y ?? 0
                const x2 = edge.target.x ?? 0
                const y2 = edge.target.y ?? 0
                midX = (x1 + x2) / 2
                midY = (y1 + y2) / 2
            }

            if (style.rotateLabel) {
                const dx = (edge.target.x ?? 0) - (edge.source.x ?? 0)
                const dy = (edge.target.y ?? 0) - (edge.source.y ?? 0)
                const angle = Math.atan2(dy, dx) * 180 / Math.PI
                const correctedAngle = angle > 90 || angle < -90 ? angle + 180 : angle
                return `translate(${midX}, ${midY}) rotate(${correctedAngle})`
            } else {
                return `translate(${midX}, ${midY})`
            }
        })
    }

    private linkPathRouter(edge: Edge): string | null {
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

        const drawOffsetStart = 2 // Distance from which to start the edge
        const drawOffsetEnd = 4 // Distance from which to end the edge

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
        const startX = from.x + (rFrom + drawOffsetStart) * normX
        const startY = from.y + (rFrom + drawOffsetStart) * normY
        const endX = to.x - (rTo + drawOffsetEnd) * normX
        const endY = to.y - (rTo + drawOffsetEnd) * normY

        return `M ${startX},${startY} L ${endX},${endY}`
    }

    private linkArc(edge: Edge): string | null {
        const { from, to } = edge

        if (!from.x || !from.y || !to.x || !to.y)
            return null

        const r = Math.hypot(to.x - from.x, to.y - from.y)

        const drawOffset = 4 // Distance from which to end the edge

        const rTo = edge.target._circleRadius ? edge.target._circleRadius : this.graphSvgRenderer.nodeDrawer.getNodeStyle(to).size
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

    private labelRender(edgeSelection: Selection<SVGGElement, Edge, null, undefined>, edge: Edge, style: LabelStyle): void {
        const labelContainer = edgeSelection
            .append('g')
            .classed('label-container', true)

        const text = labelContainer.append('text')
            .text(edge.getData().label ?? '')
            .attr('font-size', style.fontSize)
            .attr('text-anchor', 'middle')
            .attr('alignment-baseline', 'central')
            .attr('pointer-events', 'none')
            .attr('fill', style.color)

        const bbox = text.node()?.getBBox()
        if (bbox) {
            const paddingX = 4
            const paddingY = 2
            labelContainer.insert('rect', 'text')
                .attr('x', bbox.x - paddingX)
                .attr('y', bbox.y - paddingY)
                .attr('width', bbox.width + 2 * paddingX)
                .attr('height', bbox.height + 2 * paddingY)
                .attr('fill', style.backgroundColor)
                .attr('rx', 2)
                .attr('ry', 2)
        }
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
