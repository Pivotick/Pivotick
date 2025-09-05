import type { UIElement, UIManager } from '../../UIManager'
import './slidePanel.scss'

export class SlidePanel implements UIElement {
    private uiManager: UIManager

    public slidePanel?: HTMLDivElement

    constructor(uiManager: UIManager) {
        this.uiManager = uiManager
    }

    mount(container: HTMLElement | undefined) {
        if (!container) return

        const templateSlidePanel = document.createElement('template')
        templateSlidePanel.innerHTML = `
  <div class="slide-panel" id="side-panel">
    <div class="slide-panel__header">
        Panel Title
        <button id="pivotick-sidePanel-close" class="pivotick-close-button">×</button>
    </div>
    <div class="slide-panel__content">
        <p>This is the content of the panel.</p>
    </div>
    </div>
`
        this.slidePanel = templateSlidePanel.content.firstElementChild as HTMLDivElement
        container.appendChild(this.slidePanel)
    }

    destroy() {
        this.slidePanel?.remove()
        this.slidePanel = undefined
    }

    afterMount() {
        if (!this.slidePanel) return
        const closeButton = this.slidePanel.querySelector('#pivotick-sidePanel-close')
        closeButton?.addEventListener('click', () => {
            this.slidePanel?.classList.remove('open')
        })
    }

}