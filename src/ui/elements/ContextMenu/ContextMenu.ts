import { Edge } from '../../../Edge'
import type { Node } from '../../../Node'
import { createActionList, createQuickActionList, generateSafeDomId } from '../../../utils/ElementCreation'
import { expand, focusElement, graphEdgeIcon, hide, inspect, pin, selectNeighbor, stickyNote, trash, unpin } from '../../icons'
import type { UIElement, UIManager } from '../../UIManager'
import './contextmenu.scss'
import { deepMerge } from '../../../utils/utils'
import type { MenuActionItemOptions, MenuQuickActionItemOptions } from '../../../interfaces/GraphUI'
import { createInspectModal } from '../modals/InspectNodeModal/InspectNodeModal'
import { Note } from '../../../Note'
import { pickNode } from '../../components/NodePickers'
import { nodeNameGetter } from '../../../utils/GraphGetters'

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
    ] as MenuQuickActionItemOptions[],
    menu: [
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
    ] as MenuActionItemOptions[],
}

const defaultMenuEdge: { topbar: MenuQuickActionItemOptions[]; menu: MenuActionItemOptions[] } = {
    topbar: [],
    menu: [],
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
    ] as MenuQuickActionItemOptions[],
    menu: [
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
    ] as MenuActionItemOptions[],
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
    ] as MenuQuickActionItemOptions[],
    menu: [
        {
            title: 'Remove Note',
            text: 'Remove Note',
            svgIcon: trash,
            variant: 'outline-danger',
            visible: true,
            onclick(this: ContextMenu, _evt: PointerEvent, note: Note) {
                this.uiManager.graph.noteManager.removeNote(note)
            },
            shortcut: 'n'
        }
    ] as MenuActionItemOptions[],
}

export class ContextMenu implements UIElement {
    public uiManager: UIManager

    public menu?: HTMLDivElement
    public visible: boolean
    private parentContainer?: HTMLElement

    private element: Node | Edge | Note | null = null

    private menuNode: { topbar: MenuQuickActionItemOptions[]; menu: MenuActionItemOptions[] }
    private menuEdge: { topbar: MenuQuickActionItemOptions[]; menu: MenuActionItemOptions[] }
    private menuNote: { topbar: MenuQuickActionItemOptions[]; menu: MenuActionItemOptions[] }
    private menuCanvas: { topbar: MenuQuickActionItemOptions[]; menu: MenuActionItemOptions[] }

    constructor(uiManager: UIManager) {
        this.uiManager = uiManager
        this.visible = false

        this.menuNode = deepMerge(defaultMenuNode, this.uiManager.getOptions().contextMenu.menuNode ?? {})
        this.menuEdge = deepMerge(defaultMenuEdge, this.uiManager.getOptions().contextMenu.menuEdge ?? {})
        this.menuNote = deepMerge(defaultMenuNote, this.uiManager.getOptions().contextMenu.menuCanvas ?? {})
        this.menuCanvas = deepMerge(defaultMenuCanvas, this.uiManager.getOptions().contextMenu.menuCanvas ?? {})
        this.wrapOnclickActions()
    }

    public mount(container: HTMLElement | undefined) {
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

    public destroy() {
        this.menu?.remove()
        this.menu = undefined
    }

    public afterMount() {
    }

    public graphReady() {
        this.uiManager.graph.renderer.getGraphInteraction().on('nodeContextmenu', this.nodeClicked.bind(this))
        this.uiManager.graph.renderer.getGraphInteraction().on('edgeContextmenu', this.edgeClicked.bind(this))
        this.uiManager.graph.renderer.getGraphInteraction().on('noteContextmenu', this.noteClicked.bind(this))
        this.uiManager.graph.renderer.getGraphInteraction().on('canvasContextmenu', this.canvasClicked.bind(this))
        this.uiManager.graph.renderer.getGraphInteraction().on('canvasClick', () => { this.hide() })
        this.uiManager.graph.renderer.getGraphInteraction().on('canvasZoom', () => { this.hide() })
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

    private setPosition(event: PointerEvent): void {
        if (!this.menu) return

        const offset = 10
        const x = event.pageX
        const y = event.pageY

        this.menu.style.left = `${x + offset}px`
        this.menu.style.top = `${y + offset}px`
    }
}
