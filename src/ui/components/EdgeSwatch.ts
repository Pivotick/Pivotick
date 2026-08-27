import type { Edge } from '../../Edge'
import type { Graph } from '../../Graph'
import type { EdgeStyle } from '../../interfaces/RendererOptions'
import '../../styles/components/edgeSwatch.scss'

/** The swatch box, wide enough for a dash pattern and a marker to read at all. */
const SWATCH_WIDTH = 18
const SWATCH_HEIGHT = 11
/** How much of the box the marker claims, when the edge resolves one. */
const MARKER_WIDTH = 5
/** A hairline vanishes and a fat rule swamps an 11px row, so the stroke is clamped. */
const MIN_STROKE = 1
const MAX_STROKE = 3

const SVG_NS = 'http://www.w3.org/2000/svg'

/**
 * A **line** key for one edge kind: stroke colour, dash and width as the renderer
 * resolved them, plus an arrowhead when the edge resolves a marker.
 *
 * Descriptive, like the node dot beside it — it reports what the canvas draws and never
 * assigns a style. An edge whose renderer resolves no dash or marker (the canvas
 * renderer resolves neither) therefore gets a plain rule, which is the truthful key.
 */
export function createEdgeSwatch(style: Partial<EdgeStyle> | undefined, className = ''): HTMLElement {
    const svg = document.createElementNS(SVG_NS, 'svg')
    svg.setAttribute('width', String(SWATCH_WIDTH))
    svg.setAttribute('height', String(SWATCH_HEIGHT))
    svg.setAttribute('viewBox', `0 0 ${SWATCH_WIDTH} ${SWATCH_HEIGHT}`)
    svg.setAttribute('aria-hidden', 'true')

    const color = style?.strokeColor ?? 'var(--pvt-edge-stroke, #999)'
    const hasMarker = typeof style?.markerEnd === 'string' && style.markerEnd !== ''
    const width = Math.min(MAX_STROKE, Math.max(MIN_STROKE, Number(style?.strokeWidth) || MIN_STROKE))
    const middle = SWATCH_HEIGHT / 2
    const lineEnd = hasMarker ? SWATCH_WIDTH - MARKER_WIDTH : SWATCH_WIDTH

    const line = document.createElementNS(SVG_NS, 'line')
    line.setAttribute('x1', '0')
    line.setAttribute('y1', String(middle))
    line.setAttribute('x2', String(lineEnd))
    line.setAttribute('y2', String(middle))
    line.setAttribute('stroke-width', String(width))
    if (style?.dashed === true) line.setAttribute('stroke-dasharray', '3 2')
    // Through the CSSOM, not an attribute: the colour comes from consumer data, and this
    // way the browser drops a bogus value instead of taking it verbatim.
    line.style.stroke = color
    svg.appendChild(line)

    if (hasMarker) {
        const head = document.createElementNS(SVG_NS, 'path')
        head.setAttribute('d', `M${lineEnd} ${middle - 3} L${SWATCH_WIDTH} ${middle} L${lineEnd} ${middle + 3} Z`)
        head.style.fill = color
        svg.appendChild(head)
    }

    // Wrapped in a span so it drops into the same fixed-width slot the node dot uses,
    // and so callers can add a class of their own without touching the drawing.
    const slot = document.createElement('span')
    slot.className = className ? `pvt-edge-swatch ${className}` : 'pvt-edge-swatch'
    slot.appendChild(svg)
    return slot
}

/** The swatch for whichever style the renderer resolves for `edge`. */
export function createEdgeSwatchFor(graph: Graph, edge: Edge, className = ''): HTMLElement {
    return createEdgeSwatch(graph.renderer?.getEdgeStyle(edge), className)
}
