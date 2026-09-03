import type { Edge } from './Edge'
import { rawEdgeKey } from './Edge'
import type { Graph } from './Graph'
import type { RawEdge, RawNode } from './interfaces/GraphOptions'
import type { HistoryEffect } from './interfaces/History'
import { MANUAL_SOURCE, SEED_SOURCE, type PivotRun } from './interfaces/Pivot'
import type { Node } from './Node'
import { ledgerRevokeRun, ledgerVouch, type SourceLedger } from './Provenance'

/** What one entry holds so it can be taken back, and put back again. */
export type HistoryPayload =
    | { kind: 'pivot', run: PivotRun }
    /** The elements themselves, kept alive: their ledgers come back with them. */
    | { kind: 'delete', nodes: Node[], edges: Edge[] }
    | { kind: 'visibility', hidden: boolean, nodeIds: string[] }
    | { kind: 'create', entryId: string, node?: Node, edge?: Edge }

/**
 * The graph state a reversal reads and writes.
 *
 * There are two of them and they run the same code: {@link LiveWorld} is the canvas,
 * {@link ScratchWorld} is a copy nothing can see. That is what lets `preview` state
 * the exact net effect of a span instead of describing it — the awkward cases (a
 * hide cancelled by a later unhide, a run whose nodes a second run also vouches for)
 * come out right because they are actually played, not reasoned about.
 *
 * @private
 */
export interface HistoryWorld {
    /**
     * Drop one run's claim on these nodes and remove whatever nothing vouches for any
     * more — so a node a second pivot also found survives, one record lighter.
     */
    revokeNodes(ids: string[], source: string, runId: string): void
    revokeEdges(ids: string[], source: string, runId: string): void
    /** Re-add a run's recorded nodes, or re-vouch the ones something else brought back. */
    replayNodes(raws: RawNode[], source: string, runId: string): void
    replayEdges(raws: RawEdge[], source: string, runId: string): void
    /** Vouch again for elements the run asserted without adding, seed claim intact. */
    vouchExistingNodes(ids: string[], source: string, runId: string): void
    vouchExistingEdges(ids: string[], source: string, runId: string): void
    unionChildren(unions: PivotRun['unions'], source: string, runId: string): void
    /** Vouch for elements this history holds outright — a hand-drawn node or edge. */
    claim(nodes: Node[], edges: Edge[], source: string, runId: string): void
    /** Put deleted elements back, nodes first so their edges have endpoints to hang off. */
    restore(nodes: Node[], edges: Edge[]): void
    /** Take elements out whatever vouches for them: a delete, redone. */
    remove(nodes: Node[], edges: Edge[]): void
    hide(ids: string[]): void
    show(ids: string[]): void
}

/** Take one entry back. Sealed entries never reach here. */
export function reverse(payload: HistoryPayload, world: HistoryWorld): void {
    switch (payload.kind) {
        case 'pivot': {
            const { run } = payload
            world.revokeEdges([...run.edgeIds, ...run.vouchedEdgeIds], run.pivotId, run.runId)
            // Children first, so removing a container never leaves one behind.
            world.revokeNodes(run.childIds, run.pivotId, run.runId)
            world.revokeNodes([...run.nodeIds, ...run.vouchedNodeIds], run.pivotId, run.runId)
            return
        }
        case 'delete':
            world.restore(payload.nodes, payload.edges)
            return
        case 'visibility':
            if (payload.hidden) world.show(payload.nodeIds)
            else world.hide(payload.nodeIds)
            return
        case 'create':
            world.revokeEdges(ids(payload.edge), MANUAL_SOURCE, payload.entryId)
            world.revokeNodes(ids(payload.node), MANUAL_SOURCE, payload.entryId)
    }
}

/** Do it again, exactly as it was: no provider call, no second trip through a hook. */
export function reapply(payload: HistoryPayload, world: HistoryWorld): void {
    switch (payload.kind) {
        case 'pivot': {
            const { run } = payload
            world.replayNodes(run.nodes, run.pivotId, run.runId)
            world.replayEdges(run.edges, run.pivotId, run.runId)
            world.vouchExistingNodes(run.vouchedNodeIds, run.pivotId, run.runId)
            world.vouchExistingEdges(run.vouchedEdgeIds, run.pivotId, run.runId)
            world.unionChildren(run.unions, run.pivotId, run.runId)
            return
        }
        case 'delete':
            world.remove(payload.nodes, payload.edges)
            return
        case 'visibility':
            if (payload.hidden) world.hide(payload.nodeIds)
            else world.show(payload.nodeIds)
            return
        case 'create': {
            const nodes = payload.node ? [payload.node] : []
            const edges = payload.edge ? [payload.edge] : []
            world.restore(nodes, edges)
            // Undoing the create emptied the ledger; without this the element would
            // come back reporting `'seed'` and never be reversible again.
            world.claim(nodes, edges, MANUAL_SOURCE, payload.entryId)
        }
    }
}

function ids(element?: { id: string }): string[] {
    return element ? [element.id] : []
}

/** The canvas itself. Every method here mutates the graph. @private */
export class LiveWorld implements HistoryWorld {

    private readonly graph: Graph

    constructor(graph: Graph) {
        this.graph = graph
    }

    revokeNodes(nodeIds: string[], source: string, runId: string): void {
        for (const id of nodeIds) {
            const node = this.graph.getMutableNode(id)
            // Already gone: an ancestor this run removed took it along, or the analyst did.
            if (!node?.revokeRun(source, runId)) continue
            this.graph.dropNode(node)
        }
    }

    revokeEdges(edgeIds: string[], source: string, runId: string): void {
        for (const id of edgeIds) {
            const edge = this.graph.getMutableEdge(id)
            if (edge?.revokeRun(source, runId)) this.graph.removeEdge(id)
        }
    }

    replayNodes(raws: RawNode[], source: string, runId: string): void {
        for (const raw of raws) {
            let node: Node | undefined
            try {
                node = this.graph.addNode(raw)
            } catch {
                node = this.graph.getMutableNode(String(raw.id))
            }
            if (!node) continue
            node.vouch(source, runId)
            for (const child of node.descendants()) child.vouch(source, runId)
        }
    }

    replayEdges(raws: RawEdge[], source: string, runId: string): void {
        for (const raw of raws) {
            try {
                this.graph.addEdge(raw).vouch(source, runId)
            } catch {
                this.graph.getMutableEdge(rawEdgeKey(raw))?.vouch(source, runId)
            }
        }
    }

    vouchExistingNodes(nodeIds: string[], source: string, runId: string): void {
        for (const id of nodeIds) {
            const node = this.graph.getMutableNode(id)
            if (node) vouchExisting(node, source, runId)
        }
    }

    vouchExistingEdges(edgeIds: string[], source: string, runId: string): void {
        for (const id of edgeIds) {
            const edge = this.graph.getMutableEdge(id)
            if (edge) vouchExisting(edge, source, runId)
        }
    }

    unionChildren(unions: PivotRun['unions'], source: string, runId: string): void {
        for (const union of unions) {
            const parent = this.graph.getMutableNode(union.parentId)
            if (!parent) continue
            for (const child of this.graph.unionChildren(parent, union.children)) {
                child.vouch(source, runId)
            }
        }
    }

    claim(nodes: Node[], edges: Edge[], source: string, runId: string): void {
        for (const node of nodes) this.graph.getMutableNode(node.id)?.vouch(source, runId)
        for (const edge of edges) this.graph.getMutableEdge(edge.id)?.vouch(source, runId)
    }

    restore(nodes: Node[], edges: Edge[]): void {
        for (const node of nodes) {
            if (this.graph.getMutableNode(node.id)) continue
            try {
                this.graph.addNode(node)
            } catch {
                // Something else claimed the id while it was gone. Leave it standing.
            }
        }
        for (const edge of edges) {
            if (this.graph.getMutableEdge(edge.id)) continue
            try {
                this.graph.addEdge(edge)
            } catch {
                // An endpoint never came back, so the edge has nothing to hang off.
            }
        }
    }

    remove(nodes: Node[], edges: Edge[]): void {
        // `removeNode`, not `dropNode` — the mirror of how the delete went in the
        // first place, so a child comes out exactly the way it did then.
        for (const node of nodes) {
            if (this.graph.getMutableNode(node.id)) this.graph.removeNode(node.id)
        }
        for (const edge of edges) {
            if (this.graph.getMutableEdge(edge.id)) this.graph.removeEdge(edge.id)
        }
    }

    hide(nodeIds: string[]): void {
        for (const id of nodeIds) this.graph.queryEngine.excludeNode(id)
    }

    show(nodeIds: string[]): void {
        for (const id of nodeIds) this.graph.queryEngine.includeNode(id)
    }
}

/**
 * The same graph, mirrored, so a span can be played without anything seeing it.
 *
 * Presence and ledgers are copied on first touch and the real ones are never
 * written; {@link ScratchWorld.effect} then diffs the copy against the canvas.
 *
 * @private
 */
export class ScratchWorld implements HistoryWorld {

    /** Overrides what the graph says: `true` present, `false` gone. */
    private readonly nodePresent = new Map<string, boolean>()
    private readonly edgePresent = new Map<string, boolean>()
    private readonly nodeLedgers = new Map<string, SourceLedger>()
    private readonly edgeLedgers = new Map<string, SourceLedger>()
    private readonly hidden: Set<string>
    private readonly hiddenBefore: Set<string>
    /** Which edges hang off which node, so a node removal cascades as the real one does. */
    private incidence?: Map<string, Set<string>>
    private readonly graph: Graph

    constructor(graph: Graph) {
        this.graph = graph
        this.hiddenBefore = new Set(graph.queryEngine.getExcludedNodeIds())
        this.hidden = new Set(this.hiddenBefore)
    }

    /**
     * Every element the play changed the state of — the ids a forecast has to ask
     * about. Cheaper and more honest than walking the span's entries: an edge that
     * only left because a node it hung off did is in here, and is named nowhere else.
     */
    touched(): { nodes: string[], edges: string[] } {
        const nodes = new Set(this.nodePresent.keys())
        for (const id of this.hidden) if (!this.hiddenBefore.has(id)) nodes.add(id)
        for (const id of this.hiddenBefore) if (!this.hidden.has(id)) nodes.add(id)
        return { nodes: [...nodes], edges: [...this.edgePresent.keys()] }
    }

    /** Where the play leaves one node: in the graph at all, and shown or hidden. */
    nodeAfter(id: string): { present: boolean, hidden: boolean } {
        return { present: this.hasNode(id), hidden: this.hidden.has(id) }
    }

    edgeAfter(id: string): boolean {
        return this.hasEdge(id)
    }

    /** What playing the span did, against what the canvas holds now. */
    effect(): HistoryEffect {
        const effect: HistoryEffect = {
            nodesRemoved: 0, edgesRemoved: 0, nodesRestored: 0, edgesRestored: 0,
            nodesHidden: 0, nodesShown: 0,
        }
        for (const [id, present] of this.nodePresent) {
            const before = Boolean(this.graph.getMutableNode(id))
            if (before && !present) effect.nodesRemoved++
            else if (!before && present) effect.nodesRestored++
        }
        for (const [id, present] of this.edgePresent) {
            const before = Boolean(this.graph.getMutableEdge(id))
            if (before && !present) effect.edgesRemoved++
            else if (!before && present) effect.edgesRestored++
        }
        for (const id of this.hidden) if (!this.hiddenBefore.has(id)) effect.nodesHidden++
        for (const id of this.hiddenBefore) if (!this.hidden.has(id)) effect.nodesShown++
        return effect
    }

    revokeNodes(nodeIds: string[], source: string, runId: string): void {
        for (const id of nodeIds) {
            if (!this.hasNode(id)) continue
            const ledger = this.nodeLedger(id)
            if (!ledgerRevokeRun(ledger, source, runId)) continue
            this.dropNode(id)
        }
    }

    revokeEdges(edgeIds: string[], source: string, runId: string): void {
        for (const id of edgeIds) {
            if (!this.hasEdge(id)) continue
            if (ledgerRevokeRun(this.edgeLedger(id), source, runId)) this.edgePresent.set(id, false)
        }
    }

    replayNodes(raws: RawNode[], source: string, runId: string): void {
        for (const raw of raws) {
            for (const id of rawTree(raw)) {
                this.nodePresent.set(id, true)
                ledgerVouch(this.nodeLedger(id), source, runId)
            }
        }
    }

    replayEdges(raws: RawEdge[], source: string, runId: string): void {
        for (const raw of raws) {
            const id = rawEdgeKey(raw)
            // The endpoints have to be there, exactly as `addEdge` insists.
            if (!this.hasNode(String(raw.from)) || !this.hasNode(String(raw.to))) continue
            this.edgePresent.set(id, true)
            this.registerIncidence(id, String(raw.from), String(raw.to))
            ledgerVouch(this.edgeLedger(id), source, runId)
        }
    }

    vouchExistingNodes(nodeIds: string[], source: string, runId: string): void {
        for (const id of nodeIds) {
            if (!this.hasNode(id)) continue
            const ledger = this.nodeLedger(id)
            if (ledger.size === 0) ledgerVouch(ledger, SEED_SOURCE, SEED_SOURCE)
            ledgerVouch(ledger, source, runId)
        }
    }

    vouchExistingEdges(edgeIds: string[], source: string, runId: string): void {
        for (const id of edgeIds) {
            if (!this.hasEdge(id)) continue
            const ledger = this.edgeLedger(id)
            if (ledger.size === 0) ledgerVouch(ledger, SEED_SOURCE, SEED_SOURCE)
            ledgerVouch(ledger, source, runId)
        }
    }

    unionChildren(unions: PivotRun['unions'], source: string, runId: string): void {
        for (const union of unions) {
            if (!this.hasNode(union.parentId)) continue
            for (const child of union.children) {
                for (const id of rawTree(child)) {
                    if (this.hasNode(id)) continue
                    this.nodePresent.set(id, true)
                    ledgerVouch(this.nodeLedger(id), source, runId)
                }
            }
        }
    }

    claim(nodes: Node[], edges: Edge[], source: string, runId: string): void {
        for (const node of nodes) {
            if (this.hasNode(node.id)) ledgerVouch(this.nodeLedger(node.id), source, runId)
        }
        for (const edge of edges) {
            if (this.hasEdge(edge.id)) ledgerVouch(this.edgeLedger(edge.id), source, runId)
        }
    }

    restore(nodes: Node[], edges: Edge[]): void {
        for (const node of nodes) {
            if (this.hasNode(node.id)) continue
            for (const member of [node, ...node.descendants()]) this.nodePresent.set(member.id, true)
        }
        for (const edge of edges) {
            if (this.hasEdge(edge.id)) continue
            if (!this.hasNode(edge.from.id) || !this.hasNode(edge.to.id)) continue
            this.edgePresent.set(edge.id, true)
            this.registerIncidence(edge.id, edge.from.id, edge.to.id)
        }
    }

    remove(nodes: Node[], edges: Edge[]): void {
        for (const node of nodes) if (this.hasNode(node.id)) this.dropNode(node.id)
        for (const edge of edges) if (this.hasEdge(edge.id)) this.edgePresent.set(edge.id, false)
    }

    hide(nodeIds: string[]): void {
        for (const id of nodeIds) if (this.hasNode(id)) this.hidden.add(id)
    }

    show(nodeIds: string[]): void {
        for (const id of nodeIds) if (this.hasNode(id)) this.hidden.delete(id)
    }

    private hasNode(id: string): boolean {
        return this.nodePresent.get(id) ?? Boolean(this.graph.getMutableNode(id))
    }

    private hasEdge(id: string): boolean {
        return this.edgePresent.get(id) ?? Boolean(this.graph.getMutableEdge(id))
    }

    /** A node leaves and takes its subtree and its incident edges with it, as `removeNode` does. */
    private dropNode(id: string): void {
        this.nodePresent.set(id, false)
        for (const edgeId of this.incidentEdges(id)) this.edgePresent.set(edgeId, false)
        const node = this.graph.getMutableNode(id)
        if (!node) return
        for (const child of node.descendants()) {
            if (this.hasNode(child.id)) this.dropNode(child.id)
        }
    }

    private incidentEdges(nodeId: string): Set<string> {
        if (!this.incidence) {
            this.incidence = new Map()
            for (const edge of this.graph.getMutableEdges()) {
                this.registerIncidence(edge.id, edge.from.id, edge.to.id)
            }
        }
        return this.incidence.get(nodeId) ?? new Set()
    }

    private registerIncidence(edgeId: string, from: string, to: string): void {
        // Nothing to keep until something asks: the index is built on the first cascade.
        if (!this.incidence) return
        for (const nodeId of [from, to]) {
            const edges = this.incidence.get(nodeId)
            if (edges) edges.add(edgeId)
            else this.incidence.set(nodeId, new Set([edgeId]))
        }
    }

    private nodeLedger(id: string): SourceLedger {
        let ledger = this.nodeLedgers.get(id)
        if (!ledger) {
            ledger = this.graph.getMutableNode(id)?.cloneLedger() ?? new Map()
            this.nodeLedgers.set(id, ledger)
        }
        return ledger
    }

    private edgeLedger(id: string): SourceLedger {
        let ledger = this.edgeLedgers.get(id)
        if (!ledger) {
            ledger = this.graph.getMutableEdge(id)?.cloneLedger() ?? new Map()
            this.edgeLedgers.set(id, ledger)
        }
        return ledger
    }
}

/**
 * Vouch for something already on canvas. Its seed claim is written down explicitly
 * first, so revoking this run's later leaves the seed's standing.
 */
function vouchExisting(element: Node | Edge, source: string, runId: string): void {
    const sources = element.getSources()
    if (sources.length === 1 && sources[0] === SEED_SOURCE) element.vouch(SEED_SOURCE, SEED_SOURCE)
    element.vouch(source, runId)
}

/** Every id in a raw node's subtree, container first. */
function rawTree(raw: RawNode): string[] {
    const collected = [String(raw.id)]
    for (const child of raw.children ?? []) collected.push(...rawTree(child))
    return collected
}
