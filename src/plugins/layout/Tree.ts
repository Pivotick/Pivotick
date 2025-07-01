import {
    forceRadial as d3ForceRadial,
    forceX as d3ForceX,
    forceY as d3ForceY,
} from 'd3-force'
import { type Simulation as d3Simulation } from 'd3-force'
import merge from 'lodash.merge'
import type { Graph } from '../../Graph'
import type { simulationForces } from '../../Simulation'
import type { Node } from '../../Node'
import type { Edge } from '../../Edge'

export interface TreeLayoutOptions {
    rootId: string | undefined
    strength: number // Force strength (default 0.1)
    radial: boolean  // Use radial tree layout
}

const DEFAULT_TREE_LAYOUT_OPTIONS: TreeLayoutOptions = {
    rootId: undefined,
    strength: 0.1,
    radial: false,
}

export class TreeLayout {
    private graph: Graph
    private simulation: d3Simulation<Node, undefined>
    private simulationForces: simulationForces
    private options: Required<TreeLayoutOptions>

    private width: number
    private height: number
    private center: number[]

    private levels: Record<string, number>
    private maxDepth: number

    constructor (
        graph: Graph,
        simulation: d3Simulation<Node, undefined>,
        simulationForces: typeof this.simulationForces,
        partialOptions: Partial<TreeLayoutOptions> = {}
    ) {
        this.graph = graph
        this.simulation = simulation
        this.simulationForces = simulationForces
        this.options = merge({}, DEFAULT_TREE_LAYOUT_OPTIONS, partialOptions)

        this.width = 0
        this.height = 0
        this.center = [0, 0]
        this.levels = {}
        this.maxDepth = 0

        this.setSizes()
        this.update()
        this.registerForces()
    }

    public update(): void {
        const nodes = this.graph.getNodes()
        const edges = this.graph.getEdges()
        const { levels, maxDepth } = TreeLayout.buildLevels(nodes, edges)
        this.levels = levels
        this.maxDepth = maxDepth
    }

    private setSizes(): void {
        const canvas = this.graph.renderer.getCanvas()
        if (!canvas) {
            throw new Error('Canvas element is not defined in the graph renderer.')
        }
        const canvasBCR = canvas.getBoundingClientRect()
        this.width = canvasBCR.width
        this.height = canvasBCR.height
        this.center = [this.width / 2, this.height / 2]
    }

    private registerForces(): void {
        
        const strength = this.options.strength ?? 0.1
        if (this.options.radial) {
            // Radial tree force: arrange by radius from center
            const radialForce = d3ForceRadial<Node>(
                (node: Node) => (this.levels[node.id] ?? 1) * 100,
                this.center[0],
                this.center[1]
            ).strength(strength)
            this.simulation.force('tree-radial', radialForce)
        } else {
            // X by depth, Y for layering
            this.simulation.force('tree-x', d3ForceX((node: Node) =>
                ((this.levels[node.id] ?? 0) / this.maxDepth) * this.width
            ).strength(strength))

            this.simulation.force('tree-y', d3ForceY(() =>
                this.center[1]
            ).strength(strength / 2))
        }

        TreeLayout.adjustOtherSimulationForces(this.simulationForces)
    }

    static registerForcesOnSimulation(
        nodes: Node[],
        edges: Edge[],
        simulation: d3Simulation<Node, undefined>,
        simulationForces: simulationForces,
        options: Partial<TreeLayoutOptions>,
        canvasBCR: DOMRect,
    ): void {
        const strength = options.strength ?? 0.1
        const { levels, maxDepth } = TreeLayout.buildLevels(nodes, edges)
        const width = canvasBCR.width
        const height = canvasBCR.height
        const center = [width / 2, height / 2]

        if (options.radial) {
            // Radial tree force: arrange by radius from center
            const radialForce = d3ForceRadial<Node>(
                (node: Node) => (levels[node.id] ?? 1) * 100,
                center[0],
                center[1]
            ).strength(strength)
            simulation.force('tree-radial', radialForce)
        } else {
            // X by depth, Y for layering
            simulation.force('tree-x', d3ForceX((node: Node) =>
                ((levels[node.id] ?? 0) / maxDepth) * width
            ).strength(strength))

            simulation.force('tree-y', d3ForceY(() =>
                center[1]
            ).strength(strength / 2))
        }

        TreeLayout.adjustOtherSimulationForces(simulationForces)
    }

    static adjustOtherSimulationForces(simulationForces: simulationForces): void {
        return
        simulationForces.link.distance(70).strength(0.5)
        simulationForces.charge.strength(-50)
    }

    /**
     * Builds a mapping from node ID to its level (distance from the root),
     * by traversing the graph in BFS manner. If the graph contains cycles,
     * each node is assigned the shortest level found first.
     *
     * @param nodes - The list of graph nodes.
     * @param edges - The list of graph edges (assumed to be directed).
     * @param passedRootId - The ID of the node considered as the root.
     * @returns A mapping of each node's ID to its depth level in the tree and the maximum depth
     */
    static buildLevels(
        nodes: Node[],
        edges: Edge[],
        passedRootId?: string
    ): { levels: Record<string, number>; maxDepth: number } {
        if (!nodes.length) {
            return {
                levels: {},
                maxDepth: 0,
            }
        }
        const rootId = passedRootId || TreeLayout.findRootId(nodes, edges)

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
        return {
            levels: levels,
            maxDepth: maxDepth
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
        edges: Edge[]
    ): string {
        const targets = new Set(edges.map(e => e.target.id))
        for (const node of nodes) {
            if (!targets.has(node.id)) return node.id
        }
        return nodes[0].id
    }
}