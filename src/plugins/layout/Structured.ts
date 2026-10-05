import { type Simulation as d3Simulation } from 'd3-force'
import merge from 'lodash.merge'
import type { Graph } from '../../Graph'
import type { Node } from '../../Node'
import type { Edge } from '../../Edge'
import type { StructuredLayoutOptions } from '../../interfaces/LayoutOptions'
import type { SimulationForces } from '../../interfaces/SimulationOptions'
import { neighboursPartition } from '../../Simplification/rules'
import { arrange, type ArrangeNode, type LabelSide } from './structured/arrange'

export type { LabelSide } from './structured/arrange'

type ResolvedStructuredLayoutOptions = Required<StructuredLayoutOptions>

const DEFAULT_STRUCTURED_LAYOUT_OPTIONS: ResolvedStructuredLayoutOptions = {
    type: 'structured',
    groupMin: 3,
    direction: 'auto',
    gap: 30,
    trayPosition: 'bottom',
    labelSides: true,
}

/** What a hidden canvas is laid out for; only the proportions matter. */
const FALLBACK_CANVAS = { width: 1000, height: 800 }

/** The radius a node is spaced by when it has not measured itself yet. */
const FALLBACK_RADIUS = 10

interface ForceStrengths {
    link: number | ((edge: Edge, i: number, edges: Edge[]) => number)
    charge: number | ((node: Node, i: number, nodes: Node[]) => number)
    gravity: number
}

/**
 * Places every node itself and pins it there: see {@link StructuredLayoutOptions}. The
 * forces are turned down so nothing pulls on the pins, which leaves drag working as on
 * any pinned node.
 */
export class StructuredLayout {
    private graph: Graph
    private simulationForces: SimulationForces
    private options: ResolvedStructuredLayoutOptions
    private originalStrengths: ForceStrengths
    /** The lines the canvas draws between its own nodes; the simulation's links. */
    private links: () => Edge[]
    private labelSides = new Map<string, LabelSide>()

    constructor(
        graph: Graph,
        _simulation: d3Simulation<Node, undefined>,
        simulationForces: SimulationForces,
        partialOptions: Partial<StructuredLayoutOptions> = {},
        links: () => Edge[],
    ) {
        this.graph = graph
        this.simulationForces = simulationForces
        this.options = merge({}, DEFAULT_STRUCTURED_LAYOUT_OPTIONS, partialOptions)
        this.links = links
        this.originalStrengths = {
            link: simulationForces.link.strength(),
            charge: simulationForces.charge.strength(),
            gravity: simulationForces.gravity.strength(),
        }
        this.update()
        this.registerForces()
    }

    /**
     * Lay the canvas out again and pin every node to its place.
     *
     * @returns the nodes whose label side changed, which a drawing made before this
     *   pass shows on the old side.
     */
    public update(): Node[] {
        const nodes = this.graph.getCanvasNodes()
        const links = this.links().map(link => [link.source as Node, link.target as Node] as const)

        const arrangement = arrange(
            nodes.map(node => this.arrangeNode(node)),
            links.map(([source, target]) => [source.id, target.id]),
            this.groupKeys(nodes, links),
            { ...this.options, ...this.canvasSize() },
        )

        const changed: Node[] = []
        for (const node of nodes) {
            const position = arrangement.positions.get(node.id)
            if (!position) continue
            node.x = node.fx = position.x
            node.y = node.fy = position.y
            node.vx = node.vy = 0
            const side = arrangement.labelSides.get(node.id)
            if (this.labelSides.has(node.id) && this.labelSides.get(node.id) !== side) changed.push(node)
        }
        this.labelSides = arrangement.labelSides
        return this.options.labelSides ? changed : []
    }

    /** The side of its node this node's floated label goes on, or nothing to leave it be. */
    public getLabelSide(id: string): LabelSide | undefined {
        return this.options.labelSides ? this.labelSides.get(id) : undefined
    }

    public unregisterLayout(): void {
        this.simulationForces.link.strength(this.originalStrengths.link)
        this.simulationForces.charge.strength(this.originalStrengths.charge)
        this.simulationForces.gravity.strength(this.originalStrengths.gravity)
        for (const node of [...this.graph.getMutableNodes(), ...this.graph.simplify.getDrawnGroups()]) {
            delete node.fx
            delete node.fy
        }
        this.labelSides.clear()
    }

    private registerForces(): void {
        this.simulationForces.link.strength(0)
        this.simulationForces.charge.strength(0)
        this.simulationForces.gravity.strength(0)
    }

    private arrangeNode(node: Node): ArrangeNode {
        const measured = node.expanded ? node.getCircleRadius() : node.getLayoutRadius()
        const label = node.getData()?.label
        return {
            id: node.id,
            radius: Number.isFinite(measured) && measured > 0 ? measured : FALLBACK_RADIUS,
            sortKey: typeof label === 'string' ? label : node.id,
        }
    }

    /** Simplify's "same neighbours" partition, over the lines the canvas draws. */
    private groupKeys(nodes: Node[], links: ReadonlyArray<readonly [Node, Node]>): Map<string, string> {
        const ins = new Map<Node, Node[]>()
        const outs = new Map<Node, Node[]>()
        for (const [source, target] of links) {
            if (source === target) continue
            outs.set(source, [...outs.get(source) ?? [], target])
            ins.set(target, [...ins.get(target) ?? [], source])
        }
        return neighboursPartition({
            nodes,
            inNeighbours: node => ins.get(node) ?? [],
            outNeighbours: node => outs.get(node) ?? [],
            typeOf: node => this.graph.simplify.typeOf(node),
            groupOf: () => undefined,
        })
    }

    private canvasSize(): { width: number, height: number } {
        const rect = this.graph.renderer.getCanvas()?.getBoundingClientRect()
        return rect && rect.width > 0 && rect.height > 0
            ? { width: rect.width, height: rect.height }
            : FALLBACK_CANVAS
    }
}
