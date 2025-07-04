import {
    forceSimulation as d3ForceSimulation,
    forceLink as d3ForceLink,
    forceManyBody as d3ForceManyBody,
    forceCenter as d3ForceCenter,
    forceCollide as d3ForceCollide,
    type ForceLink as d3ForceLinkType,
    type ForceManyBody as d3ForceManyBodyType,
    type ForceCenter as d3ForceCenterType,
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
import { TreeLayout } from './plugins/layout/Tree'


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

    layout: {
        type: 'force',
    },
}

export interface simulationForces {
    link: d3ForceLinkType<Node, Edge>,
    charge: d3ForceManyBodyType<Node>,
    center: d3ForceCenterType<Node>,
    collide: d3ForceCollideType<Node>,
}

export class Simulation {
    private simulation: d3Simulation<Node, undefined>
    private graph: Graph
    private canvas: HTMLElement | undefined
    private layout

    private animationFrameId: number | null = null
    private startSimulationTime: number = 0
    private engineRunning: boolean = false
    private dragInProgress: boolean = false

    private options: SimulationOptions

    private simulationForces: simulationForces

    constructor(graph: Graph, options: Partial<SimulationOptions> = {}) {
        this.graph = graph
        this.options = merge({}, DEFAULT_SIMULATION_OPTIONS, options)

        this.canvas = this.graph.renderer.getCanvas()
        if (!this.canvas) {
            throw new Error('Canvas element is not defined in the graph renderer.')
        }
        const canvasBCR = this.canvas.getBoundingClientRect()

        const simulationForces = Simulation.initSimulationForces(this.options, canvasBCR)
        this.simulation = simulationForces.simulation
        this.simulationForces = simulationForces.simulationForces

        if (this.options.layout?.type === 'tree') {
            this.layout = new TreeLayout(this.graph, this.simulation, this.simulationForces, this.options.layout)
        }
    }

    public static initSimulationForces(options: SimulationOptions, canvasBCR: DOMRect): {
        simulation: d3.Simulation<Node, undefined>,
        simulationForces: {
            link: d3ForceLinkType<Node, Edge>,
            charge: d3ForceManyBodyType<Node>,
            center: d3ForceCenterType<Node>,
            collide: d3ForceCollideType<Node>,
        }
    } {
        const simulationForces = {
            link: d3ForceLink() as d3ForceLinkType<Node, Edge>,
            charge: d3ForceManyBody(),
            center: d3ForceCenter(),
            collide: d3ForceCollide(),
        }

        const simulation = d3ForceSimulation<Node>()
            .force('link', simulationForces.link)
            .force('charge', simulationForces.charge)
            .force('center', simulationForces.center)
            .force('collide', simulationForces.collide)

        simulationForces.center
            .x(canvasBCR.width / 2)
            .y(canvasBCR.height / 2)
        simulationForces.link.distance(options.d3LinkDistance)
        if (options.d3LinkStrength) {
            simulationForces.link.strength(options.d3LinkStrength)
        }
        simulationForces.charge
            .strength(options.d3ManyBodyStrength)
            .theta(options.d3ManyBodyTheta)
        simulationForces.collide
            .radius(options.d3CollideRadius)
            .strength(options.d3CollideStrength)


        simulation.alphaMin(options.d3AlphaMin)
        simulation.alphaDecay(options.d3AlphaDecay)
        simulation.alphaTarget(0)
        simulation.velocityDecay(options.d3VelocityDecay)

        return {
            simulation: simulation,
            simulationForces: simulationForces,
        }
    }

    public update() {
        // Feed data to force-directed layout

        if (this.layout) {
            this.layout.update()
        }

        this.simulation
            .nodes(this.graph.getMutableNodes())

        const linkForce = this.simulation.force('link')
        if (linkForce) {
            (linkForce as d3ForceLinkType<Node, Edge>)
                .id((node: Node) => node.id)
                .links(this.graph.getMutableEdges())
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
            this.graph.tickUpdate()
        }
    }

    private async runSimulationWorker() {
        const canvasBCR = this.canvas?.getBoundingClientRect()
        if (!canvasBCR) return

        const nodes = this.graph.getMutableNodes()
        const nodesCopy = this.graph.getNodes()
        const edgesCopy = this.graph.getEdges()

        const onWorkerProgress = (progress: number) =>  {
            this.graph.updateLayoutProgress(progress)
        }

        const { nodes: updatedNodes } = await runSimulationInWorker(
            nodesCopy,
            edgesCopy,
            this.options,
            canvasBCR,
            onWorkerProgress
        )
        updatedNodes.forEach((updatedNode, i) => {
            nodes[i].x = updatedNode.x
            nodes[i].y = updatedNode.y
            
            if (updatedNode.fx)
                nodes[i].fx = updatedNode.fx
            if (updatedNode.fy)
                nodes[i].fy = updatedNode.fy
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

    public getForceSimulation(): typeof this.simulationForces {
        return this.simulationForces
    }
}
