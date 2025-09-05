import type { Graph } from '../../../Graph'
import hasCycle from '../../../plugins/analytics/cycle'
import type { UIElement, UIManager } from '../../UIManager'
import './graphControls.scss'

export class GraphControls implements UIElement {
    private uiManager: UIManager

    public navigation?: HTMLDivElement

    constructor(uiManager: UIManager) {
        this.uiManager = uiManager
    }

    mount(container: HTMLElement | undefined) {
        if (!container) return

        const template = document.createElement('template')
        template.innerHTML = `
  <div class="pivotick-graphcontrols">
    <div class="pivotick-graphcontrols-panel">
        <button id="pivotick-graphcontrols-layout-organic" class="pivotick-graphcontrols-layout-organic" title="Change Graph Layout to Organic">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19a2 2 0 1 0-4 0a2 2 0 0 0 4 0m8-14a2 2 0 1 0-4 0a2 2 0 0 0 4 0m-8 0a2 2 0 1 0-4 0a2 2 0 0 0 4 0m-4 7a2 2 0 1 0-4 0a2 2 0 0 0 4 0m12 7a2 2 0 1 0-4 0a2 2 0 0 0 4 0m-4-7a2 2 0 1 0-4 0a2 2 0 0 0 4 0m8 0a2 2 0 1 0-4 0a2 2 0 0 0 4 0M6 12h4m4 0h4m-3-5l-2 3M9 7l2 3m0 4l-2 3m4-3l2 3M10 5h4m-4 14h4m3-2l2-3m0-4l-2-3M7 7l-2 3m0 4l2 3" />
            </svg>
        </button>
        <div class="pivotick-divider"></div>
        <button id="pivotick-graphcontrols-layout-tree-v" class="pivotick-graphcontrols-layout-tree" title="Change Graph Layout to Tree">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 20a2 2 0 1 0-4 0a2 2 0 0 0 4 0M16 4a2 2 0 1 0-4 0a2 2 0 0 0 4 0m0 16a2 2 0 1 0-4 0a2 2 0 0 0 4 0m-5-8a2 2 0 1 0-4 0a2 2 0 0 0 4 0m10 0a2 2 0 1 0-4 0a2 2 0 0 0 4 0M5.058 18.306l2.88-4.606m2.123-3.397l2.877-4.604m-2.873 8.006l2.876 4.6M15.063 5.7l2.881 4.61" />
            </svg>
        </button>
        <div class="pivotick-divider"></div>
        <button id="pivotick-graphcontrols-layout-tree-h" class="pivotick-graphcontrols-layout-tree" title="Change Graph Layout to Tree">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="transform: rotate(-90deg);">
                <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 20a2 2 0 1 0-4 0a2 2 0 0 0 4 0M16 4a2 2 0 1 0-4 0a2 2 0 0 0 4 0m0 16a2 2 0 1 0-4 0a2 2 0 0 0 4 0m-5-8a2 2 0 1 0-4 0a2 2 0 0 0 4 0m10 0a2 2 0 1 0-4 0a2 2 0 0 0 4 0M5.058 18.306l2.88-4.606m2.123-3.397l2.877-4.604m-2.873 8.006l2.876 4.6M15.063 5.7l2.881 4.61" />
            </svg>
        </button>
        <div class="pivotick-divider"></div>
        <button id="pivotick-graphcontrols-layout-tree-radial" class="pivotick-graphcontrols-layout-tree-radial" title="Change Graph Layout to Radial Tree">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19a2 2 0 1 0-4 0a2 2 0 0 0 4 0m8-14a2 2 0 1 0-4 0a2 2 0 0 0 4 0m-8 0a2 2 0 1 0-4 0a2 2 0 0 0 4 0m-4 7a2 2 0 1 0-4 0a2 2 0 0 0 4 0m12 7a2 2 0 1 0-4 0a2 2 0 0 0 4 0m-4-7a2 2 0 1 0-4 0a2 2 0 0 0 4 0m8 0a2 2 0 1 0-4 0a2 2 0 0 0 4 0M6 12h4m4 0h4m-3-5l-2 3M9 7l2 3m0 4l-2 3m4-3l2 3" />
            </svg>
        </button>
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
    }
}