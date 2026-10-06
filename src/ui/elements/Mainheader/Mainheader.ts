import { chevronDown, funnel, magnifyingGlass, redo, stickyNote, undo } from '../../icons'
import type { UIManager } from '../../UIManager'
import type { Graph } from '../../../Graph'
import { UIComponent } from '../../UIComponent'
// import { SearchBox } from './SearchBox'
import './mainheader.scss'
import type { SlidePanel } from '../SlidePanel/SlidePanel'
import { GraphFilter } from '../GraphFilter/GraphFilter'
import type { Modal } from '../../components/Modal'
import { createShortcutBadge } from '../../../utils/ElementCreation'
import { NoteSidebar } from '../NoteSidebar/NoteSidebar'
import { searchGraph } from '../../components/NodePickers'
import { revealNode } from '../../groupActions'
import { SearchHighlight } from '../../searchHighlight'
import { HistoryMenu } from './HistoryMenu'
import { TopBarActionMenu } from './TopBarActionMenu'
import { createIcon } from '../../../utils/ElementCreation'
import { confirmModal, promptData } from '../../../editing/PromptModal'
import type { MenuActionItemOptions, TopBarAction, TopBarActionContext } from '../../../interfaces/GraphUI'

/** One drawn host pill, kept across refreshes so it keeps its focus and its listeners. */
interface ActionPill {
    action: TopBarAction
    root: HTMLDivElement
    label: HTMLSpanElement
    caret?: HTMLButtonElement
    /** What the pill's markup is built from; a change rebuilds it rather than patching it. */
    shape: string
    /** Last painted, for the prompt's title. */
    text: string
    disabled: boolean
    /** An `onclick` promise is out. */
    busy: boolean
}

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
    /** Host pills: after the built-ins, and before the undo-redo group. */
    private startActions?: HTMLDivElement
    private endActions?: HTMLDivElement
    private actionPills = new Map<string, ActionPill>()
    private actionMenu?: TopBarActionMenu
    private refreshQueued = false

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

        // `display: contents`, so the pills inside are the strip's own flex items.
        this.startActions = document.createElement('div')
        this.startActions.className = 'pvt-topbar-actions'
        this.mainheader.appendChild(this.startActions)

        const right = document.createElement('div')
        right.className = 'pvt-right'
        this.endActions = document.createElement('div')
        this.endActions.className = 'pvt-topbar-actions'
        right.appendChild(this.endActions)
        if (this.uiManager.isFeatureEnabled('history')) this.buildHistoryGroup(right)
        this.mainheader.appendChild(right)

        this.actionMenu = new TopBarActionMenu(
            container.closest<HTMLElement>('.pivotick') ?? document.body,
            this,
            () => this.refreshActions(),
        )

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
    private buildHistoryGroup(right: HTMLDivElement) {
        const templateRight = document.createElement('template')
        templateRight.innerHTML = `
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
    </div>`
        const group = templateRight.content.firstElementChild as HTMLDivElement
        this.undoButton = group.querySelector('#pvt-undo-button') ?? undefined
        this.redoButton = group.querySelector('#pvt-redo-button') ?? undefined
        this.undoCaret = group.querySelector('#pvt-undo-caret') ?? undefined
        this.redoCaret = group.querySelector('#pvt-redo-caret') ?? undefined
        right.appendChild(group)
    }

    protected onDestroy() {
        this.actionMenu?.close()
        this.actionMenu = undefined
        this.actionPills.clear()
        this.mainheader?.remove()
        this.mainheader = undefined
        this.startActions = undefined
        this.endActions = undefined
    }

    protected onGraphReady() {
        this.refreshActions()
    }

    /* ---------- host actions ---------- */

    /**
     * Re-read every action and bring the pills in line: new ones drawn, gone ones removed,
     * the rest updated where they stand.
     */
    public refreshActions(): void {
        const { startActions, endActions } = this
        if (!startActions || !endActions) return

        const placed: Record<'start' | 'end', HTMLDivElement[]> = { start: [], end: [] }
        const drawn = new Set<string>()
        for (const action of this.uiManager.getTopBarActions()) {
            if (drawn.has(action.id)) continue
            const pill = this.paintAction(action)
            if (!pill) continue
            drawn.add(action.id)
            placed[action.placement === 'start' ? 'start' : 'end'].push(pill.root)
        }
        for (const [id, pill] of this.actionPills) {
            if (drawn.has(id)) continue
            this.closeMenuOf(pill)
            pill.root.remove()
            this.actionPills.delete(id)
        }
        placeInOrder(startActions, placed.start)
        placeInOrder(endActions, placed.end)
    }

    /** Draw or update one action's pill; `undefined` when it is not to be shown. */
    private paintAction(action: TopBarAction): ActionPill | undefined {
        const graph = this.uiManager.graph
        let text: string, title: string | undefined, enabled: boolean
        try {
            if (!(resolve(action.visible, graph) ?? true)) return undefined
            text = resolve(action.text, graph)
            title = resolve(action.title, graph)
            enabled = resolve(action.enabled, graph) ?? true
        } catch (error) {
            console.warn(`Pivotick: top-bar action "${action.id}" could not be drawn.`, error)
            return undefined
        }

        // A menu with no rows gets no caret, so one that only applies later stays hidden till then.
        const hasMenu = this.menuRows(action, this.actionContext(() => text)).length > 0
        const shape = [action.iconClass, action.svgIcon, action.shortcut, hasMenu].join('|')
        let pill = this.actionPills.get(action.id)
        if (pill && pill.shape !== shape) {
            this.closeMenuOf(pill)
            const fresh = this.buildActionPill(action, shape, hasMenu, pill.busy)
            pill.root.replaceWith(fresh.root)
            pill = fresh
        }
        pill ??= this.buildActionPill(action, shape, hasMenu, false)
        this.actionPills.set(action.id, pill)

        pill.action = action
        pill.text = text
        pill.disabled = !enabled || pill.busy
        pill.label.textContent = text
        pill.root.title = title ?? ''
        pill.root.setAttribute('aria-label', text)
        pill.root.classList.toggle('pvt-disabled', pill.disabled)
        pill.root.setAttribute('aria-disabled', String(pill.disabled))
        pill.root.toggleAttribute('aria-busy', pill.busy)
        pill.root.tabIndex = pill.disabled ? -1 : 0
        if (pill.caret) {
            pill.caret.disabled = pill.disabled
            pill.caret.setAttribute('aria-label', `More: ${text}`)
            if (pill.disabled) this.closeMenuOf(pill)
        }
        return pill
    }

    private buildActionPill(action: TopBarAction, shape: string, hasMenu: boolean, busy: boolean): ActionPill {
        const root = document.createElement('div')
        root.className = 'pvt-action-button pvt-topbar-action'
        root.dataset.action = action.id
        root.setAttribute('role', 'button')
        const container = document.createElement('div')
        container.className = 'action-container'
        if (action.iconClass || action.svgIcon) {
            const icon = document.createElement('span')
            icon.className = 'icon-container'
            icon.appendChild(createIcon({ iconClass: action.iconClass, svgIcon: action.svgIcon }))
            container.appendChild(icon)
        }
        const label = document.createElement('span')
        label.className = 'action-text'
        container.appendChild(label)
        if (action.shortcut) container.appendChild(createShortcutBadge(action.shortcut))
        root.appendChild(container)

        const pill: ActionPill = { action, root, label, shape, text: '', disabled: false, busy }

        if (hasMenu) {
            root.classList.add('pvt-topbar-split')
            const caret = document.createElement('button')
            caret.type = 'button'
            caret.className = 'pvt-topbar-caret'
            caret.setAttribute('aria-haspopup', 'menu')
            caret.setAttribute('aria-expanded', 'false')
            caret.innerHTML = chevronDown
            caret.addEventListener('click', (event) => {
                event.stopPropagation()
                this.toggleActionMenu(pill)
            })
            container.appendChild(caret)
            pill.caret = caret
        }

        root.addEventListener('click', (event) => this.runAction(pill, event))
        root.addEventListener('keydown', (event) => {
            if (event.target !== root || (event.key !== 'Enter' && event.key !== ' ')) return
            event.preventDefault()
            this.runAction(pill, event)
        })
        return pill
    }

    private runAction(pill: ActionPill, event: MouseEvent | KeyboardEvent): void {
        if (pill.disabled || !pill.action.onclick) return
        this.actionMenu?.close()
        const result: unknown = pill.action.onclick(event, this.actionContext(() => pill.text))
        if (!(result instanceof Promise)) return
        pill.busy = true
        this.refreshActions()
        result
            .catch(error => console.error(`Pivotick: top-bar action "${pill.action.id}" failed.`, error))
            .finally(() => {
                pill.busy = false
                this.refreshActions()
            })
    }

    private toggleActionMenu(pill: ActionPill): void {
        const { caret, action } = pill
        if (!caret || !this.actionMenu || pill.disabled) return
        if (this.actionMenu.isOpenFor(caret)) {
            this.actionMenu.close()
            return
        }
        this.historyMenu?.close()
        this.actionMenu.open(caret, pill.root, this.menuRows(action, this.actionContext(() => pill.text)))
    }

    private menuRows(action: TopBarAction, ctx: TopBarActionContext): MenuActionItemOptions[] {
        try {
            return typeof action.menu === 'function' ? action.menu(ctx) : action.menu ?? []
        } catch (error) {
            console.warn(`Pivotick: top-bar action "${action.id}" could not build its menu.`, error)
            return []
        }
    }

    private closeMenuOf(pill: ActionPill): void {
        if (pill.caret && this.actionMenu?.isOpenFor(pill.caret)) this.actionMenu.close()
    }

    /** `title` is read when the prompt opens, so it is the label the pill shows then. */
    private actionContext(title: () => string): TopBarActionContext {
        const graph = this.uiManager.graph
        return {
            graph,
            promptData: options => promptData(graph, options, { title: title(), submitLabel: 'OK' }),
            confirm: options => confirmModal(graph, options),
            refresh: () => this.uiManager.refreshTopBar(),
        }
    }

    /** Coalesced: an import is many changes, and the pills only need the last of them. */
    private queueRefresh(): void {
        if (this.refreshQueued) return
        this.refreshQueued = true
        queueMicrotask(() => {
            this.refreshQueued = false
            this.refreshActions()
        })
    }

    protected onAfterMount() {
        const { filterButton, noteButton, searchBoxButton } = this

        // Host pills read the graph, which is still being built while this runs.
        const graph = this.uiManager.graph
        const queue = () => this.queueRefresh()
        for (const event of ['dataBatchChanged', 'nodeAdd', 'nodeRemove', 'nodeChange', 'edgeAdd', 'edgeRemove', 'edgeChange'] as const) {
            graph.on(event, queue)
            this.track(() => graph.off(event, queue))
        }
        this.queueRefresh()

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
            const highlight = new SearchHighlight(this.uiManager)
            this.track(() => highlight.clear())
            this.listen(searchBoxButton, 'click', async () => {
                highlight.clear()
                const outcome = await searchGraph(this.uiManager)
                if (outcome?.kind === 'pick') revealNode(this.uiManager, outcome.node)
                else if (outcome?.kind === 'showAll') highlight.show(outcome.nodes, outcome.query)
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
/** Read a field that is either a value or a function of the graph. */
function resolve<T>(value: T | ((graph: Graph) => T), graph: Graph): T {
    return typeof value === 'function' ? (value as (graph: Graph) => T)(graph) : value
}

/** Make `parent`'s children exactly `children`, in order, moving only what is out of place. */
function placeInOrder(parent: HTMLElement, children: HTMLElement[]): void {
    children.forEach((child, index) => {
        if (parent.children[index] !== child) parent.insertBefore(child, parent.children[index] ?? null)
    })
}
