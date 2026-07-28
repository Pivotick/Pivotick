import type { Edge } from '../../Edge'
import type { Node } from '../../Node'

/**
 * Detects whether a directed graph contains at least one cycle.
 *
 * This function performs a depth-first search (DFS) across all nodes in the graph.
 *
 * @param nodes - The list of graph nodes to inspect.
 * @param edges - The list of directed graph edges connecting the nodes.
 * @returns `true` if the graph contains a cycle, otherwise `false`.
 */
export default function hasCycle(nodes: Node[], edges: Edge[]): boolean {
    const adj: Record<string, string[]> = {}
    for (const node of nodes) {
        adj[node.id] = []
    }
    for (const { source, target } of edges) {
        if (!adj[source.id]) 
            adj[source.id] = []
        adj[source.id].push(target.id)
    }

    const visited = new Set<string>()
    // Nodes on the path currently being explored: reaching one again is a back edge.
    const onPath = new Set<string>()
    // Explicit stack of (node, index of its next unexplored neighbour) frames. A recursive
    // DFS overflows the call stack on a long path, and path length follows the caller's data.
    const stack: Array<{ id: string, next: number }> = []

    for (const node of nodes) {
        if (visited.has(node.id)) continue

        visited.add(node.id)
        onPath.add(node.id)
        stack.push({ id: node.id, next: 0 })

        while (stack.length > 0) {
            const frame = stack[stack.length - 1]
            const neighbors = adj[frame.id] ?? []

            if (frame.next >= neighbors.length) {
                onPath.delete(frame.id)
                stack.pop()
                continue
            }

            const neighbor = neighbors[frame.next++]
            if (onPath.has(neighbor)) return true
            if (visited.has(neighbor)) continue

            visited.add(neighbor)
            onPath.add(neighbor)
            stack.push({ id: neighbor, next: 0 })
        }
    }

    return false
}