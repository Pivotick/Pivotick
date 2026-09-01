import type { RawEdge, RawNode } from '../../../interfaces/GraphOptions'
import type { PivotCandidate, PivotCandidateEdge, PivotCandidateSet } from '../../../interfaces/Pivot'
import type { PivotManager } from '../../../PivotManager'
import { collectDataAttributes, inferAttributeType } from '../../../utils/DataAttributes'
import { arrowDown, arrowUp } from '../../icons'
import type { FilterableColumn, RowFilter } from '../Table/TableRowFilters'
import { buildRowFilterControl, columnChoices, isRowFilterActive, rowFilterMatches } from '../Table/TableRowFilters'
import './pivot.scss'

/** Rows on one page. Paging rather than windowing: the pane's height is the dock's. */
const PAGE_SIZE = 100

/** How many of the candidates' own data keys become columns, best-populated first. */
const MAX_DATA_COLUMNS = 5

/** The leading column, which is a candidate's name rather than one of its data keys. */
const NAME_COLUMN = 'pvt:candidate'

const fmt = (value: number): string => value.toLocaleString()

/** One column of the candidate table: what to call it, and how to read it off a row. */
interface TriageColumn<T> extends FilterableColumn {
    read: (row: T) => unknown
}

interface SortState {
    key: string
    direction: 'asc' | 'desc'
}

/** What the pane needs from whoever owns it — every one of them an act, not a query. */
export interface TriagePaneDeps {
    pivots: PivotManager
    /** Commit the marked rows. The owner reports the outcome and offers the undo. */
    ingest: (pivotId: string) => void
    /** Run this pivot again, with the origin and narrowing this set was fetched with. */
    rerun: (set: PivotCandidateSet) => void
    /** Drop the set, and the pane with it. Rejects nothing. */
    close: (pivotId: string) => void
    /** The tab's label has to follow the count of what is still waiting. */
    relabel: (pivotId: string, label: string) => void
}

/**
 * One pivot's candidates, as a dock pane.
 *
 * It is a **reader** of {@link PivotManager}: the candidates, their states and the
 * session's rejections all live there, and the only state here is what is on screen —
 * which filters are typed, how the rows are sorted, which page is showing. So a pane
 * torn down and rebuilt loses a scroll position and nothing else.
 *
 * Nothing in it is in the graph. A candidate becomes data at exactly one moment, when
 * the analyst presses **Ingest selected** — which is the distinction the whole feature
 * rests on, and the reason the pane never touches the canvas itself.
 */
export class TriagePane {
    /** Kept for the pane's life: the dock caches what `render` returns and re-attaches it. */
    public readonly root: HTMLElement
    public readonly pivotId: string

    private readonly deps: TriagePaneDeps
    private set: PivotCandidateSet

    /* ---------- the only state the pane owns ---------- */
    private search = ''
    private useRegex = false
    private readonly filters = new Map<string, RowFilter>()
    private sort: SortState | null = null
    private page = 0
    /** Whether the "rejected earlier" list is open — C5's inspectable suppression. */
    private showSuppressed = false
    /** Live only while the tab is on show: a hidden pane rebuilding is invisible work. */
    private active = false
    private dirty = true

    /** Rebuilt in place as rows are ticked, so marking never redraws the table. */
    private footer?: HTMLElement
    private scroller?: HTMLElement

    constructor(set: PivotCandidateSet, deps: TriagePaneDeps) {
        this.set = set
        this.pivotId = set.pivotId
        this.deps = deps
        this.root = document.createElement('div')
        this.root.className = 'pvt-triage'
    }

    /* ---------- lifecycle ---------- */

    /** The set changed under us. Repaint if anyone is looking; catch up on activation if not. */
    public update(set: PivotCandidateSet): void {
        this.set = set
        this.dirty = true
        if (this.active) this.paint()
        this.deps.relabel(this.pivotId, this.label())
    }

    public activate(): void {
        this.active = true
        if (this.dirty) this.paint()
    }

    public deactivate(): void {
        this.active = false
    }

    /** The dock asking for the body. Also the first activation, so paint now. */
    public render(): HTMLElement {
        this.active = true
        this.paint()
        return this.root
    }

    /** The strip's label: the pivot, and how many rows are still waiting for a verdict. */
    public label(): string {
        const waiting = this.untriaged().length
        return waiting > 0 ? `${this.set.label} (${fmt(waiting)})` : this.set.label
    }

    /** The pane's own header controls, in the slot the dock hands it. */
    public toolbar(): HTMLElement[] {
        const items: HTMLElement[] = []

        const search = document.createElement('input')
        search.type = 'text'
        search.className = 'pvt-triage-search'
        search.placeholder = this.useRegex ? 'Match rows by pattern…' : 'Search rows…'
        search.title = 'Narrow the candidates. Nothing here touches the graph.'
        search.value = this.search
        search.addEventListener('input', () => {
            this.search = search.value
            this.page = 0
            this.paint()
        })
        items.push(search)

        // Regex belongs here and not in the narrowing controls: these filters run over
        // rows already in hand, so the full facet vocabulary is available (D5).
        const regex = document.createElement('label')
        regex.className = 'pvt-triage-regex'
        regex.title = 'Read the search box as a regular expression'
        const box = document.createElement('input')
        box.type = 'checkbox'
        box.checked = this.useRegex
        box.addEventListener('change', () => {
            this.useRegex = box.checked
            this.page = 0
            this.paint()
            this.deps.relabel(this.pivotId, this.label())
        })
        regex.append(box, text('span', 'regex'))
        items.push(regex)

        items.push(this.toolbarButton('Re-run', 'Fetch again with the same narrowing', () => this.deps.rerun(this.set)))
        items.push(this.toolbarButton('Close', 'Drop these candidates. Nothing is rejected.', () => this.deps.close(this.pivotId)))
        return items
    }

    private toolbarButton(label: string, title: string, onClick: () => void): HTMLButtonElement {
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'pvt-triage-toolbtn'
        button.textContent = label
        button.title = title
        button.addEventListener('click', onClick)
        return button
    }

    /* ---------- painting ---------- */

    private paint(): void {
        const scrollTop = this.scroller?.scrollTop ?? 0
        this.dirty = false
        this.footer = undefined
        this.scroller = undefined
        this.root.replaceChildren()

        const set = this.set
        if (set.pending) this.root.appendChild(this.banner(set.pending))

        if (set.loading) return this.state('loading', 'Fetching candidates…', {
            sub: 'Nothing is on the canvas yet — candidates are staged, not merged.',
            action: { label: 'Cancel', run: () => this.deps.pivots.cancelFetch(this.pivotId) },
        })

        if (set.error) return this.state('error', 'Couldn\'t fetch candidates.', {
            sub: 'Nothing was staged. Retrying runs the same request with the narrowing you already chose.',
            action: { label: 'Retry', run: () => this.deps.rerun(set) },
        })

        if (set.refused) {
            return this.state('refused',
                `The source returned ${fmt(set.refused.count)} candidates, over the ${fmt(set.refused.limit)} limit.`,
                {
                    sub: 'Nothing was staged — narrow and run again.',
                    action: { label: 'Dismiss', run: () => this.deps.close(this.pivotId) },
                })
        }

        const actionable = this.untriaged()
        if (!actionable.length) return this.finishedState()

        this.root.appendChild(this.headline())

        const columns = this.nodeColumns()
        const matching = this.matchingRows(columns)
        const pages = Math.max(1, Math.ceil(matching.length / PAGE_SIZE))
        if (this.page >= pages) this.page = pages - 1

        const scroller = document.createElement('div')
        scroller.className = 'pvt-triage-scroll'
        // Edges first: there are usually a handful of them against hundreds of nodes,
        // and below a full page of rows a core AIL result would never be seen at all.
        if (this.set.edges.length) scroller.appendChild(this.edgeSection())
        scroller.appendChild(this.grid(columns, matching.slice(this.page * PAGE_SIZE, (this.page + 1) * PAGE_SIZE)))
        this.root.appendChild(scroller)
        this.scroller = scroller

        this.footer = document.createElement('div')
        this.footer.className = 'pvt-triage-foot'
        this.root.appendChild(this.footer)
        this.paintFooter(matching, pages)

        scroller.scrollTop = scrollTop
    }

    /** The empty-ish endings: nothing came back, it was all already here, or triage is done. */
    private finishedState(): void {
        const set = this.set
        if (set.fetched === 0) {
            return this.state('empty', 'No candidates came back', {
                sub: 'The narrowing may be tighter than the data.',
                action: { label: 'Close', run: () => this.deps.close(this.pivotId) },
            })
        }

        const ingested = set.fetched - set.suppressed - set.nodes.length
        const rejected = set.nodes.filter(c => c.state === 'rejected').length
        if (!ingested && !rejected && set.deduped === set.nodes.length) {
            // Their data was left untouched — a normal outcome, not a failed run (D23).
            return this.state('done', `All ${fmt(set.fetched)} are already on the canvas — nothing to triage`, {
                sub: 'Nothing was changed: an id already here is left exactly as it was.',
                action: { label: 'Close', run: () => this.deps.close(this.pivotId) },
            })
        }

        const tally: string[] = []
        if (ingested) tally.push(`${fmt(ingested)} ingested`)
        if (rejected + set.suppressed) tally.push(`${fmt(rejected + set.suppressed)} rejected`)
        if (set.deduped) tally.push(`${fmt(set.deduped)} already on canvas`)
        return this.state('done', 'Nothing left to triage', {
            sub: tally.join(' · '),
            action: { label: 'Close', run: () => this.deps.close(this.pivotId) },
        })
    }

    private state(
        kind: string,
        title: string,
        extra: { sub?: string, action?: { label: string, run: () => void } },
    ): void {
        const box = document.createElement('div')
        box.className = `pvt-triage-state pvt-triage-${kind}`
        box.appendChild(text('div', title, 'pvt-triage-state-title'))
        if (extra.sub) box.appendChild(text('div', extra.sub, 'pvt-triage-state-sub'))
        if (extra.action) {
            const button = document.createElement('button')
            button.type = 'button'
            button.className = 'pvt-triage-btn'
            button.textContent = extra.action.label
            button.addEventListener('click', extra.action.run)
            box.appendChild(button)
        }
        this.root.appendChild(box)
    }

    /** A re-run landed while rows were marked: announced, never swapped in unasked (D27). */
    private banner(pending: PivotCandidateSet): HTMLElement {
        const bar = document.createElement('div')
        bar.className = 'pvt-triage-banner'

        if (pending.loading) {
            bar.appendChild(text('span', 'Running again…'))
            bar.appendChild(this.bannerButton('Cancel', () => this.deps.pivots.dismissPending(this.pivotId)))
            return bar
        }
        if (pending.error || pending.refused) {
            bar.appendChild(text('span', 'The re-run failed. What is below is untouched.'))
            bar.appendChild(this.bannerButton('Dismiss', () => this.deps.pivots.dismissPending(this.pivotId)))
            return bar
        }

        const incoming = pending.nodes.length + pending.edges.length
        bar.appendChild(text('span', `This pivot was run again. ${fmt(incoming)} new candidates are ready.`))
        bar.appendChild(this.bannerButton('Show new', () => this.deps.pivots.showPending(this.pivotId)))
        bar.appendChild(this.bannerButton('Keep triaging', () => this.deps.pivots.dismissPending(this.pivotId), true))
        return bar
    }

    private bannerButton(label: string, run: () => void, ghost = false): HTMLButtonElement {
        const button = document.createElement('button')
        button.type = 'button'
        button.className = `pvt-triage-btn${ghost ? ' pvt-triage-ghost' : ''}`
        button.textContent = label
        button.addEventListener('click', run)
        return button
    }

    /**
     * The honest header: what came back, what was already here, what the session had
     * already rejected. Segments only when they are non-zero, and the shrink from the
     * advertised count is stated rather than left to look like a bug (D10).
     */
    private headline(): HTMLElement {
        const set = this.set
        const line = document.createElement('div')
        line.className = 'pvt-triage-head'

        line.appendChild(text('b', `${fmt(set.fetched)} fetched`))
        if (set.deduped) line.appendChild(segment(`${fmt(set.deduped)} already on canvas (skipped)`))

        if (set.suppressed) {
            line.appendChild(text('span', '·', 'pvt-triage-dot'))
            const reveal = document.createElement('button')
            reveal.type = 'button'
            reveal.className = 'pvt-triage-seg'
            reveal.textContent = `${fmt(set.suppressed)} rejected earlier`
            reveal.title = 'Suppressed because they were rejected earlier this session'
            reveal.setAttribute('aria-expanded', String(this.showSuppressed))
            reveal.addEventListener('click', () => {
                this.showSuppressed = !this.showSuppressed
                this.paint()
            })
            line.appendChild(reveal)
        }

        line.appendChild(text('span', '', 'pvt-triage-spacer'))
        const subtitle = set.origin.length
            ? `${fmt(set.origin.length)} origin ${set.origin.length === 1 ? 'node' : 'nodes'}`
            : 'no origin'
        const narrowed = Object.keys(set.narrowing).length
        line.appendChild(text('span', narrowed ? `${subtitle} · narrowed` : subtitle, 'pvt-triage-muted'))

        const wrap = document.createElement('div')
        wrap.appendChild(line)
        if (this.showSuppressed) wrap.appendChild(this.suppressedList())
        return wrap
    }

    /**
     * What the session is holding back, and the way out of a mis-rejection. Rejections
     * are per (pivot, candidate) and remembered for the session (D14), so a restored id
     * is offered by the next run rather than appearing here.
     */
    private suppressedList(): HTMLElement {
        const staged = new Set(this.set.nodes.map(c => c.id))
        const ids = this.deps.pivots.rejectedIds(this.pivotId).filter(id => !staged.has(id))

        const box = document.createElement('div')
        box.className = 'pvt-triage-suppressed'
        box.appendChild(text('div', 'Rejected earlier, so not offered again this session. Restoring one brings it back on the next run.', 'pvt-triage-state-sub'))

        for (const id of ids) {
            const row = document.createElement('div')
            row.className = 'pvt-triage-suppressed-row'
            row.appendChild(text('span', id))
            const restore = document.createElement('button')
            restore.type = 'button'
            restore.className = 'pvt-triage-link'
            restore.textContent = 'restore'
            restore.addEventListener('click', () => this.deps.pivots.unreject(this.pivotId, id))
            row.appendChild(restore)
            box.appendChild(row)
        }
        return box
    }

    /* ---------- columns, filtering, sorting ---------- */

    /**
     * Columns derived from the candidates' own data, the same scan the data dock uses —
     * so a pivot needs to declare nothing to get a readable table, and the filter widget
     * over each column is the one its values ask for.
     */
    private nodeColumns(): TriageColumn<PivotCandidate>[] {
        const columns: TriageColumn<PivotCandidate>[] = [{
            key: NAME_COLUMN,
            label: 'Candidate',
            type: 'text',
            read: row => row.raw.data?.label ?? row.id,
        }]

        const attributes = collectDataAttributes(this.set.nodes.map(row => dataOf(row.raw)), ['label'])
            .sort((a, b) => b.count - a.count)
            .slice(0, MAX_DATA_COLUMNS)

        for (const attribute of attributes) {
            columns.push({
                key: attribute.key,
                label: attribute.key,
                type: inferAttributeType(attribute).type,
                read: row => row.raw.data?.[attribute.key],
            })
        }
        return columns
    }

    /** From and To are the point of an edge row; the rest of its data follows (D24). */
    private edgeColumns(): TriageColumn<PivotCandidateEdge>[] {
        const columns: TriageColumn<PivotCandidateEdge>[] = [
            { key: 'pvt:from', label: 'From', type: 'text', read: row => row.raw.from },
            { key: 'pvt:to', label: 'To', type: 'text', read: row => row.raw.to },
        ]
        const attributes = collectDataAttributes(this.set.edges.map(row => dataOf(row.raw)))
            .sort((a, b) => b.count - a.count)
            .slice(0, 2)
        for (const attribute of attributes) {
            columns.push({
                key: attribute.key,
                label: attribute.key,
                type: inferAttributeType(attribute).type,
                read: row => row.raw.data?.[attribute.key],
            })
        }
        return columns
    }

    /** Rows the search box and the column filters both let through, in sort order. */
    private matchingRows(columns: TriageColumn<PivotCandidate>[]): PivotCandidate[] {
        const rows = this.set.nodes.filter(row => this.matches(row, columns))
        const sort = this.sort
        if (!sort) return rows

        const column = columns.find(c => c.key === sort.key)
        if (!column) return rows
        const sign = sort.direction === 'asc' ? 1 : -1
        return [...rows].sort((a, b) => sign * compare(column.read(a), column.read(b)))
    }

    private matches(row: PivotCandidate, columns: TriageColumn<PivotCandidate>[]): boolean {
        for (const [key, filter] of this.filters) {
            const column = columns.find(c => c.key === key)
            if (!column || !isRowFilterActive(filter)) continue
            if (!rowFilterMatches(filter, column.read(row))) return false
        }
        return this.searchMatches(columns.map(column => column.read(row)))
    }

    /**
     * The search box: a row matches when any one of its cells does. Per cell rather than
     * over the joined row, so an anchored pattern means what it looks like it means.
     * Regex is legal here and never reaches a backend — these rows are already in hand.
     */
    private searchMatches(values: unknown[]): boolean {
        const needle = this.search.trim()
        if (!needle) return true
        const cells = values.filter(value => value !== null && value !== undefined).map(String)

        if (!this.useRegex) {
            const lower = needle.toLowerCase()
            return cells.some(cell => cell.toLowerCase().includes(lower))
        }
        let pattern: RegExp
        try {
            pattern = new RegExp(needle, 'i')
        } catch {
            // A half-typed pattern is not a verdict on the rows: show them all.
            return true
        }
        return cells.some(cell => pattern.test(cell))
    }

    /* ---------- the grid ---------- */

    private grid(columns: TriageColumn<PivotCandidate>[], rows: PivotCandidate[]): HTMLElement {
        const grid = document.createElement('div')
        grid.className = 'pvt-triage-grid'
        // One tick column, the data columns, and the row's own state on the right.
        const template = `28px ${columns.map(() => 'minmax(110px, 1fr)').join(' ')} 96px`
        grid.style.setProperty('--pvt-triage-columns', template)

        grid.appendChild(this.head(columns))
        for (const row of rows) grid.appendChild(this.row(row, columns))
        return grid
    }

    private head(columns: TriageColumn<PivotCandidate>[]): HTMLElement {
        const head = document.createElement('div')
        head.className = 'pvt-triage-headrow'
        head.appendChild(document.createElement('span'))

        for (const column of columns) {
            const cell = document.createElement('div')
            cell.className = 'pvt-triage-th'

            const button = document.createElement('button')
            button.type = 'button'
            button.className = 'pvt-triage-th-label'
            button.dataset.column = column.key
            button.appendChild(text('span', column.label ?? column.key))
            if (this.sort?.key === column.key) {
                button.classList.add('pvt-triage-sorted')
                const arrow = document.createElement('span')
                arrow.className = 'pvt-triage-sort-arrow'
                arrow.innerHTML = this.sort.direction === 'asc' ? arrowUp : arrowDown
                button.appendChild(arrow)
            }
            button.addEventListener('click', () => {
                this.sort = this.sort?.key === column.key && this.sort.direction === 'asc'
                    ? { key: column.key, direction: 'desc' }
                    : { key: column.key, direction: 'asc' }
                this.page = 0
                this.paint()
            })
            cell.appendChild(button)

            const values = this.set.nodes.map(row => column.read(row))
            cell.appendChild(buildRowFilterControl(column, this.filters.get(column.key), columnChoices(values), filter => {
                if (filter) this.filters.set(column.key, filter)
                else this.filters.delete(column.key)
                this.page = 0
                this.paint()
            }))
            head.appendChild(cell)
        }

        head.appendChild(document.createElement('span'))
        return head
    }

    private row(candidate: PivotCandidate, columns: TriageColumn<PivotCandidate>[]): HTMLElement {
        const row = document.createElement('div')
        row.className = `pvt-triage-row pvt-triage-row-${candidate.state}`
        row.dataset.candidate = candidate.id
        if (candidate.deduped) row.classList.add('pvt-triage-row-deduped')

        const state = text('span', '', 'pvt-triage-cell pvt-triage-state-cell')
        row.appendChild(this.tickCell(candidate, row, state))
        for (const column of columns) row.appendChild(text('span', cellText(column.read(candidate)), 'pvt-triage-cell'))
        this.paintState(candidate, state)
        row.appendChild(state)
        return row
    }

    private tickCell(candidate: PivotCandidate, row: HTMLElement, state: HTMLElement): HTMLElement {
        const cell = document.createElement('span')
        cell.className = 'pvt-triage-cell pvt-triage-tick'

        // A rejected row loses its checkbox rather than showing an unticked one:
        // rejection is a verdict, and must not read as mere deselection (C6).
        if (candidate.state === 'rejected') {
            cell.appendChild(text('span', '✕', 'pvt-triage-rejected-mark'))
            return cell
        }
        if (candidate.deduped) {
            cell.appendChild(text('span', '–', 'pvt-triage-muted'))
            return cell
        }

        const box = document.createElement('input')
        box.type = 'checkbox'
        box.checked = candidate.state === 'marked'
        box.addEventListener('change', () => {
            // `mark` is silent by design: repainting the table on every tick would lose
            // the analyst's place. The row, the state cell and the footer move instead.
            this.deps.pivots.mark(this.pivotId, candidate.id, box.checked)
            row.classList.toggle('pvt-triage-row-marked', box.checked)
            this.paintState(candidate, state)
            this.refreshFooter()
        })
        cell.appendChild(box)
        return cell
    }

    private paintState(candidate: PivotCandidate, cell: HTMLElement): void {
        cell.replaceChildren()
        cell.className = 'pvt-triage-cell pvt-triage-state-cell'

        if (candidate.deduped) {
            cell.classList.add('pvt-triage-muted')
            cell.textContent = 'on canvas'
            return
        }
        if (candidate.state === 'rejected') {
            const undo = document.createElement('button')
            undo.type = 'button'
            undo.className = 'pvt-triage-link'
            undo.textContent = 'undo'
            undo.addEventListener('click', () => this.deps.pivots.unreject(this.pivotId, candidate.id))
            cell.appendChild(undo)
            return
        }
        if (candidate.state === 'marked') {
            cell.classList.add('pvt-triage-strong')
            cell.textContent = 'will ingest'
        }
    }

    /**
     * Edges whose ends are all already on canvas are decisions of their own, so they get
     * their own section rather than being squeezed into the node table's columns (D24).
     */
    private edgeSection(): HTMLElement {
        const wrap = document.createElement('div')
        wrap.className = 'pvt-triage-edges'
        wrap.appendChild(text('div', `Edges between nodes already on canvas — ${fmt(this.set.edges.length)}`, 'pvt-triage-sechead'))

        const columns = this.edgeColumns()
        const grid = document.createElement('div')
        grid.className = 'pvt-triage-grid'
        grid.style.setProperty('--pvt-triage-columns', `28px ${columns.map(() => 'minmax(110px, 1fr)').join(' ')} 96px`)

        const head = document.createElement('div')
        head.className = 'pvt-triage-headrow'
        head.appendChild(document.createElement('span'))
        for (const column of columns) {
            const cell = document.createElement('div')
            cell.className = 'pvt-triage-th'
            cell.appendChild(text('span', column.label ?? column.key, 'pvt-triage-th-label'))
            head.appendChild(cell)
        }
        head.appendChild(document.createElement('span'))
        grid.appendChild(head)

        for (const edge of this.set.edges) {
            const row = document.createElement('div')
            row.className = `pvt-triage-row pvt-triage-row-${edge.state}`
            row.dataset.edge = edge.id

            const cell = document.createElement('span')
            cell.className = 'pvt-triage-cell pvt-triage-tick'
            const box = document.createElement('input')
            box.type = 'checkbox'
            box.checked = edge.state === 'marked'
            box.addEventListener('change', () => {
                this.deps.pivots.mark(this.pivotId, edge.id, box.checked)
                row.classList.toggle('pvt-triage-row-marked', box.checked)
                this.refreshFooter()
            })
            cell.appendChild(box)
            row.appendChild(cell)

            for (const column of columns) row.appendChild(text('span', cellText(column.read(edge)), 'pvt-triage-cell'))
            row.appendChild(document.createElement('span'))
            grid.appendChild(row)
        }

        wrap.appendChild(grid)
        return wrap
    }

    /* ---------- footer ---------- */

    private refreshFooter(): void {
        if (!this.footer) return
        const matching = this.matchingRows(this.nodeColumns())
        this.paintFooter(matching, Math.max(1, Math.ceil(matching.length / PAGE_SIZE)))
        this.deps.relabel(this.pivotId, this.label())
    }

    private paintFooter(matching: PivotCandidate[], pages: number): void {
        const foot = this.footer
        if (!foot) return
        foot.replaceChildren()

        const marked = this.set.nodes.filter(c => c.state === 'marked').length
            + this.set.edges.filter(e => e.state === 'marked').length

        const ingest = document.createElement('button')
        ingest.type = 'button'
        ingest.className = 'pvt-triage-btn pvt-triage-ingest'
        ingest.textContent = `Ingest selected (${fmt(marked)})`
        ingest.disabled = marked === 0
        ingest.addEventListener('click', () => this.deps.ingest(this.pivotId))
        foot.appendChild(ingest)

        // Named after what it matched, never a bare "select all" while a filter narrows
        // the table — the two are different acts on a 1,800-row set.
        const selectable = matching.filter(c => c.state === 'candidate' && !c.deduped)
        const narrowed = this.narrowing()
        foot.appendChild(this.footButton(
            narrowed ? `Select all ${fmt(selectable.length)} matching` : `Select all ${fmt(selectable.length)}`,
            selectable.length === 0,
            () => {
                if (narrowed) for (const row of selectable) this.deps.pivots.mark(this.pivotId, row.id, true)
                else this.deps.pivots.markAll(this.pivotId, true)
                this.paint()
            },
        ))

        foot.appendChild(this.footButton('Reject selected', marked === 0, () => {
            const ids = [...this.set.nodes, ...this.set.edges].filter(r => r.state === 'marked').map(r => r.id)
            this.deps.pivots.reject(this.pivotId, ids)
        }))
        foot.appendChild(this.footButton('Reject all remaining', false, () => this.deps.pivots.rejectRemaining(this.pivotId)))

        foot.appendChild(text('span', '', 'pvt-triage-spacer'))

        if (pages > 1) {
            const from = this.page * PAGE_SIZE + 1
            const to = Math.min(matching.length, (this.page + 1) * PAGE_SIZE)
            foot.appendChild(this.footButton('‹', this.page === 0, () => { this.page--; this.paint() }))
            foot.appendChild(text('span', `${fmt(from)}–${fmt(to)} of ${fmt(matching.length)}`, 'pvt-triage-muted'))
            foot.appendChild(this.footButton('›', this.page >= pages - 1, () => { this.page++; this.paint() }))
        } else {
            foot.appendChild(text('span', `${fmt(matching.length)} shown`, 'pvt-triage-muted'))
        }

        foot.appendChild(text('span', 'closing this pane rejects nothing — leftovers are re-offered next run', 'pvt-triage-muted pvt-triage-note'))
    }

    private footButton(label: string, disabled: boolean, run: () => void): HTMLButtonElement {
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'pvt-triage-btn pvt-triage-ghost'
        button.textContent = label
        button.disabled = disabled
        button.addEventListener('click', run)
        return button
    }

    /* ---------- reading the set ---------- */

    /** Rows still waiting for a verdict: not rejected, not already on the canvas. */
    private untriaged(): PivotCandidate[] {
        return this.set.nodes.filter(c => c.state !== 'rejected' && !c.deduped)
    }

    /** Whether anything the analyst typed is narrowing the table right now. */
    private narrowing(): boolean {
        if (this.search.trim() !== '') return true
        for (const filter of this.filters.values()) if (isRowFilterActive(filter)) return true
        return false
    }
}

/** A `RawNode` / `RawEdge` seen as something with a data bag, for the shared scan. */
function dataOf(raw: RawNode | RawEdge): { getData(): Record<string, unknown> } {
    return { getData: () => (raw.data ?? {}) as Record<string, unknown> }
}

function text(tag: string, content: string, className?: string): HTMLElement {
    const element = document.createElement(tag)
    if (className) element.className = className
    element.textContent = content
    return element
}

function segment(content: string): DocumentFragment {
    const frag = document.createDocumentFragment()
    frag.appendChild(text('span', '·', 'pvt-triage-dot'))
    frag.appendChild(text('span', content))
    return frag
}

function cellText(value: unknown): string {
    if (value === null || value === undefined) return ''
    return Array.isArray(value) ? value.join(', ') : String(value)
}

function compare(a: unknown, b: unknown): number {
    if (typeof a === 'number' && typeof b === 'number') return a - b
    return String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true })
}
