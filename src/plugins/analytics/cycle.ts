import type { Edge } from "../../Edge"
import type { Node } from "../../Node"

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
        adj[source.id].push(target.id)
    }

    const visited = new Set<string>()
    const recStack = new Set<string>()

    const dfs = (nodeId: string): boolean => {
        if (!visited.has(nodeId)) {
            visited.add(nodeId)
            recStack.add(nodeId)

            for (const neighbor of adj[nodeId]) {
                if (!visited.has(neighbor) && dfs(neighbor)) return true
                else if (recStack.has(neighbor)) return true
            }
        }
        recStack.delete(nodeId)
        return false
    }

    return nodes.some(node => dfs(node.id))
}