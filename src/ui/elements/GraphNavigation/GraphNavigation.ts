import { graphNavigationReset, graphNavigationZoomIn, graphNavigationZoomOut } from '../../icons'
import type { UIElement, UIManager } from '../../UIManager'
import './graphNavigation.scss'

export class GraphNavigation implements UIElement {
    private uiManager: UIManager

    public navigation?: HTMLDivElement

    constructor(uiManager: UIManager) {
        this.uiManager = uiManager
    }

    mount(container: HTMLElement | undefined) {
        if (!container) return

        const template = document.createElement('template')
        template.innerHTML = `
  <div class="pvt-graphnavigation-elements">
    <div class="pvt-graphnavigation-zoom-fit">
        <button id="pvt-graphnavigation-reset" class="pvt-graphnavigation-reset-button" title="Fit and center">
            ${graphNavigationReset}
        </button>
    </div>
    <div class="pvt-graphnavigation-zoom-controls">
        <button id="pvt-graphnavigation-zoom-in" class="pvt-graphnavigation-zoomin-button" title="Zoom In">
           ${graphNavigationZoomIn}
        </button>
        <div class="pvt-zoom-divider"></div>
        <button id="pvt-graphnavigation-zoom-out" class="pvt-graphnavigation-zoomout-button" title="Zoom Out">
            ${graphNavigationZoomOut}
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
        const zoomInButton = this.navigation.querySelector('#pvt-graphnavigation-zoom-in')
        const zoomOutButton = this.navigation.querySelector('#pvt-graphnavigation-zoom-out')
        const resetButton = this.navigation.querySelector('#pvt-graphnavigation-reset')
        
        zoomInButton?.addEventListener('click', () => {
            this.uiManager.graph.renderer.zoomIn()
        })

        zoomOutButton?.addEventListener('click', () => {
            this.uiManager.graph.renderer.zoomOut()
        })
        
        resetButton?.addEventListener('click', () => {
            this.uiManager.graph.renderer.fitAndCenter()
        })
    }

    graphReady() { }
}
