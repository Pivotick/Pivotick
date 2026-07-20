import { Edge, type EdgeData } from '../Edge'
import type { Graph } from '../Graph'
import type { GraphInteractionContext } from '../interfaces/GraphInteractions'
import type { PartialEdgeFullStyle } from '../interfaces/RendererOptions'
import { Node } from '../Node'
import { Note } from '../Note'
import { generateSafeDomId } from '../utils/ElementCreation'
import { EdgeCreationSession, type ConnectionMode } from './EdgeCreationSession'

type Events = 'start' | 'stop'

export class GraphConnectManager {

    private graph: Graph

    private activeSession: EdgeCreationSession | null = null
    private modeActive = false
    private deferUIActivation = false
    private currentMode: ConnectionMode | null = null

    private listeners = {
        start: new Set<(connectManager: GraphConnectManager) => void>(),
        stop: new Set<(connectManager: GraphConnectManager) => void>(),
    }
    

    public constructor(graph: Graph) {

        this.graph = graph
    }

    public on(event: Events, callback: (connectManager: GraphConnectManager) => void): void {

        this.listeners[event].add(callback)
    }

    public off(event: Events, callback: (connectManager: GraphConnectManager) => void): void {

        this.listeners[event].delete(callback)
    }

    public startClickConnection(deferUI = false): void {

        this.deferUIActivation = deferUI
        if (this.modeActive) return

        this.modeActive = true

        this.activeSession = new EdgeCreationSession(
            this.graph,
            this,
            this.currentMode!,
            !this.deferUIActivation
        )
        this.activeSession.start()

        if (this.currentMode === 'node-edge') {
            this.graph.simulation.disable()
        }

        this.listeners.start.forEach(cb => cb(this))
    }

    public startNodeClickConnection(): void {

        this.currentMode = 'node-edge'
        this.exitClickConnectionMode()
        this.startClickConnection()

        this.graph.renderer.getGraphInteraction().on('nodeClick', this.nodeClickCB)
        this.graph.renderer.getGraphInteraction().on('nodePointerDown', this.nodePointerDownCB)
    }

    public startNoteClickConnection(): void {

        this.currentMode = 'note-link'
        this.exitClickConnectionMode()
        this.startClickConnection(true)

        this.graph.renderer.getGraphInteraction().on('nodeClick', this.nodeClickCB)

        this.graph.renderer.getGraphInteraction().on('noteHandleClick', this.noteHandleClickCB)
        this.graph.renderer.getGraphInteraction().on('noteHandlePointerDown', this.noteHandlePointerDownCB)
    }

    public cancel(): void {
        this.exitClickConnectionMode()
    }

    public restart(): void {

        if (!this.modeActive) {
            this.startClickConnection()
            return
        }

        this.finishInteraction(true)
    }

    public finishInteraction(continueInteraction = false): void {
        this.activeSession?.cancel()
        if (!continueInteraction) {
            this.activeSession = null
            return
        }

        this.activeSession = new EdgeCreationSession(
            this.graph,
            this,
            this.currentMode!,
            !this.deferUIActivation
        )
        this.activeSession.start()
    }

    public exitClickConnectionMode(): void {

        this.modeActive = false

        if (this.currentMode === 'node-edge') {
            this.graph.simulation.enable()
        }

        this.activeSession?.cancel()
        this.activeSession = null

        this.listeners.stop.forEach(cb => cb(this))

        this.graph.renderer.getGraphInteraction().off('nodeClick', this.nodeClickCB)
        this.graph.renderer.getGraphInteraction().off('nodePointerDown', this.nodePointerDownCB)

        this.graph.renderer.getGraphInteraction().off('noteHandleClick', this.noteHandleClickCB)
        this.graph.renderer.getGraphInteraction().off('noteHandlePointerDown', this.noteHandlePointerDownCB)
    }

    private resetSession(): void {
        this.activeSession?.cancel()
        this.activeSession = new EdgeCreationSession(
            this.graph,
            this,
            this.currentMode!,
            !this.deferUIActivation
        )
        this.activeSession.start()
    }

    public isActive(): boolean {

        return this.activeSession !== null
    }

    /**
     * True while `session` is still the live session of an active connect mode.
     * Async settle callbacks guard on this so a mode exited (Escape) or re-entered
     * while an `onBeforeEdgeCreate` decision was in flight isn't resurrected/disturbed.
     */
    public ownsSession(session: EdgeCreationSession): boolean {

        return this.modeActive && this.activeSession === session
    }

    public isActiveAndNotIdle(): boolean {

        return this.activeSession !== null && this.activeSession.getState() !== 'idle'
    }

    public getMode(): ConnectionMode | null {

        return this.currentMode
    }

    public selectOrConnectNode(node: Node): boolean {

        if (!this.activeSession) {
            return false
        }

        return this.activeSession.selectOrConnectNode(node)
    }

    /** True if a source→target edge already exists. Exposed so an `onBeforeEdgeCreate` hook can run its own duplicate policy. */
    public edgeExists(source: Node, target: Node): boolean {

        return this.graph
            .getEdges()
            .some(edge =>
                edge.source.id === source.id &&
                edge.target.id === target.id
            )
    }

    /**
     * Create a source→target edge.
     *
     * `decision` carries the (optional) data/style/id/direction resolved by the
     * `onBeforeEdgeCreate` hook in {@link EdgeCreationSession}; omitted on the
     * programmatic path, where the edge is created with defaults.
     *
     * By default a same-pair edge is treated as a duplicate and skipped — right
     * for the hook-less flow, where every connect yields an identical empty edge.
     * With `allowDuplicate` set (the session passes this when a hook is present)
     * the check is skipped, because once the consumer supplies data/labels a
     * second A→B edge is a legitimately distinct edge, not a duplicate — the
     * consumer owns that policy (see {@link edgeExists}).
     */
    public createEdge(
        source: Node,
        target: Node,
        decision?: { data?: EdgeData, style?: PartialEdgeFullStyle, id?: string, directed?: boolean | null },
        { allowDuplicate = false }: { allowDuplicate?: boolean } = {}
    ): void {

        if (!allowDuplicate && this.edgeExists(source, target)) return

        const edgeID = decision?.id ?? generateSafeDomId(8, 'edge-')
        const edge = new Edge(edgeID, source, target, decision?.data ?? {}, undefined, decision?.directed ?? null)
        // Apply the consumer's style overrides via the partial-merge API (the
        // constructor's `style` param expects a full style, not partial-at-both-levels).
        if (decision?.style) edge.updateStyle(decision.style)
        this.graph.addEdge(edge)
    }

    public createNoteLink(source: Note, target: Node): void {
        source.setAttachedElement({ type: 'node', 'id': target.id })
        this.graph.renderer.update(true)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private nodeClickCB = (_event: any, node: Node, _element: any, context: GraphInteractionContext) => {
        if (!this.activeSession) {
            return false
        }

        if (this.currentMode === 'note-link' && this.activeSession.getState() === 'idle') {
            return false
        }

        context.cancel()
        this.selectOrConnectNode(node)
    }

    private nodePointerDownCB = (event: PointerEvent, node: Node) => {

        if (!this.activeSession) {
            return
        }

        if (this.currentMode === 'note-link' && this.activeSession.getState() === 'idle') {
            return
        }

        this.activeSession.beginDragConnection(node, event)
    }

    private noteClick(note: Note): boolean {

        if (!this.activeSession) {
            return false
        }

        return this.activeSession.handleNoteClick(note)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private noteHandleClickCB = (_event: any, note: Note, _element: any, context: GraphInteractionContext) => {

        if (!this.activeSession) {
            return false
        }

        context.cancel()

        this.noteClick(note)
    }

    private noteHandlePointerDownCB = (
        event: PointerEvent,
        note: Note
    ) => {

        if (!this.activeSession) {
            return
        }

        this.activeSession.beginDragConnection(note, event)
    }
}