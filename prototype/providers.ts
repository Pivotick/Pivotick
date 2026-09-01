// The fake provider, per the brief's §6. No network: every number below is derived from the
// facet data, so the gate genuinely lifts rather than being scripted to.

import type { Node } from '../src/Node'
import type { PivotDefinition, PivotResult, PivotSummary } from './pivot/types'

/** One line in the visible call log — how the zero-calls rule is demonstrated, not claimed. */
export interface CallLogEntry {
    at: number
    pivotId: string
    call: 'summarize' | 'fetch'
    args: string
    outcome: 'served' | 'cancelled' | 'failed'
    ms?: number
}

export const callLog: CallLogEntry[] = []
const listeners = new Set<() => void>()

export function onCallLog(fn: () => void): () => void {
    listeners.add(fn)
    return () => listeners.delete(fn)
}

function announce() {
    for (const fn of listeners) fn()
}

/** Harness knobs, driven from the panel at the bottom of the page. */
export const harness = {
    latencyMin: 400,
    latencyMax: 900,
    /** When set, the next provider call rejects. Cleared once it fires. */
    failNext: false,
}

function latency(): number {
    const { latencyMin, latencyMax } = harness
    return latencyMin + Math.random() * Math.max(0, latencyMax - latencyMin)
}

/**
 * Sleep that honours an abort signal, logging how the call ended. Every fake call goes
 * through here so cancellation is real rather than simulated.
 */
function call<T>(pivotId: string, kind: 'summarize' | 'fetch', args: string, signal: AbortSignal, produce: () => T): Promise<T> {
    const entry: CallLogEntry = { at: Date.now(), pivotId, call: kind, args, outcome: 'served' }
    callLog.unshift(entry)
    announce()

    const started = performance.now()
    const shouldFail = harness.failNext
    if (shouldFail) harness.failNext = false

    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => {
            signal.removeEventListener('abort', onAbort)
            entry.ms = Math.round(performance.now() - started)
            if (shouldFail) {
                entry.outcome = 'failed'
                announce()
                reject(new Error('the fake provider was told to fail'))
                return
            }
            announce()
            resolve(produce())
        }, latency())

        const onAbort = () => {
            clearTimeout(timer)
            entry.outcome = 'cancelled'
            entry.ms = Math.round(performance.now() - started)
            announce()
            reject(new DOMException('aborted', 'AbortError'))
        }
        signal.addEventListener('abort', onAbort, { once: true })
    })
}

// --- ail-correlation -------------------------------------------------------------------
// 1,800 + 210 + 95 + 38 = 2,143 exactly, and URLs alone is 210 — so ticking one box takes
// the count under the 2,000 cap by arithmetic rather than by decree.

const CORRELATION_TYPES = [
    { label: 'Domains', value: 'domain', count: 1800 },
    { label: 'URLs', value: 'url', count: 210 },
    { label: 'Pastes', value: 'paste', count: 95 },
    { label: 'IPs', value: 'ip', count: 38 },
]

function narrowedTypes(narrowing: Record<string, unknown>): typeof CORRELATION_TYPES {
    const picked = narrowing.type
    if (!Array.isArray(picked) || picked.length === 0) return CORRELATION_TYPES
    return CORRELATION_TYPES.filter((t) => picked.includes(t.value))
}

/** The `seen` range trims a fixed fraction, so narrowing on it also moves the number. */
function seenFactor(narrowing: Record<string, unknown>): number {
    const range = narrowing.seen as { min?: number, max?: number } | undefined
    if (!range || (range.min == null && range.max == null)) return 1
    const min = range.min ?? 0
    const max = range.max ?? 365
    const span = Math.max(0, Math.min(365, max) - Math.max(0, min))
    return Math.max(0.02, span / 365)
}

function correlationTotal(narrowing: Record<string, unknown>): number {
    const base = narrowedTypes(narrowing).reduce((sum, t) => sum + t.count, 0)
    return Math.round(base * seenFactor(narrowing))
}

/**
 * Ids are deterministic — `url-0007` is the same correlation on every run. A real backend
 * behaves this way, and without it neither dedup nor rejection memory can ever fire: each
 * fetch would return a fresh set of ids nothing could match against.
 */
function makeCorrelations(narrowing: Record<string, unknown>, cap: number): PivotResult {
    const types = narrowedTypes(narrowing)
    const factor = seenFactor(narrowing)
    const nodes = []
    const edges = []
    for (const type of types) {
        const n = Math.max(1, Math.round(type.count * factor))
        for (let i = 1; i <= Math.min(n, cap); i++) {
            const id = `${type.value}-${String(i).padStart(4, '0')}`
            nodes.push({
                id,
                expanded: false,
                data: {
                    label: type.value === 'url' ? `hxxp://paste.circl.lu/${id.slice(-4)}` : id,
                    type: type.value,
                    first_seen: `2026-${String(1 + (i % 12)).padStart(2, '0')}-${String(1 + (i % 27)).padStart(2, '0')}`,
                    occurrences: 1 + (i % 9),
                },
                style: { color: colourFor(type.value) },
            })
            edges.push({ from: 'paste-2f9c', to: id, data: { kind: 'correlates' } })
        }
    }
    return { nodes, edges }
}

function colourFor(type: string): string {
    switch (type) {
        case 'domain': return '#25B6EB'
        case 'url': return '#8fd14f'
        case 'paste': return '#c9a227'
        default: return '#a06be0'
    }
}

export const correlationPivot: PivotDefinition = {
    id: 'ail-correlation',
    label: 'Correlations',
    appliesTo: (nodes) => nodes.every((n) => (n.getData() as { type?: string })?.type !== 'event'),
    maxCandidates: 2000,
    summarize: (nodes, narrowing, { signal }) =>
        call('ail-correlation', 'summarize', describe(nodes, narrowing), signal, (): PivotSummary => ({
            total: correlationTotal(narrowing),
            facets: [
                { key: 'type', label: 'Type', type: 'multiselect', options: CORRELATION_TYPES },
                { key: 'seen', label: 'First seen (days ago)', type: 'numberRange' },
            ],
        })),
    fetch: (nodes, narrowing, { signal }) =>
        call('ail-correlation', 'fetch', describe(nodes, narrowing), signal, () => makeCorrelations(narrowing, 400)),
}

// --- misp-event-objects (auto-ingest) --------------------------------------------------

export const eventObjectsPivot: PivotDefinition = {
    id: 'misp-event-objects',
    label: 'Objects & attributes',
    autoIngest: true,
    appliesTo: (nodes) => nodes.length === 1 && (nodes[0].getData() as { type?: string })?.type === 'event',
    fetch: (nodes, _narrowing, { signal }) =>
        call('misp-event-objects', 'fetch', describe(nodes, _narrowing), signal, (): PivotResult => {
            const uuid = String(nodes[0]?.id ?? 'event-5f2a')
            const children = Array.from({ length: 12 }, (_, i) => ({
                id: `${uuid}-obj-${i + 1}`,
                expanded: false,
                data: { label: `object ${i + 1}`, type: 'object' },
                style: { color: '#a06be0' },
            }))
            return { nodes: [{ id: `${uuid}-objects`, expanded: false, data: { label: 'Objects', type: 'container' }, children }], edges: [] }
        }),
}

// --- oversized (the ceiling refusal) ---------------------------------------------------

export const oversizedPivot: PivotDefinition = {
    id: 'oversized',
    label: 'Everything, everywhere',
    summarize: (nodes, narrowing, { signal }) =>
        call('oversized', 'summarize', describe(nodes, narrowing), signal, (): PivotSummary => ({ total: 14203 })),
    fetch: (nodes, narrowing, { signal }) =>
        call('oversized', 'fetch', describe(nodes, narrowing), signal, (): PivotResult => ({
            // Deliberately blows through the 10,000 ceiling: the pane must refuse, not truncate.
            nodes: Array.from({ length: 14203 }, (_, i) => ({
                id: `bulk-${i}`, expanded: false, data: { label: `bulk ${i}`, type: 'bulk' },
            })),
            edges: [],
        })),
}

// --- search-ail (origin-less) ----------------------------------------------------------

let searchSeq = 0

export const searchPivot: PivotDefinition = {
    id: 'search-ail',
    label: 'Search AIL',
    origin: 'none',
    summarize: (nodes, narrowing, { signal }) =>
        call('search-ail', 'summarize', describe(nodes, narrowing), signal, (): PivotSummary => ({
            total: String(narrowing.query ?? '').trim() ? 30 : 0,
            facets: [{ key: 'query', label: 'Query', type: 'text' }],
        })),
    fetch: (nodes, narrowing, { signal }) =>
        call('search-ail', 'fetch', describe(nodes, narrowing), signal, (): PivotResult => {
            const query = String(narrowing.query ?? 'result').trim() || 'result'
            return {
                nodes: Array.from({ length: 30 }, () => {
                    const id = `hit-${++searchSeq}`
                    return {
                        id,
                        expanded: false,
                        data: { label: `${query}-${id.slice(4)}`, type: 'paste', occurrences: 1 + (searchSeq % 5) },
                        style: { color: '#c9a227' },
                    }
                }),
                edges: [],
            }
        }),
}

function describe(nodes: Node[], narrowing: Record<string, unknown>): string {
    const ids = nodes.length ? nodes.map((n) => String(n.id)).join(',') : '—'
    const keys = Object.entries(narrowing)
        .filter(([, v]) => v != null && !(Array.isArray(v) && v.length === 0))
        .map(([k, v]) => `${k}=${Array.isArray(v) ? v.join('|') : typeof v === 'object' ? JSON.stringify(v) : v}`)
    return `[${ids}]${keys.length ? ' ' + keys.join(' ') : ''}`
}

export const allPivots = [correlationPivot, eventObjectsPivot, oversizedPivot, searchPivot]
