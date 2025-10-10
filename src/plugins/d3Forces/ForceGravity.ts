import type { Node } from '../../Node'
import type { Force as d3Force } from 'd3-force'

export function ForceGravity(
    x = 0,
    y = 0,
    strength: number | ((node: Node, i: number, nodes: Node[]) => number) = 0.001
): d3Force<Node> {
    let nodes: Node[] = []
    let strengthFn: (node: Node, i: number, nodes: Node[]) => number

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

    force.initialize = (_nodes: Node[]) => {
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

    force.strength = function (_?: number | ((node: Node, i: number, nodes: Node[]) => number)) {
        if (!arguments.length) return strength
        strength = _!
        initializeStrength()
        return force
    }

    return force as d3.Force<Node, undefined> & {
        x(_: number): typeof force;
        y(_: number): typeof force;
        strength(_: number | ((node: Node, i: number, nodes: Node[]) => number)): typeof force;
    }
}
