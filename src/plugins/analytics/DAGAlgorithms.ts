import type { Edge } from '../../Edge'
import type { Node } from '../../Node'


export function findFirstZeroInDegreeNode(nodes: Node[], edges: Edge[]): Node {
    const targets = new Set(edges.map(e => e.target.id))
    for (const node of nodes) {
        if (!targets.has(node.id)) return node
    }
    return nodes[0]
}


export function findMaxReachabilityRoot(nodes: Node[], edges: Edge[]): Node {
    // Build adjacency list for directed edges
    const adj = new Map<string, Node[]>()
    for (const node of nodes) {
        adj.set(node.id, [])
    }

    for (const edge of edges) {
        if (!adj.get(edge.from.id)) {
            console.log(edge)
        }
        adj.get(edge.from.id)!.push(edge.to)
    }

    // We'll memoize reachability counts to avoid recomputation
    const reachCount = new Map<Node, number>()
    const visitedCache = new Map<Node, Set<Node>>() // optional: store reachable sets for debugging

    function dfs(node: Node, seen = new Set<Node>()): Set<Node> {
        if (visitedCache.has(node)) {
            // return cached set (copy to avoid mutation)
            return new Set(visitedCache.get(node))
        }

        const reachable = new Set<Node>()
        for (const next of adj.get(node.id) ?? []) {
            if (!seen.has(next)) {
                seen.add(next)
                reachable.add(next)
                const deeper = dfs(next, seen)
                for (const n of deeper) reachable.add(n)
            }
        }
        visitedCache.set(node, reachable)
        reachCount.set(node, reachable.size)
        return reachable
    }

    // Compute reachability for all nodes
    for (const node of nodes) {
        if (!reachCount.has(node)) {
            dfs(node)
        }
    }

    // Find node with maximum reach count
    let bestNode: Node | null = null
    let maxReach = -1
    for (const node of nodes) {
        const count = reachCount.get(node) ?? 0
        if (count > maxReach) {
            maxReach = count
            bestNode = node
        }
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
