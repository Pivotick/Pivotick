import { Edge } from './Edge'
import type { Graph } from './Graph'
import type { Node } from './Node'

/**
 * One line on the canvas: every real edge whose two ends land on the same pair of dots.
 */
export interface ProjectedLine {
    /** What the canvas draws: the member itself when it stands alone on its own ends, else a stand-in. */
    edge: Edge
    /** The dots on screen for the two ends. */
    from: Node
    to: Node
    /** The real edges behind the line, layers ignored. */
    members: Edge[]
    /** The members whose layer is on. The line is drawn while there is one. */
    shown: Edge[]
}

/**
 * A physics pull on one canvas: the two nodes of that canvas the line's ends sit in.
 * `owner` is the open cluster whose nested graph holds them, `null` for the main canvas.
 */
export interface ClusterPull {
    owner: Node | null
    source: Node
    target: Node
    /** Whether the line reaches inside `source` / `target` rather than ending on it. */
    reachesInto: [boolean, boolean]
    /** The real edge, when the pull is exactly one edge between its own ends. */
    edge?: Edge
}

/** Is this node on the canvas as far as filters go? Asked of top-level nodes only. */
export type TopVisible = (node: Node) => boolean

/**
 * Works out, from the real edges and which clusters are open, what the canvas draws for each
 * edge and what the physics pulls together.
 *
 * - **Ends**: the dot on screen for each end — the node itself if every cluster above it is
 *   open, otherwise the outermost closed cluster hiding it. Real edges landing on the same pair
 *   of dots share one line. When both ends land on one dot nothing is drawn, except for an edge
 *   from a cluster into itself, which loops on the closed cluster.
 * - **Canvas**: the main canvas draws every line. Open clusters draw nodes only.
 * - **Pull**: the two nodes of the innermost canvas that holds both dots.
 *
 * Only real edges are read; a nested graph's copies carry no edge state. An edge counts while
 * both its real ends pass the filters, a line is drawn while one of its edges has its layer on.
 */
export class ClusterProjection {
    private graph: Graph
    private lines: ProjectedLine[] = []
    private pulls: ClusterPull[] = []
    private linesByNode = new Map<string, Edge[]>()
    /** Stand-ins by their pair of dots, so a line that stays keeps its DOM element. */
    private standIns = new Map<string, Edge>()

    constructor(graph: Graph) {
        this.graph = graph
    }

    /** Recompute from the graph as it stands. Cheap: one pass over the real edges. */
    refresh(): void {
        this.lines = this.project((node) => node.visible, true, true)
        this.materialise()
        this.pulls = this.buildPulls(this.lines)
    }

    /** The edges the main canvas draws, from the last {@link refresh}. */
    getDrawnEdges(): Edge[] {
        return this.lines.filter(line => line.shown.length > 0).map(line => line.edge)
    }

    /** The drawn edges ending on any of these nodes, for a partial re-position. */
    getDrawnEdgesTouching(nodes: Node[]): Edge[] {
        const found = new Set<Edge>()
        for (const node of nodes) {
            for (const edge of this.linesByNode.get(node.id) ?? []) found.add(edge)
        }
        return [...found]
    }

    /** The pulls of one canvas: `null` for the main canvas, else the open cluster's real node. */
    getPulls(owner: Node | null): ClusterPull[] {
        return this.pulls.filter(pull => pull.owner === owner)
    }

    /**
     * The lines as they would be if `topVisible` said which top-level nodes are on the
     * canvas. Pure: nothing is created or cached, so the filters can ask before committing.
     *
     * `respectHidden` also drops edges hidden outright (`edge.hide()`, as `hideNode` does).
     * Off for that dry run: those flags are what the filters are about to recompute.
     *
     * `withGroups` lands a folded node's edges on its group. Off for that dry run too: the
     * filters run before the grouping, so they reason about the clusters alone.
     */
    project(topVisible: TopVisible, respectHidden = false, withGroups = false): ProjectedLine[] {
        const groups = new Map<string, ProjectedLine>()
        for (const edge of this.graph.getMutableEdges()) {
            if (respectHidden && !edge.visibleIgnoringLayer) continue
            if (!this.edgePasses(edge, topVisible)) continue
            const from = withGroups ? edge.from.canvasRepresentative() : edge.from.clusterRepresentative()
            const to = withGroups ? edge.to.canvasRepresentative() : edge.to.clusterRepresentative()
            if (from === to && from !== edge.from && from !== edge.to) continue

            const key = `${from.id}->${to.id}`
            let line = groups.get(key)
            if (!line) {
                line = { edge, from, to, members: [], shown: [] }
                groups.set(key, line)
            }
            line.members.push(edge)
            if (edge.layerVisible) line.shown.push(edge)
        }
        return [...groups.values()]
    }

    /** Does this real edge count, with `topVisible` saying which top-level nodes are shown? */
    edgePasses(edge: Edge, topVisible: TopVisible): boolean {
        return this.passes(edge.from, topVisible) && this.passes(edge.to, topVisible)
    }

    /**
     * Does this end survive the filters? Its top-level node must be on the canvas, and every
     * cluster child on the way down must match the filters itself: a closed cluster's
     * children are filtered nowhere else.
     */
    private passes(node: Node, topVisible: TopVisible): boolean {
        const path = [...node.ancestorChain(), node]
        if (!topVisible(path[0])) return false
        for (let i = 1; i < path.length; i++) {
            if (!this.graph.queryEngine.matchesNodeFilters(path[i])) return false
        }
        return true
    }

    /** Give every line the edge it is drawn with, and index the drawn ones by node. */
    private materialise(): void {
        const used = new Set<string>()
        this.linesByNode.clear()
        for (const line of this.lines) {
            const only = line.members.length === 1 ? line.members[0] : undefined
            if (only && only.from === line.from && only.to === line.to) {
                line.edge = only
            } else {
                const key = `${line.from.id}->${line.to.id}`
                used.add(key)
                let standIn = this.standIns.get(key)
                if (!standIn || standIn.from !== line.from || standIn.to !== line.to) {
                    standIn = Edge.standIn(`synthetic-${line.from.id}-${line.to.id}`, line.from, line.to)
                    this.standIns.set(key, standIn)
                }
                standIn.standFor(line.members)
                line.edge = standIn
            }
            if (line.shown.length === 0) continue
            for (const id of [line.from.id, line.to.id]) {
                const list = this.linesByNode.get(id)
                if (list) list.push(line.edge)
                else this.linesByNode.set(id, [line.edge])
            }
        }
        for (const key of [...this.standIns.keys()]) {
            if (!used.has(key)) this.standIns.delete(key)
        }
    }

    /**
     * One pull per line, on the innermost canvas holding both dots, between the two nodes of
     * that canvas the dots sit in. Layers are ignored: switching one off never moves the graph.
     */
    private buildPulls(lines: ProjectedLine[]): ClusterPull[] {
        const pulls = new Map<string, ClusterPull>()
        for (const line of lines) {
            const fromPath = [...line.from.ancestorChain(), line.from]
            const toPath = [...line.to.ancestorChain(), line.to]
            let depth = 0
            while (depth < fromPath.length && depth < toPath.length && fromPath[depth] === toPath[depth]) depth++
            // One dot holds the other: a cluster and its own contents, nothing to pull apart.
            if (depth === fromPath.length || depth === toPath.length) continue

            const owner = depth > 0 ? fromPath[depth - 1] : null
            const source = fromPath[depth]
            const target = toPath[depth]
            const reachesInto: [boolean, boolean] = [source !== line.from, target !== line.to]
            const only = line.members.length === 1 ? line.members[0] : undefined

            // Several lines between the same two nodes pull once, reaching in wherever any does.
            const pairKey = `${owner?.id ?? ''}|${[source.id, target.id].sort().join('|')}`
            const existing = pulls.get(pairKey)
            if (existing) {
                const flipped = existing.source !== source
                existing.reachesInto[flipped ? 1 : 0] ||= reachesInto[0]
                existing.reachesInto[flipped ? 0 : 1] ||= reachesInto[1]
                existing.edge = undefined
                continue
            }
            pulls.set(pairKey, {
                owner,
                source,
                target,
                reachesInto,
                edge: only && only.from === source && only.to === target ? only : undefined,
            })
        }
        return [...pulls.values()]
    }
}
