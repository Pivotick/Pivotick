import {
    forceSimulation as d3ForceSimulation,
    forceLink as d3ForceLink,
    type ForceLink as d3ForceLinkType,
    forceManyBody as d3ForceManyBody,
    type ForceManyBody as d3ForceManyBodyType,
    forceCenter as d3ForceCenter,
    type ForceCenter as d3ForceCenterType,
    forceCollide as d3ForceCollide,
    type ForceCollide as d3ForceCollideType,
} from 'd3-force'
import { type Simulation as d3Simulation } from 'd3-force'
import { drag as d3Drag } from 'd3-drag'
import type { Graph } from './Graph'
import type { Node } from './Node'
import type { Edge } from './Edge'
import type { SimulationOptions } from './GraphOptions'
import { runSimulationInWorker } from './SimulationWorkerWrapper'
import merge from 'lodash.merge'


const DEFAULT_SIMULATION_OPTIONS: SimulationOptions = {
    d3Alpha: 1.0,
    d3AlphaMin: 0.001,
    d3AlphaDecay: 0.05,
    d3AlphaTarget: 0.0,
    d3VelocityDecay: 0.45,
    d3LinkDistance: 40,
    d3LinkStrength: 1,
    d3ManyBodyStrength: -150,
    d3ManyBodyTheta: 0.9,
    d3CollideRadius: 12,
    d3CollideStrength: 1,
    d3CollideIterations: 1,

    cooldownTime: 2000,
    warmupTicks: 'auto',
}

export class Simulation {
    private simulation: d3Simulation<Node, undefined>
    private graph: Graph
    private canvas: SVGSVGElement | undefined

    private animationFrameId: number | null = null
    private startSimulationTime: number = 0
    private engineRunning: boolean = false
    private dragInProgress: boolean = false

    private options: SimulationOptions

    private forceSimulation: {
        link: d3ForceLinkType<Node, Edge>,
        charge: d3ForceManyBodyType<Node>,
        center: d3ForceCenterType<Node>,
        collide: d3ForceCollideType<Node>,
    }

    constructor(graph: Graph, options?: Partial<SimulationOptions>) {
        this.graph = graph
        this.options = merge({}, DEFAULT_SIMULATION_OPTIONS, options)

        this.canvas = this.graph.renderer.getCanvas()
        const canvasBCR = this.canvas.getBoundingClientRect()

        const simulationForces = Simulation.initSimulationForces(this.options, canvasBCR)
        this.simulation = simulationForces.simulation
        this.forceSimulation = simulationForces.forceSimulation
    }

    public static initSimulationForces(options: SimulationOptions, canvasBCR: DOMRect): {
        simulation: d3.Simulation<Node, undefined>,
        forceSimulation: {
            link: d3ForceLinkType<Node, Edge>,
            charge: d3ForceManyBodyType<Node>,
            center: d3ForceCenterType<Node>,
            collide: d3ForceCollideType<Node>,
        }
    } {
        const forceSimulation = {
            link: d3ForceLink() as d3ForceLinkType<Node, Edge>,
            charge: d3ForceManyBody(),
            center: d3ForceCenter(),
            collide: d3ForceCollide(),
        }

        const simulation = d3ForceSimulation<Node>()
            .force('link', forceSimulation.link)
            .force('charge', forceSimulation.charge)
            .force('center', forceSimulation.center)
            .force('collide', forceSimulation.collide)

        forceSimulation.center
            .x(canvasBCR.width / 2)
            .y(canvasBCR.height / 2)
        forceSimulation.link.distance(options.d3LinkDistance)
        if (options.d3LinkStrength) {
            forceSimulation.link.strength(options.d3LinkStrength)
        }
        forceSimulation.charge
            .strength(options.d3ManyBodyStrength)
            .theta(options.d3ManyBodyTheta)
        forceSimulation.collide
            .radius(options.d3CollideRadius)
            .strength(options.d3CollideStrength)


        simulation.alphaMin(options.d3AlphaMin)
        simulation.alphaDecay(options.d3AlphaDecay)
        simulation.alphaTarget(0)
        simulation.velocityDecay(options.d3VelocityDecay)

        return {
            simulation: simulation,
            forceSimulation: forceSimulation,
        }
    }

    public update() {
        // Feed data to force-directed layout
        this.simulation
            .nodes(this.graph.getNodes())

        const linkForce = this.simulation.force('link')
        if (linkForce) {
            (linkForce as d3ForceLinkType<Node, Edge>)
                .id((node) => node.id)
                .links(this.graph.getEdges())
        }

        this.restart()
    }

    /**
     * Restart the simulation with rendering on each animation frame.
     */
    public restart() {
        this.startSimulationTime = (new Date()).getTime()
        this.engineRunning = true
    }

    /**
     * Start the simulation with rendering on each animation frame.
     */
    public async start() {
        await this.runSimulationWorker()
        this.engineRunning = true
        if (this.animationFrameId === null) {
            this.startAnimationLoop()
        }
    }

    /**
     * Manually stop the simulation and cancel animation frame.
     */
    public stop() {
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId)
            this.animationFrameId = null
        }
        this.simulation.stop()
    }

    /**
     * Start the simulation loop with rendering on each animation frame.
     */
    private startAnimationLoop() {
        const animate = () => {
            this.animationFrameId = requestAnimationFrame(animate)
            this.simulationTick()
        }

        this.engineRunning = true
        this.simulation.alpha(0.01).restart()
        this.animationFrameId = requestAnimationFrame(animate)
    }

    /**
     * Evaluate at each tick to update the simulation state and request rendering
     */
    private simulationTick() {
        
        if (this.engineRunning) {
            if (
                !this.dragInProgress &&
                (
                    (new Date()).getTime() - this.startSimulationTime > this.options.cooldownTime ||
                    this.options.d3AlphaMin > 0 && this.simulation.alpha() < this.options.d3AlphaMin
                )
            ) {
                this.engineRunning = false
                this.simulation.stop()
            }
            this.simulation.tick()
            this.graph.updatePositions()
        }
    }

    private async runSimulationWorker() {
        const canvasBCR = this.canvas?.getBoundingClientRect()
        if (!canvasBCR) return

        const nodes = this.graph.getNodes()
        const edges = this.graph.getEdges()

        const onWorkerProgress = (progress: number) =>  {
            this.graph.updateLayoutProgress(progress)
        }

        const { nodes: updatedNodes, edges: updatedEdges } = await runSimulationInWorker(
            nodes,
            edges,
            this.options,
            canvasBCR,
            onWorkerProgress
        )
        updatedNodes.forEach((updatedNode, i) => {
            nodes[i].x = updatedNode.x
            nodes[i].y = updatedNode.y
        })
        this.graph.updateData(nodes)
    }

    public createDragBehavior() {
        return d3Drag<SVGGElement, Node>()
            .on('start', (event, d) => {
                if (!event.active) {
                    this.dragInProgress = true
                    this.restart()
                    this.simulation
                        .alphaTarget(0.3)
                        .restart()
                }
                d.fx = d.x
                d.fy = d.y
            })
            .on('drag', (event, d) => {
                d.fx = event.x
                d.fy = event.y
            })
            .on('end', (event, d) => {
                if (!event.active) {
                    this.dragInProgress = false
                    this.restart()
                    this.simulation
                        .alphaTarget(this.options.d3AlphaTarget)
                        .restart()
                }
                d.fx = undefined
                d.fy = undefined
            })
    }
}
