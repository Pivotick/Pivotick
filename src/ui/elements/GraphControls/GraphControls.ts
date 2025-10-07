import type { Node } from '../../../Node'
import type { NodeSelection } from '../../../GraphInteractions'
import type { MenuActionItemOptions, MenuQuickActionItemOptions } from '../../../GraphOptions'
import hasCycle from '../../../plugins/analytics/cycle'
import { expand, graphControlLayoutOrganic, graphControlLayoutTreeH, graphControlLayoutTreeR, graphControlLayoutTreeV, hide, pin, unpin } from '../../icons'
import type { UIElement, UIManager } from '../../UIManager'
import './graphControls.scss'
import { tryResolveBoolean } from '../../../utils/Getters'
import { createHtmlElement, createIcon } from '../../../utils/ElementCreation'
import { createButton } from '../../components/Button'
import { deepMerge } from '../../../utils/utils'


const defaultMenuNode = {
    topbar: [
        {
            title: 'Pin Nodes',
            svgIcon: pin,
            variant: 'outline-primary',
            visible: true,
            cb: (_evt: PointerEvent, nodes: Node[]) => {
                nodes.forEach((node: Node) => {
                    node.freeze()
                })
            }
        },
        {
            title: 'Unpin Node',
            svgIcon: unpin,
            variant: 'outline-primary',
            visible: true,
            cb: (_evt: PointerEvent, nodes: Node[]) => {
                nodes.forEach((node: Node) => {
                    node.unfreeze()
                    this.uiManager.graph.simulation.reheat()
                })
            }
        },
        {
            title: 'Hide Nodes',
            svgIcon: hide,
            variant: 'outline-danger',
            visible: true,
            flushRight: true,
            cb: (_evt: PointerEvent, nodes: Node[]) => {
                nodes.forEach((node: Node) => {
                    node.unfreeze()
                })
            }
        },
    ] as MenuQuickActionItemOptions[],
    menu: [
        {
            text: 'Expand Nodes',
            title: 'Expand Node',
            svgIcon: expand,
            variant: 'outline-primary',
            visible: true,
        },
    ] as MenuActionItemOptions[]
}

export class GraphControls implements UIElement {
    private uiManager: UIManager

    public navigation?: HTMLDivElement
    private selectionMenu?: HTMLDivElement

    private selectionMenuShown: boolean = false

    private menuNode: { topbar: MenuQuickActionItemOptions[]; menu: MenuActionItemOptions[] }

    constructor(uiManager: UIManager) {
        this.uiManager = uiManager

        this.menuNode = deepMerge(defaultMenuNode, this.uiManager.getOptions().selectionMenu.menuNode ?? {})
    }

    mount(container: HTMLElement | undefined) {
        if (!container) return

        const template = document.createElement('template')
        template.innerHTML = `
  <div class="pivotick-graphcontrols">
    <div class="pivotick-graphcontrols-panel pivotick-graphcontrols-layout">
        <button id="pivotick-graphcontrols-layout-organic" class="pivotick-graphcontrols-layout-organic" title="Change Graph Layout to Organic">
            ${graphControlLayoutOrganic}
        </button>
        <div class="pivotick-divider"></div>
        <button id="pivotick-graphcontrols-layout-tree-v" class="pivotick-graphcontrols-layout-tree" title="Change Graph Layout to Tree">
            ${graphControlLayoutTreeV}
        </button>
        <div class="pivotick-divider"></div>
        <button id="pivotick-graphcontrols-layout-tree-h" class="pivotick-graphcontrols-layout-tree" title="Change Graph Layout to Tree">
            ${graphControlLayoutTreeH}
        </button>
        <div class="pivotick-divider"></div>
        <button id="pivotick-graphcontrols-layout-tree-radial" class="pivotick-graphcontrols-layout-tree-radial" title="Change Graph Layout to Radial Tree">
            ${graphControlLayoutTreeR}
        </button>
    </div>
    <div class="pivotick-graphcontrols-panel pivotick-graphcontrols-selection">
        <div class="pivotick-graphcontrols-selection-title"></div>
        <div class="pivotick-graphcontrols-selection-topbar"></div>
        <div class="pivotick-graphcontrols-selection-mainmenu"></div>
    </div>
  </div>
`
        this.navigation = template.content.firstElementChild as HTMLDivElement

        container.appendChild(this.navigation)
    }

    destroy() {
        this.navigation?.remove()
        this.navigation = undefined
    }

    afterMount() {
        if (!this.navigation) return
        const organicButton = this.navigation.querySelector('#pivotick-graphcontrols-layout-organic')
        const treeVButton = this.navigation.querySelector('#pivotick-graphcontrols-layout-tree-v')
        const treeHButton = this.navigation.querySelector('#pivotick-graphcontrols-layout-tree-h')
        const radialButton = this.navigation.querySelector('#pivotick-graphcontrols-layout-tree-radial')
        this.selectionMenu = this.navigation.querySelector('.pivotick-graphcontrols-selection')!

        organicButton?.addEventListener('click', () => {
            this.uiManager.graph.simulation.changeLayout('force')
        })
        treeVButton?.addEventListener('click', () => {
            this.uiManager.graph.simulation.changeLayout('tree', { horizontal: false })
        })
        treeHButton?.addEventListener('click', () => {
            this.uiManager.graph.simulation.changeLayout('tree', { horizontal: true })
        })
        radialButton?.addEventListener('click', () => {
            this.uiManager.graph.simulation.changeLayout('tree-radial', { radial: true })
        })
    }

    graphReady() {
        if (!this.navigation) return
        const treeVButton = this.navigation.querySelector('#pivotick-graphcontrols-layout-tree-v')
        const treeHButton = this.navigation.querySelector('#pivotick-graphcontrols-layout-tree-h')
        const radialButton = this.navigation.querySelector('#pivotick-graphcontrols-layout-tree-radial')

        const nodes = this.uiManager.graph.getNodes()
        const edges = this.uiManager.graph.getEdges()
        if (hasCycle(nodes, edges)) {
            treeVButton?.setAttribute('disabled', 'disabled')
            treeVButton?.setAttribute('title', 'The graph contains a cycle, so it cannot be displayed as a tree.')
            treeHButton?.setAttribute('disabled', 'disabled')
            treeHButton?.setAttribute('title', 'The graph contains a cycle, so it cannot be displayed as a tree.')
            radialButton?.setAttribute('disabled', 'disabled')
            radialButton?.setAttribute('title', 'The graph contains a cycle, so it cannot be displayed as a tree.')
        } else {
            treeVButton?.removeAttribute('disabled')
            treeHButton?.removeAttribute('disabled')
            radialButton?.removeAttribute('disabled')
        }

        this.uiManager.graph.renderer.getGraphInteraction().on('selectNodes', (nodes: NodeSelection<unknown>[]) => {
            this.populateNodeSelectionContainer(nodes)
            this.showSelectionMenu()
        })
        this.uiManager.graph.renderer.getGraphInteraction().on('unselectNodes', () => {
            this.hideSelectionMenu()
            setTimeout(this.clearSelectionContainer, 200)
        })
    }

    public showSelectionMenu(): void {
        if (this.selectionMenuShown) return
        if (!this.selectionMenu) return

        this.selectionMenu.classList.add('shown')
        this.selectionMenuShown = true
    }

    public hideSelectionMenu(): void {
        if (!this.selectionMenuShown) return
        if (!this.selectionMenu) return

        this.selectionMenu.classList.remove('shown')
        this.selectionMenuShown = false
    }

    private populateNodeSelectionContainer(fullNodeSelection: NodeSelection<unknown>[]): void {
        if (!this.navigation || !this.selectionMenu) return

        const title = this.selectionMenu.querySelector('.pivotick-graphcontrols-selection-title')!
        const topbar = this.selectionMenu.querySelector('.pivotick-graphcontrols-selection-topbar')!
        const mainMenu = this.selectionMenu.querySelector('.pivotick-graphcontrols-selection-mainmenu')!

        const nodes = this.getNodesFromSelection(fullNodeSelection)
        title.innerHTML = ''
        topbar.innerHTML = ''
        mainMenu.innerHTML = ''

        title.textContent = `${nodes.length} nodes selected`
        topbar.appendChild(this.createQuickActionList(this.menuNode.topbar, nodes))
        mainMenu.appendChild(this.createActionList(this.menuNode.menu, nodes))
    }

    private clearSelectionContainer(): void {
        if (!this.navigation || !this.selectionMenu) return

        const title = this.selectionMenu.querySelector('.pivotick-graphcontrols-selection-title')!
        const topbar = this.selectionMenu.querySelector('.pivotick-graphcontrols-selection-topbar')!
        const mainMenu = this.selectionMenu.querySelector('.pivotick-graphcontrols-selection-mainmenu')!
        title.innerHTML = ''
        topbar.innerHTML = ''
        mainMenu.innerHTML = ''
    }

    private getNodesFromSelection(fullNodeSelection: NodeSelection<unknown>[]): Node[] {
        return fullNodeSelection.map((nodeSelection: NodeSelection<unknown>) => {
            const { node } = nodeSelection
            return node
        })
    }

    private createQuickActionList(actions: MenuQuickActionItemOptions[], nodes: Node[]): HTMLDivElement {
        const div = createHtmlElement('div', { class: 'pivotick-quickaction-list' })
        actions.forEach(action => {
            const isVisible = tryResolveBoolean(action.visible, nodes[0]) ?? true
            if (isVisible) {
                const row = this.createQuickActionItem(action, nodes)
                div.appendChild(row)
            }
        })
        return div
    }

    private createActionList(actions: MenuActionItemOptions[], nodes: Node[]): HTMLDivElement {
        const div = createHtmlElement('div', { class: 'pivotick-action-list' })
        actions.forEach(action => {
            const isVisible = tryResolveBoolean(action.visible, nodes[0]) ?? true
            if (isVisible) {
                const row = this.createActionItem(action, nodes)
                div.appendChild(row)
            }
        })
        return div
    }

    private createQuickActionItem(action: MenuQuickActionItemOptions, nodes: Node[]): HTMLSpanElement {
        const { cb, ...actionWithoutCb } = action
        const span = createHtmlElement('span',
            {
                class: ['pivotick-quickaction-item', `pivotick-quickaction-item-${action.variant}`],
                style: `${action.flushRight ? 'margin-left: auto;' : ''}`
            },
            [
                createButton({
                    size: 'sm',
                    ...actionWithoutCb,
                })
            ]
        )
        if (typeof cb === 'function') {
            span.addEventListener('click', (event: PointerEvent) => {
                cb(event, nodes)
            })
        }
        return span
    }

    private createActionItem(action: MenuActionItemOptions, nodes: Node[]): HTMLDivElement {
        const div = createHtmlElement('div',
            {
                class: ['pivotick-action-item', `pivotick-action-item-${action.variant}`]
            },
            [
                createIcon({ fixedWidth: true, ...action }),
                createHtmlElement('span', { 
                    class: 'pivotick-action-text',
                    title: action.title,
                }, [ action.text ?? '' ])
            ]
        )
        if (typeof action.cb === 'function') {
            div.addEventListener('click', (event: PointerEvent) => {
                if (action.cb) action.cb(event, nodes)
            })
        }
        return div
    }
}
