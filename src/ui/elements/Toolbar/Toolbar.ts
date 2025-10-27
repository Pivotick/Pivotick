import { funel, magnifyingGlass, redo, undo } from '../../icons'
import type { UIElement, UIManager } from '../../UIManager'
import './toolbar.scss'

export class Toolbar implements UIElement {
    private uiManager: UIManager

    public toolbar?: HTMLDivElement
    public searchInput?: HTMLInputElement
    public filterButton?: HTMLButtonElement
    public undoButton?: HTMLButtonElement
    public redoButton?: HTMLButtonElement

    constructor(uiManager: UIManager) {
        this.uiManager = uiManager
    }

    mount(container: HTMLElement | undefined) {
        if (!container) return

        this.toolbar = document.createElement('div')
        this.toolbar.className = 'pivotick-toolbar'

        /** Searchbox */
        const template = document.createElement('template')
        template.innerHTML = `
  <div class="pivotick-searchbox">
    <div class="input-container">
        <div class="icon-container">
            ${magnifyingGlass}
        </div>
        <input type="search" id="pivotick-search" class="" placeholder="Search" required disabled />
        <button type="submit" class="" disabled>Search</button>
    </div>
  </div>
`
        const searchbox = template.content.firstElementChild as HTMLDivElement
        this.searchInput = searchbox.querySelector('input') ?? undefined
        this.toolbar.appendChild(searchbox)

        /** Filter */
        const templateFilter = document.createElement('template')
        templateFilter.innerHTML = `
  <div class="pivotick-filter">
    <button id="pivotick-filter-button" class="pivotick-button-filter" disabled>
        ${funel}
    </button>
    <div style="border-left: 1px solid color-mix(in srgb, var(--pivotick-border-color) 80%, transparent);"></div>
    <div class="pivotick-undoredo-group">
        <button id="pivotick-undo-button" class="pivotick-button-undo" disabled>
            ${undo}
        </button>
        <button id="pivotick-redo-button" class="pivotick-button-redo" disabled>
            ${redo}
        </button>
    </div>
  </div>
`
        const filterContainer = templateFilter.content.firstElementChild as HTMLDivElement
        this.filterButton = filterContainer.querySelector('#pivotick-filter-button') ?? undefined
        this.undoButton = filterContainer.querySelector('#pivotick-undo-button') ?? undefined
        this.redoButton = filterContainer.querySelector('#pivotick-redo-button') ?? undefined
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
            this.uiManager.slidePanel?.slidePanel.classList.add('open')
        })
    }
}