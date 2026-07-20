import type { Force, SimulationNodeDatum } from 'd3-force'
import type { Node } from '../../Node'

/**
 * Custom force to constrain nodes inside a circle of given radius
 * relative to (0,0) = parent center.
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

export function forceConstrainParent<TNode extends Node & SimulationNodeDatum = Node & SimulationNodeDatum>(
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
            const radius = node.getCircleRadius() ?? 10
            const distance = Math.sqrt(dx * dx + dy * dy) + radius

            if (distance > maxDistance) {
                const scale = maxDistance / distance
                const newX = dx * scale
                const newY = dy * scale

                node.x = newX
                node.y = newY
            }
        }
    }

    force.initialize = (_nodes: TNode[]) => {
        nodes = _nodes
    }

    return force as ForceConstrainParent<TNode>
}
