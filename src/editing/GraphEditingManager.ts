import type { Graph } from '../Graph'
import type { Node } from '../Node'
import { createNodeEditModal } from '../ui/elements/modals/editNodeModal/EditNodeModal'
import { GraphConnectManager } from './GraphConnectManager'
import { NodeEditSession } from './NodeEditSession'

/**
 * Handles graph editing sessions.
 *
 * Responsible for:
 * - creating sessions
 * - tracking active sessions
 * - preventing duplicate sessions
 */
export class GraphEditingManager {
    public readonly graph: Graph
    public readonly connectManager: GraphConnectManager

    /**
     * Active node edit sessions indexed by node id.
     */
    private readonly nodeSessions = new Map<string | number, NodeEditSession>()

    constructor(graph: Graph) {
        this.graph = graph
        this.connectManager = new GraphConnectManager(this.graph)
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

        const customHandler = this.graph.getOptions().callbacks?.onNodeEdit

        this.graph.getOptions().callbacks?.onNodeEdit?.(session)
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

        this.nodeSessions.clear()
    }
}