import type { Edge } from '../../Edge'
import type { Graph } from '../../Graph'
import type { GraphInteractions } from '../../GraphInteractions'

/** How close, in screen pixels, the pointer must be to a line for it to win over a bubble. */
const REACH = 6

interface LineHit {
    edge: Edge
    element: SVGGElement
}

/**
 * Lets a line win the pointer over an open cluster's bubble. The main canvas draws every
 * line under the bubbles, so a bubble's fill otherwise catches every gesture on a line
 * inside it. A gesture on bubble fill goes to a line within {@link REACH} px if there is
 * one, and to the cluster as before otherwise, so a bubble can still be grabbed and dragged.
 */
export class BubbleEdgeHits {
    private graph: Graph
    private graphInteraction: GraphInteractions<SVGGElement | SVGPathElement>
    private hovered: LineHit | null = null

    constructor(graph: Graph, graphInteraction: GraphInteractions<SVGGElement | SVGPathElement>) {
        this.graph = graph
        this.graphInteraction = graphInteraction
    }

    /** Listen in the capture phase, so a hit is taken before the cluster's own handlers see it. */
    install(svg: SVGSVGElement): void {
        // Swallowing the press is what keeps the cluster from starting a drag.
        const swallow = (event: Event) => {
            if (this.lineAt(event as MouseEvent)) event.stopPropagation()
        }
        svg.addEventListener('mousedown', swallow, true)
        svg.addEventListener('pointerdown', swallow, true)
        svg.addEventListener('click', (event) => {
            const hit = this.lineAt(event)
            if (!hit) return
            event.stopPropagation()
            this.graphInteraction.edgeClick(hit.element, event as PointerEvent, hit.edge)
        }, true)
        svg.addEventListener('dblclick', (event) => {
            const hit = this.lineAt(event)
            if (!hit) return
            event.stopPropagation()
            this.graphInteraction.edgeDbclick(hit.element, event as PointerEvent, hit.edge)
        }, true)
        svg.addEventListener('contextmenu', (event) => {
            const hit = this.lineAt(event)
            if (!hit) return
            event.preventDefault()
            event.stopPropagation()
            this.graphInteraction.edgeContextmenu(hit.element, event as PointerEvent, hit.edge)
        }, true)
        svg.addEventListener('pointermove', (event) => this.hover(svg, event), true)
    }

    private hover(svg: SVGSVGElement, event: PointerEvent): void {
        const hit = this.lineAt(event)
        if (hit?.edge === this.hovered?.edge) return
        if (this.hovered) this.graphInteraction.edgeHoverOut(this.hovered.element, event, this.hovered.edge)
        this.hovered = hit
        if (hit) this.graphInteraction.edgeHoverIn(hit.element, event, hit.edge)
        svg.style.cursor = hit ? 'pointer' : ''
    }

    /** The drawn line within reach of a pointer that is on a bubble's fill, if any. */
    private lineAt(event: MouseEvent): LineHit | null {
        const target = event.target as Element | null
        if (!target?.classList?.contains('pvt-cluster-area')) return null

        for (const edge of this.graph.getDrawnEdges()) {
            const element = edge.getGraphElement()
            const path = element?.querySelector('path')
            if (!element || !path) continue
            const box = path.getBoundingClientRect()
            if (event.clientX < box.left - REACH || event.clientX > box.right + REACH
                || event.clientY < box.top - REACH || event.clientY > box.bottom + REACH) continue
            const ctm = path.getScreenCTM()
            if (!ctm) continue

            // Widen the stroke for the test only: the hit band is REACH px on screen at any zoom.
            const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(ctm.inverse())
            const width = path.style.strokeWidth
            path.style.strokeWidth = String((2 * REACH) / Math.hypot(ctm.a, ctm.b))
            const hit = path.isPointInStroke(point)
            path.style.strokeWidth = width
            if (hit) return { edge, element }
        }
        return null
    }
}
