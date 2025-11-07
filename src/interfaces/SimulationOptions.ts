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

export interface SimulationOptions {
    /** Note: These may be scalled based on the amount of node and canvas size */
    d3Alpha: number /** @default 1.0 */
    d3AlphaMin: number /** @default 0.001 */
    d3AlphaDecay: number /** @default 0.0228 */
    d3AlphaTarget: number /** @default 0 */
    d3VelocityDecay: number /** @default 0.4 */
    d3LinkDistance: number /** @default 30 */
    d3LinkStrength: number | null /** @default null */
    d3ManyBodyStrength: number /** @default -30 */
    d3ManyBodyTheta: number /** @default 0.9 */
    d3CollideRadius: number /** @default 12 */
    d3CollideStrength: number /** @default 1 */
    d3CollideIterations: number /** @default 1 */
    d3CenterStrength: number /** @default 1 */
    d3GravityStrength: number /** @default 0.001 */
    cooldownTime: number /** @default 2000 */
    warmupTicks: number | 'auto' /** @default auto */
    freezeNodesOnDrag: boolean /** @default true */

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