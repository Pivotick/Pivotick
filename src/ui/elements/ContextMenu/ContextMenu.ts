import { Edge } from '../../../Edge'
import type { Node } from '../../../Node'
import { knownTotal } from '../../../PivotManager'
import type { PivotMenuChoice } from '../../../interfaces/Pivot'
import { createActionList, createHtmlElement, createQuickActionList, generateSafeDomId } from '../../../utils/ElementCreation'
import { addCircle, dataTable, edit, expand, focusElement, fullscreen, graphEdgeIcon, groupNodes, hide, inspect, pin, selectNeighbor, sparkles, stickyNote, trash, ungroupNodes, unpin } from '../../icons'
import type { UIElement, UIManager } from '../../UIManager'
import { UIComponent } from '../../UIComponent'
import './contextmenu.scss'
import { deepMerge } from '../../../utils/utils'
import type { Editors, MenuActionItemOptions, MenuQuickActionItemOptions } from '../../../interfaces/GraphUI'
import type { UIFeature } from '../../UIManager'
import { createInspectModal } from '../modals/InspectNodeModal/InspectNodeModal'
import { openImageLightbox } from '../modals/ImageLightboxModal/ImageLightboxModal'
import { Note } from '../../../Note'
import { pickNode } from '../../components/NodePickers'
import { nodeNameGetter } from '../../../utils/GraphGetters'
import { getNodeImageHref } from '../../../utils/NodePreview'
import type { GroupNode } from '../../../Simplification/GroupNode'
import { expandGroups, groupSelection, manualGroupsIn, openGroupFromCanvas, renameGroupPrompt, selectGroupMembers, showGroupMembersInTable } from '../../groupActions'
import { clearNodeSelection, deleteNodes, hideNodes, pinNodes, selectNeighbours, selectionAround, unpinNodes } from '../../selectionActions'

/**
 * A library default that is only offered while the feature behind it is enabled — the
 * write-path entries (delete, edit, create), which a read-only integration wants gone
 * rather than present-but-refusing, and the entries that are a door into a switchable
 * feature (notes, the inspector). Consumer-supplied entries are never gated.
 */
type GatedMenuItem = { requires?: keyof Editors | UIFeature }

type GatedActionItem = MenuActionItemOptions & GatedMenuItem
type GatedQuickActionItem = MenuQuickActionItemOptions & GatedMenuItem

/** A menu section, as both the defaults and the merged options are shaped. */
type MenuSection = { topbar: GatedQuickActionItem[]; menu: GatedActionItem[] }

/**
 * How long *Pivot ▸* has to stay under the pointer before its rows ask what is out
 * there. It is the first row of the node menu, so the pointer crossing it on the way
 * to anything below opens the submenu in passing, and a registry of thirty providers
 * would ask a backend thirty questions nobody meant to ask.
 */
const PEEK_DELAY = 200

const fmt = (value: number): string => value.toLocaleString()

/** The nodes a menu was opened over: the selection's, or the one clicked. */
const asNodes = (element: unknown): Node[] => Array.isArray(element) ? element as Node[] : element ? [element as Node] : []

const defaultMenuNode = {
    topbar: [
        {
            title: 'Pin Node',
            svgIcon: pin,
            variant: 'outline-primary',
            visible: (node: Node) => {
                return !node.frozen
            },
            onclick(this: ContextMenu, _evt: PointerEvent, node: Node) {
                node.freeze()
            }
        },
        {
            title: 'Unpin Node',
            svgIcon: unpin,
            variant: 'outline-primary',
            visible: (node: Node) => {
                return node.frozen
            },
            onclick(this: ContextMenu, _evt: PointerEvent, node: Node) {
                node.unfreeze()
            }
        },
        {
            title: 'Focus Node',
            svgIcon: focusElement,
            variant: 'outline-primary',
            onclick(this: ContextMenu, _evt: PointerEvent, node: Node) {
                this.uiManager.graph.focusElement(node)
            },
        },
        {
            title: 'Hide Node',
            svgIcon: hide,
            variant: 'outline-danger',
            flushRight: true,
            visible: (node: Node) => {
                return node.visible
            },
            onclick(this: ContextMenu, _evt: PointerEvent, node: Node) {
                this.uiManager.graph.queryEngine.excludeNode(node)
            }
        },
    ] as GatedQuickActionItem[],
    menu: [
        {
            text: 'View Image',
            title: 'View Image',
            svgIcon: fullscreen,
            variant: 'outline-primary',
            // Only for picture nodes: read the resolved src straight off the rendered node.
            visible: (node: Node) => !!getNodeImageHref(node),
            onclick(this: ContextMenu, _evt: PointerEvent, node: Node) {
                const src = getNodeImageHref(node)
                if (src) openImageLightbox(this.uiManager, src, nodeNameGetter(node, this.uiManager.getOptions().mainHeader))
            },
        },
        {
            text: 'Select Neighbors',
            title: 'Select Neighbors',
            svgIcon: selectNeighbor,
            variant: 'outline-primary',
            onclick(this: ContextMenu, _evt: PointerEvent, node: Node) {
                const neighbors = [
                    ...node.getConnectedNodes(),
                    ...node.getConnectingNodes()
                ].map((node) => {
                    return {
                        node: node,
                        element: node.getGraphElement()
                    }
                })
                this.uiManager.graph.renderer.getGraphInteraction().selectNodes(neighbors)
            },
        },
        {
            text: 'Hide Children',
            title: 'Hide Children',
            svgIcon: hide,
            variant: 'outline-primary',
            visible: (node: Node) => {
                return node.visible
            },
            onclick(this: ContextMenu, _evt: PointerEvent, node: Node) {
                node.hide()
            }
        },
        {
            text: 'Connect to...',
            title: 'Connect to...',
            requires: 'edgeCreator',
            svgIcon: graphEdgeIcon(24),
            variant: 'outline-primary',
            visible: (node: Node) => {
                return node.visible
            },
            async onclick(this: ContextMenu, _evt: PointerEvent, node: Node) {
                const mainLabel = nodeNameGetter(node, this.uiManager.graph.UIManager.getOptions().mainHeader).trim()
                const title = document.createElement('div')
                title.textContent = 'Select the target node to link with'
                const pre = document.createElement('b')
                pre.textContent = `"${mainLabel}"`
                pre.classList.add('pvt-ms-1')
                title.appendChild(pre)
                const targetNode = await pickNode(this.uiManager.graph.UIManager, title)
                if (!targetNode) return

                const edgeID = generateSafeDomId(8, 'edge-')
                const edge = new Edge(edgeID, node, targetNode, {})
                this.uiManager.graph.addEdge(edge)
            }
        },
        {
            text: 'Expand Node',
            title: 'Expand Node',
            svgIcon: expand,
            variant: 'outline-primary',
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            visible: (_node: Node) => {
                return false // FIXME: Implement feature
            },
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            onclick(this: ContextMenu, _evt: PointerEvent, _node: Node) {
            },
        },
        {
            text: 'Inspect Properties',
            title: 'Inspect Properties',
            requires: 'inspector',
            svgIcon: inspect,
            variant: 'outline-primary',
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            visible: (_node: Node) => {
                return true
            },
            onclick(this: ContextMenu, _evt: PointerEvent, node: Node) {
                createInspectModal(node, this.uiManager)
            },
            shortcut: 'I'
        },
    ] as GatedActionItem[],
}

/**
 * A group's menu: it acts for its members. The node menu's single-node entries (edit,
 * connect-to, inspect) have nothing to act on, and an app's own node entries expect a
 * node's data, so a group has a section of its own.
 */
const defaultMenuGroup = {
    topbar: [
        {
            title: 'Pin Group',
            svgIcon: pin,
            variant: 'outline-primary',
            visible: (node: Node) => !node.frozen,
            onclick(this: ContextMenu, _evt: PointerEvent, node: Node) {
                node.freeze()
            },
        },
        {
            title: 'Unpin Group',
            svgIcon: unpin,
            variant: 'outline-primary',
            visible: (node: Node) => node.frozen,
            onclick(this: ContextMenu, _evt: PointerEvent, node: Node) {
                node.unfreeze()
            },
        },
        {
            title: 'Focus Group',
            svgIcon: focusElement,
            variant: 'outline-primary',
            onclick(this: ContextMenu, _evt: PointerEvent, node: Node) {
                this.uiManager.graph.focusElement(node)
            },
        },
    ] as GatedQuickActionItem[],
    menu: [
        {
            text: 'Select Neighbors',
            title: 'Select the nodes this group links to',
            svgIcon: selectNeighbor,
            variant: 'outline-primary',
            onclick(this: ContextMenu, _evt: PointerEvent, node: Node) {
                this.uiManager.graph.selectElements((node as GroupNode).info.anchors)
            },
        },
    ] as GatedActionItem[],
}

/**
 * The menu over a node that is part of a multi-selection: every entry acts on the whole
 * selection, as the bulk bar does. Entries that only make sense for one node are left out.
 */
const defaultMenuSelection = {
    topbar: [
        {
            title: 'Pin Selected',
            svgIcon: pin,
            variant: 'outline-primary',
            visible: (nodes: Node[]) => nodes.some(node => !node.frozen),
            onclick(this: ContextMenu, _evt: PointerEvent, nodes: Node[]) {
                pinNodes(nodes)
            },
        },
        {
            title: 'Unpin Selected',
            svgIcon: unpin,
            variant: 'outline-primary',
            visible: (nodes: Node[]) => nodes.some(node => node.frozen),
            onclick(this: ContextMenu, _evt: PointerEvent, nodes: Node[]) {
                unpinNodes(this.uiManager, nodes)
            },
        },
        {
            title: 'Hide Selected',
            svgIcon: hide,
            variant: 'outline-danger',
            flushRight: true,
            onclick(this: ContextMenu, _evt: PointerEvent, nodes: Node[]) {
                hideNodes(this.uiManager, nodes)
                clearNodeSelection(this.uiManager)
            },
        },
    ] as GatedQuickActionItem[],
    menu: [
        {
            text: 'Select Neighbors',
            title: 'Select the nodes linked to the selection',
            svgIcon: selectNeighbor,
            variant: 'outline-primary',
            onclick(this: ContextMenu, _evt: PointerEvent, nodes: Node[]) {
                selectNeighbours(this.uiManager, nodes)
            },
        },
    ] as GatedActionItem[],
}

/** Each menu's delete, kept apart so it can close the menu below an app's own entries. */
const deleteNodeEntry = {
    text: 'Delete Node',
    title: 'Delete Node',
    requires: 'deletion',
    svgIcon: trash,
    variant: 'outline-danger',
    onclick(this: ContextMenu, _evt: PointerEvent, node: Node) {
        void this.uiManager.graph.editing.requestDelete({ nodes: [node], origin: 'context-menu' })
    },
} as GatedActionItem

const deleteMembersEntry = {
    text: 'Delete members',
    title: 'Delete every node in this group',
    requires: 'deletion',
    svgIcon: trash,
    variant: 'outline-danger',
    onclick(this: ContextMenu, _evt: PointerEvent, node: Node) {
        void this.uiManager.graph.editing.requestDelete({ nodes: (node as GroupNode).info.members, origin: 'context-menu' })
    },
} as GatedActionItem

const deleteSelectedEntry = {
    text: 'Delete Selected',
    title: 'Delete every selected node',
    requires: 'deletion',
    svgIcon: trash,
    variant: 'outline-danger',
    onclick(this: ContextMenu, _evt: PointerEvent, nodes: Node[]) {
        const ui = this.uiManager
        void deleteNodes(ui, nodes, 'context-menu').then(deleted => { if (deleted) clearNodeSelection(ui) })
    },
} as GatedActionItem

/** A group's own entries, which open its menu after *Pivot ▸*. */
const groupEntries = [
    {
        text: 'Open group',
        title: 'Put the members back on the canvas',
        svgIcon: ungroupNodes,
        variant: 'outline-primary',
        onclick(this: ContextMenu, _evt: PointerEvent, node: Node) {
            openGroupFromCanvas(this.uiManager, node as GroupNode)
        },
    },
    {
        text: 'Select members',
        title: 'Select the nodes in this group',
        svgIcon: selectNeighbor,
        variant: 'outline-primary',
        onclick(this: ContextMenu, _evt: PointerEvent, node: Node) {
            selectGroupMembers(this.uiManager, node as GroupNode)
        },
    },
] as GatedActionItem[]

const defaultMenuEdge: MenuSection = {
    topbar: [],
    menu: [
        {
            text: 'Edit Edge',
            title: 'Edit Edge',
            requires: 'edgeEditor',
            svgIcon: edit,
            variant: 'outline-primary',
            onclick(this: ContextMenu, _evt: PointerEvent, edge: Edge) {
                this.uiManager.graph.editing.openEdgeSession(edge)
            },
        },
        {
            text: 'Delete Edge',
            title: 'Delete Edge',
            requires: 'deletion',
            svgIcon: trash,
            variant: 'outline-danger',
            onclick(this: ContextMenu, _evt: PointerEvent, edge: Edge) {
                void this.uiManager.graph.editing.requestDelete({ edges: [edge], origin: 'context-menu' })
            },
        },
    ] as GatedActionItem[],
}

const defaultMenuCanvas = {
    topbar: [
        {
            title: 'Pin All',
            svgIcon: pin,
            variant: 'outline-primary',
            visible: true,
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            onclick(this: ContextMenu, _evt: PointerEvent) {
                const nodes = this.uiManager.graph.getMutableNodes() ?? []
                nodes.forEach((node: Node) => {
                    node.freeze()
                })
            }
        },
        {
            title: 'Unpin All',
            svgIcon: unpin,
            variant: 'outline-primary',
            visible: true,
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            onclick(this: ContextMenu, _evt: PointerEvent) {
                const nodes = this.uiManager.graph.getMutableNodes() ?? []
                nodes.forEach((node: Node) => {
                    node.unfreeze()
                })
                this.uiManager.graph.simulation?.reheat()
            }
        },
    ] as GatedQuickActionItem[],
    menu: [
        {
            title: 'Add Node Here',
            text: 'Add Node Here',
            requires: 'nodeCreator',
            svgIcon: addCircle,
            variant: 'outline-primary',
            visible: true,
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            onclick(this: ContextMenu, _evt: PointerEvent) {
                // Place it where the menu was opened — correct under any zoom/pan.
                void this.uiManager.graph.editing.requestNodeCreate({
                    position: this.openPoint(),
                    origin: 'context-menu',
                })
            },
        },
        {
            title: 'Add Note',
            text: 'Add Note',
            requires: 'notes',
            svgIcon: stickyNote,
            variant: 'outline-primary',
            visible: true,
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            onclick(this: ContextMenu, _evt: PointerEvent) {
                const { x, y } = this.openPoint()
                const note: Note = new Note({
                    content: 'This is not a note.',
                    x,
                    y
                })
                this.uiManager.graph.noteManager.addNote(note)
            },
            shortcut: 'n'
        }
    ] as GatedActionItem[],
}

const defaultMenuNote = {
    topbar: [
        {
            title: 'Hide Note',
            svgIcon: hide,
            variant: 'outline-danger',
            flushRight: true,
            visible: (note: Node) => {
                return note.visible
            },
            onclick(this: ContextMenu, _evt: PointerEvent, note: Note) {
                this.uiManager.graph.noteManager.hideNote(note)
            }
        },
    ] as GatedQuickActionItem[],
    menu: [
        {
            title: 'Remove Note',
            text: 'Remove Note',
            requires: 'deletion',
            svgIcon: trash,
            variant: 'outline-danger',
            visible: true,
            onclick(this: ContextMenu, _evt: PointerEvent, note: Note) {
                void this.uiManager.graph.editing.requestDelete({ notes: [note], origin: 'context-menu' })
            },
            shortcut: 'n'
        }
    ] as GatedActionItem[],
}

export class ContextMenu extends UIComponent {

    public menu?: HTMLDivElement
    public visible: boolean
    private parentContainer?: HTMLElement

    private element: Node | Node[] | Edge | Note | null = null

    /** Client coords the menu was last opened at (see {@link openPoint}). */
    private openedAt: { x: number, y: number } | null = null

    private menuNode: MenuSection
    private menuGroup: MenuSection
    private menuSelection: MenuSection
    private menuEdge: MenuSection
    private menuNote: MenuSection
    private menuCanvas: MenuSection

    /**
     * The submenu panels standing open, outermost first. A stack rather than one
     * panel: a row inside a submenu may open one of its own, and closing a level has
     * to take everything it opened with it.
     */
    private flyouts: Array<{ panel: HTMLDivElement, row: HTMLElement }> = []
    /**
     * Closing runs on a short delay, cancelled by arriving somewhere that should keep
     * the panel open. Without it, the diagonal from a row to its panel crosses the row
     * below and shuts the thing being reached for.
     */
    private closeTimer?: number
    /** Entries whose `onclick` is already wrapped, so opening a menu twice does not stack wrappers. */
    private readonly wrapped = new WeakSet<object>()
    /** Pivot rows waiting for a question to be put, collected as the submenu is built. */
    private peeks: Array<{ id: string, nodes: Node[], slot: HTMLElement }> = []
    /**
     * The pivots a question is out for, and the panel whose rows the answers belong to.
     * A peek outlives neither: a question nobody is looking at is work a backend should
     * not still be doing.
     */
    private asked: string[] = []
    private peekHost?: HTMLElement
    private peekTimer?: number
    /** Bumped whenever the peeks are dropped, so a late answer cannot paint a dead row. */
    private peekToken = 0

    constructor(uiManager: UIManager) {
        super(uiManager)
        this.visible = false

        const options = this.uiManager.getOptions().contextMenu
        this.menuEdge = deepMerge(this.gate(defaultMenuEdge), options.menuEdge ?? {})
        this.menuNote = deepMerge(this.gate(defaultMenuNote), options.menuNote ?? {})
        const canvasMenu = this.gate(defaultMenuCanvas)
        canvasMenu.menu.push(this.releasePinnedEntry())
        this.menuCanvas = deepMerge(canvasMenu, options.menuCanvas ?? {})
        // Every node-ish menu reads in four bands: *Pivot ▸*, the group entries, everything
        // else (the app's entries last), then the delete. Pivot's entry is built here rather
        // than declared because its `visible` reads the live registry, and a predicate is
        // resolved without `this` bound (`ElementCreation.tryResolveBoolean`).
        this.menuNode = deepMerge(this.gate(defaultMenuNode), options.menuNode ?? {})
        this.menuNode.menu = [
            this.pivotEntry(),
            ...this.membershipEntries(),
            ...this.menuNode.menu,
            ...this.gateEntries([deleteNodeEntry]),
        ]
        this.menuGroup = this.gate(defaultMenuGroup)
        this.menuGroup.menu = [
            this.pivotEntry(),
            ...this.gateEntries(groupEntries), this.tableEntry(), ...this.manualGroupEntries(),
            ...this.menuGroup.menu,
            ...this.gateEntries([deleteMembersEntry]),
        ]
        this.menuSelection = deepMerge(this.gate(defaultMenuSelection), options.menuSelection ?? {})
        this.menuSelection.menu = [
            this.pivotEntry(),
            this.groupSelectionEntry(), ...this.membershipEntries(), this.ungroupSelectionEntry(),
            ...this.menuSelection.menu,
            ...this.gateEntries([deleteSelectedEntry]),
        ]
        this.wrapOnclickActions()
    }

    /**
     * *Pivot ▸* — the registry's applicable pivots, each one click from running, with
     * the panel behind the last row for the runs that want reading and narrowing first.
     * Absent rather than disabled where nothing applies, which is what `appliesTo`
     * promises; absent too where the mode itself does not exist.
     */
    private pivotEntry(): MenuActionItemOptions {
        const ui = this.uiManager
        return {
            text: 'Pivot',
            title: 'Pivot',
            svgIcon: sparkles,
            variant: 'outline-primary',
            // The node menu only ever carries a node, so the cast is the shape of this
            // section rather than an assumption about the element. Judged on the clicked
            // node, not the origin below: with a selection nothing applies to, the panel
            // row is still the way to find that out.
            visible: (element) =>
                !!ui.pivotMode && !!element && ui.graph.pivots.for(expandGroups(asNodes(element))).length > 0,
            submenu: (element) => this.pivotSubmenu(element as Node | Node[]),
        }
    }

    /** Unpin every pinned node and group at once; shown only while something is pinned. */
    private releasePinnedEntry(): MenuActionItemOptions {
        const ui = this.uiManager
        const pinned = () => [...new Set([...ui.graph.getMutableNodes(), ...ui.graph.getCanvasNodes()])].filter(node => node.frozen)
        return {
            text: 'Release pinned nodes',
            title: 'Unpin every pinned node so the layout can move them again',
            svgIcon: unpin,
            variant: 'outline-primary',
            visible: () => pinned().length > 0,
            onclick: () => unpinNodes(ui, pinned()),
        }
    }

    /** Rename or remove a group made by hand. */
    private manualGroupEntries(): MenuActionItemOptions[] {
        const ui = this.uiManager
        const simplify = ui.graph.simplify
        return [
            {
                text: 'Rename group',
                title: 'Give this group a title',
                svgIcon: edit,
                variant: 'outline-primary',
                visible: (element) => !!element && simplify.isManual((element as GroupNode).id),
                onclick: (_event, element) => void renameGroupPrompt(ui, element as GroupNode),
            },
            {
                text: 'Ungroup',
                title: 'Draw the members as they were before this group',
                svgIcon: ungroupNodes,
                variant: 'outline-primary',
                visible: (element) => !!element && simplify.isManual((element as GroupNode).id),
                onclick: (_event, element) => simplify.ungroup(element as GroupNode),
            },
        ]
    }

    /** Group the selection. */
    private groupSelectionEntry(): MenuActionItemOptions {
        const ui = this.uiManager
        return {
            text: 'Group selected nodes',
            title: 'Fold the selection into one group with a title',
            svgIcon: groupNodes,
            variant: 'outline-primary',
            visible: (element) => ui.graph.simplify.isEnabled() && ui.graph.simplify.groupableIds(asNodes(element)).length >= 2,
            onclick: (_event, element) => void groupSelection(ui, asNodes(element)),
        }
    }

    /** Remove the hand-made groups the selection holds or sits in. */
    private ungroupSelectionEntry(): MenuActionItemOptions {
        const ui = this.uiManager
        return {
            text: 'Ungroup',
            title: 'Draw the members of these hand-made groups as they were',
            svgIcon: ungroupNodes,
            variant: 'outline-primary',
            visible: (element) => ui.graph.simplify.isEnabled() && manualGroupsIn(ui, asNodes(element)).length > 0,
            onclick: (_event, element) => ui.graph.simplify.ungroup(manualGroupsIn(ui, asNodes(element))),
        }
    }

    /** A group's members in the data dock. Judged when the menu opens: the table is built after this menu. */
    private tableEntry(): MenuActionItemOptions {
        const ui = this.uiManager
        return {
            text: 'View members in table',
            title: 'List the members in the data dock, to filter and search them',
            svgIcon: dataTable,
            variant: 'outline-primary',
            visible: () => !!ui.table,
            onclick: (_event, element) => showGroupMembersInTable(ui, element as GroupNode),
        }
    }

    /**
     * Take members out of their groups, or let pulled-out nodes back in. A closed group's
     * members are reached from the data dock.
     */
    private membershipEntries(): MenuActionItemOptions[] {
        const simplify = this.uiManager.graph.simplify
        const grouped = (element: unknown) => asNodes(element).filter(node => !node.isGroup && simplify.groupOf(node))
        const pulled = (element: unknown) => asNodes(element).filter(node => simplify.isPulledOut(node))
        return [
            {
                text: 'Pull out of group',
                title: 'Keep these nodes out of their groups',
                svgIcon: ungroupNodes,
                variant: 'outline-primary',
                visible: (element) => grouped(element).length > 0,
                onclick: (_evt, element) => simplify.pullOut(grouped(element)),
            },
            {
                text: 'Put back in group',
                title: 'Let these nodes be grouped again',
                svgIcon: groupNodes,
                variant: 'outline-primary',
                visible: (element) => pulled(element).length > 0,
                onclick: (_evt, element) => simplify.putBack(pulled(element)),
            },
        ]
    }

    /**
     * One row per pivot that applies, then the panel. A row *is* the run: nothing to
     * narrow, so where the results land is decided by their size and the pivot's own
     * `autoIngest` — see {@link UIManager.quickPivot}.
     *
     * Opening the submenu is also the gesture that asks every pivot advertising a count
     * what is out there, so a row says how much it would bring before it is clicked. The
     * question is the pivot panel's own — `{}` narrowing over this origin — so the answer
     * is the one the mode would show, and it is cached for whichever asks second.
     */
    private pivotSubmenu(element: Node | Node[]): MenuActionItemOptions[] {
        const ui = this.uiManager
        // A group pivots on its members, alone or in a selection.
        const origin = expandGroups(asNodes(element))
        const rows: MenuActionItemOptions[] = ui.graph.pivots.for(origin).map(definition => {
            const row: MenuActionItemOptions = {
                text: definition.label,
                title: definition.label,
                svgIcon: definition.icon ?? sparkles,
                variant: 'outline-primary',
                suffix: definition.summarize ? this.peekSlot(definition.id, origin) : undefined,
            }
            const choices = definition.menuChoices?.(ui.graph.pivots.originFor(definition.id, origin)) ?? []
            if (choices.length) {
                row.submenu = this.pivotChoices(definition.id, origin, choices)
                return row
            }
            row.onclick = () => {
                // The run asks this pivot the same question, so the peek is handed over
                // rather than aborted from under it when the menu closes.
                this.asked = this.asked.filter(id => id !== definition.id)
                void ui.quickPivot(origin, definition.id)
            }
            return row
        })
        this.startPeeks()
        rows.push({
            text: 'Open pivot panel…',
            title: 'Read the counts, narrow, then run',
            svgIcon: sparkles,
            variant: 'outline-primary',
            dividerBefore: rows.length > 0,
            onclick: () => ui.openPivotMode(origin),
        })
        return rows
    }

    /**
     * A pivot's own choices, each a run with its narrowing, then its panel. The choices
     * carry no peek: a pivot answers one question at a time, so several would supersede
     * one another. The pivot's row above keeps the unnarrowed count.
     */
    private pivotChoices(id: string, origin: Node[], choices: PivotMenuChoice[]): MenuActionItemOptions[] {
        const ui = this.uiManager
        const rows: MenuActionItemOptions[] = choices.map(choice => ({
            text: choice.label,
            title: choice.title ?? choice.label,
            variant: 'outline-primary',
            onclick: () => {
                // Closing the menu cancels what its peeks asked, which would take the
                // run's own gate question with it.
                this.asked = this.asked.filter(asked => asked !== id)
                void ui.quickPivot(origin, id, choice.narrowing)
            },
        }))
        rows.push({
            text: 'Open pivot panel…',
            title: 'Read the counts, narrow, then run',
            svgIcon: sparkles,
            variant: 'outline-primary',
            dividerBefore: true,
            onclick: () => ui.openPivotMode(origin, id),
        })
        return rows
    }

    /**
     * The right-hand end of a pivot row, where its advertised count goes. A cached
     * answer is painted at once: asking twice about the same question is what the cache
     * is for, and a number already known must not flicker through a loading state.
     */
    private peekSlot(id: string, origin: Node[]): HTMLElement {
        const pivots = this.uiManager.graph.pivots
        const slot = createHtmlElement('span', { class: 'pvt-contextmenu-peek' })
        const nodes = pivots.originFor(id, origin)
        const cached = pivots.cachedSummary(id, nodes)
        if (cached) {
            this.paintPeek(slot, knownTotal(cached), nodes.length)
            return slot
        }
        slot.classList.add('pvt-contextmenu-peek-waiting')
        this.peeks.push({ id, nodes, slot })
        return slot
    }

    /** Ask, once the pointer has stayed — see {@link PEEK_DELAY}. */
    private startPeeks(): void {
        if (!this.peeks.length) return
        const peeks = this.peeks
        const token = this.peekToken
        this.peeks = []
        this.asked = peeks.map(peek => peek.id)
        this.peekTimer = window.setTimeout(() => {
            for (const peek of peeks) void this.peek(peek.id, peek.nodes, peek.slot, token)
        }, PEEK_DELAY)
    }

    /** One pivot's question, and whatever it answers, written into its own row. */
    private async peek(id: string, nodes: Node[], slot: HTMLElement, token: number): Promise<void> {
        try {
            const summary = await this.uiManager.graph.pivots.summarize(id, nodes)
            if (token !== this.peekToken) return
            // `undefined` is a superseded call rather than an answer: something newer is
            // on its way and owns the slot from here. The row keeps its place, blank.
            if (summary) this.paintPeek(slot, knownTotal(summary), nodes.length)
            else slot.classList.remove('pvt-contextmenu-peek-waiting')
        } catch {
            if (token !== this.peekToken) return
            // A peek that failed is worth a mark: the row still runs, but a provider
            // that cannot say what is out there rarely fetches it either.
            slot.classList.remove('pvt-contextmenu-peek-waiting')
            slot.textContent = '—'
            slot.title = 'This pivot could not say what is out there'
        }
    }

    /**
     * Advisory, and drawn as such — the `~` the pivot panel uses for the same number. A
     * count the provider does not know leaves the row blank, as a superseded peek does.
     */
    private paintPeek(slot: HTMLElement, total: number | undefined, nodes: number): void {
        slot.classList.remove('pvt-contextmenu-peek-waiting')
        if (total === undefined) return
        slot.textContent = `~${fmt(total)}`
        slot.title = nodes > 1
            ? `About ${fmt(total)} across ${fmt(nodes)} nodes`
            : `About ${fmt(total)} out there`
    }

    /** Stop asking: the panel the answers were for has gone. */
    private cancelPeeks(): void {
        this.peekToken++
        window.clearTimeout(this.peekTimer)
        this.peekTimer = undefined
        this.peeks = []
        this.peekHost = undefined
        for (const id of this.asked) this.uiManager.graph.pivots.cancel(id, 'summarize')
        this.asked = []
    }

    /**
     * Drop the default entries whose editor or feature is disabled, before the
     * consumer's own entries are merged in — those are never gated.
     */
    private gate(section: MenuSection): MenuSection {
        const editors: Array<keyof Editors> = ['nodeEditor', 'nodeCreator', 'edgeCreator', 'edgeEditor', 'deletion']
        const offered = <T>(item: T): boolean => {
            const requires = (item as GatedMenuItem).requires
            if (!requires) return true
            return editors.includes(requires as keyof Editors)
                ? this.uiManager.isEditorEnabled(requires as keyof Editors)
                : this.uiManager.isFeatureEnabled(requires as UIFeature)
        }
        return { topbar: section.topbar.filter(offered), menu: section.menu.filter(offered) }
    }

    /** {@link gate} for entries kept outside a section, such as the deletes. */
    private gateEntries(entries: GatedActionItem[]): MenuActionItemOptions[] {
        return this.gate({ topbar: [], menu: entries }).menu
    }

    protected onMount(container: HTMLElement | undefined) {
        if (!container) return

        // Parented to the widget root rather than `<body>`: while the container is
        // fullscreen the browser renders only its subtree, so a body-level menu
        // opened to nothing. `position: fixed` keeps it clear of the root's own
        // `overflow: hidden` — the same pairing `PivotickPicker` uses.
        this.parentContainer = container.closest('.pivotick') ?? document.body
        // `:not()` because a flyout wears the same class for its chrome, and adopting
        // one as the menu would leave the real menu unreachable.
        const menuContainer: HTMLDivElement | null =
            this.parentContainer.querySelector(':scope > .pvt-contextmenu:not(.pvt-contextmenu-flyout)')
        if (menuContainer) {
            this.menu = menuContainer
            return
        }
        const template = document.createElement('template')
        template.innerHTML = `
        <div class="pvt-contextmenu">
            <div class="pvt-contextmenu-topbar"></div>
            <div class="pvt-contextmenu-mainmenu"></div>
        </div>
        `
        this.menu = template.content.firstElementChild as HTMLDivElement

        this.parentContainer.appendChild(this.menu)
    }

    protected onDestroy() {
        this.closeFlyouts(0)
        document.removeEventListener('pointerdown', this.onOutsidePointerDown, true)
        this.menu?.remove()
        this.menu = undefined
    }

    protected onAfterMount() {
    }

    protected onGraphReady() {
        this.trackInteraction('nodeContextmenu', this.nodeClicked.bind(this))
        this.trackInteraction('edgeContextmenu', this.edgeClicked.bind(this))
        this.trackInteraction('noteContextmenu', this.noteClicked.bind(this))
        this.trackInteraction('canvasContextmenu', this.canvasClicked.bind(this))
        this.trackInteraction('canvasClick', () => { this.hide() })
        this.trackInteraction('canvasZoom', () => { this.hide() })
    }

    private nodeClicked(event: PointerEvent, node: Node): void {
        this.openFor(event, node)
    }

    private edgeClicked(event: PointerEvent, edge: Edge): void {
        this.openFor(event, edge)
    }

    /**
     * Open the menu for a node or an edge at the pointer, as a right-click on it does. A
     * node inside a multi-selection gets the selection's menu, whose entries act on all
     * of it; any other node gets its own, and the selection is left alone.
     */
    public openFor(event: MouseEvent, element: Node | Edge): void {
        if (!this.menu) return

        if (element instanceof Edge) {
            this.element = element
            this.createEdgeMenu(element)
        } else {
            const selection = selectionAround(this.uiManager, element)
            this.element = selection ?? element
            if (selection) this.createSelectionMenu(selection)
            else this.createNodeMenu(element)
        }
        this.setPosition(event)
        this.show()
    }

    private noteClicked(event: PointerEvent, note: Note): void {
        if (!this.menu) return
        // Nothing can put a note on the canvas while notes are off, but a note that
        // predates the switch must not open a menu for hiding and removing one either.
        if (!this.uiManager.isFeatureEnabled('notes')) return

        this.element = note
        this.createNoteMenu(note)
        this.setPosition(event)
        this.show()
    }

    private canvasClicked(event: PointerEvent): void {
        if (!this.menu) return

        this.element = null
        this.createCanvasMenu()
        this.setPosition(event)
        this.show()
    }

    private wrapOnclickActions() {
        [
            this.menuNode.menu,
            this.menuNode.topbar,
            this.menuGroup.menu,
            this.menuGroup.topbar,
            this.menuSelection.menu,
            this.menuSelection.topbar,
            this.menuEdge.menu,
            this.menuEdge.topbar,
            this.menuNote.menu,
            this.menuNote.topbar,
            this.menuCanvas.menu,
            this.menuCanvas.topbar,

        ].forEach(menuList => {
            menuList.forEach((entry) => {
                this.wrapOnclickAction(entry)
            })
        })
    }

    private wrapOnclickAction(entry: MenuQuickActionItemOptions | MenuActionItemOptions) {
        // A row that opens a submenu must not close the menu the submenu hangs off.
        if ((entry as MenuActionItemOptions).submenu) return
        if (this.wrapped.has(entry)) return
        this.wrapped.add(entry)
        if (entry.onclick) {
            const originalOnClick = entry.onclick
            // eslint-disable-next-line @typescript-eslint/no-this-alias
            const menu = this
            entry.onclick = function (
                this: UIElement,
                evt: PointerEvent | MouseEvent,
                element?: Node | Edge | Node[] | Edge[] | Note | Note[] | null
            ) {
                originalOnClick.apply(this, [evt, element])
                menu.hide?.()
            }
        }
    }

    private createNodeMenu(node: Node): void {
        if (!this.menu) return
        const section = node.isGroup ? this.menuGroup : this.menuNode

        const topbar = this.menu.querySelector('.pvt-contextmenu-topbar')!
        const mainMenu = this.menu.querySelector('.pvt-contextmenu-mainmenu')!
        this.closeFlyouts(0)
        topbar.innerHTML = ''
        mainMenu.innerHTML = ''
        topbar.appendChild(createQuickActionList<ContextMenu>(this, section.topbar, this.element))
        mainMenu.appendChild(createActionList<ContextMenu>(this, section.menu, this.element, this.rowWiring(0)))
    }

    private createSelectionMenu(nodes: Node[]): void {
        if (!this.menu) return

        const topbar = this.menu.querySelector('.pvt-contextmenu-topbar')!
        const mainMenu = this.menu.querySelector('.pvt-contextmenu-mainmenu')!
        this.closeFlyouts(0)
        topbar.innerHTML = ''
        mainMenu.innerHTML = ''
        const quickActions = createQuickActionList<ContextMenu>(this, this.menuSelection.topbar, nodes)
        quickActions.prepend(createHtmlElement('span', { class: 'pvt-contextmenu-caption' }, [`${fmt(nodes.length)} selected`]))
        topbar.appendChild(quickActions)
        mainMenu.appendChild(createActionList<ContextMenu>(this, this.menuSelection.menu, nodes, this.rowWiring(0)))
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private createEdgeMenu(_edge: Edge): void {
        if (!this.menu) return

        const topbar = this.menu.querySelector('.pvt-contextmenu-topbar')!
        const mainMenu = this.menu.querySelector('.pvt-contextmenu-mainmenu')!
        this.closeFlyouts(0)
        topbar.innerHTML = ''
        mainMenu.innerHTML = ''
        topbar.appendChild(createQuickActionList<ContextMenu>(this, this.menuEdge.topbar, this.element))
        mainMenu.appendChild(createActionList<ContextMenu>(this, this.menuEdge.menu, this.element, this.rowWiring(0)))
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private createNoteMenu(_note: Note): void {
        if (!this.menu) return

        const topbar = this.menu.querySelector('.pvt-contextmenu-topbar')!
        const mainMenu = this.menu.querySelector('.pvt-contextmenu-mainmenu')!
        this.closeFlyouts(0)
        topbar.innerHTML = ''
        mainMenu.innerHTML = ''
        topbar.appendChild(createQuickActionList<ContextMenu>(this, this.menuNote.topbar, this.element))
        mainMenu.appendChild(createActionList<ContextMenu>(this, this.menuNote.menu, this.element, this.rowWiring(0)))
    }

    private createCanvasMenu(): void {
        if (!this.menu) return

        const topbar = this.menu.querySelector('.pvt-contextmenu-topbar')!
        const mainMenu = this.menu.querySelector('.pvt-contextmenu-mainmenu')!
        this.closeFlyouts(0)
        topbar.innerHTML = ''
        mainMenu.innerHTML = ''
        topbar.appendChild(createQuickActionList<ContextMenu>(this, this.menuCanvas.topbar, this.element))
        mainMenu.appendChild(createActionList<ContextMenu>(this, this.menuCanvas.menu, this.element, this.rowWiring(0)))
    }

    // --- submenus ----------------------------------------------------------------------

    /**
     * What every row in a list at `depth` needs: its own submenu opened on hover and
     * toggled on click, and everything a *deeper* panel opened closed as soon as the
     * pointer lands on a sibling.
     */
    private rowWiring(depth: number): (row: HTMLDivElement, action: MenuActionItemOptions) => void {
        return (row, action) => {
            row.addEventListener('pointerenter', () => {
                this.cancelClose()
                this.closeFlyouts(depth + (action.submenu ? 1 : 0))
                if (action.submenu) this.openFlyout(row, action, depth)
            })
            row.addEventListener('pointerleave', () => this.closeSoon(depth + 1))
            if (!action.submenu) return
            row.addEventListener('click', event => {
                // The row is a door, not an action: the click must not reach the canvas,
                // and must not be read as "picked something". It opens and never closes
                // — the pointer arriving here has already opened the panel, so a toggle
                // would shut what the click was aimed at. Leaving is what closes it.
                event.stopPropagation()
                this.openFlyout(row, action, depth)
            })
        }
    }

    /** Draw one submenu beside its row, replacing whatever stood at that depth. */
    private openFlyout(row: HTMLDivElement, action: MenuActionItemOptions, depth: number): void {
        if (!this.parentContainer) return
        if (this.flyouts[depth]?.row === row) return
        this.closeFlyouts(depth)

        const items = typeof action.submenu === 'function'
            ? action.submenu(this.element)
            : action.submenu ?? []
        if (!items.length) return
        for (const item of items) this.wrapOnclickAction(item)

        // The same classes as the menu, so the chrome, the row styling and the theme
        // are one stylesheet rather than two that drift.
        const panel = document.createElement('div')
        panel.className = 'pvt-contextmenu pvt-contextmenu-flyout'
        const list = document.createElement('div')
        list.className = 'pvt-contextmenu-mainmenu'
        const rows = createActionList<ContextMenu>(this, items, this.element, this.rowWiring(depth + 1))
        list.appendChild(rows)
        panel.appendChild(list)
        panel.addEventListener('pointerenter', () => this.cancelClose())
        panel.addEventListener('pointerleave', () => this.closeSoon(depth))
        this.parentContainer.appendChild(panel)

        this.flyouts[depth] = { panel, row }
        // The panel whose rows asked, not a deeper one opened from it.
        if (this.asked.length) this.peekHost ??= panel
        row.classList.add('pvt-submenu-open')
        // Measured before it is shown: opacity does not move anything, so the box is
        // already the real one.
        // Before placing, since it changes the height the placement is measured from.
        this.trimToHalfRow(rows)
        this.placeFlyout(panel, row)
        panel.classList.add('shown')
    }

    /**
     * Lower a capped list to end **mid-row**, so a row cut in half says there is more
     * below. Nothing else here does: this platform's scrollbar can be an overlay that
     * paints nothing at rest, and a fade to the rows' own background is invisible.
     *
     * The stylesheet keeps the ceiling; this only ever trims it, and only for a list
     * long enough to be cut in the first place.
     */
    private trimToHalfRow(rows: HTMLElement): void {
        const first = rows.firstElementChild as HTMLElement | null
        if (!first) return
        const rowHeight = first.getBoundingClientRect().height
        const capped = rows.clientHeight
        if (!rowHeight || rows.scrollHeight <= capped) return

        const half = Math.round(rowHeight / 2)
        const whole = Math.floor((capped - half) / rowHeight)
        if (whole < 1) return
        rows.style.maxHeight = `${whole * rowHeight + half}px`
    }

    /** Beside its row, flipping back over the menu rather than off the viewport. */
    private placeFlyout(panel: HTMLDivElement, row: HTMLElement): void {
        const rowBox = row.getBoundingClientRect()
        const box = panel.getBoundingClientRect()
        const margin = 8
        // A few pixels of overlap, so travelling from the row to its panel never
        // crosses a gap that belongs to neither.
        const overlap = 4

        let left = rowBox.right - overlap
        if (left + box.width + margin > window.innerWidth) {
            left = Math.max(margin, rowBox.left - box.width + overlap)
        }
        let top = rowBox.top - 4
        if (top + box.height + margin > window.innerHeight) {
            top = Math.max(margin, window.innerHeight - box.height - margin)
        }
        panel.style.left = `${left}px`
        panel.style.top = `${top}px`
    }

    /** Close every panel from `depth` down. `closeFlyouts(0)` leaves none open. */
    private closeFlyouts(depth: number): void {
        for (let level = this.flyouts.length - 1; level >= depth; level--) {
            const open = this.flyouts[level]
            if (!open) continue
            open.row.classList.remove('pvt-submenu-open')
            // Only when the panel that asked is the one going: the pointer moving between
            // the pivot rows closes deeper levels, and must not take their counts with it.
            if (open.panel === this.peekHost) this.cancelPeeks()
            open.panel.remove()
        }
        this.flyouts.length = Math.min(this.flyouts.length, depth)
        if (!this.flyouts.length) this.cancelClose()
    }

    private closeSoon(depth: number): void {
        this.cancelClose()
        this.closeTimer = window.setTimeout(() => this.closeFlyouts(depth), 180)
    }

    private cancelClose(): void {
        if (this.closeTimer === undefined) return
        window.clearTimeout(this.closeTimer)
        this.closeTimer = undefined
    }

    public show(): void {
        if (this.visible) return
        if (!this.menu) return

        this.uiManager.tooltip?.hide()
        this.menu.classList.add('shown')
        this.visible = true
        // The canvas closes it on its own clicks; this covers the rest, such as the dock.
        document.addEventListener('pointerdown', this.onOutsidePointerDown, true)
    }

    private readonly onOutsidePointerDown = (event: PointerEvent): void => {
        const target = event.target as globalThis.Node | null
        if (target && (this.menu?.contains(target) || this.flyouts.some(open => open.panel.contains(target)))) return
        this.hide()
    }

    public hide(): void {
        if (!this.visible) return
        if (!this.menu) return

        this.closeFlyouts(0)
        document.removeEventListener('pointerdown', this.onOutsidePointerDown, true)

        this.element = null
        this.menu.classList.remove('shown')
        this.menu.style.left = '-10000px'
        this.visible = false
    }

    /**
     * The graph-space point the menu was opened at — what the "…here" entries act on.
     * Their own `onclick` event is the click on the *menu row*, tens of pixels away
     * from the gesture, so the opening position is captured instead.
     */
    public openPoint(): { x: number, y: number } {
        const renderer = this.uiManager.graph.renderer
        const canvas = this.uiManager.layout?.canvas
        if (this.openedAt) {
            return renderer.screenToGraphCoordinates(this.openedAt.x, this.openedAt.y)
        }

        // No menu has been opened (programmatic call): fall back to the view centre.
        const bcr = canvas?.getBoundingClientRect()
        return renderer.screenToGraphCoordinates(
            (bcr?.x ?? 0) + (bcr?.width ?? 0) / 2,
            (bcr?.y ?? 0) + (bcr?.height ?? 0) / 2
        )
    }

    private setPosition(event: MouseEvent): void {
        if (!this.menu) return

        const offset = 10
        // Client coords, because the menu is `position: fixed` — and because a page
        // that scrolls between opening the menu and picking an entry then needs no
        // correction at all.
        const x = event.clientX
        const y = event.clientY

        this.openedAt = { x, y }

        // Keep the whole menu on screen. `position: fixed` cannot spill past the
        // viewport — it just gets cut off — so near the right or bottom edge the
        // menu opens back towards the pointer instead. The content is built before
        // this runs, so the measured box is the real one.
        const box = this.menu.getBoundingClientRect()
        const margin = 8
        const flipsLeft = x + offset + box.width + margin > window.innerWidth
        const flipsUp = y + offset + box.height + margin > window.innerHeight

        this.menu.style.left = `${flipsLeft ? Math.max(margin, x - offset - box.width) : x + offset}px`
        this.menu.style.top = `${flipsUp ? Math.max(margin, y - offset - box.height) : y + offset}px`
    }
}
