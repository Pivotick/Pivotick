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
import hasCycle from '../analytics/cycle'
import { findFirstZeroInDegreeNode, findMaxReachabilityRoot, findMinHeightDAGRoot, findMinMaxDistanceRoot } from '../analytics/DAGAlgorithms'
import type { AnyTreeLayoutOptions, TreeLayoutOptions } from '../../interfaces/LayoutOptions'
import { neededLevelGap, neededSiblingGap, tuneTreeSpacing, type AutoTreeContext, type TreeGap } from '../../AutoTreeSpacing'
import type { SimulationForces } from '../../interfaces/SimulationOptions'

export type TreeLayoutAlgorithm = 'FirstZeroInDegree' | 'MaxReachability' | 'MinMaxDistance' | 'MinHeight'

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
    flipEdgeDirection: false,
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
    protected options: Required<TreeLayoutOptions>

    protected originalForceStrength: ForceStrengthArray
    protected canvasBCR!: DOMRect

    protected levels: Map<string, number>
    /** Deepest level in {@link levels}; the divisor turning `radialGap` into a ring gap. */
    protected maxDepth = 0
    /** Whether {@link update} re-derives the spacing multipliers; see {@link setSpacing}. */
    protected autoSpacing: boolean
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
        this.options = merge({}, DEFAULT_TREE_LAYOUT_OPTIONS, partialOptions) as Required<TreeLayoutOptions>
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

        const nodes = this.graph.getNodes()
        const edges = this.options.flipEdgeDirection ? this.flipEdgeDirection(this.graph.getEdges()) : this.graph.getEdges()
        if (hasCycle(nodes, edges)) {
            this.graph.notifier.warning('Tree layout unavailable', 'The graph contains a cycle, so it cannot be displayed as a tree.')
            return
        }
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
        const edges = this.options.flipEdgeDirection ? this.flipEdgeDirection(this.graph.getEdges()) : this.graph.getEdges()
        const { levels, maxDepth } = this.buildLevels(nodes, edges, undefined, this.options.rootIdAlgorithmFinder)
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
            const radius = node.expanded ? node.getCircleRadiusCollapsed() : node.getCircleRadius()
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

    protected flipEdgeDirection(edges: Edge[]): Edge[] {
        edges.forEach((edge) => {
            const tmp = edge.from
            edge.setFrom(edge.to)
            edge.setTo(tmp)
        })
        return edges
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

        if (hasCycle(nodes, edges)) {
            return
        }

        const { levels, maxDepth } = cls.buildLevelsStatic(nodes, edges, undefined, options.rootIdAlgorithmFinder)
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
        return { level: options.levelSpacing ?? 1, sibling: options.siblingSpacing ?? 1 }
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

        if (hasCycle(nodes, edges)) {
            console.warn('Cycle detected in graph. Tree layout will not be computed.')
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

        // Build parent-child relationships
        for (const edge of edges) {
            const sourceNode = nodeMap.get(edge.source.id)
            const targetNode = nodeMap.get(edge.target.id)
            if (sourceNode && targetNode) {
                sourceNode.children!.push(targetNode)
                targetNode.parent = sourceNode
            }
        }

        // Find root node
        const rootId = options.rootId || TreeLayout.findRootId(nodes, edges, options.rootIdAlgorithmFinder)
        const root = nodeMap.get(rootId)
        if (!root) {
            throw new Error(`Root node with id "${rootId}" not found.`)
        }

        // Create a d3 hierarchy and compute tree layout
        const { treeLayout, offset } = TreeLayout.sizedTreeLayout(options, canvasBCR)

        const rootHierarchy = hierarchy(root)
        const treeRoot = treeLayout(rootHierarchy)
        TreeLayout.offsetTree(treeRoot.descendants(), offset)

        const nodeById = new Map<string, HierarchyNode<TreeNode>>()
        treeRoot.descendants().forEach((node) => {
            nodeById.set(node.data.id, node)
        })

        return {
            root: treeRoot,
            nodes: treeRoot.descendants(),
            nodeById: nodeById,
        }
    }

    protected buildLevels(
        nodes: Node[],
        edges: Edge[],
        passedRootId?: string,
        rootIdAlgorithmFinder?: TreeLayoutAlgorithm
    ): {
        levels: Map<string, number>
        maxDepth: number
        nodeCountPerLevel: Record<string, number>
    } {
        return TreeLayout.buildLevelsStatic(nodes, edges, passedRootId, rootIdAlgorithmFinder)
    }

    /**
     * Builds a mapping from node ID to its level (distance from the root),
     * by traversing the graph in BFS manner. If the graph contains cycles,
     * each node is assigned the shortest level found first.
     *
     * @param nodes - The list of graph nodes.
     * @param edges - The list of graph edges (assumed to be directed).
     * @param passedRootId - The ID of the node considered as the root.
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
    } {
        if (!nodes.length) {
            return {
                levels: new Map(),
                maxDepth: 0,
                nodeCountPerLevel: {},
            }
        }
        const rootId = passedRootId || TreeLayout.findRootId(nodes, edges, rootIdAlgorithmFinder)

        // Keyed by node id, so both are Maps: on a plain object a node called `constructor` or
        // `toString` reads as already-visited through the prototype and drops out of the layout.
        const levels = new Map<string, number>([[rootId, 0]])
        const adj = new Map<string, string[]>()

        for (const node of nodes) {
            adj.set(node.id, [])
        }

        for (const { source, target } of edges) {
            // An edge whose source isn't in `nodes` is skipped rather than throwing.
            adj.get(source.id)?.push(target.id)
        }

        // Perform BFS with cycle-tolerance
        const queue: string[] = [rootId]
        let index = 0

        while (index < queue.length) {
            const curr = queue[index++]
            const currLevel = levels.get(curr) ?? 0

            for (const neighbor of adj.get(curr) ?? []) {
                // Skip if already visited (prevents infinite cycles)
                if (levels.has(neighbor)) continue

                levels.set(neighbor, currLevel + 1)
                queue.push(neighbor)
            }
        }

        // Accumulated in one pass: `Math.max(...levels.values())` throws on a large graph, since
        // spreading hundreds of thousands of levels blows the argument limit.
        let maxDepth = 0
        const nodeCountPerLevel: Record<string, number> = {}
        for (const level of levels.values()) {
            if (level > maxDepth) maxDepth = level
            nodeCountPerLevel[level] = (nodeCountPerLevel[level] || 0) + 1
        }

        return {
            levels: levels,
            maxDepth: maxDepth,
            nodeCountPerLevel: nodeCountPerLevel,
        }
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