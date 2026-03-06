import type { Force, SimulationNodeDatum } from 'd3-force'
import type { Node } from '../../Node'


// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ForceClusterRadial<TNode extends Node & SimulationNodeDatum> extends Force<TNode, any> {
    /**
     * Supplies the array of nodes and random source to this force. This method is called when a force is bound to a simulation via simulation.force
     * and when the simulation’s nodes change via simulation.nodes.
     *
     * A force may perform necessary work during initialization, such as evaluating per-node parameters, to avoid repeatedly performing work during each application of the force.
     */
    initialize(nodes: TNode[], random: () => number): void;

    /**
     * Return the current x-coordinate of the centering position, which defaults to zero.
     */
    x(): number;
    /**
     * Set the x-coordinate of the centering position.
     *
     * @param x x-coordinate.
     */
    x(x: number): this;

    /**
     * Return the current y-coordinate of the centering position, which defaults to zero.
     */
    y(): number;
    /**
     * Set the y-coordinate of the centering position.
     *
     * @param y y-coordinate.
     */
    y(y: number): this;

    /**
     * Returns the force’s current strength, which defaults to 1.
     */
    strength(): number;

    /**
     * Sets the centering force’s strength.
     * A reduced strength of e.g. 0.05 softens the movements on interactive graphs in which new nodes enter or exit the graph.
     * @param strength The centering force's strength.
     */
    strength(strength: number | ((node: TNode, i: number, nodes: TNode[]) => number)): this;
}

export function ForceClusterRadial<TNode extends Node & SimulationNodeDatum = Node & SimulationNodeDatum>(
    x = 0,
    y = 0,
    strength: number | ((node: TNode, i: number, nodes: TNode[]) => number) = 0.001
): ForceClusterRadial<TNode> {
    let nodes: TNode[] = []

    function force() {

        const MAX_RADIUS = 300

        nodes.forEach(node => {
            const n = node as Node

            if (!n.expanded || !n.children) return

            const expand_radius = n.getCircleRadius()

            n.children.forEach((child: Node) => {
                n.x = n.x ?? 0
                n.y = n.y ?? 0
                child.x = child.x ?? n.x
                child.y = child.y ?? n.y
                if (!child.vx) child.vx = 0
                if (!child.vy) child.vy = 0

                const dx = child.x - n.x
                const dy = child.y - n.y
                const distance = Math.sqrt(dx * dx + dy * dy)

                if (distance > MAX_RADIUS) {
                    child.x = node.x
                    child.y = node.y
                }

                if (distance > expand_radius) {
                    const k = 0.2 * (distance - expand_radius) / distance
                    child.vx -= dx * k
                    child.vy -= dy * k
                }
            })
        })
    }

    force.initialize = (_nodes: TNode[]) => {
        nodes = _nodes
    }


    force.x = function (_?: number) {
        if (!arguments.length) return x
        x = _!
        return force
    }

    force.y = function (_?: number) {
        if (!arguments.length) return y
        y = _!
        return force
    }

    force.strength = function (_?: number | ((node: TNode, i: number, nodes: TNode[]) => number)) {
        if (!arguments.length) return strength
        strength = _!
        return force
    }

    return force as ForceClusterRadial<TNode>
}
