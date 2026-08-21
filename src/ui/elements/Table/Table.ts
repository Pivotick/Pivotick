import { UIComponent } from '../../UIComponent'
import type { UIManager } from '../../UIManager'
import type { TableExportFormat, TableOptions, TableTab } from '../../../interfaces/GraphUI'
import type { Dock } from '../Dock/Dock'
import { TableGrid } from './TableGrid'
import { downloadText, toCsv, toJson } from './TableExport'
import { sliderTune } from '../../icons'
import './table.scss'

/**
 * The graph's rows, as a sortable, selectable grid — the {@link Dock}'s one occupant.
 *
 * The table owns its content and its controls: the Nodes / Edges strip, the row summary,
 * `Select all`, the exports and the column picker all go into the dock's toolbar slot,
 * and the grid itself into the dock's content host. The region around them — the row's
 * height, the divider, the fold — is the dock's, and this class never touches it.
 *
 * It is deliberately **read-only**: it reflects the graph and drives the selection, and
 * never changes what the graph displays. Hiding and pinning stay with the sidebar's bulk
 * actions; restoring a hidden node stays with the filter panel. What the table offers is
 * a better instrument for *building* the selection those act on.
 */
export class Table extends UIComponent {
    private readonly options: TableOptions
    private readonly dock?: Dock

    /** The dock's content host — the grid's parent, and its scroll container. */
    private host?: HTMLElement
    /** The dock's toolbar slot, which this table is the only one filling. */
    private toolbar?: HTMLElement
    /** What we put in that slot, so it can all be taken back out again. */
    private readonly toolbarItems: HTMLElement[] = []

    private summary?: HTMLSpanElement
    private pickerButton?: HTMLButtonElement
    private picker?: HTMLDivElement
    /** Outside-click / Escape handler, live only while the picker is open. */
    private dismissPicker?: (event: Event) => void
    private tabs?: HTMLDivElement
    private grid?: TableGrid
    /** One grid per tab, so each keeps its own sort, columns and row filters. */
    private readonly grids = new Map<TableTab, TableGrid>()
    private tab: TableTab = 'nodes'
    /** Coalescing frame: one rebuild per frame however many events arrive. */
    private rebuildFrame: number | null = null

    constructor(uiManager: UIManager, options: TableOptions = {}, dock?: Dock) {
        super(uiManager)
        this.options = options
        this.dock = dock
    }

    /* ---------- lifecycle ---------- */

    protected onMount(container?: HTMLElement) {
        const toolbar = this.dock?.toolbarSlot()
        if (!container || !toolbar) return

        this.host = container
        this.toolbar = toolbar

        this.tabs = this.addToToolbar(document.createElement('div'))
        this.tabs.className = 'pvt-table-tabs'

        this.summary = this.addToToolbar(document.createElement('span'))
        this.summary.className = 'pvt-table-summary'

        // `Select all` carries the margin that pushes the right-hand group over, so the
        // bar reads: state · actions · settings.
        const selectAll = this.addToToolbar(document.createElement('button'))
        selectAll.type = 'button'
        selectAll.className = 'pvt-table-selectall'
        selectAll.textContent = 'Select all'
        selectAll.title = 'Select every row currently listed'
        this.listen(selectAll, 'click', () => this.grid?.selectAllListed())

        for (const format of this.exportFormats()) {
            const button = this.addToToolbar(document.createElement('button'))
            button.type = 'button'
            button.className = 'pvt-table-export'
            button.dataset.format = format
            button.textContent = format.toUpperCase()
            button.title = `Export the rows and columns currently shown as ${format.toUpperCase()}`
            this.listen(button, 'click', () => this.exportAs(format))
        }

        this.pickerButton = this.addToToolbar(document.createElement('button'))
        this.pickerButton.type = 'button'
        this.pickerButton.className = 'pvt-table-columns-button'
        this.pickerButton.innerHTML = `${sliderTune}<span>Columns</span>`
        this.pickerButton.title = 'Choose which columns to show'
        this.listen(this.pickerButton, 'click', () => this.togglePicker())

        this.buildGrid('nodes')
    }

    protected onAfterMount() {
        const graph = this.uiManager.graph

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

        this.queueRebuild()
    }

    /** Add a control to the dock's toolbar slot, remembering it for teardown. */
    private addToToolbar<T extends HTMLElement>(element: T): T {
        this.toolbar?.appendChild(element)
        this.toolbarItems.push(element)
        return element
    }

    /** Schedule a rebuild for the next frame, collapsing any already pending. */
    private queueRebuild(): void {
        if (this.rebuildFrame !== null) return
        this.rebuildFrame = requestAnimationFrame(() => {
            this.rebuildFrame = null
            this.grid?.rebuild()
            this.grid?.updateSummary()
            if (this.picker) this.renderPicker()
        })
    }

    /* ---------- tabs ---------- */

    /** The tabs on offer. A single tab renders no strip — there is nothing to switch. */
    private tabsOffered(): TableTab[] {
        return this.options.tabs ?? ['nodes', 'edges']
    }

    /**
     * Swap the grid for another tab's. Each tab gets a fresh grid so its sort, its column
     * choices and its row filters are its own — switching to Edges and back should not
     * have quietly rearranged the node table.
     */
    private buildGrid(tab: TableTab): void {
        if (!this.host) return
        this.tab = tab
        // The grid has to stay a *direct* child of the host: that is the scroll container
        // it windows its rows against.
        this.grid?.getRoot().remove()

        const grid = this.grids.get(tab) ?? new TableGrid(this.uiManager, tab, this.options.sort, this.options.rowActivate, this.options.virtualizeAbove)
        this.grids.set(tab, grid)
        this.grid = grid
        grid.setSummaryTarget(this.summary)
        this.host.appendChild(grid.getRoot())

        this.renderTabs()
        this.queueRebuild()
    }

    private renderTabs(): void {
        const strip = this.tabs
        if (!strip) return
        const offered = this.tabsOffered()
        strip.innerHTML = ''
        if (offered.length < 2) return

        for (const tab of offered) {
            const button = document.createElement('button')
            button.type = 'button'
            button.className = 'pvt-table-tab'
            button.dataset.tab = tab
            button.textContent = tab === 'edges' ? 'Edges' : 'Nodes'
            button.classList.toggle('active', tab === this.tab)
            button.setAttribute('aria-pressed', String(tab === this.tab))
            this.listen(button, 'click', () => {
                if (this.tab !== tab) this.buildGrid(tab)
            })
            strip.appendChild(button)
        }
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

    /* ---------- the column picker ---------- */

    private togglePicker(): void {
        if (this.picker) return this.closePicker()

        this.picker = document.createElement('div')
        this.picker.className = 'pvt-table-columns-picker'
        this.pickerButton?.classList.add('active')
        this.toolbar?.appendChild(this.picker)
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
        if (this.rebuildFrame !== null) cancelAnimationFrame(this.rebuildFrame)
        this.rebuildFrame = null
        // Hand the dock's slots back the way we found them.
        for (const item of this.toolbarItems) item.remove()
        this.toolbarItems.length = 0
        for (const grid of this.grids.values()) {
            grid.getRoot().remove()
            grid.dispose()
        }
        this.grids.clear()
        this.host = undefined
        this.toolbar = undefined
        this.summary = undefined
        this.pickerButton = undefined
        this.picker = undefined
        this.tabs = undefined
        this.grid = undefined
    }

    /** The grid, for anything that needs its rows (export, selection sync). */
    public getGrid(): TableGrid | undefined {
        return this.grid
    }
}
