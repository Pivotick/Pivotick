import { Edge } from '../Edge'
import type { Graph } from '../Graph'
import type { GraphInteractionContext } from '../interfaces/GraphInteractions'
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
        start: new Set<() => void>(),
        stop: new Set<() => void>(),
    }
    

    public constructor(graph: Graph) {

        this.graph = graph
    }

    public on(event: Events, callback: () => void): void {

        this.listeners[event].add(callback)
    }

    public off(event: Events, callback: () => void): void {

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

        this.graph.simulation.disable()

        this.listeners.start.forEach(cb => cb())
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
        if (!continueInteraction) return

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

        this.graph.simulation.enable()

        this.activeSession?.cancel()
        this.activeSession = null

        this.listeners.stop.forEach(cb => cb())

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

    public selectOrConnectNode(node: Node): boolean {

        if (!this.activeSession) {
            return false
        }

        return this.activeSession.selectOrConnectNode(node)
    }

    public createEdge(source: Node, target: Node): void {

        const exists = this.graph
            .getEdges()
            .some(edge =>
                edge.source.id === source.id &&
                edge.target.id === target.id
            )

        if (exists) return

        const edgeID = generateSafeDomId(8, 'edge-')
        const edge = new Edge(edgeID, source, target, {})
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

        context.cancel()
        this.selectOrConnectNode(node)
    }

    private nodePointerDownCB = (event: PointerEvent, node: Node) => {

        if (!this.activeSession) {
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