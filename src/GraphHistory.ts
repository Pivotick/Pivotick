import type { Edge } from './Edge'
import type { Graph } from './Graph'
import type { ForecastEdge, ForecastNode, GraphForecast } from './GraphRenderer'
import {
    LiveWorld, ScratchWorld, reapply, reverse,
    type HistoryPayload,
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
    /**
     * Where this entry's elements stood, noted as an undo took them off the canvas.
     * A pivot replays from raw provider data, which carries no coordinates — so
     * without this a redone ingest scatters its nodes anew, and a forecast of one
     * would have nothing to point at.
     */
    dropped?: Dropped
}

/** Where an element stood, and how big it was drawn. */
interface Placement {
    x: number
    y: number
    radius: number
    fx?: number
    fy?: number
}

interface Dropped {
    nodes: Map<string, Placement>
    /** `[fromId, toId]` per edge: an outline needs both ends, and the edge is gone. */
    edges: Map<string, [string, string]>
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

        const reversed = this.travel(span, 'undo')
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

        const applied = this.travel(span, 'redo')
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

        const forecast = this.forecast(world, applied)
        const changing = new Set([
            ...(forecast.removing ?? []).map(element => element.id),
            ...(forecast.hiding ?? []).map(node => node.id),
        ])

        const ordered = direction === 'undo' ? span : [...span].reverse()
        return {
            entries: ordered.map(publicEntry),
            skipped: skipped.map(publicEntry),
            // Reversed here, kept there: a persisted creation comes off the canvas
            // while the backend holds on to it.
            canvasOnly: applied.filter(record => record.persisted).map(publicEntry),
            nodes: dedupe(nodes),
            edges: dedupe(edges),
            effect: world.effect(),
            // A ring goes on what the span touches and *keeps* — a node a second run
            // also vouches for. What is on its way out is drained instead, and saying
            // both about one element says neither.
            forecast: {
                ...forecast,
                touching: [...dedupe(nodes), ...dedupe(edges)].filter(element => !changing.has(element.id)),
            },
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
            persisted: false,
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
            persisted,
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
            sealed: false,
            persisted,
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
    private travel(span: HistoryRecord[], direction: 'undo' | 'redo'): HistoryEntry[] {
        const step = direction === 'undo' ? reverse : reapply
        const touched: HistoryRecord[] = []
        this.applying = true
        try {
            const world = new LiveWorld(this.graph)
            this.graph.batchChanges(() => {
                for (const record of span) {
                    if (record.sealed) continue
                    // Note where everything stands before an undo takes it away, and put
                    // it back there on the way in: what a redo replays is raw provider
                    // data, which has no coordinates in it.
                    if (direction === 'undo') this.capture(record)
                    const missing = direction === 'redo' ? this.missingNodes(record) : undefined
                    step(record.payload, world)
                    if (missing) this.place(record, missing)
                    touched.push(record)
                }
            })
        } finally {
            this.applying = false
        }
        return touched.map(publicEntry)
    }

    /** Note where this entry's elements stand, while they are still on the canvas. */
    private capture(record: HistoryRecord): void {
        const nodes = new Map<string, Placement>()
        for (const id of record.nodeIds) {
            const placement = placementOf(this.graph.getMutableNode(id))
            if (placement) nodes.set(id, placement)
        }
        const edges = new Map<string, [string, string]>()
        for (const id of record.edgeIds) {
            const edge = this.graph.getMutableEdge(id)
            if (edge) edges.set(id, [edge.from.id, edge.to.id])
        }
        record.dropped = { nodes, edges }
    }

    /** Which of an entry's nodes are off the canvas right now, before it is re-applied. */
    private missingNodes(record: HistoryRecord): Set<string> {
        const missing = new Set<string>()
        for (const id of record.nodeIds) {
            if (!this.graph.getMutableNode(id)) missing.add(id)
        }
        return missing
    }

    /**
     * Put the nodes that were away back where they stood. Only those: a node that
     * never left has moved since, and its old position is not where it is.
     */
    private place(record: HistoryRecord, missing: Set<string>): void {
        for (const [id, at] of record.dropped?.nodes ?? []) {
            if (!missing.has(id)) continue
            const node = this.graph.getMutableNode(id)
            if (!node) continue
            node.x = at.x
            node.y = at.y
            // A node that was pinned comes back pinned; one that was not stays free.
            if (at.fx !== undefined) node.fx = at.fx
            if (at.fy !== undefined) node.fy = at.fy
        }
    }

    /**
     * Turn the played span into something the canvas can wear: the drawn elements it
     * would take away or hide, and outlines for what it would put back. That last
     * part is what a redo is mostly made of — its elements are not on the canvas, so
     * there is nothing there to light up.
     */
    private forecast(world: ScratchWorld, applied: HistoryRecord[]): GraphForecast {
        const known = this.knownPlacements(applied)
        const removing: (Node | Edge)[] = []
        const hiding: Node[] = []
        const arrivingNodes: ForecastNode[] = []
        const arrivingEdges: ForecastEdge[] = []
        const excluded = new Set(this.graph.queryEngine.getExcludedNodeIds())
        const touched = world.touched()

        for (const id of touched.nodes) {
            const live = this.graph.getMutableNode(id)
            // Kept off the canvas by something the history does not model — a query
            // filter, a collapsed ancestor. The span would not draw it either, so it
            // is left out of the forecast rather than promised.
            if (live && !live.visible && !excluded.has(id)) continue

            const after = world.nodeAfter(id)
            const drawnNow = Boolean(live?.visible)
            const drawnAfter = after.present && !after.hidden
            if (drawnNow === drawnAfter) continue

            if (live && drawnNow) {
                if (after.present) hiding.push(live)
                else removing.push(live)
                continue
            }
            const at = placementOf(live) ?? known.nodes.get(id)
            if (at) arrivingNodes.push({ id, x: at.x, y: at.y, radius: at.radius })
        }

        // An arriving edge is drawn between wherever its ends will be: the live node
        // for one that never left, the noted position for one arriving with it.
        const arrived = new Map(arrivingNodes.map(node => [node.id, node]))
        const pointFor = (nodeId: string): { x: number, y: number } | undefined => {
            const node = this.graph.getMutableNode(nodeId)
            if (node?.visible && typeof node.x === 'number' && typeof node.y === 'number') {
                return { x: node.x, y: node.y }
            }
            const at = arrived.get(nodeId) ?? known.nodes.get(nodeId)
            return at ? { x: at.x, y: at.y } : undefined
        }

        for (const id of touched.edges) {
            const live = this.graph.getMutableEdge(id)
            if (live && !live.visible) continue
            const drawnNow = Boolean(live?.visible)
            const drawnAfter = world.edgeAfter(id)
            if (drawnNow === drawnAfter) continue

            if (live && drawnNow) {
                removing.push(live)
                continue
            }
            const ends = live ? [live.from.id, live.to.id] : known.edges.get(id)
            const from = ends && pointFor(ends[0])
            const to = ends && pointFor(ends[1])
            if (from && to) arrivingEdges.push({ id, from, to })
        }

        return { removing, hiding, arriving: { nodes: arrivingNodes, edges: arrivingEdges } }
    }

    /**
     * Where the elements a span would bring back stood: what an undo noted on its way
     * out, and what the payloads hold outright — a deleted element is kept alive, so
     * it still knows where it was standing.
     */
    private knownPlacements(records: HistoryRecord[]): Dropped {
        const nodes = new Map<string, Placement>()
        const edges = new Map<string, [string, string]>()
        for (const record of records) {
            for (const [id, at] of record.dropped?.nodes ?? []) nodes.set(id, at)
            for (const [id, ends] of record.dropped?.edges ?? []) edges.set(id, ends)

            const { payload } = record
            const held = payload.kind === 'delete'
                ? { nodes: payload.nodes, edges: payload.edges }
                : payload.kind === 'create'
                    ? { nodes: payload.node ? [payload.node] : [], edges: payload.edge ? [payload.edge] : [] }
                    : { nodes: [], edges: [] }
            for (const node of held.nodes) {
                const at = placementOf(node)
                if (at && !nodes.has(node.id)) nodes.set(node.id, at)
            }
            for (const edge of held.edges) {
                if (!edges.has(edge.id)) edges.set(edge.id, [edge.from.id, edge.to.id])
            }
        }
        return { nodes, edges }
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
        persisted: record.persisted,
        pivotId: record.pivotId,
        ordinal: record.ordinal,
        at: record.at,
    }
}

/** Where a node stands, if it stands anywhere: an unplaced node forecasts nothing. */
function placementOf(node?: Node): Placement | undefined {
    if (!node || typeof node.x !== 'number' || typeof node.y !== 'number') return undefined
    return { x: node.x, y: node.y, radius: node.getCircleRadius(), fx: node.fx, fy: node.fy }
}

function visibilityRecord(hidden: boolean, nodeIds: string[]): HistoryRecord {
    return {
        id: newId(),
        kind: 'visibility',
        nodeIds: [...nodeIds],
        edgeIds: [],
        label: `${hidden ? 'Hid' : 'Showed'} ${count(nodeIds.length, 'node')}`,
        sealed: false,
        persisted: false,
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
