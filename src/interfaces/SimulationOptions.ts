import type { Edge } from '../Edge'
import type { Node } from '../Node'
import type { Simulation } from '../Simulation'
import type { LayoutOptions } from './LayoutOptions'
import {
    type ForceLink as d3ForceLinkType,
    type ForceManyBody as d3ForceManyBodyType,
    type ForceCenter as d3ForceCenterType,
    type ForceCollide as d3ForceCollideType,
} from 'd3-force'

/**
 * @remarks These may be scalled based on the amount of node and canvas size
 * @category Main Options
 * */
export interface SimulationOptions {
    /** @default 1.0 */
    d3Alpha: number
    /** @default 0.001 */
    d3AlphaMin: number
    /** @default 0.0228 */
    d3AlphaDecay: number
    /** @default 0 */
    d3AlphaTarget: number
    /** @default 0.4 */
    d3VelocityDecay: number
    /** @default 30 */
    d3LinkDistance: number
    /** @default null */
    d3LinkStrength: number | null
    /** @default -150 */
    d3ManyBodyStrength: number
    /** @default 0.9 */
    d3ManyBodyTheta: number
    /**
     * Fallback collision radius, in px, used only for nodes that report no circle
     * radius. Nodes with a radius use {@link d3CollideRadiusMultiplier} × their radius.
     * @default 12
     */
    d3CollideRadius: number
    /**
     * Multiplier applied to each node's circle radius to derive its collision radius
     * (the spacing the sim keeps between nodes). Higher spreads nodes further apart.
     * This is what the "collision radius" physics knob scales via
     * {@link Simulation.setCollisionRadius}.
     * @default 1.2
     */
    d3CollideRadiusMultiplier: number
    /** @default 1 */
    d3CollideStrength: number
    /** @default 1 */
    d3CollideIterations: number
    /**
     * Centring pull toward the canvas centre, applied only to isolated (degree-0)
     * nodes so they don't fly off; connected nodes use {@link d3GravityStrengthConnected}.
     * @default 0.1
     */
    d3GravityStrength: number
    /**
     * Centring pull for connected nodes. Kept low by default so link + charge forces
     * find their own equilibrium; raise it to stop a sparsely-linked graph from
     * drifting apart.
     * @default 0.001
     */
    d3GravityStrengthConnected: number
    /** @default 2000 */
    cooldownTime: number
    /** @default auto */
    warmupTicks: number | 'auto'
    /** @default true */
    freezeNodesOnDrag: boolean
    /** @default false */
    gridSnappingEnabled: boolean
    /** @default 50 */
    gridSize: number
    /**
     * Automatically fit the graph to the viewport after a cluster is expanded or collapsed.
     * @default false
     */
    fitViewOnExpandCollapse: boolean

    /** @default true */
    enabled: boolean
    /** @default true */
    useWorker: boolean
    /** @private */
    layout: LayoutOptions
    callbacks?: SimulationCallbacks
}

export interface SimulationCallbacks {
    /**
     * Called when the simulation initializes
     */
    onInit?: (simulation: Simulation) => void
    /**
     * Called when the simulation starts
     */
    onStart?: (simulation: Simulation) => void
    /**
     * Called when the simulation stops
     */
    onStop?: (simulation: Simulation) => void
    /**
     * Called when the simulation ticks
     */
    onTick?: (simulation: Simulation) => void
}

export interface SimulationForces {
    link: d3ForceLinkType<Node, Edge>,
    charge: d3ForceManyBodyType<Node>,
    collide: d3ForceCollideType<Node>,
    gravity: d3ForceCenterType<Node>
}