import type { Edge, EdgeData } from '../Edge'
import type { Node, NodeData } from '../Node'
import type { GraphUI } from './GraphUI'
import type { InterractionCallbacks } from './InterractionCallbacks'
import type { LayoutOptions } from './LayoutOptions'
import type { EdgeFullStyle, GraphRendererOptions, NodeStyle } from './RendererOptions'
import type { SimulationOptions } from './SimulationOptions'

/**
 * @remarks
 * This interface should be used as the entry point when configuring the graph.
 * 
 * @category Main Options
 */
export interface GraphOptions {
    /**
     * Options for the rendering engine
     */
    render?: Partial<GraphRendererOptions>
    /**
     * Options for the simultion engine
     */
    simulation?: Partial<SimulationOptions>

    /**
    * Layout-specific configuration (e.g. tree, radial, etc.)
    */
    layout?: Partial<LayoutOptions>

    /**
     * Callbacks to handle various graph events and render hooks.
     */
    callbacks?: InterractionCallbacks

    /**
     * Enable whether the graph is directed or not
     * @default true
     */
    isDirected?: boolean,

    /**
     * Options for the UI
     */
    UI?: Partial<GraphUI>,
}

/**
 * @category Main Options
 */
export interface GraphData {
    nodes: Node[],
    edges: Edge[],
}

export type RawNode = { id: string | number; data?: NodeData, style?: Partial<NodeStyle> }
export type RawEdge = { id?: string | number; from: string | number; to: string | number; data?: EdgeData, style?: Partial<EdgeFullStyle> }

export interface RelaxedGraphData {
    nodes: Array<Node | RawNode>
    edges: Array<Edge | RawEdge>
}
