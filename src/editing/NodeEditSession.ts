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
     *
     * With no `onBeforeNodeEditCommit` hook the draft is written straight through.
     * With one, userland owns validation / persistence — and a refusal leaves the
     * node's data untouched so the user can correct the form and retry.
     *
     * @returns whether the commit went through.
     */
    public async commit(): Promise<boolean> {
        this.ensureActive()

        const graph = this.manager.graph
        const previousData = this.node.getData()
        const nextData = this.draft

        const callback = graph.getOptions().callbacks?.onBeforeNodeEditCommit

        if (callback) {
            const accepted = await callback({
                node: this.node,
                previousData,
                nextData,
                session: this,
            })

            if (accepted === false) return false
        }

        this.node.setData(nextData)
        // Announce it on the data bus (`nodeChange` + a `dataBatchChanged` entry), then
        // repaint: `update` re-renders the node, `nextTickFor` places what it drew.
        graph.nodeDataChanged(this.node, previousData, nextData)
        graph.renderer.update(true)
        graph.nextTickFor([this.node])
        // Re-select so the sidebar's panels re-read the node they are showing.
        graph.renderer.getGraphInteraction().selectNode(this.node.getGraphElement(), this.node)
        this.active = false
        this.manager.closeSession(this.node.id)
        return true
    }

    /**
     * Cancels the edit session.
     *
     * No data is written to the node.
     */
    public cancel(): void {
        this.ensureActive()

        this.manager.graph.getOptions().callbacks?.onNodeEditCancel?.(this.node)
        this.active = false

        this.manager.closeSession(this.node.id)
    }

    private ensureActive(): void {
        if (!this.active) {
            throw new Error('This edit session is no longer active.')
        }
    }
}