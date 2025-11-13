import type { TreeLayoutAlgorithm } from '../plugins/layout/Tree'

export type LayoutType = 'force' | 'tree'


export interface BaseLayoutOptions {
    /** @default 'force' */
    type: LayoutType
}

/**
 * @default ForceLayoutOptions
 */
export type LayoutOptions = ForceLayoutOptions | TreeLayoutOptions

export interface ForceLayoutOptions extends BaseLayoutOptions {
    type: 'force'
}
export interface TreeLayoutOptions extends BaseLayoutOptions {
    type: 'tree'
    /**
     * Specify the ID of the node to be used as the root of the tree.
     * Keep undefined to let `rooIdAlgorithmFinder` to select it.
     * @default undefined
     */
    rootId?: string
    /**
     * The strength of the force keeping the nodes placed to form a tree in place
     * @default 0.1
     */
    strength?: number
    /**
     * Should the nodes be placed radially instead of vertically
     * @default false
     */
    radial?: boolean
    /**
     * Should the nodes be placed horizontally rather than vertically
     * @default false
     */
    horizontal?: boolean
    /**
     * The algorithm to use to find the root of the tree
     * @default 'MaxReachability'
     */
    rootIdAlgorithmFinder: TreeLayoutAlgorithm
    /**
     * The grap between each layers used in the radial mode
     * @default 750
     */
    radialGap: number
    /**
     * If the direction of the edges should be flipped. This can lead to other visualization
     * @default false
     */
    flipEdgeDirection: boolean
}
