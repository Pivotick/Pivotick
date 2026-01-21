import { funel, magnifyingGlass, redo, undo } from '../../icons'
import type { UIElement, UIManager } from '../../UIManager'
import './toolbar.scss'

export class Toolbar implements UIElement {
    private uiManager: UIManager

    public toolbar?: HTMLDivElement
    public searchBox?: HTMLDivElement
    public filterButton?: HTMLButtonElement
    public undoButton?: HTMLButtonElement
    public redoButton?: HTMLButtonElement

    constructor(uiManager: UIManager) {
        this.uiManager = uiManager
    }

    mount(container: HTMLElement | undefined) {
        if (!container) return

        this.toolbar = document.createElement('div')
        this.toolbar.className = 'pvt-toolbar-elements'

        /** Searchbox */
        const template = document.createElement('template')
        template.innerHTML = `
  <div id="pvt-searchbox" class="pvt-searchbox">
    <div class="search-container">
        <span class="icon-container">${magnifyingGlass}</span>
        <span class="search-text">Search</span>
        <span class="pvt-keyboard-shortcut">Ctrl K</span>
    </div>
  </div>
`
        this.searchBox = template.content.firstElementChild as HTMLDivElement
        this.toolbar.appendChild(this.searchBox)

        /** Filter */
        const templateFilter = document.createElement('template')
        templateFilter.innerHTML = `
  <div class="pvt-filter">
    <button id="pvt-filter-button" class="pvt-button-filter" disabled>
        ${funel}
    </button>
    <div style="border-left: 1px solid color-mix(in srgb, var(--pvt-border-color) 80%, transparent);"></div>
    <div class="pvt-undoredo-group">
        <button id="pvt-undo-button" class="pvt-button-undo" disabled>
            ${undo}
        </button>
        <button id="pvt-redo-button" class="pvt-button-redo" disabled>
            ${redo}
        </button>
    </div>
  </div>
`
        const filterContainer = templateFilter.content.firstElementChild as HTMLDivElement
        this.filterButton = filterContainer.querySelector('#pvt-filter-button') ?? undefined
        this.undoButton = filterContainer.querySelector('#pvt-undo-button') ?? undefined
        this.redoButton = filterContainer.querySelector('#pvt-redo-button') ?? undefined
        this.toolbar.appendChild(filterContainer)

        container.appendChild(this.toolbar)
    }

    destroy() {
        this.toolbar?.remove()
        this.toolbar = undefined
    }

    afterMount() {
        if (!this.filterButton || !this.uiManager.slidePanel?.slidePanel) return
        this.filterButton.addEventListener('click', () => {
            if (!this.uiManager.slidePanel?.slidePanel) return
            this.uiManager.slidePanel.open()
        })

        this.searchBox?.addEventListener('click', () => {
            this.uiManager.createModal({
                body: '',
                buttons: null,
                position: 'top',
                size: 'xl'
            })
        })
    }

    graphReady(): void { }
}