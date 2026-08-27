import { UIComponent } from '../../UIComponent'
import type { UIManager } from '../../UIManager'
import type { DockTabHandle, TableExportFormat, TableOptions, TableTab } from '../../../interfaces/GraphUI'
import type { Dock } from '../Dock/Dock'
import { TableGrid } from './TableGrid'
import { TableGraphFilter, sameIdSet } from './TableGraphFilter'
import { downloadText, toCsv, toJson } from './TableExport'
import { funnel, funnelClear, sliderTune } from '../../icons'
import './table.scss'

/** The dock-tab id the table claims. Stable, so it can be activated by name. */
const DOCK_TAB_ID = 'table'

/**
 * The graph's rows, as a sortable, selectable grid — **one** pane in the {@link Dock},
 * registered through the same `addDockTab` a plugin uses and exactly as privileged.
 *
 * `Nodes` and `Edges` are the table's *own* tabs, not the dock's: they are two views of
 * this one pane, and listing them out beside another pane's tab would claim they are the
 * same kind of thing. So the dock's strip names panes (`Table`, `Events`) and this class
 * draws its own segmented switch in the header slot the dock hands it — the two levels
 * are styled differently so they never read as one flat row.
 *
 * What it owns is the content — a grid per inner tab, each keeping its own sort, columns
 * and row filters — and the header controls that go with whichever view is on show. The
 * region around them (the row's height, the divider, the fold, the pane strip) belongs to
 * the dock, and this class never touches it.
 *
 * It mutates nothing: it reflects the graph and drives the selection. Hiding and pinning
 * stay with the sidebar's bulk actions; restoring a hidden node stays with the filter
 * panel. What the table offers is a better instrument for *building* the selection those
 * act on.
 *
 * The one thing it can change is what the canvas *shows*, and only when asked: the
 * toolbar's push button applies the column filters to the graph as one reserved filter
 * (see {@link TableGraphFilter}). Until it is pressed, narrowing a column is reading, not
 * filtering — which is the separation the `Visibility` column depends on.
 */
export class Table extends UIComponent {
    private readonly options: TableOptions
    private readonly dock?: Dock

    private summary?: HTMLSpanElement
    private pickerButton?: HTMLButtonElement
    private picker?: HTMLDivElement
    /** Outside-click / Escape handler, live only while the picker is open. */
    private dismissPicker?: (event: Event) => void
    private grid?: TableGrid
    /** Owns the reserved filter the push button writes. Absent when `filterGraph: false`. */
    private graphFilter?: TableGraphFilter
    /** The push button, rebuilt with the rest of the toolbar on every activation. */
    private applyButton?: HTMLButtonElement
    /** The pane's own `Nodes` / `Edges` strip, in the dock's header slot. */
    private tabs?: HTMLDivElement
    /** One grid per inner tab, so each keeps its own sort, columns and row filters. */
    private readonly grids = new Map<TableTab, TableGrid>()
    private tab: TableTab = 'nodes'
    /**
     * Whether this pane is the one on show. A hidden grid does not rebuild: it would be
     * sorting and windowing rows nobody can see, and losing its scroll position doing it.
     * Activation always rebuilds, which is the catch-up.
     */
    private active = false
    /** Coalescing frame: one rebuild per frame however many events arrive. */
    private rebuildFrame: number | null = null
    /** The live handle for this pane's dock tab — how an inner switch reaches the dock. */
    private handle?: DockTabHandle
    /** Disposer from `addDockTab`. */
    private disposeTab?: () => void

    constructor(uiManager: UIManager, options: TableOptions = {}, dock?: Dock) {
        super(uiManager)
        this.options = options
        this.dock = dock
    }

    /* ---------- lifecycle ---------- */

    protected onMount() {
        // No container: the table has no slot of its own. It is **one** dock tab — one
        // pane — and `Nodes` / `Edges` are its own business, drawn as a strip in the
        // toolbar it fills. Flattening them out beside another pane's tab would say they
        // are the same kind of thing, which they are not.
        //
        // No `order`: equal orders keep registration order, and a plugin's tab —
        // registered later, since plugins install after the UI is built — lands after it.
        this.disposeTab = this.uiManager.addDockTab({
            id: DOCK_TAB_ID,
            label: 'Table',
            render: () => this.renderBody(),
            toolbar: () => this.buildToolbar(),
            onActivate: (handle) => this.activatePane(handle),
            onDeactivate: () => this.deactivatePane(),
        })
    }

    protected onAfterMount() {
        const graph = this.uiManager.graph

        // Claimed up front rather than on the first press: registering the facet is what
        // makes the filter matchable, and a facet declared late would have to re-apply a
        // filter that is already in flight.
        if (this.options.filterGraph !== false) {
            this.graphFilter = new TableGraphFilter(this.uiManager)
            this.graphFilter.claim()
        }

        // Folding the dock takes the picker's button off the bar with it, and a popover
        // left hanging over the canvas with nothing to anchor it is a papercut. The
        // chevron's own click already dismisses it as an outside click; this covers the
        // ways the dock folds without one — Shift+T, and `collapsed: 'auto'`.
        if (this.dock) {
            this.track(this.dock.onCollapsedChange((collapsed) => {
                if (collapsed) this.closePicker()
            }))
        }

        // One rebuild per frame, whatever arrives. A single user action fires several of
        // these — a filter apply emits both `filterChange` and the visibility changes it
        // caused — and rebuilding per event is both visibly janky and a good way to lose
        // the scroll position.
        const queue = () => this.queueRebuild()
        for (const event of ['dataBatchChanged', 'nodeAdd', 'nodeRemove', 'nodeChange', 'edgeAdd', 'edgeRemove', 'edgeChange'] as const) {
            graph.on(event, queue)
            this.track(() => graph.off(event, queue))
        }
        // Filtering moves values in the Visibility column without touching the data.
        for (const event of ['filterAdd', 'filterRemove', 'filterChange', 'filterReset'] as const) {
            graph.queryEngine.on(event, queue)
            this.track(() => graph.queryEngine.off(event, queue))
        }

        this.queueRebuild()
    }

    protected onGraphReady() {
        // Graph → table. Wired here rather than in afterMount because the UI is built
        // before the renderer exists (`Graph` constructs the UIManager first), so there is
        // no interaction layer to subscribe to yet at that point.
        //
        // Reads the selection wholesale on any change (see syncSelection), so a
        // rubber-band on the canvas shows up as marked rows and the first is scrolled to.
        const interaction = this.uiManager.graph.renderer?.getGraphInteraction()
        if (interaction) {
            const syncSelection = () => this.grid?.syncSelection()
            for (const event of ['selectNode', 'selectNodes', 'unselectNode', 'unselectNodes'] as const) {
                interaction.on(event, syncSelection)
                this.track(() => interaction.off(event, syncSelection))
            }
        }

        // Filters announce themselves; a cluster opening or closing does not, and it moves
        // the Visibility column for every edge that crossed its boundary. `onChange` is the
        // funnel those all pass through, so ask it — and rebuild only when a reading really
        // moved, since most of what comes through here is not about visibility at all.
        this.track(this.uiManager.graph.onVisibleChange(() => {
            if (this.grid?.visibilityMoved()) this.queueRebuild()
        }))

        this.queueRebuild()
    }

    /** Schedule a rebuild for the next frame, collapsing any already pending. */
    private queueRebuild(): void {
        // Nothing to catch up on that activation won't do: a hidden grid rebuilds when it
        // comes back, and until then the work is invisible either way.
        if (!this.active) return
        if (this.rebuildFrame !== null) return
        this.rebuildFrame = requestAnimationFrame(() => {
            this.rebuildFrame = null
            this.grid?.rebuild()
            // Between the rebuild and the summary: the button's state is read off the
            // freshly resolved rows, and it is what tells the grid how many elements the
            // push is hiding — which the summary then reports.
            this.refreshApplyButton()
            this.grid?.updateSummary()
            if (this.picker) this.renderPicker()
        })
    }

    /* ---------- the pane, and its own tabs ---------- */

    /** The inner tabs on offer. A single one renders no strip — nothing to switch. */
    private tabsOffered(): TableTab[] {
        return this.options.tabs ?? ['nodes', 'edges']
    }

    /**
     * The pane's body: the current inner tab's grid root. Each inner tab gets a grid of
     * its own so its sort, its column choices and its row filters are its own —
     * switching to Edges and back should not have quietly rearranged the node table.
     *
     * Returned **bare**, with no wrapper: `TableGrid` measures its scroller as
     * `root.parentElement`, so the grid has to stay a direct child of the dock's body or
     * windowing silently measures the wrong element.
     */
    private renderBody(): HTMLElement {
        return this.gridFor(this.tab).getRoot()
    }

    private gridFor(tab: TableTab): TableGrid {
        const existing = this.grids.get(tab)
        if (existing) return existing

        const grid = new TableGrid(this.uiManager, tab, this.options.sort, this.options.rowActivate, this.options.virtualizeAbove)
        // Editing a column filter changes what a press would hide, so the button follows
        // the keystroke. Nothing else would tell us: a row-filter change re-renders the
        // rows only, deliberately leaving the header (and this) standing.
        grid.onRowFiltersChange(() => this.refreshApplyButton())
        this.grids.set(tab, grid)
        return grid
    }

    /**
     * Switch inner tab. The dock is holding the element `render` handed it, so the swap
     * has to go through `refresh` rather than being done behind its back — otherwise the
     * dock re-attaches a stale grid on its next activation.
     */
    private showTab(tab: TableTab): void {
        if (this.tab === tab) return
        this.tab = tab
        this.grid = this.gridFor(tab)
        this.closePicker()
        // Rebuilds the body *and* the toolbar, so the strip below comes back marking the
        // view we just moved to — and `summary` is a fresh element by the time we bind it.
        this.handle?.refresh()
        this.grid.setSummaryTarget(this.summary)
        this.queueRebuild()
    }

    /**
     * Take over as the visible pane. Runs after the dock has attached the body and filled
     * the toolbar, so `this.summary` is already the fresh element to bind to.
     */
    private activatePane(handle: DockTabHandle): void {
        this.handle = handle
        this.grid = this.gridFor(this.tab)
        this.grid.setSummaryTarget(this.summary)
        this.active = true
        // Unconditional, because anything could have changed while the pane was away.
        this.queueRebuild()
    }

    private deactivatePane(): void {
        this.active = false
        if (this.rebuildFrame !== null) cancelAnimationFrame(this.rebuildFrame)
        this.rebuildFrame = null
        // The picker is anchored to a button the dock is about to take off the bar, and it
        // is not one of the toolbar items the dock knows to remove.
        this.closePicker()
    }

    /**
     * The pane's own `Nodes` / `Edges` strip, in the header slot the dock gave it. These
     * are deliberately *not* dock tabs and are drawn as a segmented control rather than
     * as tabs, so the two levels of switch never read as one flat row.
     */
    private renderTabs(): void {
        const strip = this.tabs
        if (!strip) return
        const offered = this.tabsOffered()
        strip.innerHTML = ''
        if (offered.length < 2) return

        for (const tab of offered) {
            const button = document.createElement('button')
            button.type = 'button'
            button.className = 'pvt-dock-view'
            button.dataset.tab = tab
            button.textContent = tab === 'edges' ? 'Edges' : 'Nodes'
            button.classList.toggle('active', tab === this.tab)
            button.setAttribute('aria-pressed', String(tab === this.tab))
            // Direct, not tracked: rebuilt on every activation, so a tracked disposer
            // would outlive the button it refers to.
            button.addEventListener('click', () => this.showTab(tab))
            strip.appendChild(button)
        }
    }

    /**
     * The header controls for whichever tab is coming to the front. Rebuilt on every
     * activation rather than cached: they are cheap, they read the current tab, and a
     * fresh set cannot hold a stale grid reference.
     *
     * Listeners go on directly rather than through `listen`: these elements are discarded
     * on the next tab switch, and a tracked disposer would outlive them — one more entry
     * per switch, held for the life of the table.
     *
     * `Select all` carries the margin that pushes the right-hand group over, so the bar
     * reads: state · actions · settings.
     */
    private buildToolbar(): HTMLElement[] {
        const items: HTMLElement[] = []

        // The pane's own view switch leads the bar, immediately after the dock's own
        // strip — which is exactly where it has always sat.
        this.tabs = document.createElement('div')
        this.tabs.className = 'pvt-dock-views'
        items.push(this.tabs)
        this.renderTabs()

        this.summary = document.createElement('span')
        this.summary.className = 'pvt-table-summary'
        items.push(this.summary)

        const selectAll = document.createElement('button')
        selectAll.type = 'button'
        selectAll.className = 'pvt-table-selectall'
        selectAll.textContent = 'Select all'
        selectAll.title = 'Select every row currently listed'
        selectAll.addEventListener('click', () => this.grid?.selectAllListed())
        items.push(selectAll)

        // Beside `Select all`, in the bar's actions group — it acts on what the filters
        // picked out, the way that one acts on what they left listed. Starts hidden and is
        // revealed by the first refresh: the columns are not resolved yet at build time,
        // so whether there is a filter to push is not yet knowable.
        if (this.options.filterGraph !== false) {
            this.applyButton = document.createElement('button')
            this.applyButton.type = 'button'
            this.applyButton.className = 'pvt-table-apply'
            this.applyButton.hidden = true
            this.applyButton.addEventListener('click', () => this.toggleGraphFilter())
            items.push(this.applyButton)
        }

        for (const format of this.exportFormats()) {
            const button = document.createElement('button')
            button.type = 'button'
            button.className = 'pvt-table-export'
            button.dataset.format = format
            button.textContent = format.toUpperCase()
            button.title = `Export the rows and columns currently shown as ${format.toUpperCase()}`
            button.addEventListener('click', () => this.exportAs(format))
            items.push(button)
        }

        this.pickerButton = document.createElement('button')
        this.pickerButton.type = 'button'
        this.pickerButton.className = 'pvt-table-columns-button'
        this.pickerButton.innerHTML = `${sliderTune}<span>Columns</span>`
        this.pickerButton.title = 'Choose which columns to show'
        this.pickerButton.addEventListener('click', () => this.togglePicker())
        items.push(this.pickerButton)

        return items
    }

    /* ---------- export ---------- */

    private exportFormats(): TableExportFormat[] {
        if (this.options.export === false) return []
        return this.options.export ?? ['csv', 'json']
    }

    private exportAs(format: TableExportFormat): void {
        const grid = this.grid
        if (!grid) return

        const columns = grid.getVisibleColumns()
        const rows = grid.getVisibleRows()
        const stem = `${this.uiManager.graph.getAppID()}-${this.tab}`

        const started = format === 'csv'
            ? downloadText(`${stem}.csv`, 'text/csv', toCsv(columns, rows))
            : downloadText(`${stem}.json`, 'application/json', toJson(columns, rows))

        // A sandboxed page (the docs gallery embeds examples in iframes) can block the
        // download outright. Say so rather than leaving a button that does nothing.
        if (!started) {
            this.uiManager.graph.notifier?.warning(
                'Export blocked',
                'This page will not let the file download. Try the example outside its frame.',
            )
        }
    }

    /* ---------- the push to the graph ---------- */

    /**
     * Whether a press would clear rather than push: either the push already says what the
     * filters say, or the filters have been emptied and the push is all that is left.
     */
    private pressClears(pushed: string[] | undefined, target: string[]): boolean {
        return pushed !== undefined && (target.length === 0 || sameIdSet(pushed, target))
    }

    /**
     * Reflect the push's state onto the button, and tell the grid how much it is hiding.
     *
     * Three states in one control: nothing pushed reads `Apply to graph`; a push that
     * still agrees with the filters reads `Clear`; a push the filters have moved past
     * reads `Apply to graph` again while staying lit — so the accent says the graph is
     * filtered by this table and the label says what a press would do.
     *
     * The pushed ids are read back off the engine every time rather than remembered here,
     * which is what makes a `resetFilters()` from anywhere un-light the button.
     */
    private refreshApplyButton(): void {
        const button = this.applyButton
        const grid = this.grid
        if (!button || !grid || !this.graphFilter) return

        const pushed = this.graphFilter.pushed(this.tab)
        const target = grid.graphFilterIds()
        const clears = this.pressClears(pushed, target)
        const noun = this.tab === 'edges' ? 'relations' : 'nodes'

        button.hidden = !grid.hasFilterableColumns()
        grid.setGraphFilterCount(pushed?.length ?? 0)
        button.classList.toggle('active', pushed !== undefined)
        button.disabled = !clears && target.length === 0

        // Only when the action itself moved: this runs on every rebuild, and re-parsing
        // the icon each time would churn the DOM for nothing.
        const action = clears ? 'clear' : 'push'
        if (button.dataset.action !== action) {
            button.dataset.action = action
            button.innerHTML = clears
                ? `${funnelClear}<span>Clear</span>`
                : `${funnel}<span>Apply to graph</span>`
        }

        button.title = clears
            ? `Stop filtering the graph from this table — ${pushed?.length ?? 0} ${noun} hidden`
            : button.disabled
                ? 'Narrow a column first, then apply it to the graph'
                : `Hide the ${target.length} ${noun} the column filters leave out`
    }

    /** Push the current column filters onto the graph, or clear a push already on it. */
    private toggleGraphFilter(): void {
        const grid = this.grid
        if (!grid || !this.graphFilter) return

        const target = grid.graphFilterIds()
        if (this.pressClears(this.graphFilter.pushed(this.tab), target)) {
            this.graphFilter.clear(this.tab)
        } else {
            this.graphFilter.push(this.tab, target)
        }
        // The write emits `filterChange`, which queues the rebuild that repaints the rows
        // and the summary. The button is refreshed here so the press reads as immediate.
        this.refreshApplyButton()
    }

    /* ---------- the column picker ---------- */

    private togglePicker(): void {
        if (this.picker) return this.closePicker()

        this.picker = document.createElement('div')
        this.picker.className = 'pvt-table-columns-picker'
        this.pickerButton?.classList.add('active')
        // Beside its own button — which is in the dock's toolbar slot, so the popover
        // stays inside `.pivotick` and inherits its theme. It is `position: fixed` and
        // anchored in viewport coordinates, so the parent is about scoping, not layout.
        this.pickerButton?.parentElement?.appendChild(this.picker)
        this.renderPicker()
        this.positionPicker()

        // Clicking anywhere else, or Escape, puts it away — a popover that only its own
        // button can close is a papercut.
        this.dismissPicker = (event: Event) => {
            if (event instanceof KeyboardEvent && event.key !== 'Escape') return
            const target = event.target as globalThis.Node | null
            if (event.type === 'pointerdown' && target
                && (this.picker?.contains(target) || this.pickerButton?.contains(target))) return
            this.closePicker()
        }
        // Capture, so a click reaches this before anything stops it propagating.
        document.addEventListener('pointerdown', this.dismissPicker, true)
        document.addEventListener('keydown', this.dismissPicker, true)
    }

    private closePicker(): void {
        if (this.dismissPicker) {
            document.removeEventListener('pointerdown', this.dismissPicker, true)
            document.removeEventListener('keydown', this.dismissPicker, true)
            this.dismissPicker = undefined
        }
        this.picker?.remove()
        this.picker = undefined
        this.pickerButton?.classList.remove('active')
    }

    /**
     * Anchor the picker to its button in viewport coordinates, opening **upwards**: the
     * dock lives at the bottom of the layout, so there is room above it and none below.
     * Height is capped to the room actually available.
     */
    private positionPicker(): void {
        const picker = this.picker
        const anchor = this.pickerButton?.getBoundingClientRect()
        if (!picker || !anchor) return

        const gap = 4
        picker.style.bottom = `${Math.max(0, window.innerHeight - anchor.top + gap)}px`
        picker.style.right = `${Math.max(0, window.innerWidth - anchor.right)}px`
        picker.style.maxHeight = `${Math.max(80, anchor.top - gap * 3)}px`
    }

    /**
     * One checkbox per column. Every column is listed, including the ones switched off —
     * the table shows everything by default, so on property-heavy data this is how you
     * get a grid you can read rather than one you have to scroll sideways through.
     */
    private renderPicker(): void {
        const picker = this.picker
        const grid = this.grid
        if (!picker || !grid) return

        picker.innerHTML = ''
        for (const column of grid.getAllColumns()) {
            const row = document.createElement('label')
            row.className = 'pvt-table-columns-row'

            const checkbox = document.createElement('input')
            checkbox.type = 'checkbox'
            checkbox.checked = !grid.isColumnHidden(column.key)
            checkbox.addEventListener('change', () => {
                grid.setColumnHidden(column.key, !checkbox.checked)
                grid.updateSummary()
            })

            const text = document.createElement('span')
            text.textContent = column.label ?? column.key

            row.append(checkbox, text)
            picker.appendChild(row)
        }
    }

    protected onDestroy() {
        this.closePicker()
        // Before anything else: a filter left behind would go on hiding nodes with no
        // control left anywhere to clear it.
        this.graphFilter?.release()
        this.graphFilter = undefined
        if (this.rebuildFrame !== null) cancelAnimationFrame(this.rebuildFrame)
        this.rebuildFrame = null
        this.active = false
        // Unregistering takes the pane's body out of the dock with it, so the grid root is
        // already detached by the time it is disposed.
        this.disposeTab?.()
        this.disposeTab = undefined
        this.handle = undefined
        for (const grid of this.grids.values()) {
            grid.getRoot().remove()
            grid.dispose()
        }
        this.grids.clear()
        this.tabs = undefined
        this.summary = undefined
        this.applyButton = undefined
        this.pickerButton = undefined
        this.picker = undefined
        this.grid = undefined
    }

    /** The grid, for anything that needs its rows (export, selection sync). */
    public getGrid(): TableGrid | undefined {
        return this.grid
    }

    /** The dock-tab id this pane is registered under — what `Graph.openTable()` activates. */
    public dockTabId(): string {
        return DOCK_TAB_ID
    }
}
