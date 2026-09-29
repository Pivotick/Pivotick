import type { Node } from '../Node'
import type { GroupNode } from '../Simplification/GroupNode'
import type { DeleteOrigin } from '../interfaces/InterractionCallbacks'
import type { UIManager } from './UIManager'
import { expandGroups } from './groupActions'

/** The selected nodes, groups included. */
export function selectedNodes(uiManager: UIManager): Node[] {
    return uiManager.graph.renderer.getGraphInteraction().getSelectedNodes().map(selection => selection.node)
}

/**
 * The selection when `node` is part of it and it holds more than one node; otherwise
 * nothing. What an action started on `node` should act on.
 */
export function selectionAround(uiManager: UIManager, node: Node): Node[] | undefined {
    const selected = selectedNodes(uiManager)
    return selected.length > 1 && selected.includes(node) ? selected : undefined
}

export function clearNodeSelection(uiManager: UIManager): void {
    uiManager.graph.renderer.getGraphInteraction().clearNodeSelectionList()
}

/** Freeze each node where it is; no reheat, so the layout stays put around them. */
export function pinNodes(nodes: Node[]): void {
    for (const node of nodes) node.freeze()
}

/** Release each node, and give the layout some energy to move them (only when physics runs). */
export function unpinNodes(uiManager: UIManager, nodes: Node[]): void {
    for (const node of nodes) node.unfreeze()
    const simulation = uiManager.graph.simulation
    if (simulation.isEnabled()) simulation.reheat()
}

/** Hide the nodes as one undo step. A group is hidden by hiding what it stands for. */
export function hideNodes(uiManager: UIManager, nodes: Node[]): void {
    const graph = uiManager.graph
    graph.history.group(() => {
        for (const node of expandGroups(nodes)) graph.queryEngine.excludeNode(node)
    })
}

/** Route the nodes through the before-delete hook. Resolves whether they were deleted. */
export async function deleteNodes(uiManager: UIManager, nodes: Node[], origin: DeleteOrigin): Promise<boolean> {
    const outcome = await uiManager.graph.editing.requestDelete({ nodes: expandGroups(nodes), origin })
    return outcome.accepted
}

/** Replace the selection with the nodes linked to any of these, themselves left out. */
export function selectNeighbours(uiManager: UIManager, nodes: Node[]): void {
    const own = new Set(nodes)
    const neighbours = new Set<Node>()
    for (const node of nodes) {
        const linked = node.isGroup
            ? (node as GroupNode).info.anchors
            : [...node.getConnectedNodes(), ...node.getConnectingNodes()]
        for (const neighbour of linked) {
            if (!own.has(neighbour)) neighbours.add(neighbour)
        }
    }
    uiManager.graph.selectElements([...neighbours])
}
