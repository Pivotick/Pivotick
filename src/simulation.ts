import {
    forceSimulation as d3ForceSimulation,
    forceLink as d3ForceLink,
    forceManyBody as d3ForceManyBody,
    forceCenter as d3ForceCenter
} from 'd3-force';
import type { Graph } from './graph';
import type { Node } from './node';
import type { Edge } from './edge';


interface SimulationOptions {
    /**
     * Gets or sets the minimum alpha value for the simulation.
     * The simulation’s internal timer stops when the current alpha falls below this value.
     * Must be in the range [0, 1].
     * @default 0.001
     */
    d3AlphaMin: number;

}

const DEFAULT_SIMULATION_OPTIONS: SimulationOptions = {
    d3AlphaMin: 0.001,
}

export class Simulation {
    private simulation: d3.Simulation<Node, undefined>
    private graph: Graph
    private canvas: SVGSVGElement | undefined

    private animationFrameId: number | null = null
    private engineRunning: boolean = false

    private options: SimulationOptions

    constructor(graph: Graph, options?: Partial<SimulationOptions>) {
        this.graph = graph
        this.options = {
            ...DEFAULT_SIMULATION_OPTIONS,
            ...options,
        }

        this.canvas = this.graph.renderer.getCanvas()
        const canvasBCR = this.canvas.getBoundingClientRect()

        this.simulation = d3ForceSimulation<Node>()
            .force('link', d3ForceLink())
            .force('charge', d3ForceManyBody())
            .force('center', d3ForceCenter(canvasBCR.width / 2, canvasBCR.height / 2))

    }

    update() {
        // Feed data to force-directed layout
        this.simulation
            .nodes(this.graph.getNodes())

        // add links (if link force is still active)
        const linkForce = this.simulation.force('link');
        if (linkForce) {
            (linkForce as d3.ForceLink<Node, Edge>)
                .id((node) => node.id)
                .links(this.graph.getEdges())
        }

        this.start()
    }

    /**
     * Start the simulation with rendering on each animation frame.
     */
    start() {
        const animate = () => {

            if (this.engineRunning) {
                if (this.simulation.alpha() < this.options.d3AlphaMin) {
                    this.engineRunning = false
                    this.simulation.stop()
                }
                this.animationFrameId = requestAnimationFrame(animate)
                this.simulation.tick()
                this.graph.render()
            }
        }

        this.engineRunning = true
        this.simulation.alpha(1).restart()

        animate()
    }

    /**
     * Manually stop the simulation and cancel animation frame.
     */
    stop() {
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null
        }
        this.simulation.stop()
    }

    /**
     * Manually step the simulation (for external control/testing).
     */
    tick(n: number = 1) {
        for (let i = 0; i < n; i++) {
            this.simulation.tick()
        }
    }
}
