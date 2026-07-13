import { PivotickDropdown } from '../../components/Dropdown'
import { fullscreen, fullscreenExit, graphNavigationReset, graphNavigationZoomIn, graphNavigationZoomOut, grid, pin, sliderTune, snapGrid } from '../../icons'
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
    <div class="pvt-graphnavigation-fullscreen">
        <button id="pvt-graphnavigation-fullscreen" class="pvt-graphnavigation-fullscreen-button" title="Toggle Fullscreen">
           <span>${fullscreen}</span>
           <span style="display: none">${fullscreenExit}</span>
        </button>
    </div>
    <div class="pvt-graphnavigation-options">
        <button id="pvt-graphnavigation-options" class="pvt-graphnavigation-options-button" title="Open options">
           ${sliderTune}
        </button>
    </div>
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

    private buildOptionsDropdown() {
        const optionsButton: HTMLButtonElement | null | undefined =
            this.navigation?.querySelector('#pvt-graphnavigation-options')
        if (!optionsButton) return

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const dropdown = new PivotickDropdown(optionsButton, [
            {
                id: 'highligh-grid',
                svgIcon: grid,
                text: 'Highlight Grid',
                onClick: (_option, _dropdown, btn) => {
                    this.uiManager.layout?.canvas?.classList.toggle('grid-highlighted')
                    btn.classList.toggle('primary')
                    btn.classList.toggle('outline-primary')
                }
            },
            {
                id: 'snap-to-grid',
                svgIcon: snapGrid,
                text: 'Snap to grid',
                onClick: (_option, _dropdown, btn) => {
                    this.uiManager.graph.simulation.toggleGridSnapping()
                    btn.classList.toggle('primary')
                    btn.classList.toggle('outline-primary')
                }
            },
            {
                id: 'freeze-nodes-on-drag',
                svgIcon: pin,
                text: 'Freeze nodes on drag',
                variant: this.uiManager.graph.simulation.isFreezeNodesOnDrag() ? 'primary' : 'outline-primary',
                onClick: (_option, _dropdown, btn) => {
                    this.uiManager.graph.simulation.toggleFreezeNodesOnDrag()
                    btn.classList.toggle('primary')
                    btn.classList.toggle('outline-primary')
                }
            },
        ])
    }

    updateFullscreenIcon(button: HTMLElement) {
        const spans = button.querySelectorAll('span')

        const enterIcon = spans[0] as HTMLElement
        const exitIcon = spans[1] as HTMLElement

        const isFullscreen = this.uiManager.isFullscreenOn()

        enterIcon.style.display = isFullscreen ? 'none' : ''
        exitIcon.style.display = isFullscreen ? '' : 'none'
    }

    protected onGraphReady() {
        this.buildOptionsDropdown()
    }
}
