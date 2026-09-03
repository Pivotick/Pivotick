import type { Edge } from '../Edge'
import type { Graph } from '../Graph'
import type {
    ConfirmOptions,
    DeleteContext,
    DeleteDecision,
    DeleteOrigin,
    DeleteOutcome,
} from '../interfaces/InterractionCallbacks'
import type { Node } from '../Node'
import type { Note } from '../Note'
import { confirmModal } from './PromptModal'

/** What an affordance asks the library to delete. */
export interface DeleteRequest {
    nodes?: Node[]
    edges?: Edge[]
    notes?: Note[]
    origin: DeleteOrigin
}

/** Normalised form of an {@link InterractionCallbacks.onBeforeDelete} return value. */
interface ResolvedDecision {
    accept: boolean
    nodes?: Node[]
    edges?: Edge[]
    notes?: Note[]
    persisted?: boolean
}

/** A delete request once resolved against the live graph — the hook's target set. */
interface ResolvedTargets {
    nodes: Node[]
    edges: Edge[]
    notes: Note[]
    cascadingEdges: Edge[]
}

/**
 * Run a user-initiated delete: resolve the target set against the live graph, let
 * {@link InterractionCallbacks.onBeforeDelete} veto or narrow it, then remove exactly
 * what survives. Reports what actually went, so the caller can decide whether to
 * clear its selection.
 *
 * With no hook installed this is a straight removal — the pre-hook behaviour, byte
 * for byte.
 */
export async function runDeleteRequest(graph: Graph, request: DeleteRequest): Promise<DeleteOutcome> {

    const targets = resolveTargets(graph, request)

    if (!targets.nodes.length && !targets.edges.length && !targets.notes.length) {
        return { accepted: false, nodes: [], edges: [], notes: [] }
    }

    const hook = graph.getOptions().callbacks?.onBeforeDelete

    if (!hook) {
        return remove(graph, targets.nodes, targets.edges, targets.notes, false)
    }

    const context: DeleteContext = {
        nodes: targets.nodes,
        edges: targets.edges,
        notes: targets.notes,
        cascadingEdges: targets.cascadingEdges,
        origin: request.origin,
        confirm: (options?: ConfirmOptions) => confirmModal(graph, options),
    }

    const decision = normalise(await hook(context))

    if (!decision.accept) {
        return { accepted: false, nodes: [], edges: [], notes: [] }
    }

    // An omitted key means "as requested"; a supplied one narrows, and anything that
    // wasn't part of the request is ignored.
    return remove(
        graph,
        narrow(targets.nodes, decision.nodes),
        narrow(targets.edges, decision.edges),
        narrow(targets.notes, decision.notes),
        decision.persisted === true,
    )
}

/**
 * Edges that removing `nodes` would take with it — `graph.removeNode` cascades into
 * every incident edge. Public so a caller can report the consequence of a gesture
 * before running it.
 */
export function incidentEdges(graph: Graph, nodes: Node[]): Edge[] {
    if (!nodes.length) return []
    const nodeIds = new Set(nodes.map(node => node.id))
    return graph.getMutableEdges().filter(edge => nodeIds.has(edge.from.id) || nodeIds.has(edge.to.id))
}

/**
 * Keep only elements still in the graph, drop duplicates, and split the edges into
 * the ones the user named and the ones a node removal will cascade into — the two
 * never overlap, so a consumer can persist each exactly once.
 */
function resolveTargets(graph: Graph, request: DeleteRequest): ResolvedTargets {

    const nodes = dedupe((request.nodes ?? []).filter(node => Boolean(graph.getMutableNode(node.id))))
    const notes = dedupe((request.notes ?? []).filter(note => graph.noteManager.hasNote(note.id)))
    const edges = dedupe((request.edges ?? []).filter(edge => Boolean(graph.getMutableEdge(edge.id))))

    const named = new Set(edges.map(edge => edge.id))
    const cascadingEdges = incidentEdges(graph, nodes).filter(edge => !named.has(edge.id))

    return { nodes, edges, notes, cascadingEdges }
}

function dedupe<T extends { id: string }>(elements: T[]): T[] {
    const seen = new Set<string>()
    return elements.filter(element => {
        if (seen.has(element.id)) return false
        seen.add(element.id)
        return true
    })
}

/** `true`/`false` and the object form collapse to one shape. */
function normalise(decision: DeleteDecision): ResolvedDecision {
    if (decision === true) return { accept: true }
    if (!decision) return { accept: false }
    return {
        accept: decision.accept,
        nodes: decision.nodes,
        edges: decision.edges,
        notes: decision.notes,
        persisted: decision.persisted,
    }
}

/** Narrow a requested set to the consumer's subset, ignoring anything unrequested. */
function narrow<T extends { id: string }>(requested: T[], subset?: T[]): T[] {
    if (!subset) return requested
    const allowed = new Set(requested.map(element => element.id))
    return dedupe(subset.filter(element => allowed.has(element.id)))
}

/**
 * Remove the surviving set. Notes go first (independent), then nodes — whose removal
 * cascades into their incident edges — then whatever named edges are still standing.
 */
function remove(graph: Graph, nodes: Node[], edges: Edge[], notes: Note[], persisted: boolean): DeleteOutcome {

    // Resolve the cascade before mutating, so the outcome can report the edges that
    // went with the nodes even though nothing asked for them by name.
    const cascaded = incidentEdges(graph, nodes)

    for (const note of notes) graph.noteManager.removeNote(note)
    for (const node of nodes) graph.removeNode(node.id)

    const removedEdges = [...cascaded]
    for (const edge of edges) {
        if (!graph.getMutableEdge(edge.id)) continue // already gone with a node
        graph.removeEdge(edge.id)
        removedEdges.push(edge)
    }

    // The nodes and edges are recorded so the delete can be taken back; the notes are
    // not — a note is authored text, closer to an edit than to graph composition.
    graph.history.recordDelete(nodes, removedEdges, persisted)

    return { accepted: true, nodes, edges: removedEdges, notes }
}
