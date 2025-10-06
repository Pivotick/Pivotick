import type { Graph } from '../../../Graph'
import type { NodeSelection } from '../../../GraphInteractions'
import hasCycle from '../../../plugins/analytics/cycle'
import { graphControlLayoutOrganic, graphControlLayoutTreeH, graphControlLayoutTreeR, graphControlLayoutTreeV } from '../../icons'
import type { UIElement, UIManager } from '../../UIManager'
import './graphControls.scss'

export class GraphControls implements UIElement {
    private uiManager: UIManager

    public navigation?: HTMLDivElement

    private menuNode = {

    }

    constructor(uiManager: UIManager) {
        this.uiManager = uiManager
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
            this.populateSelectionContainer(nodes)
        })
        this.uiManager.graph.renderer.getGraphInteraction().on('unselectNodes', () => {
            this.clearSelectionContainer()
        })
    }

    private populateSelectionContainer(nodes: NodeSelection<unknown>[]): void {
        return
    }

    private clearSelectionContainer(): void {
        return
    }
}