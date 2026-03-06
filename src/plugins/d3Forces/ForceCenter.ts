import type { Force, SimulationNodeDatum } from 'd3-force'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ForceCenter<Node extends SimulationNodeDatum> extends Force<Node, any> {
    /**
     * Supplies the array of nodes and random source to this force. This method is called when a force is bound to a simulation via simulation.force
     * and when the simulation’s nodes change via simulation.nodes.
     *
     * A force may perform necessary work during initialization, such as evaluating per-node parameters, to avoid repeatedly performing work during each application of the force.
     */
    initialize(nodes: Node[], random: () => number): void;

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
    strength(strength: number): this;

    /**
     * Sets the centering force’s strength.
     * A reduced strength of e.g. 0.05 softens the movements on interactive graphs in which new nodes enter or exit the graph.
     * @param strength The centering force's strength.
     */
    filter(): (node: Node, i: number, nodes: Node[]) => boolean;
    filter(filter: (node: Node, i: number, nodes: Node[]) => boolean): this;
}

export function ForceCenter<Node extends SimulationNodeDatum = SimulationNodeDatum>(
    x = 0,
    y = 0,
    strength: number = 0.001,
    filter: (node: Node, i: number, nodes: Node[]) => boolean = () => true
): ForceCenter<Node> {

    let nodes: Node[] = []

    function force() {
        if (!nodes.length) return

        let sx = 0
        let sy = 0
        let count = 0

        // First pass: compute center of filtered nodes
        nodes.forEach((node, i) => {
            if (!filter(node, i, nodes)) return
            if (node.x == null || node.y == null) return

            sx += node.x
            sy += node.y
            count++
        })

        if (!count) return

        // Compute shift
        sx = ((sx / count) - x) * strength
        sy = ((sy / count) - y) * strength

        // Second pass: apply shift only to filtered nodes
        nodes.forEach((node, i) => {
            if (!filter(node, i, nodes)) return
            if (node.x == null || node.y == null) return

            node.x -= sx
            node.y -= sy
        })
    }

    force.initialize = (_nodes: Node[]) => {
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

    force.strength = function (_?: number) {
        if (!arguments.length) return strength
        strength = _!
        return force
    }

    force.filter = function (_?: (node: Node, i: number, nodes: Node[]) => boolean) {
        if (!arguments.length) return filter
        filter = _!
        return force
    }

    return force as ForceCenter<Node>
}
