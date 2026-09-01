import type { Edge } from '../Edge'
import type { Graph } from '../Graph'
import type { Node } from '../Node'
import type { RenderContext } from './AsyncContent'
import type { RawEdge, RawNode } from './GraphOptions'
import type { FilterFacetType } from './GraphQueryEngine'

/**
 * One runnable enrichment: what it is called, what it runs on, how to advertise
 * what is out there and how to fetch it.
 *
 * A pivot is two functions and some metadata. {@link PivotDefinition.summarize}
 * is the cheap "what's out there" call whose facets become the narrowing
 * controls; {@link PivotDefinition.fetch} is the real one. Results are
 * *candidates* — staged for triage, never on the canvas — unless the pivot
 * declares {@link PivotDefinition.autoIngest}.
 *
 * @category Pivots
 */
export interface PivotDefinition {
    /** Stable identity: what the registry keys on, and the provenance tag written on ingest. */
    id: string
    /** Label, used verbatim (so it can be translated). */
    label: string
    /** SVG string, injected with innerHTML and not sanitised — it must be trusted. */
    icon?: string
    /**
     * What this pivot runs on. `'selection'` pivots need an origin — the nodes the
     * analyst pointed at; `'none'` pivots need no nodes at all (search, import, a
     * staging tray) and receive `[]`.
     * @default 'selection'
     */
    origin?: 'selection' | 'none'
    /**
     * Whether this pivot applies to a given origin. Re-read on every origin change,
     * so it must be synchronous and cheap. Omit it and the pivot applies to
     * everything. Not consulted when `origin` is `'none'`.
     */
    appliesTo?: (nodes: Node[]) => boolean
    /**
     * Cheap "what's out there". Called with `{}` before any narrowing exists, and
     * re-run as the origin or the narrowing changes; its facets become the narrowing
     * controls and its `total` is the number the cap is judged against.
     *
     * Omit it and the pivot offers no advertised count and no narrowing — legal, but
     * then {@link PivotDefinition.fetch} must be safe to call blind, since nothing
     * can gate it.
     */
    summarize?: (nodes: Node[], narrowing: PivotNarrowing, ctx: PivotContext) => PivotSummary | Promise<PivotSummary>
    /** The real fetch, narrowed by what the analyst chose. */
    fetch: (nodes: Node[], narrowing: PivotNarrowing, ctx: PivotContext) => PivotResult | Promise<PivotResult>
    /**
     * Land results directly instead of staging them for triage. For small, trusted
     * results — expanding an event into its objects — not for anything an analyst
     * would want to pick through. The cap still applies.
     * @default false
     */
    autoIngest?: boolean
    /**
     * Refuse to fetch while the advertised count exceeds this. There is no library
     * default: a pivot that declares no cap is never gated by one (the absolute
     * ceiling of {@link PivotManagerLike.candidateCeiling} still applies to what
     * `fetch` returns).
     */
    maxCandidates?: number
}

/**
 * What {@link PivotDefinition.summarize} advertises.
 *
 * Every count here is **advisory**. It legitimately differs from what ingest
 * lands — dedup is the common case — and a shrink is never an error.
 *
 * @category Pivots
 */
export interface PivotSummary {
    /** Advisory total. Render it as approximate. */
    total: number
    /** Optional breakdown; each entry becomes one narrowing control. */
    facets?: PivotFacet[]
}

/**
 * The facet types narrowing may use: everything the query engine knows except
 * `regex`, which a backend cannot be asked to evaluate. The triage pane's own
 * client-side filters keep the full vocabulary.
 *
 * @category Pivots
 */
export type NarrowingFacetType = Exclude<FilterFacetType, 'regex'>

/**
 * One narrowing control, declared by the provider and rendered by the library —
 * the same facet vocabulary the filter panel speaks.
 *
 * @category Pivots
 */
export interface PivotFacet {
    key: string
    label: string
    type: NarrowingFacetType
    /** For `select` / `multiselect`. A `count` is shown beside the option when given. */
    options?: Array<{ label: string, value: string, count?: number }>
}

/**
 * The analyst's narrowing choices, keyed by facet key. Passed to both provider
 * calls verbatim; the library never interprets a value.
 *
 * @category Pivots
 */
export type PivotNarrowing = Record<string, unknown>

/**
 * A flat graph fragment. No returned node names an existing on-canvas parent —
 * nesting travels in `RawNode.children`. An edges-only result is legal: edges
 * whose endpoints are all already on canvas become triage rows of their own.
 *
 * @category Pivots
 */
export interface PivotResult {
    nodes: RawNode[]
    edges: RawEdge[]
}

/**
 * Handed to both provider calls as the last argument. Extends
 * {@link RenderContext}, so cancellation works the way it does everywhere else:
 * forward `signal` to `fetch`, or poll `isStale()` between steps.
 *
 * @category Pivots
 */
export interface PivotContext extends RenderContext {
    graph: Graph
    /** Which pivot is running. */
    pivotId: string
}

/**
 * Why a run was refused. A refusal always carries the number, the limit and
 * therefore the way forward — nothing is ever silently truncated or sampled.
 *
 * @category Pivots
 */
export interface PivotRefusal {
    /** `'cap'` — the advertised count exceeded the pivot's `maxCandidates`, so nothing was fetched. `'ceiling'` — `fetch` returned more than the absolute ceiling, so nothing was staged. */
    kind: 'cap' | 'ceiling'
    /** The count that was refused. */
    count: number
    /** The limit it exceeded. */
    limit: number
}

/**
 * What {@link PivotManagerLike.run} resolves with — at the hand-off, never
 * waiting on the analyst.
 *
 * @category Pivots
 */
export interface PivotRunOutcome {
    /**
     * `'ingested'` an auto-ingest pivot landed its results; `'staged'` candidates
     * are waiting in triage; `'refused'` the cap or the ceiling turned it away;
     * `'vetoed'` `onBeforeIngest` refused it; `'failed'` the provider threw;
     * `'cancelled'` the run was superseded or abandoned before it landed.
     */
    status: 'ingested' | 'staged' | 'refused' | 'vetoed' | 'failed' | 'cancelled'
    /**
     * This run's identity in the provenance records — the handle for
     * {@link PivotManagerLike.undo}. A staged run's later ingest announces itself
     * under this same id; a *second*, partial ingest out of one staged set gets a
     * fresh id of its own, so each batch is separately undoable.
     */
    runId: string
    /** What landed. Empty unless `'ingested'`. */
    nodes: Node[]
    edges: Edge[]
    /** Candidates dropped because they were already on canvas. */
    deduped: number
    /** Candidates suppressed because they were explicitly rejected earlier this session. */
    suppressed: number
    /** Set when `status` is `'refused'`. */
    refusal?: PivotRefusal
    /** Set when `status` is `'failed'`. */
    error?: unknown
}

/**
 * A fetched node awaiting triage. Not in the graph, not in the data table, not in
 * any facet count — until it is ingested.
 *
 * @category Pivots
 */
export interface PivotCandidate {
    /** The candidate's id, stringified — what dedup and rejection memory key on. */
    id: string
    raw: RawNode
    /** Already on canvas, so it cannot be ingested; the run still records its vouching. */
    deduped: boolean
    state: 'candidate' | 'marked' | 'rejected'
}

/**
 * A candidate edge that is a triage row in its own right — both its endpoints are
 * already on canvas, so nothing else would stage it.
 *
 * @category Pivots
 */
export interface PivotCandidateEdge {
    id: string
    raw: RawEdge
    state: 'candidate' | 'marked' | 'rejected'
}

/**
 * One `fetch`'s worth of candidates, held for triage. There is at most one set
 * per pivot id: a re-run replaces it.
 *
 * @category Pivots
 */
export interface PivotCandidateSet {
    pivotId: string
    label: string
    /** The nodes the pivot was run on. Empty for an origin-less pivot. */
    origin: Node[]
    /** The narrowing this set was fetched with. */
    narrowing: PivotNarrowing
    /** The id this set's first ingest will be recorded under. */
    runId: string
    /** How many nodes the provider returned, before dedup or suppression. */
    fetched: number
    /** How many of them are already on canvas. */
    deduped: number
    /** How many were dropped because they were explicitly rejected earlier this session. */
    suppressed: number
    nodes: PivotCandidate[]
    /** Edge-only results: both endpoints already on canvas, so they are rows of their own. */
    edges: PivotCandidateEdge[]
    /**
     * Edges that are not rows: they follow their endpoints and land iff both ends end
     * up on canvas. Not shown in triage — an edge to a node the analyst did not take
     * is not a decision of its own.
     */
    carried?: RawEdge[]
    /** True while `fetch` is in flight. */
    loading: boolean
    /** Set when `fetch` rejected — the pane offers a retry. */
    error?: unknown
    /** Set when the provider blew through the absolute ceiling. Nothing was staged. */
    refused?: PivotRefusal
    /**
     * A re-run of this pivot, waiting rather than replacing: it landed while rows
     * were marked, and throwing the analyst's triage away unasked is not a swap the
     * library gets to make. The surface announces it and offers both ways out —
     * {@link PivotManagerLike.showPending} and
     * {@link PivotManagerLike.dismissPending}.
     *
     * A re-run with nothing marked replaces outright, and never lands here.
     */
    pending?: PivotCandidateSet
}

/**
 * One ingest, undoable as a unit. Holds the raw payload as well as the ids, so
 * redo re-lands the recorded delta without refetching or re-gating.
 *
 * @category Pivots
 */
export interface PivotRun {
    runId: string
    pivotId: string
    /** Top-level nodes this run added. */
    nodeIds: string[]
    /**
     * Nodes this run added *inside* a container: a new container's own subtree, and
     * children merged into a container already on canvas. Undone before the
     * top-level nodes, so nothing is left orphaned in the graph.
     */
    childIds: string[]
    /** Edges this run added. */
    edgeIds: string[]
    /** Elements already on canvas that this run vouched for without adding. */
    vouchedNodeIds: string[]
    vouchedEdgeIds: string[]
    /** Children merged into a node already on canvas, so redo can merge them again. */
    unions: Array<{ parentId: string, children: RawNode[] }>
    nodes: RawNode[]
    edges: RawEdge[]
    at: number
}

/**
 * The shape {@link Graph.pivots} exposes. Declared as an interface so the
 * consumer-facing surface is documented in one place and the implementation can
 * stay internal.
 *
 * @category Pivots
 */
export interface PivotManagerLike {
    /** Absolute ceiling on what one `fetch` may stage. Refuses rather than truncates. */
    candidateCeiling: number
    register(definition: PivotDefinition): () => void
    unregister(id: string): void
    get(id: string): PivotDefinition | undefined
    /** Every registered pivot, in registration order. */
    all(): PivotDefinition[]
    /** What applies to this origin. An empty origin yields the origin-less pivots. */
    for(nodes: Node[]): PivotDefinition[]
    run(id: string, nodes?: Node[], narrowing?: PivotNarrowing): Promise<PivotRunOutcome>
    /** Promote a waiting re-run to the set on show. */
    showPending(pivotId: string): void
    /** Drop a waiting re-run and keep triaging what is on show. */
    dismissPending(pivotId: string): void
    invalidate(pivotId?: string, nodes?: Node[]): void
    /** Abort in-flight calls — one pivot's or all, and optionally only one kind. */
    cancel(pivotId?: string, kind?: 'summarize' | 'fetch'): void
    undo(runId?: string): PivotRun | undefined
    redo(): PivotRun | undefined
}

/** Every element with no pivot vouching for it is vouched for by the seed. */
export const SEED_SOURCE = 'seed'

/**
 * One run's vouching for one element. Kept internally so two runs of the same
 * pivot stay distinguishable — {@link PivotManagerLike.undo} is built on it —
 * while the public surface stays `getSources(): string[]`.
 *
 * @category Pivots
 */
export interface SourceRecord {
    runId: string
    at: number
}
