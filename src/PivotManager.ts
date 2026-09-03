import type { Edge } from './Edge'
import type { Graph } from './Graph'
import type { RawEdge, RawNode } from './interfaces/GraphOptions'
import type { IngestContext, IngestDecision } from './interfaces/InterractionCallbacks'
import type {
    PivotCandidate, PivotCandidateEdge, PivotCandidateSet, PivotContext, PivotDefinition,
    PivotManagerLike, PivotNarrowing, PivotRefusal, PivotRun, PivotRunOutcome, PivotSummary,
} from './interfaces/Pivot'
import { SEED_SOURCE } from './interfaces/Pivot'
import type { Node } from './Node'
import { confirmModal } from './editing/PromptModal'

/** What changed, so a surface can re-render only what it shows. */
export type PivotChange = 'registry' | 'summarize' | 'candidates' | 'runs'

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

    private readonly graph: Graph
    private readonly defs = new Map<string, PivotDefinition>()

    /** Cached summaries, keyed by (pivot id, sorted origin ids, narrowing). */
    private readonly cache = new Map<string, PivotSummary>()
    /** Which nodes each cache entry was asked about, so a removal can drop it. */
    private readonly cacheNodes = new Map<string, Set<string>>()
    /** In-flight provider calls, keyed `summarize:<id>` / `fetch:<id>`. */
    private readonly inFlight = new Map<string, AbortController>()

    /** Explicitly rejected candidates, keyed by pivot id then candidate id. */
    private readonly rejected = new Map<string, Set<string>>()
    /** At most one candidate set per pivot: a re-run replaces it. */
    private readonly candidateSets = new Map<string, PivotCandidateSet>()

    private readonly listeners = new Set<(change: PivotChange) => void>()
    /** How many times each pivot has landed a run, so two runs of one are told apart. */
    private readonly ordinals = new Map<string, number>()

    private runSeq = 0

    constructor(graph: Graph) {
        this.graph = graph
        // A cached summary about a node that no longer exists is a lie waiting to be
        // told; every other invalidation is the consumer's call.
        graph.on('nodeRemove', (node: Node) => this.dropCacheFor(node.id))
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
     */
    public for(nodes: Node[]): PivotDefinition[] {
        if (!nodes.length) return this.all().filter(d => d.origin === 'none')
        return this.all().filter(d => d.origin !== 'none' && (!d.appliesTo || d.appliesTo(nodes)))
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

        const origin = def.origin === 'none' ? [] : nodes
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

        const origin = def.origin === 'none' ? [] : nodes
        const runId = this.nextRunId(id)

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
        // replacing it: D27 makes a re-run one pane, not a stack, but discarding the
        // analyst's marks unasked is not the library's call. With nothing marked there
        // is nothing to lose, and it replaces outright.
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
    private stage(set: PivotCandidateSet, result: { nodes: RawNode[], edges: RawEdge[] }): void {
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
        const remembered = this.rejected.get(pivotId) ?? new Set<string>()
        for (const id of ids) {
            const candidate = this.findCandidate(pivotId, id)
            if (!candidate) continue
            candidate.state = 'rejected'
            remembered.add(id)
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

    /** How many candidates have been rejected for this pivot this session. */
    public rejectedCount(pivotId: string): number {
        return this.rejected.get(pivotId)?.size ?? 0
    }

    /** The rejected candidate ids for this pivot — what the pane reveals on demand. */
    public rejectedIds(pivotId: string): string[] {
        return [...(this.rejected.get(pivotId) ?? [])]
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
            nodeIds: [],
            childIds: [],
            edgeIds: [],
            vouchedNodeIds: [],
            vouchedEdgeIds: [],
            unions: [],
            nodes: [],
            edges: [],
            at: Date.now(),
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
        // leaves is written down, so undoing this ingest can put it back (H21).
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
            this.graph.history.recordPivotRun(run, this.get(pivotId)?.label ?? pivotId, ordinal)
            this.notify('runs')
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
        for (const listener of [...this.listeners]) listener(change)
    }

    /** @private Tear down: abort everything in flight and forget every listener. */
    public destroy(): void {
        this.cancel()
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
