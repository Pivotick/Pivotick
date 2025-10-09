import type { ForceLink as d3ForceLinkType } from 'd3-force'
import { DEFAULT_SIMULATION_OPTIONS, Simulation } from './Simulation'
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

const MAX_EXECUTION_TIME = 10000
const MAX_EXECUTION_TICKS = 20000
const REHEAT_TICKS = 0.15 * MAX_EXECUTION_TICKS

self.onmessage = (e: MessageEvent<WorkerInput>) => {
    const { nodes: plainNodes, edges: plainEdges, options, canvasBCR } = e.data

    const nodes = plainNodes.map(n => new Node(n.id, n.data, n.style))
    const nodeMap = new Map<string, Node>(nodes.map(n => [n.id, n]))

    if (options.layout?.type === 'force') {
        // const updatedOptions = Simulation.scaleSimulationOptions(options, canvasBCR, nodeMap.size)
        // options.d3ManyBodyStrength = updatedOptions.d3ManyBodyStrength ?? DEFAULT_SIMULATION_OPTIONS.d3ManyBodyStrength
        // options.d3CollideStrength = updatedOptions.d3ManyBodyStrength ?? DEFAULT_SIMULATION_OPTIONS.d3ManyBodyStrength
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

    let currentAlphaTarget = 0.3
    simulation.alphaTarget(currentAlphaTarget)
    const startTime = (new Date()).getTime() // Ensure the simulation eventually stops
    let progress
    for (let i = 0; i < warmupTicks; ++i) {
        if (
            ((new Date()).getTime() - startTime > MAX_EXECUTION_TIME) ||
            ((new Date()).getTime() - startTime > options.cooldownTime) ||
            (
                isSimulationStable(options, simulation, currentAlphaTarget) &&
                (new Date()).getTime() - startTime > options.cooldownTime * 0.15
            )
        ) {
            break
        }

        if (i % 5 === 0) {
            progress = getProgress(i, (new Date()).getTime() - startTime, options)
            postMessage({ type: 'tick', progress: progress, elapsedTime: (new Date()).getTime() - startTime })
        }
        simulation.tick()
    }

    currentAlphaTarget = 0
    simulation.alphaTarget(currentAlphaTarget)
    simulation.alpha(1) // small bump
    for (let i = 0; i < REHEAT_TICKS; ++i) {
        if (
            isSimulationStable(options, simulation, currentAlphaTarget)
        ) {
            break
        }
        simulation.tick()
        if (i % 5 === 0) {
            progress = getProgress(warmupTicks + i, (new Date()).getTime() - startTime, options)
            postMessage({ type: 'tick', progress: progress, elapsedTime: (new Date()).getTime() - startTime })
        }
    }

    postMessage({ type: 'tick', progress: 1, elapsedTime: (new Date()).getTime() - startTime })
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

function getProgress(tick: number, elapsedTime: number, options: SimulationOptions): number {
    // return tick / MAX_EXECUTION_TICKS
    return elapsedTime / options.cooldownTime
}

function isSimulationStable(options: SimulationOptions, simulation: d3.Simulation<Node, undefined>, currentAlphaTarget: number): boolean {
    return options.d3AlphaMin > 0 && (simulation.alpha() - currentAlphaTarget) < options.d3AlphaMin   
}