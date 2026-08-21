import { UIComponent } from '../../UIComponent'
import type { UIManager } from '../../UIManager'
import type { TableExportFormat, TableOptions, TableTab } from '../../../interfaces/GraphUI'
import { TableGrid } from './TableGrid'
import { downloadText, toCsv, toJson } from './TableExport'
import { sliderTune } from '../../icons'
import './table.scss'

/**
 * How much canvas the dock must leave behind, in px. Below this the graph stops
 * being a graph — and a canvas that reaches zero height would make the physics
 * divide by zero (see `Simulation.measureContainer`), so this is a correctness
 * floor as much as a usability one.
 */
const MIN_CANVAS_HEIGHT = 200

/** The dock never shrinks below its header bar plus one usable row. */
const MIN_DOCK_HEIGHT = 120

/** Fraction of the canvas the dock opens to when nothing else is asked for. */
const DEFAULT_HEIGHT_RATIO = 0.35

/**
 * `collapsed: 'auto'` thresholds, as a multiple of {@link MIN_DOCK_HEIGHT}: the dock
 * stays expanded while the layout can spare that much room *and* the canvas floor, and
 * folds away below the lower figure. Two thresholds rather than one so a layout sitting
 * on the boundary — or being dragged across it — doesn't flap the dock open and shut.
 */
const EXPAND_ROOM_RATIO = 2.4
const COLLAPSE_ROOM_RATIO = 2.1

/** Chevron that flips to read as both "fold this away" and "bring it back". */
const COLLAPSE_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" d="M2.5 7.5L6 4l3.5 3.5"/></svg>'

/**
 * The data dock: the graph's rows, split off the bottom of the canvas.
 *
 * This is the shell — the grid row, the resize divider, the collapse toggle and the
 * header bar. The rows, columns and export controls fill it in.
 *
 * It is deliberately **read-only**: it reflects the graph and drives the selection, and
 * never changes what the graph displays. Hiding and pinning stay with the sidebar's bulk
 * actions; restoring a hidden node stays with the filter panel. What the dock offers is a
 * better instrument for *building* the selection those act on.
 */
export class Table extends UIComponent {
    private readonly options: TableOptions

    private root?: HTMLDivElement
    private divider?: HTMLDivElement
    private header?: HTMLDivElement
    private body?: HTMLDivElement
    private toggle?: HTMLButtonElement
    private summary?: HTMLSpanElement
    private pickerButton?: HTMLButtonElement
    private selectAllButton?: HTMLButtonElement
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

    private open: boolean
    private collapsed: boolean
    /** Whether the collapsed state follows the available room (`collapsed: 'auto'`). */
    private readonly autoCollapse: boolean
    /** Latched by the first explicit collapse/expand, which ends {@link autoCollapse}. */
    private userChose = false

    /** Expanded height in px, resolved from `options.height` once the layout is measured. */
    private height: number | null = null
    private observer?: ResizeObserver
    /** Pointer id held for the duration of a divider drag. */
    private dragPointer: number | null = null

    constructor(uiManager: UIManager, options: TableOptions = {}) {
        super(uiManager)
        this.options = options
        // Three states, because the collapsed bar is now the affordance that opens the
        // dock — so it has to be on screen by default, or nothing points at it:
        //   `open: false` → not present at all (the zero-footprint opt-out)
        //   `open: true`  → present and expanded
        //   unset         → present, folded to its bar
        this.open = options.open !== false
        const startFolded = options.open === undefined
        // Deliberately folded, so there is no room question to answer yet; the first
        // expand latches `userChose` and takes over from here anyway.
        this.autoCollapse = !startFolded && (options.collapsed === undefined || options.collapsed === 'auto')
        this.collapsed = startFolded || options.collapsed === true
    }

    /* ---------- lifecycle ---------- */

    protected onMount(container?: HTMLElement) {
        if (!container) return

        this.root = document.createElement('div')
        this.root.className = 'pvt-table'

        this.divider = document.createElement('div')
        this.divider.className = 'pvt-table-divider'
        this.divider.setAttribute('role', 'separator')
        this.divider.setAttribute('aria-orientation', 'horizontal')
        this.divider.setAttribute('aria-label', 'Resize the table')
        this.root.appendChild(this.divider)

        this.header = document.createElement('div')
        this.header.className = 'pvt-table-header'
        this.root.appendChild(this.header)

        this.toggle = document.createElement('button')
        this.toggle.type = 'button'
        this.toggle.className = 'pvt-table-toggle'
        this.toggle.innerHTML = COLLAPSE_ICON
        this.listen(this.toggle, 'click', () => {
            this.userChose = true
            this.setCollapsed(!this.collapsed)
        })
        this.header.appendChild(this.toggle)

        this.tabs = document.createElement('div')
        this.tabs.className = 'pvt-table-tabs'
        this.header.appendChild(this.tabs)

        this.summary = document.createElement('span')
        this.summary.className = 'pvt-table-summary'
        this.header.appendChild(this.summary)

        this.pickerButton = document.createElement('button')
        this.pickerButton.type = 'button'
        this.pickerButton.className = 'pvt-table-columns-button'
        this.pickerButton.innerHTML = `${sliderTune}<span>Columns</span>`
        this.pickerButton.title = 'Choose which columns to show'
        this.listen(this.pickerButton, 'click', () => this.togglePicker())
        this.header.appendChild(this.pickerButton)

        this.body = document.createElement('div')
        this.body.className = 'pvt-table-body'
        this.root.appendChild(this.body)

        this.selectAllButton = document.createElement('button')
        this.selectAllButton.type = 'button'
        this.selectAllButton.className = 'pvt-table-selectall'
        this.selectAllButton.textContent = 'Select all'
        this.selectAllButton.title = 'Select every row currently listed'
        this.listen(this.selectAllButton, 'click', () => this.grid?.selectAllListed())
        // Left of the column picker, so the header reads: state · actions · settings.
        this.header.insertBefore(this.selectAllButton, this.pickerButton)

        for (const format of this.exportFormats()) {
            const button = document.createElement('button')
            button.type = 'button'
            button.className = 'pvt-table-export'
            button.dataset.format = format
            button.textContent = format.toUpperCase()
            button.title = `Export the rows and columns currently shown as ${format.toUpperCase()}`
            this.listen(button, 'click', () => this.exportAs(format))
            this.header.insertBefore(button, this.pickerButton)
        }

        this.buildGrid('nodes')

        container.appendChild(this.root)

        this.wireDivider()
        this.observeRoom()
        this.apply()
    }

    protected onAfterMount() {
        const graph = this.uiManager.graph

        // The dock's own shortcut, alongside Shift+J/K/N. It lives here rather than on a
        // header pill: collapsed, the dock already shows a chevron, so a second control
        // in the top bar was pointing at something that was pointing at itself.
        // One meaning: show the table's content, or fold it away again.
        this.track(this.uiManager.keyManager.register({
            key: 'Shift+T',
            callback: () => {
                this.userChose = true
                const wasShowingContent = this.open && !this.collapsed
                if (!this.open) this.setOpen(true)
                this.setCollapsed(wasShowingContent)
            },
        }))

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
        if (!this.body) return
        this.tab = tab
        this.body.innerHTML = ''

        const grid = this.grids.get(tab) ?? new TableGrid(this.uiManager, tab, this.options.sort, this.options.rowActivate, this.options.virtualizeAbove)
        this.grids.set(tab, grid)
        this.grid = grid
        grid.setSummaryTarget(this.summary)
        this.body.appendChild(grid.getRoot())

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
        this.root?.appendChild(this.picker)
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
     * the dock shows everything by default, so on property-heavy data this is how you get
     * a table you can read rather than one you have to scroll sideways through.
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
        this.observer?.disconnect()
        this.observer = undefined
        // Give the grid row back before losing the handle that can find it.
        this.writeHeight(0)
        this.root?.remove()
        this.root = undefined
        this.divider = undefined
        this.header = undefined
        this.body = undefined
        this.toggle = undefined
        this.summary = undefined
        this.pickerButton = undefined
        this.selectAllButton = undefined
        this.picker = undefined
        this.tabs = undefined
        this.grid = undefined
        for (const grid of this.grids.values()) grid.dispose()
        this.grids.clear()
    }

    /** The grid, for anything that needs its rows (export, selection sync). */
    public getGrid(): TableGrid | undefined {
        return this.grid
    }

    /* ---------- open / collapse ---------- */

    /** Whether the dock is showing at all (collapsed still counts as open). */
    public isOpen(): boolean {
        return this.open
    }

    public isCollapsed(): boolean {
        return this.collapsed
    }

    public setOpen(open: boolean): void {
        if (this.open === open) return
        this.open = open
        // Opening onto a cramped layout should still fold rather than squeeze the canvas.
        if (open && this.autoCollapse && !this.userChose) this.collapsed = !this.hasRoom(EXPAND_ROOM_RATIO)
        this.apply()
    }

    public toggleOpen(): void {
        this.setOpen(!this.open)
    }

    public setCollapsed(collapsed: boolean): void {
        if (this.collapsed === collapsed) return
        this.collapsed = collapsed
        this.apply()
    }

    /** The element rows go into. */
    public getBody(): HTMLElement | undefined {
        return this.body
    }

    /** The element tabs, the column picker and the export buttons go into. */
    public getHeader(): HTMLElement | undefined {
        return this.header
    }

    /* ---------- geometry ---------- */

    /**
     * Push the current state into the layout. One custom property drives the grid row,
     * so opening, collapsing and resizing are all the same operation.
     */
    private apply(): void {
        this.root?.classList.toggle('pvt-table-collapsed', this.collapsed)
        this.root?.classList.toggle('pvt-table-open', this.open)
        this.toggle?.setAttribute('aria-expanded', String(!this.collapsed))
        this.toggle?.setAttribute('title', this.collapsed ? 'Expand the table' : 'Collapse the table')

        if (!this.open) return this.writeHeight(0)
        if (this.collapsed) return this.writeHeight(this.headerHeight())
        this.writeHeight(this.clampHeight(this.height ?? this.preferredHeight()))
    }

    private writeHeight(px: number): void {
        this.layoutRoot()?.style.setProperty('--pvt-table-height', `${px}px`)
    }

    private layoutRoot(): HTMLElement | null {
        return this.root?.closest('.pvt-layout') as HTMLElement | null
    }

    /** Total height the canvas and the dock share. */
    private availableHeight(): number {
        return this.layoutRoot()?.getBoundingClientRect().height ?? 0
    }

    private headerHeight(): number {
        const measured = this.header?.getBoundingClientRect().height ?? 0
        // Pre-layout the header measures 0; fall back to its CSS height so a collapsed
        // dock still shows its bar on the very first frame.
        return measured > 0 ? measured : 34
    }

    /** `options.height` resolved: a fraction of the shared height, or a pixel count. */
    private preferredHeight(): number {
        const wanted = this.options.height ?? DEFAULT_HEIGHT_RATIO
        return wanted > 0 && wanted <= 1 ? this.availableHeight() * wanted : wanted
    }

    /**
     * Keep the dock between its own minimum and whatever leaves the canvas its floor.
     * On a layout too short for both, the canvas wins — it is the one that breaks.
     */
    private clampHeight(px: number): number {
        const ceiling = this.availableHeight() - MIN_CANVAS_HEIGHT
        if (ceiling <= MIN_DOCK_HEIGHT) return Math.max(0, Math.min(px, Math.max(ceiling, 0)))
        return Math.min(Math.max(px, MIN_DOCK_HEIGHT), ceiling)
    }

    /** Whether the layout can spare `ratio` docks' worth of room on top of the canvas floor. */
    private hasRoom(ratio: number): boolean {
        const available = this.availableHeight()
        // Pre-layout (0×0) is not a verdict — the observer will ask again with a real size.
        if (available === 0) return true
        return available - MIN_CANVAS_HEIGHT >= MIN_DOCK_HEIGHT * ratio
    }

    /**
     * Follow the available room while the collapsed state is still ours to choose. Two
     * thresholds, so a layout hovering on the boundary doesn't flap.
     */
    private observeRoom(): void {
        const layout = this.layoutRoot()
        if (!layout || typeof ResizeObserver === 'undefined') return

        this.observer = new ResizeObserver(() => {
            if (this.autoCollapse && !this.userChose && this.open) {
                if (!this.collapsed && !this.hasRoom(COLLAPSE_ROOM_RATIO)) return this.setCollapsed(true)
                if (this.collapsed && this.hasRoom(EXPAND_ROOM_RATIO)) return this.setCollapsed(false)
            }
            // A shorter layout can invalidate the height even when the state is unchanged.
            if (this.open && !this.collapsed) this.apply()
        })
        this.observer.observe(layout)
    }

    /* ---------- the divider ---------- */

    private wireDivider(): void {
        const divider = this.divider
        if (!divider) return

        this.listen(divider, 'pointerdown', (event) => {
            const pointer = event as PointerEvent
            // Dragging the divider is an explicit choice about the dock's size, so it
            // ends auto-management the same way clicking the toggle does.
            this.userChose = true
            if (this.collapsed) this.setCollapsed(false)
            this.dragPointer = pointer.pointerId
            divider.setPointerCapture(pointer.pointerId)
            divider.classList.add('pvt-table-divider-dragging')
            pointer.preventDefault()
        })

        this.listen(divider, 'pointermove', (event) => {
            const pointer = event as PointerEvent
            if (this.dragPointer !== pointer.pointerId) return
            const bottom = this.layoutRoot()?.getBoundingClientRect().bottom ?? 0
            this.height = this.clampHeight(bottom - pointer.clientY)
            this.writeHeight(this.height)
        })

        const end = (event: Event) => {
            const pointer = event as PointerEvent
            if (this.dragPointer !== pointer.pointerId) return
            divider.releasePointerCapture(pointer.pointerId)
            divider.classList.remove('pvt-table-divider-dragging')
            this.dragPointer = null
        }
        this.listen(divider, 'pointerup', end)
        this.listen(divider, 'pointercancel', end)
    }
}
