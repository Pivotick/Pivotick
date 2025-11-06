import { type Selection, select as d3Select } from 'd3-selection'
import { Edge } from '../../Edge'
import type { EdgeStyle, GraphRendererOptions, LabelStyle } from '../../GraphOptions'
import { getApproximateArcLengthAndMidpoint, getApproximateCircleArcLengthAndMidpoint, getArcIntersectionWithCircle, getSegmentLengthAndMidpoint, type ArcParams, type Circle } from '../../utils/GeometryHelper'
import type { Graph } from '../../Graph'
import type { GraphSvgRenderer } from './GraphSvgRenderer'
import { tryResolveString } from '../../utils/Getters'
import { edgeLabelGetter } from '../../utils/GraphGetters'

export class EdgeDrawer {

    private graph: Graph
    private rendererOptions: GraphRendererOptions
    private graphSvgRenderer: GraphSvgRenderer
    private renderLabelCB?: GraphRendererOptions['renderLabel']

    public constructor(rendererOptions: GraphRendererOptions, graph: Graph, graphSvgRenderer: GraphSvgRenderer) {
        this.graphSvgRenderer = graphSvgRenderer
        this.graph = graph
        this.rendererOptions = rendererOptions
        this.renderLabelCB = this.rendererOptions?.renderLabel
    }

    public render(theEdgeSelection: Selection<SVGGElement, Edge, null, undefined>, edge: Edge): void {
        this.defaultEdgeRender(theEdgeSelection, edge)
    }

    private defaultEdgeRender(edgeSelection: Selection<SVGGElement, Edge, null, undefined>, edge: Edge): void {
        const style = this.getEdgeStyle(edge)
        const labelStyle = this.getLabelStyle(edge)

        if (this.graph.getOptions().isDirected || edge.directed) {
            const pathSelection = this.genericEdgeRender(edgeSelection, style)
            this.drawEdgeMarker(pathSelection, edge, style)
        }

        if (this.renderLabelCB) {
            const fo = edgeSelection
                .append('g').classed('label-container', true)
                .append('foreignObject')
            const rendered = this?.renderLabelCB?.(edge, fo)
            fo.attr('width', 200)
                .attr('height', 100)

            if (typeof rendered === 'string') {
                fo.html(rendered)
            } else if (rendered instanceof HTMLElement) {
                fo.node()?.append(rendered)
            }

            // In here, we could add support of other lightweight framework such as jQuery, Vue.js, ..

            requestAnimationFrame(() => {
                const foNode = fo.node() as SVGForeignObjectElement
                if (!foNode) return

                const content = foNode.firstElementChild as HTMLElement | null
                if (!content) return

                const bcr = content.getBoundingClientRect()
                const width = Math.ceil(bcr.width)
                const height = Math.ceil(bcr.height)

                fo.attr('width', width)
                    .attr('height', height)

                // Offset the position so it's centered
                fo.attr('x', -width / 2)
                    .attr('y', -height / 2)
                this.highlightSelection(edgeSelection, edge)

            })
        } else {
            this.defaultLabelRender(edgeSelection, edge, labelStyle)
            this.highlightSelection(edgeSelection, edge)
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
                fontFamily: edge.getLabelStyle()?.fontFamily,
                color: edge.getLabelStyle()?.color,
            }
        }
        return this.mergeLabelStylingOptions(styleFromLabel)
    }


    private mergeLabelStylingOptions(style: Partial<LabelStyle>): LabelStyle {
        const mergedStyle = {
            backgroundColor: style?.backgroundColor ?? this.rendererOptions.defaultLabelStyle.backgroundColor,
            fontSize: style?.fontSize ?? this.rendererOptions.defaultLabelStyle.fontSize,
            fontFamily: style?.fontFamily ?? this.rendererOptions.defaultLabelStyle.fontFamily,
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
                dashed: edgeStyle?.dashed,
                animateDash: edgeStyle?.animateDash,
                rotateLabel: edgeStyle?.rotateLabel,
                markerEnd: edgeStyle?.markerEnd,
                markerStart: edgeStyle?.markerStart,
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
            dashed: style?.dashed ?? this.rendererOptions.defaultEdgeStyle.dashed,
            animateDash: style?.animateDash ?? this.rendererOptions.defaultEdgeStyle.animateDash,
            rotateLabel: style?.rotateLabel ?? this.rendererOptions.defaultEdgeStyle.rotateLabel,
            markerEnd: style?.markerEnd ?? this.rendererOptions.defaultEdgeStyle.markerEnd,
            markerStart: style?.markerStart ?? this.rendererOptions.defaultEdgeStyle.markerStart,
        }
        return mergedStyle
    }

    private genericEdgeRender(edgeSelection: Selection<SVGGElement, Edge, null, undefined>, style: EdgeStyle): Selection<SVGPathElement, Edge, null, undefined> {
        const pathSelection = edgeSelection
            .append('path')
            .attr('stroke', style.strokeColor)
            .attr('stroke-width', style.strokeWidth)
            .attr('stroke-opacity', style.opacity)

        if (style.dashed) {
            pathSelection
                .classed('dashed', true)

            if (style.animateDash) {
                pathSelection
                    .classed('animated', true)
            }
        }

        return pathSelection
    }

    private drawEdgeMarker(edgeSelection: Selection<SVGPathElement, Edge, null, undefined>, edge: Edge, style: EdgeStyle): void {
        if (!this.rendererOptions.markerStyleMap)
            return

        const markerEnd = style.markerEnd !== undefined ? tryResolveString(style.markerEnd, edge) : undefined
        const markerStart = style.markerStart !== undefined ? tryResolveString(style.markerStart, edge) : undefined

        if (markerEnd && this.rendererOptions.markerStyleMap[markerEnd]) {
            edgeSelection.attr('marker-end', `url(#${markerEnd})`)
        } else {
            edgeSelection.attr('marker-end', 'url(#arrow)')
        }
        if (markerStart && this.rendererOptions.markerStyleMap[markerStart])
            edgeSelection.attr('marker-start', `url(#${markerStart})`)
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
            let midpoint = { x: 0, y: 0 }
            let pathTotalLength = 0
            if (from === to) { // self-loop
                const arcApprox = pathEl ? getApproximateCircleArcLengthAndMidpoint(pathEl) : undefined
                const { length: arcLength = 0, midpoint: arcMidpoint = { x: 0, y: 0 } } = arcApprox ?? {}
                pathTotalLength = arcLength
                midpoint = arcMidpoint
            } else if (style.curveStyle === 'straight') {
                // pathTotalLength = getSegmentLengthAndMidpoint(pathEl)
                const segmentLengthAndMidpoint = pathEl ? getSegmentLengthAndMidpoint(pathEl) : undefined
                const { length: segmentLength = 0, midpoint: segmentMidpoint = { x: 0, y: 0 } } = segmentLengthAndMidpoint ?? {}
                pathTotalLength = segmentLength
                midpoint = segmentMidpoint
            } else {
                // pathTotalLength = pathEl ? pathEl.getTotalLength() : 0
                const arcApprox = pathEl ? getApproximateArcLengthAndMidpoint(pathEl) : undefined
                const { length: arcLength = 0, midpoint: arcMidpoint = { x: 0, y: 0 } } = arcApprox ?? {}
                pathTotalLength = arcLength
                midpoint = arcMidpoint
            }
            if (pathEl && pathTotalLength > 0) {
                midX = midpoint.x
                midY = midpoint.y
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

            midX = isFinite(midX) ? midX : 0
            midY = isFinite(midY) ? midY : 0
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

        if (from.x === undefined || from.y === undefined || to.x === undefined || to.y === undefined)
            return null

        if (from === to) // self-loop
            return this.linkSelfLoop(edge)

        const connectedNodes = to.getConnectedNodes()

        const edgeStyle = this.getEdgeStyle(edge)

        if (edgeStyle.curveStyle === 'straight') {
            return this.linkStraight(edge)
        } else if (edgeStyle.curveStyle === 'curved') {
            return this.linkArc(edge)
        } else {
            if (connectedNodes.filter((node: { id: string }) => node.id === from.id).length > 0) {
                edge.updateStyle({ edge: { curveStyle: 'curved' } })
                return this.linkArc(edge)
            }
            edge.updateStyle({ edge: { curveStyle: 'straight' } })
            return this.linkStraight(edge)
        }

    }

    private linkSelfLoop(edge: Edge): string | null {
        const { from, to } = edge
        const isEdgeSelected = this.graphSvgRenderer.getGraphInteraction().getSelectedEdge()?.edge.id === edge.id

        if (from.x === undefined || from.y === undefined || to.x === undefined || to.y === undefined)
            return null

        const drawOffsetStart = 4 + (isEdgeSelected ? 2 : 0) // Distance from which to start the edge
        const drawOffsetEnd = 4 + (isEdgeSelected ? 2 : 0) // Distance from which to end the edge

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
        const startX = x + (nodeRadius + drawOffsetStart) * Math.cos(angle1)
        const startY = y - (nodeRadius + drawOffsetStart) * Math.sin(angle1)

        // End point offset by (r + drawOffset) in angle2 direction
        const endX = x + (nodeRadius + drawOffsetEnd) * Math.cos(angle2)
        const endY = y - (nodeRadius + drawOffsetEnd) * Math.sin(angle2)

        return `M ${startX} ${startY} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${endX} ${endY}`
    }

    private linkStraight(edge: Edge): string | null {
        const { from, to } = edge
        const isEdgeSelected = this.graphSvgRenderer.getGraphInteraction().getSelectedEdge()?.edge.id === edge.id

        if (from.x === undefined || from.y === undefined || to.x === undefined || to.y === undefined)
            return null

        const drawOffsetStart = 4 + (isEdgeSelected ? 2 : 0) // Distance from which to start the edge
        const drawOffsetEnd = 4 + (isEdgeSelected ? 2 : 0) // Distance from which to end the edge

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
        const isEdgeSelected = this.graphSvgRenderer.getGraphInteraction().getSelectedEdge()?.edge.id === edge.id

        if (from.x === undefined || from.y === undefined || to.x === undefined || to.y === undefined)
            return null

        const r = Math.hypot(to.x - from.x, to.y - from.y)

        const drawOffsetStart = 4 + (isEdgeSelected ? 2 : 0) // Distance from which to start the edge
        const drawOffsetEnd = 4 + (isEdgeSelected ? 2 : 0) // Distance from which to end the edge

        const rFrom = edge.source.getCircleRadius() ? edge.source.getCircleRadius() : this.graphSvgRenderer.nodeDrawer.getNodeStyle(from).size
        const rTo = edge.target.getCircleRadius() ? edge.target.getCircleRadius() : this.graphSvgRenderer.nodeDrawer.getNodeStyle(to).size

        const arcParams: ArcParams = {
            from: { x: from.x, y: from.y },
            to: { x: to.x, y: to.y },
            rx: r,
            ry: r,
            xAxisRotation: 0,
            largeArcFlag: false,
            sweepFlag: true,
        }
        const circleFrom: Circle = {
            cx: from.x,
            cy: from.y,
            r: rFrom + drawOffsetStart,
        }
        const circleTo: Circle = {
            cx: to.x,
            cy: to.y,
            r: rTo + drawOffsetEnd,
        }
        const intersectionFrom = getArcIntersectionWithCircle(arcParams, circleFrom)
        const intersectionTo = getArcIntersectionWithCircle(arcParams, circleTo)

        if (intersectionFrom && intersectionTo)
            return `M${intersectionFrom.x},${intersectionFrom.y} A${r},${r} 0 0,1 ${intersectionTo.x},${intersectionTo.y}`

        return ''
    }

    private defaultLabelRender(edgeSelection: Selection<SVGGElement, Edge, null, undefined>, edge: Edge, style: LabelStyle): void {
        const labelContainer = edgeSelection
            .append('g')
            .classed('label-container', true)

        const labelContent = edgeLabelGetter(edge)
        if (!labelContent || labelContent === '') return

        const text = labelContainer.append('text')
            .text(labelContent)
            .attr('font-size', style.fontSize)
            .attr('font-family', style.fontFamily)
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
    public renderDefinitions(defsContainer: Selection<SVGDefsElement, unknown, null, undefined>): void {
        this.renderMarkers(defsContainer)
    }

    private renderMarkers(defsContainer: Selection<SVGDefsElement, unknown, null, undefined>): void {
        if (this.rendererOptions.markerStyleMap) {
            for (const markerId in this.rendererOptions.markerStyleMap) {
                const config = this.rendererOptions.markerStyleMap[markerId]
                const marker = defsContainer.append('marker')
                    .attr('id', markerId)
                    .attr('viewBox', config.viewBox)
                    .attr('refX', config.refX)
                    .attr('refY', config.refY)
                    .attr('markerWidth', config.markerWidth)
                    .attr('markerHeight', config.markerHeight)
                    .attr('markerUnits', config.markerUnits || 'userSpaceOnUse')
                    .attr('orient', config.orient ?? 'auto')

                marker.append('path')
                    .attr('d', config.pathD)
                    .attr('fill', config.fill)

                const selectedMarker = defsContainer.append('marker')
                    .attr('id', markerId + '_selected')
                    .attr('viewBox', config.selected?.viewBox ?? config.viewBox)
                    .attr('refX', config.selected?.refX ?? config.refX)
                    .attr('refY', config.selected?.refY ?? config.refY)
                    .attr('markerWidth', config.selected?.markerWidth ?? config.markerWidth)
                    .attr('markerHeight', config.selected?.markerHeight ?? config.markerHeight)
                    .attr('markerUnits', (config.selected?.markerUnits ?? config.markerUnits) || 'userSpaceOnUse')
                    .attr('orient', (config.selected?.orient ?? config.orient) ?? 'auto')

                selectedMarker.append('path')
                    .attr('d', config.selected?.pathD ?? config.pathD)
                    .attr('fill', config.selected?.fill ?? config.fill)
            }
        }
    }

    private highlightSelection(edgeSelection: Selection<SVGGElement, Edge, null, undefined>, edge: Edge): void {
        
        edgeSelection.classed('selected', false)
        if (this.graphSvgRenderer.getGraphInteraction().getSelectedEdge()?.edge.id === edge.id) {
            edgeSelection.classed('selected', true)

            const edgePathSelection = edgeSelection.selectAll<SVGPathElement, Edge>('path')
            const currentMarkerStart = edgePathSelection.attr('marker-start')?.match(/#.*(?=\))/)
            if (currentMarkerStart) {
                edgePathSelection.attr('marker-start', `url(${currentMarkerStart[0]}_selected)`)
            }
            const currentMarkerEnd = edgePathSelection.attr('marker-end')?.match(/#.*(?=\))/)
            if (currentMarkerEnd) {
                edgePathSelection.attr('marker-end', `url(${currentMarkerEnd[0]}_selected)`)
            }
        }

    }
}
