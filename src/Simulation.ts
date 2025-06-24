import {
    forceSimulation as d3ForceSimulation,
    forceLink as d3ForceLink,
    type ForceLink as d3ForceLinkType,
    forceManyBody as d3ForceManyBody,
    forceCenter as d3ForceCenter,
    forceCollide as d3ForceCollide,
} from 'd3-force'
import { type Simulation as d3Simulation } from 'd3-force'
import { drag as d3Drag } from 'd3-drag'
import type { Graph } from './Graph'
import type { Node } from './Node'
import type { Edge } from './Edge'
import type { SimulationOptions } from './GraphOptions'
import merge from 'lodash.merge'


const DEFAULT_SIMULATION_OPTIONS: SimulationOptions = {
    d3Alpha: 1.0,
    d3AlphaMin: 0,
    d3AlphaDecay: 0.05,
    d3AlphaTarget: 0.3,
    d3VelocityDecay: 0.5,
    d3LinkDistance: 0,
    d3LinkStrength: 1,
    d3ManyBodyStrength: -50,
    d3ManyBodyTheta: 0.9,
    d3CollideRadius: 12,
    d3CollideStrength: 1,
    d3CollideIterations: 1,

    cooldownTime: 2000,
    warmupTicks: 50,
}

export class Simulation {
    private simulation: d3Simulation<Node, undefined>
    private graph: Graph
    private canvas: SVGSVGElement | undefined

    private animationFrameId: number | null = null
    private startSimulationTime: number = 0
    private engineRunning: boolean = false

    private options: SimulationOptions

    private forceSimulation = {
        link: d3ForceLink(),
        charge: d3ForceManyBody(),
        center: d3ForceCenter(),
        collide: d3ForceCollide(),
    }

    constructor(graph: Graph, options?: Partial<SimulationOptions>) {
        this.graph = graph
        this.options = merge({}, DEFAULT_SIMULATION_OPTIONS, options)

        this.canvas = this.graph.renderer.getCanvas()
        const canvasBCR = this.canvas.getBoundingClientRect()

        this.simulation = d3ForceSimulation<Node>()
            .force('link', this.forceSimulation.link)
            .force('charge', this.forceSimulation.charge)
            .force('center', this.forceSimulation.center)
            .force('collide', this.forceSimulation.collide)

        this.forceSimulation.center
            .x(canvasBCR.width / 2)
            .y(canvasBCR.height / 2)
        this.forceSimulation.link.distance(this.options.d3LinkDistance)
        if (this.options.d3LinkStrength) {
            this.forceSimulation.link.strength(this.options.d3LinkStrength)
        }
        this.forceSimulation.charge
            .strength(this.options.d3ManyBodyStrength) 
            .theta(this.options.d3ManyBodyTheta)
        this.forceSimulation.collide
            .radius(this.options.d3CollideRadius)
            .strength(this.options.d3CollideStrength)


        this.simulation.alphaMin(this.options.d3AlphaMin)
        this.simulation.alphaDecay(this.options.d3AlphaDecay)
        this.simulation.alphaTarget(this.options.d3AlphaTarget)
        this.simulation.velocityDecay(this.options.d3VelocityDecay)
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
    public start() {
        this.simulation.tick(this.options.warmupTicks)
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
        this.simulation.alpha(this.options.d3Alpha).restart()
        this.animationFrameId = requestAnimationFrame(animate)
    }

    /**
     * Evaluate at each tick to update the simulation state and request rendering
     */
    private simulationTick() {
        
        if (this.engineRunning) {
            if (
                (new Date()).getTime() - this.startSimulationTime > this.options.cooldownTime ||
                this.options.d3AlphaMin > 0 && this.simulation.alpha() < this.options.d3AlphaMin
            ) {
                this.engineRunning = false
                this.simulation.stop()
            }
            this.simulation.tick()
            this.graph.updatePositions()
        }
    }

    public createDragBehavior() {
        return d3Drag<SVGGElement, Node>()
            .on('start', (event, d) => {
                if (!event.active) {
                    this.restart()
                    this.simulation
                        .alphaTarget(this.options.d3AlphaTarget)
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
                    this.restart()
                    this.simulation
                        .alphaTarget(0)
                        .restart()
                }
                d.fx = undefined
                d.fy = undefined
            })
    }
}
