import type { Edge } from '../Edge'
import type { GraphForecast } from '../GraphRenderer'
import type { Node } from '../Node'

/**
 * Which sort of entry a row is — a closed set.
 *
 * `pivot` an ingest, `delete` a removal, `visibility` a durable hide or unhide,
 * `create` a node or edge drawn by hand. Every one of them is a change to what the
 * canvas *holds and shows*, which is the only thing the library has the authority
 * to reverse: a node's data is the backend's, not ours.
 *
 * @category History
 */
export type HistoryKind = 'pivot' | 'delete' | 'visibility' | 'create'

/**
 * One reversible thing that happened, as one row in the history.
 *
 * @category History
 */
export interface HistoryEntry {
    /**
     * Stable handle, and what {@link GraphHistoryLike.undo} addresses. A pivot
     * entry's id **is** its `runId`, so a `PivotRunOutcome` already carries the id
     * of its own row.
     */
    id: string
    kind: HistoryKind
    /** What the row says: `AIL correlations`, `Deleted 3 nodes`, `Hid 5 nodes`. */
    label: string
    /** The elements this entry touched — the row's counts, and what a hover highlights. */
    nodeIds: string[]
    edgeIds: string[]
    /**
     * Never reversed — a deletion the consumer wrote through to its backend. Undo is
     * a canvas operation and issues no compensating write, so restoring these would
     * put back nodes the record of truth no longer has. Listed, and stepped over
     * inside a span rather than walling it.
     */
    sealed: boolean
    /**
     * The consumer reported this operation as written through to its backend. A
     * persisted *creation* still reverses: the canvas loses what the backend keeps,
     * which a re-fetch undoes. The row says so, and the footer counts it.
     */
    persisted: boolean
    /** For a pivot entry, which pivot produced it — two runs of one pivot share it. */
    pivotId?: string
    /**
     * For a pivot entry, which run of that pivot this is, counting from 1. The
     * tie-break between two runs of the same pivot: counts and clocks both collide,
     * an ordinal cannot.
     */
    ordinal?: number
    at: number
}

/**
 * What committing a span would actually do, counted by replaying it rather than by
 * summing the entries — so a hide cancelled by a later unhide nets to zero and the
 * menu says so.
 *
 * @category History
 */
export interface HistoryEffect {
    nodesRemoved: number
    edgesRemoved: number
    nodesRestored: number
    edgesRestored: number
    nodesHidden: number
    nodesShown: number
}

/**
 * What a span would do, before it is committed.
 *
 * @category History
 */
export interface HistoryPreview {
    /** The span, newest first — the rows the menu marks. */
    entries: HistoryEntry[]
    /** Inside the span, left alone because they are sealed. */
    skipped: HistoryEntry[]
    /**
     * Inside the span and reversed, but written through to a backend that keeps its
     * copy — so the reversal is canvas-only. What the footer warns about.
     */
    canvasOnly: HistoryEntry[]
    /**
     * The elements the span touches that are on the canvas *now*. An entry whose
     * elements are gone names none, honestly — see {@link forecast} for those.
     */
    nodes: Node[]
    edges: Edge[]
    /** The simulated net effect of committing it. */
    effect: HistoryEffect
    /**
     * The same thing as something the canvas can wear: what would go, what would be
     * hidden, and where what is *not* on the canvas would come back. Hand it to
     * `graph.showForecast`.
     */
    forecast: GraphForecast
}

/**
 * A bounded, session-scoped history of what the canvas holds and shows: what was
 * brought in, what was taken out, what was hidden.
 *
 * Reached as `graph.history`. Read it and drive it — the entry kinds are closed, so
 * a consumer cannot record into it. Every entry names the specific elements it
 * touched, which is what lets a sealed entry be skipped mid-span without the ones
 * around it getting out of order.
 *
 * @category History
 */
export interface GraphHistoryLike {
    /** What has been done and can be undone, newest first — the order the menu renders. */
    entries(): HistoryEntry[]
    /** What has been undone and can be redone, newest first. Emptied by any new action. */
    redoable(): HistoryEntry[]
    canUndo(): boolean
    canRedo(): boolean
    /**
     * Undo the span running from the newest entry through `throughEntryId`; the
     * newest entry alone by default. Lands as one `dataBatchChanged`.
     *
     * @returns the entries actually reversed, newest first — sealed ones are passed
     * over and are not in it.
     */
    undo(throughEntryId?: string): HistoryEntry[]
    /** Redo the span running back through `throughEntryId`; the nearest one by default. */
    redo(throughEntryId?: string): HistoryEntry[]
    /** What that span would touch — what drives the hover highlight and the menu's own copy. */
    preview(throughEntryId: string, direction?: 'undo' | 'redo'): HistoryPreview
    /** Fires on every change to the history. Returns a disposer. */
    on(listener: (history: GraphHistoryLike) => void): () => void
    /** Forget everything. The canvas is left exactly as it is. */
    clear(): void
}
