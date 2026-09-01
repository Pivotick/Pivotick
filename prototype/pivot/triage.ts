// The triage pane: a dock tab holding one pivot's candidates. Nothing here is in the graph,
// the data table or any facet count until it is ingested.
//
// States and copy are fixed in prd/pivot-enrichment-ui-states.md §5.

import type { PivotManager } from './manager'
import type { Candidate, CandidateSet } from './types'

/** Client-side filters over data already in hand — so regex IS allowed here (D5, D18). */
interface Filters {
    value: string
    type: string
    regex: boolean
}

const filters = new Map<string, Filters>()
/** Rendering more than this is pointless; TableGrid virtualises above 200 for the same reason. */
const RENDER_CAP = 200

const fmt = (n: number) => n.toLocaleString()

export interface TriageDeps {
    manager: PivotManager
    onIngest: (set: CandidateSet) => void
    refresh: () => void
}

export function buildTriage(set: CandidateSet, deps: TriageDeps): HTMLElement {
    const root = document.createElement('div')
    root.className = 'pvtp-triage'

    if (set.loading) return withState(root, 'loading', 'Fetching candidates…', 'Cancel', () => deps.manager.cancelFetch(set.pivotId))
    if (set.error) return withState(root, 'error', "Couldn't fetch candidates.", 'Retry', () => deps.refresh(), 'Nothing was staged. Retrying runs the same request with the narrowing you already chose.')
    if (set.refused) {
        return withState(
            root, 'refused',
            `The source returned ${fmt(set.refused.returned)} candidates, over the ${fmt(set.refused.ceiling)} limit.`,
            undefined, undefined,
            'Nothing was staged — narrow and run again.',
        )
    }

    const visible = set.nodes
    if (visible.length === 0 && set.edges.length === 0) {
        if (set.deduped > 0 && set.fetched > 0) {
            return withState(root, 'ok', `All ${fmt(set.fetched)} are already on the canvas — nothing to triage`, undefined, undefined,
                'Their data was left untouched. This is a normal outcome, not a failed run.')
        }
        if (set.fetched === 0) {
            return withState(root, 'empty', 'No candidates came back', undefined, undefined, 'The narrowing may be tighter than the data.')
        }
        return withState(root, 'ok', 'Nothing left to triage', undefined, undefined,
            `${fmt(set.fetched - set.suppressed - remaining(set))} handled · ${fmt(deps.manager.rejectedCount(set.pivotId))} rejected`)
    }

    // A re-run landed while rows were marked (C7) — announce it, never swap silently.
    if (set.pending) {
        const banner = document.createElement('div')
        banner.className = 'pvtp-interrupt'
        const text = document.createElement('span')
        const incoming = set.pending.nodes.length || set.pending.fetched
        text.textContent = `This pivot was run again. ${fmt(incoming)} new candidates are ready.`
        banner.appendChild(text)
        const show = document.createElement('button')
        show.className = 'pvtp-btn'
        show.textContent = 'Show new'
        show.addEventListener('click', () => {
            const next = set.pending!
            deps.manager.sets.set(set.pivotId, next)
            deps.manager.changed()
        })
        banner.appendChild(show)
        const keep = document.createElement('button')
        keep.className = 'pvtp-btn pvtp-ghost'
        keep.textContent = 'Keep triaging'
        keep.addEventListener('click', () => { set.pending = undefined; deps.manager.changed() })
        banner.appendChild(keep)
        root.appendChild(banner)
    }

    root.appendChild(headline(set, deps))

    const f = filters.get(set.pivotId) ?? { value: '', type: '', regex: false }
    filters.set(set.pivotId, f)
    const matching = visible.filter((c) => matches(c, f))

    // The footer is rebuilt in place as rows are ticked, so marking never re-renders the table.
    const footerEl = document.createElement('div')
    const syncFooter = () => footerEl.replaceChildren(footer(set, matching, deps))

    root.appendChild(filterRow(set, f, deps))
    root.appendChild(table(matching, set, deps, syncFooter))
    if (set.edges.length) root.appendChild(edgeSection(set, deps, syncFooter))
    syncFooter()
    root.appendChild(footerEl)
    return root
}

function remaining(set: CandidateSet): number {
    return set.nodes.filter((c) => c.state !== 'rejected').length
}

function withState(root: HTMLElement, kind: string, title: string, actionLabel?: string, onAction?: () => void, sub?: string): HTMLElement {
    const box = document.createElement('div')
    box.className = `pvtp-triage-state pvtp-triage-${kind}`
    const h = document.createElement('div')
    h.className = 'pvtp-triage-title'
    h.textContent = title
    box.appendChild(h)
    if (sub) {
        const s = document.createElement('div')
        s.className = 'pvtp-triage-sub'
        s.textContent = sub
        box.appendChild(s)
    }
    if (actionLabel && onAction) {
        const b = document.createElement('button')
        b.className = 'pvtp-btn'
        b.textContent = actionLabel
        b.addEventListener('click', onAction)
        box.appendChild(b)
    }
    root.appendChild(box)
    return root
}

/** Always honest: fetched, deduped, and what the session already rejected (D10, D14, D23). */
function headline(set: CandidateSet, deps: TriageDeps): HTMLElement {
    const el = document.createElement('div')
    el.className = 'pvtp-headline'

    const fetched = document.createElement('b')
    fetched.textContent = `${fmt(set.fetched)} fetched`
    el.appendChild(fetched)

    if (set.deduped > 0) el.appendChild(segment(`${fmt(set.deduped)} already on canvas (skipped)`))

    if (set.suppressed > 0) {
        // C5: the rejected segment is a button, so the suppression is inspectable, not a claim.
        const dot = document.createElement('span')
        dot.className = 'pvtp-dot'
        dot.textContent = '·'
        el.appendChild(dot)
        const button = document.createElement('button')
        button.className = 'pvtp-seg-btn'
        button.textContent = `${fmt(set.suppressed)} rejected earlier`
        button.title = 'Suppressed because they were explicitly rejected earlier this session'
        button.addEventListener('click', () => {
            deps.manager.sets.set(set.pivotId, { ...set, suppressed: 0 })
            deps.manager.changed()
        })
        el.appendChild(button)
    }

    const spacer = document.createElement('span')
    spacer.className = 'pvtp-spacer'
    el.appendChild(spacer)

    const note = document.createElement('span')
    note.className = 'pvtp-muted'
    note.textContent = 'a shrink from the advertised count is expected, not an error'
    el.appendChild(note)
    return el
}

function segment(text: string): DocumentFragment {
    const frag = document.createDocumentFragment()
    const dot = document.createElement('span')
    dot.className = 'pvtp-dot'
    dot.textContent = '·'
    frag.appendChild(dot)
    const span = document.createElement('span')
    span.textContent = text
    frag.appendChild(span)
    return frag
}

function matches(candidate: Candidate, f: Filters): boolean {
    const data = candidate.raw.data as { label?: string, type?: string } | undefined
    const label = String(data?.label ?? candidate.id)
    if (f.type && data?.type !== f.type) return false
    if (!f.value) return true
    if (f.regex) {
        try { return new RegExp(f.value, 'i').test(label) } catch { return true }
    }
    return label.toLowerCase().includes(f.value.toLowerCase())
}

function filterRow(set: CandidateSet, f: Filters, deps: TriageDeps): HTMLElement {
    const el = document.createElement('div')
    el.className = 'pvtp-filters'

    const value = document.createElement('input')
    value.className = 'pvtp-filter'
    value.placeholder = f.regex ? '/pattern/' : 'Filter rows…'
    value.value = f.value
    value.dataset.focusKey = `filter:${set.pivotId}`
    value.addEventListener('input', () => { f.value = value.value; deps.manager.changed() })
    el.appendChild(labelled('Value', value))

    const types = [...new Set(set.nodes.map((c) => (c.raw.data as { type?: string })?.type).filter(Boolean))] as string[]
    const select = document.createElement('select')
    select.className = 'pvtp-filter'
    const any = document.createElement('option')
    any.value = ''
    any.textContent = 'All'
    select.appendChild(any)
    for (const type of types) {
        const opt = document.createElement('option')
        opt.value = type
        opt.textContent = type
        select.appendChild(opt)
    }
    select.value = f.type
    select.addEventListener('change', () => { f.type = select.value; deps.manager.changed() })
    el.appendChild(labelled('Type', select))

    const regexWrap = document.createElement('label')
    regexWrap.className = 'pvtp-opt pvtp-regex'
    const regex = document.createElement('input')
    regex.type = 'checkbox'
    regex.checked = f.regex
    regex.addEventListener('change', () => { f.regex = regex.checked; deps.manager.changed() })
    regexWrap.appendChild(regex)
    const regexLabel = document.createElement('span')
    regexLabel.textContent = 'regex'
    regexLabel.title = 'Allowed here: these filters are client-side over data already in hand (D5). Narrowing, which is server-bound, has no regex.'
    regexWrap.appendChild(regexLabel)
    el.appendChild(regexWrap)

    return el
}

function labelled(text: string, control: HTMLElement): HTMLElement {
    const wrap = document.createElement('div')
    wrap.className = 'pvtp-filter-cell'
    const label = document.createElement('div')
    label.className = 'pvtp-th'
    label.textContent = text
    wrap.appendChild(label)
    wrap.appendChild(control)
    return wrap
}

function table(rows: Candidate[], set: CandidateSet, deps: TriageDeps, syncFooter: () => void): HTMLElement {
    const el = document.createElement('div')
    el.className = 'pvtp-rows'

    for (const candidate of rows.slice(0, RENDER_CAP)) {
        const data = candidate.raw.data as { label?: string, type?: string, first_seen?: string, occurrences?: number } | undefined
        const row = document.createElement('div')
        row.className = `pvtp-row pvtp-row-${candidate.state}${candidate.deduped ? ' pvtp-row-deduped' : ''}`

        const cell = document.createElement('span')
        cell.className = 'pvtp-cell pvtp-cell-check'
        if (candidate.state === 'rejected') {
            // Rejection is not deselection: the row loses its checkbox entirely (C6).
            const mark = document.createElement('span')
            mark.className = 'pvtp-rejected-mark'
            mark.textContent = '✕'
            cell.appendChild(mark)
        } else if (candidate.deduped) {
            const mark = document.createElement('span')
            mark.className = 'pvtp-muted'
            mark.textContent = '–'
            cell.appendChild(mark)
        } else {
            const box = document.createElement('input')
            box.type = 'checkbox'
            box.checked = candidate.state === 'marked'
            box.addEventListener('change', () => {
                deps.manager.mark(set, candidate.id, box.checked)
                row.classList.toggle('pvtp-row-marked', box.checked)
                state.replaceChildren()
                state.className = `pvtp-cell pvtp-cell-state${box.checked ? ' pvtp-strong' : ''}`
                state.textContent = box.checked ? 'will ingest' : ''
                syncFooter()
            })
            cell.appendChild(box)
        }
        row.appendChild(cell)

        row.appendChild(textCell(String(data?.label ?? candidate.id), 'pvtp-cell-value'))
        row.appendChild(textCell(String(data?.type ?? ''), 'pvtp-cell-type'))
        row.appendChild(textCell(String(data?.first_seen ?? ''), 'pvtp-cell-seen'))
        row.appendChild(textCell(String(data?.occurrences ?? ''), 'pvtp-cell-num'))

        const state = document.createElement('span')
        state.className = 'pvtp-cell pvtp-cell-state'
        if (candidate.deduped) {
            state.textContent = 'on canvas'
            state.className += ' pvtp-muted'
        } else if (candidate.state === 'rejected') {
            const undo = document.createElement('button')
            undo.className = 'pvtp-link'
            undo.textContent = 'undo'
            undo.addEventListener('click', () => deps.manager.unreject(set, candidate.id))
            state.appendChild(undo)
        } else if (candidate.state === 'marked') {
            state.textContent = 'will ingest'
            state.className += ' pvtp-strong'
        }
        row.appendChild(state)

        el.appendChild(row)
    }

    if (rows.length > RENDER_CAP) {
        const more = document.createElement('div')
        more.className = 'pvtp-more'
        more.textContent = `showing the first ${RENDER_CAP} of ${fmt(rows.length)} matching rows`
        el.appendChild(more)
    }
    return el
}

function textCell(text: string, className: string): HTMLElement {
    const el = document.createElement('span')
    el.className = `pvtp-cell ${className}`
    el.textContent = text
    return el
}

/** Edge-only results get their own section, never the node table's columns (D24). */
function edgeSection(set: CandidateSet, deps: TriageDeps, syncFooter: () => void): HTMLElement {
    const wrap = document.createElement('div')

    const head = document.createElement('div')
    head.className = 'pvtp-sec-head'
    head.textContent = `Edges between nodes already on canvas — ${fmt(set.edges.length)}`
    wrap.appendChild(head)

    for (const edge of set.edges) {
        const row = document.createElement('div')
        row.className = `pvtp-row pvtp-row-${edge.state}`
        const cell = document.createElement('span')
        cell.className = 'pvtp-cell pvtp-cell-check'
        const box = document.createElement('input')
        box.type = 'checkbox'
        box.checked = edge.state === 'marked'
        box.addEventListener('change', () => {
            deps.manager.mark(set, edge.id, box.checked)
            row.classList.toggle('pvtp-row-marked', box.checked)
            syncFooter()
        })
        cell.appendChild(box)
        row.appendChild(cell)
        row.appendChild(textCell(String(edge.raw.from), 'pvtp-cell-value'))
        row.appendChild(textCell(String(edge.raw.to), 'pvtp-cell-value'))
        row.appendChild(textCell(String((edge.raw.data as { kind?: string })?.kind ?? ''), 'pvtp-cell-type'))
        wrap.appendChild(row)
    }
    return wrap
}

function footer(set: CandidateSet, matching: Candidate[], deps: TriageDeps): HTMLElement {
    const el = document.createElement('div')
    el.className = 'pvtp-footer'

    const marked = set.nodes.filter((c) => c.state === 'marked').length
        + set.edges.filter((e) => e.state === 'marked').length

    const ingest = document.createElement('button')
    ingest.className = 'pvtp-btn'
    ingest.textContent = `Ingest selected (${fmt(marked)})`
    ingest.disabled = marked === 0
    ingest.addEventListener('click', () => deps.onIngest(set))
    el.appendChild(ingest)

    const selectable = matching.filter((c) => c.state === 'candidate' && !c.deduped)
    const selectAll = document.createElement('button')
    selectAll.className = 'pvtp-btn pvtp-ghost'
    // Honest about what it matched, never a bare "select all" while a filter is active.
    selectAll.textContent = `Select all ${fmt(selectable.length)} matching`
    selectAll.disabled = selectable.length === 0
    selectAll.addEventListener('click', () => {
        for (const candidate of selectable) candidate.state = 'marked'
        deps.manager.changed()
    })
    el.appendChild(selectAll)

    const rejectSelected = document.createElement('button')
    rejectSelected.className = 'pvtp-btn pvtp-ghost'
    rejectSelected.textContent = 'Reject selected'
    rejectSelected.disabled = marked === 0
    rejectSelected.addEventListener('click', () =>
        deps.manager.reject(set, set.nodes.filter((c) => c.state === 'marked').map((c) => c.id)))
    el.appendChild(rejectSelected)

    const rejectAll = document.createElement('button')
    rejectAll.className = 'pvtp-btn pvtp-ghost'
    rejectAll.textContent = 'Reject all remaining'
    rejectAll.addEventListener('click', () => deps.manager.rejectRemaining(set))
    el.appendChild(rejectAll)

    const spacer = document.createElement('span')
    spacer.className = 'pvtp-spacer'
    el.appendChild(spacer)

    const note = document.createElement('span')
    note.className = 'pvtp-muted'
    note.textContent = 'closing this pane rejects nothing — leftovers are re-offered next run'
    el.appendChild(note)

    return el
}
