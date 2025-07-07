import type { Graph } from '../../Graph'
import type { GraphInteractions } from '../../GraphInteractions'
import type { GraphCanvasRenderer } from './GraphCanvasRenderer'

export class EventHandler {
    private graph: Graph
    private renderer!: GraphCanvasRenderer
    private graphInteraction!: GraphInteractions<CanvasRenderingContext2D>

    constructor(graph: Graph) {
        this.graph = graph
    }

    public init(renderer: GraphCanvasRenderer, graphInteraction: GraphInteractions<CanvasRenderingContext2D>): void {
        this.renderer = renderer
        this.graphInteraction = graphInteraction

        this.registerListeners()
    }

    public registerListeners(): void {
    }
}