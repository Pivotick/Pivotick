import {
    forceRadial as d3ForceRadial,
    forceX as d3ForceX,
    forceY as d3ForceY,
} from 'd3-force'
import { type Simulation as d3Simulation } from 'd3-force'
import { hierarchy, type HierarchyNode, tree, type TreeLayout as D3TreeGenerator } from 'd3-hierarchy'
import merge from 'lodash.merge'
import type { Graph } from '../../Graph'
import type { Node } from '../../Node'
import type { Edge } from '../../Edge'
import { findFirstZeroInDegreeNode, findMaxReachabilityRoot, findMinHeightDAGRoot, findMinMaxDistanceRoot, findUndirectedCenterRoot } from '../analytics/DAGAlgorithms'
import type { AnyTreeLayoutOptions, TreeLayoutOptions } from '../../interfaces/LayoutOptions'
import { neededLevelGap, neededSiblingGap, tuneTreeSpacing, type AutoTreeContext, type TreeGap } from '../../AutoTreeSpacing'
import type { SimulationForces } from '../../interfaces/SimulationOptions'

export type TreeLayoutAlgorithm = 'FirstZeroInDegree' | 'MaxReachability' | 'MinMaxDistance' | 'MinHeight'

/**
 * Everything a tree layout resolves at construction, except `rootId` — which stays
 * optional, because "no pinned root, let the finder choose" is a state the layout has
 * to be able to go back to. `Required<TreeLayoutOptions>` would type it as a `string`
 * that is in fact `undefined` most of the time.
 */
type ResolvedTreeLayoutOptions =
    Required<Omit<TreeLayoutOptions, 'rootId' | 'parentKey' | 'depthKey'>>
    & { rootId?: string, parentKey?: string, depthKey?: string }

/** Clear space left around a parked node, on top of its own diameter. */
const PARKED_GAP = 20

/**
 * Id of the synthetic root a *forest* is hung under. Not a graph node: it exists only so
 * d3 lays the components out side by side, and is filtered out of every result.
 */
export const FOREST_ROOT_ID = '__pivotick_forest_root__'

/**
 * Id prefix of the empty rows a *declared depth* leaves behind. Not graph nodes: a d3 tree
 * places a node strictly one row below its parent, so reaching a lower row means giving it
 * ancestors to be lower *than*. Filtered out of everything returned, like
 * {@link FOREST_ROOT_ID}.
 */
export const TREE_SPACER_ID_PREFIX = '__pivotick_tree_spacer__'

/**
 * Deepest row a `depthKey` may ask for, and the spacer budget one layout will build to reach
 * it. Not design limits but guards: the scaffolding is unbounded in the *data*, so a mistyped
 * `level: 1e9` would loop building a billion nodes. A row past the cap is reported unusable;
 * past the spacer budget a node just sits below its parent.
 */
const MAX_DECLARED_ROW = 4096
const MAX_TREE_SPACERS = 50_000

/**
 * How much of its own component the *best available* root must reach along the arrows for the
 * spanning tree to be walked directed at all. Below this the arrows are taken not to describe
 * a hierarchy and the walk reads every edge both ways — see
 * {@link TreeLayout.buildLevelsStatic}.
 *
 * Half is a deliberately weak test: it catches data that converges rather than branches, and
 * leaves alone a hierarchy that merely has a few extra sources. The two regimes sit far either
 * side of it, so this is not a knob that wants tuning.
 */
const MIN_DIRECTED_COVERAGE = 0.5

/**
 * Last declared-hierarchy warning logged, so one load does not print the same complaint per
 * layout pass. The text carries the counts, so a changed message is a different complaint and
 * is still logged.
 */
let lastDeclaredWarning = ''

const DEFAULT_TREE_LAYOUT_OPTIONS: TreeLayoutOptions = {
    type: 'tree',
    rootId: undefined,
    parentKey: undefined,
    depthKey: undefined,
    rootIdAlgorithmFinder: 'MaxReachability',
    strength: 0.25,
    radial: false,
    radialGap: 750,
    spacing: 'auto',
    levelSpacing: 1,
    siblingSpacing: 1,
    horizontal: false,
}

export interface TreeNode extends Node {
    children: TreeNode[]
    parent?: TreeNode
    x?: number
    y?: number
}

interface ForceStrengthArray {
    link: number | ((edge: Edge, i: number, edges: Edge[]) => number)
    charge: number | ((node: Node, i: number, nodes: Node[]) => number)
    gravity: number
}

export class TreeLayout {
    protected graph: Graph
    protected simulation: d3Simulation<Node, undefined>
    protected simulationForces: SimulationForces
    protected options: ResolvedTreeLayoutOptions

    protected originalForceStrength: ForceStrengthArray
    protected canvasBCR!: DOMRect

    protected levels: Map<string, number>
    /** Deepest level in {@link levels}; the divisor turning `radialGap` into a ring gap. */
    protected maxDepth = 0
    /** Whether {@link update} re-derives the spacing multipliers; see {@link setSpacing}. */
    protected autoSpacing: boolean
    /** Nodes no edge touches, placed by {@link packParked} rather than by the hierarchy. */
    protected parkedIds = new Set<string>()
    protected positionedNodesByID: Map<string, HierarchyNode<TreeNode>>

    constructor (
        graph: Graph,
        simulation: d3Simulation<Node, undefined>,
        simulationForces: typeof this.simulationForces,
        partialOptions: Partial<AnyTreeLayoutOptions> = {},
    ) {
        this.graph = graph
        this.simulation = simulation
        this.simulationForces = simulationForces
        this.options = merge({}, DEFAULT_TREE_LAYOUT_OPTIONS, partialOptions) as ResolvedTreeLayoutOptions
        this.originalForceStrength = {
            link: this.simulationForces.link.strength(),
            charge: this.simulationForces.charge.strength(),
            gravity: this.simulationForces.gravity.strength(),
        }

        // Auto is the default but never a takeover: a tree that set either multiplier
        // explicitly keeps exactly what it asked for. Decided from the *raw* partial,
        // before the merge buries it under the defaults — the same rule (and the same
        // reason) as `Simulation.shouldAutoTune`.
        this.autoSpacing = partialOptions.spacing === 'auto' || (
            partialOptions.spacing !== 'manual'
            && partialOptions.levelSpacing === undefined
            && partialOptions.siblingSpacing === undefined
        )

        this.positionedNodesByID = new Map()
        this.levels = new Map()

        this.setSizes()
        this.update()
        this.registerForces()
    }

    /**
     * Lay the tree out — and, while `spacing: 'auto'`, re-derive the multipliers from what the
     * nodes need and lay it out once more. Two passes rather than a loop: a gap scales linearly
     * with its multiplier, so the correction is exact. The second pass is skipped when it would
     * change nothing.
     */
    public update(): void {
        this.layoutOnce()
        if (!this.autoSpacing || this.positionedNodesByID.size === 0) return

        const tuned = tuneTreeSpacing(this.measureAutoContext())
        if (tuned.levelSpacing === this.options.levelSpacing
            && tuned.siblingSpacing === this.options.siblingSpacing) return

        this.options.levelSpacing = tuned.levelSpacing
        this.options.siblingSpacing = tuned.siblingSpacing
        this.layoutOnce()
        // Auto only ever moves multipliers the user can see, so the sliders follow it —
        // the same contract, and the same hand-off point, as the physics knobs.
        this.graph.UIManager?.physicsFlyout?.syncAutoSpacing(tuned)
    }

    private layoutOnce(): void {
        const nodes = this.graph.getNodes()
        const edges = this.graph.getEdges()
        // Built once and handed on to `buildTree`: `levels` is what the radial force assigns
        // rings by, so a second walk picking another root would put nodes on rings their own
        // positions do not sit on.
        const built = this.buildLevels(nodes, edges, this.options)
        const { levels, maxDepth, parked } = built
        this.parkedIds = new Set(parked)
        const { nodes: positionedNodes, nodeById: positionedNodesByID } =
            this.buildTree(nodes, edges, this.options, this.canvasBCR, built)
        this.positionedNodesByID = positionedNodesByID

        this.levels = levels
        this.maxDepth = maxDepth
        if (positionedNodes) {
            this.setNodePositions(positionedNodes, this.options)
        }
    }

    /**
     * The tightest pair on each axis of the tree as currently laid out, for
     * {@link tuneTreeSpacing}. Measured in *hierarchy* space (`x` = breadth or angle,
     * `y` = depth or radius), which is the layout's own answer, unpolluted by whatever
     * the force relaxation has since done to the free axis.
     */
    protected measureAutoContext(): AutoTreeContext {
        const byDepth = new Map<number, Array<{ node: HierarchyNode<TreeNode>, radius: number }>>()
        for (const [id, positioned] of this.positionedNodesByID) {
            const node = this.graph.getMutableNode(id)
            if (!node) continue
            // Parked nodes are placed at a spacing this layout chose, not one the canvas
            // implied, so measuring them would have auto tuning against its own output.
            if (this.parkedIds.has(id)) continue
            const measured = node.expanded ? node.getCircleRadiusCollapsed() : node.getCircleRadius()
            // A node that has not measured itself yet reports no usable radius; it asks for
            // no clearance rather than poisoning the pair's arithmetic.
            const radius = Number.isFinite(measured) ? measured : 0
            const bucket = byDepth.get(positioned.depth) ?? []
            bucket.push({ node: positioned, radius })
            byDepth.set(positioned.depth, bucket)
        }

        const depths = [...byDepth.keys()].sort((a, b) => a - b)
        let level: TreeGap | null = null
        let sibling: TreeGap | null = null

        for (let i = 0; i < depths.length; i++) {
            const here = byDepth.get(depths[i])!

            const next = i + 1 < depths.length ? byDepth.get(depths[i + 1])! : undefined
            if (next) {
                // Every node of a level shares its depth coordinate, so one of each will do.
                // Divided by the rows between them, because a declared depth can leave rows
                // empty: measuring across four empty rows as one gap would report a crowded
                // tree as having ample room, and auto tuning would then shrink it further.
                const spannedRows = Math.max(depths[i + 1] - depths[i], 1)
                const measured = Math.abs((next[0].node.y ?? 0) - (here[0].node.y ?? 0)) / spannedRows
                const needed = neededLevelGap(TreeLayout.widestOf(here), TreeLayout.widestOf(next))
                level = TreeLayout.tighter(level, { measured, needed })
            }

            const inOrder = [...here].sort((a, b) => (a.node.x ?? 0) - (b.node.x ?? 0))
            for (let j = 1; j < inOrder.length; j++) {
                const [before, after] = [inOrder[j - 1], inOrder[j]]
                const measured = this.options.radial
                    // Same ring, so the chord between two angles — the distance a reader sees.
                    ? 2 * (after.node.y ?? 0) * Math.sin(Math.abs((after.node.x ?? 0) - (before.node.x ?? 0)) / 2)
                    : (after.node.x ?? 0) - (before.node.x ?? 0)
                const needed = neededSiblingGap(before.radius, after.radius)
                sibling = TreeLayout.tighter(sibling, { measured, needed })
            }
        }

        return { level, sibling, radial: this.options.radial, current: this.getSpacing() }
    }

    /** The pair in the worse shape — the biggest shortfall relative to what it needs. */
    private static tighter(current: TreeGap | null, candidate: TreeGap): TreeGap {
        if (!current) return candidate
        const shortfall = (gap: TreeGap) => gap.needed / Math.max(gap.measured, 1e-6)
        return shortfall(candidate) > shortfall(current) ? candidate : current
    }

    private static widestOf(nodes: Array<{ radius: number }>): number {
        return nodes.reduce((max, n) => Math.max(max, n.radius), 0)
    }

    private setSizes(): void {
        const canvas = this.graph.renderer.getCanvas()
        if (!canvas) {
            throw new Error('Canvas element is not defined in the graph renderer.')
        }
        this.canvasBCR = canvas.getBoundingClientRect()
    }

    protected setNodePositions(positionedNodes: HierarchyNode<TreeNode>[], options: TreeLayoutOptions): void {
        for (const positionedNode of positionedNodes) {
            const node = this.graph.getMutableNode(positionedNode.data.id)
            if (node) {
                if (options.radial) {
                    const angle = positionedNode.x ?? 0
                    const r = positionedNode.y ?? 0

                    node.x = r * Math.cos(angle - Math.PI / 2)
                    node.y = r * Math.sin(angle - Math.PI / 2)
                    node.fx = node.x
                    node.fy = node.y
                    // delete node.fx
                    // delete node.fy
                } else if (options.horizontal) {
                    node.x = positionedNode.y
                    node.fx = positionedNode.y
                    node.y = positionedNode.x
                    delete node.fy
                } else {
                    node.x = positionedNode.x
                    node.y = positionedNode.y
                    node.fy = positionedNode.y
                    delete node.fx
                }
            }
        }
    }

    protected unsetNodePositions(): void {
        this.graph.getMutableNodes().forEach(mutableNode => {
            delete mutableNode.fy
            delete mutableNode.fx
        })
    }

    protected registerForces(): void {
        const strength = this.options.strength ?? 0.1
        if (this.options.radial) {
            const ringGap = TreeLayout.radialRingGap(this.options, this.maxDepth)
            const radialForce = d3ForceRadial<Node>(
                (node: Node) => (this.levels.get(node.id) ?? 1) * ringGap,
                0,
                0
            ).strength(strength)
            this.simulation.force('tree-radial', radialForce)
            // this.simulation.force('tree-y', d3ForceY((node: Node) => {
            //     return this.positionedNodesByID.get(node.id)?.y ?? 0
            // }).strength(strength))
            // this.simulation.force('tree-x', d3ForceX((node: Node) => {
            //     return this.positionedNodesByID.get(node.id)?.x ?? 0
            // }).strength(strength))
        } else {
            this.simulation.force('tree-y', d3ForceY((node: Node) => {
                if (this.options.horizontal) {
                    return this.positionedNodesByID.get(node.id)?.x ?? 0
                } else {
                    return this.positionedNodesByID.get(node.id)?.y ?? 0
                }
            }).strength(strength))
            this.simulation.force('tree-x', d3ForceX((node: Node) => {
                if (this.options.horizontal) {
                    return this.positionedNodesByID.get(node.id)?.y ?? 0
                } else {
                    return this.positionedNodesByID.get(node.id)?.x ?? 0
                }
            }).strength(strength))
        }

        TreeLayout.adjustOtherSimulationForces(this.simulationForces, this.options)
    }

    public unregisterLayout(): void {
        this.unregisterForces()
        this.unsetNodePositions()
    }

    protected unregisterForces(): void {
        this.simulation.force('tree-radial', null)
        this.simulation.force('tree-y', null)
        this.simulation.force('tree-x', null)
        TreeLayout.resetOtherSimulationForces(this.simulationForces, this.originalForceStrength)
    }

    static registerForcesOnSimulation(
        nodes: Node[],
        edges: Edge[],
        simulation: d3Simulation<Node, undefined>,
        simulationForces: SimulationForces,
        partialOptions: Partial<TreeLayoutOptions>,
        canvasBCR: DOMRect,
        cls: typeof TreeLayout = this,
    ): void {
        const options = merge({}, DEFAULT_TREE_LAYOUT_OPTIONS, partialOptions)
        const strength = options.strength ?? 0.1
        const width = canvasBCR.width
        const height = canvasBCR.height
        const center = [width / 2, height / 2]

        const built = cls.buildLevelsStatic(nodes, edges, options)
        const { levels, maxDepth } = built
        const { nodeById: positionedNodesByID } = cls.buildTreeStatic(nodes, edges, options, canvasBCR, built)

        if (options.radial) {
            const ringGap = cls.radialRingGap(options, maxDepth)
            const radialForce = d3ForceRadial<Node>(
                (node: Node) => (levels.get(node.id) ?? 1) * ringGap,
                center[0],
                center[1]
            ).strength(strength)
            simulation.force('tree-radial', radialForce)
            // simulation.force('tree-y', d3ForceY((node: Node) => {
            //     return positionedNodesByID.get(node.id)?.y ?? 0
            // }).strength(strength))
            // simulation.force('tree-x', d3ForceX((node: Node) => {
            //     return positionedNodesByID.get(node.id)?.x ?? 0
            // }).strength(strength))
        } else {
            simulation.force('tree-y', d3ForceY((node: Node) => {
                if (options.horizontal) {
                    return positionedNodesByID.get(node.id)?.x ?? 0
                } else {
                    return positionedNodesByID.get(node.id)?.y ?? 0
                }
            }).strength(strength))
            simulation.force('tree-x', d3ForceX((node: Node) => {
                if (options.horizontal) {
                    return positionedNodesByID.get(node.id)?.y ?? 0
                } else {
                    return positionedNodesByID.get(node.id)?.x ?? 0
                }
            }).strength(strength))
        }

        cls.adjustOtherSimulationForces(simulationForces, options)
    }

    static adjustOtherSimulationForces(simulationForces: SimulationForces, options: Partial<TreeLayoutOptions>): void {
        if (options?.radial) {
            simulationForces.link.strength(0)
            simulationForces.charge.strength(0)
            simulationForces.gravity.strength(0)
        } else {
            simulationForces.link.strength(0)
            simulationForces.charge.strength(0)
            simulationForces.gravity.strength(0.00001)
        }
    }
    
    static resetOtherSimulationForces(
        simulationForces: SimulationForces,
        originalForceStrength: ForceStrengthArray
    ): void {
        simulationForces.link.strength(originalForceStrength.link)
        simulationForces.charge.strength(originalForceStrength.charge)
        simulationForces.gravity.strength(originalForceStrength.gravity)
    }

    static simulationDone(
        nodes: Node[],
        _edges: Edge[],
        _simulation: d3Simulation<Node, undefined>,
        partialOptions: Partial<TreeLayoutOptions>,
    ): void {
        const options = merge({}, DEFAULT_TREE_LAYOUT_OPTIONS, partialOptions)
        for (const node of nodes) {
            if (options.radial) {
                node.fx = node.x
                node.fy = node.y
            } else {
                if (options.horizontal) {
                    node.fx = node.x
                    delete node.fy
                } else {
                    node.fy = node.y
                    delete node.fx
                }
            }
        }
    }

    /**
     * Distance between two consecutive rings in the radial layout. The layout sizes the tree to
     * `radialGap` and lets d3 spread `maxDepth` levels across it, so this must be the same
     * division or the radial *force* and the radial *positions* describe two different pictures
     * — invisible on the main thread, where pinned `fx`/`fy` outrank the force, but the worker
     * path is driven by the force alone.
     */
    protected static radialRingGap(options: TreeLayoutOptions, maxDepth: number): number {
        const radius = options.radialGap * TreeLayout.spacingOf(options).level
        return maxDepth > 0 ? radius / maxDepth : radius
    }

    /** The spacing multipliers in force, defaulted for a partially-specified options object. */
    protected static spacingOf(options: Partial<TreeLayoutOptions>): { level: number, sibling: number } {
        // Anything not a usable number reads as `1`: these scale the box d3 normalises the
        // tree onto, so a bad multiplier would not misplace one node — it would make every
        // coordinate NaN.
        const usable = (value: number | undefined) => (Number.isFinite(value) ? value as number : 1)
        return { level: usable(options.levelSpacing), sibling: usable(options.siblingSpacing) }
    }

    /** The spacing multipliers currently laid out. */
    public getSpacing(): { levelSpacing: number, siblingSpacing: number } {
        const { level, sibling } = TreeLayout.spacingOf(this.options)
        return { levelSpacing: level, siblingSpacing: sibling }
    }

    /**
     * Re-lay-out at new spacing multipliers, keeping the root and orientation. The canvas is
     * re-measured first, being the length scale both multipliers work against.
     *
     * Re-registering the forces is not optional: `forceX`/`forceY`/`forceRadial` read their
     * per-node target once at initialize time, so recomputed positions alone leave every force
     * still pulling nodes to their old slots — levels spread, siblings snap back.
     */
    public setSpacing(spacing: { levelSpacing?: number, siblingSpacing?: number }): void {
        // A hand-set multiplier is a deliberate choice; auto must not overwrite it a
        // moment later.
        this.autoSpacing = false
        this.options.spacing = 'manual'
        if (spacing.levelSpacing !== undefined) this.options.levelSpacing = spacing.levelSpacing
        if (spacing.siblingSpacing !== undefined) this.options.siblingSpacing = spacing.siblingSpacing
        this.relayout()
    }

    /** Is the spacing tuning itself? */
    public isAutoSpacing(): boolean {
        return this.autoSpacing
    }

    /** The root the tree hangs from: a pinned node id, or the finder that picks one. */
    public getRoot(): { rootId?: string, algorithm: TreeLayoutAlgorithm } {
        return { rootId: this.options.rootId, algorithm: this.options.rootIdAlgorithmFinder }
    }

    /**
     * Re-hang the tree from another root, keeping the orientation and the spacing. A `rootId`
     * pins the tree to that node and is walked ignoring edge direction, so any node gives a
     * whole tree; an `algorithm` drops the pin and lets the finder choose again. Goes through
     * {@link relayout} for the force-caching reason {@link setSpacing} gives.
     */
    public setRoot(root: { rootId: string } | { algorithm: TreeLayoutAlgorithm }): void {
        if ('rootId' in root) {
            this.options.rootId = root.rootId
        } else {
            this.options.rootId = undefined
            this.options.rootIdAlgorithmFinder = root.algorithm
        }
        this.relayout()
    }

    /** Hand the multipliers back to the tuner and re-lay-out at what it picks. */
    public enableAutoSpacing(): void {
        this.autoSpacing = true
        this.options.spacing = 'auto'
        this.relayout()
    }

    private relayout(): void {
        this.setSizes()
        this.update()
        // A cyclic graph has no tree to lay out (the constructor warned and gave up):
        // registering forces with no targets would pull every node onto the origin.
        if (this.positionedNodesByID.size === 0) return
        this.registerForces()
    }

    /**
     * The d3 tree generator, sized for the canvas and the spacing multipliers, plus the offset
     * that re-centres the result on the box it would have filled at `1×`. A `size`d d3 tree is
     * normalised onto the whole box and grows from the top-left, so without the offset raising
     * a multiplier would push the tree off the bottom-right instead of expanding it in place.
     */
    protected static sizedTreeLayout(options: TreeLayoutOptions, canvasBCR: DOMRect): {
        treeLayout: D3TreeGenerator<TreeNode>
        offset: { x: number, y: number }
    } {
        const spacing = TreeLayout.spacingOf(options)
        const treeLayout = tree<TreeNode>()

        if (options.radial) {
            // A level always spans the full circle, so only the ring gap can grow.
            treeLayout.size([2 * Math.PI, options.radialGap * spacing.level])
            return { treeLayout, offset: { x: 0, y: 0 } }
        }

        // Hierarchy `x` is the breadth axis (siblings), `y` the depth axis (levels).
        // Which canvas dimension each gets depends on the orientation, because
        // `setNodePositions` swaps them for a horizontal tree: depth is budgeted from
        // the canvas edge it will actually run along. Reading them the other way round
        // gave a left-to-right tree the canvas *height* for its levels and the *width*
        // for its siblings — both dimensions backwards on any landscape canvas.
        const depthBudget = options.horizontal ? canvasBCR.width : canvasBCR.height
        const breadthBudget = options.horizontal ? canvasBCR.height : canvasBCR.width
        const width = breadthBudget * spacing.sibling
        const height = depthBudget * spacing.level
        treeLayout
            .size([width, height])
            .separation((a, b) => {
                const siblingsCount = a.parent?.children?.length ?? 1
                return a.parent === b.parent ? 1.5 / siblingsCount : 1.5
            })

        return {
            treeLayout,
            offset: {
                x: -(width - breadthBudget) / 2,
                y: -(height - depthBudget) / 2,
            },
        }
    }

    /**
     * Where to put the nodes with no relations at all. They have no place in a hierarchy, so
     * they go in the dead space a tree always leaves beside its shallow levels, one cell clear
     * of its silhouette.
     *
     * The *trailing* end, because the mode rail and its flyouts live down the left of the
     * canvas and nodes parked there would sit behind a panel. Inside the bounding box, because
     * the view is fitted and a stray dot outside it would zoom the whole tree out.
     *
     * Positions are in hierarchy space (`x` breadth, `y` depth — angle and radius when radial),
     * as everything `buildTreeStatic` returns.
     */
    protected static packParked(
        parked: TreeNode[],
        laidOut: HierarchyNode<TreeNode>[],
        options: TreeLayoutOptions,
        canvasBCR: DOMRect,
        /**
         * Rows the caller asked for. A parked node named here is placed on its own row rather
         * than past the end of the tree — it keeps its parking, out of the hierarchy and out
         * of the tree's way, but on the row it asked to be on.
         */
        declaredRows: Map<string, number> = new Map(),
    ): HierarchyNode<TreeNode>[] {
        if (!parked.length) return []

        const radiusOf = (node: TreeNode) => {
            const measured = node.getCircleRadius()
            return Number.isFinite(measured) ? measured : 0
        }
        const cell = 2 * parked.reduce((max, node) => Math.max(max, radiusOf(node)), 0) + PARKED_GAP
        const standIn = (node: TreeNode, x: number, y: number, depth: number) =>
            ({ data: node, depth, x, y, height: 0 } as unknown as HierarchyNode<TreeNode>)

        const xs = laidOut.map(node => node.x ?? 0)
        const ys = laidOut.map(node => node.y ?? 0)

        const asked = parked.filter(node => declaredRows.has(node.id))
        const unasked = parked.filter(node => !declaredRows.has(node.id))
        const rowAsked = (node: TreeNode) => declaredRows.get(node.id) ?? 0

        /**
         * Where a row sits in hierarchy space. Read off the tree where a node marks the row,
         * and extrapolated from the row height otherwise — a declared depth can leave rows
         * empty, and an asked-for row is exactly the kind that no laid-out node occupies.
         */
        const depths = [...new Set(laidOut.map(node => node.depth))].sort((a, b) => a - b)
        const yByDepth = new Map<number, number>()
        for (const node of laidOut) yByDepth.set(node.depth, node.y ?? 0)
        const first = depths[0] ?? 0
        const last = depths[depths.length - 1] ?? 0
        const rowHeight = last > first
            ? ((yByDepth.get(last) ?? 0) - (yByDepth.get(first) ?? 0)) / (last - first)
            : cell
        const yForRow = (row: number) => yByDepth.get(row)
            ?? (depths.length ? (yByDepth.get(first) ?? 0) + (row - first) * rowHeight : row * cell)

        if (options.radial) {
            const positions: HierarchyNode<TreeNode>[] = []

            // A named row is a named *ring*. Placed in the widest angle the tree leaves free
            // on it, so they never land on top of the nodes already there.
            const byRing = new Map<number, TreeNode[]>()
            for (const node of asked) {
                const row = rowAsked(node)
                byRing.set(row, [...(byRing.get(row) ?? []), node])
            }
            for (const [row, group] of byRing) {
                const taken = laidOut.filter(node => node.depth === row)
                    .map(node => node.x ?? 0)
                    .sort((a, b) => a - b)
                let from = 0
                let width = 2 * Math.PI
                if (taken.length) {
                    width = 0
                    for (let i = 0; i < taken.length; i++) {
                        // Wrapping round past the last one, so the gap across 0 counts too.
                        const next = i + 1 < taken.length ? taken[i + 1] : taken[0] + 2 * Math.PI
                        if (next - taken[i] > width) {
                            width = next - taken[i]
                            from = taken[i]
                        }
                    }
                }
                const step = width / (group.length + 1)
                group.forEach((node, index) => positions.push(
                    standIn(node, from + step * (index + 1), yForRow(row), row)
                ))
            }

            // No wedge on a disc: one more ring, outside the last.
            const rings = new Set(ys).size
            const outer = ys.length ? Math.max(...ys) : options.radialGap
            const ringGap = rings > 0 ? outer / rings : outer
            unasked.forEach((node, index) => positions.push(standIn(
                node,
                (index * 2 * Math.PI) / unasked.length,
                outer + ringGap,
                rings + 1,
            )))
            return positions
        }

        if (!laidOut.length) {
            // Nothing but parked nodes: they are the layout, so grid them over the canvas —
            // on the rows they named, where they named one.
            const perRow = Math.max(1, Math.floor(canvasBCR.width / cell))
            const positions: HierarchyNode<TreeNode>[] = []
            const columns = new Map<number, number>()
            for (const node of asked) {
                const row = rowAsked(node)
                const column = columns.get(row) ?? 0
                columns.set(row, column + 1)
                positions.push(standIn(node, column * cell, row * cell, row))
            }
            // Below whatever the named rows reached, so the grid and the rows never overlap.
            const below = columns.size ? Math.max(...columns.keys()) + 1 : 0
            unasked.forEach((node, index) => {
                const row = below + Math.floor(index / perRow)
                positions.push(standIn(node, (index % perRow) * cell, row * cell, row))
            })
            return positions
        }

        // The tree's silhouette: how far it reaches on each of its rows, on the side the
        // parked nodes are going. Kept by depth as well, since an asked-for row is known by
        // its depth before it is known by its coordinate.
        const treeEdgeByRow = new Map<number, number>()
        const treeEdgeByDepth = new Map<number, number>()
        for (const node of laidOut) {
            const row = node.y ?? 0
            const x = node.x ?? 0
            treeEdgeByRow.set(row, Math.max(treeEdgeByRow.get(row) ?? x, x))
            treeEdgeByDepth.set(node.depth, Math.max(treeEdgeByDepth.get(node.depth) ?? x, x))
        }
        const rows = [...treeEdgeByRow.keys()].sort((a, b) => a - b)
        const boxLeft = Math.min(...xs)
        const boxRight = Math.max(...xs)
        const rowGap = rows.length > 1 ? rows[1] - rows[0] : cell

        const positions: HierarchyNode<TreeNode>[] = []

        // The named rows first, packed in from the trailing edge and stopping one cell clear
        // of the tree. Whatever will not fit falls through to the ordinary wedge below, which
        // is where a parked node goes when its own row has no room for it.
        const overflow: TreeNode[] = []
        const columnsAtY = new Map<number, number>()
        for (const node of asked) {
            const row = rowAsked(node)
            const y = yForRow(row)
            const column = columnsAtY.get(y) ?? 0
            const x = boxRight - column * cell
            const edge = treeEdgeByDepth.get(row)
            if (edge !== undefined && x - cell <= edge) {
                overflow.push(node)
                continue
            }
            columnsAtY.set(y, column + 1)
            positions.push(standIn(node, x, y, row))
        }

        const queue = [...unasked, ...overflow]
        let next = 0
        for (const [index, row] of rows.entries()) {
            if (next >= queue.length) break
            // Starting past anything already parked on this row by name.
            const used = columnsAtY.get(row) ?? 0
            const wedge = boxRight - used * cell - ((treeEdgeByRow.get(row) ?? boxRight) + cell)
            const fits = Math.floor(wedge / cell)
            for (let column = 0; column < fits && next < queue.length; column++) {
                positions.push(standIn(queue[next++], boxRight - (used + column) * cell, row, index))
            }
        }

        // More parked nodes than the wedge holds: carry on in rows under the tree, which is
        // the one direction still free once the wedge is full.
        const perRow = Math.max(1, Math.floor((boxRight - boxLeft) / cell))
        const lastRow = rows[rows.length - 1]
        for (let index = 0; next < queue.length; index++) {
            positions.push(standIn(
                queue[next++],
                boxRight - (index % perRow) * cell,
                lastRow + rowGap * (1 + Math.floor(index / perRow)),
                rows.length,
            ))
        }
        return positions
    }

    /** Shift a laid-out tree in hierarchy space; see {@link sizedTreeLayout}. */
    protected static offsetTree(nodes: HierarchyNode<TreeNode>[], offset: { x: number, y: number }): void {
        if (!offset.x && !offset.y) return
        for (const node of nodes) {
            node.x = (node.x ?? 0) + offset.x
            node.y = (node.y ?? 0) + offset.y
        }
    }

    protected buildTree(
        nodes: Node[],
        edges: Edge[],
        options: TreeLayoutOptions,
        canvasBCR: DOMRect,
        built?: ReturnType<typeof TreeLayout.buildLevelsStatic>,
    ): {
        root: HierarchyNode<TreeNode> | null
        nodes: HierarchyNode<TreeNode>[]
        nodeById: Map<string, HierarchyNode<TreeNode>>
    } {
        return TreeLayout.buildTreeStatic(nodes, edges, options, canvasBCR, built)
    }

    /** Is this one of the layout's own scaffolding nodes rather than a node of the graph? */
    protected static isScaffolding(id: string): boolean {
        return id === FOREST_ROOT_ID || id.startsWith(TREE_SPACER_ID_PREFIX)
    }

    static buildTreeStatic(
        nodes: Node[],
        edges: Edge[],
        options: TreeLayoutOptions,
        canvasBCR: DOMRect,
        /** The walk `layoutOnce` already did; recomputed here only for the static callers. */
        built?: ReturnType<typeof TreeLayout.buildLevelsStatic>,
    ): {
        root: HierarchyNode<TreeNode> | null
        nodes: HierarchyNode<TreeNode>[]
        nodeById: Map<string, HierarchyNode<TreeNode>>
    } {
        if (!nodes.length) {
            return {
                root: null,
                nodes: [],
                nodeById: new Map<string, HierarchyNode<TreeNode>>(),
            }
        }

        const nodeMap = new Map<string, TreeNode>()
        for (const node of nodes) {
            const treeNode = node as TreeNode
            treeNode.children = []
            nodeMap.set(node.id, treeNode)
        }

        // The hierarchy is built from the *spanning tree*, not from the raw edges. Reading
        // parent/child straight off the edges is what made a cycle fatal — `d3.hierarchy`
        // walks children and a cycle never ends — and it also gave a node with two parents
        // two places in the tree. One BFS parent per node settles both.
        const { parentOf, roots, parked, levels, declaredRows } = built
            ?? TreeLayout.buildLevelsStatic(nodes, edges, options)

        let spacers = 0
        /** An empty row: no data, no id of its own beyond the prefix, never drawn. */
        const makeSpacer = () =>
            ({ id: `${TREE_SPACER_ID_PREFIX}${spacers++}`, children: [] } as unknown as TreeNode)
        const rowOf = (id: string) => levels.get(id) ?? 0

        /**
         * Hang `child` under `parent`, padding with spacer rows until it lands on the row
         * `levels` gives it — the only way to honour a declared depth, since d3 places a node
         * exactly one row below its parent. Each spacer costs one node's breadth on the row it
         * crosses, so an offset tree narrows the gap beside it rather than reshaping the layout.
         */
        const hang = (parent: TreeNode, parentRow: number, child: TreeNode, childRow: number) => {
            let attachTo = parent
            for (let row = parentRow + 1; row < childRow && spacers < MAX_TREE_SPACERS; row++) {
                const spacer = makeSpacer()
                attachTo.children.push(spacer)
                attachTo = spacer
            }
            // Out of budget: the node sits below its parent rather than on the row it asked
            // for, so `levels` reads one row deeper than it is drawn. That only matters to the
            // radial force, and only on a graph already asking for tens of thousands of empty
            // rows — which has no readable layout either way.
            attachTo.children.push(child)
        }

        for (const [childId, parentId] of parentOf) {
            const child = nodeMap.get(childId)
            const parent = nodeMap.get(parentId)
            if (!child || !parent) continue
            hang(parent, rowOf(parentId), child, rowOf(childId))
            child.parent = parent
        }

        const parkedNodes = parked
            .map(id => nodeMap.get(id))
            .filter((node): node is TreeNode => Boolean(node))

        const root = TreeLayout.hierarchyRootFor(roots, nodeMap, rowOf, hang, makeSpacer)
        if (!root) {
            // Every node is parked: there is no hierarchy to lay out, only the grid.
            if (!roots.length && parkedNodes.length) {
                const only = TreeLayout.packParked(parkedNodes, [], options, canvasBCR, declaredRows)
                return {
                    root: null,
                    nodes: only,
                    nodeById: new Map(only.map(node => [node.data.id, node])),
                }
            }
            throw new Error(`Root node with id "${roots[0]}" not found.`)
        }

        // Create a d3 hierarchy and compute tree layout
        const { treeLayout, offset } = TreeLayout.sizedTreeLayout(options, canvasBCR)

        const rootHierarchy = hierarchy(root)
        const treeRoot = treeLayout(rootHierarchy)
        TreeLayout.offsetTree(treeRoot.descendants(), offset)

        const laidOut = treeRoot.descendants().filter(node => !TreeLayout.isScaffolding(node.data.id))
        const parkedPositions = TreeLayout.packParked(parkedNodes, laidOut, options, canvasBCR, declaredRows)

        const nodeById = new Map<string, HierarchyNode<TreeNode>>()
        for (const node of parkedPositions) nodeById.set(node.data.id, node)
        treeRoot.descendants().forEach((node) => {
            if (TreeLayout.isScaffolding(node.data.id)) return
            nodeById.set(node.data.id, node)
        })

        return {
            root: treeRoot,
            nodes: [...laidOut, ...parkedPositions],
            nodeById: nodeById,
        }
    }

    /**
     * The node to hang the hierarchy off. One component roots the tree at its own root; several
     * make a *forest*, which gets a synthetic root holding one component per child so they lay
     * out side by side. That root is dropped from everything returned.
     *
     * A root starting further down needs the rows above it, so it gets a spacer chain too — in
     * a forest hanging off the synthetic root (the `forestShift` in `buildLevelsStatic`), and
     * otherwise with the top of its own chain standing in as the hierarchy root.
     */
    private static hierarchyRootFor(
        roots: string[],
        nodeMap: Map<string, TreeNode>,
        rowOf: (id: string) => number,
        hang: (parent: TreeNode, parentRow: number, child: TreeNode, childRow: number) => void,
        makeSpacer: () => TreeNode,
    ): TreeNode | undefined {
        if (roots.length === 1) {
            const only = nodeMap.get(roots[0])
            if (!only || rowOf(roots[0]) <= 0) return only
            const top = makeSpacer()
            hang(top, 0, only, rowOf(roots[0]))
            return top
        }
        const children = roots.map(id => nodeMap.get(id)).filter((node): node is TreeNode => Boolean(node))
        if (!children.length) return undefined
        const forest = { id: FOREST_ROOT_ID, children: [] } as unknown as TreeNode
        for (const child of children) hang(forest, 0, child, rowOf(child.id))
        return forest
    }

    protected buildLevels(
        nodes: Node[],
        edges: Edge[],
        options: Partial<TreeLayoutOptions>,
    ): ReturnType<typeof TreeLayout.buildLevelsStatic> {
        return TreeLayout.buildLevelsStatic(nodes, edges, options)
    }

    /**
     * What the caller stated about the hierarchy, read off `node.data` per `parentKey` and
     * `depthKey`, with everything unusable already dropped.
     */
    private static readDeclaredHierarchy(
        nodes: Node[],
        options: Partial<TreeLayoutOptions>,
        /** Honour `parentKey`? A pinned root re-derives every parent from the edges instead. */
        useParents: boolean,
    ): {
        /** Child id -> parent id; cycle-free, and naming only nodes being laid out. */
        parentOf: Map<string, string>
        /** Requested rows, counted from `0` at the shallowest root. */
        rowOf: Map<string, number>
        /** What had to be dropped or clamped, tallied for one warning. */
        complaints: Map<string, number>
    } {
        const parentOf = new Map<string, string>()
        const rowOf = new Map<string, number>()
        const complaints = new Map<string, number>()
        const complain = (what: string) => complaints.set(what, (complaints.get(what) ?? 0) + 1)

        const parentKey = useParents ? options.parentKey : undefined
        const depthKey = options.depthKey
        if (!parentKey && !depthKey) return { parentOf, rowOf, complaints }

        const present = new Set(nodes.map(node => node.id))
        for (const node of nodes) {
            const data = node.getData()

            if (depthKey) {
                const raw = data[depthKey]
                if (raw !== undefined && raw !== null && raw !== '') {
                    const row = Math.floor(Number(raw))
                    if (Number.isFinite(row) && row >= 0 && row <= MAX_DECLARED_ROW) rowOf.set(node.id, row)
                    else complain(`declared depths that are not a row between 0 and ${MAX_DECLARED_ROW}`)
                }
            }

            if (!parentKey) continue
            const raw = data[parentKey]
            if (raw === undefined || raw === null || raw === '') continue
            const parentId = String(raw)
            // A parent outside the laid-out set cannot hold anything up, for the same reason
            // `rootId` falls back when the node it names has been filtered away.
            if (parentId === node.id) complain('declared parents pointing at their own node')
            else if (!present.has(parentId)) complain('declared parents not in the layout')
            else parentOf.set(node.id, parentId)
        }

        // A cycle is not a tree, so one link of each has to go: the one that closes it.
        const settled = new Set<string>()
        for (const start of [...parentOf.keys()]) {
            if (settled.has(start)) continue
            const walked: string[] = []
            const onPath = new Set<string>()
            let curr: string | undefined = start
            while (curr !== undefined && !settled.has(curr)) {
                if (onPath.has(curr)) {
                    parentOf.delete(curr)
                    complain('declared parent cycles broken')
                    break
                }
                onPath.add(curr)
                walked.push(curr)
                curr = parentOf.get(curr)
            }
            for (const id of walked) settled.add(id)
        }

        return { parentOf, rowOf, complaints }
    }

    /** One line per layout pass, however many things the declared hierarchy got wrong. */
    private static warnAboutDeclared(complaints: Map<string, number>): void {
        if (!complaints.size) return
        const message = '[Pivotick] Tree layout ignored part of the declared hierarchy: '
            + [...complaints].map(([what, count]) => `${count} ${what}`).join(', ') + '.'
        // A single pass lays the tree out twice whenever spacing is auto (see `update`), so
        // without this the same line is logged twice for every graph that declares anything.
        if (message === lastDeclaredWarning) return
        lastDeclaredWarning = message
        console.warn(message)
    }

    /**
     * The hierarchy the layout will draw: one parent per node, the row each sits on, and the
     * roots it all hangs from.
     *
     * Parenthood comes from a BFS over the edges — the first edge to reach a node is its
     * parent — except where the caller stated it through `parentKey`, honoured whether or not
     * an edge joins the pair. Rows are one-below-the-parent unless `depthKey` asks for a lower
     * one; a row above the parent's is clamped, since detaching the node instead would let one
     * bad number shatter the tree into extra components.
     *
     * If the graph contains cycles, each node is assigned the shortest level found first.
     *
     * @param nodes - The list of graph nodes.
     * @param edges - The list of graph edges (assumed to be directed).
     * @param options - The layout options. `rootId` is ignored when no such node is in
     *   `nodes`; when it is, the walk follows edges in either direction — as it also does for
     *   a *found* root whose arrows cannot cover the graph, see {@link MIN_DIRECTED_COVERAGE}
     *   — and `parentKey` is dropped with it, because pinning a root is a request to re-hang
     *   the tree from there.
     * @returns A mapping of each node's ID to its depth level in the tree and the maximum depth
     */
    static buildLevelsStatic(
        nodes: Node[],
        edges: Edge[],
        options: Partial<TreeLayoutOptions> = {},
    ): {
        levels: Map<string, number>
        maxDepth: number
        nodeCountPerLevel: Record<string, number>
        /** Spanning-tree parent of each node — declared, or the edge the BFS first reached it by. */
        parentOf: Map<string, string>
        /** The primary root, plus one per component the primary root cannot reach. */
        roots: string[]
        /** Nodes with no edges at all: parked rather than given a place in the hierarchy. */
        parked: string[]
        /** The rows the caller asked for, in the same numbering as `levels`. */
        declaredRows: Map<string, number>
    } {
        if (!nodes.length) {
            return {
                levels: new Map(),
                maxDepth: 0,
                nodeCountPerLevel: {},
                parentOf: new Map(),
                roots: [],
                parked: [],
                declaredRows: new Map(),
            }
        }
        // An id naming a node that is not in this set — filtered out, deleted, inside a
        // collapsed cluster — cannot root anything: the walk from it reaches nothing, so
        // every real component becomes its own root and the graph comes out as a forest one
        // level too deep. This pass falls back to the finder; the pin itself is the caller's
        // to keep, so the node coming back re-roots the tree.
        const rootId = options.rootId !== undefined && nodes.some(node => node.id === options.rootId)
            ? options.rootId
            : undefined

        // A pinned root outranks a declared parent. Picking a root is a request to re-hang the
        // tree from there, and a declared parent left in place would hold a branch back where
        // the new walk wants to take it — so `parentKey` is dropped for this pass. Declared
        // *rows* are unaffected: they say how deep a node sits, not what it hangs from.
        const declared = TreeLayout.readDeclaredHierarchy(nodes, options, rootId === undefined)

        // How the spanning tree is walked. Naming a root is a deliberate choice, so it
        // outranks arrow direction: a directed walk from a leaf reaches nothing, and the
        // graph would fall apart into the picked node plus the old tree beside it. This is
        // already the rule `EgoTreeLayout` uses. A root the *finders* chose starts out
        // walking directed — it was read off the arrows in the first place — and gives that
        // up only if the arrows turn out not to be a hierarchy, see `MIN_DIRECTED_COVERAGE`.
        let undirected = rootId !== undefined

        // Keyed by node id, so both are Maps: on a plain object a node called `constructor` or
        // `toString` reads as already-visited through the prototype and drops out of the layout.
        const levels = new Map<string, number>()
        const parentOf = new Map<string, string>(declared.parentOf)
        const adj = new Map<string, string[]>()
        const targeted = new Set<string>()
        const touched = new Set<string>()

        for (const node of nodes) {
            adj.set(node.id, [])
        }

        for (const { source, target } of edges) {
            // An edge whose source isn't in `nodes` is skipped rather than throwing.
            adj.get(source.id)?.push(target.id)
            targeted.add(target.id)
            touched.add(source.id)
            touched.add(target.id)
        }

        // A declared parent puts both ends in the hierarchy even where no edge does, and marks
        // the child as claimed so no component-root search promotes it to a root.
        for (const [child, parent] of declared.parentOf) {
            touched.add(child)
            touched.add(parent)
            targeted.add(child)
        }

        /** Make every edge walkable both ways. Idempotent only in the sense that it is called once. */
        const readEdgesBothWays = () => {
            for (const { source, target } of edges) adj.get(target.id)?.push(source.id)
            undirected = true
        }
        if (undirected) readEdgesBothWays()

        // A node no edge touches has no place in a hierarchy, so it is parked (see
        // `packParked`) and kept out of the root search, which `FirstZeroInDegree` would
        // otherwise happily root the whole tree at.
        //
        // Read off the edges being laid out, not `node.degree()`: that counts a node's own edge
        // registries, which are empty for objects built from data, so it reports 0 across a
        // perfectly connected graph. An explicitly named root — or a declared parent — counts
        // as linked even with no edges. A declared *row* does not: it says where a node sits,
        // not that it belongs in the hierarchy.
        const isLinked = (id: string) => touched.has(id) || id === rootId
        const linked = nodes.filter(node => isLinked(node.id))
        const parked = nodes.filter(node => !isLinked(node.id)).map(node => node.id)

        const hasDeclaredParents = declared.parentOf.size > 0

        /**
         * Is `ancestor` already above `id`? A declared parent and a BFS one can between them
         * close a loop the BFS alone never could: declare A's parent to be B, then let the walk
         * reach B through A and claim it as A's child.
         */
        const isAncestor = (ancestor: string, id: string): boolean => {
            const seen = new Set<string>()
            let curr: string | undefined = id
            while (curr !== undefined && !seen.has(curr)) {
                if (curr === ancestor) return true
                seen.add(curr)
                curr = parentOf.get(curr)
            }
            return false
        }

        // BFS, and the first edge to reach a node is its parent in the spanning tree — which
        // is what makes the layout total: a back-edge finds its target visited and drops out, so
        // a cycle costs nothing but that edge's place in the hierarchy.
        //
        // `reached` marks the walk rather than `levels`, since a node the caller placed is
        // parented before the walk starts and must keep that parent while still being walked.
        const reached = new Set<string>()
        const walkFrom = (start: string) => {
            if (reached.has(start)) return
            reached.add(start)
            const queue: string[] = [start]
            let index = 0
            while (index < queue.length) {
                const curr = queue[index++]
                for (const neighbor of adj.get(curr) ?? []) {
                    if (reached.has(neighbor)) continue
                    reached.add(neighbor)
                    // A node the caller already placed keeps its parent; the edge that found it
                    // is then just an edge — drawn, but with no place in the hierarchy.
                    if (!parentOf.has(neighbor) && !(hasDeclaredParents && isAncestor(neighbor, curr))) {
                        parentOf.set(neighbor, curr)
                    }
                    queue.push(neighbor)
                }
            }
        }

        // With nothing linked there is no hierarchy to root: every node is parked, and
        // `buildTreeStatic` lays them out as a grid. Searching for a root anyway would
        // promote one parked node to be the tree, and then place it twice.
        const roots: string[] = []
        if (linked.length) {
            // A node the caller hung under a parent has its place already and cannot root
            // anything, so the finders only get to choose among the rest.
            const free = hasDeclaredParents ? linked.filter(node => !parentOf.has(node.id)) : linked
            const candidates = free.length ? free : linked

            let primaryRoot = rootId ?? TreeLayout.findRootId(candidates, edges, options.rootIdAlgorithmFinder)

            // Can this root cover its component by following the arrows? A root that cannot is
            // not automatically a problem — `MinHeight` picks a *leaf* on purpose — so what
            // decides it is whether **any** node could have done better.
            //
            // Where none can, the arrows do not describe a hierarchy: that is converging data,
            // every leaf a source pointing at a few hubs, which draws as a comb of stubs with
            // most edges flying across the canvas. Reading the same edges both ways puts nearly
            // all of them back in one tree.
            //
            // So the walk gives up on direction, and the root with it — a direction-aware finder
            // has nothing useful to say about a graph its arrows cannot traverse. Deliberately a
            // fallback: where the arrows do form a hierarchy they are the best thing to lay out
            // by, and each finder keeps its own answer.
            if (rootId === undefined && TreeLayout.directedCoverage(primaryRoot, adj, edges) < MIN_DIRECTED_COVERAGE) {
                const bestPossible = findMaxReachabilityRoot(candidates, edges).id
                if (TreeLayout.directedCoverage(bestPossible, adj, edges) < MIN_DIRECTED_COVERAGE) {
                    readEdgesBothWays()
                    primaryRoot = findUndirectedCenterRoot(candidates, edges, bestPossible).id
                }
            }

            walkFrom(primaryRoot)

            // Whatever the primary root could not reach is its own component, and gets walked
            // too. Without this those nodes have no slot in the tree, and the tree forces —
            // which fall back to 0 for a node they have no position for — quietly pile them
            // all onto the origin.
            for (const node of linked) {
                if (reached.has(node.id)) continue
                // Prefer a source: a component that *is* a hierarchy should be drawn as one.
                const componentRoot = linked.find(candidate => !reached.has(candidate.id) && !targeted.has(candidate.id))
                    ?? node
                walkFrom(componentRoot.id)
            }

            // The roots are whatever nothing ended up parenting, the primary one first so it
            // keeps its place at the head of the forest.
            if (!parentOf.has(primaryRoot)) roots.push(primaryRoot)
            for (const node of linked) {
                if (node.id !== primaryRoot && !parentOf.has(node.id)) roots.push(node.id)
            }
        }

        // The row each node sits on, walked top-down from the roots: one below its parent, or
        // the row the caller asked for where that is lower still. Counted from 0 at the
        // shallowest root; the forest shift below puts them back in step with the hierarchy
        // `buildTreeStatic` actually builds.
        const childrenOf = new Map<string, string[]>()
        for (const [child, parent] of parentOf) {
            const bucket = childrenOf.get(parent) ?? []
            bucket.push(child)
            childrenOf.set(parent, bucket)
        }

        let clamped = 0
        // An explicit stack rather than recursion: a chain of declared parents can be as long
        // as the graph has nodes, which is enough to overflow on a real dataset.
        const rowsFrom = (start: string, floor: number) => {
            const stack: Array<[string, number]> = [[start, floor]]
            while (stack.length) {
                const [id, lowest] = stack.pop()!
                if (levels.has(id)) continue
                const asked = declared.rowOf.get(id)
                if (asked !== undefined && asked < lowest) clamped++
                const row = asked !== undefined && asked > lowest ? asked : lowest
                levels.set(id, row)
                for (const child of childrenOf.get(id) ?? []) stack.push([child, row + 1])
            }
        }
        for (const root of roots) rowsFrom(root, 0)
        // Nothing should be left over, but a node whose parent never got a row would otherwise
        // fall out of `levels` — and the tree forces read a missing level as 0, which piles it
        // on the origin. Cheap insurance against any hierarchy this walk failed to cover.
        for (const node of linked) {
            if (!levels.has(node.id)) rowsFrom(node.id, 0)
        }

        if (clamped) {
            declared.complaints.set('declared depths clamped to just below their parent', clamped)
        }
        TreeLayout.warnAboutDeclared(declared.complaints)

        // A forest is hung under one synthetic root (see `buildTreeStatic`), which puts every
        // real node one level deeper. Shifted here so `levels` keeps meaning "depth in the
        // laid-out hierarchy" — the radial force divides `radialGap` by `maxDepth` and would
        // otherwise disagree with the positions by exactly one ring.
        const forestShift = roots.length > 1 ? 1 : 0
        if (forestShift) {
            for (const [id, level] of levels) levels.set(id, level + forestShift)
        }

        // Accumulated in one pass: `Math.max(...levels.values())` throws on a large graph, since
        // spreading hundreds of thousands of levels blows the argument limit.
        let maxDepth = 0
        for (const level of levels.values()) {
            if (level > maxDepth) maxDepth = level
        }

        // Parked nodes count as sitting past the last level. The radial force reads `levels`
        // rather than the positions, and without this it would pull them all onto the centre.
        // A parked node that named a row keeps it: it stays parked — out of the hierarchy and
        // out of the tree's way — but on the row it asked for.
        if (parked.length) {
            const pastTheEnd = maxDepth + 1
            for (const id of parked) {
                const asked = declared.rowOf.get(id)
                levels.set(id, asked === undefined ? pastTheEnd : asked + forestShift)
            }
            for (const level of levels.values()) {
                if (level > maxDepth) maxDepth = level
            }
        }

        // Handed on in the same numbering as `levels`, so `packParked` can tell which parked
        // nodes named a row, and where that row is.
        const declaredRows = new Map<string, number>()
        for (const [id, row] of declared.rowOf) declaredRows.set(id, row + forestShift)

        const nodeCountPerLevel: Record<string, number> = {}
        for (const level of levels.values()) {
            nodeCountPerLevel[level] = (nodeCountPerLevel[level] || 0) + 1
        }

        return {
            levels: levels,
            maxDepth: maxDepth,
            nodeCountPerLevel: nodeCountPerLevel,
            parentOf: parentOf,
            roots: roots,
            parked: parked,
            declaredRows: declaredRows,
        }
    }

    /**
     * The share of `root`'s own component that `root` reaches by following the arrows — the test
     * behind {@link MIN_DIRECTED_COVERAGE}. Scored against the component, not the whole graph:
     * several separate hierarchies are *supposed* to come out as a forest, and scoring against
     * every node would read that as a failure and throw away perfectly good arrows.
     *
     * @param adj - Adjacency in its **directed** reading, before any reverse links.
     */
    private static directedCoverage(root: string, adj: Map<string, string[]>, edges: Edge[]): number {
        const reachedBy = (neighbors: Map<string, string[]>) => {
            const seen = new Set<string>([root])
            const queue = [root]
            for (let i = 0; i < queue.length; i++) {
                for (const neighbor of neighbors.get(queue[i]) ?? []) {
                    if (seen.has(neighbor)) continue
                    seen.add(neighbor)
                    queue.push(neighbor)
                }
            }
            return seen.size
        }

        const both = new Map<string, string[]>()
        for (const id of adj.keys()) both.set(id, [])
        for (const { source, target } of edges) {
            both.get(source.id)?.push(target.id)
            both.get(target.id)?.push(source.id)
        }

        const component = reachedBy(both)
        return component === 0 ? 1 : reachedBy(adj) / component
    }

    /**
     * Attempts to infer the root node of a directed graph.
     *
     * This function looks for a node that is never a target in the list of links,
     * assuming such a node is a likely root (i.e., has no incoming edges).
     * If no such node is found, it falls back to the first node in the list.
     *
     * @param nodes - The list of graph nodes.
     * @param edges - The list of graph edges (assumed to be directed).
     * @returns The ID of the inferred root node.
     */
    protected static findRootId(
        nodes: Node[],
        edges: Edge[],
        algorithm?: TreeLayoutAlgorithm
    ): string {
        switch (algorithm) {
            case 'FirstZeroInDegree':
                return findFirstZeroInDegreeNode(nodes, edges).id
            case 'MaxReachability':
                return findMaxReachabilityRoot(nodes, edges).id
            case 'MinMaxDistance':
                return findMinMaxDistanceRoot(nodes, edges).id
            case 'MinHeight':
                return findMinHeightDAGRoot(nodes, edges).id
            default:
                return findFirstZeroInDegreeNode(nodes, edges).id
        }
    }
}