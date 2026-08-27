import { select as d3Select, type Selection } from 'd3-selection'
import type { Node } from '../../Node'
import type { Graph } from '../../Graph'
import type { NodeBadge, NodeBadgePosition, NodeStyle } from '../../interfaces/RendererOptions'
import { resolveIcon } from '../../utils/Getters'
import { parseSvgIconMarkup } from '../../utils/SvgSanitizer'

/** Distance from the node's bounds, shared with the expand/collapse affordance. */
export const RIM_PADDING = 2

/** Clockwise from the top-right, which is the order auto-placement fills. */
const CORNERS: NodeBadgePosition[] = ['ne', 'se', 'sw', 'nw']

/** Badge radius floor and ceiling — a badge on a tiny node stays legible, one on a big node stays a badge. */
const MIN_RADIUS = 6
const MAX_RADIUS = 14
const RADIUS_RATIO = 0.45

/** Longest text a badge draws literally; more than this becomes `99+`. */
const MAX_TEXT_LENGTH = 3

/**
 * How far the node reaches, and whether its outline curves away from the corner.
 *
 * Read off the rendered shape's **attributes** rather than `getBBox()`: the zoom layer is
 * `display: none` during the initial layout, where a measured box comes back 0×0.
 */
interface RimExtents {
    hx: number
    hy: number
    /** Round shapes meet the diagonal short of their bounding box; rectangles meet it at the corner. */
    round: boolean
}

function rimExtents(nodeGroup: SVGGElement, node: Node): RimExtents {
    const fallback = node.getCircleRadius() || 10

    const shape = nodeGroup.querySelector<SVGGraphicsElement>(':scope > .node')
    if (shape) {
        const tag = shape.tagName.toLowerCase()
        if (tag === 'rect') {
            const width = Number(shape.getAttribute('width')) || 0
            const height = Number(shape.getAttribute('height')) || 0
            if (width > 0 && height > 0) return { hx: width / 2, hy: height / 2, round: false }
        } else if (tag === 'circle') {
            const r = Number(shape.getAttribute('r')) || 0
            if (r > 0) return { hx: r, hy: r, round: true }
        }
        // Triangles, hexagons and custom paths have no honest box in their attributes; the
        // circumscribed radius is the same approximation the expand affordance has always used.
        return { hx: fallback, hy: fallback, round: true }
    }

    // A `renderNode` node has no shape at all — its measured card stands in for one.
    const card = nodeGroup.querySelector<SVGGraphicsElement>(':scope > foreignObject')
    if (card) {
        const width = Number(card.getAttribute('width')) || 0
        const height = Number(card.getAttribute('height')) || 0
        if (width > 0 && height > 0) return { hx: width / 2, hy: height / 2, round: false }
    }

    return { hx: fallback, hy: fallback, round: true }
}

/**
 * Where a corner of the node's rim sits, in the node group's own coordinates.
 *
 * A circle meets the 45° ray at `r / √2`, so pinning to the bounding box corner would leave a
 * badge floating off a round node. A rectangle meets it at the corner itself, so treating it as
 * round would bury the badge inside the shape — on a 20×20 square, 36% in.
 */
export function nodeRimAnchor(
    nodeGroup: SVGGElement,
    node: Node,
    corner: NodeBadgePosition,
    padding: number = RIM_PADDING
): { x: number, y: number } {
    const { hx, hy, round } = rimExtents(nodeGroup, node)
    const dx = corner === 'ne' || corner === 'se' ? 1 : -1
    const dy = corner === 'ne' || corner === 'nw' ? -1 : 1

    if (round) {
        return { x: dx * (hx + padding) / Math.SQRT2, y: dy * (hy + padding) / Math.SQRT2 }
    }
    const diagonal = padding / Math.SQRT2
    return { x: dx * (hx + diagonal), y: dy * (hy + diagonal) }
}

/** One badge and the corner it was placed in. */
interface PlacedBadge {
    badge: NodeBadge
    corner: NodeBadgePosition
    /** The `+n` stand-in for badges that had nowhere to go: never interactive. */
    overflow?: boolean
}

/**
 * Resolve `NodeStyle.badges` for one node. Kept here rather than in `getNodeStyle` so the
 * consumer's function runs once per render, next to the drawing that consumes it.
 */
export function resolveBadges(style: NodeStyle, node: Node): NodeBadge[] {
    const declared = typeof style.badges === 'function' ? style.badges(node) : style.badges
    return Array.isArray(declared) ? declared.filter(Boolean) : []
}

export class BadgeDrawer {

    private graph: Graph
    /** What each node is currently wearing, so a re-anchor can redraw without re-resolving the style. */
    private drawn: WeakMap<Node, NodeBadge[]> = new WeakMap()

    public constructor(graph: Graph) {
        this.graph = graph
    }

    /**
     * Draw `badges` on the node's rim, replacing whatever was there.
     *
     * Idempotent, because it is also how a re-anchor repaints: badge size is derived from the
     * node's extents, which land late for framed images, custom shapes and measured cards.
     */
    public render(nodeSelection: Selection<SVGGElement, Node, null, undefined>, node: Node, badges: NodeBadge[]): void {
        this.drawn.set(node, badges)

        nodeSelection.selectAll<SVGGElement, unknown>(':scope > .pvt-node-badges').remove()
        if (badges.length === 0) return

        const nodeGroup = nodeSelection.node()
        if (!nodeGroup) return

        const group = nodeSelection.append('g').classed('pvt-node-badges', true)
        const { hx, hy } = rimExtents(nodeGroup, node)
        const radius = Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, RADIUS_RATIO * Math.max(hx, hy)))

        for (const placed of this.place(node, badges)) {
            const anchor = nodeRimAnchor(nodeGroup, node, placed.corner)
            this.drawBadge(group, node, placed, anchor, radius)
        }
    }

    /**
     * Repaint a node's badges against its current extents.
     *
     * Called wherever the node's size is settled after the fact — the `imageFit: 'frame'` probe,
     * the custom-shape measure and the `renderNode` measure loop — so a badge never stays pinned
     * to the guessed radius it was first drawn against.
     */
    public reanchor(node: Node): void {
        const badges = this.drawn.get(node)
        if (!badges || badges.length === 0) return

        const nodeGroup = node.getGraphElement()
        if (!nodeGroup) return

        this.render(d3Select<SVGGElement, Node>(nodeGroup as SVGGElement), node, badges)
    }

    /**
     * Hand out corners: explicit requests first and verbatim, then auto-placement clockwise
     * through whatever is left.
     *
     * The expand affordance sits `ne` when collapsed and `se` when expanded, so on a node with
     * children **both** are reserved whatever its current state — otherwise every badge would
     * change corner the moment the cluster opened.
     */
    private place(node: Node, badges: NodeBadge[]): PlacedBadge[] {
        const expandable = !!this.graph.renderer.getOptions().enableNodeExpansion && node.hasChildren()
        const taken = new Set<NodeBadgePosition>(expandable ? ['ne', 'se'] : [])

        const placed: PlacedBadge[] = []
        const unpositioned: NodeBadge[] = []
        for (const badge of badges) {
            if (badge.position) {
                placed.push({ badge, corner: badge.position })
                taken.add(badge.position)
            } else {
                unpositioned.push(badge)
            }
        }

        const free = CORNERS.filter((corner) => !taken.has(corner))
        if (unpositioned.length <= free.length) {
            unpositioned.forEach((badge, index) => placed.push({ badge, corner: free[index] }))
            return placed
        }

        // One corner goes to the `+n`, so it can say how many are not shown.
        const shown = free.slice(0, Math.max(0, free.length - 1))
        shown.forEach((corner, index) => placed.push({ badge: unpositioned[index], corner }))

        const hidden = unpositioned.slice(shown.length)
        const overflowCorner = free[free.length - 1]
        if (overflowCorner) {
            placed.push({
                badge: {
                    text: `+${hidden.length}`,
                    title: hidden.map((badge) => badge.title).filter(Boolean).join('\n') || undefined,
                },
                corner: overflowCorner,
                overflow: true,
            })
        }
        return placed
    }

    private drawBadge(
        parent: Selection<SVGGElement, Node, null, undefined>,
        node: Node,
        placed: PlacedBadge,
        anchor: { x: number, y: number },
        radius: number
    ): void {
        const { badge, corner, overflow } = placed

        const group = parent.append('g')
            .classed('pvt-node-badge', true)
            .attr('data-pvt-badge-position', corner)
            .attr('transform', `translate(${anchor.x}, ${anchor.y})`)

        if (overflow) group.classed('pvt-node-badge-overflow', true)
        if (badge.title) group.append('title').text(badge.title)

        const label = badge.text ? this.labelFor(badge.text) : undefined
        const characters = label?.length ?? 1
        const fontSize = radius * (characters >= 3 ? 0.9 : characters === 2 ? 1.05 : 1.25)
        const width = label
            ? Math.max(2 * radius, characters * fontSize * 0.64 + radius * 0.7)
            : 2 * radius

        const shape = group.append('rect')
            .attr('class', 'pvt-node-badge-shape')
            .attr('x', -width / 2)
            .attr('y', -radius)
            .attr('width', width)
            .attr('height', 2 * radius)
            .attr('rx', radius)
            .attr('ry', radius)
        // Written as an inline style, not a `fill` attribute: a presentation attribute loses
        // to any stylesheet rule, so the themed default would silently win over the consumer.
        // Left unset entirely when no colour was named, so that default does apply.
        if (badge.color) shape.style('fill', badge.color)

        if (label !== undefined) {
            group.append('text')
                .attr('class', 'pvt-node-badge-text')
                .attr('text-anchor', 'middle')
                .attr('dominant-baseline', 'central')
                .attr('font-size', fontSize)
                .text(label)
        } else {
            this.drawIcon(group, badge, radius)
        }

        if (overflow) return

        const interactive = !!badge.onClick || typeof this.graph.getCallbacks()?.onBadgeClick === 'function'
        group.classed('pvt-node-badge-interactive', interactive)
        group.on('click', (event: PointerEvent) => {
            // An inert badge lets the click through, so it never becomes a dead spot on the node.
            if (interactive) event.stopPropagation()
            const element = node.getGraphElement()
            this.graph.renderer.getGraphInteraction()?.badgeClick(element, event, node, badge)
        })
    }

    /** Text a badge can actually wear: three characters, then it just reports "lots". */
    private labelFor(text: string): string {
        return text.length > MAX_TEXT_LENGTH ? '99+' : text
    }

    private drawIcon(group: Selection<SVGGElement, Node, null, undefined>, badge: NodeBadge, radius: number): void {
        if (badge.iconClass || badge.iconUnicode) {
            const resolved = badge.iconClass ? resolveIcon(badge.iconClass) : undefined
            const glyph = badge.iconUnicode ?? resolved?.glyph
            if (!glyph) return
            const icon = group.append('text')
                .attr('class', 'pvt-node-badge-text icon icon-unicode')
                .attr('text-anchor', 'middle')
                .attr('dominant-baseline', 'central')
                .attr('font-size', radius * 1.1)
                .text(glyph)
            if (resolved && resolved.glyph !== '') {
                icon
                    .style('font-family', resolved.fontFamily)
                    .style('font-weight', resolved.fontWeight)
                    .style('font-style', resolved.fontStyle)
            }
            return
        }

        if (badge.svgIcon) {
            const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
            // svgIcon can be driven by graph data, so it never reaches the live tree unsanitized.
            svgEl.appendChild(parseSvgIconMarkup(badge.svgIcon))
            if (svgEl.children[0]?.nodeName === 'svg') {
                svgEl.children[0].removeAttribute('width')
                svgEl.children[0].removeAttribute('height')
            }
            const extent = radius * 1.3
            group.append(() => svgEl)
                .attr('class', 'pvt-node-badge-icon')
                .attr('x', -extent / 2)
                .attr('y', -extent / 2)
                .attr('width', extent)
                .attr('height', extent)
        }
    }
}
