import { chevronDown, funnel, magnifyingGlass, redo, stickyNote, undo } from '../../icons'
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
import { HistoryMenu } from './HistoryMenu'

export class Mainheader extends UIComponent {
    public mainheader?: HTMLDivElement
    public searchBoxButton?: HTMLDivElement
    public filterButton?: HTMLDivElement
    public noteButton?: HTMLDivElement
    public undoButton?: HTMLButtonElement
    public redoButton?: HTMLButtonElement
    public undoCaret?: HTMLButtonElement
    public redoCaret?: HTMLButtonElement
    /** The history dropdown both carets open. */
    public historyMenu?: HistoryMenu
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

        // Each pill is its own feature, and a feature that is switched off contributes
        // no pill — so a header can end up holding one of them, or none at all.
        /** Searchbox */
        if (this.uiManager.isFeatureEnabled('search')) {
            this.searchBoxButton = this.makePill(`
  <div id="pvt-searchbox-button" class="pvt-action-button" role="button" tabindex="0" aria-label="Search for a node">
    <div class="action-container">
        <span class="icon-container">${magnifyingGlass}</span>
        <span class="action-text">Search</span>
        ${createShortcutBadge('Shift+J').outerHTML}
    </div>
  </div>`)
        }

        /** Filterbox */
        if (this.uiManager.isFeatureEnabled('filter')) {
            this.filterButton = this.makePill(`
  <div id="pvt-filter-button" class="pvt-action-button" role="button" tabindex="0" aria-label="Filter the graph">
    <div class="action-container">
        <span class="icon-container">${funnel}</span>
        <span class="action-text">Filter Graph</span>
        ${createShortcutBadge('Shift+K').outerHTML}
    </div>
  </div>`)
        }

        /** Notebox */
        if (this.uiManager.isFeatureEnabled('notes')) {
            this.noteButton = this.makePill(`
  <div id="pvt-notes-button" class="pvt-action-button" role="button" tabindex="0" aria-label="Notes">
    <div class="action-container">
        <span class="icon-container">${stickyNote}</span>
        <span class="action-text">Notes</span>
        ${createShortcutBadge('Shift+N').outerHTML}
    </div>
  </div>`)
        }

        if (this.uiManager.isFeatureEnabled('history')) this.buildHistoryGroup()

        container.appendChild(this.mainheader)
    }

    /** Build one header pill from its markup and append it to the strip. */
    private makePill(markup: string): HTMLDivElement {
        const template = document.createElement('template')
        template.innerHTML = markup
        const pill = template.content.firstElementChild as HTMLDivElement
        this.mainheader!.appendChild(pill)
        return pill
    }

    /** Undo/Redo — each a split button: the icon steps once, the caret opens the history */
    private buildHistoryGroup() {
        const templateRight = document.createElement('template')
        templateRight.innerHTML = `
  <div class="pvt-right">
    <div class="pvt-undoredo-group">
        <button id="pvt-undo-button" class="pvt-button-undo pvt-undoredo-step" disabled>
            ${undo}
        </button>
        <button id="pvt-undo-caret" class="pvt-undoredo-caret" disabled aria-label="Undo history" aria-haspopup="menu">
            ${chevronDown}
        </button>
        <span class="pvt-undoredo-sep"></span>
        <button id="pvt-redo-button" class="pvt-button-redo pvt-undoredo-step" disabled>
            ${redo}
        </button>
        <button id="pvt-redo-caret" class="pvt-undoredo-caret" disabled aria-label="Redo history" aria-haspopup="menu">
            ${chevronDown}
        </button>
    </div>
  </div>`
        const group = templateRight.content.firstElementChild as HTMLDivElement
        this.undoButton = group.querySelector('#pvt-undo-button') ?? undefined
        this.redoButton = group.querySelector('#pvt-redo-button') ?? undefined
        this.undoCaret = group.querySelector('#pvt-undo-caret') ?? undefined
        this.redoCaret = group.querySelector('#pvt-redo-caret') ?? undefined
        this.mainheader!.appendChild(group)
    }

    protected onDestroy() {
        this.mainheader?.remove()
        this.mainheader = undefined
    }

    protected onAfterMount() {
        const { filterButton, noteButton, searchBoxButton } = this

        // A pill's panel and its shortcut are built beside the pill: with the feature
        // off there is no key to press and no panel to open behind its back.
        if (filterButton) {
            this.track(this.uiManager.keyManager.register({ key: 'Shift+K', callback: () => this.filterButton?.click() }))
            const graphFilter = new GraphFilter(this.uiManager)
            this.filteringSlidepanel = this.uiManager.createSlidepanel({
                header: 'Graph Filters',
                body: graphFilter.build()
            })
            // Only one slide panel open at a time: opening one closes the other.
            this.listen(filterButton, 'click', () => {
                this.noteSlidepanel?.close()
                this.filteringSlidepanel!.toggle()
            })
        }

        if (noteButton) {
            this.track(this.uiManager.keyManager.register({ key: 'Shift+N', callback: () => this.noteButton?.click() }))
            this.noteSidebar = new NoteSidebar(this.uiManager)
            this.noteSlidepanel = this.uiManager.createSlidepanel({
                header: 'Notes',
                body: this.noteSidebar.build()
            })
            this.listen(noteButton, 'click', () => {
                this.filteringSlidepanel?.close()
                this.noteSlidepanel!.toggle()
            })
            // NoteSidebar's afterMount (bind) / destroy (unbind) are driven by UIComponent
            this.addChild(this.noteSidebar)
        }

        if (searchBoxButton) {
            this.track(this.uiManager.keyManager.register({ key: 'Shift+J', callback: () => this.searchBoxButton?.click() }))
            this.listen(searchBoxButton, 'click', async () => {
                const node = await pickNode(this.uiManager)
                if (!node) return
                this.uiManager.graph.selectElement(node as unknown as Node)
            })
        }

        this.wireHistory()

        // These action pills are role="button" divs — activate them on Enter/Space.
        for (const btn of [searchBoxButton, filterButton, noteButton]) {
            if (!btn) continue
            this.listen(btn, 'keydown', (e) => {
                const ev = e as KeyboardEvent
                if (ev.key === 'Enter' || ev.key === ' ') {
                    ev.preventDefault()
                    btn.click()
                }
            })
        }
    }

    /**
     * The two buttons, and the keyboard that reaches them without the header. Each
     * takes back one entry per press; the dropdowns that travel a whole span hang off
     * the same buttons.
     *
     * `Mod+` so Cmd works on macOS. The key manager's editable-target guard means a
     * press inside a filter box falls through to the browser's own text undo, which is
     * what it should do.
     */
    private wireHistory(): void {
        const history = this.uiManager.graph.history
        const { undoButton, redoButton, undoCaret, redoCaret } = this
        if (!undoButton || !redoButton || !undoCaret || !redoCaret) return

        // The menu goes in the canvas, not the header: the header is a 48px strip with
        // `overflow: hidden`, which would clip a dropdown to nothing.
        const canvas = this.uiManager.layout?.canvas
        if (canvas) {
            const menu = new HistoryMenu(this.uiManager, { undo: undoCaret, redo: redoCaret })
            this.historyMenu = this.addChild(menu, canvas)
        }

        this.listen(undoButton, 'click', () => {
            this.historyMenu?.close()
            history.undo()
        })
        this.listen(redoButton, 'click', () => {
            this.historyMenu?.close()
            history.redo()
        })
        this.listen(undoCaret, 'click', () => this.historyMenu?.toggle('undo'))
        this.listen(redoCaret, 'click', () => this.historyMenu?.toggle('redo'))
        this.track(this.uiManager.keyManager.register({
            key: 'Mod+z', description: 'Undo', callback: () => history.undo(),
        }))
        this.track(this.uiManager.keyManager.register({
            key: 'Mod+Shift+Z', description: 'Redo', callback: () => history.redo(),
        }))

        const paint = (): void => {
            const [next] = history.entries()
            const [back] = history.redoable()
            paintButton(undoButton, 'Undo', next?.label, history.canUndo())
            paintButton(redoButton, 'Redo', back?.label, history.canRedo())
            // Either caret opens the same list, so either one is useful as soon as the
            // list has anything in it at all.
            const anyEntries = history.canUndo() || history.canRedo()
            undoCaret.disabled = !anyEntries
            redoCaret.disabled = !anyEntries
            if (!anyEntries) this.historyMenu?.close()
        }
        this.track(history.on(paint))
        paint()
    }
}

/**
 * A history button's enabled state and its label. The title names what is about to
 * happen — `Undo — Hid 3 nodes` — because a bare "Undo" on a canvas that moved while
 * the analyst was reading is the one thing they cannot check.
 */
function paintButton(button: HTMLButtonElement, verb: string, entry: string | undefined, enabled: boolean): void {
    button.disabled = !enabled
    const shortcut = verb === 'Undo' ? modLabel('Z') : modLabel('⇧Z')
    button.title = enabled && entry ? `${verb} — ${entry} (${shortcut})` : `${verb} (${shortcut})`
    button.setAttribute('aria-label', enabled && entry ? `${verb} ${entry}` : verb)
}

/** `⌘Z` on macOS, `Ctrl+Z` everywhere else. */
function modLabel(key: string): string {
    const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent)
    return mac ? `⌘${key}` : `Ctrl+${key}`
}