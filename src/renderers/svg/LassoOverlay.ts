import {
    type Selection
} from 'd3-selection'
import type { GraphRendererOptions } from '../../interfaces/RendererOptions'
import type { Graph } from '../../Graph'
import type { GraphSvgRenderer } from './GraphSvgRenderer'
import { isPointInsidePolygon, type Point } from '../../utils/GeometryHelper'


export class LassoOverlay {
    private graph: Graph
    private rendererOptions: GraphRendererOptions
    private graphSvgRenderer: GraphSvgRenderer
    private zoomLayer: Selection<SVGGElement, unknown, null, undefined>
    private svg: Selection<SVGSVGElement, unknown, null, undefined>

    private overlayGroup
    private polyline

    private enabled = false
    private drawing = false

    private points: Point[] = []

    constructor(rendererOptions: GraphRendererOptions, graph: Graph, graphSvgRenderer: GraphSvgRenderer) {
        this.graphSvgRenderer = graphSvgRenderer
        this.graph = graph
        this.rendererOptions = rendererOptions
        this.zoomLayer = graphSvgRenderer.zoomGroup
        this.svg = graphSvgRenderer.svg

        this.overlayGroup = this.zoomLayer
            .append('g')
            .attr('class', 'pvt-lasso-overlay')

        this.polyline = this.overlayGroup
            .append('polyline')
            .style('display', 'none')

        this.attachEvents()
    }

    public setEnabled(enabled: boolean) {
        this.enabled = enabled

        if (!enabled) {
            this.clear()
        }
    }

    private attachEvents() {
        this.svg.on('pointerdown.lasso', (event: PointerEvent) => {
            if (!this.enabled) return

            if (event.button !== 0) return

            this.drawing = true
            this.points = []

            this.polyline.style('display', 'block')

            this.addPoint(event)
        })

        this.svg.on('pointermove.lasso', (event: PointerEvent) => {
            if (!this.enabled || !this.drawing) return

            this.addPoint(event)
        })

        this.svg.on('pointerup.lasso', () => {
            if (!this.drawing) return

            this.drawing = false

            // close polygon visually
            if (this.points.length > 2) {
                this.points.push(this.points[0])
            }

            this.render()
            this.selectNodesInsideLasso()
            this.clear()
        })
    }

    private addPoint(event: PointerEvent) {
        // Use the renderer's vetted screen->graph conversion (client px via
        // getBoundingClientRect), which matches how nodes are positioned. The old
        // d3.pointer path returned SVG user-space units and diverged whenever the
        // SVG was scaled, so the lasso polygon missed the nodes entirely.
        const point = this.graphSvgRenderer.screenToGraphCoordinates(event.clientX, event.clientY) as Point

        this.points.push(point)

        this.render()
    }

    private render() {
        const pointsString = this.points
            .map((point) => `${point.x},${point.y}`)
            .join(' ')

        this.polyline.attr('points', pointsString)
    }

    public clear() {
        this.points = []

        this.polyline
            .attr('points', '')
            .style('display', 'none')

        this.drawing = false
    }

    private selectNodesInsideLasso() {
        const matchingNodes = this.graph
            .getMutableNodes()
            .filter(node => {
                return isPointInsidePolygon(
                    node.x ?? 0,
                    node.y ?? 0,
                    this.points
                )
            })
            .map(node => {
                return {
                    node,
                    element: node.getGraphElement() as SVGGElement
                }
            })

        this.graph
            .renderer
            .getGraphInteraction()
            .selectNodes(matchingNodes)
    }
}