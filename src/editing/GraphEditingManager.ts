import type { Edge } from '../Edge'
import type { Graph } from '../Graph'
import type { DeleteOutcome } from '../interfaces/InterractionCallbacks'
import type { Node } from '../Node'
import { createEdgeEditModal } from '../ui/elements/modals/editEdgeModal/EditEdgeModal'
import { createNodeEditModal } from '../ui/elements/modals/editNodeModal/EditNodeModal'
import { runDeleteRequest, type DeleteRequest } from './DeleteRequest'
import { EdgeEditSession } from './EdgeEditSession'
import { GraphConnectManager } from './GraphConnectManager'
import { NodeEditSession } from './NodeEditSession'
import { runNodeCreateRequest, type NodeCreateRequest } from './NodeCreateRequest'

/**
 * Handles graph editing sessions.
 *
 * Responsible for:
 * - creating sessions
 * - tracking active sessions
 * - preventing duplicate sessions
 * - routing user-initiated deletes through the before-delete hook
 */
export class GraphEditingManager {
    public readonly graph: Graph
    public readonly connectManager: GraphConnectManager

    /**
     * Active node edit sessions indexed by node id.
     */
    private readonly nodeSessions = new Map<string | number, NodeEditSession>()

    /**
     * Active edge edit sessions indexed by edge id.
     */
    private readonly edgeSessions = new Map<string, EdgeEditSession>()

    /** True while an async before-delete decision is in flight — locks out new requests. */
    private deleting = false

    /** True while an async before-create decision is in flight — locks out new requests. */
    private creatingNode = false

    constructor(graph: Graph) {
        this.graph = graph
        this.connectManager = new GraphConnectManager(this.graph)
    }

    /**
     * Perform a **user-initiated** delete, gated by
     * {@link InterractionCallbacks.onBeforeDelete}. Every delete affordance routes
     * through here; programmatic `graph.removeNode()` / `removeEdge()` does not, and
     * is never gated.
     *
     * A second request is ignored while an async decision is pending, so a
     * double-click can't delete twice or re-enter the consumer's hook.
     *
     * @returns what was actually removed — `accepted: false` when the hook vetoed, so
     * the caller can leave its selection intact.
     */
    public async requestDelete(request: DeleteRequest): Promise<DeleteOutcome> {

        if (this.deleting) return { accepted: false, nodes: [], edges: [], notes: [] }

        this.deleting = true
        try {
            return await runDeleteRequest(this.graph, request)
        } finally {
            this.deleting = false
        }
    }


    /**
     * Opens an edit session for a node.
     *
     * If a session already exists for this node,
     * the existing session is returned.
     */
    public openNodeSession(node: Node): NodeEditSession {
        const nodeId = node.id

        const existing = this.nodeSessions.get(nodeId)

        if (existing && existing.active) {
            return existing
        }

        const session = new NodeEditSession(this, node)

        this.nodeSessions.set(nodeId, session)

        // The modal invokes the handler to build its body — once, not twice.
        const customHandler = this.graph.getOptions().callbacks?.onNodeEdit

        createNodeEditModal(node, session, this.graph.UIManager, customHandler)

        return session
    }

    /**
     * Returns the active session for a node.
     */
    public getNodeSession(nodeId: string | number): NodeEditSession | undefined {
        return this.nodeSessions.get(nodeId)
    }

    /**
     * Opens an edit session for an edge, mirroring {@link openNodeSession}.
     *
     * If a session already exists for this edge, the existing session is returned.
     */
    public openEdgeSession(edge: Edge): EdgeEditSession {
        const existing = this.edgeSessions.get(edge.id)

        if (existing && existing.active) {
            return existing
        }

        const session = new EdgeEditSession(this, edge)

        this.edgeSessions.set(edge.id, session)

        // The callback hook wins over the static `editors.edgeEditor.render` option;
        // the modal invokes whichever it gets to build its body.
        const customHandler = this.graph.getOptions().callbacks?.onEdgeEdit
            ?? this.graph.UIManager.getOptions().editors?.edgeEditor?.render

        createEdgeEditModal(edge, session, this.graph.UIManager, customHandler)

        return session
    }

    /**
     * Returns the active session for an edge.
     */
    public getEdgeSession(edgeId: string): EdgeEditSession | undefined {
        return this.edgeSessions.get(edgeId)
    }

    /**
     * Closes and removes an edge session.
     *
     * Internal lifecycle method.
     */
    public closeEdgeSession(edgeId: string): void {
        this.edgeSessions.delete(edgeId)
    }

    /**
     * Create a node **interactively**, gated by
     * {@link InterractionCallbacks.onBeforeNodeCreate}. The affordances (Create ▸ Add
     * node, the canvas menu's "Add Node Here") route through here; programmatic
     * `graph.addNode()` does not, and is never gated.
     *
     * Without a hook this places a default, unnamed node — the tool still works, the
     * hook is what makes it carry real data. The new node is selected on success so
     * the Edit tool can act on it straight away.
     *
     * @returns the new node, or `null` when the hook vetoed.
     */
    public async requestNodeCreate(request: NodeCreateRequest): Promise<Node | null> {

        if (this.creatingNode) return null

        this.creatingNode = true
        try {
            return await runNodeCreateRequest(this.graph, request)
        } finally {
            this.creatingNode = false
        }
    }

    /**
     * Closes and removes a session.
     *
     * Internal lifecycle method.
     */
    public closeSession(nodeId: string | number): void {
        this.nodeSessions.delete(nodeId)
    }

    /**
     * Closes all active sessions.
     */
    public closeAllSessions(): void {
        for (const session of this.nodeSessions.values()) {
            session.active = false
        }
        for (const session of this.edgeSessions.values()) {
            session.active = false
        }

        this.nodeSessions.clear()
        this.edgeSessions.clear()
    }
}