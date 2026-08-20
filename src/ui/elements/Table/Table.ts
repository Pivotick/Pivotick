import { UIComponent } from '../../UIComponent'
import type { UIManager } from '../../UIManager'
import type { TableOptions } from '../../../interfaces/GraphUI'
import { TableGrid } from './TableGrid'
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
    private picker?: HTMLDivElement
    private grid?: TableGrid
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
        this.open = options.open === true
        this.autoCollapse = options.collapsed === undefined || options.collapsed === 'auto'
        this.collapsed = options.collapsed === true
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

        this.grid = new TableGrid(this.uiManager, 'nodes', this.options.sort)
        this.grid.setSummaryTarget(this.summary)
        this.body.appendChild(this.grid.getRoot())

        container.appendChild(this.root)

        this.wireDivider()
        this.observeRoom()
        this.apply()
    }

    protected onAfterMount() {
        const graph = this.uiManager.graph

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

    /* ---------- the column picker ---------- */

    private togglePicker(): void {
        if (this.picker) {
            this.picker.remove()
            this.picker = undefined
            this.pickerButton?.classList.remove('active')
            return
        }
        this.picker = document.createElement('div')
        this.picker.className = 'pvt-table-columns-picker'
        this.pickerButton?.classList.add('active')
        this.header?.appendChild(this.picker)
        this.renderPicker()
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
        this.picker = undefined
        this.grid = undefined
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
