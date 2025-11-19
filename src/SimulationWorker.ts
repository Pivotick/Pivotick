import type { ForceLink as d3ForceLinkType } from 'd3-force'
import { Simulation } from './Simulation'
import { Node, type NodeData } from './Node'
import { Edge, type EdgeData } from './Edge'
import { TreeLayout } from './plugins/layout/Tree'
import type { SimulationOptions } from './interfaces/SimulationOptions'
import type { EdgeFullStyle } from './interfaces/RendererOptions'

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
    source: string
    nodes: PlainNode[]
    edges: PlainEdge[]
    canvasBCR: DOMRect
    options: SimulationOptions
}

const MAX_EXECUTION_TIME = 10000
const MAX_EXECUTION_TICKS = 20000
const REHEAT_TICKS = 0.15 * MAX_EXECUTION_TICKS

self.onmessage = (e: MessageEvent<WorkerInput>) => {

    if (e.data.source !== 'simulation-worker-wrapper') return
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
            // normalize/cast incoming style to the EdgeFullStyle expected by Edge
            const edgeStyle = (e.style ?? {}) as unknown as EdgeFullStyle
            edges.push(new Edge(e.id, from, to, e.data, edgeStyle, e.directed))
        }
    }
    
    simulation.nodes(nodes)
    const linkForce = simulation.force('link')
    if (linkForce) {
        (linkForce as d3ForceLinkType<Node, Edge>)
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
            isSimulationStable(options, simulation, currentAlphaTarget) &&
            (new Date()).getTime() - startTime > options.cooldownTime * 0.15
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
            options.layout
        )
    }
    self.postMessage({
        type: 'done',
        nodes,
        edges,
    })
}

export function runSimulation(plainNodes: Node[], plainEdges: Edge[], options: SimulationOptions, canvasBCR: DOMRect): { nodes: Node[]; edges: Edge[] } {
    const nodes = plainNodes.map(n => new Node(n.id, n.getData(), n.getStyle()))
    const nodeMap = new Map<string, Node>(nodes.map(n => [n.id, n]))

    if (options.layout?.type === 'force') {
        // const updatedOptions = Simulation.scaleSimulationOptions(options, canvasBCR, nodeMap.size)
        // options.d3ManyBodyStrength = updatedOptions.d3ManyBodyStrength ?? DEFAULT_SIMULATION_OPTIONS.d3ManyBodyStrength
        // options.d3CollideStrength = updatedOptions.d3ManyBodyStrength ?? DEFAULT_SIMULATION_OPTIONS.d3ManyBodyStrength
    }

    const { simulation, simulationForces } = Simulation
        .initSimulationForces(options, canvasBCR)

    const edges: Edge[] = []
    for (const e of plainEdges) {
        const from = nodeMap.get(e.from.id)
        const to = nodeMap.get(e.to.id)
        if (from && to) {
            // normalize/cast incoming style to the EdgeFullStyle expected by Edge
            const edgeStyle = (e.getStyle() ?? {}) as unknown as EdgeFullStyle
            edges.push(new Edge(e.id, from, to, e.getData(), edgeStyle, e.directed))
        }
    }

    simulation.nodes(nodes)
    const linkForce = simulation.force('link')
    if (linkForce) {
        (linkForce as d3ForceLinkType<Node, Edge>)
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

        simulation.tick()
    }

    currentAlphaTarget = 0
    simulation.alphaTarget(currentAlphaTarget)
    simulation.alpha(1) // small bump
    for (let i = 0; i < REHEAT_TICKS; ++i) {
        if (
            isSimulationStable(options, simulation, currentAlphaTarget) &&
            (new Date()).getTime() - startTime > options.cooldownTime * 0.15
        ) {
            break
        }
        simulation.tick()
    }

    if (options.layout?.type === 'tree') {
        TreeLayout.simulationDone(
            nodes,
            edges,
            simulation,
            options.layout
        )
    }
    return {
        nodes: nodes,
        edges: edges,
    }
}

function getProgress(_tick: number, elapsedTime: number, options: SimulationOptions): number {
    // return tick / MAX_EXECUTION_TICKS
    return elapsedTime / options.cooldownTime
}

function isSimulationStable(options: SimulationOptions, simulation: d3.Simulation<Node, undefined>, currentAlphaTarget: number): boolean {
    return options.d3AlphaMin > 0 && (simulation.alpha() - currentAlphaTarget) < options.d3AlphaMin   
}