import { select as d3Select } from 'd3-selection'
import type { NodeBadge } from '../../interfaces/RendererOptions'
import { drawBadgeMark } from '../../renderers/svg/BadgeDrawer'
import '../../styles/components/badgeSwatch.scss'

/** Disc radius in the swatch: a 14px disc, the tallest that still sits in a 12px text row. */
const SWATCH_RADIUS = 7
/** The slot every legend swatch shares, so labels line up whatever key sits beside them. */
const SLOT_WIDTH = 18
/** Room for the pill's stroke, which is centred on its edge. */
const STROKE_ROOM = 1

const SVG_NS = 'http://www.w3.org/2000/svg'

/**
 * A key for elements told apart by a badge: the same pill and glyph the canvas draws,
 * scaled to a legend row. Only the mark is drawn: no title, no click.
 */
export function createBadgeSwatch(badge: NodeBadge, className = ''): HTMLElement {
    const svg = document.createElementNS(SVG_NS, 'svg')
    svg.setAttribute('aria-hidden', 'true')
    const group = document.createElementNS(SVG_NS, 'g')
    group.setAttribute('class', 'pvt-node-badge')
    svg.appendChild(group)

    const pill = drawBadgeMark(d3Select(group), badge, SWATCH_RADIUS)
    const width = Math.max(SLOT_WIDTH, pill + 2 * STROKE_ROOM)
    const height = 2 * (SWATCH_RADIUS + STROKE_ROOM)
    svg.setAttribute('width', String(width))
    svg.setAttribute('height', String(height))
    svg.setAttribute('viewBox', `${-width / 2} ${-height / 2} ${width} ${height}`)

    const slot = document.createElement('span')
    slot.className = className ? `pvt-badge-swatch ${className}` : 'pvt-badge-swatch'
    slot.appendChild(svg)
    return slot
}
