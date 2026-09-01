// The pivot runtime the library does not have yet. Everything here is what M1 of the PRD
// describes: registry, summarize cache, the narrowing gate, staging, ingest, provenance and
// run-scoped undo. Kept deliberately close to the PRD's vocabulary so the shape transfers.

import type { Graph } from '../../src/Graph'
import type { Node } from '../../src/Node'
import type { RawEdge, RawNode } from '../../src/interfaces/GraphOptions'
import type {
    CandidateSet, PivotDefinition, PivotNarrowing, PivotRun, PivotSummary,
} from './types'

/** D17: refuse an oversized payload rather than truncating it. */
const CEILING = 10_000

export type SummarizeState =
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'stale', summary: PivotSummary }
    | { status: 'ready', summary: PivotSummary }
    | { status: 'failed', message: string }

export class PivotManager {
    private readonly defs = new Map<string, PivotDefinition>()
    private readonly listeners = new Set<() => void>()

    /** Keyed by (pivot id, sorted origin ids, narrowing) — D20. */
    private readonly cache = new Map<string, PivotSummary>()
    private readonly summarizeState = new Map<string, SummarizeState>()
    private readonly inFlight = new Map<string, AbortController>()

    /** Explicit rejections, keyed (pivotId, candidate id) and session-scoped — D14. */
    private readonly rejected = new Map<string, Set<string>>()

    /** Provenance: which sources vouch for each element — D8. Lives here because Node has none yet. */
    private readonly sources = new Map<string, Set<string>>()

    readonly sets = new Map<string, CandidateSet>()
    readonly undoStack: PivotRun[] = []
    readonly redoStack: PivotRun[] = []

    private runSeq = 0

    // Written out rather than a parameter property: the repo compiles with `erasableSyntaxOnly`.
    private readonly graph: Graph

    constructor(graph: Graph) {
        this.graph = graph
    }

    // --- registry ----------------------------------------------------------------------

    register(def: PivotDefinition): () => void {
        this.defs.set(def.id, def)
        this.changed()
        return () => {
            this.defs.delete(def.id)
            this.changed()
        }
    }

    get size(): number {
        return this.defs.size
    }

    /** What applies to this origin. An empty origin yields the `origin: 'none'` pivots only. */
    applicable(origin: Node[]): PivotDefinition[] {
        const all = [...this.defs.values()]
        if (origin.length === 0) return all.filter((d) => d.origin === 'none')
        return all.filter((d) => d.origin !== 'none' && (!d.appliesTo || d.appliesTo(origin)))
    }

    originLess(): PivotDefinition[] {
        return [...this.defs.values()].filter((d) => d.origin === 'none')
    }

    get(id: string): PivotDefinition | undefined {
        return this.defs.get(id)
    }

    // --- summarize ---------------------------------------------------------------------

    private key(pivotId: string, origin: Node[], narrowing: PivotNarrowing): string {
        const ids = origin.map((n) => String(n.id)).sort().join(',')
        return `${pivotId}|${ids}|${JSON.stringify(narrowing)}`
    }

    stateOf(pivotId: string): SummarizeState {
        return this.summarizeState.get(pivotId) ?? { status: 'idle' }
    }

    /**
     * Run `summarize` for one pivot. Supersedes any call already in flight for the same
     * pivot, and serves a cache hit without touching the provider — which is what makes
     * a re-opened panel show its number instantly (S2 is skipped).
     */
    async summarize(def: PivotDefinition, origin: Node[], narrowing: PivotNarrowing): Promise<void> {
        if (!def.summarize) return

        const key = this.key(def.id, origin, narrowing)
        const cached = this.cache.get(key)
        if (cached) {
            this.summarizeState.set(def.id, { status: 'ready', summary: cached })
            this.changed()
            return
        }

        // A stale count is dimmed, never blanked (S5).
        const previous = this.stateOf(def.id)
        const carried = previous.status === 'ready' || previous.status === 'stale' ? previous.summary : undefined
        this.summarizeState.set(def.id, carried ? { status: 'stale', summary: carried } : { status: 'loading' })
        this.changed()

        this.inFlight.get(def.id)?.abort()
        const controller = new AbortController()
        this.inFlight.set(def.id, controller)

        try {
            const summary = await def.summarize(origin, narrowing, { signal: controller.signal, pivotId: def.id })
            if (controller.signal.aborted) return
            this.cache.set(key, summary)
            this.summarizeState.set(def.id, { status: 'ready', summary })
        } catch (error) {
            if (controller.signal.aborted) return
            this.summarizeState.set(def.id, { status: 'failed', message: (error as Error).message })
        } finally {
            if (this.inFlight.get(def.id) === controller) this.inFlight.delete(def.id)
            this.changed()
        }
    }

    /** Drop every cached summary, or just one pivot's — D20. */
    invalidate(pivotId?: string): void {
        for (const key of [...this.cache.keys()]) {
            if (!pivotId || key.startsWith(`${pivotId}|`)) this.cache.delete(key)
        }
        if (pivotId) this.summarizeState.delete(pivotId)
        else this.summarizeState.clear()
        this.changed()
    }

    /** Leaving Pivot mode: nothing in flight survives, and no answer is rendered late. */
    cancelAll(): void {
        for (const controller of this.inFlight.values()) controller.abort()
        this.inFlight.clear()
        this.summarizeState.clear()
        this.changed()
    }

    // --- fetch and staging -------------------------------------------------------------

    /**
     * Run a pivot. The dock tab is created when `fetch` starts, not when results land (C3),
     * so closing the panel does not cancel the run and a failure has somewhere to live.
     */
    async run(def: PivotDefinition, origin: Node[], narrowing: PivotNarrowing): Promise<void> {
        const existing = this.sets.get(def.id)
        const set: CandidateSet = {
            pivotId: def.id,
            label: def.label,
            origin,
            fetched: 0,
            deduped: 0,
            suppressed: 0,
            nodes: [],
            edges: [],
            carried: new Map(),
            loading: true,
        }
        // A re-run while rows are marked announces itself rather than swapping silently (C7).
        if (existing && !existing.loading && existing.nodes.some((c) => c.state === 'marked')) {
            existing.pending = set
        } else {
            this.sets.set(def.id, set)
        }
        this.changed()

        this.inFlight.get(`fetch:${def.id}`)?.abort()
        const controller = new AbortController()
        this.inFlight.set(`fetch:${def.id}`, controller)

        try {
            const result = await def.fetch(origin, narrowing, { signal: controller.signal, pivotId: def.id })
            if (controller.signal.aborted) return
            this.stage(set, result, def)
            if (def.autoIngest && !set.refused && !set.error) {
                for (const candidate of set.nodes) if (!candidate.deduped) candidate.state = 'marked'
                for (const edge of set.edges) edge.state = 'marked'
                this.ingest(set)
                this.sets.delete(def.id)
            }
        } catch (error) {
            if (controller.signal.aborted) {
                this.sets.delete(def.id)
                this.changed()
                return
            }
            set.error = (error as Error).message
            set.loading = false
        } finally {
            this.inFlight.delete(`fetch:${def.id}`)
            this.changed()
        }
    }

    private stage(set: CandidateSet, result: { nodes: RawNode[], edges: RawEdge[] }, def: PivotDefinition): void {
        set.loading = false
        set.fetched = result.nodes.length

        if (result.nodes.length > CEILING) {
            set.refused = { returned: result.nodes.length, ceiling: CEILING }
            set.nodes = []
            set.edges = []
            return
        }

        const rejected = this.rejected.get(def.id) ?? new Set()
        for (const raw of result.nodes) {
            const id = String(raw.id)
            if (rejected.has(id)) { set.suppressed++; continue }
            const onCanvas = !!this.graph.getMutableNode(id)
            if (onCanvas) set.deduped++
            set.nodes.push({ id, raw, deduped: onCanvas, state: 'candidate' })
        }

        // Edges ride along with their endpoints, EXCEPT those whose endpoints are all already
        // on canvas — those get their own rows or they would land silently (D24).
        const staged = new Set(set.nodes.map((c) => c.id))
        for (const raw of result.edges) {
            const from = String(raw.from)
            const to = String(raw.to)
            const bothOnCanvas = !!this.graph.getMutableNode(from) && !!this.graph.getMutableNode(to)
            if (bothOnCanvas && !staged.has(from) && !staged.has(to)) {
                set.edges.push({ id: `${from}->${to}`, raw, state: 'candidate' })
                continue
            }
            for (const endpoint of [from, to]) {
                if (!staged.has(endpoint)) continue
                const list = set.carried.get(endpoint) ?? []
                list.push(raw)
                set.carried.set(endpoint, list)
            }
        }
    }

    cancelFetch(pivotId: string): void {
        this.inFlight.get(`fetch:${pivotId}`)?.abort()
    }

    // --- triage ------------------------------------------------------------------------

    /**
     * Ticking a row must NOT rebuild the pane: with 200 rows that loses scroll position and
     * the analyst's place mid-triage. The caller updates the row and the footer in place.
     */
    mark(set: CandidateSet, id: string, marked: boolean): void {
        const candidate = set.nodes.find((c) => c.id === id) ?? set.edges.find((e) => e.id === id)
        if (!candidate || candidate.state === 'rejected') return
        candidate.state = marked ? 'marked' : 'candidate'
    }

    reject(set: CandidateSet, ids: string[]): void {
        const remembered = this.rejected.get(set.pivotId) ?? new Set<string>()
        for (const id of ids) {
            const candidate = set.nodes.find((c) => c.id === id)
            if (!candidate) continue
            candidate.state = 'rejected'
            remembered.add(id)
        }
        this.rejected.set(set.pivotId, remembered)
        this.changed()
    }

    unreject(set: CandidateSet, id: string): void {
        const candidate = set.nodes.find((c) => c.id === id)
        if (!candidate) return
        candidate.state = 'candidate'
        this.rejected.get(set.pivotId)?.delete(id)
        this.changed()
    }

    rejectRemaining(set: CandidateSet): void {
        this.reject(set, set.nodes.filter((c) => c.state === 'candidate').map((c) => c.id))
    }

    rejectedCount(pivotId: string): number {
        return this.rejected.get(pivotId)?.size ?? 0
    }

    // --- ingest ------------------------------------------------------------------------

    /** Commit the marked candidates. Purely additive; removal only ever happens via undo. */
    ingest(set: CandidateSet): PivotRun | undefined {
        const marked = set.nodes.filter((c) => c.state === 'marked' && !c.deduped)
        const markedEdges = set.edges.filter((e) => e.state === 'marked')
        if (marked.length === 0 && markedEdges.length === 0) return undefined

        const runId = `run-${++this.runSeq}`
        const seed = this.seedPoint(set.origin)

        const addedNodes: RawNode[] = []
        const nodeIds: Array<string | number> = []
        for (const candidate of marked) {
            // D22: seed unpositioned nodes around the origin, jittered so the sim fans them out.
            const raw: RawNode = {
                ...candidate.raw,
                x: candidate.raw.x ?? seed.x + (Math.random() - 0.5) * 160,
                y: candidate.raw.y ?? seed.y + (Math.random() - 0.5) * 160,
            }
            try {
                this.graph.addNode(raw)
                addedNodes.push(raw)
                nodeIds.push(raw.id)
                this.tag(String(raw.id), set.pivotId)
            } catch {
                // Already there — dedup should have caught it, but never let one row kill a run.
            }
        }

        const addedEdges: RawEdge[] = []
        const edgeIds: Array<string | number> = []
        const landed = new Set(nodeIds.map(String))
        const rides = (raw: RawEdge) =>
            (landed.has(String(raw.from)) || !!this.graph.getMutableNode(String(raw.from)))
            && (landed.has(String(raw.to)) || !!this.graph.getMutableNode(String(raw.to)))

        for (const raw of [...markedEdges.map((e) => e.raw), ...this.ridingEdges(set, landed)]) {
            if (!rides(raw)) continue
            try {
                const edge = this.graph.addEdge(raw)
                addedEdges.push(raw)
                edgeIds.push(edge.id)
                this.tag(String(edge.id), set.pivotId)
            } catch {
                // A duplicate edge is not an error worth surfacing here.
            }
        }

        for (const candidate of marked) candidate.state = 'candidate'
        set.nodes = set.nodes.filter((c) => !nodeIds.map(String).includes(c.id))
        set.edges = set.edges.filter((e) => e.state !== 'marked')

        const run: PivotRun = { runId, pivotId: set.pivotId, nodeIds, edgeIds, nodes: addedNodes, edges: addedEdges, origin: set.origin }
        this.undoStack.push(run)
        this.redoStack.length = 0
        this.changed()
        return run
    }

    /** Edges that follow their endpoints rather than being triage rows of their own (D24). */
    private ridingEdges(set: CandidateSet, landed: Set<string>): RawEdge[] {
        const seen = new Set<string>()
        const out: RawEdge[] = []
        for (const id of landed) {
            for (const raw of set.carried.get(id) ?? []) {
                const key = `${raw.from}->${raw.to}`
                if (seen.has(key)) continue
                seen.add(key)
                out.push(raw)
            }
        }
        return out
    }

    private seedPoint(origin: Node[]): { x: number, y: number } {
        const positioned = origin.filter((n) => typeof n.x === 'number' && typeof n.y === 'number')
        if (positioned.length) {
            return {
                x: positioned.reduce((sum, n) => sum + (n.x ?? 0), 0) / positioned.length,
                y: positioned.reduce((sum, n) => sum + (n.y ?? 0), 0) / positioned.length,
            }
        }
        // Origin-less: the viewport centre is the only honest anchor (D22).
        const canvas = this.graph.UIManager?.layout?.canvas
        const renderer = this.graph.renderer
        if (canvas && renderer) {
            const rect = canvas.getBoundingClientRect()
            const centre = renderer.screenToGraphCoordinates(rect.left + rect.width / 2, rect.top + rect.height / 2)
            return { x: centre.x, y: centre.y }
        }
        return { x: 0, y: 0 }
    }

    // --- provenance and undo -----------------------------------------------------------

    private tag(elementId: string, source: string): void {
        const set = this.sources.get(elementId) ?? new Set<string>()
        set.add(source)
        this.sources.set(elementId, set)
    }

    getSources(elementId: string): string[] {
        return [...(this.sources.get(elementId) ?? [])]
    }

    /** Undo a whole run: drop its vouching, delete whatever empties (D25). */
    undo(runId?: string): PivotRun | undefined {
        const index = runId ? this.undoStack.findIndex((r) => r.runId === runId) : this.undoStack.length - 1
        if (index < 0) return undefined
        const [run] = this.undoStack.splice(index, 1)

        for (const id of run.edgeIds) {
            const key = String(id)
            const sources = this.sources.get(key)
            sources?.delete(run.pivotId)
            if (!sources || sources.size === 0) { this.graph.removeEdge(key); this.sources.delete(key) }
        }
        for (const id of run.nodeIds) {
            const key = String(id)
            const sources = this.sources.get(key)
            sources?.delete(run.pivotId)
            if (!sources || sources.size === 0) { this.graph.removeNode(key); this.sources.delete(key) }
        }

        this.redoStack.push(run)
        this.changed()
        return run
    }

    /** Re-land the recorded delta exactly: no refetch, no re-gating (D25). */
    redo(): PivotRun | undefined {
        const run = this.redoStack.pop()
        if (!run) return undefined
        for (const raw of run.nodes) {
            try { this.graph.addNode(raw); this.tag(String(raw.id), run.pivotId) } catch { /* already back */ }
        }
        for (const raw of run.edges) {
            try { const edge = this.graph.addEdge(raw); this.tag(String(edge.id), run.pivotId) } catch { /* already back */ }
        }
        this.undoStack.push(run)
        this.changed()
        return run
    }

    // --- change bus --------------------------------------------------------------------

    on(fn: () => void): () => void {
        this.listeners.add(fn)
        return () => this.listeners.delete(fn)
    }

    changed(): void {
        for (const fn of this.listeners) fn()
    }
}
