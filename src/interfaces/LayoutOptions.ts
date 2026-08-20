import type { TreeLayoutAlgorithm } from '../plugins/layout/Tree'

export type LayoutType = 'force' | 'tree' | 'egoTree'


export interface BaseLayoutOptions {
    /** @default 'force' */
    type: LayoutType
}

/**
 * @default ForceLayoutOptions
 */
export type LayoutOptions = ForceLayoutOptions | AnyTreeLayoutOptions
export type AnyTreeLayoutOptions = TreeLayoutOptions | EgoTreeLayoutOptions

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
     * Whether the two spacing multipliers tune themselves from the size of the nodes
     * and the shape of the tree, or stay exactly where they are put.
     *
     * `'auto'` is the default — except for a tree that sets `levelSpacing` or
     * `siblingSpacing` explicitly, which is taken as having made up its mind. Turning
     * either multiplier by hand afterwards also leaves auto, permanently.
     * @default 'auto'
     */
    spacing?: 'auto' | 'manual'
    /**
     * Multiplies the distance between consecutive levels — the depth axis of the
     * tree, or the gap between rings in `radial` mode. `1` is the historical
     * behaviour: the tree is scaled to fill the canvas.
     * @default 1
     */
    levelSpacing?: number
    /**
     * Multiplies the distance between nodes *within* a level — the breadth axis.
     * Ignored in `radial` mode, where a level always spans the full circle.
     * @default 1
     */
    siblingSpacing?: number
}

export interface EgoTreeLayoutOptions
    extends Omit<TreeLayoutOptions, 'rootId' | 'type'> {
    type: 'egoTree'
    rootId: string
}
