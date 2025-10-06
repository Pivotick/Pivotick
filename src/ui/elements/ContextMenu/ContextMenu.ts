import type { Edge } from '../../../Edge'
import type { Node } from '../../../Node'
import { createHtmlElement, createIcon, type UIVariant } from '../../../utils/ElementCreation'
import { tryResolveValue } from '../../../utils/Getters'
import { createButton } from '../../components/Button'
import { expand, focusElement, hide, inspect, pin, selectElement, unpin } from '../../icons'
import type { UIElement, UIManager } from '../../UIManager'
import './contextmenu.scss'


type ActionItemOptions = {
    iconUnicode?: string,
    iconClass?: string,
    svgIcon?: string,
    imagePath?: string,
    text: string,
    title: string,
    variant: UIVariant,
    visible: boolean | ((element: Node | Edge | null) => boolean)
    cb: (evt: PointerEvent, element: Node | Edge | null) => void
}
type QuickActionItemOptions = ActionItemOptions & {
    flushRight?: boolean;
}
export class ContextMenu implements UIElement {
    private uiManager: UIManager

    public menu?: HTMLDivElement
    public visible: boolean
    private parentContainer?: HTMLElement

    private elementID: string | null = null
    private element: Node | Edge | null = null

    private dataMap = new WeakMap<HTMLElement, Node | Edge>()

    private menuNode = {
        topbar: [
            {
                title: 'Pin Node',
                svgIcon: pin,
                variant: 'outline-primary',
                visible: (node: Node) => {
                    return !node.frozen
                },
                cb: (evt: PointerEvent, node: Node) => {
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
                cb: (evt: PointerEvent, node: Node) => {
                    node.unfreeze()
                }
            },
            {
                title: 'Focus Node',
                svgIcon: focusElement,
                variant: 'outline-primary',
            },
            {
                title: 'Hide Node',
                svgIcon: hide,
                variant: 'outline-danger',
                flushRight: true,
            },
        ] as QuickActionItemOptions[],
        menu: [
            {
                text: 'Select Neighbors',
                title: 'Select Neighbors',
                svgIcon: selectElement,
                variant: 'outline-primary',
            },
            {
                text: 'Hide Children',
                title: 'Hide Children',
                svgIcon: hide,
                variant: 'outline-primary',
            },
            {
                text: 'Expand Node',
                title: 'Expand Node',
                svgIcon: expand,
                variant: 'outline-primary',
            },
            {
                text: 'Inspect Properties',
                title: 'Inspect Properties',
                svgIcon: inspect,
                variant: 'outline-primary',
            },
        ] as ActionItemOptions[],
    }

    private menuEdge = {
        
    }

    private menuCanvas = {

    }


    constructor(uiManager: UIManager) {
        this.uiManager = uiManager
        this.visible = false
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

        this.elementID = node.id
        this.element = node
        this.createNodeMenu(node)
        this.setPosition(event)
        this.show()
    }

    private edgeClicked(event: PointerEvent, edge: Edge): void {
        if (!this.menu) return

        this.elementID = edge.id
        this.element = edge
        this.createEdgeMenu(edge)
        this.setPosition(event)
        this.show()
    }

    private canvasClicked(event: PointerEvent): void {
        if (!this.menu) return

        this.elementID = null
        this.element = null
        this.createCanvasMenu()
        this.setPosition(event)
        this.show()
    }

    private createNodeMenu(node: Node): void {
        if (!this.menu) return

        const topbar = this.menu.querySelector('.pivotick-contextmenu-topbar')!
        const mainMenu = this.menu.querySelector('.pivotick-contextmenu-mainmenu')!
        topbar.innerHTML = ''
        mainMenu.innerHTML = ''
        topbar.appendChild(this.createQuickActionList(this.menuNode.topbar))
        mainMenu.appendChild(this.createActionList(this.menuNode.menu))
    }

    private createEdgeMenu(edge: Edge): void {
        if (!this.menu) return

        const topbar = this.menu.querySelector('.pivotick-contextmenu-topbar')!
        const mainMenu = this.menu.querySelector('.pivotick-contextmenu-mainmenu')!
        topbar.innerHTML = ''
        mainMenu.innerHTML = ''
    }

    private createCanvasMenu(): void {
        if (!this.menu) return

        const topbar = this.menu.querySelector('.pivotick-contextmenu-topbar')!
        const mainMenu = this.menu.querySelector('.pivotick-contextmenu-mainmenu')!
        topbar.innerHTML = ''
        mainMenu.innerHTML = ''
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

        this.elementID = null
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

    private createQuickActionList(actions: QuickActionItemOptions[]): HTMLDivElement {
        const div = createHtmlElement('div', { class: 'pivotick-quickaction-list' })
        actions.forEach(action => {
            const isVisible = tryResolveValue(action.visible, this.element) ?? true
            if (isVisible) {
                const row = this.createQuickActionItem(action)
                div.appendChild(row)
            }
        })
        return div
    }

    private createActionList(actions: ActionItemOptions[]): HTMLDivElement {
        const div = createHtmlElement('div', { class: 'pivotick-action-list' })
        actions.forEach(action => {
            const isVisible = tryResolveValue(action.visible, this.element) ?? true
            if (isVisible) {
                const row = this.createActionItem(action)
                div.appendChild(row)
            }
        })
        return div
    }

    private createQuickActionItem(action: QuickActionItemOptions): HTMLSpanElement {
        const span = createHtmlElement('span',
            {
                class: ['pivotick-quickaction-item', `pivotick-quickaction-item-${action.variant}`],
                style: `${action.flushRight ? 'margin-left: auto;' : ''}`
            },
            [
                createButton({
                    size: 'sm',
                    ...action,
                })
            ]
        )
        if (typeof action.cb === 'function') {
            span.addEventListener('click', (event: PointerEvent) => {
                action.cb(event, this.element)
                this.hide()
            })
        }
        return span
    }

    private createActionItem(action: ActionItemOptions): HTMLDivElement {
        const div = createHtmlElement('div',
            {
                class: ['pivotick-action-item', `pivotick-action-item-${action.variant}`]
            },
            [
                createIcon(action),
                createHtmlElement('span', { 
                    class: 'pivotick-action-text',
                    title: action.title,
                }, [ action.text ?? '' ])
            ]
        )
        if (typeof action.cb === 'function') {
            div.addEventListener('click', (event: PointerEvent) => {
                action.cb(event, this.element)
                this.hide()
            })
        }
        return div
    }
}
