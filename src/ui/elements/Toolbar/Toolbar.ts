import { funel, magnifyingGlass, redo, undo } from '../../icons'
import type { UIElement, UIManager } from '../../UIManager'
import { SearchBox } from './SearchBox'
import './toolbar.scss'
import { Node } from '../../../Node'
import type { SlidePanel } from '../SlidePanel/SlidePanel'
import { GraphFilter } from '../GraphFilter/GraphFilter'
import { graph } from '../../../ail-graph'

export class Toolbar implements UIElement {
    private uiManager: UIManager

    public toolbar?: HTMLDivElement
    public searchBoxButton?: HTMLDivElement
    public filterButton?: HTMLButtonElement
    public undoButton?: HTMLButtonElement
    public redoButton?: HTMLButtonElement
    public filteringSlidepanel?: SlidePanel

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
  <div id="pvt-searchbox-button" class="pvt-searchbox-button">
    <div class="search-container">
        <span class="icon-container">${magnifyingGlass}</span>
        <span class="search-text">Search</span>
        <span class="pvt-keyboard-shortcut">Ctrl F</span>
    </div>
  </div>
`
        this.searchBoxButton = template.content.firstElementChild as HTMLDivElement
        this.toolbar.appendChild(this.searchBoxButton)

        /** Filter */
        const templateFilter = document.createElement('template')
        templateFilter.innerHTML = `
  <div class="pvt-filter">
    <button id="pvt-filter-button" class="pvt-button-filter">
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
        if (!this.filterButton) return

        this.uiManager.keyManager.register({ key: 'Ctrl+f', callback: () => this.searchBoxButton?.click() })

        const graphFilter = new GraphFilter(this.uiManager, {})
        this.filteringSlidepanel = this.uiManager.createSlidepanel({
            header: 'Graph Filters',
            body: graphFilter.build()
        })

        this.filterButton.addEventListener('click', () => {
            this.filteringSlidepanel!.toggle()
        })


        this.searchBoxButton?.addEventListener('click', () => {
            const modal = this.uiManager.createModal({
                body: '',
                buttons: null,
                position: 'top',
                size: 'xl',
                noBodyPadding: true,
            })

            if (modal) {
                modal.modal?.addEventListener('pvt-modal-show', () => {
                    const searchBox = new SearchBox(this.uiManager)
                    modal.setBody(searchBox.build())
                    searchBox.searchInput?.focus()

                    searchBox.searchBox?.addEventListener('pvt-searchbox-select', (evt: Event) => {
                        const custom = evt as CustomEvent<Node>
                        const node = custom.detail as Node
                        this.uiManager.graph.selectElement(node)
                        modal.destroy()
                    })
                    searchBox.searchBox?.addEventListener('pvt-searchbox-close', () => {
                        modal.destroy()
                    })
                })
            }
        })
    }

    graphReady(): void { }
}