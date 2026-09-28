import type { Node } from '../Node'
import type { GroupNode } from '../Simplification/GroupNode'
import type { UIManager } from './UIManager'

/**
 * Open a group, unless it holds more members than `UI.simplify.openConfirmAbove`: then
 * say so, and let the caller ask in its own place.
 */
export function openGroup(uiManager: UIManager, group: GroupNode): 'opened' | 'ask' {
    const simplify = uiManager.graph.simplify
    if (group.info.members.length > simplify.openConfirmAbove) return 'ask'
    simplify.open(group)
    return 'opened'
}

/**
 * Open a group from the canvas: at once, or, over the limit, through a toast asking
 * first. Where no toast can show there is no one to ask, so it opens.
 */
export function openGroupFromCanvas(uiManager: UIManager, group: GroupNode): void {
    if (openGroup(uiManager, group) === 'opened') return
    const simplify = uiManager.graph.simplify
    const asked = uiManager.graph.notifier.info(`Put ${simplify.labelOf(group.info)} on the canvas?`, undefined, {
        action: { label: 'Open', onClick: () => simplify.open(group) },
    })
    if (!asked) simplify.open(group)
}

/**
 * Select a group's members. A group within the open limit opens, so they are on the
 * canvas to be seen selected; a bigger one stays closed and lights up for them.
 */
export function selectGroupMembers(uiManager: UIManager, group: GroupNode): void {
    const graph = uiManager.graph
    if (!group.info.open && group.info.members.length <= graph.simplify.openConfirmAbove) graph.simplify.open(group)
    graph.selectElements(group.info.members)
}

/**
 * Select a node wherever it is folded. The groups holding it open on the way, outermost
 * first, as Select members opens one; a group above the open limit stays closed and is
 * selected instead.
 */
export function revealNode(uiManager: UIManager, node: Node): void {
    const graph = uiManager.graph
    let drawn = node.canvasRepresentative()
    while (drawn.isGroup) {
        const group = drawn as GroupNode
        if (group.info.members.length > graph.simplify.openConfirmAbove) {
            graph.selectElement(group)
            return
        }
        graph.simplify.open(group)
        const next = node.canvasRepresentative()
        if (next === drawn) break
        drawn = next
    }
    graph.selectElement(node)
}

/** What an action on these nodes acts on: each group stands for its members. */
export function expandGroups(nodes: Node[]): Node[] {
    const expanded = new Set<Node>()
    for (const node of nodes) {
        if (node.isGroup) for (const member of (node as GroupNode).info.members) expanded.add(member)
        else expanded.add(node)
    }
    return [...expanded]
}
