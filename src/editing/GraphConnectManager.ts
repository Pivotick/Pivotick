import { Edge } from '../Edge'
import type { Graph } from '../Graph'
import type { GraphInteractionContext } from '../interfaces/GraphInteractions'
import { Node } from '../Node'
import { generateSafeDomId } from '../utils/ElementCreation'
import { EdgeCreationSession } from './EdgeCreationSession'

type Events = 'start_click_connection' | 'start' | 'stop'

export class GraphConnectManager {

    private graph: Graph

    private activeSession: EdgeCreationSession | null = null

    private listeners = {
        start_click_connection: new Set<() => void>(),
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

        this.cancel()
        this.activeSession = new EdgeCreationSession(this.graph, this)
        this.activeSession.start()

        this.listeners.start.forEach(cb => cb())
        this.listeners.start_click_connection.forEach(cb => cb())

        this.graph.renderer.getGraphInteraction().on('nodeClick', this.nodeClickCB)
    }

    public cancel(): void {

        this.activeSession?.cancel()
        this.listeners.stop.forEach(cb => cb())
        this.graph.renderer.getGraphInteraction().off('nodeClick', this.nodeClickCB)
        this.activeSession = null
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
}