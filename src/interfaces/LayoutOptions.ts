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
     * Name of the `node.data` key holding the id of the node's parent in the hierarchy.
     *
     * Leave undefined — the default — and parenthood is derived from the edges, as it
     * always was. Name a key and each node that carries it is attached to the node it
     * names, whether or not an edge joins them; a branch declared without an edge is
     * drawn without a line. A key naming a node that is not being laid out, or one that
     * would close a cycle, is dropped for that node, which falls back to the edges.
     *
     * Ignored while `rootId` is set: pinning a root re-derives every parent from the
     * edges, which is what makes the root picker able to re-hang a declared tree.
     * @default undefined
     */
    parentKey?: string
    /**
     * Name of the `node.data` key holding the row the node should sit on, counting from
     * `0` at the shallowest root.
     *
     * Leave undefined — the default — and a node sits one row below its parent. Name a
     * key and each node that carries it is pushed down to the row it asks for, the gap
     * filled with empty rows. This is how the roots of a multi-tree graph are put on
     * different rows: give one of them a depth of `2` and its whole tree starts there.
     *
     * A row can only ever push a node *further down*: a tidy tree cannot place a child
     * above its parent, so a depth that is not below the parent's is clamped to
     * `parent + 1`. Empty rows take up real space, so a large depth on a shallow graph
     * squeezes every row — `levelSpacing` is the way back out.
     * @default undefined
     */
    depthKey?: string
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
     * Multiplies the distance between consecutive levels — the depth axis of the tree, or
     * the gap between rings in `radial` mode. At `1` the tree is scaled to fill the canvas.
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
    extends Omit<TreeLayoutOptions, 'rootId' | 'type' | 'parentKey' | 'depthKey'> {
    type: 'egoTree'
    rootId: string
}
