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
    type SimulationNodeDatum,
} from 'd3-force'
import { type Simulation as d3Simulation } from 'd3-force'
import { ForceGravity } from './plugins/d3Forces/ForceGravity'
import { drag as d3Drag } from 'd3-drag'
import type { Graph } from './Graph'
import type { Node } from './Node'
import type { Edge } from './Edge'
import { runSimulationInWorker } from './SimulationWorkerWrapper'
import merge from 'lodash.merge'
import { TreeLayout } from './plugins/layout/Tree'
import { edgeLabelGetter } from './utils/GraphGetters'
import type { DeepPartial } from './utils/utils'
import type { SimulationCallbacks, SimulationForces, SimulationOptions } from './interfaces/SimulationOptions'
import type { LayoutType, TreeLayoutOptions } from './interfaces/LayoutOptions'
import type { GraphInteractions } from './GraphInteractions'


export const DEFAULT_SIMULATION_OPTIONS: SimulationOptions = {
    d3Alpha: 1.0,
    d3AlphaMin: 0.001,
    d3AlphaDecay: 0.05,
    d3AlphaTarget: 0.0,
    d3VelocityDecay: 0.45,
    d3LinkDistance: 40,
    d3LinkStrength: null,
    d3ManyBodyStrength: -150,
    d3ManyBodyTheta: 0.9,
    d3CollideRadius: 12,
    d3CollideStrength: 1,
    d3CollideIterations: 1,
    d3CenterStrength: 1,
    d3GravityStrength: 0.01,

    cooldownTime: 2000,
    useWorker: true,
    warmupTicks: 'auto',
    freezeNodesOnDrag: true,
    
    layout: {
        type: 'force',
    },
    callbacks: {
        onInit: () => {},
        onStart: () => {},
        onStop: () => {},
        onTick: () => {},
    },
}

interface dragSelectionNode {
    node: Node,
    dx: number,
    dy: number,
}

export class Simulation {
    private simulation: d3Simulation<Node, undefined>
    private graph: Graph
    private canvas: HTMLElement | undefined
    private graphInteraction: GraphInteractions
    private layout

    private canvasBCR: DOMRect
    private animationFrameId: number | null = null
    private startSimulationTime: number = 0
    private engineRunning: boolean = false
    private dragInProgress: boolean = false
    private dragSelection: dragSelectionNode[] = []
    private totalTickCount: number = 0

    private options: SimulationOptions
    private callbacks: Partial<SimulationCallbacks>

    private simulationForces: SimulationForces
    private scaledForces: Record<string, number> = {
        d3ManyBodyStrength: DEFAULT_SIMULATION_OPTIONS.d3ManyBodyStrength,
        d3CollideStrength: DEFAULT_SIMULATION_OPTIONS.d3CollideStrength,
    }

    constructor(graph: Graph, options: Partial<SimulationOptions> = {}) {
        this.graph = graph
        this.options = merge({}, DEFAULT_SIMULATION_OPTIONS, options)
        this.callbacks = this.options.callbacks ?? {}

        this.canvas = this.graph.renderer.getCanvas()
        if (!this.canvas) throw new Error('Canvas element is not defined in the graph renderer.')
        this.canvasBCR = this.canvas.getBoundingClientRect()

        this.graphInteraction = this.graph.renderer.getGraphInteraction()
        if (!this.graphInteraction) throw new Error('Graph interaction is not available.')


        const simulationForces = Simulation.initSimulationForces(this.options, this.canvasBCR)
        this.simulation = simulationForces.simulation
        this.simulationForces = simulationForces.simulationForces
        this.scaledForces.d3ManyBodyStrength = this.options.d3ManyBodyStrength || DEFAULT_SIMULATION_OPTIONS.d3ManyBodyStrength
        this.scaledForces.d3CollideStrength = this.options.d3CollideStrength || DEFAULT_SIMULATION_OPTIONS.d3CollideStrength

        if (this.options.layout.type === 'tree') {
            this.layout = new TreeLayout(
                this.graph,
                this.simulation,
                this.simulationForces,
                this.options.layout.type === 'tree'
                    ? (this.options.layout as TreeLayoutOptions)
                    : undefined
            )
        } else {
            // this.scaleSimulationOptions()
        }

        if (this.callbacks.onInit) {
            this.callbacks.onInit(this)
        }
    }

    /** @private */
    public static initSimulationForces(options: SimulationOptions, canvasBCR: DOMRect): {
        simulation: d3.Simulation<Node, undefined>,
        simulationForces: {
            link: d3ForceLinkType<Node, Edge>,
            charge: d3ForceManyBodyType<Node>,
            center: d3ForceCenterType<Node>,
            collide: d3ForceCollideType<Node>,
            gravity: ForceGravity<Node>,
        }
    } {
        const simulationForces = {
            link: d3ForceLink() as d3ForceLinkType<Node, Edge>,
            charge: d3ForceManyBody(),
            center: d3ForceCenter(),
            collide: d3ForceCollide(),
            gravity: ForceGravity(),
        }

        const simulation = d3ForceSimulation<Node>()
            .force('link', simulationForces.link)
            .force('charge', simulationForces.charge)
            .force('center', simulationForces.center)
            .force('collide', simulationForces.collide)
            .force('gravity', simulationForces.gravity)

        simulationForces.center
            .x(0)
            .y(0)
            .strength(options.d3CenterStrength)

        simulationForces.gravity
            .x(canvasBCR.width / 2)
            .y(canvasBCR.height / 2)
            .strength((node) => {
                const n = node as Node
                const degree = n.degree() ?? 0
                return degree === 0 ? options.d3GravityStrength : 0
            })

        simulationForces.link.distance((d) => {
            const labelContent = edgeLabelGetter(d)
            if (!labelContent || labelContent === '') {
                return options.d3LinkDistance
            }
            const labelGuessedSize = labelContent.length * 10
            return Math.max(options.d3LinkDistance, labelGuessedSize)
        })
        if (options.d3LinkStrength) {
            simulationForces.link.strength(options.d3LinkStrength)
        }
        simulationForces.charge
            .theta(options.d3ManyBodyTheta)
            .strength((node: SimulationNodeDatum) => {
                const n = node as Node
                const baseStrength = options.d3ManyBodyStrength

                const radius = n.getCircleRadius()
                return baseStrength * (radius * radius) / 100
            })

        simulationForces.collide
            .radius((node: SimulationNodeDatum) => {
                const n = node as Node
                return n.getCircleRadius() ? 1.2 * n.getCircleRadius() : options.d3CollideRadius
            })
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
        } else {
            // this.scaleSimulationOptions()
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

    /** @private */
    public scaleSimulationOptions(): void {
        const scaled = Simulation.scaleSimulationOptions(this.options, this.canvasBCR, this.graph.getNodeCount())
        this.scaledForces.d3ManyBodyStrength = scaled.d3ManyBodyStrength ?? DEFAULT_SIMULATION_OPTIONS.d3ManyBodyStrength
        this.scaledForces.d3CollideStrength = scaled.d3CollideStrength ?? DEFAULT_SIMULATION_OPTIONS.d3CollideStrength
    }

    /** @private */
    public static scaleSimulationOptions(options: SimulationOptions, canvasBCR: DOMRect, nodeCount: number): Partial<SimulationOptions> {
        const density = nodeCount / (canvasBCR.width * canvasBCR.height)
        const scale = Math.min(2, 0.000075 / density) // or some other heuristic

        return {
            d3ManyBodyStrength: options.d3ManyBodyStrength * scale,
            d3CollideStrength: options.d3ManyBodyStrength * scale,
        }
    }

    /** @private */
    public applyScalledSimulationOptions(): void {
        this.simulationForces.charge.strength(this.options.d3ManyBodyStrength)
        this.simulationForces.collide.strength(this.options.d3CollideStrength)
    }

    /**
     * Pause the simulation
     */
    public pause() {
        this.engineRunning = false
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
        await this.runSimulationWorkerRouter()
        this.engineRunning = true
        if (this.callbacks.onStart) {
            this.callbacks.onStart(this)
        }
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
        if (this.callbacks.onStop) {
            this.callbacks.onStop(this)
        }
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
                if (this.callbacks.onStop) {
                    this.callbacks.onStop(this)
                }
            }
            this.totalTickCount++
            this.simulation.tick()
            this.graph.nextTick()
            if (this.callbacks.onTick) {
                this.callbacks.onTick(this)
            }
            this.graphInteraction.simulationTick()
            if (this.totalTickCount % 10 === 0) {
                this.graphInteraction.simulationSlowTick()
            }
        }
    }

    /**
     * Returns a promise that resolves when the simulation stops naturally.
     * Useful for performing actions (like fitAndCenter) after stabilization.
     */
    public waitForSimulationStop(): Promise<void> {
        return new Promise(resolve => {
            const originalOnStop = this.callbacks.onStop
            this.callbacks.onStop = (sim: Simulation) => {
                // Call original callback if it exists
                if (originalOnStop) originalOnStop(sim)
                // Restore original callback
                this.callbacks.onStop = originalOnStop
                // Resolve the promise
                resolve()
            }
        })
    }

    private async computeGraph(optionOverride: Partial<SimulationOptions> = {}) {
        const { runSimulation } = await import('./SimulationWorker')
        const canvasBCR = this.canvas?.getBoundingClientRect()
        if (!canvasBCR) return

        const nodes = this.graph.getMutableNodes()
        const nodesCopy = this.graph.getNodes().map((n: Node) => {
            n.fx = undefined
            n.fy = undefined
            return n
        })
        const edgesCopy = this.graph.getEdges()

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { callbacks, ...optionsWithoutCBs } = this.options
        Object.assign(optionsWithoutCBs, optionOverride)

        const { nodes: updatedNodes } = runSimulation(nodesCopy,
            edgesCopy,
            optionsWithoutCBs,
            canvasBCR)

        updatedNodes.forEach((updatedNode, i) => {
            nodes[i].x = updatedNode.x
            nodes[i].y = updatedNode.y

            if (updatedNode.fx) {
                nodes[i].fx = updatedNode.fx
            } else {
                nodes[i].fx = undefined
            }
            if (updatedNode.fy) {
                nodes[i].fy = updatedNode.fy
            } else {
                nodes[i].fy = undefined
            }
        })
        this.graph.updateData(nodes)
    }

    private async runSimulationWorkerRouter(optionOverride: Partial<SimulationOptions> = {}) {
        if (this.options.useWorker) {
            await this.runSimulationWorker(optionOverride)
        } else {
            this.graph.updateLayoutProgress(1, 0)
            await this.computeGraph(optionOverride)
        }
    }

    private async runSimulationWorker(optionOverride: Partial<SimulationOptions> = {}) {
        const canvasBCR = this.canvas?.getBoundingClientRect()
        if (!canvasBCR) return

        const nodes = this.graph.getMutableNodes()
        const nodesCopy = this.graph.getNodes().map((n: Node) => {
            n.fx = undefined
            n.fy = undefined
            return n
        })
        const edgesCopy = this.graph.getEdges()

        const onWorkerProgress = (progress: number, elapsedTime: number) => {
            this.graph.updateLayoutProgress(progress, elapsedTime)
        }

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { callbacks, ...optionsWithoutCBs } = this.options
        Object.assign(optionsWithoutCBs, optionOverride)

        const { nodes: updatedNodes } = await runSimulationInWorker(
            nodesCopy,
            edgesCopy,
            optionsWithoutCBs,
            canvasBCR,
            onWorkerProgress
        )
        updatedNodes.forEach((updatedNode, i) => {
            nodes[i].x = updatedNode.x
            nodes[i].y = updatedNode.y

            if (updatedNode.fx) {
                nodes[i].fx = updatedNode.fx
            } else {
                nodes[i].fx = undefined
            }
            if (updatedNode.fy) {
                nodes[i].fy = updatedNode.fy
            } else {
                nodes[i].fy = undefined
            }
        })
        this.graph.updateData(nodes)
    }

    /**
     * Restart the simulation with a bit of heat
     */
    public reheat(): void {
        this.restart()
        this.simulation
            .alpha(0.7)
            .restart()
    }

    /**
     * @private
     */
    public createDragBehavior() {
        return d3Drag<SVGGElement, Node>()
            .on('start', (_event, d) => {
                if (this.graphInteraction.hasActiveMultiselection()) {
                    this.dragSelection = this.graphInteraction.getSelectedNodes().map((nodeSelection) => {
                        const { node } = nodeSelection
                        node.freeze()
                        return {
                            node,
                            dx: node.x! - d.x!,
                            dy: node.y! - d.y!,
                        }
                    })
                } else {
                    this.dragSelection = []
                    d.freeze()
                }
            })
            .on('drag', (event, d) => {
                if (!this.dragInProgress) {
                    this.dragInProgress = true
                    this.restart()
                    this.simulation
                        .alphaTarget(0.3)
                        .restart()
                }
                if (this.graphInteraction.hasActiveMultiselection()) {
                    this.dragSelection.forEach(({ node, dx, dy }) => {
                        node.fx = event.x + dx
                        node.fy = event.y + dy
                    })
                } else {
                    d.fx = event.x
                    d.fy = event.y
                }
                this.graphInteraction.dragging(event.sourceEvent, event.subject)
            })
            .on('end', (event, d) => {
                if (!event.active) {
                    this.dragInProgress = false
                    this.restart()
                    this.simulation
                        .alphaTarget(this.options.d3AlphaTarget)
                        .restart()
                }
                if (!this.options.freezeNodesOnDrag) {
                    if (this.graphInteraction.hasActiveMultiselection()) {
                        this.dragSelection.forEach(({ node }) => node.unfreeze())
                        this.dragSelection = []
                    } else {
                        d.unfreeze()
                    }
                }
            })
    }

    public isDragging(): boolean {
        return this.dragInProgress
    }

    public getForceSimulation(): typeof this.simulationForces {
        return this.simulationForces
    }

    /**
     * Allows to change the layout of the graph
     * 
     * @example
     * ```ts
     * changeLayout('tree', {
     *     layout: {
     *          horizontal: false,
     *          rootIdAlgorithmFinder: 'FirstZeroInDegree'
     *     }
     * })
     * ```
     */
    public async changeLayout(type: LayoutType, simulationOptions: DeepPartial<SimulationOptions> = {}) {
        if (this.layout) {
            this.layout?.unregisterLayout()
            this.layout = undefined
        }

        simulationOptions = simulationOptions ?? {}
        simulationOptions.layout = simulationOptions.layout ?? {}
        simulationOptions.layout.type = type

        if (type === 'force') {
            this.applyScalledSimulationOptions()
        } else if (type === 'tree') {
            this.layout = new TreeLayout(this.graph, this.simulation, this.simulationForces, simulationOptions.layout as TreeLayoutOptions)
        }
        this.options.layout.type = type
        this.update()
        this.pause()
        await this.runSimulationWorkerRouter(simulationOptions as SimulationOptions)
        this.restart()

        await this.waitForSimulationStop()
        this.graph.renderer.fitAndCenter()
    }
}
