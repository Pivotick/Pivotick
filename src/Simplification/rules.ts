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
