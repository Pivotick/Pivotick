import { Edge } from '../../../Edge'
import type { Node } from '../../../Node'
import { createActionList, createQuickActionList, generateSafeDomId } from '../../../utils/ElementCreation'
import { addCircle, edit, expand, focusElement, fullscreen, graphEdgeIcon, hide, inspect, pin, selectNeighbor, stickyNote, trash, unpin } from '../../icons'
import type { UIElement, UIManager } from '../../UIManager'
import { UIComponent } from '../../UIComponent'
import './contextmenu.scss'
import { deepMerge } from '../../../utils/utils'
import type { Editors, MenuActionItemOptions, MenuQuickActionItemOptions } from '../../../interfaces/GraphUI'
import { createInspectModal } from '../modals/InspectNodeModal/InspectNodeModal'
import { openImageLightbox } from '../modals/ImageLightboxModal/ImageLightboxModal'
import { Note } from '../../../Note'
import { pickNode } from '../../components/NodePickers'
import { nodeNameGetter } from '../../../utils/GraphGetters'
import { getNodeImageHref } from '../../../utils/NodePreview'

/**
 * A library default that is only offered while its editor is enabled — the write-path
 * entries (delete, edit, create), which a read-only integration wants gone rather than
 * present-but-refusing. Consumer-supplied entries are never gated.
 */
type GatedMenuItem = { requires?: keyof Editors }

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
            svgIcon: stickyNote,
            variant: 'outline-primary',
            visible: true,
            onclick(this: ContextMenu, evt: PointerEvent) {
                const renderer = this.uiManager.graph.renderer
                const { x, y } = renderer.screenToGraphCoordinates(
                    evt.clientX,
                    evt.clientY
                )
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

    /** Page coords the menu was last opened at (see {@link openPoint}). */
    private openedAt: { x: number, y: number } | null = null

    private menuNode: MenuSection
    private menuEdge: MenuSection
    private menuNote: MenuSection
    private menuCanvas: MenuSection

    constructor(uiManager: UIManager) {
        super(uiManager)
        this.visible = false

        this.menuNode = deepMerge(this.gate(defaultMenuNode), this.uiManager.getOptions().contextMenu.menuNode ?? {})
        this.menuEdge = deepMerge(this.gate(defaultMenuEdge), this.uiManager.getOptions().contextMenu.menuEdge ?? {})
        this.menuNote = deepMerge(this.gate(defaultMenuNote), this.uiManager.getOptions().contextMenu.menuNote ?? {})
        this.menuCanvas = deepMerge(this.gate(defaultMenuCanvas), this.uiManager.getOptions().contextMenu.menuCanvas ?? {})
        this.wrapOnclickActions()
    }

    /**
     * Drop the default entries whose editor is disabled, before the consumer's own
     * entries are merged in — those are never gated.
     */
    private gate(section: MenuSection): MenuSection {
        const offered = <T>(item: T): boolean => {
            const requires = (item as GatedMenuItem).requires
            return !requires || this.uiManager.isEditorEnabled(requires)
        }
        return { topbar: section.topbar.filter(offered), menu: section.menu.filter(offered) }
    }

    protected onMount(container: HTMLElement | undefined) {
        if (!container) return

        this.parentContainer = document.querySelector('body')!
        const menuContainer: HTMLDivElement | null = this.parentContainer.querySelector('.pvt-contextmenu')
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
        topbar.innerHTML = ''
        mainMenu.innerHTML = ''
        topbar.appendChild(createQuickActionList<ContextMenu>(this, this.menuNode.topbar, this.element))
        mainMenu.appendChild(createActionList<ContextMenu>(this, this.menuNode.menu, this.element))
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private createEdgeMenu(_edge: Edge): void {
        if (!this.menu) return

        const topbar = this.menu.querySelector('.pvt-contextmenu-topbar')!
        const mainMenu = this.menu.querySelector('.pvt-contextmenu-mainmenu')!
        topbar.innerHTML = ''
        mainMenu.innerHTML = ''
        topbar.appendChild(createQuickActionList<ContextMenu>(this, this.menuEdge.topbar, this.element))
        mainMenu.appendChild(createActionList<ContextMenu>(this, this.menuEdge.menu, this.element))
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private createNoteMenu(_note: Note): void {
        if (!this.menu) return

        const topbar = this.menu.querySelector('.pvt-contextmenu-topbar')!
        const mainMenu = this.menu.querySelector('.pvt-contextmenu-mainmenu')!
        topbar.innerHTML = ''
        mainMenu.innerHTML = ''
        topbar.appendChild(createQuickActionList<ContextMenu>(this, this.menuNote.topbar, this.element))
        mainMenu.appendChild(createActionList<ContextMenu>(this, this.menuNote.menu, this.element))
    }

    private createCanvasMenu(): void {
        if (!this.menu) return

        const topbar = this.menu.querySelector('.pvt-contextmenu-topbar')!
        const mainMenu = this.menu.querySelector('.pvt-contextmenu-mainmenu')!
        topbar.innerHTML = ''
        mainMenu.innerHTML = ''
        topbar.appendChild(createQuickActionList<ContextMenu>(this, this.menuCanvas.topbar, this.element))
        mainMenu.appendChild(createActionList<ContextMenu>(this, this.menuCanvas.menu, this.element))
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
            // Page → client coords, resolved now: the document may have scrolled
            // between opening the menu and picking the entry.
            return renderer.screenToGraphCoordinates(
                this.openedAt.x - window.scrollX,
                this.openedAt.y - window.scrollY
            )
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
        const x = event.pageX
        const y = event.pageY

        this.openedAt = { x, y }

        this.menu.style.left = `${x + offset}px`
        this.menu.style.top = `${y + offset}px`
    }
}
