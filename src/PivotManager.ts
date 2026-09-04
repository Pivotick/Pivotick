import { Edge } from './Edge'
import type { Graph } from './Graph'
import type { RawEdge, RawNode } from './interfaces/GraphOptions'
import type { IngestContext, IngestDecision } from './interfaces/InterractionCallbacks'
import type {
    PivotCandidate, PivotCandidateEdge, PivotCandidateSet, PivotContext, PivotDefinition,
    PivotManagerLike, PivotNarrowing, PivotRefusal, PivotRejection, PivotRimBadge, PivotRun, PivotRunOutcome,
    PivotSaveContext, PivotSaveOutcome, PivotSavePayload, PivotSaveReport, PivotSummary,
} from './interfaces/Pivot'
import { SEED_SOURCE } from './interfaces/Pivot'
import type { Node } from './Node'
import { confirmModal } from './editing/PromptModal'
import type { Notification, NotificationAction, NotificationHandle } from './ui/Notifier'
import { NotificationLevel } from './ui/Notifier'

/** What changed, so a surface can re-render only what it shows. */
export type PivotChange = 'registry' | 'summarize' | 'candidates' | 'runs' | 'save'

/** How far unpositioned candidates are scattered around their origin. */
const SEED_JITTER = 160

/**
 * The pivot runtime: the registry, the two provider calls with their cancellation
 * and cache, the narrowing gate, the candidate sets awaiting triage, and ingest
 * with its provenance. Taking a run back is `graph.history`'s job, alongside every
 * other thing the analyst can reverse.
 *
 * It holds no UI. Everything here is drivable from the console — a pivot with
 * `autoIngest: true` is end to end without a single pane — and the triage pane and
 * the Pivot rail mode are readers of this state, not owners of it.
 *
 * Reached as {@link Graph.pivots}.
 *
 * @category Pivots
 */
export class PivotManager implements PivotManagerLike {
    /**
     * Absolute ceiling on what one `fetch` may stage. A provider that returns more is
     * **refused** — nothing is staged, nothing is truncated, and the analyst is told
     * the number. It is about memory for candidate objects, not the table, which
     * virtualises. Override it through `pivotCandidateCeiling` in the graph options.
     */
    public candidateCeiling = 10_000

    /**
     * Whether a node a run created and has not written back carries a
     * `pvt-node-unsaved` class. Set it through `pivotMarkUnsaved` in the graph
     * options, or here to change it later.
     */
    public markUnsaved = false

    private _rimBadge: PivotRimBadge = 'per-pivot'

    /**
     * What the library draws on a node's rim for its pivots: one badge per pivot that
     * declared a potential, one badge for all of them, or nothing. Set it through
     * `pivotRimBadge` in the graph options, or here to change it later.
     *
     * Assigning marks every node dirty, the way `setPotential` does for one — the rim
     * redraws on the next render, so call `graph.renderer.update()` if nothing else is
     * about to.
     */
    public get rimBadge(): PivotRimBadge {
        return this._rimBadge
    }

    public set rimBadge(mode: PivotRimBadge) {
        if (mode === this._rimBadge) return
        this._rimBadge = mode
        for (const node of this.graph.getMutableNodes()) node.markDirty()
    }

    private readonly graph: Graph
    private readonly defs = new Map<string, PivotDefinition>()

    /** Cached summaries, keyed by (pivot id, sorted origin ids, narrowing). */
    private readonly cache = new Map<string, PivotSummary>()
    /** Which nodes each cache entry was asked about, so a removal can drop it. */
    private readonly cacheNodes = new Map<string, Set<string>>()
    /** In-flight provider calls, keyed `summarize:<id>` / `fetch:<id>`. */
    private readonly inFlight = new Map<string, AbortController>()
    /** How many pivots apply to each node, for the rim. Dropped wholesale, never per key. */
    private readonly counts = new Map<string, number>()

    /**
     * Explicitly rejected candidates, keyed by pivot id then candidate id, holding the
     * row the verdict was given on. The memory outlives the set that carried it, so
     * keeping the row is the only way a surface can name what is being held back.
     */
    private readonly rejected = new Map<string, Map<string, RawNode | RawEdge>>()
    /** At most one candidate set per pivot: a re-run replaces it. */
    private readonly candidateSets = new Map<string, PivotCandidateSet>()

    private readonly listeners = new Set<(change: PivotChange) => void>()
    /** How many times each pivot has landed a run, so two runs of one are told apart. */
    private readonly ordinals = new Map<string, number>()

    /**
     * Every run this session, by id — the ledger below hangs off these. Kept for the
     * session rather than dropped with an undo: undoing a run takes its nodes off the
     * canvas, and a redo puts the same nodes back, which must not present a saved run
     * as unsaved and invite a second write of the same twelve objects. What is
     * *pending* is computed against what is on canvas, so an undone run is already
     * absent from every count without the record having to go.
     */
    private readonly runs = new Map<string, PivotRun>()
    /** Which run created each node, and each edge — the ledger's key space. */
    private readonly nodeRun = new Map<string, string>()
    private readonly edgeRun = new Map<string, string>()
    /** Written to the source system, and therefore not in any payload again. */
    private readonly savedNodes = new Set<string>()
    private readonly savedEdges = new Set<string>()
    /** The id the source system minted, by local id, and the way back. */
    private readonly canonical = new Map<string, string>()
    private readonly aliases = new Map<string, string>()
    /** Saves in flight, by run id: a second Save on the same run is a no-op, not a double write. */
    private readonly saving = new Map<string, AbortController>()
    /** How many times each run's save has been attempted. */
    private readonly attempts = new Map<string, number>()

    private runSeq = 0

    constructor(graph: Graph) {
        this.graph = graph
        // A cached summary about a node that no longer exists is a lie waiting to be
        // told; every other invalidation is the consumer's call.
        graph.on('nodeRemove', (node: Node) => this.dropCacheFor(node.id))
        // `appliesTo` reads node data, so anything that moves a node's data moves the
        // answer. Dropped whole rather than per node: the predicates are cheap, the
        // bookkeeping to know which node an edit touched is not.
        graph.on('nodeAdd', () => this.counts.clear())
        graph.on('nodeChange', () => this.counts.clear())
        graph.on('nodeRemove', () => this.counts.clear())
        graph.on('dataBatchChanged', () => this.counts.clear())
    }

    // --- registry ----------------------------------------------------------------------

    /**
     * Register a pivot. Returns a disposer; calling it twice is a no-op. A duplicate
     * id is skipped with a warning, as everywhere else in the library.
     */
    public register(definition: PivotDefinition): () => void {
        if (!definition?.id) {
            console.warn('Pivotick: a pivot needs an id; skipping it.')
            return () => {}
        }
        if (typeof definition.fetch !== 'function') {
            console.warn(`Pivot "${definition.id}" declares no \`fetch\`; skipping it.`)
            return () => {}
        }
        if (this.defs.has(definition.id)) {
            console.warn(`A pivot with id "${definition.id}" already exists; skipping the duplicate.`)
            return () => {}
        }
        this.defs.set(definition.id, definition)
        this.notify('registry')

        let disposed = false
        return () => {
            if (disposed) return
            disposed = true
            this.unregister(definition.id)
        }
    }

    /** Unregister a pivot, dropping its cached summaries and its staged candidates. */
    public unregister(id: string): void {
        if (!this.defs.delete(id)) return
        this.cancel(id)
        this.invalidate(id)
        this.candidateSets.delete(id)
        this.notify('registry')
    }

    public get(id: string): PivotDefinition | undefined {
        return this.defs.get(id)
    }

    /** Every registered pivot, in registration order. */
    public all(): PivotDefinition[] {
        return [...this.defs.values()]
    }

    /** How many pivots are registered — what the Pivot rail mode's gating reads. */
    public get size(): number {
        return this.defs.size
    }

    /**
     * What applies to this origin. An empty origin yields the origin-less pivots —
     * search, import, staging — and nothing else, because a selection-driven pivot
     * with no selection has nothing to run on.
     *
     * A pivot that applies to only *part* of the origin is in: a selection mixing a
     * domain and an IP offers the domain-only providers too, and each is run against
     * the nodes it kept.
     */
    public for(nodes: Node[]): PivotDefinition[] {
        if (!nodes.length) return this.all().filter(d => d.origin === 'none')
        return this.all().filter(d => d.origin !== 'none' && this.applicable(d, nodes).length > 0)
    }

    /**
     * How many pivots apply to one node — what the `'summary'` rim badge counts when
     * nothing was declared for it.
     *
     * Memoised, because the rim asks this for every node on every render and the
     * answer is one `appliesTo` call per registered pivot: at a hundred providers and
     * a thousand nodes, asking each time is a hundred thousand calls a frame. The memo
     * is dropped whenever the registry or the graph's nodes change, so a predicate
     * reading anything *else* can go stale — acceptable for a hint on the rim, and the
     * panel is always the exact answer.
     */
    public applicableCount(node: Node): number {
        const cached = this.counts.get(node.id)
        if (cached !== undefined) return cached
        const count = this.for([node]).length
        this.counts.set(node.id, count)
        return count
    }

    /**
     * How much of `nodes` one pivot applies to. Empty when it does not apply, and
     * empty for an origin-less pivot, which is asked about nothing by definition.
     */
    public originFor(id: string, nodes: Node[]): Node[] {
        const def = this.defs.get(id)
        if (!def || def.origin === 'none') return []
        return this.applicable(def, nodes)
    }

    /**
     * The origin a pivot would actually be called with: everything `appliesTo` kept.
     *
     * `true` keeps the origin whole, `false` and an empty array both mean it does not
     * apply, and an array is taken as-is — minus anything that was not in the origin
     * to begin with, so a provider cannot widen its own reach by returning a node
     * nobody picked.
     */
    private applicable(def: PivotDefinition, nodes: Node[]): Node[] {
        if (def.origin === 'none') return []
        if (!def.appliesTo) return nodes
        const verdict = def.appliesTo(nodes)
        if (typeof verdict === 'boolean') return verdict ? nodes : []
        if (!Array.isArray(verdict)) return []
        const picked = new Set(verdict)
        return nodes.filter(node => picked.has(node))
    }

    // --- summarize ---------------------------------------------------------------------

    /**
     * Ask a pivot what is out there. Serves a cached answer without touching the
     * provider, and supersedes any summarize already in flight for the same pivot.
     *
     * Resolves `undefined` when the call was superseded or cancelled — nothing to
     * render, and never an error. A provider that throws rejects, so a surface can
     * show the failure and offer a retry.
     */
    public async summarize(
        id: string,
        nodes: Node[] = [],
        narrowing: PivotNarrowing = {},
    ): Promise<PivotSummary | undefined> {
        const def = this.defs.get(id)
        if (!def?.summarize) return undefined

        const origin = this.applicable(def, nodes)
        const key = this.cacheKey(id, origin, narrowing)
        const cached = this.cache.get(key)
        if (cached) return cached

        const controller = this.arm(`summarize:${id}`)
        let summary: PivotSummary
        try {
            summary = await def.summarize(origin, narrowing, this.context(id, controller))
        } finally {
            if (this.inFlight.get(`summarize:${id}`) === controller) this.inFlight.delete(`summarize:${id}`)
        }
        if (controller.signal.aborted) return undefined

        this.cache.set(key, summary)
        this.cacheNodes.set(key, new Set(origin.map(n => n.id)))
        this.notify('summarize')
        return summary
    }

    /**
     * The cached summary for exactly this question, if there is one. Lets a surface
     * paint a number it already knows without asking again.
     */
    public cachedSummary(id: string, nodes: Node[] = [], narrowing: PivotNarrowing = {}): PivotSummary | undefined {
        return this.cache.get(this.cacheKey(id, nodes, narrowing))
    }

    /**
     * Drop cached summaries: all of them, one pivot's, or only those asked about
     * particular nodes. The library caches because a multi-selection summary is an
     * aggregate nothing can decompose, but only the consumer knows when their backend
     * changed.
     */
    public invalidate(pivotId?: string, nodes?: Node[]): void {
        const ids = nodes ? new Set(nodes.map(n => n.id)) : undefined
        for (const key of [...this.cache.keys()]) {
            if (pivotId && !key.startsWith(`${pivotId}\u0000`)) continue
            if (ids && ![...(this.cacheNodes.get(key) ?? [])].some(id => ids.has(id))) continue
            this.cache.delete(key)
            this.cacheNodes.delete(key)
        }
        this.notify('summarize')
    }

    /**
     * Abort in-flight provider calls: one pivot's or every pivot's, and optionally only
     * one kind.
     *
     * The `kind` is what lets leaving a surface stop the questions it was asking without
     * cancelling the work it commissioned — a `fetch` already has a candidate set of its
     * own and a pane showing it, so abandoning that silently would throw away results
     * nobody asked to lose.
     */
    public cancel(pivotId?: string, kind?: 'summarize' | 'fetch'): void {
        for (const [key, controller] of [...this.inFlight]) {
            if (pivotId && !key.endsWith(`:${pivotId}`)) continue
            if (kind && !key.startsWith(`${kind}:`)) continue
            controller.abort()
            this.inFlight.delete(key)
        }
    }

    // --- running -----------------------------------------------------------------------

    /**
     * Run a pivot: gate the advertised count against its cap, fetch, then either land
     * the results (`autoIngest`) or stage them for triage.
     *
     * Resolves at the hand-off — a staged run does not wait on the analyst. The
     * outcome's `runId` is the id the resulting ingest is recorded under, so it is
     * the handle for `graph.history.undo`.
     */
    public async run(id: string, nodes: Node[] = [], narrowing: PivotNarrowing = {}): Promise<PivotRunOutcome> {
        const def = this.defs.get(id)
        if (!def) throw new Error(`No pivot is registered with id "${id}".`)

        // Only what the pivot said it applies to. A caller handing over a mixed
        // selection gets the same narrowing the panel would have done, and the set's
        // `origin` records what was actually asked about.
        const origin = this.applicable(def, nodes)
        const runId = this.nextRunId(id)

        // Offered nodes and kept none of them: asking the provider about an empty
        // origin instead would be a run that looks fine and answers nothing. An origin
        // that was empty to begin with is a different thing, and still allowed — as is
        // an origin-less pivot, which is asked about nothing whatever is selected.
        if (def.origin !== 'none' && nodes.length && !origin.length) {
            return {
                status: 'failed',
                runId,
                nodes: [],
                edges: [],
                deduped: 0,
                suppressed: 0,
                error: new Error(`Pivot "${id}" does not apply to any of the ${nodes.length} node(s) it was run on.`),
            }
        }

        // The gate. Judged on the freshest advisory count for the *current* narrowing,
        // which is what lets a refusal lift as the analyst narrows. A cache hit here is
        // the common case — the surface just asked the same question.
        if (def.maxCandidates !== undefined && def.summarize) {
            let summary: PivotSummary | undefined
            try {
                summary = await this.summarize(id, origin, narrowing)
            } catch (error) {
                // The gate could not see a count, so the run cannot proceed — but the
                // caller gets an outcome to render, not an exception to catch.
                return { status: 'failed', runId, nodes: [], edges: [], deduped: 0, suppressed: 0, error }
            }
            if (summary && summary.total > def.maxCandidates) {
                return this.refuse(runId, { kind: 'cap', count: summary.total, limit: def.maxCandidates })
            }
        }

        const set: PivotCandidateSet = {
            pivotId: id,
            label: def.label,
            origin,
            narrowing,
            runId,
            fetched: 0,
            deduped: 0,
            suppressed: 0,
            nodes: [],
            edges: [],
            loading: true,
        }
        // A re-run over triage already done waits beside the set on show rather than
        // replacing it: a re-run is one pane, not a stack, but discarding the analyst's
        // marks unasked is not the library's call. With nothing marked there is nothing
        // to lose, and it replaces outright.
        const live = this.candidateSets.get(id)
        const waiting = !def.autoIngest && !!live && !live.loading && this.hasMarks(live)

        // The set exists from the moment `fetch` starts, so a failure has somewhere to
        // live and the surface can show the run in flight.
        if (waiting) live.pending = set
        else this.candidateSets.set(id, set)
        this.notify('candidates')

        /** Take this run's set away again — identity-checked, so a newer run's set survives. */
        const drop = (): void => {
            if (waiting) { if (live.pending === set) delete live.pending }
            else if (this.candidateSets.get(id) === set) this.candidateSets.delete(id)
            this.notify('candidates')
        }

        const controller = this.arm(`fetch:${id}`)
        let result: { nodes: RawNode[], edges: RawEdge[] }
        try {
            result = await def.fetch(origin, narrowing, this.context(id, controller))
        } catch (error) {
            if (this.inFlight.get(`fetch:${id}`) === controller) this.inFlight.delete(`fetch:${id}`)
            if (controller.signal.aborted) {
                drop()
                return { status: 'cancelled', runId, nodes: [], edges: [], deduped: 0, suppressed: 0 }
            }
            // Nothing was ever offered for triage on an auto-ingest, so its failure has
            // no pane to live in — it is the notifier's to report.
            if (def.autoIngest) {
                drop()
                this.report(def, `Couldn't fetch ${def.label}`, String((error as Error)?.message ?? error))
            } else {
                set.loading = false
                set.error = error
                this.notify('candidates')
            }
            return { status: 'failed', runId, nodes: [], edges: [], deduped: 0, suppressed: 0, error }
        }
        if (this.inFlight.get(`fetch:${id}`) === controller) this.inFlight.delete(`fetch:${id}`)
        if (controller.signal.aborted) {
            drop()
            return { status: 'cancelled', runId, nodes: [], edges: [], deduped: 0, suppressed: 0 }
        }

        this.stage(set, result)
        this.notify('candidates')

        // The set is kept, empty of candidates and carrying its refusal — same as a
        // failed fetch, and for the same reason: the number, the limit and the way
        // forward have to be shown somewhere, and only a pane can show them.
        if (set.refused) {
            if (def.autoIngest) {
                drop()
                // Same reason as a failure: the number, the limit and the way forward
                // have to be seen somewhere, and there is no pane on this path.
                this.report(def, `${def.label} returned too much`,
                    `${set.refused.count.toLocaleString()} candidates, over the ${set.refused.limit.toLocaleString()} limit.`
                    + ' Nothing was ingested — narrow and run again.')
            }
            return this.refuse(runId, set.refused)
        }

        if (!def.autoIngest) {
            return {
                status: 'staged',
                runId,
                nodes: [],
                edges: [],
                deduped: set.deduped,
                suppressed: set.suppressed,
            }
        }

        // Auto-ingest: no triage, so everything landable is marked and committed. The
        // gate above still applied, and `onBeforeIngest` still gets its say.
        for (const candidate of set.nodes) if (!candidate.deduped) candidate.state = 'marked'
        for (const edge of set.edges) edge.state = 'marked'
        try {
            return await this.ingest(id, 'auto')
        } finally {
            // Nothing was ever offered for triage, so nothing is left waiting for it —
            // not even after a veto.
            this.candidateSets.delete(id)
            this.notify('candidates')
        }
    }

    /**
     * Say something went wrong on a path with no surface of its own. Only the
     * auto-ingest paths use it: everything staged for triage carries its own error or
     * refusal into its pane, where the analyst is already looking.
     */
    private report(def: PivotDefinition, title: string, message: string): void {
        this.graph.notifier?.error(title, message)
    }

    /** Cancel a fetch in flight. The candidate set goes with it; nothing is staged. */
    public cancelFetch(pivotId: string): void {
        this.inFlight.get(`fetch:${pivotId}`)?.abort()
    }

    /**
     * Sort one fetch's results into candidates. Nothing here touches the graph: this
     * is exactly the point at which results are *not yet* data.
     */
    private stage(set: PivotCandidateSet, fetched: { nodes: RawNode[], edges: RawEdge[] }): void {
        // Before anything reads an id: a run that saved minted canonical ids upstream,
        // and the next fetch returns those same objects under them. Translating here
        // means dedup, the children union and the edge endpoints all see the ids the
        // canvas actually holds, instead of each having to know about aliases.
        const result = this.deAlias(fetched)
        set.loading = false
        set.fetched = result.nodes.length

        if (result.nodes.length > this.candidateCeiling) {
            set.refused = { kind: 'ceiling', count: result.nodes.length, limit: this.candidateCeiling }
            return
        }

        const rejected = this.rejected.get(set.pivotId)
        for (const raw of result.nodes) {
            const id = String(raw.id)
            // Explicitly rejected earlier this session: not re-offered, and counted so
            // the pane can say why the number shrank.
            if (rejected?.has(id)) {
                set.suppressed++
                continue
            }
            const onCanvas = !!this.graph.getMutableNode(id)
            if (onCanvas) set.deduped++
            set.nodes.push({ id, raw, deduped: onCanvas, state: 'candidate' })
        }

        // Edges follow their endpoints: an edge lands iff both ends end up on canvas.
        // The exception is an edge whose endpoints are *all already there* and neither
        // of which is a landable candidate — a correlation between two nodes on screen.
        // With follow-the-nodes alone it would land without ever being triaged, so it
        // gets a row of its own.
        const landable = new Set(set.nodes.filter(c => !c.deduped).map(c => c.id))
        for (const raw of result.edges) {
            const from = String(raw.from)
            const to = String(raw.to)
            if (!landable.has(from) && !landable.has(to)) {
                if (this.graph.getMutableNode(from) && this.graph.getMutableNode(to)) {
                    set.edges.push({ id: this.edgeKey(raw), raw, state: 'candidate' })
                }
                // Otherwise an endpoint is neither staged nor on canvas: the edge can
                // never land, so it is not offered.
                continue
            }
            set.carried = set.carried ?? []
            set.carried.push(raw)
        }
    }

    // --- triage ------------------------------------------------------------------------

    /** The candidates staged for one pivot, if any. */
    public candidates(pivotId: string): PivotCandidateSet | undefined {
        return this.candidateSets.get(pivotId)
    }

    /** Every staged candidate set — one per pivot that has been run and not yet cleared. */
    public staged(): PivotCandidateSet[] {
        return [...this.candidateSets.values()]
    }

    /**
     * Mark or unmark a candidate for ingest. Deliberately silent: with hundreds of
     * rows, re-rendering the pane on every tick loses the analyst's place, so the
     * caller updates the row it just changed.
     */
    public mark(pivotId: string, id: string, marked = true): void {
        const candidate = this.findCandidate(pivotId, id)
        if (!candidate || candidate.state === 'rejected') return
        candidate.state = marked ? 'marked' : 'candidate'
    }

    /** Mark every landable candidate — what "select all" resolves to. */
    public markAll(pivotId: string, marked = true): void {
        const set = this.candidateSets.get(pivotId)
        if (!set) return
        for (const candidate of set.nodes) {
            if (candidate.state === 'rejected' || candidate.deduped) continue
            candidate.state = marked ? 'marked' : 'candidate'
        }
        for (const edge of set.edges) {
            if (edge.state === 'rejected') continue
            edge.state = marked ? 'marked' : 'candidate'
        }
        this.notify('candidates')
    }

    /**
     * Reject candidates explicitly. Remembered for the session, keyed per pivot: a
     * candidate rejected under one pivot is still offered by another, which asks about
     * it in a different analytic context.
     */
    public reject(pivotId: string, ids: string[]): void {
        const remembered = this.rejected.get(pivotId) ?? new Map<string, RawNode | RawEdge>()
        for (const id of ids) {
            const candidate = this.findCandidate(pivotId, id)
            if (!candidate) continue
            candidate.state = 'rejected'
            remembered.set(id, candidate.raw)
        }
        this.rejected.set(pivotId, remembered)
        this.notify('candidates')
    }

    /**
     * Take a rejection back. Reaches the session memory whether or not the candidate is
     * still staged — a rejection from an earlier run suppresses the row rather than
     * showing it, and taking it back is the only way that row is ever offered again.
     */
    public unreject(pivotId: string, id: string): void {
        const candidate = this.findCandidate(pivotId, id)
        if (candidate) candidate.state = 'candidate'
        const remembered = this.rejected.get(pivotId)?.delete(id)
        if (candidate || remembered) this.notify('candidates')
    }

    /**
     * Reject everything still untriaged in this set — how triaging 1,800 down to 12
     * and dismissing the rest stays one gesture.
     */
    public rejectRemaining(pivotId: string): void {
        const set = this.candidateSets.get(pivotId)
        if (!set) return
        this.reject(pivotId, set.nodes.filter(c => c.state === 'candidate').map(c => c.id))
    }

    /**
     * Take every rejection this pivot holds back. The way out of a `Reject all
     * remaining` that went too far, which one-by-one restoring is not.
     */
    public unrejectAll(pivotId: string): void {
        const remembered = this.rejected.get(pivotId)
        if (!remembered?.size) return
        for (const id of remembered.keys()) {
            const candidate = this.findCandidate(pivotId, id)
            if (candidate) candidate.state = 'candidate'
        }
        this.rejected.delete(pivotId)
        this.notify('candidates')
    }

    /** How many candidates have been rejected for this pivot this session. */
    public rejectedCount(pivotId: string): number {
        return this.rejected.get(pivotId)?.size ?? 0
    }

    /** The rejected candidate ids for this pivot — what the pane reveals on demand. */
    public rejectedIds(pivotId: string): string[] {
        return [...(this.rejected.get(pivotId)?.keys() ?? [])]
    }

    /**
     * The rejections themselves, rows and all, newest last. What a surface listing them
     * shows: an id names nothing once the run that carried it is gone.
     */
    public rejectedRows(pivotId: string): PivotRejection[] {
        return [...(this.rejected.get(pivotId)?.entries() ?? [])]
            .map(([id, raw]) => ({ id, raw, label: String(raw.data?.label ?? id) }))
    }

    /** Whether the analyst has marked anything here — what a re-run must not discard. */
    private hasMarks(set: PivotCandidateSet): boolean {
        return set.nodes.some(c => c.state === 'marked') || set.edges.some(e => e.state === 'marked')
    }

    /**
     * Promote a waiting re-run: its candidates become the set on show, and the marks
     * on the one it replaces go with it. A no-op while the re-run is still fetching —
     * swapping in a set with nothing in it yet would be the silent discard this whole
     * mechanism exists to avoid.
     */
    public showPending(pivotId: string): void {
        const set = this.candidateSets.get(pivotId)
        const next = set?.pending
        if (!set || !next || next.loading) return
        delete set.pending
        this.candidateSets.set(pivotId, next)
        this.notify('candidates')
    }

    /**
     * Drop a waiting re-run and carry on with what is on show. Nothing is rejected:
     * the next run offers those candidates again.
     */
    public dismissPending(pivotId: string): void {
        const set = this.candidateSets.get(pivotId)
        if (!set?.pending) return
        const wasLoading = set.pending.loading
        delete set.pending
        if (wasLoading) this.cancelFetch(pivotId)
        this.notify('candidates')
    }

    /**
     * Drop a staged set without rejecting anything. Closing a pane is not a verdict:
     * whatever was never rejected is offered again on the next run.
     */
    public discard(pivotId: string): void {
        this.cancelFetch(pivotId)
        if (this.candidateSets.delete(pivotId)) this.notify('candidates')
    }

    // --- ingest ------------------------------------------------------------------------

    /**
     * Commit the marked candidates of one staged set.
     *
     * Purely additive: an id already on canvas is skipped, never overwritten, and
     * removal only ever happens through `graph.history` or `graph.removeBySource`.
     * The whole batch goes through `onBeforeIngest` once, and lands as one
     * `dataBatchChanged`.
     */
    public async ingest(pivotId: string, trigger: 'triage' | 'auto' = 'triage'): Promise<PivotRunOutcome> {
        const set = this.candidateSets.get(pivotId)
        if (!set) throw new Error(`No candidates are staged for pivot "${pivotId}".`)

        // A set's own runId is used by its first ingest; a later partial ingest out of
        // the same set is its own run, so each batch is separately undoable.
        const runId = set.runId
        set.runId = this.nextRunId(pivotId)

        let marked = set.nodes.filter(c => c.state === 'marked' && !c.deduped)
        let markedEdges = set.edges.filter(e => e.state === 'marked')
        const deduped = set.nodes.filter(c => c.deduped)

        const hook = this.graph.getCallbacks()?.onBeforeIngest
        if (hook) {
            const context: IngestContext = {
                pivotId,
                origin: set.origin,
                candidates: { nodes: marked.map(c => c.raw), edges: markedEdges.map(e => e.raw) },
                trigger,
                confirm: options => confirmModal(this.graph, options),
            }
            const decision = normaliseDecision(await hook(context))
            if (!decision.accept) {
                return { status: 'vetoed', runId, nodes: [], edges: [], deduped: set.deduped, suppressed: set.suppressed }
            }
            if (decision.nodes) {
                const keep = new Set(decision.nodes.map(n => String(n.id)))
                marked = marked.filter(c => keep.has(c.id))
            }
            if (decision.edges) {
                const keep = new Set(decision.edges.map(e => this.edgeKey(e)))
                markedEdges = markedEdges.filter(e => keep.has(e.id))
            }
        }

        const run: PivotRun = {
            runId,
            pivotId,
            origin: set.origin,
            nodeIds: [],
            childIds: [],
            edgeIds: [],
            vouchedNodeIds: [],
            vouchedEdgeIds: [],
            unions: [],
            nodes: [],
            edges: [],
            at: Date.now(),
            saved: 0,
        }
        const landedNodes: Node[] = []
        const landedEdges: Edge[] = []
        const seed = this.seedPoint(set.origin)

        this.graph.batchChanges(() => {
            for (const candidate of marked) {
                const raw: RawNode = {
                    ...candidate.raw,
                    // Unpositioned candidates are seeded around the node they came from,
                    // jittered so the simulation fans them out instead of stacking them.
                    x: candidate.raw.x ?? seed.x + (Math.random() - 0.5) * SEED_JITTER,
                    y: candidate.raw.y ?? seed.y + (Math.random() - 0.5) * SEED_JITTER,
                }
                let node: Node
                try {
                    node = this.graph.addNode(raw)
                } catch {
                    // Already there. Dedup catches this at stage time; a race is not
                    // worth killing a run over.
                    continue
                }
                node.vouch(pivotId, runId)
                run.nodeIds.push(node.id)
                run.nodes.push(raw)
                landedNodes.push(node)
                // A container arrives with its contents, and each one needs its own
                // record — otherwise undo leaves them behind and `removeBySource`
                // never reaches them.
                for (const child of node.descendants()) {
                    child.vouch(pivotId, runId)
                    run.childIds.push(child.id)
                }
            }

            // A carried edge follows its endpoints, so only this run's landed nodes can
            // bring one in — the rest stay with the candidates still awaiting triage.
            const landed = new Set(run.nodeIds)
            const carried = (set.carried ?? []).filter(
                raw => landed.has(String(raw.from)) || landed.has(String(raw.to)),
            )
            const consumed = new Set<string>()
            for (const raw of [...markedEdges.map(e => e.raw), ...carried]) {
                const key = this.edgeKey(raw)
                if (consumed.has(key)) continue
                consumed.add(key)
                if (!this.graph.getMutableNode(String(raw.from)) || !this.graph.getMutableNode(String(raw.to))) continue
                let edge: Edge
                try {
                    edge = this.graph.addEdge(raw)
                } catch {
                    // A duplicate edge is already asserted; vouch for it rather than
                    // reporting a failure the analyst can do nothing about.
                    const existing = this.graph.getMutableEdge(key)
                    if (existing) {
                        this.vouchExisting(existing, pivotId, runId)
                        run.vouchedEdgeIds.push(existing.id)
                    }
                    continue
                }
                edge.vouch(pivotId, runId)
                run.edgeIds.push(edge.id)
                run.edges.push(raw)
                landedEdges.push(edge)
            }

            // A candidate that was already on canvas is not landed, but this run did
            // assert it exists — so it vouches for it. That is what makes two
            // overlapping pivots both hold a claim on the same node, and what lets
            // undo drop one claim without deleting what the other still vouches for.
            for (const candidate of deduped) {
                const existing = this.graph.getMutableNode(candidate.id)
                if (!existing) continue
                this.vouchExisting(existing, pivotId, runId)
                run.vouchedNodeIds.push(existing.id)

                // …and if it brought children, they are merged in by id: added, never
                // updated, never removed. They ride with their container the way a
                // carried edge rides with its endpoints, so they are not rows of their
                // own — there is nowhere else to put a child.
                const children = candidate.raw.children
                if (!children?.length) continue
                const added = this.graph.unionChildren(existing, children)
                if (!added.length) continue
                for (const child of added) {
                    child.vouch(pivotId, runId)
                    run.childIds.push(child.id)
                }
                run.unions.push({ parentId: existing.id, children })
            }
        })

        // Ingested rows leave the set; rejections and untriaged leftovers stay. What
        // leaves is written down, so undoing this ingest can put it back.
        const landedIds = new Set(run.nodeIds)
        const landedEdgeKeys = new Set(run.edgeIds)
        const keptCarried = set.carried?.filter(
            raw => !landedIds.has(String(raw.from)) && !landedIds.has(String(raw.to)),
        )
        run.restage = {
            label: set.label,
            origin: set.origin,
            narrowing: set.narrowing,
            fetched: set.fetched,
            nodes: set.nodes
                .map((row, at) => ({ at, row }))
                .filter(({ row }) => landedIds.has(row.id)),
            edges: set.edges
                .map((row, at) => ({ at, row }))
                .filter(({ row }) => landedEdgeKeys.has(row.id) || row.state === 'marked'),
            carried: (set.carried ?? []).filter(raw => !keptCarried?.includes(raw)),
        }
        set.nodes = set.nodes.filter(c => !landedIds.has(c.id))
        set.edges = set.edges.filter(e => !landedEdgeKeys.has(e.id) && e.state !== 'marked')
        set.carried = keptCarried
        set.deduped = set.nodes.filter(c => c.deduped).length

        if (run.nodeIds.length || run.edgeIds.length || run.vouchedNodeIds.length || run.vouchedEdgeIds.length) {
            const ordinal = (this.ordinals.get(pivotId) ?? 0) + 1
            this.ordinals.set(pivotId, ordinal)
            // After the batch, so the run's ids are known — which means the nodes have
            // already been drawn once, as not-savable, and have to be asked again.
            this.enrol(run)
            this.repaintUnsaved()
            this.graph.history.recordPivotRun(run, this.get(pivotId)?.label ?? pivotId, ordinal)
            this.notify('runs')
            // After the run is announced and the outcome is on its way back: the write
            // is the analyst's business only if it fails, and holding the canvas for a
            // slow backend would make an automatic save feel like a slow ingest.
            if (this.defs.get(pivotId)?.autoSave) void this.save(run.runId)
        }
        this.notify('candidates')

        return {
            status: 'ingested',
            runId,
            nodes: landedNodes,
            edges: landedEdges,
            deduped: deduped.length,
            suppressed: set.suppressed,
        }
    }

    // --- saving ------------------------------------------------------------------------

    /**
     * Write ingested runs back out to the systems their pivots speak to: one run, or
     * every savable run with something still unsaved.
     *
     * The library contributes the bookkeeping, not the transport — which elements a
     * run created, which of them have been written, and what a retry should carry.
     * The write itself is {@link PivotDefinition.save}'s, and a pivot that declares
     * none is skipped entirely rather than counted as failing.
     *
     * Runs go one at a time: a backend being written to is not helped by six parallel
     * batches, and a sequential pass makes the report exact.
     *
     * @param target A run id for one run, a pivot id for every unsaved run of that
     * pivot, or nothing for all of them.
     */
    public async save(target?: string): Promise<PivotSaveReport> {
        return this.runSave(target)
    }

    /**
     * The save itself, with the toast it should rewrite rather than stack on top of,
     * and what earlier attempts on that toast already wrote — which together are what
     * make `Saved 9 of 12 — Retry` become `Saved 12` rather than `Saved 3`.
     */
    private async runSave(
        target?: string,
        toast?: NotificationHandle,
        sofar: { nodes: number, edges: number } = { nodes: 0, edges: 0 },
    ): Promise<PivotSaveReport> {
        const targets = this.targeted(target)

        const report: PivotSaveReport = {
            runs: 0, savedNodes: 0, savedEdges: 0, pendingNodes: 0, pendingEdges: 0, errors: [],
        }
        let message: string | undefined

        for (const run of targets) {
            // Already being written by an earlier click: asking twice is not a reason
            // to send the same batch twice.
            if (this.saving.has(run.runId)) continue
            const before = this.pending(run)
            if (!countOf(before)) continue

            report.runs++
            const outcome = await this.write(run, before)
            if (outcome.error !== undefined) report.errors.push({ runId: run.runId, error: outcome.error })
            message = outcome.message ?? message

            report.savedNodes += outcome.nodes
            report.savedEdges += outcome.edges
            const after = this.pending(run)
            report.pendingNodes += after.nodes.length + after.children.length
            report.pendingEdges += after.edges.length
        }

        if (report.runs) {
            this.notify('save')
            this.repaintUnsaved()
            this.reportSave(report, message, target, toast, sofar)
        }
        return report
    }

    /**
     * Which runs a target names. A run id addresses one run; a pivot id addresses
     * every unsaved run that pivot has landed, which is what a triage pane's own Save
     * means — its provider may have been ingested more than once. The two never
     * collide: a run id is `<pivotId>#<n>`.
     */
    private targeted(target?: string): PivotRun[] {
        if (!target) return this.unsaved()
        const run = this.runs.get(target)
        if (run) return this.savable(run) ? [run] : []
        return this.unsaved().filter(candidate => candidate.pivotId === target)
    }

    /** Savable runs with elements still on canvas and not yet written. */
    public unsaved(): PivotRun[] {
        return [...this.runs.values()].filter(run => this.savable(run) && countOf(this.pending(run)) > 0)
    }

    /** What a Save would send — across every savable run, or one pivot's. */
    public unsavedCount(pivotId?: string): { nodes: number, edges: number } {
        let nodes = 0
        let edges = 0
        for (const run of this.unsaved()) {
            if (pivotId && run.pivotId !== pivotId) continue
            const pending = this.pending(run)
            nodes += pending.nodes.length + pending.children.length
            edges += pending.edges.length
        }
        return { nodes, edges }
    }

    /**
     * Written to the source system. `false` both for an element still waiting and for
     * one whose pivot can never write it anywhere — {@link isSavable} is the question
     * that tells those two apart.
     */
    public isSaved(element: Node | Edge): boolean {
        return element instanceof Edge ? this.savedEdges.has(element.id) : this.savedNodes.has(element.id)
    }

    /** Whether this element came from a run whose pivot declares a `save`. */
    public isSavable(element: Node | Edge): boolean {
        const runId = (element instanceof Edge ? this.edgeRun : this.nodeRun).get(element.id)
        const run = runId ? this.runs.get(runId) : undefined
        return !!run && this.savable(run)
    }

    /** The id the source system assigned this element, when it assigned one. */
    public canonicalId(element: Node | Edge): string | undefined {
        return this.canonical.get(element.id)
    }

    /**
     * Take a landed run into the ledger. Every element it created is keyed to it, so
     * the questions the surfaces ask — is this saved, can it ever be, what would a
     * retry send — are all a lookup rather than a scan.
     *
     * An element belongs to exactly one run: a later run that finds it already on
     * canvas vouches for it instead of creating it, so the two never contend for it.
     */
    private enrol(run: PivotRun): void {
        this.runs.set(run.runId, run)
        for (const id of [...run.nodeIds, ...run.childIds]) this.nodeRun.set(id, run.runId)
        for (const id of run.edgeIds) this.edgeRun.set(id, run.runId)
    }

    /** Whether this run's pivot is still registered and can write at all. */
    private savable(run: PivotRun): boolean {
        return typeof this.defs.get(run.pivotId)?.save === 'function'
    }

    /**
     * What this run still has to write: its own created elements, minus the ones
     * already written, minus the ones no longer on the canvas.
     *
     * The canvas check is what makes an undone run cost nothing — its nodes are gone,
     * so it has nothing pending — while leaving the record intact for the redo that
     * brings them back.
     */
    private pending(run: PivotRun): { nodes: Node[], children: Node[], edges: Edge[] } {
        const live = (ids: string[]): Node[] => ids
            .filter(id => !this.savedNodes.has(id))
            .map(id => this.graph.getMutableNode(id))
            .filter((node): node is Node => !!node)
        return {
            nodes: live(run.nodeIds),
            children: live(run.childIds),
            edges: run.edgeIds
                .filter(id => !this.savedEdges.has(id))
                .map(id => this.graph.getMutableEdge(id))
                .filter((edge): edge is Edge => !!edge),
        }
    }

    /** One run's write, and what the consumer said about it. */
    private async write(
        run: PivotRun,
        pending: { nodes: Node[], children: Node[], edges: Edge[] },
    ): Promise<{ nodes: number, edges: number, message?: string, error?: unknown }> {
        const def = this.defs.get(run.pivotId)
        if (!def?.save) return { nodes: 0, edges: 0 }

        const attempt = (this.attempts.get(run.runId) ?? 0) + 1
        this.attempts.set(run.runId, attempt)

        const payload: PivotSavePayload = {
            runId: run.runId,
            pivotId: run.pivotId,
            origin: run.origin,
            nodes: pending.nodes,
            children: pending.children,
            edges: pending.edges,
            vouched: {
                nodes: run.vouchedNodeIds
                    .map(id => this.graph.getMutableNode(id))
                    .filter((node): node is Node => !!node),
                edges: run.vouchedEdgeIds
                    .map(id => this.graph.getMutableEdge(id))
                    .filter((edge): edge is Edge => !!edge),
            },
            attempt,
        }

        const controller = new AbortController()
        this.saving.set(run.runId, controller)
        const context: PivotSaveContext = { graph: this.graph, pivotId: run.pivotId, signal: controller.signal }

        let outcome: PivotSaveOutcome
        try {
            outcome = await def.save(payload, context)
        } catch (error) {
            return { nodes: 0, edges: 0, error }
        } finally {
            if (this.saving.get(run.runId) === controller) this.saving.delete(run.runId)
        }

        return this.record(run, payload, outcome)
    }

    /**
     * Write the outcome into the ledger. Anything the consumer did not name stays
     * unsaved, and an id naming an element this run did not create is ignored — a
     * pivot never writes what it did not produce, so it cannot report it written.
     */
    private record(
        run: PivotRun,
        payload: PivotSavePayload,
        outcome: PivotSaveOutcome,
    ): { nodes: number, edges: number, message?: string } {
        const sent = {
            nodes: new Set([...payload.nodes, ...payload.children].map(node => node.id)),
            edges: new Set(payload.edges.map(edge => edge.id)),
        }
        const whole = outcome === undefined || outcome === true
        if (outcome === false) return { nodes: 0, edges: 0 }

        const detail = whole ? undefined : outcome as Exclude<PivotSaveOutcome, void | boolean>
        const nodeIds = whole ? [...sent.nodes] : (detail?.savedNodeIds ?? []).filter(id => sent.nodes.has(id))
        // Taken at face value even where the endpoints did not save: what the source
        // system says it wrote is not the library's to overrule.
        const edgeIds = whole ? [...sent.edges] : (detail?.savedEdgeIds ?? []).filter(id => sent.edges.has(id))

        for (const id of nodeIds) this.savedNodes.add(id)
        for (const id of edgeIds) this.savedEdges.add(id)

        for (const [local, minted] of Object.entries(detail?.canonicalIds ?? {})) {
            if (!sent.nodes.has(local) && !sent.edges.has(local)) continue
            this.canonical.set(local, String(minted))
            this.aliases.set(String(minted), local)
        }

        run.saved += nodeIds.length + edgeIds.length
        // Only a run written whole can claim the history's `persisted` chip: a run
        // that wrote 9 of 12 has not been persisted, and saying so would license an
        // undo warning that is false for a quarter of it.
        const after = this.pending(run)
        if (!after.nodes.length && !after.children.length && !after.edges.length) {
            this.graph.history.markPersisted(run.runId)
        }
        return { nodes: nodeIds.length, edges: edgeIds.length, message: detail?.message }
    }

    /**
     * The result, and the retry when there is one to offer. The toast is the manager's
     * rather than a surface's so that a save driven from the console reports itself the
     * same way the panel's button does.
     */
    private reportSave(
        report: PivotSaveReport,
        message: string | undefined,
        target?: string,
        toast?: NotificationHandle,
        sofar: { nodes: number, edges: number } = { nodes: 0, edges: 0 },
    ): void {
        // Everything this toast has stood for, not just the latest attempt: an analyst
        // who retried twice wants to read what is written, not to add up three toasts.
        const total = { nodes: sofar.nodes + report.savedNodes, edges: sofar.edges + report.savedEdges }
        const saved = total.nodes + total.edges
        const pending = report.pendingNodes + report.pendingEdges
        const detail = message ?? errorText(report.errors[0]?.error)

        /** The retry takes over the toast it was clicked on, so one toast tracks one save. */
        const retry: NotificationAction = {
            label: 'Retry',
            onClick: handle => {
                handle.update({ title: 'Saving…', message: undefined, action: null })
                void this.runSave(target, handle, total)
            },
        }

        const result: Pick<Notification, 'level' | 'title' | 'message' | 'action'> = !pending
            ? {
                level: NotificationLevel.Success,
                title: `Saved ${countText(total.nodes, total.edges)}`,
                message: undefined,
                action: undefined,
            }
            : !saved
                ? {
                    level: NotificationLevel.Danger,
                    title: `Couldn't save ${countText(report.pendingNodes, report.pendingEdges)}`,
                    message: detail ?? 'Nothing was written, and nothing left the canvas.',
                    action: retry,
                }
                : {
                    level: NotificationLevel.Warning,
                    title: `Saved ${saved.toLocaleString()} of ${(saved + pending).toLocaleString()}`,
                    message: detail ?? `${pending.toLocaleString()} still unsaved.`,
                    action: retry,
                }

        if (toast && !toast.dismissed) {
            // `null` rather than `undefined`: a spent Retry has to be taken off the
            // toast, and omitting it would leave the one that is already there.
            toast.update({ ...result, action: result.action ?? null })
            return
        }
        this.graph.notifier?.notify(result.level, result.title, result.message, { action: result.action })
    }

    /**
     * Repaint the nodes an unsaved marker would be on. Only when the option asked for
     * one: without it the ledger is bookkeeping, and bookkeeping does not redraw.
     */
    private repaintUnsaved(): void {
        if (!this.markUnsaved) return
        for (const id of this.nodeRun.keys()) this.graph.getMutableNode(id)?.markDirty()
        this.graph.renderer?.update(false)
    }

    /**
     * Translate the ids a source system minted back to the ones the canvas holds.
     * Without it the feature arms a bug of its own making: a run saves twelve objects,
     * the backend assigns them UUIDs, tomorrow's re-run returns them under those UUIDs, and
     * dedup — which only knows the ids the provider used the first time — offers
     * twelve duplicates of nodes the analyst already has.
     *
     * Only the ids are rewritten, and only where there is an alias, so a provider that
     * never mints anything pays a `Map` miss per row.
     */
    private deAlias(result: { nodes: RawNode[], edges: RawEdge[] }): { nodes: RawNode[], edges: RawEdge[] } {
        if (!this.aliases.size) return result
        const local = (id: unknown): string => this.aliases.get(String(id)) ?? String(id)

        const node = (raw: RawNode): RawNode => {
            const id = local(raw.id)
            const children = raw.children?.map(node)
            const same = id === String(raw.id)
                && (!children || children.every((child, at) => child === raw.children?.[at]))
            return same ? raw : { ...raw, id, ...(children ? { children } : {}) }
        }
        return {
            nodes: result.nodes.map(node),
            edges: result.edges.map(raw => {
                const from = local(raw.from)
                const to = local(raw.to)
                if (from === String(raw.from) && to === String(raw.to)) return raw
                // An edge with no id of its own is keyed on its endpoints, so rewriting
                // them is also what keeps its key matching the one already on canvas.
                return { ...raw, from, to }
            }),
        }
    }

    // --- re-staging --------------------------------------------------------------------

    /**
     * @private
     * Put an undone ingest's candidates back where they came from: the rows return to
     * the staged set, the pane reopens if the ingest had closed it, and no provider is
     * called — which matters most when the alternative is refetching two thousand
     * correlations through a rate-limited API.
     *
     * Called by {@link GraphHistory} for an ingest that is still the newest entry, and
     * only then. An immediate "wrong twelve" costs nothing; a pane resurrecting itself
     * over later work would be worse than the refetch.
     */
    public restage(run: PivotRun): void {
        const stash = run.restage
        if (!stash) return

        let set = this.candidateSets.get(run.pivotId)
        if (!set) {
            set = {
                pivotId: run.pivotId,
                label: stash.label,
                origin: stash.origin,
                narrowing: stash.narrowing,
                // A fresh id: the undone run is on the redo stack, and a re-ingest is a
                // new act that must not be recorded under an id already spoken for.
                runId: this.nextRunId(run.pivotId),
                fetched: stash.fetched,
                deduped: 0,
                suppressed: 0,
                nodes: [],
                edges: [],
                loading: false,
            }
            this.candidateSets.set(run.pivotId, set)
        }

        const rejected = this.rejected.get(run.pivotId)
        const known = new Set(set.nodes.map(c => c.id))
        // Ascending, so re-inserting at the recorded indices rebuilds the provider's
        // own order — the rows go back where they were, not onto the end.
        for (const { at, row } of stash.nodes) {
            if (known.has(row.id)) continue
            // A rejection made since holds: it is not re-offered, and it is counted so
            // the pane can still say why the number is what it is.
            if (rejected?.has(row.id)) {
                set.suppressed++
                continue
            }
            // Back untriaged rather than still marked — the point of taking the run back
            // is to go through it properly, not to re-land the same twelve on one click.
            row.state = 'candidate'
            row.deduped = Boolean(this.graph.getMutableNode(row.id))
            set.nodes.splice(Math.min(at, set.nodes.length), 0, row)
        }

        const knownEdges = new Set(set.edges.map(e => e.id))
        for (const { at, row } of stash.edges) {
            if (knownEdges.has(row.id)) continue
            row.state = 'candidate'
            set.edges.splice(Math.min(at, set.edges.length), 0, row)
        }
        if (stash.carried.length) set.carried = [...(set.carried ?? []), ...stash.carried]
        set.deduped = set.nodes.filter(c => c.deduped).length

        this.notify('candidates')
    }

    // --- change bus --------------------------------------------------------------------

    /**
     * Subscribe to pivot state changes — the registry, a summary, the staged
     * candidates, the run stack. Returns a disposer.
     */
    public on(listener: (change: PivotChange) => void): () => void {
        this.listeners.add(listener)
        return () => this.listeners.delete(listener)
    }

    /** @private */
    public notify(change: PivotChange): void {
        // A pivot arriving or leaving changes how many apply to every node on canvas.
        if (change === 'registry') this.counts.clear()
        for (const listener of [...this.listeners]) listener(change)
    }

    /** @private Tear down: abort everything in flight and forget every listener. */
    public destroy(): void {
        this.cancel()
        // The one place a save is aborted. Nothing is left that could report its
        // outcome, so letting it run on would write into a graph that no longer exists.
        for (const controller of this.saving.values()) controller.abort()
        this.saving.clear()
        this.listeners.clear()
    }

    // --- internals ---------------------------------------------------------------------

    private context(pivotId: string, controller: AbortController): PivotContext {
        return {
            graph: this.graph,
            pivotId,
            signal: controller.signal,
            isStale: () => controller.signal.aborted,
        }
    }

    /** Start a call, superseding whatever was already running under the same key. */
    private arm(key: string): AbortController {
        this.inFlight.get(key)?.abort()
        const controller = new AbortController()
        this.inFlight.set(key, controller)
        return controller
    }

    private cacheKey(pivotId: string, nodes: Node[], narrowing: PivotNarrowing): string {
        const ids = nodes.map(n => n.id).sort().join(',')
        return `${pivotId}\u0000${ids}\u0000${JSON.stringify(narrowing)}`
    }

    private dropCacheFor(nodeId: string): void {
        for (const [key, ids] of [...this.cacheNodes]) {
            if (!ids.has(nodeId)) continue
            this.cache.delete(key)
            this.cacheNodes.delete(key)
        }
    }

    private nextRunId(pivotId: string): string {
        return `${pivotId}#${++this.runSeq}`
    }

    private refuse(runId: string, refusal: PivotRefusal): PivotRunOutcome {
        return { status: 'refused', runId, nodes: [], edges: [], deduped: 0, suppressed: 0, refusal }
    }

    private findCandidate(pivotId: string, id: string): PivotCandidate | PivotCandidateEdge | undefined {
        const set = this.candidateSets.get(pivotId)
        if (!set) return undefined
        return set.nodes.find(c => c.id === id) ?? set.edges.find(e => e.id === id)
    }

    /** The id `graph.addEdge` would give this raw edge, so both paths agree. */
    private edgeKey(raw: RawEdge): string {
        return raw.id !== undefined ? String(raw.id) : `${raw.from}-${raw.to}`
    }

    /**
     * Vouch for something that was already on canvas. Its seed claim is written down
     * first: without it, undoing this run would empty the ledger and delete data the
     * pivot never brought.
     */
    private vouchExisting(element: Node | Edge, pivotId: string, runId: string): void {
        const sources = element.getSources()
        if (sources.length === 1 && sources[0] === SEED_SOURCE) element.vouch(SEED_SOURCE, SEED_SOURCE)
        element.vouch(pivotId, runId)
    }

    /**
     * Where unpositioned candidates are seeded. The origin's centre when there is
     * one — so ingested nodes read as coming *from* the node the analyst pivoted on —
     * and the viewport centre for an origin-less pivot, which is the only honest
     * anchor it has.
     */
    private seedPoint(origin: Node[]): { x: number, y: number } {
        const positioned = origin.filter(n => typeof n.x === 'number' && typeof n.y === 'number')
        if (positioned.length) {
            return {
                x: positioned.reduce((sum, n) => sum + (n.x ?? 0), 0) / positioned.length,
                y: positioned.reduce((sum, n) => sum + (n.y ?? 0), 0) / positioned.length,
            }
        }
        const canvas = this.graph.UIManager?.layout?.canvas
        if (canvas && this.graph.renderer) {
            const rect = canvas.getBoundingClientRect()
            const centre = this.graph.renderer.screenToGraphCoordinates(
                rect.left + rect.width / 2,
                rect.top + rect.height / 2,
            )
            return { x: centre.x, y: centre.y }
        }
        return { x: 0, y: 0 }
    }
}

/** `true` / `false` are shorthands for the object form, exactly as a delete decision is. */
function normaliseDecision(decision: IngestDecision): { accept: boolean, nodes?: RawNode[], edges?: RawEdge[] } {
    if (typeof decision === 'boolean') return { accept: decision }
    return decision ?? { accept: true }
}

/** How much a run has left to write. Children are nodes, and are counted as such. */
function countOf(pending: { nodes: unknown[], children: unknown[], edges: unknown[] }): number {
    return pending.nodes.length + pending.children.length + pending.edges.length
}

/** `12 nodes`, `12 nodes and 3 edges`, `3 edges` — whichever halves are non-zero. */
function countText(nodes: number, edges: number): string {
    const parts: string[] = []
    if (nodes) parts.push(`${nodes.toLocaleString()} ${nodes === 1 ? 'node' : 'nodes'}`)
    if (edges) parts.push(`${edges.toLocaleString()} ${edges === 1 ? 'edge' : 'edges'}`)
    return parts.join(' and ') || 'nothing'
}

function errorText(error: unknown): string | undefined {
    if (error === undefined) return undefined
    return String((error as Error)?.message ?? error)
}
