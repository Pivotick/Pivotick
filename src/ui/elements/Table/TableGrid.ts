import type { Edge } from '../../../Edge'
import type { Node } from '../../../Node'
import type { TableColumn, TableSortDirection, TableTab } from '../../../interfaces/GraphUI'
import type { UIManager } from '../../UIManager'
import { LABEL_COLUMN_KEY, VISIBILITY_COLUMN_KEY, readCell, resolveColumns } from './TableColumns'
import { buildRowFilterControl, columnChoices, isRowFilterActive, rowFilterMatches } from './TableRowFilters'
import type { RowFilter } from './TableRowFilters'
import { arrowDown, arrowUp, dataTable } from '../../icons'

type Element = Node | Edge

/** A row's identity and its resolved cell values, computed once per rebuild. */
interface Row {
    id: string
    element: Element
    /** Raw values, by column key — sorted, filtered and exported from these. */
    values: Map<string, unknown>
}

interface SortState {
    key: string
    direction: TableSortDirection
}

/**
 * The grid inside the data dock: a header row that sorts and narrows, and one row per
 * element.
 *
 * Two things are deliberately separate here, because conflating them is the trap:
 *
 * - **The graph's filter** decides what the canvas shows. It belongs to the filter panel,
 *   and this grid never touches it. Hidden elements are still listed, with the
 *   `Visibility` column saying why.
 * - **This grid's filter** decides which rows you are *reading*. It never touches the
 *   canvas.
 *
 * So the two can disagree without either being wrong, and the `Visibility` column keeps
 * reporting the truth alongside whatever you have narrowed to.
 */
export class TableGrid {
    /**
     * Every row is exactly this tall, in px. Windowed rows are positioned arithmetically
     * from it, so it has to agree with `--pvt-table-row-height` in table.scss.
     */
    private static readonly ROW_HEIGHT = 24
    /** Rows drawn beyond each edge of the viewport, so a fast scroll shows no gap. */
    private static readonly OVERSCAN = 6

    private readonly uiManager: UIManager
    private readonly tab: TableTab
    private readonly root: HTMLDivElement

    private columns: TableColumn<Element>[] = []
    /** Column keys the picker has switched off. */
    private readonly hiddenColumns = new Set<string>()
    /** Per-column row filters, by column key. Unset means "no filter". */
    private readonly rowFilters = new Map<string, RowFilter>()
    /** Elements this tab's push is hiding on the canvas — `0` when nothing is pushed. */
    private graphFilterCount = 0
    private sort: SortState | null = null

    private rows: Row[] = []
    private visible: Row[] = []
    /** Anchor for a shift-click range, as an index into {@link visible}. */
    private lastClickedIndex: number | null = null
    /** What a row click does, from `UI.table.rowActivate`. */
    private readonly rowActivate: 'select' | 'selectAndCenter' | 'none'
    /** Row count above which rows are windowed rather than all rendered. */
    private readonly virtualizeAbove: number
    private scrollHandler?: () => void
    private windowStart = -1
    private windowEnd = -1

    private head?: HTMLDivElement
    private bodyRows?: HTMLDivElement
    private summary?: HTMLSpanElement
    /** Told when a header filter changes, so the table can refresh its push button. */
    private rowFiltersChanged?: () => void

    constructor(
        uiManager: UIManager,
        tab: TableTab,
        initialSort?: SortState,
        rowActivate: 'select' | 'selectAndCenter' | 'none' = 'select',
        virtualizeAbove = 200,
    ) {
        this.uiManager = uiManager
        this.tab = tab
        this.root = document.createElement('div')
        this.root.className = 'pvt-table-grid'
        this.sort = initialSort ?? null
        this.rowActivate = rowActivate
        this.virtualizeAbove = virtualizeAbove
    }

    public getRoot(): HTMLElement {
        return this.root
    }

    /**
     * Listen for header-filter changes. A row filter re-renders the rows only, leaving the
     * header standing, so nothing else announces that what a push would hide has moved.
     */
    public onRowFiltersChange(listener: () => void): void {
        this.rowFiltersChanged = listener
    }

    /** Rows currently listed, in the order they are shown. Export reads this. */
    public getVisibleRows(): Array<{ element: Element, values: Map<string, unknown> }> {
        return this.visible
    }

    /** Columns currently shown, in order. */
    public getVisibleColumns(): TableColumn<Element>[] {
        return this.columns.filter((column) => !this.hiddenColumns.has(column.key))
    }

    /** Every column, shown or not — what the picker lists. */
    public getAllColumns(): TableColumn<Element>[] {
        return this.columns
    }

    public isColumnHidden(key: string): boolean {
        return this.hiddenColumns.has(key)
    }

    public setColumnHidden(key: string, hidden: boolean): void {
        if (hidden) this.hiddenColumns.add(key)
        else this.hiddenColumns.delete(key)
        this.render()
    }

    /**
     * Re-resolve columns and rows from the graph, then redraw.
     *
     * Columns are resolved once per rebuild rather than per row: the scan behind the
     * derived tier walks every element, so doing it per row would be quadratic.
     */
    public rebuild(): void {
        this.columns = resolveColumns(this.uiManager, this.tab)
        for (const column of this.columns) {
            if (column.hidden) this.hiddenColumns.add(column.key)
        }
        if (!this.sort) {
            // Prefer the name. Visibility leads the columns but sorting by it on open is
            // useless — every row reads `visible` until something is hidden.
            const preferred = this.columns.find((column) => column.key === LABEL_COLUMN_KEY && column.sortable !== false)
                ?? this.columns.find((column) => column.sortable !== false)
            if (preferred) this.sort = { key: preferred.key, direction: 'asc' }
        }

        this.rows = this.collectElements().map((element) => ({
            id: element.id,
            element,
            values: new Map(this.columns.map((column) => [column.key, safeRead(column, element)])),
        }))

        this.render()
    }

    private collectElements(): Element[] {
        const graph = this.uiManager.graph
        if (this.tab === 'edges') return graph.getMutableEdges()
        // The superset: hidden nodes are listed, not omitted — that is what the
        // `Visibility` column is for. Cluster children are left out, because they belong
        // to their cluster's own graph rather than this one.
        return graph.getMutableNodes().filter((node) => !node.isChild)
    }

    /* ---------- narrowing and ordering ---------- */

    /** The filters actually narrowing anything, as `[columnKey, filter]` pairs. */
    private activeRowFilters(): Array<[string, RowFilter]> {
        return [...this.rowFilters].filter(([, filter]) => isRowFilterActive(filter))
    }

    private rowPasses(row: Row, active: Array<[string, RowFilter]>): boolean {
        return active.every(([key, filter]) => rowFilterMatches(filter, row.values.get(key)))
    }

    private applyRowFilters(): Row[] {
        const active = this.activeRowFilters()
        if (active.length === 0) return [...this.rows]

        return this.rows.filter((row) => this.rowPasses(row, active))
    }

    /**
     * The ids the column filters exclude — what {@link TableGraphFilter} hides when the
     * push button is pressed.
     *
     * The **Visibility** column is deliberately left out of this, though it still narrows
     * rows like any other: its values *are* the graph's filter state, so pushing it would
     * hide whatever is currently on the canvas and then immediately disagree with itself.
     * A consequence worth knowing: with a Visibility filter active the rows listed are
     * narrower than what a push hides, so the two counts are not complements.
     */
    public graphFilterIds(): string[] {
        const active = this.activeRowFilters().filter(([key]) => key !== VISIBILITY_COLUMN_KEY)
        if (active.length === 0) return []

        return this.rows.filter((row) => !this.rowPasses(row, active)).map((row) => row.id)
    }

    /** Whether any column offers a filter at all — no control, no push to make. */
    public hasFilterableColumns(): boolean {
        return this.columns.some((column) => column.filterable && column.key !== VISIBILITY_COLUMN_KEY)
    }

    private applySort(rows: Row[]): Row[] {
        const sort = this.sort
        if (!sort) return rows

        const direction = sort.direction === 'asc' ? 1 : -1
        // Sorting the array, never the DOM — the rendered rows are a projection of it.
        return [...rows].sort((a, b) => direction * compareValues(a.values.get(sort.key), b.values.get(sort.key)))
    }

    /* ---------- rendering ---------- */

    public render(): void {
        this.visible = this.applySort(this.applyRowFilters())
        // A rebuild replaces the rows wholesale; keep the reader where they were.
        const scroller = this.scroller()
        const scrollTop = scroller?.scrollTop ?? 0
        this.windowStart = -1
        this.windowEnd = -1

        this.root.innerHTML = ''
        this.root.appendChild(this.buildHead())
        this.root.appendChild(this.buildRows())
        // Sorting, narrowing and hiding a column all land here, and each of them can
        // change the count — so the summary is refreshed from render, not from rebuild.
        this.updateSummary()
        if (scroller && scrollTop > 0) scroller.scrollTop = scrollTop
        // Rows are rebuilt from scratch, so the selection marks have to be reapplied.
        // No scrolling: the user asked for a sort or a filter, not to be moved.
        this.syncSelection(false)
    }

    /**
     * Re-narrow and redraw the rows, leaving the header standing.
     *
     * A row filter changes nothing in the header — not the sort arrow, not the column
     * widths, not the dropdowns' own choices, which are read from every row rather than
     * the narrowed ones. Rebuilding it anyway would blur the control mid-keystroke.
     */
    private renderRows(): void {
        this.visible = this.applySort(this.applyRowFilters())
        this.windowStart = -1
        this.windowEnd = -1

        // The scroll container is the grid's parent, so replacing the body leaves the
        // scroll position alone — unlike `render`, which has to put it back by hand.
        this.bodyRows?.remove()
        this.root.appendChild(this.buildRows())
        this.updateSummary()
        this.syncSelection(false)
    }

    /** One grid template shared by the header and every row, so the columns line up. */
    private gridTemplate(): string {
        return this.getVisibleColumns()
            .map((column) => typeof column.width === 'number' ? `${column.width}px` : column.width ?? 'minmax(120px, 1fr)')
            .join(' ')
    }

    private buildHead(): HTMLElement {
        const head = document.createElement('div')
        head.className = 'pvt-table-head'
        head.style.gridTemplateColumns = this.gridTemplate()
        this.head = head

        for (const column of this.getVisibleColumns()) {
            head.appendChild(this.buildHeadCell(column))
        }
        return head
    }

    private buildHeadCell(column: TableColumn<Element>): HTMLElement {
        const cell = document.createElement('div')
        cell.className = 'pvt-table-th'
        cell.dataset.column = column.key
        if (column.align) cell.dataset.align = column.align

        const label = document.createElement('button')
        label.type = 'button'
        label.className = 'pvt-table-th-label'
        label.textContent = column.label ?? column.key
        const sortable = column.sortable !== false
        if (sortable) {
            const active = this.sort?.key === column.key
            if (active) {
                label.classList.add('pvt-table-sorted')
                label.insertAdjacentHTML('beforeend', `<span class="pvt-table-sort-arrow">${this.sort!.direction === 'asc' ? arrowUp : arrowDown}</span>`)
            }
            label.title = `Sort by ${column.label ?? column.key}`
            label.addEventListener('click', () => this.toggleSort(column.key))
        } else {
            label.disabled = true
        }
        cell.appendChild(label)

        if (column.filterable) cell.appendChild(this.buildFilterControl(column))
        return cell
    }

    /**
     * The header's row filter, typed off the column's facet `type` — a bounds pair for a
     * `numberRange`, a dropdown of the values present for a `select`, a text box otherwise.
     *
     * Only the rows are re-rendered on a change: rebuilding the header under a control the
     * user is typing into would take the focus and the caret with it.
     */
    private buildFilterControl(column: TableColumn<Element>): HTMLElement {
        const choices = columnChoices(this.rows.map((row) => row.values.get(column.key)))
        return buildRowFilterControl(column, this.rowFilters.get(column.key), choices, (filter) => {
            if (filter) this.rowFilters.set(column.key, filter)
            else this.rowFilters.delete(column.key)
            this.renderRows()
            this.rowFiltersChanged?.()
        })
    }

    private buildRows(): HTMLElement {
        const container = document.createElement('div')
        container.className = 'pvt-table-rows'
        this.bodyRows = container

        if (this.visible.length === 0) {
            this.detachScrollListener()
            container.appendChild(this.buildEmptyState())
            return container
        }

        // Under the threshold, render the lot: plain DOM keeps the common case simple to
        // debug and screenshot without any scroll choreography.
        if (this.visible.length <= this.virtualizeAbove) {
            this.detachScrollListener()
            const template = this.gridTemplate()
            const columns = this.getVisibleColumns()
            for (const row of this.visible) {
                container.appendChild(this.buildRow(row, columns, template))
            }
            return container
        }

        // Over it, window the rows. The container carries the full scroll height so the
        // scrollbar measures the data, not the handful of rows actually in the DOM.
        container.classList.add('pvt-table-rows-windowed')
        container.style.height = `${this.visible.length * TableGrid.ROW_HEIGHT}px`
        this.attachScrollListener()
        this.renderWindow(container)
        return container
    }

    /* ---------- windowing ---------- */

    /** The scroll container the dock puts this grid inside. */
    private scroller(): HTMLElement | null {
        return this.root.parentElement
    }

    private attachScrollListener(): void {
        const scroller = this.scroller()
        if (!scroller || this.scrollHandler) return
        this.scrollHandler = () => this.renderWindow()
        scroller.addEventListener('scroll', this.scrollHandler, { passive: true })
    }

    private detachScrollListener(): void {
        const scroller = this.scroller()
        if (scroller && this.scrollHandler) scroller.removeEventListener('scroll', this.scrollHandler)
        this.scrollHandler = undefined
    }

    /**
     * Draw the slice of rows the viewport can see, plus an overscan margin either side so
     * a fast scroll doesn't show empty space before the next frame lands.
     *
     * Rows are positioned arithmetically from {@link ROW_HEIGHT}, which is why the CSS
     * pins every row to exactly that height.
     */
    private renderWindow(container = this.bodyRows): void {
        if (!container) return
        const scroller = this.scroller()
        const viewportHeight = scroller?.clientHeight ?? 0
        const scrollTop = scroller?.scrollTop ?? 0

        const first = Math.max(0, Math.floor(scrollTop / TableGrid.ROW_HEIGHT) - TableGrid.OVERSCAN)
        const count = Math.ceil(viewportHeight / TableGrid.ROW_HEIGHT) + TableGrid.OVERSCAN * 2
        const last = Math.min(this.visible.length, first + count)

        // Redrawing the same window on every scroll event would be wasted work — most
        // scroll events don't cross a row boundary.
        if (this.windowStart === first && this.windowEnd === last && container.childElementCount > 0) return
        this.windowStart = first
        this.windowEnd = last

        container.innerHTML = ''
        const template = this.gridTemplate()
        const columns = this.getVisibleColumns()
        for (let index = first; index < last; index++) {
            const row = this.buildRow(this.visible[index], columns, template)
            row.style.top = `${index * TableGrid.ROW_HEIGHT}px`
            container.appendChild(row)
        }
        this.syncSelection(false)
    }

    /** Release the scroll listener. Called by the dock when it tears the grid down. */
    public dispose(): void {
        this.detachScrollListener()
    }

    private buildRow(row: Row, columns: TableColumn<Element>[], template: string): HTMLElement {
        const element = document.createElement('div')
        element.className = 'pvt-table-row'
        element.dataset.id = row.id
        element.style.gridTemplateColumns = template
        if (this.rowActivate !== 'none') this.wireRow(element, row)

        for (const column of columns) {
            const cell = document.createElement('div')
            cell.className = 'pvt-table-td'
            if (column.align) cell.dataset.align = column.align

            const value = row.values.get(column.key)

            // The visibility cell is drawn as a state chip. Keyed on the *column*, not on
            // the value — a data column that happens to hold the word "visible" is not a
            // visibility column.
            if (column.key === VISIBILITY_COLUMN_KEY && typeof value === 'string' && value !== '') {
                cell.dataset.visibility = value
                const chip = document.createElement('span')
                chip.className = 'pvt-table-visibility'
                chip.textContent = value
                cell.appendChild(chip)
                element.appendChild(cell)
                continue
            }

            const formatted = column.format?.(value, row.element as never)
            if (formatted instanceof HTMLElement) cell.appendChild(formatted)
            else cell.textContent = formatted ?? formatValue(value)
            element.appendChild(cell)
        }
        return element
    }

    /**
     * Has any row's `Visibility` reading moved since the last rebuild?
     *
     * Visibility changes for reasons nothing announces — a cluster opening or closing, a
     * programmatic `hideNode` — so the dock asks this from `Graph.onVisibleChange`. A
     * read-and-compare pass rather than a patch: a rebuild is what keeps the sort, the row
     * filters and the summary consistent, and it only has to happen when something moved.
     */
    public visibilityMoved(): boolean {
        const column = this.columns.find((candidate) => candidate.key === VISIBILITY_COLUMN_KEY)
        if (!column) return false
        return this.rows.some((row) => row.values.get(column.key) !== safeRead(column, row.element))
    }

    private buildEmptyState(): HTMLElement {
        const empty = document.createElement('div')
        empty.className = 'pvt-table-empty'
        const narrowed = [...this.rowFilters.values()].some(isRowFilterActive)
        empty.innerHTML = `<span class="pvt-table-empty-icon">${dataTable}</span>`
        const text = document.createElement('span')
        text.textContent = narrowed
            ? 'No rows match the column filters.'
            : this.tab === 'edges' ? 'This graph has no edges.' : 'This graph has no nodes.'
        empty.appendChild(text)
        return empty
    }

    /* ---------- selection ---------- */

    /**
     * Row gestures, matching what the canvas offers: plain click replaces the selection,
     * Ctrl/Cmd adds or removes one row, Shift takes a range from the last row clicked.
     *
     * The range runs over the rows **as currently listed** — sorted and narrowed — because
     * that is what the user can see. Sorting by degree and shift-clicking the top twenty is
     * the whole point.
     */
    private wireRow(element: HTMLElement, row: Row): void {
        // Shift-click is a range gesture here, but it is also the browser's own "extend
        // the text selection to here" — which drags a blue smear across every row the
        // range covers. Cancelled at mousedown, where that selection is actually made.
        // Only when Shift is held: a plain click still puts a caret in the cell, so the
        // values stay selectable text, which is half of what a table is for.
        element.addEventListener('mousedown', (event) => {
            if (event.shiftKey) event.preventDefault()
        })

        element.addEventListener('click', (event) => {
            const index = this.visible.findIndex((candidate) => candidate.id === row.id)

            if (event.shiftKey && this.lastClickedIndex !== null) {
                const [from, to] = [this.lastClickedIndex, index].sort((a, b) => a - b)
                this.selectRange(from, to)
                return
            }

            this.lastClickedIndex = index

            if (event.ctrlKey || event.metaKey) {
                this.toggleRow(row)
                return
            }

            this.uiManager.graph.selectElements([row.element])
            if (this.rowActivate === 'selectAndCenter') this.uiManager.graph.focusElement(row.element)
        })

        // A double-click is the "take me there" gesture, whatever a single click does.
        element.addEventListener('dblclick', () => {
            this.uiManager.graph.selectElements([row.element])
            this.uiManager.graph.focusElement(row.element)
        })

        // Hovering a row lights the element up on the canvas, so a row and a dot can be
        // matched by eye. Only rendered rows can fire this, so it costs nothing at scale.
        element.addEventListener('pointerenter', () => this.uiManager.graph.highlightElement(row.element))
        element.addEventListener('pointerleave', () => this.uiManager.graph.unHighlightElement(row.element))
    }

    private selectRange(from: number, to: number): void {
        const elements = this.visible.slice(from, to + 1).map((row) => row.element)
        this.uiManager.graph.selectElements(elements)
    }

    private toggleRow(row: Row): void {
        const graph = this.uiManager.graph
        const selected = graph.renderer?.getGraphInteraction()?.getSelectedNodeIDs() ?? []
        if (this.tab === 'edges') {
            // Edges have no additive setter in the interaction layer, so Ctrl-click on an
            // edge row behaves like a plain click rather than pretending to toggle.
            graph.selectElements([row.element])
            return
        }
        if (selected.includes(row.id)) graph.removeFromSelection([row.element as Node])
        else graph.addToSelection([row.element as Node])
    }

    /** Select every row currently listed — post-sort, post-narrowing. */
    public selectAllListed(): void {
        if (this.tab === 'edges') return
        this.uiManager.graph.selectElements(this.visible.map((row) => row.element))
    }

    /**
     * Reflect the graph's selection onto the rows, and bring the first selected row into
     * view. Reads the selection wholesale rather than tracking deltas, so it cannot drift
     * out of step with the canvas.
     */
    public syncSelection(scrollIntoView = true): void {
        // The renderer is built after the UI, so an early render can land before there is
        // an interaction layer to read. Nothing is selected yet in that case.
        const interaction = this.uiManager.graph.renderer?.getGraphInteraction()
        const selected = new Set(interaction?.getSelectedNodeIDs() ?? [])
        let first: HTMLElement | null = null

        for (const element of this.root.querySelectorAll<HTMLElement>('.pvt-table-row')) {
            const isSelected = selected.has(element.dataset.id ?? '')
            element.classList.toggle('pvt-table-row-selected', isSelected)
            if (isSelected && !first) first = element
        }

        if (scrollIntoView && first) first.scrollIntoView({ block: 'nearest' })
    }

    private toggleSort(key: string): void {
        if (this.sort?.key === key) {
            this.sort = { key, direction: this.sort.direction === 'asc' ? 'desc' : 'asc' }
        } else {
            this.sort = { key, direction: 'asc' }
        }
        this.render()
    }

    /**
     * How many elements this tab's push is hiding on the canvas, for the summary to
     * report. Set by the table whenever it refreshes the push button.
     */
    public setGraphFilterCount(count: number): void {
        this.graphFilterCount = count
    }

    /**
     * A one-line count for the dock header — "12 of 40 nodes", plus "· 28 hidden" while a
     * push is filtering the canvas. The lit button beside it is what says the hiding is
     * this table's doing; the exact sentence is in the summary's own title.
     */
    public describe(): string {
        const noun = this.tab === 'edges' ? 'edge' : 'node'
        const total = this.rows.length
        const shown = this.visible.length
        const counted = shown === total
            ? `${total} ${noun}${total === 1 ? '' : 's'}`
            : `${shown} of ${total} ${noun}${total === 1 ? '' : 's'}`
        return this.graphFilterCount > 0 ? `${counted} · ${this.graphFilterCount} hidden` : counted
    }

    public setSummaryTarget(element: HTMLSpanElement | undefined): void {
        this.summary = element
    }

    public updateSummary(): void {
        if (!this.summary) return
        this.summary.textContent = this.describe()
        // "· 28 hidden" has to be short enough for the bar, so the sentence that says
        // whose doing it is goes here rather than into the count.
        const noun = this.tab === 'edges' ? 'relations' : 'nodes'
        this.summary.title = this.graphFilterCount > 0
            ? `${this.graphFilterCount} ${noun} hidden on the canvas by this table's column filters`
            : ''
    }
}

/**
 * Read a cell without letting one bad accessor take the whole table down. A throwing
 * accessor is the consumer's bug, but it should cost them a blank cell, not a blank dock —
 * and it is warned about once per column rather than once per row.
 */
const warnedColumns = new Set<string>()
function safeRead(column: TableColumn<Element>, element: Element): unknown {
    try {
        return readCell(column, element)
    } catch (error) {
        if (!warnedColumns.has(column.key)) {
            warnedColumns.add(column.key)
            console.warn(`Pivotick: the table column '${column.key}' threw while reading a value; its cells will be blank.`, error)
        }
        return undefined
    }
}

/** Numbers compare numerically, everything else as a locale-aware string. Blanks sort last. */
function compareValues(a: unknown, b: unknown): number {
    const aBlank = a === null || a === undefined || a === ''
    const bBlank = b === null || b === undefined || b === ''
    if (aBlank && bBlank) return 0
    if (aBlank) return 1
    if (bBlank) return -1

    if (typeof a === 'number' && typeof b === 'number') return a - b
    if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b)
    return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
}

/** Cell text for a raw value. Arrays read as a list rather than as `[object Object]`. */
function formatValue(value: unknown): string {
    if (value === null || value === undefined) return ''
    if (Array.isArray(value)) return value.map((entry) => String(entry)).join(', ')
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
}
