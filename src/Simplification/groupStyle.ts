import type { NodeStyle } from '../interfaces/RendererOptions'
import type { GroupInfo } from '../interfaces/Simplify'

/** A mixed group's disc and ring. */
export const MIXED_GROUP_COLOR = '#8b93a1'

/** The middle of the ring band, and a ring's stroke width, as fractions of the radius. */
export const RING_CENTRE = 0.895
export const RING_WIDTH = 0.23

/** The on-screen width, in CSS pixels, at which the count appears on the disc. */
const COUNT_TIER_PX = 26

const SVG_NS = 'http://www.w3.org/2000/svg'

/** Grows with the count, capped: 14 at 5 members, 34 at 300. */
export function groupRadius(count: number): number {
    return Math.min(34, 11 + 1.3 * Math.sqrt(count))
}

function circlePath(r: number, clockwise = true): string {
    const sweep = clockwise ? 1 : 0
    return `M0,${-r}A${r},${r} 0 1,${sweep} 0,${r}A${r},${r} 0 1,${sweep} 0,${-r}Z`
}

/** Outer ring, a gap, then the disc: one path, the gap cut by winding. */
function ringedPath(r: number): string {
    return `${circlePath(r)} ${circlePath(r * 0.79, false)} ${circlePath(r * 0.62)}`
}

function countFontSize(r: number): number {
    return Math.max(10, Math.round(r * 0.62))
}

function countElement(count: number, r: number): HTMLElement {
    const el = document.createElement('div')
    el.className = 'pvt-group-count'
    el.textContent = String(count)
    el.style.cssText = `font:600 ${countFontSize(r)}px/1 var(--pvt-font-family, system-ui, sans-serif);color:#fff;pointer-events:none`
    return el
}

/** The ring split by type share over a neutral disc, with the count. `html` keeps only an element, so the svg goes in a div. */
function splitRingElement(info: GroupInfo, count: number, r: number, colorOf: (type: string) => string): HTMLElement {
    const size = 2 * r + 2
    const svg = document.createElementNS(SVG_NS, 'svg')
    svg.setAttribute('width', String(size))
    svg.setAttribute('height', String(size))
    svg.setAttribute('viewBox', `${-size / 2} ${-size / 2} ${size} ${size}`)
    const ringRadius = r * RING_CENTRE
    const gap = 0.12
    let angle = -Math.PI / 2
    for (const [type, n] of Object.entries(info.typeCounts)) {
        const span = 2 * Math.PI * n / count
        const a0 = angle + gap / 2
        const a1 = angle + span - gap / 2
        const arc = document.createElementNS(SVG_NS, 'path')
        arc.setAttribute('d', `M${ringRadius * Math.cos(a0)},${ringRadius * Math.sin(a0)}A${ringRadius},${ringRadius} 0 ${span > Math.PI ? 1 : 0},1 ${ringRadius * Math.cos(a1)},${ringRadius * Math.sin(a1)}`)
        arc.setAttribute('fill', 'none')
        arc.setAttribute('stroke', colorOf(type))
        arc.setAttribute('stroke-width', String(r * RING_WIDTH))
        svg.appendChild(arc)
        angle += span
    }
    const text = document.createElementNS(SVG_NS, 'text')
    text.setAttribute('text-anchor', 'middle')
    text.setAttribute('dominant-baseline', 'central')
    text.setAttribute('fill', '#fff')
    text.setAttribute('font-weight', '600')
    text.setAttribute('font-size', String(countFontSize(r)))
    text.textContent = String(count)
    svg.appendChild(text)

    const wrap = document.createElement('div')
    wrap.className = 'pvt-group-count'
    wrap.style.lineHeight = '0'
    wrap.appendChild(svg)
    return wrap
}

/**
 * The look a group gets unless `render.groupStyle` says otherwise: a disc in its type's
 * colour inside a detached ring, the label below. The ring is the base drawing, so it reads
 * at every zoom; the count waits for a tier with room for it.
 */
export function defaultGroupStyle(info: GroupInfo, label: string, colorOf: (type: string) => string): Partial<NodeStyle> {
    const count = info.members.length
    const r = groupRadius(count)
    const types = Object.keys(info.typeCounts)
    const mixed = types.length > 1
    const html = mixed
        ? () => splitRingElement(info, count, r, colorOf)
        : () => countElement(count, r)
    return {
        shape: { d: ringedPath(r) },
        size: r,
        layoutSize: r,
        color: mixed ? MIXED_GROUP_COLOR : colorOf(types[0] ?? ''),
        text: () => label,
        textVerticalShift: -1.45,
        textColor: 'var(--pvt-text-color-5)',
        textTruncate: false,
        tiers: [{ width: COUNT_TIER_PX, height: COUNT_TIER_PX, minRenderedSize: COUNT_TIER_PX, style: { html } }],
    }
}
