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

/**
 * Create a pinned parent (cluster) node from a set of `children` (themselves
 * leaves or nested clusters). Passing the children to the constructor flags the
 * node `isParent`; {@link markCluster} then completes the wiring for deeper levels.
 */
function mkCluster(
    id: string,
    x: number,
    y: number,
    children: Node[],
    data: Record<string, unknown> = {}
): Node {
    const node = new Node(id, { label: id.toUpperCase(), ...data }, {}, id, children)
    node.x = x
    node.y = y
    node.fx = x
    node.fy = y
    return node
}

/**
 * Recursively mark every descendant of a cluster as a hidden child.
 *
 * The graph's normaliser only marks the *first* level of children when handed
 * `Node` instances (the form these fixtures use) — deeper descendants are left
 * unmarked, which breaks nested clusters. `_setData` still adds every descendant
 * to the node map, so once they're marked here the whole hierarchy behaves.
 */
function markCluster(parent: Node, depth = 1): void {
    parent.children.forEach((child) => {
        child.markAsChild(parent, depth)
        child.hide()
        markCluster(child, depth + 1)
    })
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

/**
 * A self-contained 2:1 **landscape** data-URI image for the picture-node preview test.
 * The landscape aspect is the point: on the canvas a `cover` node crops it to a square,
 * while the hover preview / lightbox must show the whole picture (aspect preserved).
 */
function landscapeImageDataUri(): string {
    const svg =
        '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="160">' +
        '<rect width="320" height="160" fill="#1e3a8a"/>' +
        '<rect width="160" height="160" fill="#f97316"/>' +
        '<circle cx="240" cy="80" r="45" fill="#fde047"/></svg>'
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
     * A picture node (`shot`) flanked by two plain nodes. `imageFit: 'cover'` keeps the
     * node compact on the canvas (the 2:1 landscape is cropped to the square); the siblings
     * keep the fit zoom sane so the node stays small on screen. Drives the hover preview,
     * the large in-tooltip picture and the full-resolution lightbox.
     */
    imageNode(): BuiltFixture {
        const shot = mkStyledNode(
            'shot',
            0,
            0,
            { shape: 'square', size: 36, imagePath: landscapeImageDataUri(), imageFit: 'cover', strokeColor: '#94a3b8', strokeWidth: 2 },
            { name: 'Screenshot capture' }
        )
        const left = mkNode('left', -220, 0)
        const right = mkNode('right', 220, 0)
        return { nodes: [shot, left, right], edges: [new Edge('left-shot', left, shot), new Edge('shot-right', shot, right)], notes: [] }
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

    // ── Area 3 (layouts) fixtures ──────────────────────────────────────────────

    /**
     * A small **acyclic directed** graph with an obvious root — drives the layout
     * specs (force / tree-vertical / tree-horizontal / tree-radial) and the
     * position assertions. Edges point parent→child so the default root finder
     * (`MaxReachability`) resolves to `root`; tree layouts disable on cyclic
     * graphs, so this must stay a DAG. The seed positions double as a clean,
     * deterministic arrangement for the *pinned* force-layout baseline.
     *
     *            root
     *          /  |  \
     *         a   b   c
     *        / \     / \
     *       d   e   f   g
     */
    tree(): BuiltFixture {
        const pos: Record<string, [number, number]> = {
            root: [0, -120],
            a: [-170, -30],
            b: [-20, 20],
            c: [180, -50],
            d: [-260, 120],
            e: [-90, 170],
            f: [110, 150],
            g: [250, 90],
        }
        const n = Object.fromEntries(
            Object.entries(pos).map(([id, [x, y]]) => [id, mkNode(id, x, y)])
        ) as Record<string, Node>
        const edges = [
            new Edge('root-a', n.root, n.a),
            new Edge('root-b', n.root, n.b),
            new Edge('root-c', n.root, n.c),
            new Edge('a-d', n.a, n.d),
            new Edge('a-e', n.a, n.e),
            new Edge('c-f', n.c, n.f),
            new Edge('c-g', n.c, n.g),
        ]
        return { nodes: Object.values(n), edges, notes: [] }
    },

    /**
     * An ego network: a central node directly connected to every other node.
     * The ego-tree layout only positions the root's *direct* neighbours, so a
     * star guarantees **all** nodes get deterministic positions (a deeper tree
     * would leave non-neighbours unplaced). A couple of neighbour-to-neighbour
     * edges keep it a real graph rather than a pure star (they're ignored by the
     * ego hierarchy but still rendered).
     */
    egoNet(): BuiltFixture {
        const ego = mkNode('ego', 0, 0)
        const count = 6
        const neighbours = Array.from({ length: count }, (_, i) => {
            const angle = (i / count) * 2 * Math.PI - Math.PI / 2
            return mkNode(`n${i + 1}`, Math.round(Math.cos(angle) * 180), Math.round(Math.sin(angle) * 180))
        })
        const edges = neighbours.map((nb) => new Edge(`ego-${nb.id}`, ego, nb))
        edges.push(new Edge('n1-n2', neighbours[0], neighbours[1]))
        edges.push(new Edge('n4-n5', neighbours[3], neighbours[4]))
        return { nodes: [ego, ...neighbours], edges, notes: [] }
    },

    // ── Area 4 (clustering) fixtures ────────────────────────────────────────────

    /**
     * A cluster scene: a parent `group` holding three children — one of which
     * (`c1`) is itself a nested cluster of two leaves — plus two external nodes
     * whose edges point *into* the cluster. Drives the whole of Area 4:
     *
     *  - **collapsed** (default): `group` renders as a dashed parent circle and
     *    the external edges show up as **synthetic** edges pointing at `group`
     *    (the edges to the hidden children are themselves hidden).
     *  - **expanded** (`harness.expand('group')`): the children render inside the
     *    cluster area; `c1` shows as a collapsed sub-cluster.
     *  - **nested** (`harness.expand(['group','c1'])`): `c1` opens too, revealing
     *    its leaves inside a cluster-within-a-cluster.
     *
     * Children carry placeholder positions only — when a cluster is expanded its
     * subgraph lays children out with a (non-deterministic) force pass, so
     * `harness.expand` re-pins them into a deterministic ring instead.
     */
    clustered(): BuiltFixture {
        const c1a = mkNode('c1a', -40, 60)
        const c1b = mkNode('c1b', 40, 60)
        const c1 = mkCluster('c1', -60, 0, [c1a, c1b])
        const c2 = mkNode('c2', 60, -40)
        const c3 = mkNode('c3', 60, 50)
        const group = mkCluster('group', 0, 0, [c1, c2, c3])
        markCluster(group)

        const ext1 = mkNode('ext1', -250, 0)
        const ext2 = mkNode('ext2', 250, 20)

        // Edges into the cluster's children. Hidden while collapsed (mirroring the
        // normaliser's handling of raw edges to children); the normaliser adds the
        // *synthetic* ext→group edges that are visible in the collapsed state.
        const intoCluster = [
            new Edge('ext1-c2', ext1, c2),
            new Edge('ext2-c1', ext2, c1),
        ]
        intoCluster.forEach((e) => e.hide())

        return { nodes: [group, ext1, ext2], edges: intoCluster, notes: [] }
    },

    /**
     * Two clusters (`group-a`, `group-b`) plus a `core` node that links to a child
     * of each. Used by the cluster-drag settle test — expanding `group-a` and
     * holding a drag must keep `core` anchored to the cluster.
     */
    linkedClusters(): BuiltFixture {
        const a1 = mkNode('a1', -60, -40)
        const a2 = mkNode('a2', -20, -40)
        const a3 = mkNode('a3', -40, -80)
        const groupA = mkCluster('group-a', -120, 0, [a1, a2, a3])
        markCluster(groupA)
        const b1 = mkNode('b1', 60, -40)
        const b2 = mkNode('b2', 100, -40)
        const b3 = mkNode('b3', 80, -80)
        const groupB = mkCluster('group-b', 120, 0, [b1, b2, b3])
        markCluster(groupB)
        const core = mkNode('core', 0, 120)
        const edges = [
            new Edge('core-a1', core, a1),
            new Edge('a1-a2', a1, a2),
            new Edge('a2-a3', a2, a3),
            new Edge('core-b1', core, b1),
            new Edge('b1-b2', b1, b2),
            new Edge('b2-b3', b2, b3),
            new Edge('a3-b1', a3, b1),
        ]
        // Mirror the normaliser: any edge touching a hidden child starts hidden (the
        // synthetic external→cluster / cross-cluster edges are what show while collapsed).
        edges.forEach((e) => { if (e.from.isChild || e.to.isChild) e.hide() })
        return { nodes: [core, groupA, groupB], edges, notes: [] }
    },

    // ── Area 5 (filtering) fixture ──────────────────────────────────────────────

    /**
     * A small network whose nodes carry **filterable data fields** — a categorical
     * `type` (`'router' | 'switch' | 'host'`) and a numeric `ports` — so the query
     * engine has something to match. Drives the whole of Area 5:
     *
     *  - **filter** (`setFilter('type', { value:'router', matchMode:'exact' })`): only
     *    the routers remain; the switches/hosts and their edges are *removed* (not
     *    dimmed), leaving the routers' interconnect triangle.
     *  - **reset** (`resetFilters()`): the full graph returns.
     *  - **excludeNode** (`excludeNode('h2')`): one node is removed by hand.
     *  - **panel** (`openFilterPanel()`): the generated filter form lists the data
     *    fields as form controls.
     *
     * Three routers form an interconnected triangle (so the filtered-down graph still
     * shows edges); two switches hang off the triangle, and three hosts off the
     * switches. Layered top→bottom for a legible scene.
     *
     * Note: `ports` is intentionally a **non-integer** number. The filter form's field
     * discovery throws on integer-valued data (it routes integers to a `range` bucket
     * that isn't initialised), and the harness builds that form for every fixture in
     * light mode — so an integer here would crash every load. A fractional value still
     * matches a `{ min, max }` range filter (the query engine only checks `typeof
     * === 'number'`) and renders harmlessly as a categorical option in the form.
     */
    filterable(): BuiltFixture {
        const node = (id: string, x: number, y: number, type: string, ports: number) =>
            mkNode(id, x, y, { type, ports })
        const n = {
            r1: node('r1', 0, -120, 'router', 48.5),
            r2: node('r2', -110, -40, 'router', 48.5),
            r3: node('r3', 110, -40, 'router', 48.5),
            sw1: node('sw1', -150, 70, 'switch', 24.5),
            sw2: node('sw2', 150, 70, 'switch', 24.5),
            h1: node('h1', -220, 175, 'host', 4.5),
            h2: node('h2', -80, 175, 'host', 4.5),
            h3: node('h3', 150, 175, 'host', 4.5),
        }
        const edges = [
            new Edge('r1-r2', n.r1, n.r2),
            new Edge('r2-r3', n.r2, n.r3),
            new Edge('r3-r1', n.r3, n.r1),
            new Edge('r2-sw1', n.r2, n.sw1),
            new Edge('r3-sw2', n.r3, n.sw2),
            new Edge('sw1-h1', n.sw1, n.h1),
            new Edge('sw1-h2', n.sw1, n.h2),
            new Edge('sw2-h3', n.sw2, n.h3),
        ]
        return { nodes: Object.values(n), edges, notes: [] }
    },

    /**
     * Regression fixture for prd/bug-graphfilter-null-value-crash.md: node-data
     * fields whose value is `null`/`undefined`. MISP (and most real datasets)
     * serialise an absent optional attribute as `null`; a single such value used
     * to crash the Graph-Filter facet builder (`v.length` on `null`) during
     * construction — the form is (re)built on every `dataBatchChanged`, which
     * fires synchronously inside `new Graph()`. Here `object_relation` carries a
     * real value on one node, `null` on another, and an explicit `undefined` on a
     * third, so the built facet must list only the real value.
     */
    nullableFields(): BuiltFixture {
        const nodes = [
            mkNode('a', -90, 0, { type: 'attribute', object_relation: null }),
            mkNode('b', 90, 0, { type: 'attribute', object_relation: 'rel' }),
            mkNode('c', 0, 120, { type: 'attribute', object_relation: undefined }),
        ]
        return { nodes, edges: [], notes: [] }
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
