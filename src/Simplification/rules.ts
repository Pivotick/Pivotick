import type { Node } from '../Node'
import type { GraphView } from '../interfaces/Simplify'

const SEPARATOR = '\u0001'

function ids(nodes: Node[]): string {
    return nodes.map(node => node.id).sort().join(',')
}

/**
 * Same type, same in-neighbours, same out-neighbours: one key per role. A node with no
 * neighbour at all stays itself, since a group needs something to hang off.
 */
export function neighboursPartition(view: GraphView): Map<string, string> {
    const partition = new Map<string, string>()
    for (const node of view.nodes) {
        const ins = view.inNeighbours(node)
        const outs = view.outNeighbours(node)
        if (ins.length === 0 && outs.length === 0) continue
        partition.set(node.id, [view.typeOf(node) ?? '', ids(ins), ids(outs)].join(SEPARATOR))
    }
    return partition
}

/**
 * What each grouped ingest added, one key per run and type. Links play no part, so a
 * member stays whatever it links to later.
 */
export function landingsPartition(view: GraphView, runs: ReadonlySet<string>): Map<string, string> {
    const partition = new Map<string, string>()
    if (runs.size === 0) return partition
    for (const node of view.nodes) {
        if (view.groupOf(node)) continue
        const run = node.landedBy()
        if (run !== undefined && runs.has(run)) partition.set(node.id, [run, view.typeOf(node) ?? ''].join(SEPARATOR))
    }
    return partition
}

/** The distinct drawn nodes linked to this one, either way round. */
function linkedTo(view: GraphView, node: Node): Set<Node> {
    return new Set([...view.inNeighbours(node), ...view.outNeighbours(node)])
}

/**
 * Fold the given nodes into the nodes left standing. Each connected run of folded nodes
 * goes with the others touching the same survivors, so a hub's leaves and a path hanging
 * off it read as one "N more" on the hub. A run touching no survivor is a group of its own,
 * and every unlinked node joins one group.
 */
function foldInto(view: GraphView, folded: Set<Node>): Map<string, string> {
    const keyed = new Map<Node, string>()
    const seen = new Set<Node>()
    for (const start of folded) {
        if (seen.has(start)) continue
        seen.add(start)
        const run: Node[] = []
        const survivors = new Set<Node>()
        const stack = [start]
        while (stack.length > 0) {
            const node = stack.pop()!
            run.push(node)
            for (const neighbour of linkedTo(view, node)) {
                if (!folded.has(neighbour)) survivors.add(neighbour)
                else if (!seen.has(neighbour)) {
                    seen.add(neighbour)
                    stack.push(neighbour)
                }
            }
        }
        const key = survivors.size > 0 ? `on${SEPARATOR}${ids([...survivors])}`
            : run.length === 1 ? 'unlinked'
                : `run${SEPARATOR}${ids(run).split(',')[0]}`
        for (const node of run) keyed.set(node, key)
    }
    const sizes = new Map<string, number>()
    for (const key of keyed.values()) sizes.set(key, (sizes.get(key) ?? 0) + 1)
    const partition = new Map<string, string>()
    for (const [node, key] of keyed) {
        // An earlier rule's group folding alone would only redraw the same dot.
        if (sizes.get(key) === 1 && view.groupOf(node)) continue
        partition.set(node.id, key)
    }
    return partition
}

/** Nodes with fewer drawn links than `minDegree` fold into what they hang from. */
export function degreePartition(view: GraphView, minDegree: number): Map<string, string> {
    return foldInto(view, new Set(view.nodes.filter(node => linkedTo(view, node).size < minDegree)))
}

/**
 * Nodes outside the k-core fold into what they hang from: peel every node with fewer than
 * `k` links left, again until none does. Nodes the rule may not group are never peeled.
 */
export function kCorePartition(view: GraphView, k: number): Map<string, string> {
    const groupable = new Set(view.nodes)
    const degree = new Map(view.nodes.map(node => [node, linkedTo(view, node).size]))
    const peeled = new Set<Node>()
    const queue = view.nodes.filter(node => degree.get(node)! < k)
    while (queue.length > 0) {
        const node = queue.pop()!
        if (peeled.has(node)) continue
        peeled.add(node)
        for (const neighbour of linkedTo(view, node)) {
            if (!groupable.has(neighbour) || peeled.has(neighbour)) continue
            const left = degree.get(neighbour)! - 1
            degree.set(neighbour, left)
            if (left < k) queue.push(neighbour)
        }
    }
    return foldInto(view, peeled)
}

/**
 * A node's private tails are out-neighbours whose only link is from it, followed downstream
 * while each step links only along the chain. A head (a node with tails, not a tail itself)
 * keys like the neighbour rule with each tail swapped for its type path, so heads of the
 * same shape group. Each level of their tails groups under the heads' group, or under a
 * lone head.
 */
export function chainsPartition(view: GraphView, minSize: number): Map<string, string> {
    const groupable = new Set(view.nodes)
    const privacy = new Map<Node, boolean>()
    const visiting = new Set<Node>()

    /** One parent, and at most one step on that is itself a private tail. */
    const isPrivate = (node: Node): boolean => {
        const known = privacy.get(node)
        if (known !== undefined) return known
        if (visiting.has(node)) return false
        visiting.add(node)
        const ins = view.inNeighbours(node)
        const outs = view.outNeighbours(node)
        const result = groupable.has(node) && ins.length === 1
            && (outs.length === 0 || (outs.length === 1 && outs[0] !== ins[0] && isPrivate(outs[0])))
        visiting.delete(node)
        privacy.set(node, result)
        return result
    }

    const chainFrom = (tail: Node): Node[] => {
        const chain = [tail]
        for (let next = view.outNeighbours(tail)[0]; next; next = view.outNeighbours(next)[0]) chain.push(next)
        return chain
    }

    const heads = new Map<Node, Node[][]>()
    for (const node of view.nodes) {
        if (!isPrivate(node)) continue
        const parent = view.inNeighbours(node)[0]
        if (isPrivate(parent)) continue
        const chains = heads.get(parent)
        if (chains) chains.push(chainFrom(node))
        else heads.set(parent, [chainFrom(node)])
    }

    const partition = new Map<string, string>()
    const pathOf = (chain: Node[]) => chain.map(node => view.typeOf(node) ?? '').join('>')
    const headKeys = new Map<Node, string>()
    const headCounts = new Map<string, number>()
    for (const [head, chains] of heads) {
        if (!groupable.has(head)) continue
        const tails = new Set(chains.map(chain => chain[0]))
        const outs = view.outNeighbours(head).filter(node => !tails.has(node))
        const key = [
            'head', view.typeOf(head) ?? '', ids(view.inNeighbours(head)), ids(outs), chains.map(pathOf).sort().join(','),
        ].join(SEPARATOR)
        headKeys.set(head, key)
        headCounts.set(key, (headCounts.get(key) ?? 0) + 1)
        partition.set(head.id, key)
    }

    for (const [head, chains] of heads) {
        const headKey = headKeys.get(head)
        const under = headKey !== undefined && (headCounts.get(headKey) ?? 0) >= minSize ? headKey : head.id
        for (const chain of chains) {
            const path = pathOf(chain)
            chain.forEach((node, level) => partition.set(node.id, ['tail', under, path, level].join(SEPARATOR)))
        }
    }
    return partition
}
