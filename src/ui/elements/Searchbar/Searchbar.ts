import { funnel, magnifyingGlass, redo, undo } from '../../icons'
import type { UIElement, UIManager } from '../../UIManager'
import { SearchBox } from './SearchBox'
import './searchbar.scss'
import { Node } from '../../../Node'
import type { SlidePanel } from '../SlidePanel/SlidePanel'
import { GraphFilter } from '../GraphFilter/GraphFilter'
import type { Modal } from '../../components/Modal'
import { createShortcutBadge } from '../../../utils/ElementCreation'

export class Searchbar implements UIElement {
    private uiManager: UIManager

    public searchbar?: HTMLDivElement
    public searchBoxButton?: HTMLDivElement
    public filterButton?: HTMLDivElement
    public undoButton?: HTMLButtonElement
    public redoButton?: HTMLButtonElement
    public filteringSlidepanel?: SlidePanel
    private searchModal?: Modal

    constructor(uiManager: UIManager) {
        this.uiManager = uiManager
    }

    mount(container: HTMLElement | undefined) {
        if (!container) return

        this.searchbar = document.createElement('div')
        this.searchbar.className = 'pvt-searchbar-elements'

        /** Searchbox */
        const templateSearch = document.createElement('template')
        templateSearch.innerHTML = `
  <div id="pvt-searchbox-button" class="pvt-action-button">
    <div class="action-container">
        <span class="icon-container">${magnifyingGlass}</span>
        <span class="action-text">Search</span>
        ${createShortcutBadge('Ctrl+J').outerHTML}
    </div>
  </div>`
        this.searchBoxButton = templateSearch.content.firstElementChild as HTMLDivElement
        this.searchbar.appendChild(this.searchBoxButton)

        /** SearcFilterbox */
        const templateFilter = document.createElement('template')
        templateFilter.innerHTML = `
  <div id="pvt-filter-button" class="pvt-action-button">
    <div class="action-container">
        <span class="icon-container">${funnel}</span>
        <span class="action-text">Filter Graph</span>
        ${createShortcutBadge('Ctrl+K').outerHTML}
    </div>
  </div>`
        this.filterButton = templateFilter.content.firstElementChild as HTMLDivElement

        /** Filter */
        const templateRight = document.createElement('template')
        templateRight.innerHTML = `
  <div class="pvt-right">
    <div class="pvt-undoredo-group">
        <button id="pvt-undo-button" class="pvt-button-undo" disabled>
            ${undo}
        </button>
        <button id="pvt-redo-button" class="pvt-button-redo" disabled>
            ${redo}
        </button>
    </div>
  </div>`
        const filterContainer = templateRight.content.firstElementChild as HTMLDivElement
        filterContainer.prepend(this.filterButton)
        this.undoButton = filterContainer.querySelector('#pvt-undo-button') ?? undefined
        this.redoButton = filterContainer.querySelector('#pvt-redo-button') ?? undefined
        this.searchbar.appendChild(filterContainer)

        container.appendChild(this.searchbar)
    }

    destroy() {
        this.searchbar?.remove()
        this.searchbar = undefined
    }

    afterMount() {
        if (!this.filterButton) return

        this.uiManager.keyManager.register({ key: 'Ctrl+j', callback: () => this.searchBoxButton?.click() })
        this.uiManager.keyManager.register({ key: 'Ctrl+k', callback: () => this.filterButton?.click() })

        const graphFilter = new GraphFilter(this.uiManager)
        this.filteringSlidepanel = this.uiManager.createSlidepanel({
            header: 'Graph Filters',
            body: graphFilter.build()
        })

        this.filterButton.addEventListener('click', () => {
            this.filteringSlidepanel!.toggle()
        })


        this.searchBoxButton?.addEventListener('click', () => {
            if (this.searchModal) return

            this.searchModal = this.uiManager.createModal({
                body: '',
                buttons: null,
                position: 'top',
                size: 'xl',
                noBodyPadding: true,
            })

            if (this.searchModal) {
                this.searchModal.modal?.addEventListener('pvt-modal-show', () => {
                    const searchBox = new SearchBox(this.uiManager)
                    this.searchModal?.setBody(searchBox.build())
                    searchBox.searchInput?.focus()

                    searchBox.searchBox?.addEventListener('pvt-searchbox-select', (evt: Event) => {
                        const custom = evt as CustomEvent<Node>
                        const node = custom.detail as Node
                        this.uiManager.graph.selectElement(node)
                        this.searchModal?.destroy()
                    })
                    searchBox.searchBox?.addEventListener('pvt-searchbox-close', () => {
                        this.searchModal?.destroy()
                    })
                })
                this.searchModal.modal?.addEventListener('pvt-modal-hidden', () => {
                    this.searchModal = undefined
                })
            }
        })
    }

    graphReady(): void { }
}