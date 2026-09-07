import { Edge } from '../../../Edge'
import type { Node } from '../../../Node'
import { createActionList, createQuickActionList, generateSafeDomId } from '../../../utils/ElementCreation'
import { addCircle, edit, expand, focusElement, fullscreen, graphEdgeIcon, hide, inspect, pin, selectNeighbor, sparkles, stickyNote, trash, unpin } from '../../icons'
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
        {
            text: 'Delete Node',
            title: 'Delete Node',
            requires: 'deletion',
            svgIcon: trash,
            variant: 'outline-danger',
            onclick(this: ContextMenu, _evt: PointerEvent, node: Node) {
                void this.uiManager.graph.editing.requestDelete({ nodes: [node], origin: 'context-menu' })
            },
        },
    ] as GatedActionItem[],
}

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

    private element: Node | Edge | Note | null = null

    /** Client coords the menu was last opened at (see {@link openPoint}). */
    private openedAt: { x: number, y: number } | null = null

    private menuNode: MenuSection
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

    constructor(uiManager: UIManager) {
        super(uiManager)
        this.visible = false

        this.menuNode = deepMerge(this.gate(defaultMenuNode), this.uiManager.getOptions().contextMenu.menuNode ?? {})
        this.menuEdge = deepMerge(this.gate(defaultMenuEdge), this.uiManager.getOptions().contextMenu.menuEdge ?? {})
        this.menuNote = deepMerge(this.gate(defaultMenuNote), this.uiManager.getOptions().contextMenu.menuNote ?? {})
        this.menuCanvas = deepMerge(this.gate(defaultMenuCanvas), this.uiManager.getOptions().contextMenu.menuCanvas ?? {})
        // Pivot's entry is added here rather than declared with the others because its
        // `visible` has to read the live registry, and a predicate is resolved without
        // `this` bound (`ElementCreation.tryResolveBoolean`).
        this.menuNode.menu.unshift(this.pivotEntry())
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
                !!ui.pivotMode && !!element && ui.graph.pivots.for([element as Node]).length > 0,
            submenu: (element) => this.pivotSubmenu(element as Node),
        }
    }

    /**
     * One row per pivot that applies, then the panel. A row *is* the run: no counts to
     * read and nothing to narrow, so where the results land is decided by their size
     * and the pivot's own `autoIngest` — see {@link UIManager.quickPivot}.
     */
    private pivotSubmenu(node: Node): MenuActionItemOptions[] {
        const ui = this.uiManager
        const origin = this.pivotOrigin(node)
        const rows: MenuActionItemOptions[] = ui.graph.pivots.for(origin).map(definition => ({
            text: definition.label,
            title: definition.label,
            svgIcon: definition.icon ?? sparkles,
            variant: 'outline-primary',
            onclick: () => void ui.quickPivot(origin, definition.id),
        }))
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
     * What the pivot runs on: the selection when the clicked node belongs to it, the
     * clicked node alone otherwise. A right-click changes no selection, so this is the
     * only way a bulk pivot is reachable from the menu — and clicking outside the
     * selection is the ordinary way of saying "this one, not those".
     */
    private pivotOrigin(node: Node): Node[] {
        const selected = this.uiManager.graph.renderer.getGraphInteraction()
            .getSelectedNodes()
            .map(selection => selection.node)
        return selected.some(candidate => candidate.id === node.id) ? selected : [node]
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
        if (!this.menu) return

        this.element = node
        this.createNodeMenu(node)
        this.setPosition(event)
        this.show()
    }

    private edgeClicked(event: PointerEvent, edge: Edge): void {
        if (!this.menu) return

        this.element = edge
        this.createEdgeMenu(edge)
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

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private createNodeMenu(_node: Node): void {
        if (!this.menu) return

        const topbar = this.menu.querySelector('.pvt-contextmenu-topbar')!
        const mainMenu = this.menu.querySelector('.pvt-contextmenu-mainmenu')!
        this.closeFlyouts(0)
        topbar.innerHTML = ''
        mainMenu.innerHTML = ''
        topbar.appendChild(createQuickActionList<ContextMenu>(this, this.menuNode.topbar, this.element))
        mainMenu.appendChild(createActionList<ContextMenu>(this, this.menuNode.menu, this.element, this.rowWiring(0)))
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
        list.appendChild(createActionList<ContextMenu>(this, items, this.element, this.rowWiring(depth + 1)))
        panel.appendChild(list)
        panel.addEventListener('pointerenter', () => this.cancelClose())
        panel.addEventListener('pointerleave', () => this.closeSoon(depth))
        this.parentContainer.appendChild(panel)

        this.flyouts[depth] = { panel, row }
        row.classList.add('pvt-submenu-open')
        // Measured before it is shown: opacity does not move anything, so the box is
        // already the real one.
        this.placeFlyout(panel, row)
        panel.classList.add('shown')
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
    }

    public hide(): void {
        if (!this.visible) return
        if (!this.menu) return

        this.closeFlyouts(0)

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

    private setPosition(event: PointerEvent): void {
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
