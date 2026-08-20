import type { Edge } from '../../../Edge'
import type { Node } from '../../../Node'
import type { TableColumn, TableSortDirection, TableTab } from '../../../interfaces/GraphUI'
import type { UIManager } from '../../UIManager'
import { readCell, resolveColumns } from './TableColumns'
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
    private readonly uiManager: UIManager
    private readonly tab: TableTab
    private readonly root: HTMLDivElement

    private columns: TableColumn<Element>[] = []
    /** Column keys the picker has switched off. */
    private readonly hiddenColumns = new Set<string>()
    /** Per-column row filters, by column key. Empty string / unset means "no filter". */
    private readonly rowFilters = new Map<string, string>()
    private sort: SortState | null = null

    private rows: Row[] = []
    private visible: Row[] = []
    /** Anchor for a shift-click range, as an index into {@link visible}. */
    private lastClickedIndex: number | null = null
    /** What a row click does, from `UI.table.rowActivate`. */
    private readonly rowActivate: 'select' | 'selectAndCenter' | 'none'

    private head?: HTMLDivElement
    private bodyRows?: HTMLDivElement
    private summary?: HTMLSpanElement

    constructor(uiManager: UIManager, tab: TableTab, initialSort?: SortState, rowActivate: 'select' | 'selectAndCenter' | 'none' = 'select') {
        this.uiManager = uiManager
        this.tab = tab
        this.root = document.createElement('div')
        this.root.className = 'pvt-table-grid'
        this.sort = initialSort ?? null
        this.rowActivate = rowActivate
    }

    public getRoot(): HTMLElement {
        return this.root
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
            const first = this.columns.find((column) => column.sortable !== false)
            if (first) this.sort = { key: first.key, direction: 'asc' }
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

    private applyRowFilters(): Row[] {
        const active = [...this.rowFilters].filter(([, needle]) => needle.trim() !== '')
        if (active.length === 0) return [...this.rows]

        return this.rows.filter((row) =>
            active.every(([key, needle]) => {
                const value = row.values.get(key)
                if (value === null || value === undefined) return false
                return String(value).toLowerCase().includes(needle.trim().toLowerCase())
            })
        )
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

        this.root.innerHTML = ''
        this.root.appendChild(this.buildHead())
        this.root.appendChild(this.buildRows())
        // Sorting, narrowing and hiding a column all land here, and each of them can
        // change the count — so the summary is refreshed from render, not from rebuild.
        this.updateSummary()
        // Rows are rebuilt from scratch, so the selection marks have to be reapplied.
        // No scrolling: the user asked for a sort or a filter, not to be moved.
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
     * The header's row filter. Labelled as narrowing *rows* rather than the graph, because
     * the header pill one row up says "Filter Graph" and means something else entirely.
     */
    private buildFilterControl(column: TableColumn<Element>): HTMLElement {
        const input = document.createElement('input')
        input.type = 'text'
        input.className = 'pvt-table-filter'
        input.placeholder = 'Filter rows…'
        input.title = `Narrow the rows by ${column.label ?? column.key}. The graph is not affected.`
        input.value = this.rowFilters.get(column.key) ?? ''
        input.addEventListener('input', () => {
            this.rowFilters.set(column.key, input.value)
            this.render()
            // Rendering replaces the DOM, so put the caret back where it was.
            const restored = this.root.querySelector<HTMLInputElement>(`.pvt-table-th[data-column="${cssEscape(column.key)}"] .pvt-table-filter`)
            restored?.focus()
        })
        return input
    }

    private buildRows(): HTMLElement {
        const container = document.createElement('div')
        container.className = 'pvt-table-rows'
        this.bodyRows = container

        if (this.visible.length === 0) {
            container.appendChild(this.buildEmptyState())
            return container
        }

        const template = this.gridTemplate()
        const columns = this.getVisibleColumns()
        for (const row of this.visible) {
            container.appendChild(this.buildRow(row, columns, template))
        }
        return container
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
            const formatted = column.format?.(value, row.element as never)
            if (formatted instanceof HTMLElement) cell.appendChild(formatted)
            else cell.textContent = formatted ?? formatValue(value)

            // The visibility cell is the one people scan for, so give it a chip.
            if (typeof value === 'string' && (value === 'filtered' || value === 'excluded' || value === 'visible')) {
                cell.dataset.visibility = value
            }
            element.appendChild(cell)
        }
        return element
    }

    private buildEmptyState(): HTMLElement {
        const empty = document.createElement('div')
        empty.className = 'pvt-table-empty'
        const narrowed = [...this.rowFilters.values()].some((needle) => needle.trim() !== '')
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

    /** A one-line count for the dock header — "12 of 40 nodes". */
    public describe(): string {
        const noun = this.tab === 'edges' ? 'edge' : 'node'
        const total = this.rows.length
        const shown = this.visible.length
        if (shown === total) return `${total} ${noun}${total === 1 ? '' : 's'}`
        return `${shown} of ${total} ${noun}${total === 1 ? '' : 's'}`
    }

    public setSummaryTarget(element: HTMLSpanElement | undefined): void {
        this.summary = element
    }

    public updateSummary(): void {
        if (this.summary) this.summary.textContent = this.describe()
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

/** Column keys carry a `pvt:` namespace, so they need escaping inside a selector. */
function cssEscape(value: string): string {
    return typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(value) : value.replace(/[^a-zA-Z0-9_-]/g, '\\$&')
}
