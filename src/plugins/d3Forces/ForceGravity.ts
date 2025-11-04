import type { Force, SimulationNodeDatum } from 'd3-force'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ForceGravity<NodeDatum extends SimulationNodeDatum> extends Force<NodeDatum, any> {
    /**
     * Supplies the array of nodes and random source to this force. This method is called when a force is bound to a simulation via simulation.force
     * and when the simulation’s nodes change via simulation.nodes.
     *
     * A force may perform necessary work during initialization, such as evaluating per-node parameters, to avoid repeatedly performing work during each application of the force.
     */
    initialize(nodes: NodeDatum[], random: () => number): void;

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
    strength(strength: number | ((node: NodeDatum, i: number, nodes: NodeDatum[]) => number)): this;
}

export function ForceGravity<NodeDatum extends SimulationNodeDatum = SimulationNodeDatum>(
    x = 0,
    y = 0,
    strength: number | ((node: NodeDatum, i: number, nodes: NodeDatum[]) => number) = 0.001
): ForceGravity<NodeDatum> {
    let nodes: NodeDatum[] = []
    let strengthFn: (node: NodeDatum, i: number, nodes: NodeDatum[]) => number

    function initializeStrength() {
        strengthFn = typeof strength === 'function' ? strength : () => strength as number
    }

    function force(alpha: number) {
        for (let i = 0, n = nodes.length; i < n; ++i) {
            const node = nodes[i]
            const s = strengthFn(node, i, nodes)
            if (node.vx && node.x)
                node.vx -= (node.x - x) * s * alpha
            if (node.vy && node.y)
                node.vy -= (node.y - y) * s * alpha
        }
    }

    force.initialize = (_nodes: NodeDatum[]) => {
        nodes = _nodes
        initializeStrength()
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

    force.strength = function (_?: number | ((node: NodeDatum, i: number, nodes: NodeDatum[]) => number)) {
        if (!arguments.length) return strength
        strength = _!
        initializeStrength()
        return force
    }

    return force as ForceGravity<NodeDatum>
}
