import type { Edge } from './Edge'
import type { Graph } from './Graph'
import {
    LiveWorld, ScratchWorld, reapply, reverse,
    type HistoryPayload, type HistoryWorld,
} from './HistoryWorld'
import type {
    GraphHistoryLike, HistoryEffect, HistoryEntry, HistoryPreview,
} from './interfaces/History'
import { MANUAL_SOURCE, type PivotRun } from './interfaces/Pivot'
import type { Node } from './Node'
import { generateSafeDomId } from './utils/ElementCreation'

/** An entry with the payload that makes it reversible. The payload never leaves this file. */
interface HistoryRecord extends HistoryEntry {
    payload: HistoryPayload
}

/**
 * How far back the history reaches. Office keeps a hundred; thirty is plenty for a
 * session's real work, and the oldest entry is evicted rather than the newest
 * refused. Eviction loses the ability to *restore* an old run, not to *remove* it:
 * provenance lives on the elements, so `graph.removeBySource` still reaches it.
 */
const MAX_ENTRIES = 30

/**
 * A bounded, session-scoped history of what the canvas holds and shows.
 *
 * It is one timeline with a line drawn through it: everything above the line has
 * happened, everything below has been undone and can be redone. Undo walks the line
 * down through a contiguous span, redo walks it back up, and any new action strands
 * whatever was below it. Nothing here reverses a single old entry on its own — that
 * is `graph.removeBySource`, which is a forward operation and says so.
 *
 * Reached as {@link Graph.history}.
 *
 * @category History
 */
export class GraphHistory implements GraphHistoryLike {

    private readonly graph: Graph
    /** Oldest first — the timeline. */
    private readonly records: HistoryRecord[] = []
    /** How much of it has happened: `records[0 … cursor - 1]` are done. */
    private cursor = 0
    private readonly listeners = new Set<(history: GraphHistory) => void>()

    /** True while a span is being applied, so the reversal's own writes record nothing. */
    private applying = false
    /** Depth of {@link group} calls; > 0 means visibility changes are being collected. */
    private grouping = 0
    private pending?: { hidden: boolean, nodeIds: string[] }

    constructor(graph: Graph) {
        this.graph = graph
    }

    // --- reading -----------------------------------------------------------------------

    public entries(): HistoryEntry[] {
        return this.records.slice(0, this.cursor).reverse().map(publicEntry)
    }

    public redoable(): HistoryEntry[] {
        return this.records.slice(this.cursor).reverse().map(publicEntry)
    }

    public canUndo(): boolean {
        return this.cursor > 0
    }

    public canRedo(): boolean {
        return this.cursor < this.records.length
    }

    // --- travelling --------------------------------------------------------------------

    /**
     * Undo the span from the newest entry through `throughEntryId` — the newest entry
     * alone by default. A sealed entry inside the span is passed over rather than
     * walled off: the entries around it are named element by element, so skipping one
     * cannot put the rest out of order.
     *
     * The whole span lands as one `dataBatchChanged`, and one re-render.
     *
     * @returns what was actually reversed, newest first.
     */
    public undo(throughEntryId?: string): HistoryEntry[] {
        const span = this.undoSpan(throughEntryId)
        if (!span.length) return []

        const reversed = this.travel(span, reverse)
        this.cursor -= span.length
        this.restageNewest(span[0])
        this.notify()
        return reversed
    }

    /**
     * Re-land the span from the line back through `throughEntryId` — the nearest
     * undone entry by default. Exactly as it was: no provider call, no re-gating, no
     * second trip through a hook.
     *
     * @returns what was actually re-applied, newest first.
     */
    public redo(throughEntryId?: string): HistoryEntry[] {
        const span = this.redoSpan(throughEntryId)
        if (!span.length) return []

        const applied = this.travel(span, reapply)
        this.cursor += span.length
        this.notify()
        return applied.reverse()
    }

    /**
     * What that span would do, played against a copy of the graph rather than summed
     * from the entries — so a hide cancelled by a later unhide nets to zero, and a
     * node a second run also vouches for is not counted as leaving.
     */
    public preview(throughEntryId: string, direction: 'undo' | 'redo' = 'undo'): HistoryPreview {
        // In the order it would be played: newest first going back, oldest first coming
        // forward. An id the direction cannot reach previews nothing.
        const span = direction === 'undo' ? this.undoSpan(throughEntryId) : this.redoSpan(throughEntryId)

        const world = new ScratchWorld(this.graph)
        const applied: HistoryRecord[] = []
        const skipped: HistoryRecord[] = []
        for (const record of span) {
            if (record.sealed) skipped.push(record)
            else {
                (direction === 'undo' ? reverse : reapply)(record.payload, world)
                applied.push(record)
            }
        }

        // Only what the span will actually touch lights up: a sealed row stays put, and
        // an entry whose elements are gone lights nothing.
        const nodes: Node[] = []
        const edges: Edge[] = []
        for (const record of applied) {
            for (const id of record.nodeIds) {
                const node = this.graph.getMutableNode(id)
                if (node) nodes.push(node)
            }
            for (const id of record.edgeIds) {
                const edge = this.graph.getMutableEdge(id)
                if (edge) edges.push(edge)
            }
        }

        const ordered = direction === 'undo' ? span : [...span].reverse()
        return {
            entries: ordered.map(publicEntry),
            skipped: skipped.map(publicEntry),
            nodes: dedupe(nodes),
            edges: dedupe(edges),
            effect: world.effect(),
        }
    }

    // --- the change bus ----------------------------------------------------------------

    /** Subscribe to every change to the history — a new entry, a span travelled, a clear. */
    public on(listener: (history: GraphHistory) => void): () => void {
        this.listeners.add(listener)
        return () => this.listeners.delete(listener)
    }

    /** Forget everything. The canvas is left exactly as it is. */
    public clear(): void {
        this.records.length = 0
        this.cursor = 0
        this.notify()
    }

    // --- recording ---------------------------------------------------------------------

    /**
     * @private
     * One pivot ingest. The entry's id **is** the run's, so an outcome addresses its
     * own row.
     */
    public recordPivotRun(run: PivotRun, label: string, ordinal: number): void {
        if (this.applying) return
        this.push({
            id: run.runId,
            kind: 'pivot',
            // Children ride with their container and edges are counted apart, so the
            // row says what the ingest said it landed.
            nodeIds: [...run.nodeIds],
            edgeIds: [...run.edgeIds],
            label,
            sealed: false,
            pivotId: run.pivotId,
            ordinal,
            at: run.at,
            payload: { kind: 'pivot', run },
        })
    }

    /**
     * @private
     * A delete that happened. The elements themselves are kept, not a copy of their
     * data: their provenance comes back with them, so undoing a deletion restores who
     * vouched for what instead of resurrecting orphans the next undo cannot account
     * for. Notes are not recorded — a note is authored text, closer to an edit.
     */
    public recordDelete(nodes: Node[], edges: Edge[], persisted = false): void {
        if (this.applying || (!nodes.length && !edges.length)) return
        this.push({
            id: newId(),
            kind: 'delete',
            nodeIds: nodes.map(node => node.id),
            edgeIds: edges.map(edge => edge.id),
            label: deleteLabel(nodes.length, edges.length),
            sealed: persisted,
            at: Date.now(),
            payload: { kind: 'delete', nodes: [...nodes], edges: [...edges] },
        })
    }

    /**
     * @private
     * One durable hide or unhide. Inside {@link group} a whole selection's worth
     * collapses into a single entry, because it was a single act.
     */
    public recordVisibility(nodeId: string, hidden: boolean): void {
        if (this.applying) return
        if (this.grouping) {
            if (this.pending && this.pending.hidden !== hidden) this.flush()
            if (!this.pending) this.pending = { hidden, nodeIds: [] }
            if (!this.pending.nodeIds.includes(nodeId)) this.pending.nodeIds.push(nodeId)
            return
        }
        this.push(visibilityRecord(hidden, [nodeId]))
    }

    /**
     * @private
     * A node or edge drawn by hand. It is claimed for the `manual` source under this
     * entry, so removal stays the one uniform rule: drop the vouching, and delete
     * only what nothing else vouches for.
     */
    public recordCreate(element: { node?: Node, edge?: Edge }, persisted = false): void {
        if (this.applying) return
        const { node, edge } = element
        if (!node && !edge) return

        const id = newId()
        node?.vouch(MANUAL_SOURCE, id)
        edge?.vouch(MANUAL_SOURCE, id)
        this.push({
            id,
            kind: 'create',
            nodeIds: node ? [node.id] : [],
            edgeIds: edge ? [edge.id] : [],
            label: createLabel(node, edge),
            sealed: persisted,
            at: Date.now(),
            payload: { kind: 'create', entryId: id, node, edge },
        })
    }

    /**
     * @private
     * Coalesce every visibility change made inside `fn` into one entry — hiding a
     * selection of five is one act, not five.
     */
    public group<T>(fn: () => T): T {
        this.grouping++
        try {
            return fn()
        } finally {
            this.grouping--
            if (this.grouping === 0) this.flush()
        }
    }

    // --- internals ---------------------------------------------------------------------

    /**
     * An ingest that was the newest thing to happen puts its candidates back in the
     * triage pane, so an immediate "wrong twelve" costs no second provider call. Only
     * the newest: if anything has happened since, a pane resurrecting itself over that
     * later work would be worse than the refetch.
     */
    private restageNewest(newest?: HistoryRecord): void {
        if (!newest || newest.sealed || newest.payload.kind !== 'pivot') return
        this.graph.pivots.restage(newest.payload.run)
    }

    /** The span an undo would travel, newest first — the order the rows are marked in. */
    private undoSpan(throughEntryId?: string): HistoryRecord[] {
        const target = throughEntryId ? this.indexOf(throughEntryId, 0, this.cursor) : this.cursor - 1
        if (target < 0) return []
        return this.records.slice(target, this.cursor).reverse()
    }

    /** The span a redo would travel, oldest first — the order it is re-applied in. */
    private redoSpan(throughEntryId?: string): HistoryRecord[] {
        const target = throughEntryId
            ? this.indexOf(throughEntryId, this.cursor, this.records.length)
            : this.cursor
        if (target < 0 || target >= this.records.length) return []
        return this.records.slice(this.cursor, target + 1)
    }

    /** Apply a span through the live world, sealed entries passed over. */
    private travel(
        span: HistoryRecord[],
        step: (payload: HistoryPayload, world: HistoryWorld) => void,
    ): HistoryEntry[] {
        const touched: HistoryRecord[] = []
        this.applying = true
        try {
            const world = new LiveWorld(this.graph)
            this.graph.batchChanges(() => {
                for (const record of span) {
                    if (record.sealed) continue
                    step(record.payload, world)
                    touched.push(record)
                }
            })
        } finally {
            this.applying = false
        }
        return touched.map(publicEntry)
    }

    private push(record: HistoryRecord): void {
        // Any new action strands whatever was undone: redo is strictly linear, and a
        // run that was undone and then stranded is gone.
        this.records.length = this.cursor
        this.records.push(record)
        if (this.records.length > MAX_ENTRIES) this.records.shift()
        this.cursor = this.records.length
        this.notify()
    }

    private flush(): void {
        const pending = this.pending
        this.pending = undefined
        if (pending?.nodeIds.length) this.push(visibilityRecord(pending.hidden, pending.nodeIds))
    }

    /** Where an entry sits, within `[from, to)` of the timeline. */
    private indexOf(entryId: string, from: number, to: number): number {
        for (let i = from; i < to; i++) if (this.records[i].id === entryId) return i
        return -1
    }

    private notify(): void {
        for (const listener of [...this.listeners]) listener(this)
    }
}

function publicEntry(record: HistoryRecord): HistoryEntry {
    return {
        id: record.id,
        kind: record.kind,
        label: record.label,
        nodeIds: [...record.nodeIds],
        edgeIds: [...record.edgeIds],
        sealed: record.sealed,
        pivotId: record.pivotId,
        ordinal: record.ordinal,
        at: record.at,
    }
}

function visibilityRecord(hidden: boolean, nodeIds: string[]): HistoryRecord {
    return {
        id: newId(),
        kind: 'visibility',
        nodeIds: [...nodeIds],
        edgeIds: [],
        label: `${hidden ? 'Hid' : 'Showed'} ${count(nodeIds.length, 'node')}`,
        sealed: false,
        at: Date.now(),
        payload: { kind: 'visibility', hidden, nodeIds: [...nodeIds] },
    }
}

function deleteLabel(nodes: number, edges: number): string {
    const parts: string[] = []
    if (nodes) parts.push(count(nodes, 'node'))
    if (edges) parts.push(count(edges, 'edge'))
    return `Deleted ${parts.join(', ')}`
}

function createLabel(node?: Node, edge?: Edge): string {
    const label = node?.getData()?.label ?? edge?.getData()?.label
    if (typeof label === 'string' && label.trim()) return `Created “${label.trim()}”`
    return node ? 'Created a node' : 'Created an edge'
}

function count(n: number, noun: string): string {
    return `${n.toLocaleString()} ${n === 1 ? noun : `${noun}s`}`
}

function dedupe<T extends { id: string }>(elements: T[]): T[] {
    const seen = new Set<string>()
    return elements.filter(element => {
        if (seen.has(element.id)) return false
        seen.add(element.id)
        return true
    })
}

function newId(): string {
    return generateSafeDomId(8, 'history-')
}

export type { HistoryEffect, HistoryEntry, HistoryPreview }
