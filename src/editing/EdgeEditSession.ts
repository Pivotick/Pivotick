import type { Edge, EdgeData } from '../Edge'
import type { GraphEditingManager } from './GraphEditingManager'

/**
 * Represents an active edge editing session — the edge twin of
 * {@link NodeEditSession}.
 *
 * A session contains:
 * - the original edge
 * - a mutable draft copy of the edge data
 * - lifecycle methods to commit or cancel changes
 */
export class EdgeEditSession {
    /**
     * The edge being edited.
     */
    public readonly edge: Edge

    /**
     * Snapshot of the original edge data when the session started.
     */
    public readonly originalData: EdgeData

    /**
     * Mutable draft data.
     *
     * Consumers can either mutate this object directly
     * or replace it via `setDraft`.
     */
    public draft: EdgeData

    /**
     * Whether the session is still active.
     */
    public active = true

    private readonly manager: GraphEditingManager

    constructor(manager: GraphEditingManager, edge: Edge) {
        this.manager = manager
        this.edge = edge

        const data = edge.getData()

        /**
         * Shallow clone, as in {@link NodeEditSession}: deep cloning is expensive
         * and opinionated, so consumers storing nested mutable structures clone
         * those themselves.
         */
        this.originalData = { ...data }
        this.draft = { ...data }
    }

    /**
     * Replaces the current draft.
     */
    public setDraft(next: EdgeData): void {
        this.ensureActive()
        this.draft = next
    }

    /**
     * Commits the draft data to the edge.
     *
     * With no `onBeforeEdgeEditCommit` hook the draft is written straight through.
     * With one, the hook decides — and a refusal leaves the edge's data untouched so
     * the user can correct the form and retry.
     *
     * @returns whether the commit went through.
     */
    public async commit(): Promise<boolean> {
        this.ensureActive()

        const previousData = this.edge.getData()
        const nextData = this.draft

        const callback = this.manager.graph.getOptions().callbacks?.onBeforeEdgeEditCommit

        if (callback) {
            const accepted = await callback({
                edge: this.edge,
                previousData,
                nextData,
                session: this,
            })

            if (accepted === false) return false
        }

        this.edge.setData(nextData)
        // Announce it on the data bus (`edgeChange` + a `dataBatchChanged` entry), then
        // repaint — the label and tooltip read straight off the edge's data.
        this.manager.graph.edgeDataChanged(this.edge, previousData, nextData)
        this.manager.graph.renderer.update(true)
        this.active = false
        this.manager.closeEdgeSession(this.edge.id)
        return true
    }

    /**
     * Cancels the edit session.
     *
     * No data is written to the edge.
     */
    public cancel(): void {
        this.ensureActive()

        this.manager.graph.getOptions().callbacks?.onEdgeEditCancel?.(this.edge)
        this.active = false

        this.manager.closeEdgeSession(this.edge.id)
    }

    private ensureActive(): void {
        if (!this.active) {
            throw new Error('This edit session is no longer active.')
        }
    }
}
