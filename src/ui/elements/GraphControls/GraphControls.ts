import type { Node } from '../../../Node'
import hasCycle from '../../../plugins/analytics/cycle'
import { balancedDistanced, expand, firstValidNode, flipEdgeDirection, graphControlLayoutOrganic, graphControlLayoutTreeH, graphControlLayoutTreeR, graphControlLayoutTreeV, hide, minHeight, mostConnectedNode, pin, timeDuration10, timeDuration15, timeDuration5, unpin } from '../../icons'
import type { UIElement, UIManager } from '../../UIManager'
import './graphControls.scss'
import { createActionList, createHtmlElement, createIcon, createQuickActionList } from '../../../utils/ElementCreation'
import { deepMerge } from '../../../utils/utils'
import type { MenuActionItemOptions, MenuQuickActionItemOptions } from '../../../interfaces/GraphUI'
import type { NodeSelection } from '../../../interfaces/GraphInteractions'

type GraphLayoutOption = {
    id: string
    class: string | string[]
    title: string
    svgIcon: string
    onClick?: (e: MouseEvent) => void
}

const defaultMenuNode = {
    topbar: [
        {
            title: 'Pin Nodes',
            svgIcon: pin,
            variant: 'outline-primary',
            visible: true,
            onclick(this: GraphControls, _evt: PointerEvent, nodes: Node[]) {
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
            onclick(this: GraphControls, _evt: PointerEvent, nodes: Node[]) {
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
            visible: false,
            flushRight: true,
            onclick(this: GraphControls, _evt: PointerEvent, nodes: Node[]) {
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
            visible: false,
        },
        {
            text: 'Pin Nodes',
            title: 'Pin Nodes',
            svgIcon: pin,
            variant: 'outline-primary',
            visible: true,
            onclick(this: GraphControls, _evt: PointerEvent, nodes: Node[]) {
                nodes.forEach((node: Node) => {
                    node.freeze()
                })
            }
        },
    ] as MenuActionItemOptions[]
}

export class GraphControls implements UIElement {
    public uiManager: UIManager

    public navigation?: HTMLDivElement
    private selectionMenu?: HTMLDivElement
    private layoutMenu?: HTMLDivElement

    private selectionMenuShown: boolean = false

    private menuNode: { topbar: MenuQuickActionItemOptions[]; menu: MenuActionItemOptions[] }

    private layoutTypeOptions = [
        {
            root: {
                id: 'pvt-graphcontrols-layout-organic',
                class: '',
                title: 'Change Graph Layout to Organic',
                svgIcon: graphControlLayoutOrganic,
                onClick: () => {
                    this.uiManager.graph.simulation.changeLayout('force')
                },
            } as GraphLayoutOption,
            children: [
                {
                    id: 'pvt-graphcontrols-layout-organic-5',
                    class: '',
                    title: 'Run Organic Layout for 5 seconds. Or until it stabilises',
                    svgIcon: timeDuration5,
                    onClick: () => {
                        this.uiManager.graph.simulation.changeLayout('force', { cooldownTime: 5000 })
                    },
                },
                {
                    id: 'pvt-graphcontrols-layout-organic-10',
                    class: '',
                    title: 'Run Organic Layout for 10 seconds. Or until it stabilises',
                    svgIcon: timeDuration10,
                    onClick: () => {
                        this.uiManager.graph.simulation.changeLayout('force', { cooldownTime: 10000 })
                    },
                },
                {
                    id: 'pvt-graphcontrols-layout-organic-15',
                    class: '',
                    title: 'Run Organic Layout for 15 seconds. Or until it stabilises',
                    svgIcon: timeDuration15,
                    onClick: () => {
                        this.uiManager.graph.simulation.changeLayout('force', { cooldownTime: 15000 })
                    },
                },
            ] as GraphLayoutOption[]
        },
        {
            root: {
                id: 'pvt-graphcontrols-layout-tree-v',
                class: 'pvt-graphcontrols-layout-tree-v-options',
                title: 'Change Graph Layout to Vertical Tree',
                svgIcon: graphControlLayoutTreeV,
                onClick: () => {
                    this.uiManager.graph.simulation.changeLayout('tree', { layout: { horizontal: false } })
                },
            } as GraphLayoutOption,
            children: [
                {
                    id: 'pvt-graphcontrols-layout-tree-v-FirstZeroInDegree',
                    class: 'pvt-graphcontrols-layout-tree-v-options',
                    title: 'Pick the first valid 0 in-degree node',
                    svgIcon: firstValidNode,
                    onClick: () => {
                        this.uiManager.graph.simulation.changeLayout('tree', { layout: { horizontal: false, rootIdAlgorithmFinder: 'FirstZeroInDegree' } })
                    },
                },
                {
                    id: 'pvt-graphcontrols-layout-tree-v-MaxReachability',
                    class: 'pvt-graphcontrols-layout-tree-v-options',
                    title: 'Pick the most connected node based on the reachability to others',
                    svgIcon: mostConnectedNode,
                    onClick: () => {
                        this.uiManager.graph.simulation.changeLayout('tree', { layout: { horizontal: false, rootIdAlgorithmFinder: 'MaxReachability' } })
                    },
                },
                {
                    id: 'pvt-graphcontrols-layout-tree-v-MinMaxDistance',
                    class: 'pvt-graphcontrols-layout-tree-v-options',
                    title: 'Minimize max distance by trying to balance subtree',
                    svgIcon: balancedDistanced,
                    onClick: () => {
                        this.uiManager.graph.simulation.changeLayout('tree', { layout: { horizontal: false, rootIdAlgorithmFinder: 'MinMaxDistance' } })
                    },
                },
                {
                    id: 'pvt-graphcontrols-layout-tree-v-MinHeight',
                    class: 'pvt-graphcontrols-layout-tree-v-options',
                    title: 'Pick node minimizing tree height',
                    svgIcon: minHeight,
                    onClick: () => {
                        this.uiManager.graph.simulation.changeLayout('tree', { layout: { horizontal: false, rootIdAlgorithmFinder: 'MinHeight' } })
                    },
                },
                {
                    id: 'pvt-graphcontrols-layout-tree-v-FlipEdgeDirection',
                    class: 'pvt-graphcontrols-layout-tree-v-options',
                    title: 'Flip the direction of all edges, then pick the most connected node based on the reachability to others',
                    svgIcon: flipEdgeDirection,
                    onClick: () => {
                        this.uiManager.graph.simulation.changeLayout('tree', { layout: { horizontal: false, rootIdAlgorithmFinder: 'MaxReachability', flipEdgeDirection: true } })
                    },
                },
            ] as GraphLayoutOption[]
        },
        {
            root: {
                id: 'pvt-graphcontrols-layout-tree-h',
                class: 'pvt-graphcontrols-layout-tree-h-options',
                title: 'Change Graph Layout to Horizontal Tree',
                svgIcon: graphControlLayoutTreeH,
                onClick: () => {
                    this.uiManager.graph.simulation.changeLayout('tree', { layout: { horizontal: true } })
                },
            } as GraphLayoutOption,
            children: [
                {
                    id: 'pvt-graphcontrols-layout-tree-h-FirstZeroInDegree',
                    class: 'pvt-graphcontrols-layout-tree-h-options',
                    title: 'Pick the first valid 0 in-degree node',
                    svgIcon: firstValidNode,
                    onClick: () => {
                        this.uiManager.graph.simulation.changeLayout('tree', { layout: { horizontal: true, rootIdAlgorithmFinder: 'FirstZeroInDegree' } })
                    },
                },
                {
                    id: 'pvt-graphcontrols-layout-tree-h-MaxReachability',
                    class: 'pvt-graphcontrols-layout-tree-h-options',
                    title: 'Pick the most connected node based on the reachability to others',
                    svgIcon: mostConnectedNode,
                    onClick: () => {
                        this.uiManager.graph.simulation.changeLayout('tree', { layout: { horizontal: true, rootIdAlgorithmFinder: 'MaxReachability' } })
                    },
                },
                {
                    id: 'pvt-graphcontrols-layout-tree-h-MinMaxDistance',
                    class: 'pvt-graphcontrols-layout-tree-h-options',
                    title: 'Minimize max distance by trying to balance subtree',
                    svgIcon: balancedDistanced,
                    onClick: () => {
                        this.uiManager.graph.simulation.changeLayout('tree', { layout: { horizontal: true, rootIdAlgorithmFinder: 'MinMaxDistance' } })
                    },
                },
                {
                    id: 'pvt-graphcontrols-layout-tree-h-MinHeight',
                    class: 'pvt-graphcontrols-layout-tree-h-options',
                    title: 'Pick node minimizing tree height',
                    svgIcon: minHeight,
                    onClick: () => {
                        this.uiManager.graph.simulation.changeLayout('tree', { layout: { horizontal: true, rootIdAlgorithmFinder: 'MinHeight' } })
                    },
                },
                {
                    id: 'pvt-graphcontrols-layout-tree-h-FlipEdgeDirection',
                    class: 'pvt-graphcontrols-layout-tree-h-options',
                    title: 'Flip the direction of all edges, then pick the most connected node based on the reachability to others',
                    svgIcon: flipEdgeDirection,
                    onClick: () => {
                        this.uiManager.graph.simulation.changeLayout('tree', { layout: { horizontal: true, rootIdAlgorithmFinder: 'MaxReachability', flipEdgeDirection: true } })
                    },
                },
            ] as GraphLayoutOption[]
        },
        {
            root: {
                id: 'pvt-graphcontrols-layout-tree-r',
                class: 'pvt-graphcontrols-layout-tree-r-options',
                title: 'Change Graph Layout to Radial Tree',
                svgIcon: graphControlLayoutTreeR,
                onClick: () => {
                    this.uiManager.graph.simulation.changeLayout('tree', { layout: { radial: true } })
                },
            } as GraphLayoutOption,
            children: [
                {
                    id: 'pvt-graphcontrols-layout-tree-r-FirstZeroInDegree',
                    class: 'pvt-graphcontrols-layout-tree-r-options',
                    title: 'Pick the first valid 0 in-degree node',
                    svgIcon: firstValidNode,
                    onClick: () => {
                        this.uiManager.graph.simulation.changeLayout('tree', { layout: { radial: true, rootIdAlgorithmFinder: 'FirstZeroInDegree' } })
                    },
                },
                {
                    id: 'pvt-graphcontrols-layout-tree-r-MaxReachability',
                    class: 'pvt-graphcontrols-layout-tree-r-options',
                    title: 'Pick the most connected node based on the reachability to others',
                    svgIcon: mostConnectedNode,
                    onClick: () => {
                        this.uiManager.graph.simulation.changeLayout('tree', { layout: { radial: true, rootIdAlgorithmFinder: 'MaxReachability' } })
                    },
                },
                {
                    id: 'pvt-graphcontrols-layout-tree-r-MinMaxDistance',
                    class: 'pvt-graphcontrols-layout-tree-r-options',
                    title: 'Minimize max distance by trying to balance subtree',
                    svgIcon: balancedDistanced,
                    onClick: () => {
                        this.uiManager.graph.simulation.changeLayout('tree', { layout: { radial: true, rootIdAlgorithmFinder: 'MinMaxDistance' } })
                    },
                },
                {
                    id: 'pvt-graphcontrols-layout-tree-r-MinHeight',
                    class: 'pvt-graphcontrols-layout-tree-r-options',
                    title: 'Pick node minimizing tree height',
                    svgIcon: minHeight,
                    onClick: () => {
                        this.uiManager.graph.simulation.changeLayout('tree', { layout: { radial: true, rootIdAlgorithmFinder: 'MinHeight' } })
                    },
                },
                {
                    id: 'pvt-graphcontrols-layout-tree-r-FlipEdgeDirection',
                    class: 'pvt-graphcontrols-layout-tree-r-options',
                    title: 'Flip the direction of all edges, then pick the most connected node based on the reachability to others',
                    svgIcon: flipEdgeDirection,
                    onClick: () => {
                        this.uiManager.graph.simulation.changeLayout('tree', { layout: { radial: true, rootIdAlgorithmFinder: 'MaxReachability', flipEdgeDirection: true } })
                    },
                },
            ] as GraphLayoutOption[]
        },
    ]


    constructor(uiManager: UIManager) {
        this.uiManager = uiManager

        this.menuNode = deepMerge(defaultMenuNode, this.uiManager.getOptions().selectionMenu.menuNode ?? {})
    }

    mount(container: HTMLElement | undefined) {
        if (!container) return

        const template = document.createElement('template')
        template.innerHTML = `
  <div class="pvt-graphcontrols-elements">
    <div class="pvt-graphcontrols-panel pvt-graphcontrols-layout"></div>
    <div class="pvt-graphcontrols-panel pvt-graphcontrols-selection">
        <div class="pvt-graphcontrols-selection-title"></div>
        <div class="pvt-graphcontrols-selection-topbar"></div>
        <div class="pvt-graphcontrols-selection-mainmenu"></div>
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
        this.selectionMenu = this.navigation.querySelector('.pvt-graphcontrols-selection')!
        this.layoutMenu = this.navigation.querySelector('.pvt-graphcontrols-layout')!

        this.createLayoutOptionAndBind(this.layoutTypeOptions)
    }

    graphReady() {
        if (!this.navigation) return

        const nodes = this.uiManager.graph.getNodes()
        const edges = this.uiManager.graph.getEdges()
        if (hasCycle(nodes, edges)) {
            this.navigation.querySelectorAll('.pvt-graphcontrols-layout-tree-v-options').forEach((el) => {
                el.setAttribute('disabled', 'disabled')
                el.setAttribute('data-old-title', el.getAttribute('title') ?? '')
                el.setAttribute('title', 'The graph contains a cycle, so it cannot be displayed as a tree.')
            })
            this.navigation.querySelectorAll('.pvt-graphcontrols-layout-tree-h-options').forEach((el) => {
                el.setAttribute('disabled', 'disabled')
                el.setAttribute('data-old-title', el.getAttribute('title') ?? '')
                el.setAttribute('title', 'The graph contains a cycle, so it cannot be displayed as a tree.')
            })
            this.navigation.querySelectorAll('.pvt-graphcontrols-layout-tree-r-options').forEach((el) => {
                el.setAttribute('disabled', 'disabled')
                el.setAttribute('data-old-title', el.getAttribute('title') ?? '')
                el.setAttribute('title', 'The graph contains a cycle, so it cannot be displayed as a tree.')
            })
        } else {
            this.navigation.querySelectorAll('.pvt-graphcontrols-layout-tree-v-options').forEach((el) => {
                el.removeAttribute('disabled')
                el.setAttribute('title', el.getAttribute('data-old-title') ?? '')
            })
            this.navigation.querySelectorAll('.pvt-graphcontrols-layout-tree-h-options').forEach((el) => {
                el.removeAttribute('disabled')
                el.setAttribute('title', el.getAttribute('data-old-title') ?? '')
            })
            this.navigation.querySelectorAll('.pvt-graphcontrols-layout-tree-r-options').forEach((el) => {
                el.removeAttribute('disabled')
                el.setAttribute('title', el.getAttribute('data-old-title') ?? '')
            })
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

        const title = this.selectionMenu.querySelector('.pvt-graphcontrols-selection-title')!
        const topbar = this.selectionMenu.querySelector('.pvt-graphcontrols-selection-topbar')!
        const mainMenu = this.selectionMenu.querySelector('.pvt-graphcontrols-selection-mainmenu')!

        const nodes = this.getNodesFromSelection(fullNodeSelection)
        title.innerHTML = ''
        topbar.innerHTML = ''
        mainMenu.innerHTML = ''

        title.textContent = `${nodes.length} nodes selected`
        topbar.appendChild(createQuickActionList<GraphControls>(this, this.menuNode.topbar, nodes))
        mainMenu.appendChild(createActionList<GraphControls>(this, this.menuNode.menu, nodes))
    }

    private clearSelectionContainer(): void {
        if (!this.navigation || !this.selectionMenu) return

        const title = this.selectionMenu.querySelector('.pvt-graphcontrols-selection-title')!
        const topbar = this.selectionMenu.querySelector('.pvt-graphcontrols-selection-topbar')!
        const mainMenu = this.selectionMenu.querySelector('.pvt-graphcontrols-selection-mainmenu')!
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

    private createLayoutOptionAndBind(allLayouts: { root: GraphLayoutOption, children: GraphLayoutOption[] }[]) {

        allLayouts.forEach((layoutOptions, index) => {
            if (!this.layoutMenu) return

            if (index > 0) {
                this.layoutMenu.appendChild(createHtmlElement('div', {
                    class: 'pivotick-divider',
                }, []))
            }
            const rootOption = layoutOptions.root
            const subOptions = layoutOptions.children

            const layoutTypeRoot = createHtmlElement('div', {}, [
                this.createLayoutOption(rootOption)
            ])
            const layoutTypeMenu = this.createLayoutOptionMenu(subOptions)
            const fullLayoutMenu = createHtmlElement('div', {
                class: 'pvt-graphcontrols-layout-type-container',
            }, [
                layoutTypeRoot,
                layoutTypeMenu,
            ])
            this.layoutMenu.appendChild(fullLayoutMenu)

            // Bind events
            const optionBtn = fullLayoutMenu.querySelector(`#${rootOption.id}`)
            if (optionBtn && typeof rootOption.onClick === 'function') {
                optionBtn.addEventListener('click', rootOption.onClick as EventListener)
            }
            subOptions.forEach(subOption => {
                const optionBtn = layoutTypeMenu.querySelector(`#${subOption.id}`)
                if (optionBtn && typeof subOption.onClick === 'function') {
                    optionBtn.addEventListener('click', subOption.onClick as EventListener)
                }
            })
        })
    }

    private createLayoutOptionMenu(options: GraphLayoutOption[]): HTMLDivElement {
        const buttonContainer = createHtmlElement('div', {
            class: ['pvt-graphcontrols-layout-type-options']
        })

        options.forEach((option: GraphLayoutOption) => {
            const button = this.createLayoutOption(option)
            buttonContainer.appendChild(button)
        })

        return buttonContainer
    }

    private createLayoutOption(option: GraphLayoutOption): HTMLButtonElement
    {
        return createHtmlElement('button', {
            id: option.id,
            class: option.class,
            title: option.title,
        }, [createIcon({ svgIcon: option.svgIcon }) ])
    }
}
