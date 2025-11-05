import {
    forceRadial as d3ForceRadial,
    forceX as d3ForceX,
    forceY as d3ForceY,
} from 'd3-force'
import { type Simulation as d3Simulation } from 'd3-force'
import { hierarchy, type HierarchyNode, tree } from 'd3-hierarchy'
import merge from 'lodash.merge'
import type { Graph } from '../../Graph'
import type { simulationForces } from '../../Simulation'
import type { Node } from '../../Node'
import type { Edge } from '../../Edge'
import hasCycle from '../analytics/cycle'
import { findFirstZeroInDegreeNode, findMaxReachabilityRoot, findMinHeightDAGRoot, findMinMaxDistanceRoot } from '../analytics/DAGAlgorithms'
import type { TreeLayoutOptions } from '../../GraphOptions'

export type TreeLayoutAlgorithm = 'FirstZeroInDegree' | 'MaxReachability' | 'MinMaxDistance' | 'MinHeight'

const DEFAULT_TREE_LAYOUT_OPTIONS: TreeLayoutOptions = {
    type: 'tree',
    rootId: undefined,
    rootIdAlgorithmFinder: 'MaxReachability',
    strength: 0.25,
    radial: false,
    radialGap: 750,
    horizontal: false,
    flipEdgeDirection: false,
}

export interface TreeNode extends Node {
    children?: TreeNode[]
    parent?: TreeNode
    x?: number
    y?: number
}

interface ForceStrengthArray {
    link: number | ((edge: Edge, i: number, edges: Edge[]) => number)
    charge: number | ((node: Node, i: number, nodes: Node[]) => number)
    center: number
    gravity: number
}

export class TreeLayout {
    private graph: Graph
    private simulation: d3Simulation<Node, undefined>
    private simulationForces: simulationForces
    private options: Required<TreeLayoutOptions>

    private originalForceStrength: ForceStrengthArray
    private canvasBCR!: DOMRect

    private levels: Record<string, number>
    private positionedNodesByID: Map<string, HierarchyNode<TreeNode>>

    constructor (
        graph: Graph,
        simulation: d3Simulation<Node, undefined>,
        simulationForces: typeof this.simulationForces,
        partialOptions: Partial<TreeLayoutOptions> = {},
    ) {
        this.graph = graph
        this.simulation = simulation
        this.simulationForces = simulationForces
        this.options = merge({}, DEFAULT_TREE_LAYOUT_OPTIONS, partialOptions) as Required<TreeLayoutOptions>
        this.originalForceStrength = {
            link: this.simulationForces.link.strength(),
            charge: this.simulationForces.charge.strength(),
            center: this.simulationForces.center.strength(),
            gravity: this.simulationForces.gravity.strength(),
        }

        this.positionedNodesByID = new Map()
        this.levels = {}

        const nodes = this.graph.getNodes()
        const edges = this.options.flipEdgeDirection ? this.flipEdgeDirection(this.graph.getEdges()) : this.graph.getEdges()
        if (hasCycle(nodes, edges)) {
            this.graph.Notifier.warning('Tree layout unavailable', 'The graph contains a cycle, so it cannot be displayed as a tree.')
            return
        }
        this.setSizes()
        this.update()
        this.registerForces()
    }

    public update(): void {
        const nodes = this.graph.getNodes()
        const edges = this.options.flipEdgeDirection ? this.flipEdgeDirection(this.graph.getEdges()) : this.graph.getEdges()
        const { levels } = TreeLayout.buildLevels(nodes, edges, undefined, this.options.rootIdAlgorithmFinder)
        const { nodes: positionedNodes, nodeById: positionedNodesByID } = TreeLayout.buildTree(nodes, edges, this.options, this.canvasBCR)
        this.positionedNodesByID = positionedNodesByID

        this.levels = levels
        if (positionedNodes) {
            this.setNodePositions(positionedNodes, this.options)
        }
    }

    private flipEdgeDirection(edges: Edge[]): Edge[] {
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

    private setNodePositions(positionedNodes: HierarchyNode<TreeNode>[], options: TreeLayoutOptions): void {
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

    private unsetNodePositions(): void {
        this.graph.getMutableNodes().forEach(mutableNode => {
            delete mutableNode.fy
            delete mutableNode.fx
        })
    }

    private registerForces(): void {
        const strength = this.options.strength ?? 0.1
        if (this.options.radial) {
            const radialForce = d3ForceRadial<Node>(
                (node: Node) => (this.levels[node.id] ?? 1) * 100,
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

    private unregisterForces(): void {
        this.simulation.force('tree-radial', null)
        this.simulation.force('tree-y', null)
        this.simulation.force('tree-x', null)
        TreeLayout.resetOtherSimulationForces(this.simulationForces, this.originalForceStrength)
    }

    static registerForcesOnSimulation(
        nodes: Node[],
        edges: Edge[],
        simulation: d3Simulation<Node, undefined>,
        simulationForces: simulationForces,
        partialOptions: Partial<TreeLayoutOptions>,
        canvasBCR: DOMRect,
    ): void {
        const options = merge({}, DEFAULT_TREE_LAYOUT_OPTIONS, partialOptions)
        const strength = options.strength ?? 0.1
        const width = canvasBCR.width
        const height = canvasBCR.height
        const center = [width / 2, height / 2]

        if (hasCycle(nodes, edges)) {
            return
        }

        const { levels } = TreeLayout.buildLevels(nodes, edges, undefined, options.rootIdAlgorithmFinder)
        const { nodeById: positionedNodesByID } = TreeLayout.buildTree(nodes, edges, options, canvasBCR)

        if (options.radial) {
            const radialForce = d3ForceRadial<Node>(
                (node: Node) => (levels[node.id] ?? 1) * 100,
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

        TreeLayout.adjustOtherSimulationForces(simulationForces, options)
    }

    static adjustOtherSimulationForces(simulationForces: simulationForces, options: Partial<TreeLayoutOptions>): void {
        if (options?.radial) {
            simulationForces.link.strength(0)
            simulationForces.charge.strength(0)
            simulationForces.center.strength(0)
            simulationForces.gravity.strength(0)
        } else {
            simulationForces.link.strength(0)
            simulationForces.charge.strength(0)
            simulationForces.gravity.strength(0.00001)
            simulationForces.center.strength(0.00001)
        }
    }
    
    static resetOtherSimulationForces(
        simulationForces: simulationForces,
        originalForceStrength: ForceStrengthArray
    ): void {
        simulationForces.link.strength(originalForceStrength.link)
        simulationForces.charge.strength(originalForceStrength.charge)
        simulationForces.center.strength(originalForceStrength.center)
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

    static buildTree(
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
        const radius = options.radialGap
        const width = options.radial ? 2 * Math.PI : canvasBCR.width
        const height = options.radial ? radius : canvasBCR.height

        const treeLayout = tree<TreeNode>()
        if (options.radial) {
            treeLayout.size([width, height])
        } else {
            treeLayout
                .size([width, height])
                // .nodeSize(options.horizontal ? [100, 50] : [50, 100])
                .separation((a, b) => {
                    const siblingsCount = a.parent?.children?.length ?? 1
                    return a.parent === b.parent ? 1.5 / siblingsCount : 1.5
                })
        }

        const rootHierarchy = hierarchy(root)
        const treeRoot = treeLayout(rootHierarchy)

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
    static buildLevels(
        nodes: Node[],
        edges: Edge[],
        passedRootId?: string,
        rootIdAlgorithmFinder?: TreeLayoutAlgorithm
    ): {
        levels: Record<string, number>
        maxDepth: number
        nodeCountPerLevel: Record<string, number>
    } {
        if (!nodes.length) {
            return {
                levels: {},
                maxDepth: 0,
                nodeCountPerLevel: {},
            }
        }
        const rootId = passedRootId || TreeLayout.findRootId(nodes, edges, rootIdAlgorithmFinder)

        const levels = { [rootId]: 0 }
        const adj: Record<string, string[]> = {}

        for (const node of nodes) {
            adj[node.id] = []
        }

        for (const { source, target } of edges) {
            adj[source.id].push(target.id)
        }

        // Perform BFS with cycle-tolerance
        const queue: string[] = [rootId]
        let index = 0

        while (index < queue.length) {
            const curr = queue[index++]
            const currLevel = levels[curr]

            for (const neighbor of adj[curr] || []) {
                // Skip if already visited (prevents infinite cycles)
                if (neighbor in levels) continue

                levels[neighbor] = currLevel + 1
                queue.push(neighbor)
            }
        }

        const maxDepth = Math.max(...Object.values(levels))
        const nodeCountPerLevel: Record<string, number> = {}
        for (const level of Object.values(levels)) {
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
    private static findRootId(
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