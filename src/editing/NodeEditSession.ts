import type { Node, NodeData } from '../Node'
import type { GraphEditingManager } from './GraphEditingManager'

/**
 * Represents an active node editing session.
 *
 * A session contains:
 * - the original node
 * - a mutable draft copy of the node data
 * - lifecycle methods to commit or cancel changes
 */
export class NodeEditSession {
    /**
     * The node being edited.
     */
    public readonly node: Node

    /**
     * Snapshot of the original node data when the session started.
     */
    public readonly originalData: NodeData

    /**
     * Mutable draft data.
     *
     * Consumers can either mutate this object directly
     * or replace it via `setDraft`.
     */
    public draft: NodeData

    /**
     * Whether the session is still active.
     */
    public active = true

    private readonly manager: GraphEditingManager

    constructor(manager: GraphEditingManager, node: Node) {
        this.manager = manager
        this.node = node

        const data = node.getData()

        /**
         * Shallow clone is intentional here.
         * Deep cloning can become expensive and opinionated.
         *
         * Consumers storing nested mutable structures
         * should handle cloning themselves.
         */
        this.originalData = { ...data }
        this.draft = { ...data }
    }

    /**
     * Replaces the current draft.
     */
    public setDraft(next: NodeData): void {
        this.ensureActive()
        this.draft = next
    }

    /**
     * Commits the draft data to the node.
     */
    public commit(): void {
        this.ensureActive()

        this.node.setData(this.draft)

        this.active = false

        this.manager.closeSession(this.node.id)
    }

    /**
     * Cancels the edit session.
     *
     * No data is written to the node.
     */
    public cancel(): void {
        this.ensureActive()

        this.active = false

        this.manager.closeSession(this.node.id)
    }

    private ensureActive(): void {
        if (!this.active) {
            throw new Error('This edit session is no longer active.')
        }
    }
}