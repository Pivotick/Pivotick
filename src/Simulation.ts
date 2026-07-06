import {
    forceSimulation as d3ForceSimulation,
    forceLink as d3ForceLink,
    forceManyBody as d3ForceManyBody,
    forceCollide as d3ForceCollide,
    type ForceLink as d3ForceLinkType,
    type ForceManyBody as d3ForceManyBodyType,
    type ForceCollide as d3ForceCollideType,
    type SimulationNodeDatum,
} from 'd3-force'
import { type Simulation as d3Simulation } from 'd3-force'
import { ForceGravity } from './plugins/d3Forces/ForceGravity'
import { drag as d3Drag } from 'd3-drag'
import type { Graph } from './Graph'
import type { Node } from './Node'
import { Edge } from './Edge'
import { runSimulationInWorker } from './SimulationWorkerWrapper'
import merge from 'lodash.merge'
import { TreeLayout } from './plugins/layout/Tree'
import { EgoTreeLayout } from './plugins/layout/EgoTree'
import { edgeLabelGetter } from './utils/GraphGetters'
import type { DeepPartial } from './utils/utils'
import type { SimulationCallbacks, SimulationForces, SimulationOptions } from './interfaces/SimulationOptions'
import type { LayoutType, TreeLayoutOptions } from './interfaces/LayoutOptions'
import type { GraphInteractions } from './GraphInteractions'
import { ForceClusterRadial } from './plugins/d3Forces/ForceClusterRadial'


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
    d3GravityStrength: 0.1,
    d3GravityStrengthConnected: 0.001,

    enabled: true,
    cooldownTime: 2000,
    useWorker: true,
    warmupTicks: 'auto',
    freezeNodesOnDrag: true,
    gridSnappingEnabled: false,
    gridSize: 50,

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
    private slowTickThresholdReached: boolean = false
    private avgTickDuration = 0
    private readonly SLOW_TICK_THRESHOLD = 33 // ms of tick compute+render (≈30fps budget)

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
                this.options.layout
            )
        } else if (this.options.layout.type === 'egoTree') {
            this.layout = new EgoTreeLayout(
                this.graph,
                this.simulation,
                this.simulationForces,
                this.options.layout
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
        simulation: d3Simulation<Node, undefined>,
        simulationForces: {
            link: d3ForceLinkType<Node, Edge>,
            charge: d3ForceManyBodyType<Node>,
            collide: d3ForceCollideType<Node>,
            gravity: ForceGravity<Node>,
        }
    } {
        const simulationForces = {
            link: d3ForceLink() as d3ForceLinkType<Node, Edge>,
            charge: d3ForceManyBody(),
            collide: d3ForceCollide(),
            gravity: ForceGravity(),
            // clusterRadialConstraint: ForceClusterRadial(),
        }

        const simulation = d3ForceSimulation<Node>()
            .force('link', simulationForces.link)
            .force('charge', simulationForces.charge)
            .force('collide', simulationForces.collide)
            .force('gravity', simulationForces.gravity)
            // .force('clusterRadialConstraint', simulationForces.clusterRadialConstraint)

        // this.initSimulationForceCenter(simulationForces.center, options)
        this.initSimulationForceGravity(simulationForces.gravity, options, canvasBCR)
        this.initSimulationForceLink(simulationForces.link, options)
        this.initSimulationForceCharge(simulationForces.charge, options)
        this.initSimulationForceCollide(simulationForces.collide, options)
        // this.initSimulationForceClusterRadialConstraint(simulationForces.clusterRadialConstraint, options)

        simulation.alphaMin(options.d3AlphaMin)
        simulation.alphaDecay(options.d3AlphaDecay)
        simulation.alphaTarget(0)
        simulation.velocityDecay(options.d3VelocityDecay)

        return {
            simulation: simulation,
            simulationForces: simulationForces,
        }
    }

    private static initSimulationForceGravity(force: ForceGravity<Node>, options: SimulationOptions, canvasBCR: DOMRect) {
        force.x(canvasBCR.width / 2)
            .y(canvasBCR.height / 2)
            .strength((node) => {
                const degree = (node as Node).degree() ?? 0
                // Isolated nodes get full pull to counter charge repulsion; connected nodes get a low (configurable) floor so link forces + charge find equilibrium
                return degree === 0 ? options.d3GravityStrength : options.d3GravityStrengthConnected
            })
    }

    private static initSimulationForceLink(force: d3ForceLinkType<Node, Edge>, options: SimulationOptions) {
        force.distance((edge) => {
            // Cluster-anchor links (external node → expanded cluster) rest outside the
            // bubble; their distance is precomputed off the cluster radius (see getActiveEdges).
            const anchorDistance = (edge as unknown as { __clusterAnchorDistance?: number }).__clusterAnchorDistance
            if (anchorDistance != null) return anchorDistance

            const labelContent = edgeLabelGetter(edge)
            if (!labelContent || labelContent === '') {
                return options.d3LinkDistance
            }
            const labelGuessedSize = labelContent.length * 10
            return Math.max(options.d3LinkDistance, labelGuessedSize)
        })
        if (options.d3LinkStrength) {
            force.strength(options.d3LinkStrength)
        }
    }

    private static initSimulationForceCharge(force: d3ForceManyBodyType<Node>, options: SimulationOptions) {
        force.theta(options.d3ManyBodyTheta)
            .strength((node: SimulationNodeDatum) => {
                const n = node as Node
                // if (n.isChild) return 0
                const baseStrength = options.d3ManyBodyStrength

                // Charge off the collapsed radius for expanded clusters: their large bubble radius
                // would over-repel (×parent weight below) and the sim never settles.
                const radius = n.expanded ? n.getCircleRadiusCollapsed() : n.getCircleRadius()
                const dampedRadius = 10 + Math.sqrt(Math.max(0, radius - 10)) // Slowly push other nodes if radius increases; clamp so radius < 10 doesn't yield NaN

                let weight = n.weight ?? 1
                weight *= n.isParent ? 10 : 1

                return baseStrength * (dampedRadius * dampedRadius) / 100 * weight
            })
    }

    private static initSimulationForceCollide(force: d3ForceCollideType<Node>, options: SimulationOptions) {
        force.radius((node: SimulationNodeDatum) => {
            const n = node as Node
            if (n.expanded) {
                return 1.2 * n.getCircleRadius() + 20
            }
            // console.log(n.getCircleRadius() ? 1.2 * n.getCircleRadius() : options.d3CollideRadius);
            
            return n.getCircleRadius() ? 1.2 * n.getCircleRadius() : options.d3CollideRadius
        })
            .strength(options.d3CollideStrength)
    }

    private static initSimulationForceClusterRadialConstraint(force: ForceClusterRadial<Node>, options: SimulationOptions) {
        force
            .strength(options.d3CollideStrength)
    }

    public update() {
        // Feed data to force-directed layout

        if (this.layout) {
            this.layout.update()
        } else {
            // this.scaleSimulationOptions()
        }

        // const visibleNodes = this.graph.getMutableVisibleNodes()
        const visibleNodes = this.graph.getMutableNodes().filter(node => node.visible)

        this.simulation
            .nodes(visibleNodes)

        const linkForce = this.simulation.force('link')
        if (linkForce) {
            (linkForce as d3ForceLinkType<Node, Edge>)
                .id((node: Node) => node.id)
                .links(this.getActiveEdges())
        }

        this.restart()
    }

    /** @private */
    public getActiveEdges(): Edge[] {
        const inSim = new Set(
            this.graph.getMutableNodes().filter(node => node.visible).map(node => node.id)
        )
        // Walk up until we hit a node the sim actually holds (a hidden child resolves
        // to its nearest visible ancestor — the expanded cluster it lives in).
        const ancestorInSim = (node: Node): Node | undefined => {
            let cur: Node | undefined = node
            while (cur && !inSim.has(cur.id)) cur = cur.parentNode
            return cur
        }
        const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)

        const edges: Edge[] = []
        const seenPairs = new Set<string>()

        for (const edge of this.graph.getMutableEdges()) {
            if (!edge.visible) continue
            const source = edge.source as Node
            const target = edge.target as Node

            // Fully in-sim edge (top-level, or a collapsed-cluster synthetic edge): keep as-is.
            if (!source.isChild && !target.isChild) {
                edges.push(edge)
                seenPairs.add(pairKey(source.id, target.id))
                continue
            }

            // One endpoint is a hidden child of an expanded cluster. Re-anchor the child
            // side to its in-sim ancestor so the external node stays tied to the cluster —
            // without this, expanding drops the anchor and the node drifts off on drag.
            // A real child↔child link across two clusters is punted here: whenever either
            // cluster is collapsed a visible cross-cluster stand-in edge carries the link
            // (kept above, or re-anchored just below when its child end is folded).
            if (source.isChild && target.isChild) continue
            const external = source.isChild ? target : source
            const cluster = ancestorInSim(source.isChild ? source : target)
            if (!cluster || cluster.id === external.id) continue
            const key = pairKey(external.id, cluster.id)
            if (seenPairs.has(key)) continue
            seenPairs.add(key)
            edges.push(this.clusterAnchorLink(external, cluster))
        }
        return edges
    }

    /**
     * A force-only link tying an external node to an expanded cluster it connects
     * into. Not a real Edge — never rendered, never registered on the nodes — just
     * the `{source, target, distance}` the link force needs. Its distance is the
     * cluster radius (plus the base link distance) so the node rests outside the bubble.
     * @private
     */
    private clusterAnchorLink(external: Node, cluster: Node): Edge {
        return {
            id: `cluster-anchor-${external.id}-${cluster.id}`,
            source: external,
            target: cluster,
            __clusterAnchorDistance: cluster.getCircleRadius() + this.options.d3LinkDistance,
        } as unknown as Edge
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
        Simulation.initSimulationForceCharge(this.simulationForces.charge, this.options)
        Simulation.initSimulationForceCollide(this.simulationForces.collide, this.options)
    }

    public enable() {
        this.avgTickDuration = 0
        this.options.enabled = true
        this.start(false)
    }

    public disable() {
        this.options.enabled = false
        this.stop()
    }

    /**
     * Pause the simulation
     */
    public pause() {
        this.engineRunning = false
        this.slowTickThresholdReached = false
    }

    /**
     * Restart the simulation with rendering on each animation frame.
     */
    public restart() {
        this.startSimulationTime = (new Date()).getTime()
        this.engineRunning = true
        this.slowTickThresholdReached = false
    }

    /**
     * Start the simulation with rendering on each animation frame.
     */
    public async start(recomputeLayout:boolean=true) {
        if (recomputeLayout) await this.runSimulationWorkerRouter()

        if (!this.options.enabled) {
            this.engineRunning = false
            return
        }

        this.engineRunning = true
        this.slowTickThresholdReached = false
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
        this.engineRunning = false
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
            const tickStart = performance.now()
            this.simulation.tick()
            this.graph.nextTick()
            this.updateTickMetrics(performance.now() - tickStart)
            if (this.callbacks.onTick) {
                this.callbacks.onTick(this)
            }
            this.graphInteraction.simulationTick()
            if (this.totalTickCount % 10 === 0) {
                this.graphInteraction.simulationSlowTick()
            }
        }
    }

    private updateTickMetrics(tickDuration: number) {
        // tickDuration is compute+render time, not frame gap: immune to rAF throttling on hidden tabs.
        this.avgTickDuration = this.avgTickDuration * 0.9 + tickDuration * 0.1

        if (this.avgTickDuration > this.SLOW_TICK_THRESHOLD) {
            this.slowTickThresholdReached = true
            this.disable()
            this.graph.UIManager.graphControls?.updatePhysicSimulationIndicator(false)
            this.graph.UIManager.showNotification({
                level: 'warning',
                title: 'Physics engine running slow',
                message: 'The physic has been disabled.'
            })
        }
    }

    /**
     * Returns a promise that resolves when the simulation stops naturally.
     * Useful for performing actions (like fitAndCenter) after stabilization.
     */
    public async waitForSimulationStop(): Promise<void> {

        if (!this.engineRunning) return

        return new Promise(resolve => {
            const originalOnStop = this.callbacks.onStop
            this.callbacks.onStop = (sim: Simulation) => {
                originalOnStop?.(sim)
                this.callbacks.onStop = originalOnStop
                resolve()
            }
        })
    }

    public isEnabled(): boolean {
        return this.options.enabled
    }

    private async computeGraph(optionOverride: Partial<SimulationOptions> = {}) {
        const { runSimulation } = await import('./workers/SimulationWorker')
        const canvasBCR = this.canvas?.getBoundingClientRect()
        if (!canvasBCR) return

        const nodes = this.graph.getMutableNodes()
        // Keep caller-set fixed positions (fx/fy) so pinned nodes stay put through the layout.
        const nodesCopy = this.graph.getNodes()
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
        this.graph.updateData(nodes, undefined, false)
    }

    private async runSimulationWorkerRouter(optionOverride: Partial<SimulationOptions> = {}) {
        if (this.options.useWorker) {
            try {
                await this.runSimulationWorker(optionOverride)
                return
            } catch (error) {
                // Worker may be blocked (e.g. CSP `worker-src 'none'`). Fall back
                // to the main thread and stop retrying on later layout passes.
                this.options.useWorker = false
                console.warn(
                    '[Pivotick] Simulation Web Worker unavailable (often a CSP blocking blob workers); ' +
                    'falling back to the main thread. Set `simulation.useWorker: false` to silence this.',
                    error
                )
            }
        }
        await this.computeGraph(optionOverride)
        this.graph.updateLayoutProgress(100, 0, 'done')
    }

    private async runSimulationWorker(optionOverride: Partial<SimulationOptions> = {}) {
        const canvasBCR = this.canvas?.getBoundingClientRect()
        if (!canvasBCR) return

        const nodes = this.graph.getMutableNodes()
        // Send serialization-safe DTOs, not live Node/Edge clones: a clone's
        // parentNode/from/to can transitively reach an expanded cluster's
        // subgraph DOM, which postMessage cannot structured-clone (DataCloneError).
        // Keep caller-set fixed positions (fx/fy) so pinned nodes stay put through the layout.
        const nodesCopy = this.graph.getNodes().map((n: Node) => n.toSimulationDTO())
        const edgesCopy = this.graph.getEdges().map((e: Edge) => e.toSimulationDTO())

        const onWorkerProgress = (progress: number, elapsedTime: number) => {
            this.graph.updateLayoutProgress(progress, elapsedTime, 'simulation')
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
        this.graph.updateLayoutProgress(100, 0, 'rendering')
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
        this.graph.updateData(nodes, undefined, false)
        this.graph.updateLayoutProgress(100, 0, 'done')
    }

    /**
     * Restart the simulation with a bit of heat
     */
    public reheat(alpha = 0.7): void {
        this.restart()
        this.simulation
            .alpha(alpha)
            .restart()
    }

    /**
     * Re-read the node-dependent force accessors and reheat.
     *
     * d3-force caches per-node radius/strength when a force is initialised (i.e.
     * when nodes are set), not on every tick — so mutating a node's radius after
     * the sim is running has no effect until the forces are re-initialised.
     * Re-setting the nodes does that; the reheat then lets collision/charge
     * re-lay-out with the new sizes. Used when a custom node measures its size
     * after the initial layout has already cooled. No-op when disabled.
     */
    public refreshForcesAndReheat(alpha = 0.5): void {
        if (!this.options.enabled) return
        const visibleNodes = this.graph.getMutableNodes().filter(node => node.visible)
        this.simulation.nodes(visibleNodes) // re-initialises every force → re-reads node radii
        this.reheat(alpha)
    }

    /**
     * @private
     */
    public createDragBehavior() {
        return d3Drag<SVGGElement, Node>()
            .filter(() => {

                // Disable node dragging while connect mode is active
                if (this.graph.editing.connectManager.isActiveAndNotIdle()) {
                    return false
                }

                return true
            })

            .on('start.draggedelement', (_event, d) => {
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
            .on('drag.draggedelement', (event, d) => {
                if (!this.dragInProgress && this.isEnabled()) {
                    this.dragInProgress = true
                    this.restart()
                    this.simulation
                        .alphaTarget(0.3)
                        .restart()
                }
                if (this.graphInteraction.hasActiveMultiselection()) {
                    this.dragSelection.forEach(({ node, dx, dy }) => {
                        const nx = this.applySnap(event.x + dx)
                        const ny = this.applySnap(event.y + dy)

                        node.fx = nx
                        node.fy = ny
                        node.x = nx
                        node.y = ny
                    })
                } else {
                    const gx = this.applySnap(event.x)
                    const gy = this.applySnap(event.y)

                    d.fx = gx
                    d.fy = gy
                    d.x = gx
                    d.y = gy
                }
                this.graphInteraction.dragging(event.sourceEvent, event.subject)
                
                if (!this.engineRunning || !this.isEnabled()) {
                    const subjects = this.graphInteraction.hasActiveMultiselection() ? this.dragSelection.map(d => d.node) : [d]
                    this.graph.nextTickFor(subjects) // force node updates since simulation won't do on next tick
                }
            })
            .on('end.draggedelement', (event, d) => {
                if (!event.active && this.dragInProgress) {
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
                this.graphInteraction.dragended(event.sourceEvent, event.subject)
            })
    }

    public isDragging(): boolean {
        return this.dragInProgress
    }

    public toggleGridSnapping() {
        this.options.gridSnappingEnabled = !this.options.gridSnappingEnabled
    }

    public toggleFreezeNodesOnDrag() {
        this.options.freezeNodesOnDrag = !this.options.freezeNodesOnDrag
    }

    public isFreezeNodesOnDrag(): boolean {
        return this.options.freezeNodesOnDrag
    }

    private applySnap(value: number): number {
        if (!this.options.gridSnappingEnabled) return value

        return Math.round(value / this.options.gridSize) * this.options.gridSize
    }

    public getForceSimulation(): typeof this.simulationForces {
        return this.simulationForces
    }

    public getSimulation(): typeof this.simulation {
        return this.simulation
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
        this.graph.renderer.fitAndCenterWhenSettled()
    }
}
