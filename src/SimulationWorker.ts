import type { ForceLink as d3ForceLinkType } from 'd3-force'
import { Simulation } from './Simulation'
import { Node, type NodeData, type Node as NodeType } from './Node'
import { Edge, type EdgeData, type Edge as EdgeType } from './Edge'
import type { SimulationOptions } from './GraphOptions'
import { TreeLayout } from './plugins/layout/Tree'

export interface PlainNode<T = NodeData> {
    id: string
    data?: T
    style?: T
}

export interface PlainEdge<T = EdgeData> {
    id: string
    from: PlainNode
    to: PlainNode
    data?: T
    style?: T
    directed: boolean | null
}

export interface WorkerInput {
    nodes: PlainNode[]
    edges: PlainEdge[]
    canvasBCR: DOMRect
    options: SimulationOptions
}

const MAX_EXECUTION_TIME = 2000
const MAX_EXECUTION_TICKS = 500
const REHEAT_TICKS = 0.15 * MAX_EXECUTION_TICKS

self.onmessage = (e: MessageEvent<WorkerInput>) => {
    const { nodes: plainNodes, edges: plainEdges, options, canvasBCR } = e.data

    const nodes = plainNodes.map(n => new Node(n.id, n.data, n.style))
    const nodeMap = new Map<string, Node>(nodes.map(n => [n.id, n]))

    if (options.layout?.type === 'force') {
        const updatedOptions = Simulation.scaleSimuationOptions(options, canvasBCR, nodeMap.size)
        options.d3ManyBodyStrength = updatedOptions.d3ManyBodyStrength
        options.d3CollideStrength = updatedOptions.d3ManyBodyStrength
    }

    const {simulation, simulationForces} = Simulation
        .initSimulationForces(options, canvasBCR)

    const edges: Edge[] = []
    for (const e of plainEdges) {
        const from = nodeMap.get(e.from.id)
        const to = nodeMap.get(e.to.id)
        if (from && to) {
            edges.push(new Edge(e.id, from, to, e.data, e.style, e.directed))
        }
    }
    
    simulation.nodes(nodes)
    const linkForce = simulation.force('link')
    if (linkForce) {
        (linkForce as d3ForceLinkType<NodeType, EdgeType>)
            .id((node) => node.id)
            .links(edges)
    }

    if (options.layout?.type === 'tree') {
        TreeLayout.registerForcesOnSimulation(
            nodes,
            edges,
            simulation,
            simulationForces,
            options.layout,
            canvasBCR
        )
    }

    let warmupTicks = options.warmupTicks || MAX_EXECUTION_TICKS
    warmupTicks = warmupTicks === 'auto' ? MAX_EXECUTION_TICKS : warmupTicks
    warmupTicks = warmupTicks - REHEAT_TICKS

    simulation.alphaTarget(0.3)
    const startTime = (new Date()).getTime() // Ensure the simulation eventually stops
    for (let i = 0; i < warmupTicks; ++i) {
        if ((new Date()).getTime() - startTime > MAX_EXECUTION_TIME) {
            break
        }

        if (i % 5 === 0) {
            postMessage({ type: 'tick', progress: i / MAX_EXECUTION_TICKS })
        }
        simulation.tick()
    }

    simulation.alphaTarget(0)
    simulation.alpha(1) // small bump
    for (let i = 0; i < REHEAT_TICKS; ++i) {
        simulation.tick()
        if (i % 5 === 0) {
            postMessage({ type: 'tick', progress: (warmupTicks + i) / MAX_EXECUTION_TICKS })
        }
    }

    postMessage({ type: 'tick', progress: 1 })
    if (options.layout?.type === 'tree') {
        TreeLayout.simulationDone(
            nodes,
            edges,
            simulation,
            options.layout,
            canvasBCR
        )
    }
    self.postMessage({
        type: 'done',
        nodes,
        edges,
    })
}
