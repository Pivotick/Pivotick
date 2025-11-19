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
    /** @default -30 */
    d3ManyBodyStrength: number
    /** @default 0.9 */
    d3ManyBodyTheta: number
    /** @default 12 */
    d3CollideRadius: number
    /** @default 1 */
    d3CollideStrength: number
    /** @default 1 */
    d3CollideIterations: number
    /** @default 1 */
    d3CenterStrength: number
    /** @default 0.001 */
    d3GravityStrength: number
    /** @default 2000 */
    cooldownTime: number
    /** @default auto */
    warmupTicks: number | 'auto'
    /** @default true */
    freezeNodesOnDrag: boolean

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
    center: d3ForceCenterType<Node>,
    collide: d3ForceCollideType<Node>,
    gravity: d3ForceCenterType<Node>
}