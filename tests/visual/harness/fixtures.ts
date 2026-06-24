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
import type {
    NodeStyle,
    EdgeStyle,
    LabelStyle,
    EdgeFullStyle,
} from '../../../src/interfaces/RendererOptions'

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

/** Create a node with a fixed position, baked-in style, and a stable id-equals-domID. */
function mkStyledNode(
    id: string,
    x: number,
    y: number,
    style: Partial<NodeStyle> = {},
    data: Record<string, unknown> = {}
): Node {
    const node = new Node(id, { label: id.toUpperCase(), ...data }, style, id)
    node.x = x
    node.y = y
    node.fx = x
    node.fy = y
    return node
}

/** Create an edge with optional partial edge/label styling (merged with renderer defaults). */
function mkEdge(
    id: string,
    from: Node,
    to: Node,
    data: Record<string, unknown> = {},
    edgeStyle: Partial<EdgeStyle> = {},
    labelStyle: Partial<LabelStyle> = {}
): Edge {
    // The renderer fills missing fields from the defaults, so partial sub-styles are fine.
    const style = { edge: edgeStyle, label: labelStyle } as Partial<EdgeFullStyle>
    return new Edge(id, from, to, data, style)
}

/** SVG path `d` for a regular star centred on the origin — used as a custom node shape. */
function starPath(outerRadius: number, innerRadius: number, points = 5): string {
    const step = Math.PI / points
    let d = ''
    for (let i = 0; i < points * 2; i++) {
        const r = i % 2 === 0 ? outerRadius : innerRadius
        const angle = -Math.PI / 2 + i * step
        const x = (Math.cos(angle) * r).toFixed(2)
        const y = (Math.sin(angle) * r).toFixed(2)
        d += `${i === 0 ? 'M' : 'L'}${x},${y}`
    }
    return `${d}Z`
}

/** A small, self-contained data-URI image (green check badge) for the `imagePath` icon test. */
function checkBadgeDataUri(): string {
    const svg =
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24">' +
        '<rect width="24" height="24" rx="5" fill="#16a34a"/>' +
        '<path d="M6 12.5l4 4 8-8.5" stroke="#fff" stroke-width="3" fill="none" ' +
        'stroke-linecap="round" stroke-linejoin="round"/></svg>'
    return `data:image/svg+xml;base64,${btoa(svg)}`
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

    // ── Area 1 (styling) fixtures — focused, side-by-side scenes ───────────────
    // Each isolates one styling concern so its baseline only moves when that
    // concern regresses. Together they fulfil the P0.1 "styled" prerequisite.

    /** One node per shape: circle / square / triangle / hexagon / custom path (star). */
    nodeShapes(): BuiltFixture {
        const fill = '#4363d8'
        const nodes = [
            mkStyledNode('circle', -240, 0, { shape: 'circle', size: 22, color: fill }),
            mkStyledNode('square', -120, 0, { shape: 'square', size: 20, color: fill }),
            mkStyledNode('triangle', 0, 0, { shape: 'triangle', size: 22, color: fill }),
            mkStyledNode('hexagon', 120, 0, { shape: 'hexagon', size: 22, color: fill }),
            mkStyledNode('custom', 240, 0, { shape: { d: starPath(24, 10) }, size: 24, color: fill }),
        ]
        return { nodes, edges: [], notes: [] }
    },

    /** Nodes varying in size, fill colour, stroke colour and stroke width. */
    nodeStyles(): BuiltFixture {
        const nodes = [
            mkStyledNode('small', -210, 0, { size: 10, color: '#e6194B', strokeColor: '#ffffff', strokeWidth: 2 }),
            mkStyledNode('medium', -70, 0, { size: 20, color: '#3cb44b', strokeColor: '#1b3a1f', strokeWidth: 4 }),
            mkStyledNode('large', 90, 0, { size: 30, color: '#4363d8', strokeColor: '#ffe119', strokeWidth: 6 }),
            mkStyledNode('thin', 250, 0, { size: 18, color: '#f58231', strokeColor: '#911eb4', strokeWidth: 3 }),
        ]
        return { nodes, edges: [], notes: [] }
    },

    /**
     * One node each for the four icon mechanisms: `iconUnicode`, `iconClass`,
     * `svgIcon` and `imagePath` (embedded data-URI). `iconClass` resolves its glyph
     * from the consumer's icon-library CSS (the `--fa` custom property) — Pivotick
     * ships no icon font, so the spec injects a tiny stand-in stylesheet.
     */
    nodeIcons(): BuiltFixture {
        const base: Partial<NodeStyle> = { size: 22, color: '#334155' }
        // A distinct glyph per mechanism (heart / star / triangle / check) so the
        // baseline would catch a regression that swapped one mechanism for another.
        const svgIcon =
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' +
            '<path fill="#fff" d="M8 5v14l11-7z"/></svg>'
        const nodes = [
            mkStyledNode('unicode', -210, 0, { ...base, iconUnicode: '♥' }),
            mkStyledNode('iconclass', -70, 0, { ...base, iconClass: 'test-glyph' }),
            mkStyledNode('svgicon', 90, 0, { ...base, svgIcon }),
            mkStyledNode('image', 230, 0, { ...base, imagePath: checkBadgeDataUri() }),
        ]
        return { nodes, edges: [], notes: [] }
    },

    /**
     * Node labels (rendered from the `text` style). Covers a long centred label
     * (truncation/ellipsis), an above-node label (gets a background box via the
     * vertical shift), an east label (horizontal shift), and a rotated label.
     */
    nodeLabels(): BuiltFixture {
        const color = '#0f766e'
        const nodes = [
            mkStyledNode('truncated', -180, -90, { size: 16, color, text: 'Supercalifragilistic node label' }),
            mkStyledNode('above', 150, -90, { size: 16, color, text: 'North', textVerticalShift: 1 }),
            mkStyledNode('right', -180, 90, { size: 16, color, text: 'East', textHorizontalShift: 1 }),
            mkStyledNode('rotated', 150, 90, { size: 16, color, text: 'Tilted', textVerticalShift: 1, textRotateDegree: 45 }),
        ]
        return { nodes, edges: [], notes: [] }
    },

    /** Straight, curved, and a reciprocal pair that curves apart under `bidirectional`. */
    edgeCurves(): BuiltFixture {
        const mk = (id: string, x: number, y: number) => mkStyledNode(id, x, y, { size: 14, color: '#64748b' })
        const a = mk('a', -170, -110), b = mk('b', 170, -110)
        const c = mk('c', -170, 0), d = mk('d', 170, 0)
        const e = mk('e', -170, 110), f = mk('f', 170, 110)
        const edges = [
            mkEdge('a-b', a, b, { label: 'straight' }, { curveStyle: 'straight' }),
            mkEdge('c-d', c, d, { label: 'curved' }, { curveStyle: 'curved' }),
            mkEdge('e-f', e, f, {}, { curveStyle: 'bidirectional' }),
            mkEdge('f-e', f, e, {}, { curveStyle: 'bidirectional' }),
        ]
        return { nodes: [a, b, c, d, e, f], edges, notes: [] }
    },

    /** A single node with a self-loop edge (`from === to`) and an offset label. */
    selfLoop(): BuiltFixture {
        const node = mkStyledNode('loop', 0, 0, { size: 18, color: '#be123c' })
        const edge = mkEdge('loop-self', node, node, { label: 'self' })
        return { nodes: [node], edges: [edge], notes: [] }
    },

    /** Four stacked edges, one per end-marker: arrow / circle / diamond / bigcircle. */
    edgeMarkers(): BuiltFixture {
        const rows: Array<[string, string]> = [
            ['arrow', 'arrow'],
            ['circle', 'circle'],
            ['diamond', 'diamond'],
            ['big', 'bigcircle'],
        ]
        const nodes: Node[] = []
        const edges: Edge[] = []
        rows.forEach(([key, marker], i) => {
            const y = (i - 1.5) * 70
            const from = mkStyledNode(`${key}-from`, -150, y, { size: 12, color: '#475569' })
            const to = mkStyledNode(`${key}-to`, 150, y, { size: 12, color: '#475569' })
            nodes.push(from, to)
            edges.push(mkEdge(`${key}-edge`, from, to, { label: marker }, { markerEnd: marker, curveStyle: 'straight' }))
        })
        return { nodes, edges, notes: [] }
    },

    /** A dashed edge. `animateDash:false` keeps it a static frame (no moving dash). */
    edgeDashed(): BuiltFixture {
        const a = mkStyledNode('a', -150, 0, { size: 14, color: '#7c3aed' })
        const b = mkStyledNode('b', 150, 0, { size: 14, color: '#7c3aed' })
        const edge = mkEdge('a-b', a, b, { label: 'dashed' }, { dashed: true, animateDash: false, curveStyle: 'straight' })
        return { nodes: [a, b], edges: [edge], notes: [] }
    },

    /** A horizontal label (with background box) and a label rotated to follow its edge. */
    edgeLabels(): BuiltFixture {
        const color = '#0369a1'
        // A *vertical* edge proves the default label stays horizontal regardless of
        // the edge's angle…
        const a = mkStyledNode('a', -150, -140, { size: 14, color })
        const b = mkStyledNode('b', -150, 140, { size: 14, color })
        // …while a diagonal edge with rotateLabel follows the edge angle.
        const c = mkStyledNode('c', 120, 140, { size: 14, color })
        const d = mkStyledNode('d', 240, -140, { size: 14, color })
        const edges = [
            mkEdge('a-b', a, b, { label: 'horizontal label' }, { curveStyle: 'straight' }),
            mkEdge('c-d', c, d, { label: 'rotated to edge' }, { rotateLabel: true, curveStyle: 'straight' }),
        ]
        return { nodes: [a, b, c, d], edges, notes: [] }
    },
}

export type FixtureName = keyof typeof fixtures
