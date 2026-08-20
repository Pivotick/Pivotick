import type { Edge } from '../../Edge'
import type { Node } from '../../Node'


export function findFirstZeroInDegreeNode(nodes: Node[], edges: Edge[]): Node {
    const targets = new Set(edges.map(e => e.target.id))
    for (const node of nodes) {
        if (!targets.has(node.id)) return node
    }
    return nodes[0]
}


// Exact all-pairs reachability is O(V·E) and both counts follow the caller's data, so the
// search is capped: past this many edge traversals we keep the best root found so far. That is
// exact for the graph sizes a tree layout is usable on (~1k nodes) and bounded above it — this
// only picks a root heuristic, so an approximate answer beats a hung tab.
const MAX_REACHABILITY_TRAVERSALS = 1_000_000

export function findMaxReachabilityRoot(nodes: Node[], edges: Edge[]): Node {
    // Build adjacency list for directed edges
    const adj = new Map<string, Node[]>()
    for (const node of nodes) {
        adj.set(node.id, [])
    }

    for (const edge of edges) {
        // Edges pointing outside the given node set are skipped rather than throwing.
        adj.get(edge.from.id)?.push(edge.to)
    }

    let traversals = 0
    let exhausted = false
    let bestNode: Node | null = null
    let maxReach = -1

    // One iterative DFS per node: a recursive walk overflowed the call stack on a long
    // path, and the memo it carried was order-dependent, so counts came out short.
    for (const node of nodes) {
        const reached = new Set<string>([node.id])
        const stack: Node[] = [node]

        while (stack.length > 0 && !exhausted) {
            const current = stack.pop()!
            for (const next of adj.get(current.id) ?? []) {
                if (++traversals > MAX_REACHABILITY_TRAVERSALS) {
                    exhausted = true
                    break
                }
                if (reached.has(next.id)) continue
                reached.add(next.id)
                stack.push(next)
            }
        }

        // `reached` is seeded with the node itself, which doesn't count towards its reach.
        const count = reached.size - 1
        if (count > maxReach) {
            maxReach = count
            bestNode = node
        }
        if (exhausted) break
    }

    if (exhausted) {
        console.warn('Pivotick: reachability search hit its traversal cap, using the best root found so far.')
    }

    return bestNode ?? nodes[0]
}


/**
 * Kept as its own option value: `MinMaxDistance` asks for the node whose furthest
 * descendant is nearest, which — on a DAG, where "distance to the furthest descendant"
 * *is* the height of the subtree — is the same question {@link findMinHeightDAGRoot}
 * answers. It was implemented twice, identically, and one copy is enough.
 */
export function findMinMaxDistanceRoot(nodes: Node[], edges: Edge[]): Node {
    return findMinHeightDAGRoot(nodes, edges)
}


export function findMinHeightDAGRoot(nodes: Node[], edges: Edge[]): Node {
    // Build adjacency list and in-degree map
    const adj = new Map<string, Node[]>()
    const inDegree = new Map<string, number>()

    for (const node of nodes) {
        adj.set(node.id, [])
        inDegree.set(node.id, 0)
    }

    for (const edge of edges) {
        if (edge.directed !== false) {
            adj.get(edge.from.id)!.push(edge.to)
            inDegree.set(edge.to.id, (inDegree.get(edge.to.id) || 0) + 1)
        }
    }

    // Kahn's algorithm for topological sort
    const topo: Node[] = []
    const queue: Node[] = nodes.filter(n => inDegree.get(n.id)! === 0)

    while (queue.length) {
        const node = queue.shift()!
        topo.push(node)
        for (const child of adj.get(node.id)!) {
            inDegree.set(child.id, inDegree.get(child.id)! - 1)
            if (inDegree.get(child.id) === 0) queue.push(child)
        }
    }

    if (topo.length !== nodes.length) {
        console.warn('Pivotick: the graph has a cycle, so no shallowest root is defined — using the first node.')
        return nodes[0]
    }

    // DP: longest path from each node to any descendant
    const longestPath = new Map<string, number>()
    for (let i = topo.length - 1; i >= 0; i--) {
        const node = topo[i]
        let maxDist = 0
        for (const child of adj.get(node.id)!) {
            maxDist = Math.max(maxDist, 1 + (longestPath.get(child.id) ?? 0))
        }
        longestPath.set(node.id, maxDist)
    }

    // Pick node with minimal longest path (i.e., minimal height)
    let bestNode: Node | null = null
    let minHeight = Infinity
    for (const node of nodes) {
        const height = longestPath.get(node.id)!
        if (height < minHeight) {
            minHeight = height
            bestNode = node
        }
    }

    return bestNode ?? nodes[0]
}


/**
 * The root for a graph whose arrows do *not* form a hierarchy: the node closest to the
 * middle of the graph, reading every edge as undirected.
 *
 * The odd one out among the finders above — they all read arrow direction, and this one
 * deliberately ignores it. It exists for converging data, where every leaf is a source
 * and no single node reaches the graph along the arrows: there the direction-aware
 * finders can only return a node that sees a handful of others, and the tree comes out
 * as a comb of hundreds of stubs. See {@link TreeLayout.buildLevelsStatic}, which falls
 * back to this when the finder it was asked for cannot cover the graph.
 *
 * Found by *double sweep* — walk to the farthest node, walk again to the farthest node
 * from there, and take the middle of that path. On a tree that is exactly the centre;
 * off a tree it is within one level of it, which is far closer than this needs to be.
 * Two BFS passes, so O(V+E): the exhaustive search (BFS from every node) agreed on the
 * same node for both AIL datasets and costs O(V·E).
 */
export function findUndirectedCenterRoot(nodes: Node[], edges: Edge[], startFrom?: string): Node {
    const nodeById = new Map(nodes.map(node => [node.id, node]))
    const adj = new Map<string, string[]>(nodes.map(node => [node.id, []]))
    for (const edge of edges) {
        // Edges pointing outside the given node set are skipped rather than throwing.
        if (!adj.has(edge.from.id) || !adj.has(edge.to.id)) continue
        adj.get(edge.from.id)!.push(edge.to.id)
        adj.get(edge.to.id)!.push(edge.from.id)
    }

    /** Levels and the walk's parent tree, from one node, over the undirected reading. */
    const walk = (start: string) => {
        const levels = new Map<string, number>([[start, 0]])
        const parentOf = new Map<string, string>()
        const order = [start]
        for (let i = 0; i < order.length; i++) {
            const curr = order[i]
            for (const neighbor of adj.get(curr) ?? []) {
                if (levels.has(neighbor)) continue
                levels.set(neighbor, levels.get(curr)! + 1)
                parentOf.set(neighbor, curr)
                order.push(neighbor)
            }
        }
        // `order` is a BFS order, so its last entry is always a deepest node.
        return { levels, parentOf, farthest: order[order.length - 1] }
    }

    // Only the start node's own component is searched, which is the one being rooted.
    const start = startFrom !== undefined && adj.has(startFrom) ? startFrom : nodes[0]?.id
    if (start === undefined) return nodes[0]

    const end = walk(start).farthest
    const { parentOf, farthest: other } = walk(end)

    // Back up the parent chain to recover the longest path found, and take its middle.
    const path: string[] = []
    for (let step: string | undefined = other; step !== undefined; step = parentOf.get(step)) {
        path.push(step)
    }
    return nodeById.get(path[Math.floor(path.length / 2)]) ?? nodes[0]
}
