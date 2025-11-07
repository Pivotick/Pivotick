import type { Edge } from '../../../Edge'
import type { Node } from '../../../Node'
import { createActionList, createQuickActionList } from '../../../utils/ElementCreation'
import { expand, focusElement, hide, inspect, pin, selectNeighbor, unpin } from '../../icons'
import type { UIElement, UIManager } from '../../UIManager'
import './contextmenu.scss'
import { deepMerge } from '../../../utils/utils'
import type { MenuActionItemOptions, MenuQuickActionItemOptions } from '../../../interfaces/GraphUI'

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
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            visible: (_node: Node) => {
                return false // FIXME: Implement feature
            },
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
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            visible: (_node: Node) => {
                return false // FIXME: Implement feature
            },
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            onclick(this: ContextMenu, _evt: PointerEvent, _node: Node) {
            },
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
                this.uiManager.graph.renderer.getGraphInteraction().selectNode(node.getGraphElement(), node)
            },
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
    ] as MenuActionItemOptions[],
}

export class ContextMenu implements UIElement {
    public uiManager: UIManager

    public menu?: HTMLDivElement
    public visible: boolean
    private parentContainer?: HTMLElement

    private element: Node | Edge | null = null

    private menuNode: { topbar: MenuQuickActionItemOptions[]; menu: MenuActionItemOptions[] }
    private menuEdge: { topbar: MenuQuickActionItemOptions[]; menu: MenuActionItemOptions[] }
    private menuCanvas: { topbar: MenuQuickActionItemOptions[]; menu: MenuActionItemOptions[] }

    constructor(uiManager: UIManager) {
        this.uiManager = uiManager
        this.visible = false

        this.menuNode = deepMerge(defaultMenuNode, this.uiManager.getOptions().contextMenu.menuNode ?? {})
        this.menuEdge = deepMerge(defaultMenuEdge, this.uiManager.getOptions().contextMenu.menuEdge ?? {})
        this.menuCanvas = deepMerge(defaultMenuCanvas, this.uiManager.getOptions().contextMenu.menuCanvas ?? {})
    }

    public mount(container: HTMLElement | undefined) {
        if (!container) return

        this.parentContainer = document.querySelector('body')!
        const template = document.createElement('template')
        template.innerHTML = `
        <div class="pivotick-contextmenu">
            <div class="pivotick-contextmenu-topbar"></div>
            <div class="pivotick-contextmenu-mainmenu"></div>
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

    private canvasClicked(event: PointerEvent): void {
        if (!this.menu) return

        this.element = null
        this.createCanvasMenu()
        this.setPosition(event)
        this.show()
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private createNodeMenu(_node: Node): void {
        if (!this.menu) return

        const topbar = this.menu.querySelector('.pivotick-contextmenu-topbar')!
        const mainMenu = this.menu.querySelector('.pivotick-contextmenu-mainmenu')!
        topbar.innerHTML = ''
        mainMenu.innerHTML = ''
        topbar.appendChild(createQuickActionList<ContextMenu>(this, this.menuNode.topbar, this.element))
        mainMenu.appendChild(createActionList<ContextMenu>(this, this.menuNode.menu, this.element))
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private createEdgeMenu(_edge: Edge): void {
        if (!this.menu) return

        const topbar = this.menu.querySelector('.pivotick-contextmenu-topbar')!
        const mainMenu = this.menu.querySelector('.pivotick-contextmenu-mainmenu')!
        topbar.innerHTML = ''
        mainMenu.innerHTML = ''
        topbar.appendChild(createQuickActionList<ContextMenu>(this, this.menuEdge.topbar, this.element))
        mainMenu.appendChild(createActionList<ContextMenu>(this, this.menuEdge.menu, this.element))
    }

    private createCanvasMenu(): void {
        if (!this.menu) return

        const topbar = this.menu.querySelector('.pivotick-contextmenu-topbar')!
        const mainMenu = this.menu.querySelector('.pivotick-contextmenu-mainmenu')!
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
