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

        // The two zoom steps are the only controls whose whole job is zooming, so a
        // canvas with `render.zoomEnabled: false` doesn't offer them. Fit-and-center
        // stays: it is how a viewer recovers a graph it has panned away from.
        // Read off the graph's options, not the renderer's: the UI is built first and
        // `graph.renderer` does not exist yet.
        const zoomable = this.uiManager.graph.getOptions().render?.zoomEnabled !== false
        const template = document.createElement('template')
        template.innerHTML = `
  <div class="pvt-graphnavigation-elements">
    <button id="pvt-graphnavigation-reset" class="pvt-graphnavigation-button" title="Fit and center">
        ${graphNavigationReset}
    </button>
    ${zoomable ? `
    <button id="pvt-graphnavigation-zoom-in" class="pvt-graphnavigation-button" title="Zoom In">
        ${graphNavigationZoomIn}
    </button>
    <button id="pvt-graphnavigation-zoom-out" class="pvt-graphnavigation-button" title="Zoom Out">
        ${graphNavigationZoomOut}
    </button>` : ''}
    <button id="pvt-graphnavigation-fullscreen" class="pvt-graphnavigation-button pvt-graphnavigation-fullscreen-button" title="Toggle Fullscreen" aria-pressed="false">
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
        button.setAttribute('aria-pressed', String(isFullscreen))
    }
}
