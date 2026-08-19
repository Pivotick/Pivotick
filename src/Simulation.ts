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
import {
    AUTO_STRATEGIES, DEFAULT_AUTO_STRATEGY, countComponents, measureLayout,
    type AutoContext, type AutoStrategyName, type MeasuredLayout,
} from './AutoPhysics'


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
    d3CollideRadiusMultiplier: 1.2,
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
    fitViewOnExpandCollapse: false,

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

/**
 * The abstract physics knobs surfaced by the Physics flyout. Each is a plain
 * number in its own {@link PHYSICS_KNOB_RANGES | range}; the {@link Simulation}
 * setters map them onto the underlying d3-force domains.
 *
 * This is also the complete vocabulary the `Auto` preset speaks: auto expresses
 * itself only through knobs the user can see and turn, never through a hidden
 * d3 option.
 */
export interface PhysicsKnobs {
    /** Push-apart force. Higher spreads the graph out. */
    repulsion: number
    /** Preferred edge length, in px. */
    linkDistance: number
    /** Node spacing (collision radius). Higher keeps nodes further apart. */
    collisionRadius: number
    /** Motion damping. Higher settles the layout faster (calmer). */
    friction: number
    /**
     * Pull toward the canvas centre. Higher keeps separate components — which
     * otherwise only ever repel — inside the frame.
     */
    centering: number
    /** How long the layout is given to settle, in seconds. */
    settleTime: number
}

/** Inclusive `[min, max]` slider range for each {@link PhysicsKnobs} value. */
export const PHYSICS_KNOB_RANGES: Record<keyof PhysicsKnobs, readonly [number, number]> = {
    repulsion: [0, 100],
    linkDistance: [40, 600],
    collisionRadius: [4, 60],
    friction: [0, 100],
    centering: [0, 100],
    settleTime: [0.5, 8],
}

/** Named physics presets — a fixed character to pick, as opposed to letting `Auto` decide. */
export type PhysicsPresetName = 'tight' | 'loose'

/**
 * Knob bundles applied by {@link Simulation.applyPhysicsPreset}. `centering` 7 and
 * `settleTime` 2.25 reproduce the library's historical gravity (0.001 / 0.1) and
 * alpha decay (0.05) exactly, so clicking a preset still changes nothing but the
 * four knobs it always set.
 */
export const PHYSICS_PRESETS: Record<PhysicsPresetName, PhysicsKnobs> = {
    tight: { repulsion: 32, linkDistance: 70, collisionRadius: 16, friction: 58, centering: 7, settleTime: 2.25 },
    loose: { repulsion: 70, linkDistance: 150, collisionRadius: 26, friction: 28, centering: 7, settleTime: 2.25 },
}

/** One pass of the auto tuner, kept for the dev metrics overlay. */
export interface AutoRun {
    strategy: AutoStrategyName
    context: AutoContext
    knobs: PhysicsKnobs
    /** `true` when every knob landed inside the deadband and nothing was applied. */
    skipped: boolean
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

    /** Current abstract physics-knob values (what the View flyout renders). */
    private physicsKnobs: PhysicsKnobs

    // d3-force domains each knob maps onto; the knob's own range is in PHYSICS_KNOB_RANGES.
    private static readonly REPULSION_STRENGTH_RANGE = [0, -400] as const   // repulsion 0..100 (more negative = stronger)
    private static readonly LINK_DISTANCE_RANGE = [40, 600] as const        // linkDistance 40..600 (identity, px)
    private static readonly COLLIDE_MULTIPLIER_RANGE = [0.6, 2.4] as const  // collisionRadius 4..60
    private static readonly FRICTION_DECAY_RANGE = [0, 1] as const          // friction 0..100 → velocityDecay

    // `centering` is the odd one out: measured against real layouts, gravity does
    // nothing below ~0.005 and crushes the graph above ~0.2, so a linear knob would
    // spend most of its travel on values that make no difference. The map is
    // quadratic instead — knob 7 reproduces the historical
    // d3GravityStrengthConnected of 0.001, and the useful band sits mid-slider.
    private static readonly CENTERING_STRENGTH_MAX = 0.2
    /** Isolated nodes get a fixed multiple of the connected strength… */
    private static readonly CENTERING_ISOLATED_MULTIPLE = 4
    /** …clamped, so they never fly off at `centering: 0` nor snap to a point at 100. */
    private static readonly CENTERING_ISOLATED_RANGE = [0.1, 0.3] as const

    // ─── Auto tuner ─────────────────────────────────────────────────────────
    /** Whether the `Auto` preset is driving the knobs (see the constructor for how this is decided). */
    private autoEnabled: boolean
    private autoStrategyName: AutoStrategyName = DEFAULT_AUTO_STRATEGY
    private autoTuneTimer: ReturnType<typeof setTimeout> | null = null
    /** Set while auto writes knobs, so its own setter calls don't read as a manual edit. */
    private applyingAutoKnobs = false
    /** Set while auto writes knobs, so six setters produce one reheat rather than six. */
    private suppressReheat = false
    /** Last context + knobs auto computed, for the dev metrics overlay. */
    private autoLastRun: AutoRun | null = null

    /** Simulation options auto derives; setting any of them opts a graph out of auto. */
    private static readonly AUTO_OWNED_OPTIONS = [
        'd3LinkDistance', 'd3ManyBodyStrength', 'd3CollideRadiusMultiplier', 'd3VelocityDecay',
        'd3GravityStrength', 'd3GravityStrengthConnected', 'd3AlphaDecay', 'cooldownTime',
    ] as const

    /** Triggers inside this window collapse into a single tune. */
    private static readonly AUTO_DEBOUNCE_MS = 150
    /** A knob has to move by this fraction of its range before auto bothers applying it. */
    private static readonly AUTO_DEADBAND = 0.04
    /** Auto relaxes the layout from where it is; it never restarts it. */
    private static readonly AUTO_REHEAT_ALPHA = 0.3

    constructor(graph: Graph, options: Partial<SimulationOptions> = {}) {
        this.graph = graph
        // Decided from the *raw* partial, before the merge buries it under the
        // defaults: auto is the default only for graphs that never configured
        // their physics, so no existing consumer's tuning is silently overridden.
        this.autoEnabled = Simulation.shouldAutoTune(options)
        this.options = merge({}, DEFAULT_SIMULATION_OPTIONS, options)
        this.callbacks = this.options.callbacks ?? {}
        this.physicsKnobs = Simulation.knobsFromOptions(this.options)

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
        // The collision radius is the node's circle radius scaled by d3CollideRadiusMultiplier
        // (the "collision radius" knob). Previously this multiplier was hard-coded to 1.2, so
        // the knob only reached radius-less nodes via d3CollideRadius and never scaled the layout.
        const mult = options.d3CollideRadiusMultiplier
        force.radius((node: SimulationNodeDatum) => {
            const n = node as Node
            if (n.expanded) {
                return mult * n.getCircleRadius() + 20
            }
            return n.getCircleRadius() ? mult * n.getCircleRadius() : options.d3CollideRadius
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
            // Graph.onChange() is the funnel every visible-graph change passes through
            // — add/remove, filter, cluster expand/collapse — so this one hook covers
            // auto's "re-tune on the fly" promise. Debounced: a pivot fires it per node.
            this.scheduleTune()
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
        // Tune *before* the layout pass, so the worker is handed the tuned options and
        // the opening frame is already right rather than corrected a moment later.
        if (recomputeLayout) {
            this.tuneNow({ reheat: false })
            await this.runSimulationWorkerRouter()
        }

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
        if (this.autoTuneTimer !== null) {
            clearTimeout(this.autoTuneTimer)
            this.autoTuneTimer = null
        }
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
            this.graph.UIManager.showNotification({
                level: 'warning',
                title: 'Physics engine running slow',
                message: 'The physic has been disabled.'
            })
            // Physics was disabled behind the user's back — resync the run/pause button.
            this.graph.UIManager.physicsFlyout?.syncRunState()
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

    // Match computed positions to live nodes by id: the layout is handed a
    // different (and differently ordered) node set than the full node map, so
    // they can't be aligned by array index.
    private applyComputedPositions(updatedNodes: Node[]): void {
        const byId = new Map(updatedNodes.map(n => [n.id, n]))
        for (const node of this.graph.getMutableNodes()) {
            const updated = byId.get(node.id)
            if (!updated) continue
            node.x = updated.x
            node.y = updated.y
            node.fx = typeof updated.fx === 'number' ? updated.fx : undefined
            node.fy = typeof updated.fy === 'number' ? updated.fy : undefined
        }
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

        this.applyComputedPositions(updatedNodes)
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
        this.applyComputedPositions(updatedNodes)
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
        // Radii may only just have been measured by a custom node, so re-tune off the
        // real sizes; the reheat below covers both changes at once.
        this.tuneNow({ reheat: false })
        const visibleNodes = this.graph.getMutableNodes().filter(node => node.visible)
        this.simulation.nodes(visibleNodes) // re-initialises every force → re-reads node radii
        this.reheat(alpha)
    }

    // ─── Physics knobs (Physics flyout) ─────────────────────────────────────────
    // Each setter takes an abstract knob value (range in PHYSICS_KNOB_RANGES), maps
    // it onto a d3-force domain, re-initialises the affected force so d3 re-reads its
    // cached per-node array, then reheats. Reheat is skipped while physics is disabled;
    // the value is still stored so it takes effect once physics is re-enabled.
    //
    // These are also auto's only way of expressing itself. A call that does *not*
    // come from auto is a deliberate choice and switches auto off, so a re-tune can
    // never overwrite it a moment later.

    /** Push-apart strength. Knob 0–100 → d3ManyBodyStrength. */
    public setRepulsion(knob: number): void {
        const v = Simulation.clamp(knob, PHYSICS_KNOB_RANGES.repulsion)
        this.physicsKnobs.repulsion = v
        this.options.d3ManyBodyStrength = Simulation.mapLinear(v, PHYSICS_KNOB_RANGES.repulsion, Simulation.REPULSION_STRENGTH_RANGE)
        this.scaledForces.d3ManyBodyStrength = this.options.d3ManyBodyStrength
        Simulation.initSimulationForceCharge(this.simulationForces.charge, this.options)
        this.noteManualKnobEdit()
        this.reheatIfEnabled()
    }

    /** Preferred edge length. Knob 40–600 (px) → d3LinkDistance. */
    public setLinkDistance(knob: number): void {
        const v = Simulation.clamp(knob, PHYSICS_KNOB_RANGES.linkDistance)
        this.physicsKnobs.linkDistance = v
        this.options.d3LinkDistance = Simulation.mapLinear(v, PHYSICS_KNOB_RANGES.linkDistance, Simulation.LINK_DISTANCE_RANGE)
        Simulation.initSimulationForceLink(this.simulationForces.link, this.options)
        this.noteManualKnobEdit()
        this.reheatIfEnabled()
    }

    /** Node spacing. Knob 4–60 → d3CollideRadiusMultiplier (scales each node's collision radius). */
    public setCollisionRadius(knob: number): void {
        const v = Simulation.clamp(knob, PHYSICS_KNOB_RANGES.collisionRadius)
        this.physicsKnobs.collisionRadius = v
        this.options.d3CollideRadiusMultiplier = Simulation.mapLinear(v, PHYSICS_KNOB_RANGES.collisionRadius, Simulation.COLLIDE_MULTIPLIER_RANGE)
        Simulation.initSimulationForceCollide(this.simulationForces.collide, this.options)
        this.noteManualKnobEdit()
        this.reheatIfEnabled()
    }

    /** Motion damping. Knob 0–100 → d3VelocityDecay (÷100). Applied live each tick — no reheat. */
    public setFriction(knob: number): void {
        const v = Simulation.clamp(knob, PHYSICS_KNOB_RANGES.friction)
        this.physicsKnobs.friction = v
        this.options.d3VelocityDecay = Simulation.mapLinear(v, PHYSICS_KNOB_RANGES.friction, Simulation.FRICTION_DECAY_RANGE)
        this.simulation.velocityDecay(this.options.d3VelocityDecay)
        this.noteManualKnobEdit()
    }

    /**
     * Pull toward the canvas centre. Knob 0–100 → d3GravityStrengthConnected, with
     * d3GravityStrength (isolated nodes) following as a fixed multiple.
     *
     * Separate components only ever repel each other, so without this a
     * multi-component graph has nothing bounding it but the canvas — and the canvas
     * is not a force. This is the dial that keeps it in frame.
     */
    public setCentering(knob: number): void {
        const v = Simulation.clamp(knob, PHYSICS_KNOB_RANGES.centering)
        this.physicsKnobs.centering = v
        this.options.d3GravityStrengthConnected = Simulation.gravityForCentering(v)
        this.options.d3GravityStrength = Simulation.isolatedGravityFor(this.options.d3GravityStrengthConnected)
        Simulation.initSimulationForceGravity(this.simulationForces.gravity, this.options, this.canvasBCR)
        this.noteManualKnobEdit()
        this.reheatIfEnabled()
    }

    /**
     * How long the layout is given to settle, in seconds. Knob 0.5–8 → d3AlphaDecay
     * *and* cooldownTime together: alpha decay sets how fast the sim cools, cooldown
     * is the wall-clock wall that stops it. Moving either alone does nothing — raise
     * the cooldown and the sim is already cold; slow the decay and the wall truncates it.
     */
    public setSettleTime(knob: number): void {
        const v = Simulation.clamp(knob, PHYSICS_KNOB_RANGES.settleTime)
        this.physicsKnobs.settleTime = v
        this.options.d3AlphaDecay = Simulation.alphaDecayForSettleTime(v, this.options.d3AlphaMin)
        this.options.cooldownTime = v * 1000
        this.simulation.alphaDecay(this.options.d3AlphaDecay)
        this.noteManualKnobEdit()
    }

    /** Apply a named preset ({@link PHYSICS_PRESETS}): sets every knob and reheats once. */
    public applyPhysicsPreset(name: PhysicsPresetName): void {
        this.disableAutoPhysics()
        this.writeKnobs(PHYSICS_PRESETS[name])
        this.reheatIfEnabled()
    }

    /**
     * Write a whole knob bundle onto the options + forces, without reheating.
     * Shared by {@link applyPhysicsPreset} and the auto tuner, which each decide
     * their own reheat: one setter per knob would re-init six forces and reheat
     * six times for what is a single logical change.
     */
    private writeKnobs(knobs: PhysicsKnobs): void {
        this.physicsKnobs = { ...knobs }
        this.options.d3ManyBodyStrength = Simulation.mapLinear(knobs.repulsion, PHYSICS_KNOB_RANGES.repulsion, Simulation.REPULSION_STRENGTH_RANGE)
        this.scaledForces.d3ManyBodyStrength = this.options.d3ManyBodyStrength
        this.options.d3LinkDistance = Simulation.mapLinear(knobs.linkDistance, PHYSICS_KNOB_RANGES.linkDistance, Simulation.LINK_DISTANCE_RANGE)
        this.options.d3CollideRadiusMultiplier = Simulation.mapLinear(knobs.collisionRadius, PHYSICS_KNOB_RANGES.collisionRadius, Simulation.COLLIDE_MULTIPLIER_RANGE)
        this.options.d3VelocityDecay = Simulation.mapLinear(knobs.friction, PHYSICS_KNOB_RANGES.friction, Simulation.FRICTION_DECAY_RANGE)
        this.options.d3GravityStrengthConnected = Simulation.gravityForCentering(knobs.centering)
        this.options.d3GravityStrength = Simulation.isolatedGravityFor(this.options.d3GravityStrengthConnected)
        this.options.d3AlphaDecay = Simulation.alphaDecayForSettleTime(knobs.settleTime, this.options.d3AlphaMin)
        this.options.cooldownTime = knobs.settleTime * 1000

        Simulation.initSimulationForceCharge(this.simulationForces.charge, this.options)
        Simulation.initSimulationForceLink(this.simulationForces.link, this.options)
        Simulation.initSimulationForceCollide(this.simulationForces.collide, this.options)
        Simulation.initSimulationForceGravity(this.simulationForces.gravity, this.options, this.canvasBCR)
        this.simulation.velocityDecay(this.options.d3VelocityDecay)
        this.simulation.alphaDecay(this.options.d3AlphaDecay)
    }

    /** Current knob values, for seeding the Physics-flyout sliders. */
    public getPhysicsKnobs(): PhysicsKnobs {
        return { ...this.physicsKnobs }
    }

    /** The active layout type — the Physics flyout greys out physics under non-`force` layouts. */
    public getLayoutType(): LayoutType {
        return this.options.layout.type
    }

    private reheatIfEnabled(alpha = 0.5): void {
        if (this.suppressReheat) return
        if (this.options.enabled) this.reheat(alpha)
    }

    private static clamp(value: number, [lo, hi]: readonly [number, number]): number {
        return Math.max(lo, Math.min(hi, value))
    }

    private static mapLinear(value: number, from: readonly [number, number], to: readonly [number, number]): number {
        const t = (value - from[0]) / (from[1] - from[0])
        return to[0] + t * (to[1] - to[0])
    }

    /** Recover the abstract knob values from a set of d3-force options (inverse of the setters). */
    private static knobsFromOptions(options: SimulationOptions): PhysicsKnobs {
        const knob = (value: number, from: readonly [number, number], key: keyof PhysicsKnobs) =>
            Math.round(Simulation.clamp(Simulation.mapLinear(value, from, PHYSICS_KNOB_RANGES[key]), PHYSICS_KNOB_RANGES[key]))
        const settleTime = Simulation.settleTimeFromAlphaDecay(options.d3AlphaDecay, options.d3AlphaMin)
        return {
            repulsion: knob(options.d3ManyBodyStrength, Simulation.REPULSION_STRENGTH_RANGE, 'repulsion'),
            linkDistance: knob(options.d3LinkDistance, Simulation.LINK_DISTANCE_RANGE, 'linkDistance'),
            collisionRadius: knob(options.d3CollideRadiusMultiplier, Simulation.COLLIDE_MULTIPLIER_RANGE, 'collisionRadius'),
            friction: knob(options.d3VelocityDecay, Simulation.FRICTION_DECAY_RANGE, 'friction'),
            centering: Math.round(Simulation.clamp(
                Simulation.centeringFromGravity(options.d3GravityStrengthConnected), PHYSICS_KNOB_RANGES.centering)),
            settleTime: Math.round(Simulation.clamp(settleTime, PHYSICS_KNOB_RANGES.settleTime) * 10) / 10,
        }
    }

    /** `centering` knob → connected-node gravity strength. Quadratic; see CENTERING_STRENGTH_MAX. */
    private static gravityForCentering(knob: number): number {
        const t = knob / PHYSICS_KNOB_RANGES.centering[1]
        return Simulation.CENTERING_STRENGTH_MAX * t * t
    }

    private static centeringFromGravity(strength: number): number {
        const t = Math.sqrt(Math.max(0, strength) / Simulation.CENTERING_STRENGTH_MAX)
        return PHYSICS_KNOB_RANGES.centering[1] * t
    }

    /**
     * Isolated (degree-0) nodes have no links holding them, only charge pushing them
     * away, so they need a much firmer pull than connected ones — and they need *some*
     * pull even at `centering: 0`, or they leave the canvas entirely.
     */
    private static isolatedGravityFor(connectedStrength: number): number {
        const [lo, hi] = Simulation.CENTERING_ISOLATED_RANGE
        return Math.max(lo, Math.min(hi, connectedStrength * Simulation.CENTERING_ISOLATED_MULTIPLE))
    }

    /**
     * `settleTime` (s) → the per-tick alpha decay that lands alpha on `alphaMin`
     * after roughly `t · 60` ticks. `t = 2.25` reproduces the library's historical
     * decay of 0.05 exactly.
     */
    private static alphaDecayForSettleTime(settleTime: number, alphaMin: number): number {
        const ticks = Math.max(1, settleTime * 60)
        const floor = Math.min(0.999, Math.max(1e-6, alphaMin))
        return 1 - Math.pow(floor, 1 / ticks)
    }

    private static settleTimeFromAlphaDecay(alphaDecay: number, alphaMin: number): number {
        const floor = Math.min(0.999, Math.max(1e-6, alphaMin))
        const decay = Math.min(0.999, Math.max(1e-6, alphaDecay))
        return Math.log(floor) / Math.log(1 - decay) / 60
    }

    // ─── Auto physics ───────────────────────────────────────────────────────────

    /**
     * Whether a graph gets the `Auto` preset. `simulation.physics` forces it either
     * way; otherwise auto is on unless the consumer configured something auto drives,
     * so nobody's existing tuning is quietly taken over.
     *
     * `physics: 'auto'` alongside explicit d3 options is legal: the explicit values
     * seed the opening frame, and auto takes it from there.
     */
    private static shouldAutoTune(options: Partial<SimulationOptions>): boolean {
        if (options.physics === 'auto') return true
        if (options.physics === 'manual') return false
        return !Simulation.AUTO_OWNED_OPTIONS.some(key => options[key] !== undefined)
    }

    /** Is the `Auto` preset currently driving the knobs? */
    public isAutoPhysicsEnabled(): boolean {
        return this.autoEnabled
    }

    /** Turn `Auto` on and tune immediately. */
    public enableAutoPhysics(): void {
        this.autoEnabled = true
        this.tuneNow()
    }

    /** Turn `Auto` off, leaving the knobs wherever they currently sit. */
    public disableAutoPhysics(): void {
        this.autoEnabled = false
        if (this.autoTuneTimer !== null) {
            clearTimeout(this.autoTuneTimer)
            this.autoTuneTimer = null
        }
    }

    /**
     * Swap the auto strategy. Development hook for the strategy bake-off — the
     * winner becomes the only implementation and this goes away.
     * @private
     */
    public setAutoStrategy(name: AutoStrategyName): void {
        this.autoStrategyName = name
        if (this.autoEnabled) this.tuneNow()
    }

    /** @private */
    public getAutoStrategy(): AutoStrategyName {
        return this.autoStrategyName
    }

    /** The last tuning pass, for the development metrics overlay. @private */
    public getAutoRun(): AutoRun | null {
        return this.autoLastRun
    }

    /** A user (or a consumer) turning a knob themselves takes auto out of the loop. */
    private noteManualKnobEdit(): void {
        if (this.applyingAutoKnobs) return
        this.disableAutoPhysics()
    }

    /** Collapse the triggers that arrive together — a pivot fires one per node. */
    private scheduleTune(): void {
        if (!this.autoEnabled) return
        if (this.autoTuneTimer !== null) clearTimeout(this.autoTuneTimer)
        this.autoTuneTimer = setTimeout(() => {
            this.autoTuneTimer = null
            this.tuneNow()
        }, Simulation.AUTO_DEBOUNCE_MS)
    }

    /**
     * Run the active strategy and apply what it decided.
     *
     * `reheat: false` is for callers that are about to reheat anyway (the opening
     * layout, `refreshForcesAndReheat`), so one logical change stays one reheat.
     */
    private tuneNow({ reheat = true }: { reheat?: boolean } = {}): void {
        if (!this.autoEnabled || this.options.layout.type !== 'force') return

        const context = this.buildAutoContext()
        if (context.nodeCount === 0) return
        const next = AUTO_STRATEGIES[this.autoStrategyName](context)

        // Deadband: below it the layout would not visibly change, and every apply
        // costs a reheat. Without this, pivoting reheats once per node added.
        const skipped = (Object.keys(next) as Array<keyof PhysicsKnobs>).every(key => {
            const [lo, hi] = PHYSICS_KNOB_RANGES[key]
            return Math.abs(next[key] - this.physicsKnobs[key]) <= (hi - lo) * Simulation.AUTO_DEADBAND
        })
        this.autoLastRun = { strategy: this.autoStrategyName, context, knobs: skipped ? this.getPhysicsKnobs() : next, skipped }
        if (skipped) return

        this.applyingAutoKnobs = true
        this.suppressReheat = true
        try {
            this.writeKnobs(next)
        } finally {
            this.suppressReheat = false
            this.applyingAutoKnobs = false
        }
        // Gentle: relax the layout from where it is instead of restarting it.
        if (reheat) this.reheatIfEnabled(Simulation.AUTO_REHEAT_ALPHA)
        this.graph.UIManager.physicsFlyout?.syncAutoKnobs(this.getPhysicsKnobs())
    }

    /**
     * What auto is allowed to see: the canvas at zoom 1, the nodes the sim holds and
     * their radii. The zoom transform is deliberately never read — reading the
     * *zoomed* viewport would loop against `fitAndCenter` (zoom out → more apparent
     * space → spread → re-fit → spread).
     */
    private buildAutoContext(): AutoContext {
        const canvasBCR = this.canvas?.getBoundingClientRect() ?? this.canvasBCR
        const nodes = this.graph.getMutableNodes().filter(node => node.visible)
        const edges = this.getActiveEdges()

        let radiusSum = 0
        let maxRadius = 0
        let totalArea = 0
        for (const node of nodes) {
            const radius = node.expanded ? node.getCircleRadiusCollapsed() : node.getCircleRadius()
            radiusSum += radius
            maxRadius = Math.max(maxRadius, radius)
            totalArea += Math.PI * radius * radius
        }

        return {
            canvas: { width: canvasBCR.width, height: canvasBCR.height },
            nodeCount: nodes.length,
            radii: { mean: nodes.length ? radiusSum / nodes.length : 0, max: maxRadius, totalArea },
            edgeCount: edges.length,
            componentCount: countComponents(
                nodes.map(node => node.id),
                edges.map(edge => [(edge.source as Node).id, (edge.target as Node).id] as [string, string])
            ),
            measured: this.autoStrategyName === 'feedback' ? this.measureCurrentLayout(canvasBCR) : undefined,
            current: this.getPhysicsKnobs(),
        }
    }

    /** Measure the layout as it currently stands — only `feedback` asks for this. */
    private measureCurrentLayout(canvasBCR: DOMRect): MeasuredLayout {
        const nodes = this.graph.getMutableNodes()
            .filter(node => node.visible)
            .map(node => ({
                x: node.x,
                y: node.y,
                radius: node.expanded ? node.getCircleRadiusCollapsed() : node.getCircleRadius(),
            }))
        return measureLayout(nodes, { width: canvasBCR.width, height: canvasBCR.height })
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

    public isGridSnappingEnabled(): boolean {
        return this.options.gridSnappingEnabled
    }

    public toggleFitViewOnExpandCollapse() {
        this.options.fitViewOnExpandCollapse = !this.options.fitViewOnExpandCollapse
    }

    public isFitViewOnExpandCollapse(): boolean {
        return this.options.fitViewOnExpandCollapse
    }

    private applySnap(value: number): number {
        if (!this.options.gridSnappingEnabled) return value

        return Math.round(value / this.options.gridSize) * this.options.gridSize
    }

    /**
     * Snap a graph-space coordinate to the grid when grid-snapping is enabled
     * (a no-op otherwise). Public so non-simulation draggables (e.g. notes) can
     * snap on the same grid as nodes.
     */
    public snapToGrid(value: number): number {
        return this.applySnap(value)
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
            // Re-init the node-dependent forces so d3 re-reads radii after the tree
            // layout let go of them; auto (if on) re-tunes on the update() below.
            Simulation.initSimulationForceCharge(this.simulationForces.charge, this.options)
            Simulation.initSimulationForceCollide(this.simulationForces.collide, this.options)
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
