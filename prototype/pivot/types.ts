// The provider contract, mirroring prd/pivot-enrichment-interface.md §7 as closely as a
// prototype can. Kept in its own file so the shape can be lifted into src/interfaces/Pivot.ts
// when this is implemented for real.

import type { Node } from '../../src/Node'
import type { RawNode, RawEdge } from '../../src/interfaces/GraphOptions'

/** Narrowing is server-bound, so `regex` is out (D18). */
export type NarrowingFacetType = 'text' | 'select' | 'multiselect' | 'numberRange' | 'boolean'

export interface PivotFacet {
    key: string
    label: string
    type: NarrowingFacetType
    options?: Array<{ label: string, value: string, count?: number }>
}

/** The analyst's narrowing choices, keyed by facet key. */
export type PivotNarrowing = Record<string, unknown>

/** What `summarize` advertises. Every count here is advisory (D10). */
export interface PivotSummary {
    total: number
    facets?: PivotFacet[]
}

/** A flat graph fragment (D7). Edge-only sets are legal (D24). */
export interface PivotResult {
    nodes: RawNode[]
    edges: RawEdge[]
}

export interface PivotContext {
    signal: AbortSignal
    pivotId: string
}

export interface PivotDefinition {
    id: string
    label: string
    icon?: string
    /** `'none'` pivots need no origin — search, import, a staging tray (D19). */
    origin?: 'selection' | 'none'
    appliesTo?: (nodes: Node[]) => boolean
    summarize?: (nodes: Node[], narrowing: PivotNarrowing, ctx: PivotContext) => Promise<PivotSummary>
    fetch: (nodes: Node[], narrowing: PivotNarrowing, ctx: PivotContext) => Promise<PivotResult>
    /** Land results directly instead of opening triage (D13). */
    autoIngest?: boolean
    /** Refuse to fetch when the advertised count exceeds this (D4). */
    maxCandidates?: number
}

/** One fetched row awaiting triage. Never in the graph until ingested. */
export interface Candidate {
    id: string
    raw: RawNode
    /** Already on canvas, so it is shown struck and not ingestable (D23). */
    deduped: boolean
    state: 'candidate' | 'marked' | 'rejected'
}

export interface CandidateEdge {
    id: string
    raw: RawEdge
    state: 'candidate' | 'marked' | 'rejected'
}

/** What one `fetch` produced, staged in a dock tab. */
export interface CandidateSet {
    pivotId: string
    label: string
    origin: Node[]
    fetched: number
    deduped: number
    /** Suppressed because they were explicitly rejected earlier this session (D14). */
    suppressed: number
    nodes: Candidate[]
    /** Edges whose endpoints are all already on canvas get their own rows (D24). */
    edges: CandidateEdge[]
    /**
     * Edges that are *not* rows: they follow their endpoints and land iff both ends end up
     * on canvas (D24). Keyed by each endpoint id so ingest can find them from what landed.
     */
    carried: Map<string, RawEdge[]>
    error?: string
    /** Set when the provider blew through the absolute ceiling (D17). */
    refused?: { returned: number, ceiling: number }
    loading: boolean
    /** A re-run landed while this set was being triaged (C7). */
    pending?: CandidateSet
}

/** One ingest, undoable as a unit (D25). */
export interface PivotRun {
    runId: string
    pivotId: string
    nodeIds: Array<string | number>
    edgeIds: Array<string | number>
    /** The raw payload, so redo can re-land it without refetching. */
    nodes: RawNode[]
    edges: RawEdge[]
    origin: Node[]
}
