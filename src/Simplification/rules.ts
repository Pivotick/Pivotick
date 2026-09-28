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
