import type { Edge } from '../Edge'
import type { Node } from '../Node'
import type { GraphUI } from './GraphUI'
import type { InterractionCallbacks } from './InterractionCallbacks'
import type { LayoutOptions } from './LayoutOptions'
import type { GraphRendererOptions } from './RendererOptions'
import type { SimulationOptions } from './SimulationOptions'

/**
 * @remarks
 * This interface should be used as the entry point when configuring the graph.
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

export interface GraphData {
    nodes: Node[],
    edges: Edge[],
}
