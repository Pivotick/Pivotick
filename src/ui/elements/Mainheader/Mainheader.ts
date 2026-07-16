import { funnel, magnifyingGlass, redo, stickyNote, undo } from '../../icons'
import type { UIManager } from '../../UIManager'
import { UIComponent } from '../../UIComponent'
// import { SearchBox } from './SearchBox'
import './mainheader.scss'
import { Node } from '../../../Node'
import type { SlidePanel } from '../SlidePanel/SlidePanel'
import { GraphFilter } from '../GraphFilter/GraphFilter'
import type { Modal } from '../../components/Modal'
import { createShortcutBadge } from '../../../utils/ElementCreation'
import { NoteSidebar } from '../NoteSidebar/NoteSidebar'
import { pickNode } from '../../components/NodePickers'

export class Mainheader extends UIComponent {
    public mainheader?: HTMLDivElement
    public searchBoxButton?: HTMLDivElement
    public filterButton?: HTMLDivElement
    public noteButton?: HTMLDivElement
    public undoButton?: HTMLButtonElement
    public redoButton?: HTMLButtonElement
    public filteringSlidepanel?: SlidePanel
    public noteSlidepanel?: SlidePanel
    private searchModal?: Modal
    private noteSidebar?: NoteSidebar

    constructor(uiManager: UIManager) {
        super(uiManager)
    }

    protected onMount(container: HTMLElement | undefined) {
        if (!container) return

        this.mainheader = document.createElement('div')
        this.mainheader.className = 'pvt-mainheader-elements'

        /** Searchbox */
        const templateSearch = document.createElement('template')
        templateSearch.innerHTML = `
  <div id="pvt-searchbox-button" class="pvt-action-button">
    <div class="action-container">
        <span class="icon-container">${magnifyingGlass}</span>
        <span class="action-text">Search</span>
        ${createShortcutBadge('Shift+J').outerHTML}
    </div>
  </div>`
        this.searchBoxButton = templateSearch.content.firstElementChild as HTMLDivElement
        this.mainheader.appendChild(this.searchBoxButton)

        /** Filterbox */
        const templateFilter = document.createElement('template')
        templateFilter.innerHTML = `
  <div id="pvt-filter-button" class="pvt-action-button">
    <div class="action-container">
        <span class="icon-container">${funnel}</span>
        <span class="action-text">Filter Graph</span>
        ${createShortcutBadge('Shift+K').outerHTML}
    </div>
  </div>`
        this.filterButton = templateFilter.content.firstElementChild as HTMLDivElement
        this.mainheader.appendChild(this.filterButton)

        /** Notebox */
        const templateNoteSidebar = document.createElement('template')
        templateNoteSidebar.innerHTML = `
  <div id="pvt-filter-button" class="pvt-action-button">
    <div class="action-container">
        <span class="icon-container">${stickyNote}</span>
        <span class="action-text">Notes</span>
        ${createShortcutBadge('Shift+N').outerHTML}
    </div>
  </div>`
        this.noteButton = templateNoteSidebar.content.firstElementChild as HTMLDivElement
        this.mainheader.appendChild(this.noteButton)

        /** Undo/Redo */
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
        filterContainer.prepend(this.noteButton)
        this.undoButton = filterContainer.querySelector('#pvt-undo-button') ?? undefined
        this.redoButton = filterContainer.querySelector('#pvt-redo-button') ?? undefined
        this.mainheader.appendChild(filterContainer)

        container.appendChild(this.mainheader)
    }

    protected onDestroy() {
        this.mainheader?.remove()
        this.mainheader = undefined
    }

    protected onAfterMount() {
        const { filterButton, noteButton, searchBoxButton } = this
        if (!filterButton || !noteButton) return

        this.track(this.uiManager.keyManager.register({ key: 'Shift+J', callback: () => this.searchBoxButton?.click() }))
        this.track(this.uiManager.keyManager.register({ key: 'Shift+K', callback: () => this.filterButton?.click() }))
        this.track(this.uiManager.keyManager.register({ key: 'Shift+N', callback: () => this.noteButton?.click() }))

        const graphFilter = new GraphFilter(this.uiManager)
        this.filteringSlidepanel = this.uiManager.createSlidepanel({
            header: 'Graph Filters',
            body: graphFilter.build()
        })
        this.listen(filterButton, 'click', () => this.filteringSlidepanel!.toggle())

        this.noteSidebar = new NoteSidebar(this.uiManager)
        this.noteSlidepanel = this.uiManager.createSlidepanel({
            header: 'Notes',
            body: this.noteSidebar.build()
        })
        this.listen(noteButton, 'click', () => this.noteSlidepanel!.toggle())
        // NoteSidebar's afterMount (bind) / destroy (unbind) are driven by UIComponent
        this.addChild(this.noteSidebar)

        if (searchBoxButton) {
            this.listen(searchBoxButton, 'click', async () => {
                const node = await pickNode(this.uiManager)
                if (!node) return
                this.uiManager.graph.selectElement(node as unknown as Node)
            })
        }
    }
}