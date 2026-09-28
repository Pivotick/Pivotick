import type { Node } from '../Node'
import type { GroupNode } from '../Simplification/GroupNode'
import type { UIManager } from './UIManager'
import { runModal } from '../editing/PromptModal'

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

/**
 * Ask for a group's title, pre-filled. Resolves the typed title, or `null` when cancelled.
 * Where no modal can show, the default is taken without asking.
 */
async function askTitle(uiManager: UIManager, heading: string, submitLabel: string, value: string, note?: string): Promise<string | null> {
    if (!uiManager.layout?.modal) return value
    const input = document.createElement('input')
    input.type = 'text'
    input.className = 'pvt-group-title-input'
    input.value = value
    input.setAttribute('aria-label', 'Group title')
    return runModal<string>(uiManager.graph, {
        title: heading,
        submitLabel,
        bodyClass: 'pvt-group-title-body',
        populate: (body) => {
            body.appendChild(input)
            if (!note) return
            const hint = document.createElement('p')
            hint.className = 'pvt-group-title-note'
            hint.textContent = note
            body.appendChild(hint)
        },
        collect: () => input.value,
    })
}

/**
 * Group these nodes by hand, after asking for a title. The new group is selected, so its
 * panel is where it can be renamed. Returns the group's id, or nothing when cancelled or
 * when fewer than two of them can be grouped.
 */
export async function groupSelection(uiManager: UIManager, nodes: Node[]): Promise<string | undefined> {
    const graph = uiManager.graph
    const simplify = graph.simplify
    const ids = simplify.groupableIds(nodes)
    if (ids.length < 2) return undefined
    const left = expandGroups(nodes).length - ids.length
    const note = left > 0 ? `${left} of the selected ${left === 1 ? 'node stays' : 'nodes stay'} out: annotated, or an open cluster.` : undefined
    const title = await askTitle(uiManager, 'Group nodes', 'Group', simplify.defaultTitle(ids), note)
    if (title === null) return undefined
    const id = simplify.groupNodes(ids, title)
    const group = id ? simplify.getGroupNode(id) : undefined
    if (group) graph.selectElement(group)
    return id
}

/** Retitle a hand-made group, after asking. An empty title labels it by its types again. */
export async function renameGroupPrompt(uiManager: UIManager, group: GroupNode): Promise<void> {
    const simplify = uiManager.graph.simplify
    const title = await askTitle(uiManager, 'Rename group', 'Rename', simplify.labelOf(group.info))
    if (title !== null) simplify.renameGroup(group, title)
}

/** The hand-made groups among these nodes, and those holding any of them. */
export function manualGroupsIn(uiManager: UIManager, nodes: Node[]): string[] {
    const simplify = uiManager.graph.simplify
    const ids = new Set<string>()
    for (const node of nodes) {
        if (node.isGroup && simplify.isManual(node.id)) ids.add(node.id)
        const record = simplify.getManualGroups().find(candidate => candidate.members.includes(node.id))
        if (record) ids.add(record.id)
    }
    return [...ids]
}

/**
 * List a group's members in the data dock, where its column filters and search reach them.
 * The scope follows the group by id, so it keeps up with pull-outs and regrouping.
 */
export function showGroupMembersInTable(uiManager: UIManager, group: GroupNode): void {
    const simplify = uiManager.graph.simplify
    let name = simplify.labelOf(group.info)
    uiManager.table?.showScope({
        label: () => {
            const current = simplify.getGroupNode(group.id)
            if (current) name = simplify.labelOf(current.info)
            return `Members of ${name}`
        },
        ids: () => simplify.getGroupNode(group.id)?.info.members.map(member => member.id) ?? [],
    })
}
