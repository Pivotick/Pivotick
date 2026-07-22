import { fullscreen, fullscreenExit, graphNavigationReset, graphNavigationZoomIn, graphNavigationZoomOut } from '../../icons'
import type { UIManager } from '../../UIManager'
import { UIComponent } from '../../UIComponent'
import './graphNavigation.scss'

export class GraphNavigation extends UIComponent {

    public navigation?: HTMLDivElement

    constructor(uiManager: UIManager) {
        super(uiManager)
    }

    private handleFullscreenChange = () => {
        const fullscreenButton =
            this.navigation?.querySelector(
                '#pvt-graphnavigation-fullscreen'
            ) as HTMLButtonElement | null

        if (fullscreenButton) {
            this.updateFullscreenIcon(fullscreenButton)
        }
    }

    protected onMount(container: HTMLElement | undefined) {
        if (!container) return

        const template = document.createElement('template')
        template.innerHTML = `
  <div class="pvt-graphnavigation-elements">
    <button id="pvt-graphnavigation-reset" class="pvt-graphnavigation-button" title="Fit and center">
        ${graphNavigationReset}
    </button>
    <button id="pvt-graphnavigation-zoom-in" class="pvt-graphnavigation-button" title="Zoom In">
        ${graphNavigationZoomIn}
    </button>
    <button id="pvt-graphnavigation-zoom-out" class="pvt-graphnavigation-button" title="Zoom Out">
        ${graphNavigationZoomOut}
    </button>
    <button id="pvt-graphnavigation-fullscreen" class="pvt-graphnavigation-button pvt-graphnavigation-fullscreen-button" title="Toggle Fullscreen">
        <span>${fullscreen}</span>
        <span style="display: none">${fullscreenExit}</span>
    </button>
  </div>
`
        this.navigation = template.content.firstElementChild as HTMLDivElement

        container.appendChild(this.navigation)
    }

    protected onDestroy() {
        this.navigation?.remove()
        this.navigation = undefined

        document.removeEventListener(
            'fullscreenchange',
            this.handleFullscreenChange
        )
    }

    protected onAfterMount() {
        if (!this.navigation) return
        const zoomInButton = this.navigation.querySelector('#pvt-graphnavigation-zoom-in')
        const zoomOutButton = this.navigation.querySelector('#pvt-graphnavigation-zoom-out')
        const resetButton = this.navigation.querySelector('#pvt-graphnavigation-reset')
        const fullscreenButton: HTMLButtonElement | null = this.navigation.querySelector('#pvt-graphnavigation-fullscreen')

        zoomInButton?.addEventListener('click', () => {
            this.uiManager.graph.renderer.zoomIn()
        })

        zoomOutButton?.addEventListener('click', () => {
            this.uiManager.graph.renderer.zoomOut()
        })
        
        resetButton?.addEventListener('click', () => {
            this.uiManager.graph.renderer.fitAndCenter()
        })

        fullscreenButton?.addEventListener('click', () => {
            this.uiManager.toggleFullscreen()
        })

        if (fullscreenButton) {
            this.updateFullscreenIcon(fullscreenButton)
        }

        document.addEventListener('fullscreenchange', this.handleFullscreenChange)

        if (fullscreenButton) {
            this.updateFullscreenIcon(fullscreenButton)
        }
    }

    updateFullscreenIcon(button: HTMLElement) {
        const spans = button.querySelectorAll('span')

        const enterIcon = spans[0] as HTMLElement
        const exitIcon = spans[1] as HTMLElement

        const isFullscreen = this.uiManager.isFullscreenOn()

        enterIcon.style.display = isFullscreen ? 'none' : ''
        exitIcon.style.display = isFullscreen ? '' : 'none'
    }
}
