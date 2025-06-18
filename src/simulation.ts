import {
    forceSimulation as d3ForceSimulation,
    forceLink as d3ForceLink,
    type ForceLink as d3ForceLinkType,
    forceManyBody as d3ForceManyBody,
    forceCenter as d3ForceCenter
} from 'd3-force';
import { type Simulation as d3Simulation } from 'd3-force'
import { drag as d3Drag } from 'd3-drag';
import type { Graph } from './graph';
import type { Node } from './node';
import type { Edge } from './edge';


interface SimulationOptions {
    /** @default 0.001 */
    d3AlphaMin: number;
    /** @default 0.0228 */
    d3AlphaDecay: number;
    /** @default 0 */
    d3AlphaTarget: number;
    /** @default 0.4 */
    d3VelocityDecay: number;

}

const DEFAULT_SIMULATION_OPTIONS: SimulationOptions = {
    d3AlphaMin: 0.001,
    d3AlphaDecay: 0.0228,
    d3AlphaTarget: 0,
    d3VelocityDecay: 0.4,
}

export class Simulation {
    private simulation: d3Simulation<Node, undefined>
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

        this.simulation.alphaMin(this.options.d3AlphaMin)
        this.simulation.alphaDecay(this.options.d3AlphaDecay)
        this.simulation.alphaTarget(this.options.d3AlphaTarget)
        this.simulation.velocityDecay(this.options.d3VelocityDecay)

    }

    update() {
        // Feed data to force-directed layout
        this.simulation
            .nodes(this.graph.getNodes())

        // add links (if link force is still active)
        const linkForce = this.simulation.force('link');
        if (linkForce) {
            (linkForce as d3ForceLinkType<Node, Edge>)
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
            this.animationFrameId = requestAnimationFrame(animate)
            this.simulationTick()
        }

        this.engineRunning = true
        this.simulation.alpha(1).restart()
        this.animationFrameId = requestAnimationFrame(animate)

        animate()
    }

    /**
     * Evaluate at each tick to update the simulation state and request rendering
     */
    simulationTick() {
        if (this.engineRunning) {
            if (this.simulation.alpha() < this.options.d3AlphaMin) {
                this.engineRunning = false
                this.simulation.stop()
            }
            this.simulation.tick()
            this.graph.render()
        }
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

    createDragBehavior() {
        return d3Drag<SVGCircleElement, Node>()
            .on('start', (event, d) => {
                if (!event.active) {
                    this.start()
                    this.simulation.alphaTarget(0.3);
                }
                d.fx = d.x;
                d.fy = d.y;
            })
            .on('drag', (event, d) => {
                d.fx = event.x;
                d.fy = event.y;
            })
            .on('end', (event, d) => {
                if (!event.active) {
                    this.start()
                    this.simulation.alphaTarget(0);
                }
                d.fx = undefined;
                d.fy = undefined;
            });
    }
}
