import type { Node } from '../../Node'
import type { Edge } from '../../Edge'
import type { AnyTreeLayoutOptions, TreeLayoutOptions } from '../../interfaces/LayoutOptions'
import { TreeLayout, type TreeNode } from './Tree'
import { hierarchy, type HierarchyNode } from 'd3-hierarchy'
import { type Simulation as d3Simulation } from 'd3-force'
import type { Graph } from '../../Graph'
import type { SimulationForces } from '../../interfaces/SimulationOptions'


export class EgoTreeLayout extends TreeLayout {

    constructor (
            graph: Graph,
            simulation: d3Simulation<Node, undefined>,
            simulationForces: SimulationForces,
            partialOptions: Partial<AnyTreeLayoutOptions>,
        ) {
        super(graph, simulation, simulationForces, {
            ...partialOptions,
            type: 'tree',
        })
    }

    static registerForcesOnSimulation(
        nodes: Node[],
        edges: Edge[],
        simulation: d3Simulation<Node, undefined>,
        simulationForces: SimulationForces,
        partialOptions: Partial<TreeLayoutOptions>,
        canvasBCR: DOMRect,
    ): void {
        TreeLayout.registerForcesOnSimulation(
            nodes,
            edges,
            simulation,
            simulationForces,
            partialOptions,
            canvasBCR,
            EgoTreeLayout
        )
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
        return EgoTreeLayout.buildTreeStatic(nodes, edges, options, canvasBCR)
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


            if (!options.rootId || !nodeMap.get(options.rootId)) {
                throw new Error('Ego Tree can only be created with a rootId')
            }
            const rootId = options.rootId
            const root = nodeMap.get(rootId)!
            root.children = []
            if (!root) {
                throw new Error(`Root node with id "${rootId}" not found.`)
            }
    
            // Build parent-child relationships ignoring edge direction. Claimed once each:
            // a pair joined in both directions is one neighbour, not two, and listing it
            // twice would spend two slots of the ring on it.
            const claimed = new Set<string>([root.id])
            for (const edge of edges) {
                const sourceNode = nodeMap.get(edge.source.id)
                const targetNode = nodeMap.get(edge.target.id)
                if (!sourceNode || !targetNode) continue
                const neighbour = edge.source.id === root.id ? targetNode
                    : edge.target.id === root.id ? sourceNode
                        : undefined
                if (!neighbour || claimed.has(neighbour.id)) continue
                claimed.add(neighbour.id)
                root.children.push(neighbour)
                neighbour.parent = root
            }

            // Create a d3 hierarchy and compute tree layout
            const { treeLayout, offset } = EgoTreeLayout.sizedTreeLayout(options, canvasBCR)
    
            const rootHierarchy = hierarchy(root)
            const treeRoot = treeLayout(rootHierarchy)
            EgoTreeLayout.offsetTree(treeRoot.descendants(), offset)
    
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
}