/**
 * Deterministic graph fixtures for visual regression tests.
 *
 * Every node carries an explicit, fixed `(x, y)` position (and matching `fx/fy`
 * so it stays pinned even if a simulation is ever switched on) plus a stable
 * `domID` equal to its id — that makes the rendered element selectable as
 * `#node-<id>` and guarantees the layout is identical on every run.
 *
 * Each fixture is a *builder* (a function), not a shared object: nodes/edges are
 * stateful and get mutated by the graph, so a fresh set must be produced per load.
 */
import { Node, Edge } from '../../../src/index'

/** Note option objects are passed raw; the graph normalises them into `Note`s. */
export interface RawNote {
    id: string
    x: number
    y: number
    width?: number
    height?: number
    content?: string
    color?: string
    attachedElement?: { type: 'node' | 'edge'; id: string }
}

export interface BuiltFixture {
    nodes: Node[]
    edges: Edge[]
    notes: RawNote[]
}

/** Create a node with a fixed position and a stable, predictable domID. */
function mkNode(id: string, x: number, y: number, data: Record<string, unknown> = {}): Node {
    const node = new Node(id, { label: id.toUpperCase(), ...data }, {}, id)
    node.x = x
    node.y = y
    node.fx = x
    node.fy = y
    return node
}

/** Pentagon of 5 nodes around a central hub — centred on the origin. */
const BASIC_POSITIONS: Record<string, [number, number]> = {
    a: [0, -130],
    b: [150, -40],
    c: [95, 130],
    d: [-95, 130],
    e: [-150, -40],
    hub: [0, 25],
}

function basicNodes(): Record<string, Node> {
    const entries = Object.entries(BASIC_POSITIONS).map(
        ([id, [x, y]]) => [id, mkNode(id, x, y)] as const
    )
    return Object.fromEntries(entries)
}

export const fixtures = {
    /** A small directed graph: pentagon + hub, with a couple of labelled edges. */
    basic(): BuiltFixture {
        const n = basicNodes()
        const edges = [
            new Edge('a-b', n.a, n.b, { label: 'links' }),
            new Edge('b-c', n.b, n.c),
            new Edge('c-d', n.c, n.d),
            new Edge('d-e', n.d, n.e),
            new Edge('e-a', n.e, n.a),
            new Edge('hub-a', n.hub, n.a),
            new Edge('hub-c', n.hub, n.c),
        ]
        return { nodes: Object.values(n), edges, notes: [] }
    },

    /** Two well-separated nodes — ideal for driving edge-creation interactions. */
    pair(): BuiltFixture {
        const a = mkNode('a', -160, 0, { label: 'Source' })
        const b = mkNode('b', 160, 0, { label: 'Target' })
        return { nodes: [a, b], edges: [], notes: [] }
    },

    /** The basic graph plus a free-floating Markdown note. */
    withNote(): BuiltFixture {
        const base = fixtures.basic()
        base.notes = [
            {
                id: 'note1',
                x: 210,
                y: -150,
                width: 220,
                height: 130,
                content: '# Release notes\n\nSupports **bold**, _italic_ and `code`.',
            },
        ]
        return base
    },

    /** The basic graph plus a note linked to node `c`. */
    withLinkedNote(): BuiltFixture {
        const base = fixtures.basic()
        base.notes = [
            {
                id: 'linked',
                x: 230,
                y: 120,
                width: 200,
                height: 110,
                content: 'Annotation attached to node C.',
                attachedElement: { type: 'node', id: 'c' },
            },
        ]
        return base
    },
}

export type FixtureName = keyof typeof fixtures
