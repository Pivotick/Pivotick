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

/**
 * How many nodes a container candidate carries. Label, type and terms are the dock's
 * `Children` column unchanged — direct children, not the whole subtree — so the count
 * means the same thing in both grids.
 */
const CHILDREN_COLUMN = 'pvt:children'

/** The dock's own count columns, so a range filter has room for both its inputs. */
const COUNT_WIDTH = '96px'

/** How many of a container's children the opened panel draws before it says "more". */
const CHILDREN_SHOWN = 200

/** How many rejections a list draws before it says how many more there are. */
const REJECTED_SHOWN = 50

/** How many of the children's own data keys the panel shows beside each label. */
const CHILD_DATA_KEYS = 3

/** The track a column gets when it does not ask for a width. */
const DEFAULT_TRACK = 'minmax(110px, 1fr)'

const fmt = (value: number): string => value.toLocaleString()

/** One column of the candidate table: what to call it, and how to read it off a row. */
interface TriageColumn<T> extends FilterableColumn {
    read: (row: T) => unknown
    /**
     * Draw the cell's contents instead of the text of `read`. Sorting, filtering and
     * the search box all keep reading `read`, so a rendered cell is never a cell that
     * cannot be narrowed.
     */
    render?: (row: T) => HTMLElement | undefined
    /** A grid track for this column. @default {@link DEFAULT_TRACK} */
    width?: string
    /** Cell alignment, declared as the dock's columns declare it. */
    align?: 'right'
}

interface SortState {
    key: string
    direction: 'asc' | 'desc'
}

/** A way out of one of the pane's states. The first is the primary; the rest are ghosts. */
interface StateAction {
    label: string
    run: () => void
    ghost?: boolean
}

/** Which of the pane's two tables a row belongs to. A range never crosses them. */
type RowSection = 'nodes' | 'edges'

/** What the row gestures need of a row, which both node and edge candidates satisfy. */
interface TriageRow {
    id: string
    state: PivotCandidate['state']
    deduped?: boolean
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
    /** This provider's row in the review strip carries the count of what is waiting. */
    counted: (pivotId: string) => void
}

/**
 * One pivot's candidates, as the body of the review tab. Which one is on show is
 * `PivotTriage`'s business — this class is only ever one provider's rows.
 *
 * It is a **reader** of {@link PivotManager}: the candidates, their states and the
 * session's rejections all live there, and the only state here is what is on screen —
 * which filters are typed, how the rows are sorted, which page is showing, where a
 * range anchors. So a pane torn down and rebuilt loses a scroll position and nothing
 * else.
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
    /**
     * Anchor for a Shift-click range: the row that anchors it, and the verdict its own
     * click reached. Held per section, since the edge table is a list of its own.
     */
    private anchor: { section: RowSection, id: string, mark: boolean } | null = null
    /** The node rows as currently listed on this page — what a range runs over. */
    private pageRows: PivotCandidate[] = []
    /** Whether the "rejected earlier" list is open — C5's inspectable suppression. */
    private showSuppressed = false
    /** True between the click on *save* and its outcome, so it cannot be pressed twice. */
    private saving = false
    /** Containers showing what they hold. Survives a sort, a filter and a page turn. */
    private readonly expanded = new Set<string>()
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
        this.deps.counted(this.pivotId)
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

    /** How many rows are still waiting for a verdict — the count on this pane's row. */
    public waiting(): number {
        return this.untriaged().length + this.set.edges.filter(row => row.state !== 'rejected').length
    }

    /**
     * Whether there is nothing left in here to read — what puts one of the endings on
     * screen instead of the table.
     *
     * Edge rows are verdicts of their own, so a result that is nothing but edges
     * between nodes already on canvas has plenty to triage: reading only the node rows
     * told the analyst nothing came back over a table of them.
     */
    public finished(): boolean {
        return !this.untriaged().length && !this.set.edges.length
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
        // rows already in hand, so the full facet vocabulary is available.
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
        })
        regex.append(box, text('span', 'regex'))
        items.push(regex)

        items.push(this.toolbarButton('Re-run', 'Fetch again with the same narrowing', () => this.deps.rerun(this.set)))
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
            actions: [{ label: 'Cancel', run: () => this.deps.pivots.cancelFetch(this.pivotId) }],
        })

        if (set.error) return this.state('error', 'Couldn\'t fetch candidates.', {
            sub: 'Nothing was staged. Retrying runs the same request with the narrowing you already chose.',
            actions: [
                { label: 'Retry', run: () => this.deps.rerun(set) },
                // Giving up is an answer to a failed fetch, and it needs to be here
                // rather than only in the toolbar. Nothing was staged, so it rejects
                // nothing either way.
                { label: 'Close', run: () => this.deps.close(this.pivotId), ghost: true },
            ],
        })

        if (set.refused) {
            return this.state('refused',
                `The source returned ${fmt(set.refused.count)} candidates, over the ${fmt(set.refused.limit)} limit.`,
                {
                    sub: 'Nothing was staged — narrow and run again.',
                    actions: [{ label: 'Dismiss', run: () => this.deps.close(this.pivotId) }],
                })
        }

        const actionable = this.untriaged()
        if (this.finished()) return this.finishedState()

        this.root.appendChild(this.headline())

        const columns = this.nodeColumns()
        const matching = this.matchingRows(columns)
        const pages = Math.max(1, Math.ceil(matching.length / PAGE_SIZE))
        if (this.page >= pages) this.page = pages - 1

        const scroller = document.createElement('div')
        scroller.className = 'pvt-triage-scroll'
        // Edges first: there are usually a handful of them against hundreds of nodes,
        // and below a full page of rows a core result would never be seen at all.
        // Both blocks are named only when there are two of them: one table needs no
        // title, and the count is already in the header line above it.
        const split = this.set.edges.length > 0 && actionable.length > 0
        if (this.set.edges.length) scroller.appendChild(this.edgeSection())
        this.pageRows = matching.slice(this.page * PAGE_SIZE, (this.page + 1) * PAGE_SIZE)
        if (actionable.length) {
            scroller.appendChild(this.grid(columns, this.pageRows,
                split ? this.sectionHead('Nodes', matching.length) : undefined))
        }
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
                actions: [{ label: 'Close', run: () => this.deps.close(this.pivotId) }],
            })
        }

        const ingested = set.fetched - set.suppressed - set.nodes.length
        const rejected = set.nodes.filter(c => c.state === 'rejected').length
        const close: StateAction = { label: 'Close', run: () => this.deps.close(this.pivotId) }

        if (!set.nodes.length && set.suppressed) {
            // The run came back full and the session emptied it: everything in it had
            // been rejected before. Saying "already on the canvas" here would blame the
            // graph for a verdict the analyst made, so the list that holds them is one
            // click away rather than gone with the rows.
            this.state('done', `All ${fmt(set.fetched)} were rejected earlier this session`, {
                sub: 'Nothing new came back. Restoring one offers it again on the next run.',
                actions: [this.revealAction(set.suppressed), { ...close, ghost: true }],
            })
            if (this.showSuppressed) this.root.appendChild(this.suppressedList(true))
            return
        }

        if (!ingested && !rejected && !set.suppressed && set.deduped === set.nodes.length) {
            // Their data was left untouched — a normal outcome, not a failed run.
            return this.state('done', `All ${fmt(set.fetched)} are already on the canvas — nothing to triage`, {
                sub: 'Nothing was changed: an id already here is left exactly as it was.',
                actions: [close],
            })
        }

        const tally: string[] = []
        if (ingested) tally.push(`${fmt(ingested)} ingested`)
        if (rejected + set.suppressed) tally.push(`${fmt(rejected + set.suppressed)} rejected`)
        if (set.deduped) tally.push(`${fmt(set.deduped)} already on canvas`)
        const held = rejected + set.suppressed
        this.state('done', 'Nothing left to triage', {
            sub: tally.join(' · '),
            actions: held ? [this.revealAction(held), { ...close, ghost: true }] : [close],
        })
        if (this.showSuppressed) this.root.appendChild(this.suppressedList(true))
    }

    /** Open or shut the list of what the session is holding back. */
    private revealAction(suppressed: number): StateAction {
        return {
            label: this.showSuppressed ? 'Hide the rejected' : `Show the ${fmt(suppressed)} rejected`,
            run: () => {
                this.showSuppressed = !this.showSuppressed
                this.paint()
            },
        }
    }

    private state(
        kind: string,
        title: string,
        extra: { sub?: string, actions?: StateAction[] },
    ): void {
        const box = document.createElement('div')
        box.className = `pvt-triage-state pvt-triage-${kind}`
        box.appendChild(text('div', title, 'pvt-triage-state-title'))
        if (extra.sub) box.appendChild(text('div', extra.sub, 'pvt-triage-state-sub'))

        if (extra.actions?.length) {
            const row = document.createElement('div')
            row.className = 'pvt-triage-state-actions'
            for (const action of extra.actions) {
                const button = document.createElement('button')
                button.type = 'button'
                button.className = `pvt-triage-btn${action.ghost ? ' pvt-triage-ghost' : ''}`
                button.textContent = action.label
                button.addEventListener('click', action.run)
                row.appendChild(button)
            }
            box.appendChild(row)
        }
        this.root.appendChild(box)
    }

    /** A re-run landed while rows were marked: announced, never swapped in unasked. */
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
     * advertised count is stated rather than left to look like a bug.
     */
    private headline(): HTMLElement {
        const set = this.set
        const line = document.createElement('div')
        line.className = 'pvt-triage-head'

        // `fetched` counts the nodes a provider returned, so a result made entirely of
        // edges would lead with a zero.
        line.appendChild(text('b', `${fmt(set.fetched || set.edges.length)} fetched`))
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

        // What this provider has already landed and not written back. Here rather than
        // in the footer: the footer acts on the rows still staged, and these have left
        // the set — they are on the canvas, waiting on a different decision.
        const pending = this.deps.pivots.unsavedCount(this.pivotId)
        const unsaved = pending.nodes + pending.edges
        if (unsaved) {
            line.appendChild(text('span', '·', 'pvt-triage-dot'))
            line.appendChild(text('span', `${fmt(unsaved)} unsaved`, 'pvt-triage-seg-static'))
            const save = document.createElement('button')
            save.type = 'button'
            save.className = 'pvt-triage-link'
            save.textContent = this.saving ? 'saving…' : 'save'
            save.disabled = this.saving
            save.title = 'Write this provider\'s ingested results back to the source system'
            save.addEventListener('click', () => void this.save())
            line.appendChild(save)
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
     * Write back everything this provider has ingested and not yet saved — its runs
     * only, so a Save here cannot write another provider's work. The outcome and any
     * retry are the manager's toast.
     */
    private async save(): Promise<void> {
        if (this.saving) return
        this.saving = true
        this.paint()
        try {
            await this.deps.pivots.save(this.pivotId)
        } finally {
            this.saving = false
            this.paint()
        }
    }

    /**
     * What the session is holding back, and the way out of a mis-rejection. Rejections
     * are per (pivot, candidate) and remembered for the session, so a restored id
     * is offered by the next run rather than appearing here.
     */
    private suppressedList(all = false): HTMLElement {
        // With the table on screen a staged rejection already has a row of its own, and
        // repeating it here would offer two undos for one verdict. In a finished state
        // there is no table, so this list is the only place any of them exist.
        const staged = new Set(all ? [] : this.set.nodes.map(c => c.id))
        const rows = this.deps.pivots.rejectedRows(this.pivotId).filter(row => !staged.has(row.id))

        const box = document.createElement('div')
        box.className = 'pvt-triage-suppressed'
        box.appendChild(text('div', 'Rejected earlier, so not offered again this session. Restoring one brings it back on the next run.', 'pvt-triage-state-sub'))

        for (const row of rows.slice(0, REJECTED_SHOWN)) {
            const line = document.createElement('div')
            line.className = 'pvt-triage-suppressed-row'
            line.dataset.rejected = row.id
            line.appendChild(text('span', row.label))
            const restore = document.createElement('button')
            restore.type = 'button'
            restore.className = 'pvt-triage-link'
            restore.textContent = 'restore'
            restore.addEventListener('click', () => this.deps.pivots.unreject(this.pivotId, row.id))
            line.appendChild(restore)
            box.appendChild(line)
        }

        const foot = document.createElement('div')
        foot.className = 'pvt-triage-suppressed-foot'
        if (rows.length > REJECTED_SHOWN) {
            foot.appendChild(text('span', `…and ${fmt(rows.length - REJECTED_SHOWN)} more`, 'pvt-triage-muted'))
        }
        if (rows.length > 1) {
            const every = document.createElement('button')
            every.type = 'button'
            every.className = 'pvt-triage-link'
            every.textContent = 'restore all'
            every.addEventListener('click', () => this.deps.pivots.unrejectAll(this.pivotId))
            foot.appendChild(every)
        }
        if (foot.childElementCount) box.appendChild(foot)
        return box
    }

    /* ---------- columns, filtering, sorting ---------- */

    /**
     * Columns derived from the candidates' own data, the same scan the data dock uses —
     * so a pivot needs to declare nothing to get a readable table, and the filter widget
     * over each column is the one its values ask for.
     */
    private nodeColumns(): TriageColumn<PivotCandidate>[] {
        const containers = this.set.nodes.some(row => childCount(row.raw) > 0)
        const columns: TriageColumn<PivotCandidate>[] = [{
            key: NAME_COLUMN,
            label: 'Candidate',
            type: 'text',
            read: row => row.raw.data?.label ?? row.id,
            render: containers ? row => this.nameCell(row) : undefined,
        }]

        // A container's size belongs beside its name, not after five discovered data
        // columns: one container object stages 58 attributes under a single row, and how many
        // there are is most of the decision to ingest it. Only when the set holds a
        // container at all, or the column is zeros — the rule the dock's column follows.
        if (containers) {
            columns.push({
                key: CHILDREN_COLUMN,
                label: 'Children',
                type: 'numberRange',
                width: COUNT_WIDTH,
                align: 'right',
                read: row => childCount(row.raw),
            })
        }

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

    /** From and To are the point of an edge row; the rest of its data follows. */
    private edgeColumns(): TriageColumn<PivotCandidateEdge>[] {
        // Narrower than a node column on purpose: with the same tracks as the table
        // below, an endpoint id lands under `Candidate` and two blocks read as one.
        const pair = 'minmax(90px, 0.7fr)'
        const columns: TriageColumn<PivotCandidateEdge>[] = [
            { key: 'pvt:from', label: 'From', type: 'text', read: row => row.raw.from, width: pair },
            { key: 'pvt:to', label: 'To', type: 'text', read: row => row.raw.to, width: pair },
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

    private grid(
        columns: TriageColumn<PivotCandidate>[],
        rows: PivotCandidate[],
        section?: HTMLElement,
    ): HTMLElement {
        const grid = document.createElement('div')
        grid.className = 'pvt-triage-grid'
        grid.style.setProperty('--pvt-triage-columns', track(columns))

        grid.appendChild(this.cap(this.head(columns), section))
        for (const row of rows) {
            grid.appendChild(this.row(row, columns))
            if (this.expanded.has(row.id)) grid.appendChild(this.childrenPanel(row))
        }
        return grid
    }

    /**
     * A block's lid: what it is called and how many rows it holds, sitting directly on
     * the column labels so the two read as one band. Without it the second block's
     * column labels are a stray header row in the middle of the first block's rows —
     * two grids of the same shape, stacked, with nothing to say where one ends.
     */
    private cap(head: HTMLElement, section?: HTMLElement): HTMLElement {
        if (!section) return head
        const cap = document.createElement('div')
        cap.className = 'pvt-triage-cap'
        cap.append(section, head)
        return cap
    }

    private sectionHead(title: string, count: number, note?: string): HTMLElement {
        const head = document.createElement('div')
        head.className = 'pvt-triage-sechead'
        head.appendChild(text('span', title, 'pvt-triage-sechead-title'))
        head.appendChild(text('span', fmt(count), 'pvt-triage-sechead-count'))
        if (note) head.appendChild(text('span', note, 'pvt-triage-sechead-note'))
        return head
    }

    private head(columns: TriageColumn<PivotCandidate>[]): HTMLElement {
        const head = document.createElement('div')
        head.className = 'pvt-triage-headrow'
        head.appendChild(document.createElement('span'))

        for (const column of columns) {
            const cell = document.createElement('div')
            cell.className = 'pvt-triage-th'
            if (column.align) cell.dataset.align = column.align

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
        const tick = this.tickCell(candidate)
        row.appendChild(tick.cell)
        for (const column of columns) row.appendChild(cellFor(column, candidate))
        this.paintState(candidate, state)
        row.appendChild(state)

        this.wireRow(row, candidate, 'nodes', marked => {
            row.classList.toggle('pvt-triage-row-marked', marked)
            if (tick.box) tick.box.checked = marked
            this.paintState(candidate, state)
        })
        return row
    }

    /**
     * The name, behind a caret where the row is a container.
     *
     * The caret is a hole in a hit target — the whole row marks — so where it sits is
     * the decision. At the leading edge it is always in the same place, next to the tick
     * box, and the rest of the row is uninterrupted. On the count instead, which is
     * where this started, it lands wherever the provider's data columns happen to push
     * it: with one data key that is the middle of the row, which is exactly where a
     * click means "mark this".
     */
    private nameCell(candidate: PivotCandidate): HTMLElement {
        const cell = text('span', '', 'pvt-triage-name')
        // A leaf keeps the caret's room, so a column of names does not go ragged.
        cell.appendChild(childCount(candidate.raw)
            ? this.childrenToggle(candidate)
            : text('span', '', 'pvt-triage-caret-slot'))
        cell.appendChild(text('span', cellText(candidate.raw.data?.label ?? candidate.id)))
        return cell
    }

    private childrenToggle(candidate: PivotCandidate): HTMLElement {
        const toggle = document.createElement('button')
        toggle.type = 'button'
        toggle.className = 'pvt-triage-caret'
        this.paintToggle(toggle, this.expanded.has(candidate.id))
        toggle.addEventListener('click', event => {
            // The whole row marks, so a click meaning "let me look" must not also mean
            // "I want this". Stopping here is what keeps the two gestures apart.
            event.stopPropagation()
            const open = !this.expanded.has(candidate.id)
            if (open) this.expanded.add(candidate.id)
            else this.expanded.delete(candidate.id)
            this.paintToggle(toggle, open)

            // Swapped in beside its own row rather than by repainting the table: the
            // analyst is looking at this row, and a repaint would move it under them.
            const row = toggle.closest('.pvt-triage-row')
            const panel = row?.nextElementSibling
            if (panel?.classList.contains('pvt-triage-children')) panel.remove()
            if (open && row) row.after(this.childrenPanel(candidate))
        })
        return toggle
    }

    private paintToggle(toggle: HTMLElement, open: boolean): void {
        toggle.textContent = open ? '▾' : '▸'
        toggle.setAttribute('aria-expanded', String(open))
        toggle.title = open ? 'Hide what this row holds' : 'Show what this row holds'
    }

    /**
     * What a container holds, drawn as a listing rather than as rows: nothing in here
     * can be marked, because ingest is per candidate and takes the whole container with
     * it. Reading like the table above would promise a choice that does not exist.
     */
    private childrenPanel(candidate: PivotCandidate): HTMLElement {
        const children = candidate.raw.children ?? []
        const panel = document.createElement('div')
        panel.className = 'pvt-triage-children'
        panel.dataset.children = candidate.id

        const total = children.length
        panel.appendChild(text('div',
            `${fmt(total)} ${total === 1 ? 'child' : 'children'} — ingesting this row takes all of them.`,
            'pvt-triage-state-sub'))

        const keys = collectDataAttributes(children.map(child => dataOf(child)), ['label'])
            .sort((a, b) => b.count - a.count)
            .slice(0, CHILD_DATA_KEYS)
            .map(attribute => attribute.key)

        const list = document.createElement('div')
        list.className = 'pvt-triage-childlist'
        for (const child of children.slice(0, CHILDREN_SHOWN)) {
            const row = document.createElement('div')
            row.className = 'pvt-triage-childrow'
            row.appendChild(text('span', cellText(child.data?.label ?? child.id), 'pvt-triage-childname'))

            for (const key of keys) {
                const value = cellText(child.data?.[key])
                if (value) row.appendChild(text('span', `${key}: ${value}`, 'pvt-triage-muted'))
            }
            // A child that is itself a container says so, since the row above it counted
            // only one level and this is where the level below shows up.
            const nested = childCount(child)
            if (nested) row.appendChild(text('span', `+${fmt(nested)} inside`, 'pvt-triage-muted'))
            list.appendChild(row)
        }
        if (total > CHILDREN_SHOWN) {
            list.appendChild(text('div', `…and ${fmt(total - CHILDREN_SHOWN)} more`, 'pvt-triage-muted'))
        }
        panel.appendChild(list)
        return panel
    }

    /**
     * The tick box is a state light rather than the hit target: the whole row marks, so
     * the gesture is the size of the thing it acts on. `pointer-events: none` in the
     * stylesheet keeps every pointer click on the row, leaving one code path.
     */
    private tickCell(candidate: PivotCandidate): { cell: HTMLElement, box?: HTMLInputElement } {
        const cell = document.createElement('span')
        cell.className = 'pvt-triage-cell pvt-triage-tick'

        // A rejected row loses its checkbox rather than showing an unticked one:
        // rejection is a verdict, and must not read as mere deselection (C6).
        if (candidate.state === 'rejected') {
            cell.appendChild(text('span', '✕', 'pvt-triage-rejected-mark'))
            return { cell }
        }
        if (candidate.deduped) {
            cell.appendChild(text('span', '–', 'pvt-triage-muted'))
            return { cell }
        }

        const box = tickBox(candidate.state === 'marked', `Select ${cellText(candidate.raw.data?.label ?? candidate.id)}`)
        cell.appendChild(box)
        return { cell, box }
    }

    /* ---------- row gestures ---------- */

    /**
     * Row gestures, the same shape as the data dock's: the whole row is the hit target,
     * a plain click marks or unmarks it, and Shift takes a range from the last row
     * clicked. What a range applies is the verdict that anchoring click reached, so
     * unmarking forty rows after a too-wide *Select all matching* is two clicks.
     *
     * The range runs over the rows **as currently listed** — sorted, narrowed, on this
     * page — because that is what the analyst can see.
     *
     * A mark is not a canvas selection: nothing in this pane is in the graph, so these
     * gestures stage nothing and move nothing on the canvas.
     */
    private wireRow(element: HTMLElement, row: TriageRow, section: RowSection, reflect: (marked: boolean) => void): void {
        // Shift-click is a range gesture here, but it is also the browser's own "extend
        // the text selection to here", which drags a blue smear across every row the
        // range covers. Cancelled at mousedown, where that selection is actually made.
        // Only when Shift is held: a plain click still puts a caret in the cell, so the
        // values stay selectable text.
        element.addEventListener('mousedown', event => {
            if (event.shiftKey) event.preventDefault()
        })

        element.addEventListener('click', event => {
            const target = event.target as HTMLElement
            // The row's own verbs — undo, restore — keep their own meaning. The tick box
            // is not one of them: it is this row's own control, and a click on it, which
            // only the keyboard can produce, marks the row like any other click would.
            if (!(target instanceof HTMLInputElement) && target.closest('button, a, select, textarea')) return
            if (!markable(row)) return

            const anchor = this.anchor
            if (event.shiftKey && anchor?.section === section && this.applyRange(section, anchor, row.id)) return

            const mark = row.state !== 'marked'
            this.anchor = { section, id: row.id, mark }
            // `mark` is silent by design: repainting the table on every tick would lose
            // the analyst's place. The row, the state cell and the footer move instead.
            this.deps.pivots.mark(this.pivotId, row.id, mark)
            // Read off the row's state and written back to the box, so a keyboard Space —
            // which flips that box itself before any of this runs — cannot toggle twice.
            // Cancelling its flip instead does not work: the browser restores the box
            // after the handler returns, leaving the tick disagreeing with the row.
            reflect(mark)
            this.refreshFooter()
        })
    }

    /**
     * Apply the anchor's verdict to every markable row between it and `toId`. Answers
     * `false` when the anchor has since been sorted, filtered or paged off the screen,
     * which leaves the caller to treat the click as the plain click it now looks like
     * — a range to a row nobody can see is worse than no range at all.
     */
    private applyRange(section: RowSection, anchor: { id: string, mark: boolean }, toId: string): boolean {
        const rows: TriageRow[] = section === 'nodes' ? this.pageRows : this.set.edges
        const from = rows.findIndex(row => row.id === anchor.id)
        const to = rows.findIndex(row => row.id === toId)
        if (from < 0 || to < 0) return false

        const [start, end] = from <= to ? [from, to] : [to, from]
        for (const row of rows.slice(start, end + 1)) {
            if (markable(row)) this.deps.pivots.mark(this.pivotId, row.id, anchor.mark)
        }
        // A range moves too many rows to touch one by one, and `paint` keeps the scroll
        // position, so the analyst's place survives it.
        this.paint()
        return true
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
     * their own section rather than being squeezed into the node table's columns.
     */
    private edgeSection(): HTMLElement {
        const wrap = document.createElement('div')
        wrap.className = 'pvt-triage-edges'

        const columns = this.edgeColumns()
        const grid = document.createElement('div')
        grid.className = 'pvt-triage-grid'
        grid.style.setProperty('--pvt-triage-columns', track(columns))

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
        grid.appendChild(this.cap(head, this.sectionHead(
            'Edges', this.set.edges.length, 'both ends are already on the canvas')))

        for (const edge of this.set.edges) {
            const row = document.createElement('div')
            row.className = `pvt-triage-row pvt-triage-row-${edge.state}`
            row.dataset.edge = edge.id

            const cell = document.createElement('span')
            cell.className = 'pvt-triage-cell pvt-triage-tick'
            const label = `${cellText(edge.raw.from)} → ${cellText(edge.raw.to)}`
            // Rejected here means what it means in the node table: a verdict, not an
            // unticked box (C6).
            const box = edge.state === 'rejected' ? undefined : tickBox(edge.state === 'marked', `Select ${label}`)
            cell.appendChild(box ?? text('span', '✕', 'pvt-triage-rejected-mark'))
            row.appendChild(cell)

            for (const column of columns) row.appendChild(cellFor(column, edge))
            row.appendChild(document.createElement('span'))
            this.wireRow(row, edge, 'edges', marked => {
                row.classList.toggle('pvt-triage-row-marked', marked)
                if (box) box.checked = marked
            })
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
        this.deps.counted(this.pivotId)
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
        // the table — the two are different acts on a 1,800-row set. Both this and the
        // pager below read the node table, so a set of nothing but edge rows has neither.
        const hasNodes = this.untriaged().length > 0
        const selectable = matching.filter(c => c.state === 'candidate' && !c.deduped)
        const narrowed = this.narrowing()
        if (hasNodes) foot.appendChild(this.footButton(
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
        } else if (hasNodes) {
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

/** One tick column, the columns themselves, and the row's own state on the right. */
function track<T>(columns: TriageColumn<T>[]): string {
    return `28px ${columns.map(column => column.width ?? DEFAULT_TRACK).join(' ')} 96px`
}

/** A body cell, carrying whatever its column declared about how to read it. */
function cellFor<T>(column: TriageColumn<T>, row: T): HTMLElement {
    const drawn = column.render?.(row)
    const cell = drawn
        ? text('span', '', 'pvt-triage-cell')
        : text('span', cellText(column.read(row)), 'pvt-triage-cell')
    if (drawn) cell.appendChild(drawn)
    cell.dataset.column = column.key
    if (column.align) cell.dataset.align = column.align
    return cell
}

/** Direct children, so a nested container's own row reports the level below it. */
function childCount(raw: RawNode): number {
    return raw.children?.length ?? 0
}

/** A `RawNode` / `RawEdge` seen as something with a data bag, for the shared scan. */
function dataOf(raw: RawNode | RawEdge): { getData(): Record<string, unknown> } {
    return { getData: () => (raw.data ?? {}) as Record<string, unknown> }
}

/** Whether a row can still be marked at all: not rejected, not already on the canvas. */
function markable(row: TriageRow): boolean {
    return !row.deduped && row.state !== 'rejected'
}

function tickBox(checked: boolean, label: string): HTMLInputElement {
    const box = document.createElement('input')
    box.type = 'checkbox'
    box.checked = checked
    box.setAttribute('aria-label', label)
    return box
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
