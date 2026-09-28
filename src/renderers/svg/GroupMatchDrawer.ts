import type { Selection } from 'd3-selection'
import type { Graph } from '../../Graph'
import type { GroupNode } from '../../Simplification/GroupNode'
import { RING_CENTRE, RING_WIDTH } from '../../Simplification/groupStyle'

/** The least of the ring an arc takes, in radians, so one match in 300 still shows. */
const MIN_SPAN = 0.35

interface MatchArc {
    group: GroupNode
    share: number
}

function arcPath(r: number, share: number): string {
    if (share >= 1) return `M0,${-r}A${r},${r} 0 1,1 0,${r}A${r},${r} 0 1,1 0,${-r}`
    const span = Math.max(2 * Math.PI * share, MIN_SPAN)
    const a0 = -Math.PI / 2
    const a1 = a0 + span
    return `M${r * Math.cos(a0)},${r * Math.sin(a0)}A${r},${r} 0 ${span > Math.PI ? 1 : 0},1 ${r * Math.cos(a1)},${r * Math.sin(a1)}`
}

/**
 * The share of each closed group a search matched, as an arc in the theme colour over the
 * group's ring. Its own layer above the nodes, so it reads at every zoom whatever look the
 * group has, and follows the groups on every tick.
 */
export class GroupMatchDrawer {
    private readonly graph: Graph
    private readonly layer: Selection<SVGGElement, unknown, null, undefined>
    private arcs: MatchArc[] = []

    constructor(graph: Graph, layer: Selection<SVGGElement, unknown, null, undefined>) {
        this.graph = graph
        this.layer = layer
    }

    /** Redraw the arcs for the groups drawn now and the matches set now. */
    update(): void {
        const simplify = this.graph.simplify
        this.arcs = simplify.getDrawnGroups()
            .map(group => ({ group, share: simplify.matchesIn(group) / group.info.members.length }))
            .filter(arc => arc.share > 0)
        this.layer
            .selectAll<SVGPathElement, MatchArc>('path.pvt-group-match')
            .data(this.arcs, arc => arc.group.id)
            .join(enter => enter.append('path').attr('class', 'pvt-group-match'))
            .attr('data-group', arc => arc.group.id)
            .attr('d', arc => arcPath(arc.group.getCircleRadius() * RING_CENTRE, arc.share))
            .attr('stroke-width', arc => arc.group.getCircleRadius() * RING_WIDTH)
        this.tick()
    }

    /** Move the arcs to where their groups are now. */
    tick(): void {
        if (this.arcs.length === 0) return
        this.layer
            .selectAll<SVGPathElement, MatchArc>('path.pvt-group-match')
            .attr('transform', arc => `translate(${arc.group.x ?? 0},${arc.group.y ?? 0})`)
    }
}
