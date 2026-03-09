// import { drag as d3Drag } from 'd3-drag'
// import { type Selection } from 'd3-selection'
// import { forceSimulation, forceManyBody, forceCenter, forceCollide } from 'd3-force'
// import type { SimulationNodeDatum } from 'd3-force'
// import type { Node } from '../../Node'

// interface MicroForceOptions {
//     repulsion?: number       // negative for repelling children
//     linkDistance?: number    // optional distance for internal links
//     linkStrength?: number    // optional link strength
//     iterations?: number      // number of simulation ticks per update
//     parentPadding?: number   // padding inside parent circle
// }

// /**
//  * Runs a micro D3 force simulation on children nodes inside a parent node.
//  * Updates x/y of each child node relative to the parent and constrains them inside parentRadius.
//  */
// export function simulateChildrenInsideParent(
//     nodeSelection: Selection<SVGGElement, Node, SVGGElement, Node>,
//     children: Node[],
//     parentX: number,
//     parentY: number,
//     parentRadius: number,
//     options: MicroForceOptions = {}
// ) {
//     const {
//         repulsion = -10,
//         iterations = 6,
//         parentPadding = 5
//     } = options

//     if (!children?.length) return

//     // Initialize positions
//     children.forEach(child => {
//         child.x = child.x ?? 0
//         child.y = child.y ?? 0
//         child.vx = child.vx ?? 0
//         child.vy = child.vy ?? 0
//     })


//     // 1️⃣ Create a D3 simulation
//     const simulation = forceSimulation(children)
//         .alphaDecay(0.1)
//         .velocityDecay(0.3)
//         .force('charge', forceManyBody().strength(repulsion))
//         .force('center', forceCenter(parentX, parentY))
//         // Optional: small collide to keep children from overlapping
//         .force('collide', forceCollide<Node>().radius(d => (d.getCircleRadius?.() ?? 10) + 2))
//         .force('constrainParent', constrainParent(parentX, parentY, parentRadius, parentPadding))
//         .on('tick', ticked)

//     // 2️⃣ Stabilize with a few pre-ticks
//     simulation.tick(iterations)

//     // 3️⃣ Apply drag to children
//     nodeSelection.call(drag(simulation))

//     function ticked() {
//         nodeSelection
//             .attr('transform', d => {
//                 const x = d.x ?? parentX
//                 const y = d.y ?? parentY
//                 return `translate(${x},${y})`
//             })
//     }

//     function drag(simulation) {
//         function dragstarted(event: any) {
//             if (!event.active) simulation.alphaTarget(0.3).restart()
//             event.subject.fx = event.subject.x
//             event.subject.fy = event.subject.y
//         }

//         function dragged(event: any) {
//             event.subject.fx = event.x
//             event.subject.fy = event.y
//         }

//         function dragended(event: any) {
//             if (!event.active) simulation.alphaTarget(0)
//             event.subject.fx = null
//             event.subject.fy = null
//         }

//         return d3Drag<SVGGElement, Node>()
//             .on('start', dragstarted)
//             .on('drag', dragged)
//             .on('end', dragended)
//     }

//     return simulation
// }

// /**
//  * Custom force to constrain nodes inside a circle of given radius
//  */
// function constrainParent(parentX: number, parentY: number, radius: number, padding: number) {
//     const force: any = function (alpha: number) {
//         if (!force.nodes) return

//         for (const node of force.nodes) {
//             if (node.x == null || node.y == null) continue
//             const dx = node.x
//             const dy = node.y
//             const distance = Math.sqrt(dx * dx + dy * dy)
//             const maxDistance = radius - padding
//             if (distance > maxDistance) {
//                 const k = (distance - maxDistance) / distance
//                 node.x -= dx * k
//                 node.y -= dy * k
//             }
//         }
//     }

//     force.initialize = function (nodes: Node[] & SimulationNodeDatum[]) {
//         force.nodes = nodes
//     }

//     return force
// }

import { drag as d3Drag, type D3DragEvent } from 'd3-drag'
import { type Selection } from 'd3-selection'
import { forceSimulation, forceManyBody, forceCollide, forceCenter, forceLink } from 'd3-force'
import { type Simulation as d3Simulation } from 'd3-force'
import type { Force, SimulationNodeDatum } from 'd3-force'
import type { Node } from '../../Node'
import type { Edge } from '../../Edge'
import type { EdgeDrawer } from '../../renderers/svg/EdgeDrawer'
import type { Graph } from '../../Graph'

interface MicroForceOptions {
    repulsion?: number        // Negative for repelling children
    iterations?: number       // Number of pre-ticks for stabilization
    parentPadding?: number    // Padding inside parent circle
    collidePadding?: number   // Padding between children
}

/**
 * Runs a micro D3 force simulation on children nodes inside a parent node.
 * Positions are relative to the parent <g> transform.
 */
export function simulateChildrenInsideParent(
    nodeSelection: Selection<SVGGElement, Node, SVGGElement, Node>,
    edgeSelection: Selection<SVGGElement, Edge, SVGGElement, Node>,
    children: Node[],
    parentRadius: number,
    options: MicroForceOptions = {},
    edgeDrawer: EdgeDrawer,
    graph: Graph,
) {
    const {
        repulsion = -10,
        iterations = 6,
        parentPadding = 5,
        collidePadding = 2
    } = options

    if (!children?.length) return

    const childrenProxy = new Map<string, Node>()

    // Initialize positions relative to parent center
    children.forEach((child, i) => {
        childrenProxy.set(child.id, child)

        child.vx = child.vx ?? 0
        child.vy = child.vy ?? 0
        const r = 24
        const count = children.length
        const angle = (i / count) * 2 * Math.PI
        child.x = r * Math.cos(angle - Math.PI / 2)
        child.y = r * Math.sin(angle - Math.PI / 2)
    })

    // Create micro simulation
    const simulation: d3Simulation<Node, undefined> = forceSimulation(children)
        .alphaDecay(0.1)
        .velocityDecay(0.3)
        .force('charge', forceManyBody().strength(repulsion))
        .force('collide', forceCollide<Node>().radius(d => (d.getCircleRadius?.() ?? 10) + collidePadding))
        .force('center', forceCenter(0, 0))
        .force('link', forceLink<Node, Edge>())
        .force('constrainParent', forceConstrainParent<Node>(parentRadius, parentPadding))
        .on('tick', ticked)

    // Pre-tick simulation for stabilization
    for (let i = 0; i < iterations; i++) simulation.tick()

    // Enable drag on children
    nodeSelection.call(setupDrag(simulation))

    // Tick handler: position children relative to parent position
    function ticked() {
        nodeSelection
            .attr('transform', d => {
                const x = d.x ?? 0
                const y = d.y ?? 0

                // Keep real nodes and subgraph nodes in sync
                updatePositionOnRealChild(x, y, d.id)

                return `translate(${x},${y})`
            })
        edgeDrawer.updatePositions(edgeSelection)
    }

    graph.renderer.getGraphInteraction().on('dragging', () => {
        graph.getMutableNodes().filter((node) => node.isParent && node.expanded).forEach((node: Node) => {
            const children = node.children
            children.forEach((child: Node) => {
                const childInSubgraph: Node | undefined = childrenProxy.get(child.id)
                if (!childInSubgraph || !childInSubgraph.x || !childInSubgraph.y) return
                updatePositionOnRealChild(childInSubgraph.x, childInSubgraph.y, child.id)
            })
        })
    })

    function updatePositionOnRealChild(x: number, y: number, id: string): void {
        const realChild = graph.getMutableNode(id)
        const clusterNode = realChild?.parentNode
        if (realChild && clusterNode) {
            realChild.x = x + (clusterNode.x ?? 0)
            realChild.y = y + (clusterNode.y ?? 0)
            graph.renderer.nextTickFor([realChild])
        }
    }

    // Drag handler for children
    function setupDrag(simulation: d3Simulation<Node, undefined>) {
        function dragstarted(event: D3DragEvent<SVGGElement, Node, Node>) {
            if (!event.active) simulation.alphaTarget(0.3).restart()
            event.subject.fx = event.subject.x
            event.subject.fy = event.subject.y
        }

        function dragged(event: D3DragEvent<SVGGElement, Node, Node>) {
            // Convert drag coordinates to parent-local frame
            event.subject.fx = event.x
            event.subject.fy = event.y
            simulation.alphaTarget(0.3).restart()
        }

        function dragended(event: D3DragEvent<SVGGElement, Node, Node>) {
            if (!event.active) simulation.alphaTarget(0)
            event.subject.fx = undefined
            event.subject.fy = undefined
            simulation.alphaTarget(0).restart()
        }

        return d3Drag<SVGGElement, Node>()
            .on('start.draggedelement', dragstarted)
            .on('drag.draggedelement', dragged)
            .on('end.draggedelement', dragended)
    }

    return simulation
}


/**
 * Custom force to constrain nodes inside a circle of given radius
 * relative to (0,0) = parent center
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface ForceConstrainParent<TNode extends Node & SimulationNodeDatum> extends Force<TNode, any> {
    /**
     * Supplies the array of nodes and random source to this force. This method is called when a force is bound to a simulation via simulation.force
     * and when the simulation’s nodes change via simulation.nodes.
     *
     * A force may perform necessary work during initialization, such as evaluating per-node parameters, to avoid repeatedly performing work during each application of the force.
     */
    initialize(nodes: TNode[], random: () => number): void;
}

function forceConstrainParent<TNode extends Node & SimulationNodeDatum = Node & SimulationNodeDatum>(
    parentRadius: number, padding: number
): ForceConstrainParent<TNode> {
    let nodes: TNode[] = []

    function force() {
        if (!nodes) return
        const maxDistance = (parentRadius - padding) * 0.9

        for (const node of nodes) {
            if (node.x == null || node.y == null) continue

            const dx = node.x
            const dy = node.y
            const distance = Math.sqrt(dx * dx + dy * dy)

            if (distance > maxDistance) {
                const scale = maxDistance / distance
                const newX = dx * scale
                const newY = dy * scale

                node.x = newX
                node.y = newY

                // Keep dragged nodes constrained
                // if (node.fx != null) node.fx = newX
                // if (node.fy != null) node.fy = newY
            }
        }
    }

    force.initialize = (_nodes: TNode[]) => {
        nodes = _nodes
    }

    return force as ForceConstrainParent<TNode>
}