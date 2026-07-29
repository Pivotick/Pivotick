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


export function findMinMaxDistanceRoot(nodes: Node[], edges: Edge[]): Node {
    // Build adjacency list for directed edges
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
        console.warn('Graph has a cycle! Min-max distance root undefined.')
        return nodes[0]
    }

    // DP: longest path from each node to any reachable node
    const maxDist = new Map<string, number>()
    for (let i = topo.length - 1; i >= 0; i--) {
        const node = topo[i]
        let dist = 0
        for (const child of adj.get(node.id)!) {
            dist = Math.max(dist, 1 + (maxDist.get(child.id) || 0))
        }
        maxDist.set(node.id, dist)
    }

    // Find node with minimal max distance
    let bestNode: Node | null = null
    let minMaxDist = Infinity
    for (const node of nodes) {
        const dist = maxDist.get(node.id)!
        if (dist < minMaxDist) {
            minMaxDist = dist
            bestNode = node
        }
    }

    return bestNode ?? nodes[0]
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
        console.warn('Graph has a cycle! Cannot minimize DAG height.')
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
