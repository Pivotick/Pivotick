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
type ResolvedTreeLayoutOptions = Required<Omit<TreeLayoutOptions, 'rootId'>> & { rootId?: string }

/** Clear space left around a parked node, on top of its own diameter. */
const PARKED_GAP = 20

/**
 * Id of the synthetic root a *forest* is hung under. Not a graph node: it exists only so
 * d3 lays the components out side by side, and is filtered out of every result.
 */
export const FOREST_ROOT_ID = '__pivotick_forest_root__'

/**
 * How much of its own component the *best available* root must reach along the arrows for
 * the spanning tree to be walked directed at all. Below this no node can traverse the
 * graph the arrows describe, so they are taken not to describe a hierarchy and the walk
 * reads every edge both ways — see {@link TreeLayout.buildLevelsStatic}.
 *
 * Half is a deliberately weak test: it should catch data that converges rather than
 * branches, and leave alone a hierarchy that merely has a few extra sources. Measured on
 * the two AIL demo graphs, each in both orientations, the two regimes sit at 1–2% and
 * 96–100% — so anything between them picks the same branch, and this is not a knob that
 * wants tuning.
 */
const MIN_DIRECTED_COVERAGE = 0.5

const DEFAULT_TREE_LAYOUT_OPTIONS: TreeLayoutOptions = {
    type: 'tree',
    rootId: undefined,
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
     * Lay the tree out — and, while `spacing: 'auto'`, re-derive the multipliers from
     * what the nodes actually need and lay it out once more.
     *
     * Two passes rather than a loop: a gap scales linearly with its multiplier, so the
     * correction {@link tuneTreeSpacing} computes from the first pass is exact. The
     * second pass is skipped entirely when it would change nothing, which is the
     * common case — including every graph that was never crowded.
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
        const { levels, maxDepth, parked } = this.buildLevels(
            // The same root the positions come from: `levels` is what the radial force
            // assigns rings by, and a different root there puts a node on a ring its
            // own position does not sit on.
            nodes, edges, this.options.rootId, this.options.rootIdAlgorithmFinder
        )
        this.parkedIds = new Set(parked)
        const { nodes: positionedNodes, nodeById: positionedNodesByID } = this.buildTree(nodes, edges, this.options, this.canvasBCR)
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
                const measured = Math.abs((next[0].node.y ?? 0) - (here[0].node.y ?? 0))
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

        const { levels, maxDepth } = cls.buildLevelsStatic(nodes, edges, options.rootId, options.rootIdAlgorithmFinder)
        const { nodeById: positionedNodesByID } = cls.buildTreeStatic(nodes, edges, options, canvasBCR)

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
     * Distance between two consecutive rings in the radial layout.
     *
     * The layout itself sizes the tree to `radialGap` and lets d3 spread `maxDepth`
     * levels across it, so this has to be the same division or the radial *force* and
     * the radial *positions* describe two different pictures. They used to: the force
     * had a hard-coded `100` per level. It goes unnoticed on the main thread, where
     * the radial layout pins `fx`/`fy` and the force never gets a say — but the worker
     * path is driven by the force alone, so the same options drew two layouts.
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
     * Re-lay-out at new spacing multipliers, keeping the root and orientation.
     *
     * The canvas is re-measured first: it is the length scale both multipliers work
     * against, and it may have been resized since the layout was built.
     *
     * The forces are then re-registered, and that is not optional. `forceX` / `forceY`
     * / `forceRadial` read their per-node target **once, at initialize time**, and
     * tick against the cached copy — so a recomputed positions map alone leaves every
     * force still pulling nodes back to where the old spacing put them. The pinned
     * axis moves anyway (`fx`/`fy` outrank forces), which makes the symptom lopsided:
     * levels spread, siblings snap back.
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
     * Re-hang the tree from another root, keeping the orientation and the spacing.
     *
     * A `rootId` pins the tree to that node — and, per {@link buildLevelsStatic}, is walked
     * without regard for edge direction, so any node gives a whole tree. An `algorithm`
     * drops the pin and lets the finder choose again.
     *
     * Goes through {@link relayout} for the same reason {@link setSpacing} does: the tree
     * forces cache their per-node target at initialize time, so recomputing the positions
     * without re-registering them leaves every node pulled back to its old slot.
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
     * The d3 tree generator, sized for the canvas and the spacing multipliers, plus
     * the offset that re-centres the result on the box it would have filled at `1×`.
     *
     * A `size`d d3 tree is normalised onto the whole box, so here the box *is* the
     * spacing — and it grows from the top-left corner. Without the offset, raising a
     * multiplier would push the tree off the bottom-right of the canvas instead of
     * expanding it in place. At `1×` the offset is zero, so the layout is unchanged.
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
     * Where to put the nodes with no relations at all.
     *
     * They have no place in a hierarchy, and giving them one anyway — a slot on the root's
     * own row — made them read as the root's children, packed tight against it because
     * `separation` squeezes same-parent siblings by their number. They go in the dead space
     * instead: the wedge beside the shallow levels, which a tree always leaves empty because
     * it widens as it descends. Pushed to the far end of it, one cell clear of the tree's
     * silhouette.
     *
     * The *trailing* end, not the leading one, because that is the side the interface leaves
     * alone: the mode rail is always down the left of the canvas and the flyouts open over it,
     * so nodes parked there would sit behind a panel.
     *
     * Deliberately *inside* the layout's bounding box. The view is fitted, so a node parked
     * outside it would zoom the entire tree out to make room for a stray dot — and below the
     * tree, where the wedge does not exist, is also where the tree is widest.
     *
     * Positions are in hierarchy space (`x` breadth, `y` depth — angle and radius when
     * radial), the same as everything `buildTreeStatic` returns, so `setNodePositions` maps
     * them for whichever orientation is in force.
     */
    protected static packParked(
        parked: TreeNode[],
        laidOut: HierarchyNode<TreeNode>[],
        options: TreeLayoutOptions,
        canvasBCR: DOMRect,
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

        if (options.radial) {
            // No wedge on a disc: one more ring, outside the last.
            const rings = new Set(ys).size
            const outer = ys.length ? Math.max(...ys) : options.radialGap
            const ringGap = rings > 0 ? outer / rings : outer
            return parked.map((node, index) => standIn(
                node,
                (index * 2 * Math.PI) / parked.length,
                outer + ringGap,
                rings + 1,
            ))
        }

        if (!laidOut.length) {
            // Nothing but parked nodes: they are the layout, so grid them over the canvas.
            const perRow = Math.max(1, Math.floor(canvasBCR.width / cell))
            return parked.map((node, index) => standIn(
                node,
                (index % perRow) * cell,
                Math.floor(index / perRow) * cell,
                0,
            ))
        }

        // The tree's silhouette: how far it reaches on each of its rows, on the side the
        // parked nodes are going.
        const treeEdgeByRow = new Map<number, number>()
        for (const node of laidOut) {
            const row = node.y ?? 0
            const x = node.x ?? 0
            treeEdgeByRow.set(row, Math.max(treeEdgeByRow.get(row) ?? x, x))
        }
        const rows = [...treeEdgeByRow.keys()].sort((a, b) => a - b)
        const boxLeft = Math.min(...xs)
        const boxRight = Math.max(...xs)
        const rowGap = rows.length > 1 ? rows[1] - rows[0] : cell

        const positions: HierarchyNode<TreeNode>[] = []
        let next = 0
        for (const [index, row] of rows.entries()) {
            if (next >= parked.length) break
            const wedge = boxRight - ((treeEdgeByRow.get(row) ?? boxRight) + cell)
            const fits = Math.floor(wedge / cell)
            for (let column = 0; column < fits && next < parked.length; column++) {
                positions.push(standIn(parked[next++], boxRight - column * cell, row, index))
            }
        }

        // More parked nodes than the wedge holds: carry on in rows under the tree, which is
        // the one direction still free once the wedge is full.
        const perRow = Math.max(1, Math.floor((boxRight - boxLeft) / cell))
        const lastRow = rows[rows.length - 1]
        for (let index = 0; next < parked.length; index++) {
            positions.push(standIn(
                parked[next++],
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
    ): {
        root: HierarchyNode<TreeNode> | null
        nodes: HierarchyNode<TreeNode>[]
        nodeById: Map<string, HierarchyNode<TreeNode>>
    } {
        return TreeLayout.buildTreeStatic(nodes, edges, options, canvasBCR)
    }

    static buildTreeStatic(
        nodes: Node[],
        edges: Edge[],
        options: TreeLayoutOptions,
        canvasBCR: DOMRect,
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
        const { parentOf, roots, parked } = TreeLayout.buildLevelsStatic(
            nodes, edges, options.rootId, options.rootIdAlgorithmFinder
        )
        for (const [childId, parentId] of parentOf) {
            const child = nodeMap.get(childId)
            const parent = nodeMap.get(parentId)
            if (!child || !parent) continue
            parent.children.push(child)
            child.parent = parent
        }

        const parkedNodes = parked
            .map(id => nodeMap.get(id))
            .filter((node): node is TreeNode => Boolean(node))

        const root = TreeLayout.hierarchyRootFor(roots, nodeMap)
        if (!root) {
            // Every node is parked: there is no hierarchy to lay out, only the grid.
            if (!roots.length && parkedNodes.length) {
                const only = TreeLayout.packParked(parkedNodes, [], options, canvasBCR)
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

        const laidOut = treeRoot.descendants().filter(node => node.data.id !== FOREST_ROOT_ID)
        const parkedPositions = TreeLayout.packParked(parkedNodes, laidOut, options, canvasBCR)

        const nodeById = new Map<string, HierarchyNode<TreeNode>>()
        for (const node of parkedPositions) nodeById.set(node.data.id, node)
        treeRoot.descendants().forEach((node) => {
            if (node.data.id === FOREST_ROOT_ID) return
            nodeById.set(node.data.id, node)
        })

        return {
            root: treeRoot,
            nodes: [...laidOut, ...parkedPositions],
            nodeById: nodeById,
        }
    }

    /**
     * The node to hang the hierarchy off. A graph with one component roots the tree at its
     * own root; a graph with several is a *forest*, and gets a synthetic root holding one
     * component per child — which is what lays them out side by side instead of on top of
     * each other. It is not a graph node and is dropped from everything returned, so it is
     * never drawn and never positioned.
     */
    private static hierarchyRootFor(roots: string[], nodeMap: Map<string, TreeNode>): TreeNode | undefined {
        if (roots.length === 1) return nodeMap.get(roots[0])
        const children = roots.map(id => nodeMap.get(id)).filter((node): node is TreeNode => Boolean(node))
        if (!children.length) return undefined
        return { id: FOREST_ROOT_ID, children } as unknown as TreeNode
    }

    protected buildLevels(
        nodes: Node[],
        edges: Edge[],
        passedRootId?: string,
        rootIdAlgorithmFinder?: TreeLayoutAlgorithm
    ): ReturnType<typeof TreeLayout.buildLevelsStatic> {
        return TreeLayout.buildLevelsStatic(nodes, edges, passedRootId, rootIdAlgorithmFinder)
    }

    /**
     * Builds a mapping from node ID to its level (distance from the root),
     * by traversing the graph in BFS manner. If the graph contains cycles,
     * each node is assigned the shortest level found first.
     *
     * @param nodes - The list of graph nodes.
     * @param edges - The list of graph edges (assumed to be directed).
     * @param passedRootId - The ID of the node considered as the root. Ignored when no such
     *   node is in `nodes`; when it is, the walk follows edges in either direction — as it
     *   also does for a *found* root whose arrows cannot cover the graph, see
     *   {@link MIN_DIRECTED_COVERAGE}.
     * @param rootIdAlgorithmFinder - The algorithm to use to find the root ID.
     * @returns A mapping of each node's ID to its depth level in the tree and the maximum depth
     */
    static buildLevelsStatic(
        nodes: Node[],
        edges: Edge[],
        passedRootId?: string,
        rootIdAlgorithmFinder?: TreeLayoutAlgorithm
    ): {
        levels: Map<string, number>
        maxDepth: number
        nodeCountPerLevel: Record<string, number>
        /** Spanning-tree parent of each node — the edge the BFS first reached it by. */
        parentOf: Map<string, string>
        /** The primary root, plus one per component the primary root cannot reach. */
        roots: string[]
        /** Nodes with no edges at all: parked rather than given a place in the hierarchy. */
        parked: string[]
    } {
        if (!nodes.length) {
            return {
                levels: new Map(),
                maxDepth: 0,
                nodeCountPerLevel: {},
                parentOf: new Map(),
                roots: [],
                parked: [],
            }
        }
        // An id naming a node that is not in this set — filtered out, deleted, inside a
        // collapsed cluster — cannot root anything: the walk from it reaches nothing, so
        // every real component becomes its own root and the graph comes out as a forest one
        // level too deep. This pass falls back to the finder; the pin itself is the caller's
        // to keep, so the node coming back re-roots the tree.
        const rootId = passedRootId !== undefined && nodes.some(node => node.id === passedRootId)
            ? passedRootId
            : undefined

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
        const parentOf = new Map<string, string>()
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

        /** Make every edge walkable both ways. Idempotent only in the sense that it is called once. */
        const readEdgesBothWays = () => {
            for (const { source, target } of edges) adj.get(target.id)?.push(source.id)
            undirected = true
        }
        if (undirected) readEdgesBothWays()

        // A node no edge touches has no place in a hierarchy — nothing points at it and it
        // points at nothing. It is parked instead (see `packParked`), and kept out of the root
        // search: `FirstZeroInDegree` would happily root the whole tree at one.
        //
        // Read off the edges being laid out rather than from `node.degree()`, which counts a
        // node's own edge registries — and those are empty for the objects a graph builds from
        // data, so it reports 0 for every node in a perfectly connected graph.
        // An explicitly named root counts as linked even with no edges: naming it is a
        // deliberate choice, and honouring it beats parking it.
        const isLinked = (id: string) => touched.has(id) || id === rootId
        const linked = nodes.filter(node => isLinked(node.id))
        const parked = nodes.filter(node => !isLinked(node.id)).map(node => node.id)

        // BFS, and the first edge to reach a node is its parent in the spanning tree. This
        // is what makes the layout total: a back-edge finds its target already visited and
        // is simply not part of the tree, so a cycle costs the graph nothing but that edge's
        // place in the hierarchy — and a node with two parents is claimed by exactly one.
        const walkFrom = (start: string) => {
            levels.set(start, 0)
            const queue: string[] = [start]
            let index = 0
            while (index < queue.length) {
                const curr = queue[index++]
                const currLevel = levels.get(curr) ?? 0
                for (const neighbor of adj.get(curr) ?? []) {
                    if (levels.has(neighbor)) continue
                    levels.set(neighbor, currLevel + 1)
                    parentOf.set(neighbor, curr)
                    queue.push(neighbor)
                }
            }
        }

        // With nothing linked there is no hierarchy to root: every node is parked, and
        // `buildTreeStatic` lays them out as a grid. Searching for a root anyway would
        // promote one parked node to be the tree, and then place it twice.
        const roots: string[] = []
        if (linked.length) {
            let primaryRoot = rootId ?? TreeLayout.findRootId(linked, edges, rootIdAlgorithmFinder)

            // Can this root cover its component by following the arrows? A root that cannot
            // is not automatically a problem — `MinHeight` picks a *leaf* of any tree, which
            // reaches nothing and is meant to, so the question that decides it is whether
            // **any** node could have done better.
            //
            // Where none can, the arrows do not describe a hierarchy at all. That is what
            // *converging* data looks like — every leaf a source, all of them pointing at a
            // few hubs — and it is the shape of the AIL demo graph, whose best possible root
            // sees 7 of its 300 nodes: 259 nodes become roots of their own and only 41 of the
            // 300 edges keep a place in the hierarchy, so it draws as a comb of stubs with the
            // other 259 edges flying across the canvas. Reading the same edges both ways puts
            // 299 of the 300 back in the tree under a single root.
            //
            // So the walk gives up on direction, and the root with it — a direction-aware
            // finder has nothing useful to say about a graph its arrows cannot traverse.
            // Deliberately a *fallback* and not the rule: where the arrows do form a
            // hierarchy they are the best thing to lay out by, an org chart's natural root is
            // the node at the top rather than the node in the middle, and each finder keeps
            // its own answer — including the ones that deliberately name a leaf.
            if (rootId === undefined && TreeLayout.directedCoverage(primaryRoot, adj, edges) < MIN_DIRECTED_COVERAGE) {
                const bestPossible = findMaxReachabilityRoot(linked, edges).id
                if (TreeLayout.directedCoverage(bestPossible, adj, edges) < MIN_DIRECTED_COVERAGE) {
                    readEdgesBothWays()
                    primaryRoot = findUndirectedCenterRoot(linked, edges, bestPossible).id
                }
            }

            roots.push(primaryRoot)
            walkFrom(primaryRoot)
        }

        // Whatever the primary root could not reach is its own component, and gets its own
        // root. Without this those nodes have no slot in the tree, and the tree forces —
        // which fall back to 0 for a node they have no position for — quietly pile them all
        // onto the origin.
        if (levels.size < linked.length) {
            for (const node of linked) {
                if (levels.has(node.id)) continue
                // Prefer a source: a component that *is* a hierarchy should be drawn as one.
                const componentRoot = linked.find(candidate => !levels.has(candidate.id) && !targeted.has(candidate.id))
                    ?? node
                roots.push(componentRoot.id)
                walkFrom(componentRoot.id)
            }
        }

        // A forest is hung under one synthetic root (see `buildTreeStatic`), which puts every
        // real node one level deeper. Shifted here so `levels` keeps meaning "depth in the
        // laid-out hierarchy" — the radial force divides `radialGap` by `maxDepth` and would
        // otherwise disagree with the positions by exactly one ring.
        if (roots.length > 1) {
            for (const [id, level] of levels) levels.set(id, level + 1)
        }

        // Accumulated in one pass: `Math.max(...levels.values())` throws on a large graph, since
        // spreading hundreds of thousands of levels blows the argument limit.
        let maxDepth = 0
        for (const level of levels.values()) {
            if (level > maxDepth) maxDepth = level
        }

        // Parked nodes count as sitting past the last level. The radial force reads `levels`
        // rather than the positions, and without this it would pull them all onto the centre.
        if (parked.length) {
            maxDepth += 1
            for (const id of parked) levels.set(id, maxDepth)
        }

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
        }
    }

    /**
     * The share of `root`'s own component that `root` reaches by following the arrows —
     * the test behind {@link MIN_DIRECTED_COVERAGE}.
     *
     * Measured against the component rather than the whole graph on purpose: a graph of
     * several separate hierarchies is *supposed* to come out as a forest, and scoring
     * against every node would read that as a failure and throw away the arrows for a
     * graph whose arrows are perfectly good.
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