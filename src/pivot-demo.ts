/**
 * Pivot & enrichment dev page. `npm run dev`, then open `/pivot.html`.
 *
 * Not part of the library and not published: it exists so the pivot surfaces —
 * the rail mode, the narrowing panel, the triage pane, rim badges, run undo, the
 * unsaved ledger — can be driven against providers that behave like real ones,
 * including the ways real ones misbehave.
 *
 * The toolbar is the point. Latency, a forced failure, the ingest decision and what
 * a `save` does with the batch are all switchable while the page runs, so the states
 * that normally need a broken backend are one click away. `window.pivotick` is the
 * graph, for the console.
 */
import { Pivotick } from './index'
import type { Node } from './Node'
import type { RawEdge, RawNode } from './interfaces/GraphOptions'
import type {
    PivotContext, PivotDefinition, PivotNarrowing, PivotResult,
    PivotSaveContext, PivotSaveOutcome, PivotSavePayload,
} from './interfaces/Pivot'
import { expand, groupNodes, link, magnifyingGlass, nodeProperty, sparkles } from './ui/icons'

declare global {
    interface Window { pivotick?: Pivotick }
}

/* -------------------------------------------------------------------- knobs */

/** What the toolbar controls. Every provider call below reads it. */
const knobs = {
    /** Milliseconds a provider waits before answering. */
    latency: 300,
    /** Which kind of call throws, if either. */
    fail: 'none' as 'none' | 'summarize' | 'fetch',
    /** What `onBeforeIngest` does with a batch. */
    ingest: 'off' as 'off' | 'veto' | 'halve',
    /**
     * Whether the container provider stages instead of auto-ingesting. Staged is the
     * only way to see a container in the pane, which is where its child count and the
     * panel under it live.
     */
    stageObjects: false,
    /** What a `save` does with the batch it is handed. */
    save: 'ok' as 'ok' | 'half' | 'throw' | 'mint',
    /** Whether the container provider writes its runs back with no gesture. */
    autoSave: false,
}

const aborted = (): DOMException => new DOMException('Aborted', 'AbortError')

/** Sleep, rejecting the way a real transport does when the run is abandoned. */
function wait(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        if (signal.aborted) return reject(aborted())
        const onAbort = (): void => {
            window.clearTimeout(timer)
            reject(aborted())
        }
        const timer = window.setTimeout(() => {
            signal.removeEventListener('abort', onAbort)
            resolve()
        }, ms)
        signal.addEventListener('abort', onAbort, { once: true })
    })
}

/**
 * The one door every provider call goes through, so each pivot below is only
 * about its own contract: the latency and the failure knob live here.
 */
async function answer<T>(kind: 'summarize' | 'fetch', ctx: PivotContext, produce: () => T): Promise<T> {
    await wait(knobs.latency, ctx.signal)
    if (knobs.fail === kind) throw new Error(`Forced ${kind} failure — dev toolbar`)
    return produce()
}

/* --------------------------------------------------------------- writing back */

/**
 * Ids this fake source system has assigned, by the id the provider first used.
 * A real one does the same on every create, and it is what makes the *mint* knob
 * worth having: without the library's aliases the next run offers duplicates of
 * everything already saved.
 */
const minted = new Map<string, string>()

/** What the source would return today: anything it has minted an id for wears it. */
function asSourceSees(result: PivotResult): PivotResult {
    if (!minted.size) return result
    const out = (id: unknown): string => minted.get(String(id)) ?? String(id)
    const node = (raw: RawNode): RawNode => ({
        ...raw,
        id: out(raw.id),
        ...(raw.children ? { children: raw.children.map(node) } : {}),
    })
    return {
        nodes: result.nodes.map(node),
        edges: result.edges.map(raw => ({ ...raw, from: out(raw.from), to: out(raw.to) })),
    }
}

/** Every `fetch` goes through here, so the whole page speaks the source's ids. */
async function fetched(ctx: PivotContext, produce: () => PivotResult): Promise<PivotResult> {
    return asSourceSees(await answer('fetch', ctx, produce))
}

/**
 * The write half, shared by every provider that has one. The knob picks which of
 * the four answers a real backend gives: all of it, some of it, none of it, or all
 * of it under ids of the source system's own choosing.
 */
async function writeBack(payload: PivotSavePayload, ctx: PivotSaveContext): Promise<PivotSaveOutcome> {
    await wait(knobs.latency, ctx.signal)
    const nodes = [...payload.nodes, ...payload.children]

    if (knobs.save === 'throw') throw new Error('Forced save failure — dev toolbar')
    if (knobs.save === 'half') {
        // Every other node, and none of the edges: the normal shape of a partial
        // write, and what a Retry has to be able to pick up from.
        const kept = nodes.filter((_, i) => i % 2 === 0)
        return {
            savedNodeIds: kept.map(node => node.id),
            message: `${nodes.length - kept.length} refused by the server — dev toolbar`,
        }
    }
    if (knobs.save === 'mint') {
        for (const node of nodes) minted.set(node.id, `uuid-${node.id}`)
        return {
            savedNodeIds: nodes.map(node => node.id),
            savedEdgeIds: payload.edges.map(edge => edge.id),
            canonicalIds: Object.fromEntries(nodes.map(node => [node.id, `uuid-${node.id}`])),
        }
    }
    return true
}

/* --------------------------------------------------------------- the canvas */

/** 20 nodes: one case and what an analyst has already pulled into it. */
const SEED_NODES: RawNode[] = [
    { id: 'case-2481', data: { label: 'Case 2481', type: 'case' } },
    { id: 'campaign-quiet-harbour', data: { label: 'Quiet Harbour', type: 'campaign' } },
    { id: 'actor-bluejay', data: { label: 'APT-Bluejay', type: 'actor' } },
    { id: 'mail.evil.example', data: { label: 'mail.evil.example', type: 'domain' } },
    { id: 'cdn.evil.example', data: { label: 'cdn.evil.example', type: 'domain' } },
    { id: 'login-portal.example', data: { label: 'login-portal.example', type: 'domain' } },
    { id: 'static.quietharbour.example', data: { label: 'static.quietharbour.example', type: 'domain' } },
    { id: '198.51.100.7', data: { label: '198.51.100.7', type: 'ip' } },
    { id: '203.0.113.42', data: { label: '203.0.113.42', type: 'ip' } },
    { id: '192.0.2.19', data: { label: '192.0.2.19', type: 'ip' } },
    { id: 'hxxp://cdn.evil.example/pay.php', data: { label: 'cdn.evil.example/pay.php', type: 'url' } },
    { id: 'hxxp://login-portal.example/sso', data: { label: 'login-portal.example/sso', type: 'url' } },
    { id: 'a1b2c3d4e5f60718', data: { label: 'a1b2c3d4e5f6…', type: 'hash' } },
    { id: '9f21ac77bb0e4412', data: { label: '9f21ac77bb0e…', type: 'hash' } },
    { id: 'invoice-2481.docm', data: { label: 'invoice-2481.docm', type: 'file' } },
    { id: 'loader.dll', data: { label: 'loader.dll', type: 'file' } },
    { id: 'billing@evil.example', data: { label: 'billing@evil.example', type: 'email' } },
    { id: 'paste-9f21', data: { label: 'paste 9f21', type: 'paste' } },
    { id: 'event-5f2a', data: { label: 'Event 5f2a', type: 'event' } },
    { id: 'event-77b1', data: { label: 'Event 77b1', type: 'event' } },
]

const SEED_EDGES: RawEdge[] = [
    { from: 'case-2481', to: 'campaign-quiet-harbour', data: { label: 'investigates' } },
    { from: 'case-2481', to: 'event-5f2a', data: { label: 'includes' } },
    { from: 'case-2481', to: 'event-77b1', data: { label: 'includes' } },
    { from: 'case-2481', to: 'paste-9f21', data: { label: 'includes' } },
    { from: 'campaign-quiet-harbour', to: 'actor-bluejay', data: { label: 'attributed-to' } },
    { from: 'campaign-quiet-harbour', to: 'static.quietharbour.example', data: { label: 'uses' } },
    { from: 'actor-bluejay', to: 'mail.evil.example', data: { label: 'uses' } },
    { from: 'actor-bluejay', to: 'cdn.evil.example', data: { label: 'uses' } },
    { from: 'mail.evil.example', to: '198.51.100.7', data: { label: 'resolved-to' } },
    { from: 'cdn.evil.example', to: '203.0.113.42', data: { label: 'resolved-to' } },
    { from: 'login-portal.example', to: '192.0.2.19', data: { label: 'resolved-to' } },
    { from: 'cdn.evil.example', to: 'hxxp://cdn.evil.example/pay.php', data: { label: 'serves' } },
    { from: 'login-portal.example', to: 'hxxp://login-portal.example/sso', data: { label: 'serves' } },
    { from: 'hxxp://cdn.evil.example/pay.php', to: 'a1b2c3d4e5f60718', data: { label: 'dropped' } },
    { from: 'a1b2c3d4e5f60718', to: 'invoice-2481.docm', data: { label: 'is' } },
    { from: '9f21ac77bb0e4412', to: 'loader.dll', data: { label: 'is' } },
    { from: 'event-5f2a', to: 'mail.evil.example', data: { label: 'reports' } },
    { from: 'event-5f2a', to: 'a1b2c3d4e5f60718', data: { label: 'reports' } },
    { from: 'event-77b1', to: 'login-portal.example', data: { label: 'reports' } },
    { from: 'event-77b1', to: '9f21ac77bb0e4412', data: { label: 'reports' } },
    { from: 'paste-9f21', to: 'mail.evil.example', data: { label: 'mentions' } },
    { from: 'paste-9f21', to: 'billing@evil.example', data: { label: 'mentions' } },
    { from: 'billing@evil.example', to: 'mail.evil.example', data: { label: 'hosted-at' } },
]

/** What a result with no origin hangs off, when it needs an anchor at all. */
const ROOT_ID = 'case-2481'

/** One node's type, read the way the renderer's accessor reads it. */
const typeOf = (node: Node): string => String(node.getData()?.type ?? '')

/* ---------------------------------------------------- the correlation corpus */

/**
 * What the fake correlation source holds, by type. The counts are the point:
 * 2,143 is well over the pivot's cap, so nothing can be fetched until the
 * narrowing brings it down. Hashes alone (163) open the gate; IPs (300) still
 * need a confidence picked as well.
 */
const CORPUS_TYPES = [
    { value: 'domain', label: 'Domains', count: 1200 },
    { value: 'url', label: 'URLs', count: 480 },
    { value: 'ip', label: 'IPs', count: 300 },
    { value: 'hash', label: 'Hashes', count: 163 },
]

const CONFIDENCES = [
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' },
]

interface CorrelationRecord {
    id: string
    label: string
    type: string
    confidence: string
    ageDays: number
}

/**
 * Ids a real source would hand back: stable, and the same on every call. Dedup
 * and rejection memory both key on them, so a provider that renumbers its
 * results can never be usefully rejected — the row returns wearing a new id.
 */
function corpusId(type: string, i: number): string {
    const n = String(i).padStart(4, '0')
    switch (type) {
        case 'domain': return `host-${n}.quietharbour.example`
        case 'url': return `hxxp://cdn.evil.example/p/${n}`
        case 'ip': return `198.51.${Math.floor(i / 254) + 110}.${(i % 254) + 1}`
        default: {
            const half = (((i + 1) * 2654435761) >>> 0).toString(16).padStart(8, '0')
            return `${half}${[...half].reverse().join('')}`
        }
    }
}

function corpusLabel(type: string, id: string): string {
    if (type === 'url') return id.replace('hxxp://', '')
    if (type === 'hash') return `${id.slice(0, 12)}…`
    return id
}

/**
 * Three records deliberately carry an id that is already on the canvas, so every
 * run has something to dedup: what the provider advertised and what can actually
 * be ingested are not the same number, and the pane has to say so.
 */
const ALREADY_ON_CANVAS: Record<string, string> = {
    domain: 'mail.evil.example',
    ip: '198.51.100.7',
    hash: 'a1b2c3d4e5f60718',
}

const CORPUS: CorrelationRecord[] = CORPUS_TYPES.flatMap(({ value, count }) =>
    Array.from({ length: count }, (_, i): CorrelationRecord => {
        const id = (i === 0 ? ALREADY_ON_CANVAS[value] : undefined) ?? corpusId(value, i)
        return {
            id,
            label: corpusLabel(value, id),
            type: value,
            // Fixed shares rather than a random draw, so the numbers hold still
            // between runs: 15% high, 35% medium, the rest low.
            confidence: i % 20 < 3 ? 'high' : i % 20 < 10 ? 'medium' : 'low',
            ageDays: (i * 7) % 366,
        }
    }),
)

/* --------------------------------------------------------- narrowing helpers */

const asList = (value: unknown): string[] =>
    Array.isArray(value) ? value.map(String) : typeof value === 'string' && value ? [value] : []

const asRange = (value: unknown): { min?: number, max?: number } =>
    value && typeof value === 'object' ? value as { min?: number, max?: number } : {}

const asText = (value: unknown): string => typeof value === 'string' ? value.trim() : ''

/**
 * Does one record survive the narrowing? `ignore` leaves one facet out, which is
 * how that facet's own option counts are worked out — a backend counts each facet
 * under the *other* choices, so its numbers move as you narrow elsewhere.
 */
function matchesCorpus(record: CorrelationRecord, narrowing: PivotNarrowing, ignore?: string): boolean {
    if (ignore !== 'type') {
        const types = asList(narrowing.type)
        if (types.length && !types.includes(record.type)) return false
    }
    if (ignore !== 'confidence') {
        const [confidence] = asList(narrowing.confidence)
        if (confidence && record.confidence !== confidence) return false
    }
    if (ignore !== 'age') {
        const { min, max } = asRange(narrowing.age)
        if (min !== undefined && record.ageDays < min) return false
        if (max !== undefined && record.ageDays > max) return false
    }
    return true
}

const asRawNode = (record: CorrelationRecord, source: string): RawNode => ({
    id: record.id,
    data: {
        label: record.label,
        type: record.type,
        confidence: record.confidence,
        first_seen_days: record.ageDays,
        source,
    },
})

/**
 * Spread a result over the nodes it was asked about: candidate *i* hangs off
 * origin *i mod n*, so a multi-node origin gets a fragment attached to all of it
 * rather than to whichever node happened to be first.
 */
function fanOut(origin: Node[], nodes: RawNode[], label: string): PivotResult {
    const anchors = origin.length ? origin.map(node => String(node.id)) : [ROOT_ID]
    return {
        nodes,
        edges: nodes.map((node, i) => ({
            id: `${label}:${anchors[i % anchors.length]}:${node.id}`,
            from: anchors[i % anchors.length],
            to: String(node.id),
            data: { label },
        })),
    }
}

/* ----------------------------------------------------------------- providers */

/** The flagship: facets, moving counts, and a cap that only narrowing lifts. */
const correlations: PivotDefinition = {
    id: 'correlations',
    label: 'Correlations',
    icon: sparkles,
    maxCandidates: 250,
    // Nothing correlates with the case or the campaign, so they are dropped from the
    // origin rather than taking the whole entry down with them. Pick a domain and the
    // case together and the entry says it applies to one of the two.
    appliesTo: nodes => nodes.filter(node => typeOf(node) !== 'case' && typeOf(node) !== 'campaign'),

    summarize: (nodes, narrowing, ctx) => answer('summarize', ctx, () => {
        const within = (ignore: string): CorrelationRecord[] =>
            CORPUS.filter(record => matchesCorpus(record, narrowing, ignore))
        const forTypes = within('type')
        const forConfidence = within('confidence')

        return {
            total: CORPUS.filter(record => matchesCorpus(record, narrowing)).length,
            facets: [
                {
                    key: 'type',
                    label: 'Type',
                    type: 'multiselect',
                    options: CORPUS_TYPES.map(entry => ({
                        label: entry.label,
                        value: entry.value,
                        count: forTypes.filter(record => record.type === entry.value).length,
                    })),
                },
                {
                    key: 'confidence',
                    label: 'Confidence',
                    type: 'select',
                    options: CONFIDENCES.map(entry => ({
                        label: entry.label,
                        value: entry.value,
                        count: forConfidence.filter(record => record.confidence === entry.value).length,
                    })),
                },
                { key: 'age', label: 'Days since first seen', type: 'numberRange' },
            ],
        }
    }),

    fetch: (nodes, narrowing, ctx) => fetched(ctx, () => fanOut(
        nodes,
        CORPUS.filter(record => matchesCorpus(record, narrowing)).map(record => asRawNode(record, 'correlations')),
        'correlated-with',
    )),
    save: writeBack,
}

/** How far back the passive-DNS provider is asked to look. */
const PDNS_WINDOWS = [
    { value: '7', label: 'Last 7 days', count: 6 },
    { value: '30', label: 'Last 30 days', count: 14 },
    { value: '90', label: 'Last 90 days', count: 28 },
    { value: '365', label: 'Last 12 months', count: 44 },
]

const pdnsWindow = (narrowing: PivotNarrowing): { value: string, count: number } => {
    const [chosen] = asList(narrowing.window)
    return PDNS_WINDOWS.find(entry => entry.value === chosen) ?? PDNS_WINDOWS[1]
}

/** One select facet, no cap, and a result that always dedups something. */
const passiveDns: PivotDefinition = {
    id: 'passive-dns',
    label: 'Passive DNS',
    icon: link,
    // Per node, not per origin: a selection holding a domain and an email still gets
    // passive DNS, run against the domain alone.
    appliesTo: nodes => nodes.filter(node => typeOf(node) === 'domain' || typeOf(node) === 'ip'),

    summarize: (nodes, narrowing, ctx) => answer('summarize', ctx, () => ({
        total: pdnsWindow(narrowing).count * Math.max(nodes.length, 1),
        facets: [{
            key: 'window',
            label: 'Window',
            type: 'select',
            options: PDNS_WINDOWS.map(entry => ({ label: entry.label, value: entry.value, count: entry.count })),
        }],
    })),

    fetch: (nodes, narrowing, ctx) => fetched(ctx, () => {
        const per = pdnsWindow(narrowing).count
        const result: PivotResult = { nodes: [], edges: [] }

        nodes.forEach((node, originIndex) => {
            // A domain resolves to addresses; an address resolves back to hostnames,
            // and the edge points the other way for it.
            const forward = typeOf(node) === 'domain'
            for (let i = 0; i < per; i++) {
                // The first resolution of the first origin is a node already on the
                // canvas: one guaranteed deduped row per run.
                const id = forward
                    ? (originIndex === 0 && i === 0 ? '198.51.100.7' : `198.51.${110 + originIndex}.${i + 20}`)
                    : `r${i}.${String(node.id).replace(/[.:]/g, '-')}.pdns.example`
                result.nodes.push({
                    id,
                    data: { label: id, type: forward ? 'ip' : 'domain', source: 'passive-dns' },
                })
                result.edges.push({
                    id: `pdns:${node.id}:${id}`,
                    from: forward ? String(node.id) : id,
                    to: forward ? id : String(node.id),
                    data: { label: 'resolved-to' },
                })
            }
        })

        return result
    }),
    save: writeBack,
}

/** No `summarize` at all: one record, nothing to advertise, so a bare Run. */
const whois: PivotDefinition = {
    id: 'whois',
    label: 'Whois',
    icon: nodeProperty,
    appliesTo: nodes => nodes.length === 1 && typeOf(nodes[0]) === 'domain',

    // No `save`: registration data is the registry's, not ours to write back. Its
    // runs are *not savable* — never counted unsaved, and no Save offered for them.
    fetch: (nodes, _narrowing, ctx) => fetched(ctx, () => {
        const domain = String(nodes[0].id)
        // An email already on the canvas for the evil.example domains, a fresh one
        // otherwise: the same pivot dedups or does not, depending on the origin.
        const registrant = domain.endsWith('evil.example') ? 'billing@evil.example' : `admin@${domain}`
        return fanOut(nodes, [
            { id: registrant, data: { label: registrant, type: 'email', source: 'whois' } },
            { id: 'AS64500', data: { label: 'AS64500 · Harbour Hosting', type: 'asn', source: 'whois' } },
            { id: 'org-harbour-hosting', data: { label: 'Harbour Hosting Ltd', type: 'org', source: 'whois' } },
        ], 'whois')
    }),
}

const ATTRIBUTE_KINDS = ['md5', 'sha256', 'domain', 'ip-dst', 'url', 'email-src']

/** Auto-ingest, and a container carrying its own children. */
const eventObjects: PivotDefinition = {
    id: 'event-objects',
    label: 'Objects & attributes',
    icon: expand,
    get autoIngest() { return !knobs.stageObjects },
    get autoSave() { return knobs.autoSave },
    appliesTo: nodes => nodes.length === 1 && typeOf(nodes[0]) === 'event',

    fetch: (nodes, _narrowing, ctx) => fetched(ctx, () => {
        const event = String(nodes[0].id)
        const container = `${event}-objects`
        return {
            nodes: [{
                id: container,
                data: { label: 'Objects', type: 'container', source: 'event-objects' },
                children: Array.from({ length: 9 }, (_, i) => ({
                    id: `${event}-attr-${i}`,
                    data: {
                        label: `${ATTRIBUTE_KINDS[i % ATTRIBUTE_KINDS.length]} ${i}`,
                        type: 'attribute',
                    },
                })),
            }],
            edges: [{ id: `objects:${event}`, from: event, to: container, data: { label: 'has-objects' } }],
        }
    }),
    save: writeBack,
}

const searchHits = (narrowing: PivotNarrowing): CorrelationRecord[] => {
    const query = asText(narrowing.q).toLowerCase()
    if (!query) return []
    const types = asList(narrowing.type)
    return CORPUS.filter(record => record.label.toLowerCase().includes(query)
        && (!types.length || types.includes(record.type)))
}

/** `origin: 'none'` — runs with nothing selected, narrowed by typed text. */
const searchSource: PivotDefinition = {
    id: 'search',
    label: 'Search the source',
    icon: magnifyingGlass,
    origin: 'none',
    maxCandidates: 200,

    summarize: (_nodes, narrowing, ctx) => answer('summarize', ctx, () => {
        const query = asText(narrowing.q).toLowerCase()
        return {
            total: searchHits(narrowing).length,
            facets: [
                { key: 'q', label: 'Query', type: 'text' },
                {
                    key: 'type',
                    label: 'Type',
                    type: 'multiselect',
                    options: CORPUS_TYPES.map(entry => ({
                        label: entry.label,
                        value: entry.value,
                        // Counted under the query but not under the type picks, so
                        // ticking one type does not zero the others. With nothing
                        // typed there is no count to give, and a row of zeroes reads
                        // as "none of these" rather than "ask me something".
                        count: query
                            ? CORPUS.filter(record => record.type === entry.value
                                && record.label.toLowerCase().includes(query)).length
                            : undefined,
                    })),
                },
            ],
        }
    }),

    // A tray of loose nodes: there is no origin to attach it to, and an edge to the
    // case node would be a claim the source never made.
    fetch: (_nodes, narrowing, ctx) => fetched(ctx, () => ({
        nodes: searchHits(narrowing).slice(0, 200).map(record => asRawNode(record, 'search')),
        edges: [],
    })),
    save: writeBack,
}

/** Two or more origins, and both kinds of triage row in one pane. */
const sharedInfra: PivotDefinition = {
    id: 'shared-infra',
    label: 'Shared infrastructure',
    icon: groupNodes,
    appliesTo: nodes => nodes.length >= 2,

    summarize: (nodes, _narrowing, ctx) => answer('summarize', ctx, () => ({
        total: nodes.length - 1 + 2,
    })),

    fetch: (nodes, _narrowing, ctx) => fetched(ctx, () => {
        const first = String(nodes[0].id)
        // Both endpoints already on the canvas, so each of these is a triage row in
        // its own right — nothing else would stage it.
        const edges: RawEdge[] = nodes.slice(1).map(node => ({
            id: `shared:${first}:${node.id}`,
            from: first,
            to: String(node.id),
            data: { label: 'shares-infrastructure' },
        }))

        const hosts: RawNode[] = [
            { id: 'AS64500', data: { label: 'AS64500 · Harbour Hosting', type: 'asn', source: 'shared-infra' } },
            { id: 'cert-4411', data: { label: 'cert 4411 (SHA-1)', type: 'cert', source: 'shared-infra' } },
        ]
        // These carry: one endpoint is a candidate, so they land only if it does.
        // They are not rows, and the pane does not show them.
        for (const host of hosts) {
            for (const node of nodes) {
                edges.push({
                    id: `hosted:${node.id}:${host.id}`,
                    from: String(node.id),
                    to: String(host.id),
                    data: { label: 'hosted-on' },
                })
            }
        }

        return { nodes: hosts, edges }
    }),
    save: writeBack,
}

const PIVOTS = [correlations, passiveDns, whois, eventObjects, searchSource, sharedInfra]

/** One line per pivot: what it is here to exercise. Shown in the toolbar. */
const NOTES: Record<string, string> = {
    'correlations': 'facets with moving counts, and a cap only narrowing lifts (2,143 → under 250)',
    'passive-dns': 'one select facet, no cap, and a row that always dedups',
    'whois': 'no summarize at all — the bare Run path, and no save either, so it is never counted unsaved',
    'event-objects': 'autoIngest: a container carrying its own children, straight onto the canvas — and autoSave with the knob on',
    'search': 'origin: none — runs with nothing selected, narrowed by typed text',
    'shared-infra': 'two or more origins: edge-only rows, plus carried edges that are not rows',
}

/* --------------------------------------------------------------------- graph */

/** A colour and a shape per type, so a pivot's results read against the seed. */
const TYPE_STYLES: Record<string, { shape: 'circle' | 'square' | 'triangle' | 'hexagon', color: string, size: number }> = {
    case: { shape: 'hexagon', color: '#bf616a', size: 34 },
    campaign: { shape: 'hexagon', color: '#d08770', size: 26 },
    actor: { shape: 'triangle', color: '#b48ead', size: 26 },
    domain: { shape: 'circle', color: '#ebcb8b', size: 18 },
    ip: { shape: 'square', color: '#88c0d0', size: 16 },
    url: { shape: 'circle', color: '#a3be8c', size: 13 },
    hash: { shape: 'square', color: '#8fbcbb', size: 13 },
    file: { shape: 'triangle', color: '#d8dee9', size: 14 },
    email: { shape: 'circle', color: '#81a1c1', size: 14 },
    paste: { shape: 'square', color: '#b48ead', size: 15 },
    event: { shape: 'hexagon', color: '#5e81ac', size: 22 },
    container: { shape: 'hexagon', color: '#4c566a', size: 20 },
    attribute: { shape: 'circle', color: '#9aa5b1', size: 10 },
    asn: { shape: 'square', color: '#e5a663', size: 18 },
    cert: { shape: 'square', color: '#a3a3c2', size: 16 },
    org: { shape: 'hexagon', color: '#c0a080', size: 18 },
}

const graph = new Pivotick(
    document.getElementById('app')!,
    { nodes: SEED_NODES, edges: SEED_EDGES },
    {
        // Registered here rather than later, so the rail button is already right on
        // the first paint: `UI.pivotMode` defaults to 'auto'.
        pivots: PIVOTS,
        render: {
            nodeTypeAccessor: node => typeOf(node),
            nodeStyleMap: TYPE_STYLES,
            defaultNodeStyle: {
                size: 14,
                color: '#8f9aa8',
                // Hostnames and hashes are far too long to sit inside an 18px
                // circle, so the label floats below the node instead. Opt-in:
                // nothing draws `data.label` on the canvas by itself.
                text: node => String(node.getData()?.label ?? ''),
                textVerticalShift: -1.4,
                // A hostname truncated to fit a 16px node reads as `mail.evi…ple`,
                // which is no use when the label is how you tell one origin from
                // another. 20 nodes have room for the whole string.
                textTruncate: false,
            },
            defaultEdgeStyle: { markerEnd: 'arrow' },
        },
        UI: {
            mode: 'full',
            sidebar: { collapsed: true },
            // Away entirely; a staged set opens it, and it goes back when triage ends.
            dock: { open: false },
        },
        callbacks: {
            onBeforeIngest: context => {
                if (knobs.ingest === 'veto') {
                    graph.notifier.warning('Ingest vetoed', `onBeforeIngest refused ${context.pivotId} — dev toolbar`)
                    return false
                }
                if (knobs.ingest === 'halve') {
                    // The narrowing form of the decision: an array replaces that kind's
                    // set, and the omitted `edges` key leaves them as requested.
                    const kept = context.candidates.nodes.filter((_, i) => i % 2 === 0)
                    graph.notifier.info('Ingest narrowed',
                        `${kept.length} of ${context.candidates.nodes.length} nodes kept`)
                    return { accept: true, nodes: kept }
                }
                return true
            },
        },
    },
)

window.pivotick = graph

// Declared potential: a hint on the rim, put there by whoever loaded the data. Never a
// queried count — the library will not call a provider just to draw a badge.
//
// Set synchronously, before the first paint, so no repaint is needed to show them:
// calling `renderer.update()` from a `ready` handler instead clears every edge's `d`
// and nothing puts it back, leaving a graph of unconnected nodes.
graph.getMutableNode('mail.evil.example')?.setPotential('correlations', 2143)
graph.getMutableNode('cdn.evil.example')?.setPotential('correlations', 812)
graph.getMutableNode('login-portal.example')?.setPotential('passive-dns', 44)
graph.getMutableNode('event-5f2a')?.setPotential('event-objects', 9)

// One total belonging to no pivot, which is what the `summary` rim badge prefers. Only
// this node declares one, so switching the Rim knob shows both halves of that rule:
// here the declared 2,199, and on every other node the number of pivots that apply.
graph.getMutableNode('mail.evil.example')?.setPotential(2199)

/* ------------------------------------------------------------------- toolbar */

const bar = document.getElementById('devbar')!

function field(label: string, control: HTMLElement): HTMLLabelElement {
    const wrap = document.createElement('label')
    wrap.className = 'devbar-field'
    const text = document.createElement('span')
    text.textContent = label
    wrap.append(text, control)
    return wrap
}

function select(
    options: Array<[value: string, label: string]>,
    initial: string,
    onChange: (value: string) => void,
): HTMLSelectElement {
    const el = document.createElement('select')
    for (const [value, label] of options) {
        const option = document.createElement('option')
        option.value = value
        option.textContent = label
        el.append(option)
    }
    el.value = initial
    el.addEventListener('change', () => onChange(el.value))
    return el
}

function button(label: string, title: string, onClick: () => void): HTMLButtonElement {
    const el = document.createElement('button')
    el.type = 'button'
    el.textContent = label
    el.title = title
    el.addEventListener('click', onClick)
    return el
}

const ceiling = document.createElement('input')
ceiling.type = 'number'
ceiling.min = '1'
ceiling.step = '50'
ceiling.value = String(graph.pivots.candidateCeiling)
ceiling.addEventListener('change', () => {
    graph.pivots.candidateCeiling = Math.max(1, Number(ceiling.value) || 1)
    graph.notifier.info('Ceiling', `One fetch may now stage ${graph.pivots.candidateCeiling}`)
})

const status = document.createElement('span')
status.className = 'devbar-status'

const paintStatus = (): void => {
    const staged = graph.pivots.staged()
    const rows = staged.reduce((sum, set) => sum + set.nodes.length + set.edges.length, 0)
    const marked = staged.reduce((sum, set) => sum
        + set.nodes.filter(candidate => candidate.state === 'marked').length
        + set.edges.filter(edge => edge.state === 'marked').length, 0)
    const pending = graph.pivots.unsavedCount()
    status.textContent = `${staged.length} staged · ${rows} rows · ${marked} marked`
        + ` · ${graph.history.entries().length} entries`
        + ` · ${pending.nodes + pending.edges} unsaved`
}

graph.pivots.on(paintStatus)
graph.history.on(paintStatus)
paintStatus()

bar.append(
    field('Latency', select(
        [['0', 'instant'], ['300', '300 ms'], ['1200', '1.2 s'], ['5000', '5 s']],
        String(knobs.latency),
        value => { knobs.latency = Number(value) },
    )),
    field('Fail', select(
        [['none', 'nothing'], ['summarize', 'summarize'], ['fetch', 'fetch']],
        knobs.fail,
        value => { knobs.fail = value as typeof knobs.fail },
    )),
    field('Ingest', select(
        [['off', 'as asked'], ['veto', 'veto every batch'], ['halve', 'keep every other node']],
        knobs.ingest,
        value => { knobs.ingest = value as typeof knobs.ingest },
    )),
    field('Objects', select(
        [['auto', 'auto-ingest'], ['stage', 'stage for triage']],
        knobs.stageObjects ? 'stage' : 'auto',
        value => { knobs.stageObjects = value === 'stage' },
    )),
    // Six providers is comfortably inside what a rim can name, so the summary shape
    // has to be asked for here. On the misp-modules page, with 119, it is the default.
    field('Rim', select(
        [['per-pivot', 'one per pivot'], ['summary', 'one for all'], ['off', 'none']],
        graph.pivots.rimBadge,
        value => {
            graph.pivots.rimBadge = value as typeof graph.pivots.rimBadge
            // Not a data change: only what the rim draws moved.
            graph.renderer.update(false)
        },
    )),
    field('Save', select(
        [
            ['ok', 'writes everything'],
            ['half', 'writes every other node'],
            ['throw', 'refuses the batch'],
            ['mint', 'writes, and renames'],
        ],
        knobs.save,
        value => { knobs.save = value as typeof knobs.save },
    )),
    field('Auto-save', select(
        [['off', 'on the gesture'], ['on', 'Objects writes itself']],
        knobs.autoSave ? 'on' : 'off',
        value => { knobs.autoSave = value === 'on' },
    )),
    field('Mark', select(
        [['off', 'no unsaved class'], ['on', 'pvt-node-unsaved']],
        graph.pivots.markUnsaved ? 'on' : 'off',
        value => {
            graph.pivots.markUnsaved = value === 'on'
            for (const node of graph.getMutableNodes()) node.markDirty()
            graph.renderer.update(false)
        },
    )),
    field('Ceiling', ceiling),
    button('Save', 'graph.pivots.save() — write every unsaved run back', () => {
        const pending = graph.pivots.unsavedCount()
        if (!pending.nodes && !pending.edges) graph.notifier.info('Save', 'Nothing is waiting to be written')
        else void graph.pivots.save()
    }),
    button('Undo', 'graph.history.undo() — take the newest entry back', () => {
        if (!graph.history.undo().length) graph.notifier.info('Undo', 'Nothing left to undo')
    }),
    button('Redo', 'graph.history.redo() — put it back, no refetch', () => {
        if (!graph.history.redo().length) graph.notifier.info('Redo', 'Nothing to redo')
    }),
    button('Invalidate', 'graph.pivots.invalidate() — drop every cached summary', () => {
        graph.pivots.invalidate()
        graph.notifier.info('Invalidate', 'Cached summaries dropped; re-enter Pivot mode to re-ask')
    }),
    button('Cancel', 'graph.pivots.cancel() — abort every call in flight', () => graph.pivots.cancel()),
    button('Log', 'Dump the staged sets, the run log, the rejections and the ledger to the console', () => {
        console.log('staged', graph.pivots.staged())
        console.log('history', graph.history.entries())
        console.log('rejected', Object.fromEntries(
            PIVOTS.map(pivot => [pivot.id, graph.pivots.rejectedIds(pivot.id)]),
        ))
        console.log('unsaved', graph.pivots.unsaved(), graph.pivots.unsavedCount())
        console.log('canonical', Object.fromEntries(
            graph.getMutableNodes()
                .map(node => [node.id, graph.pivots.canonicalId(node)])
                .filter(([, canonical]) => canonical),
        ))
    }),
    button('Reload', 'Start over: rejection memory and the run log are session-only', () => location.reload()),
    status,
)

const sheet = document.createElement('details')
sheet.className = 'devbar-sheet'
const sheetSummary = document.createElement('summary')
sheetSummary.textContent = `${PIVOTS.length} pivots`
const sheetList = document.createElement('ul')
for (const pivot of PIVOTS) {
    const item = document.createElement('li')
    const name = document.createElement('strong')
    name.textContent = pivot.label
    item.append(name, document.createTextNode(` — ${NOTES[pivot.id] ?? ''}`))
    sheetList.append(item)
}
sheet.append(sheetSummary, sheetList)
bar.append(sheet)
