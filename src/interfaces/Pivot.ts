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
     * Whether this pivot applies to a given origin, and to how much of it. Re-read on
     * every origin change, so it must be synchronous and cheap. Omit it and the pivot
     * applies to everything. Not consulted when `origin` is `'none'`.
     *
     * Return a **boolean** for a rule about the origin as a whole — "only with two or
     * more picked", "never on a note". Return the **nodes it applies to** for a rule
     * that reads one node at a time, which is the normal case for enrichment: a
     * selection mixing a domain and an IP still offers the domain-only providers,
     * against the domain alone. An empty array means the same as `false`.
     *
     * Whatever it keeps is the origin the provider is called with — `summarize` and
     * `fetch` never see a node this turned down.
     *
     * ```ts
     * appliesTo: nodes => nodes.length >= 2                          // whole origin
     * appliesTo: nodes => nodes.filter(n => accepted.has(typeOf(n))) // per node
     * ```
     */
    appliesTo?: (nodes: Node[]) => boolean | Node[]
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
    /**
     * Write an ingested run's result back to the source system — the one half of the
     * contract that is not read-only.
     *
     * Omit it and this pivot's results are *not savable*: they never enter the
     * ledger, are never counted unsaved, and no Save appears for them. A pivot over
     * derived data that could not be written anywhere should omit it rather than
     * declare one that fails.
     *
     * Never called by the library on its own — an explicit
     * {@link PivotManagerLike.save}, or {@link PivotDefinition.autoSave}. The
     * consumer performs the write; the library only asks for it and records the
     * answer.
     */
    save?: (payload: PivotSavePayload, ctx: PivotSaveContext) => PivotSaveOutcome | Promise<PivotSaveOutcome>
    /**
     * Write each run the moment it lands, with no gesture. For a pivot whose results
     * are the source system's own data already — expanding an event into its
     * objects — where saving is an update rather than a decision.
     *
     * The save runs after the ingest resolves rather than inside it, so a slow
     * backend never holds up the canvas; its outcome is reported by the notifier.
     * @default false
     */
    autoSave?: boolean
}

/**
 * What the consumer is asked to write. Live graph objects rather than raw
 * fragments, so the payload carries whatever the graph has made of them.
 *
 * A retry carries only what is still unsaved, which is why this is built fresh per
 * attempt rather than kept with the run.
 *
 * @category Pivots
 */
export interface PivotSavePayload {
    runId: string
    pivotId: string
    /** The nodes the pivot was run on — "which event does this attach to". */
    origin: Node[]
    /** Top-level nodes this run created and that are still unsaved. */
    nodes: Node[]
    /**
     * Nodes this run added *inside* a container, flattened. Each one's container is
     * reachable through {@link Node.parentNode}, so a payload can be grouped by
     * parent without a second traversal.
     */
    children: Node[]
    edges: Edge[]
    /**
     * Already on canvas before this run: vouched for, not created. Context only —
     * writing these is the job of the run that produced them.
     */
    vouched: { nodes: Node[], edges: Edge[] }
    /** 1 on the first attempt, incremented by each retry. */
    attempt: number
}

/**
 * Handed to {@link PivotDefinition.save} as the last argument. Mirrors
 * {@link PivotContext} minus the narrowing concerns.
 *
 * `signal` is here so a write can be forwarded like any other request, but the
 * library never aborts it except when the graph is destroyed: cancelling a write
 * mid-flight leaves nobody knowing what happened, which is worse than waiting.
 *
 * @category Pivots
 */
export interface PivotSaveContext {
    graph: Graph
    pivotId: string
    signal: AbortSignal
}

/**
 * What {@link PivotDefinition.save} reports back.
 *
 * `void` or `true` means everything in the payload was written; `false` means none
 * of it. An object reports a partial write — **anything not named is treated as
 * still unsaved**, so a save that names nothing saved nothing. Throwing is
 * equivalent to `false`, with the error surfaced in the retry toast.
 *
 * Ids naming an element this run did not create are ignored: a pivot never writes
 * what it did not produce, so it cannot report it written either.
 *
 * @category Pivots
 */
export type PivotSaveOutcome =
    | void
    | boolean
    | {
        /** Covers both {@link PivotSavePayload.nodes} and its `children`. */
        savedNodeIds?: string[]
        /**
         * Taken at face value, including for an edge whose endpoints did not save:
         * what the source system says it wrote is not the library's to second-guess.
         */
        savedEdgeIds?: string[]
        /** Ids the source system assigned, keyed by the local id. */
        canonicalIds?: Record<string, string>
        /** Shown verbatim in the result toast — why the rest did not save. */
        message?: string
    }

/**
 * What {@link PivotManagerLike.save} resolves with.
 *
 * Every count here is **exact**, unlike the advisory ones a provider advertises:
 * this is a ledger of what the library asked for and was told, not an estimate.
 *
 * @category Pivots
 */
export interface PivotSaveReport {
    /** How many runs were attempted. */
    runs: number
    savedNodes: number
    savedEdges: number
    /** Still unsaved after this attempt — what a retry would send. */
    pendingNodes: number
    pendingEdges: number
    errors: Array<{ runId: string, error: unknown }>
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
     * `graph.history`, whose pivot entries are keyed by it. A staged run's later
     * ingest announces itself under this same id; a *second*, partial ingest out of
     * one staged set gets a fresh id of its own, so each batch is separately
     * undoable.
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
    /**
     * The nodes the pivot was run on. Empty for an origin-less pivot, and what a
     * save payload carries as "which event does this attach to".
     */
    origin: Node[]
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
    /**
     * How many of this run's elements have been written to the source system —
     * nodes, children and edges together. A surface reads it to warn *before* an
     * undo rather than after: undo takes things off the canvas and issues no
     * compensating write, so what was saved stays saved upstream.
     */
    saved: number
    /**
     * What this ingest took out of the staged set. Only the newest ingest is ever
     * re-staged, so this is a record of what *could* be restored rather than a
     * promise that it will be.
     */
    restage?: PivotRestageRecord
}

/**
 * One ingest's rows, kept so undoing it can put them back rather than asking the
 * provider for them a second time — which matters most when the alternative is
 * refetching two thousand correlations through a rate-limited API.
 *
 * Costs little: the candidate wrappers point at the same raws the run already holds,
 * and the record dies with its entry when the history evicts it.
 *
 * @category Pivots
 */
export interface PivotRestageRecord {
    /** Enough of the set's identity to rebuild it, if the ingest emptied and closed it. */
    label: string
    origin: Node[]
    narrowing: PivotNarrowing
    fetched: number
    /** Each row with the index it sat at, so it goes back in place rather than at the end. */
    nodes: Array<{ at: number, row: PivotCandidate }>
    edges: Array<{ at: number, row: PivotCandidateEdge }>
    carried: RawEdge[]
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
    /** What the library draws on a node's rim for its pivots. */
    rimBadge: PivotRimBadge
    register(definition: PivotDefinition): () => void
    unregister(id: string): void
    get(id: string): PivotDefinition | undefined
    /** Every registered pivot, in registration order. */
    all(): PivotDefinition[]
    /** What applies to this origin. An empty origin yields the origin-less pivots. */
    for(nodes: Node[]): PivotDefinition[]
    /**
     * How much of `nodes` one pivot applies to — the origin it would actually be run
     * with. Empty when it does not apply at all, and always empty for an origin-less
     * pivot. What a surface reads to say "3 of the 5 you picked".
     */
    originFor(id: string, nodes: Node[]): Node[]
    /**
     * How many pivots apply to one node — what the `'summary'` rim badge counts. Held
     * between graph changes, so it is cheap to ask per node per render.
     */
    applicableCount(node: Node): number
    run(id: string, nodes?: Node[], narrowing?: PivotNarrowing): Promise<PivotRunOutcome>
    /** Promote a waiting re-run to the set on show. */
    showPending(pivotId: string): void
    /** Drop a waiting re-run and keep triaging what is on show. */
    dismissPending(pivotId: string): void
    invalidate(pivotId?: string, nodes?: Node[]): void
    /** Abort in-flight calls — one pivot's or all, and optionally only one kind. */
    cancel(pivotId?: string, kind?: 'summarize' | 'fetch'): void

    // --- saving ------------------------------------------------------------------------

    /**
     * Write ingested runs back to their source systems. Runs go one at a time, and a
     * run whose pivot declares no `save` is never among them.
     *
     * Each run is sent only what is still unsaved, so a retry is the same call.
     *
     * @param target A run id for one run, a pivot id for every unsaved run of that
     * pivot, or nothing for all of them.
     */
    save(target?: string): Promise<PivotSaveReport>
    /** Savable runs with elements still on canvas and not yet written. */
    unsaved(): PivotRun[]
    /**
     * What a Save would send, exact rather than advisory. Narrowed to one pivot's
     * runs when given an id — what a triage pane's own line counts.
     */
    unsavedCount(pivotId?: string): { nodes: number, edges: number }
    /** Written to the source system. `false` for the unsaved *and* the not-savable. */
    isSaved(element: Node | Edge): boolean
    /** Whether this element belongs to a run whose pivot can write it anywhere. */
    isSavable(element: Node | Edge): boolean
    /**
     * The id the source system assigned this element when it was saved, when it
     * assigned one. The element keeps its own id — re-keying reaches into edges,
     * clusters, selection, the query engine and the history — so
     * `graph.getNode(canonicalId)` still misses and this is the read that does not.
     */
    canonicalId(element: Node | Edge): string | undefined
}

/**
 * What the library draws on a node's rim for its pivots. See
 * `GraphOptions.pivotRimBadge`.
 *
 * @category Pivots
 */
export type PivotRimBadge = 'per-pivot' | 'summary' | 'off'

/**
 * The key a potential declared for no particular pivot is held under — what
 * `node.setPotential(count)` writes and the `'summary'` rim badge reads.
 *
 * Exported so a consumer clearing declarations by hand can name it; the one-argument
 * `setPotential` is the way to write it.
 *
 * @category Pivots
 */
export const SUMMARY_POTENTIAL = '*'

/** Every element with no pivot vouching for it is vouched for by the seed. */
export const SEED_SOURCE = 'seed'

/**
 * What vouches for an element the analyst drew by hand. It is a source like any
 * other, so `graph.removeBySource('manual')` reaches hand-drawn work and undoing a
 * creation removes the element only when nothing else still vouches for it.
 *
 * A hand-created node therefore reports `['manual']` from `getSources()`, not
 * `['seed']`.
 */
export const MANUAL_SOURCE = 'manual'

/**
 * One run's vouching for one element. Kept internally so two runs of the same
 * pivot stay distinguishable — undoing one is built on it —
 * while the public surface stays `getSources(): string[]`.
 *
 * @category Pivots
 */
export interface SourceRecord {
    runId: string
    at: number
}
