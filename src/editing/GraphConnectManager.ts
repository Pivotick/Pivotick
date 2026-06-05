import { Edge } from '../Edge'
import type { Graph } from '../Graph'
import type { GraphInteractionContext } from '../interfaces/GraphInteractions'
import { Node } from '../Node'
import { generateSafeDomId } from '../utils/ElementCreation'
import { EdgeCreationSession } from './EdgeCreationSession'

type Events = 'start' | 'stop'

export class GraphConnectManager {

    private graph: Graph

    private activeSession: EdgeCreationSession | null = null
    private modeActive = false

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

    public startClickConnection(): void {

        if (this.modeActive) return

        this.modeActive = true

        this.activeSession = new EdgeCreationSession(this.graph, this)
        this.activeSession.start()

        this.graph.simulation.disable()

        this.listeners.start.forEach(cb => cb())

        this.graph.renderer.getGraphInteraction().on('nodeClick', this.nodeClickCB)
        this.graph.renderer.getGraphInteraction().on('nodePointerDown', this.nodePointerDownCB)
    }

    public cancel(): void {
        this.exitClickConnectionMode()
    }

    public restart(): void {

        if (!this.modeActive) {
            this.startClickConnection()
            return
        }

        this.finishInteraction()
    }

    public finishInteraction(): void {
        this.activeSession?.cancel()
        this.activeSession = new EdgeCreationSession(this.graph, this)
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
    }

    private resetSession(): void {
        this.activeSession?.cancel()
        this.activeSession = new EdgeCreationSession(this.graph, this)
        this.activeSession.start()
    }

    public isActive(): boolean {

        return this.activeSession !== null
    }

    public handleNodeClick(node: Node): boolean {

        if (!this.activeSession) {
            return false
        }

        return this.activeSession
            .handleNodeClick(node)
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private nodeClickCB = (_event: any, node: Node, _element: any, context: GraphInteractionContext) => {
        if (!this.activeSession) {
            return false
        }

        context.cancel()

        this.handleNodeClick(node)
    }

    private nodePointerDownCB = (event: PointerEvent, node: Node) => {

        if (!this.activeSession) {
            return
        }

        this.activeSession.beginDragConnection(node, event)
    }
}