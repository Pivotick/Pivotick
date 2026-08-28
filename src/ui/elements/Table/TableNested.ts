import type { Graph } from '../../../Graph'
import type { Node } from '../../../Node'
import type { UIManager } from '../../UIManager'

/**
 * Nested nodes in the dock — the contents of a cluster, listed as ordinary rows.
 *
 * The whole difficulty is that a nested node **is not a node of this graph**. It lives in
 * `graph.nodes` — `_setData` puts every descendant there — but the canvas never draws it:
 * an expanded cluster builds a *separate* `Graph` from `toDict()` data and draws clones. So
 * a nested node has no dot, no DOM element, and a `visible` flag that has read `false`
 * since load and never changes. Three readings follow from that one fact:
 *
 * - its `Visibility` comes from the clusters above it, never from `visible` — see
 *   `nodeVisibility`, which answers `nested` while any of them is shut;
 * - `focusElement` on it is a silent no-op, so "take me there" has to aim at a cluster —
 *   see {@link revealNested};
 * - and `Degree` reads its *real* edges, which is not what the canvas draws while its
 *   cluster is shut: there the canvas shows a stand-in edge to the cluster instead. (The
 *   column already counts stand-ins for root nodes, so this is consistent with it.)
 *
 * Rows are otherwise ordinary: the `Cluster` column carries where they came from, and
 * every sort, filter, export and selection path treats them as peers of the graph's own.
 */

/** `UI.table.nested`, defaulted — whether nested nodes are listed at all. */
export function nestedOffered(uiManager: UIManager): boolean {
    const table = uiManager.getOptions().table
    if (!table || typeof table !== 'object') return true
    return table.nested !== false
}

/**
 * Bring a nested node into view on the canvas — the `dblclick` "take me there" gesture.
 *
 * **One cluster per call, outermost first.** Expanding a cluster hands its contents to a
 * brand-new subgraph built from `toDict()`, which does not carry `expanded`, so setting
 * the flag on a deeper cluster from out here would claim it is open when the drawn
 * subgraph has it shut — and `Visibility` would then read `visible` for a node nobody can
 * see. Repeating the gesture walks one level deeper each time, once the subgraph that
 * owns the next cluster actually exists.
 *
 * Focus aims at the outermost cluster, because that is the only ancestor with a DOM
 * element in *this* graph.
 *
 * @returns whether a cluster was opened.
 */
export function revealNested(graph: Graph, node: Node): boolean {
    const chain = node.ancestorChain()
    if (chain.length === 0) return false

    const shut = chain.find((ancestor) => !ancestor.expanded)
    if (shut) {
        // A nested cluster is drawn by its own parent's subgraph, so that is the graph
        // whose `onChange` has to run — and the node it holds is a separate instance.
        // `Node.expand()` writes through to the original, so the model stays in step.
        const owner = shut.parentNode?.getSubgraph() ?? graph
        owner.toggleExpandNode(owner.getMutableNode(shut.id) ?? shut)
    }
    graph.focusElement(chain[0])
    return shut !== undefined
}
