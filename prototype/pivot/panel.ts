// Pivot mode's panel: the origin, the pivots that apply to it, and their narrowing.
// This is what `RailModeDefinition.render()` returns, appended below the mode's tool rows.
//
// Every state and every string here is fixed in prd/pivot-enrichment-ui-states.md §2-§4.

import type { Node } from '../../src/Node'
import type { PivotManager } from './manager'
import type { PivotDefinition, PivotFacet, PivotNarrowing } from './types'

export interface PanelDeps {
    manager: PivotManager
    origin: () => Node[]
    clearOrigin: () => void
    /** Bring the pivot's triage tab to the front. */
    showTriage: (pivotId: string) => void
    narrowing: Map<string, PivotNarrowing>
    /** Re-run summarize for one pivot with its current narrowing. */
    resummarize: (def: PivotDefinition) => void
    run: (def: PivotDefinition) => void
}

const fmt = (n: number) => n.toLocaleString()

export function buildPanel(deps: PanelDeps): HTMLElement {
    const { manager, origin } = deps
    const root = document.createElement('div')
    root.className = 'pvtp-panel'

    const nodes = origin()

    root.appendChild(section('Origin'))
    root.appendChild(nodes.length ? originChip(nodes, deps) : emptyOrigin())

    const applicable = manager.applicable(nodes)
    const originLess = nodes.length ? manager.originLess() : []

    root.appendChild(divider())
    root.appendChild(section(
        nodes.length === 0
            ? 'Run without an origin'
            : applicable.length === 0
                ? 'No pivots apply to this origin'
                : `${applicable.length} pivot${applicable.length === 1 ? '' : 's'} apply`,
    ))

    const body = document.createElement('div')
    body.className = 'pvtp-panel-body'
    for (const def of applicable) body.appendChild(entry(def, deps))
    root.appendChild(body)

    // Origin-less pivots fold into a collapsed group once an origin is picked (C14).
    if (originLess.length) {
        const details = document.createElement('details')
        details.className = 'pvtp-group'
        const summary = document.createElement('summary')
        summary.textContent = `Without an origin (${originLess.length})`
        details.appendChild(summary)
        const inner = document.createElement('div')
        inner.className = 'pvtp-panel-body'
        for (const def of originLess) inner.appendChild(entry(def, deps))
        details.appendChild(inner)
        root.appendChild(details)
    }

    return root
}

function section(text: string): HTMLElement {
    const el = document.createElement('div')
    el.className = 'pvtp-section'
    el.textContent = text
    return el
}

function divider(): HTMLElement {
    const el = document.createElement('div')
    el.className = 'pvtp-divider'
    return el
}

function emptyOrigin(): HTMLElement {
    const el = document.createElement('div')
    el.className = 'pvtp-origin-empty'
    el.textContent = 'Nothing picked — click a node on the canvas, or run one of the pivots below.'
    return el
}

function originChip(nodes: Node[], deps: PanelDeps): HTMLElement {
    const el = document.createElement('div')
    el.className = 'pvtp-origin'

    const dot = document.createElement('span')
    dot.className = 'pvtp-origin-dot'
    dot.style.background = String(nodes[0]?.getStyle().color ?? '#8fd14f')
    el.appendChild(dot)

    const label = document.createElement('span')
    label.className = 'pvtp-origin-label'
    label.textContent = nodes.length === 1
        ? String((nodes[0].getData() as { label?: string })?.label ?? nodes[0].id)
        : `${nodes.length} nodes`
    el.appendChild(label)

    const clear = document.createElement('button')
    clear.className = 'pvtp-link'
    clear.textContent = 'Clear'
    clear.addEventListener('click', deps.clearOrigin)
    el.appendChild(clear)

    return el
}

function entry(def: PivotDefinition, deps: PanelDeps): HTMLElement {
    const { manager } = deps
    const state = manager.stateOf(def.id)
    const narrowing = deps.narrowing.get(def.id) ?? {}
    const set = manager.sets.get(def.id)

    const el = document.createElement('div')
    el.className = 'pvtp-entry'

    // --- top line: label and whatever number we can stand behind
    const top = document.createElement('div')
    top.className = 'pvtp-entry-top'
    const label = document.createElement('span')
    label.className = 'pvtp-entry-label'
    label.textContent = def.label
    top.appendChild(label)

    const count = document.createElement('span')
    count.className = 'pvtp-entry-count'
    if (state.status === 'loading') {
        count.className += ' pvtp-skel'
        count.textContent = ''
    } else if (state.status === 'stale') {
        // Dimmed, never blanked (S5).
        count.className += ' pvtp-stale'
        count.textContent = `~${fmt(state.summary.total)}`
    } else if (state.status === 'ready') {
        count.textContent = `~${fmt(state.summary.total)}`
    }
    if (set?.loading) {
        count.className = 'pvtp-entry-count pvtp-muted'
        count.textContent = 'Fetching…'
    }
    top.appendChild(count)
    el.appendChild(top)

    if (state.status === 'failed') {
        el.appendChild(errorLine("Couldn't reach the source.", 'Retry', () => deps.resummarize(def)))
        return el
    }

    const summary = state.status === 'ready' || state.status === 'stale' ? state.summary : undefined

    // --- breakdown
    // Only while nothing is narrowed on that facet: once URLs is ticked the total is ~210, and
    // a line still reading "1,800 Domains · 210 URLs" would contradict it. The facet list below
    // carries the per-option counts anyway, so nothing is lost.
    const multi = summary?.facets?.find((f) => f.type === 'multiselect' && f.options?.length)
    const narrowedOn = multi ? (narrowing[multi.key] as string[] | undefined)?.length : 0
    if (multi?.options && !narrowedOn) {
        const breakdown = document.createElement('div')
        breakdown.className = 'pvtp-breakdown'
        breakdown.textContent = multi.options
            .map((o) => `${fmt(o.count ?? 0)} ${o.label}`)
            .join(' · ')
        el.appendChild(breakdown)
    }

    // --- the gate (D4): number, limit, way forward — in that order
    const total = summary?.total ?? 0
    const overCap = def.maxCandidates != null && total > def.maxCandidates
    if (overCap && state.status === 'ready') {
        const refusal = document.createElement('div')
        refusal.className = 'pvtp-refusal'
        refusal.textContent = `~${fmt(total)} exceeds this pivot's cap of ${fmt(def.maxCandidates!)} — narrow further to fetch`
        el.appendChild(refusal)
    }

    // --- narrowing controls
    for (const facet of summary?.facets ?? []) {
        el.appendChild(facetControl(def, facet, narrowing, deps))
    }

    // --- actions
    const actions = document.createElement('div')
    actions.className = 'pvtp-actions'

    if (Object.keys(narrowing).length > 0) {
        const clear = document.createElement('button')
        clear.className = 'pvtp-link'
        clear.textContent = 'Clear'
        clear.addEventListener('click', () => {
            deps.narrowing.set(def.id, {})
            deps.resummarize(def)
        })
        actions.appendChild(clear)
    }

    const spacer = document.createElement('span')
    spacer.className = 'pvtp-spacer'
    actions.appendChild(spacer)

    if (set?.loading) {
        const cancel = document.createElement('button')
        cancel.className = 'pvtp-link'
        cancel.textContent = 'Cancel'
        cancel.addEventListener('click', () => manager.cancelFetch(def.id))
        actions.appendChild(cancel)
    } else if (set && !set.loading) {
        const link = document.createElement('button')
        link.className = 'pvtp-link pvtp-strong'
        const staged = set.nodes.length + set.edges.length
        link.textContent = set.refused ? 'refused — see pane →' : `${fmt(staged)} in triage →`
        link.addEventListener('click', () => deps.showTriage(def.id))
        actions.appendChild(link)

        // A pivot with a staged set must still be runnable, or C7's "a re-run replaces this
        // pivot's candidate set" is unreachable and narrowing again does nothing.
        const rerun = document.createElement('button')
        rerun.className = 'pvtp-btn pvtp-ghost'
        rerun.textContent = 'Re-run'
        rerun.disabled = overCap
        rerun.addEventListener('click', () => deps.run(def))
        actions.appendChild(rerun)
    } else {
        const button = document.createElement('button')
        button.className = 'pvtp-btn'
        const blocked = overCap || state.status === 'loading' || state.status === 'stale'
        button.disabled = blocked
        if (!def.summarize) button.textContent = 'Run'
        else if (state.status === 'ready') button.textContent = overCap ? 'Fetch' : `Fetch ${fmt(total)}`
        else button.textContent = 'Fetch'
        button.addEventListener('click', () => deps.run(def))
        actions.appendChild(button)
    }

    el.appendChild(actions)
    return el
}

function errorLine(text: string, actionLabel: string, onClick: () => void): HTMLElement {
    const el = document.createElement('div')
    el.className = 'pvtp-error'
    const span = document.createElement('span')
    span.textContent = text
    el.appendChild(span)
    const button = document.createElement('button')
    button.className = 'pvtp-link'
    button.textContent = actionLabel
    button.addEventListener('click', onClick)
    el.appendChild(button)
    return el
}

/** The five narrowing types — `Exclude<FilterFacetType, 'regex'>` (D18). No regex widget. */
function facetControl(def: PivotDefinition, facet: PivotFacet, narrowing: PivotNarrowing, deps: PanelDeps): HTMLElement {
    const wrap = document.createElement('div')
    wrap.className = 'pvtp-facet'

    const label = document.createElement('div')
    label.className = 'pvtp-facet-label'
    label.textContent = facet.label
    wrap.appendChild(label)

    const commit = (value: unknown) => {
        const next = { ...narrowing }
        if (value == null || (Array.isArray(value) && value.length === 0) || value === '') delete next[facet.key]
        else next[facet.key] = value
        deps.narrowing.set(def.id, next)
        deps.resummarize(def)
    }

    switch (facet.type) {
        case 'multiselect': {
            const picked = new Set((narrowing[facet.key] as string[] | undefined) ?? [])
            const opts = document.createElement('div')
            opts.className = 'pvtp-opts'
            for (const option of facet.options ?? []) {
                const row = document.createElement('label')
                row.className = 'pvtp-opt'
                const box = document.createElement('input')
                box.type = 'checkbox'
                box.checked = picked.has(option.value)
                box.addEventListener('change', () => {
                    if (box.checked) picked.add(option.value)
                    else picked.delete(option.value)
                    commit([...picked])
                })
                row.appendChild(box)
                const text = document.createElement('span')
                text.textContent = option.label
                row.appendChild(text)
                if (option.count != null) {
                    const n = document.createElement('span')
                    n.className = 'pvtp-opt-count'
                    n.textContent = fmt(option.count)
                    row.appendChild(n)
                }
                opts.appendChild(row)
            }
            wrap.appendChild(opts)
            break
        }
        case 'numberRange': {
            const range = (narrowing[facet.key] as { min?: number, max?: number } | undefined) ?? {}
            const pair = document.createElement('div')
            pair.className = 'pvtp-range'
            for (const bound of ['min', 'max'] as const) {
                const input = document.createElement('input')
                input.type = 'number'
                input.className = 'pvtp-control'
                input.placeholder = bound === 'min' ? 'Min' : 'Max'
                input.value = range[bound] != null ? String(range[bound]) : ''
                input.addEventListener('change', () => {
                    const next = { ...range, [bound]: input.value === '' ? undefined : Number(input.value) }
                    commit(next.min == null && next.max == null ? undefined : next)
                })
                pair.appendChild(input)
            }
            wrap.appendChild(pair)
            break
        }
        case 'select': {
            const select = document.createElement('select')
            select.className = 'pvtp-control'
            const any = document.createElement('option')
            any.value = ''
            any.textContent = 'Any'
            select.appendChild(any)
            for (const option of facet.options ?? []) {
                const opt = document.createElement('option')
                opt.value = option.value
                opt.textContent = option.label
                select.appendChild(opt)
            }
            select.value = String(narrowing[facet.key] ?? '')
            select.addEventListener('change', () => commit(select.value || undefined))
            wrap.appendChild(select)
            break
        }
        case 'boolean': {
            const row = document.createElement('label')
            row.className = 'pvtp-opt'
            const box = document.createElement('input')
            box.type = 'checkbox'
            box.checked = narrowing[facet.key] === true
            box.addEventListener('change', () => commit(box.checked || undefined))
            row.appendChild(box)
            const text = document.createElement('span')
            text.textContent = facet.label
            row.appendChild(text)
            wrap.replaceChildren(row)
            break
        }
        default: {
            const input = document.createElement('input')
            input.type = 'text'
            input.className = 'pvtp-control'
            input.placeholder = 'Contains…'
            input.value = String(narrowing[facet.key] ?? '')
            input.dataset.focusKey = `${def.id}:${facet.key}`
            // `change`, not `input`: every keystroke would re-run summarize.
            input.addEventListener('change', () => commit(input.value || undefined))
            wrap.appendChild(input)
        }
    }

    return wrap
}
