import { test, expect, gotoHarness, loadFixture, harness, expectCanvas } from '../helpers'
import type { Page } from '@playwright/test'

/**
 * Area 3 — layouts (T3.1–T3.6).
 *
 * Layout output is the area the README flags as brittle for pixels: a tree
 * layout's on-load positions come from a *force relaxation* toward the computed
 * targets, which is timing-dependent. Determinism strategy (decided per layout):
 *
 *  - **Force (T3.1):** there is no exact target to settle to, so we keep the sim
 *    off and `pin` the fixture's seed positions — a deterministic stand-in for a
 *    settled force arrangement, and a clean visual contrast to the tree layouts.
 *  - **Tree / egoTree (T3.2–T3.5):** `applyLayout` re-runs the layout's exact
 *    d3-hierarchy computation and pins the result, so the baseline is a pure
 *    function of (graph, layout options) — no tick-count dependence.
 *
 * Each pixel baseline is backed by a position assertion (T3.6) that checks the
 * computed *ordering* (root above/left of children, equal-depth siblings level,
 * radial ring radii) — a robust complement to the screenshots.
 */
type Positions = Record<string, { x: number; y: number }>

type LayoutFixture = 'tree' | 'egoNet' | 'basic' | 'pair' | 'converging'
    | 'declaredForest' | 'declaredHierarchy'

async function positionsAfterLayout(page: Page, name: LayoutFixture, layout: Record<string, unknown>): Promise<Positions> {
    await loadFixture(page, name, { layout })
    await harness(page, 'applyLayout')
    return (await harness(page, 'nodePositions')) as Positions
}

/** Distance from the origin (radial layouts place the root at (0, 0)). */
const radius = (p: { x: number; y: number }) => Math.hypot(p.x, p.y)

/**
 * The levels of a laid-out vertical tree, shallowest first, each as its sorted ids.
 * A level shares one `y` exactly, so rounding groups rather than buckets.
 */
const levelsOf = (p: Positions): string[][] => {
    const byRow = new Map<number, string[]>()
    for (const [id, point] of Object.entries(p)) {
        const row = Math.round(point.y)
        byRow.set(row, [...(byRow.get(row) ?? []), id])
    }
    return [...byRow.entries()]
        .sort(([a], [b]) => a - b)
        .map(([, ids]) => ids.sort())
}

/**
 * Every node's row *number*, counting the rows of the laid-out tree rather than only the
 * ones that turned out to be occupied — which is the whole point when a declared depth has
 * left rows empty. One row is the tightest gap between two distinct rows, which it is by
 * construction: a tree always has at least one parent-child pair one row apart.
 */
const rowsOf = (p: Positions): Record<string, number> => {
    const ys = [...new Set(Object.values(p).map((point) => Math.round(point.y)))].sort((a, b) => a - b)
    const rowHeight = Math.min(...ys.slice(1).map((y, i) => y - ys[i]))
    return Object.fromEntries(
        Object.entries(p).map(([id, point]) => [id, Math.round((point.y - ys[0]) / rowHeight)])
    )
}

const spread = (p: Positions, axis: 'x' | 'y') => {
    const values = Object.values(p).map(point => point[axis])
    return { extent: Math.max(...values) - Math.min(...values), mid: (Math.max(...values) + Math.min(...values)) / 2 }
}

test.describe('layouts', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    // T3.1 — force layout (sim off, seeds pinned; see strategy note above).
    test('force layout', async ({ page }) => {
        await loadFixture(page, 'tree', { layout: { type: 'force' } })
        await harness(page, 'pin')
        await expectCanvas(page, 'layout-force.png')
    })

    // T3.2 — vertical tree: root at the top, deeper levels stacked below.
    test('tree layout — vertical', async ({ page }) => {
        await loadFixture(page, 'tree', { layout: { type: 'tree' } })
        await harness(page, 'applyLayout')
        await expectCanvas(page, 'layout-tree-vertical.png')
    })

    // T3.3 — horizontal tree: root on the left, deeper levels to the right.
    test('tree layout — horizontal', async ({ page }) => {
        await loadFixture(page, 'tree', { layout: { type: 'tree', horizontal: true } })
        await harness(page, 'applyLayout')
        await expectCanvas(page, 'layout-tree-horizontal.png')
    })

    // T3.4 — radial tree: root at the centre, levels on concentric rings.
    test('tree layout — radial', async ({ page }) => {
        await loadFixture(page, 'tree', { layout: { type: 'tree', radial: true } })
        await harness(page, 'applyLayout')
        await expectCanvas(page, 'layout-tree-radial.png')
    })

    // T3.5 — ego tree rooted at the central node; its neighbours fan out.
    test('ego tree', async ({ page }) => {
        await loadFixture(page, 'egoNet', { layout: { type: 'egoTree', rootId: 'ego' } })
        await harness(page, 'applyLayout')
        await expectCanvas(page, 'layout-ego-tree.png')
    })

    // ── T3.6 — position assertions (non-screenshot) ──────────────────────────
    // Robust complement to the pixel diffs: assert the layout's computed ordering
    // rather than exact coordinates.

    test('vertical tree positions — root above, siblings level, ordered', async ({ page }) => {
        const p = await positionsAfterLayout(page, 'tree', { type: 'tree' })
        // Root is above its children; level 2 below level 1.
        expect(p.root.y).toBeLessThan(p.a.y)
        expect(p.a.y).toBeLessThan(p.d.y)
        // Equal-depth siblings share a row.
        expect(Math.abs(p.a.y - p.b.y)).toBeLessThan(1)
        expect(Math.abs(p.b.y - p.c.y)).toBeLessThan(1)
        expect(Math.abs(p.d.y - p.e.y)).toBeLessThan(1)
        // Children laid out left→right in traversal order (root-a, root-b, root-c).
        expect(p.a.x).toBeLessThan(p.b.x)
        expect(p.b.x).toBeLessThan(p.c.x)
    })

    test('horizontal tree positions — root left, deeper levels right', async ({ page }) => {
        const p = await positionsAfterLayout(page, 'tree', { type: 'tree', horizontal: true })
        // Depth runs along the canvas' *wide* axis, which is the whole point of asking
        // for a horizontal tree — it used to budget depth from the canvas height and
        // breadth from its width, i.e. both dimensions the wrong way round.
        expect(spread(p, 'x').extent).toBeGreaterThan(spread(p, 'y').extent)
        // Depth runs left→right; equal-depth siblings share a column.
        expect(p.root.x).toBeLessThan(p.a.x)
        expect(p.a.x).toBeLessThan(p.d.x)
        expect(Math.abs(p.a.x - p.b.x)).toBeLessThan(1)
        expect(Math.abs(p.b.x - p.c.x)).toBeLessThan(1)
        // Siblings ordered top→bottom in traversal order.
        expect(p.a.y).toBeLessThan(p.b.y)
        expect(p.b.y).toBeLessThan(p.c.y)
    })

    test('radial tree positions — root centred, levels on rings', async ({ page }) => {
        const p = await positionsAfterLayout(page, 'tree', { type: 'tree', radial: true })
        // Root sits at the centre; deeper levels live on larger rings.
        expect(radius(p.root)).toBeLessThan(1)
        expect(radius(p.d)).toBeGreaterThan(radius(p.a))
        // Equal-depth nodes share a ring radius.
        expect(Math.abs(radius(p.a) - radius(p.b))).toBeLessThan(1)
        expect(Math.abs(radius(p.a) - radius(p.c))).toBeLessThan(1)
        expect(Math.abs(radius(p.d) - radius(p.e))).toBeLessThan(1)
    })

    // ── Tree spacing (the manual distances a tree layout offers in place of the
    //    physics knobs it ignores). `levelSpacing` / `siblingSpacing` multiply the
    //    canvas-fitted geometry, so each is checked against the same layout at 1×.

    test('level spacing scales the distance between levels, and only that', async ({ page }) => {
        const fitted = await positionsAfterLayout(page, 'tree', { type: 'tree' })
        const spaced = await positionsAfterLayout(page, 'tree', { type: 'tree', levelSpacing: 2 })

        // Twice as deep…
        const depth = spread(spaced, 'y').extent / spread(fitted, 'y').extent
        expect(depth).toBeGreaterThan(1.9)
        expect(depth).toBeLessThan(2.1)
        // …no wider (the two axes are independent)…
        expect(spread(spaced, 'x').extent).toBeCloseTo(spread(fitted, 'x').extent, 0)
        // …and grown about its own middle rather than pushed down the canvas.
        expect(spread(spaced, 'y').mid).toBeCloseTo(spread(fitted, 'y').mid, 0)
    })

    test('sibling spacing scales the distance within a level, and only that', async ({ page }) => {
        const fitted = await positionsAfterLayout(page, 'tree', { type: 'tree' })
        const spaced = await positionsAfterLayout(page, 'tree', { type: 'tree', siblingSpacing: 2 })

        const breadth = spread(spaced, 'x').extent / spread(fitted, 'x').extent
        expect(breadth).toBeGreaterThan(1.9)
        expect(breadth).toBeLessThan(2.1)
        expect(spread(spaced, 'y').extent).toBeCloseTo(spread(fitted, 'y').extent, 0)
        expect(spread(spaced, 'x').mid).toBeCloseTo(spread(fitted, 'x').mid, 0)
    })

    test('radial level spacing scales the ring radii', async ({ page }) => {
        const fitted = await positionsAfterLayout(page, 'tree', { type: 'tree', radial: true })
        const spaced = await positionsAfterLayout(page, 'tree', { type: 'tree', radial: true, levelSpacing: 2 })

        // The root stays at the centre; every ring around it doubles.
        expect(radius(spaced.root)).toBeLessThan(1)
        expect(radius(spaced.a) / radius(fitted.a)).toBeCloseTo(2, 1)
        expect(radius(spaced.d) / radius(fitted.d)).toBeCloseTo(2, 1)
    })

    // ── Cyclic and disconnected graphs ───────────────────────────────────────
    // The hierarchy is built from a BFS spanning tree, so neither a cycle nor a second
    // component costs a graph its tree layout.

    test('a cyclic graph is laid out as a tree, its back-edge crossing levels', async ({ page }) => {
        // `basic` is a pentagon (a→b→c→d→e→a) with a hub pointing into it — the shape
        // that used to refuse the layout outright.
        const p = await positionsAfterLayout(page, 'basic', { type: 'tree' })
        expect(Object.keys(p)).toHaveLength(6)

        // The hub is the only node nothing points at, so it roots the tree, and the BFS
        // reaches a and c from it directly.
        expect(p.hub.y).toBeLessThan(p.a.y)
        expect(Math.abs(p.a.y - p.c.y)).toBeLessThan(1)
        // Then one level per step around the ring — e→a is the back-edge, and it is left
        // out of the hierarchy rather than closing a loop d3 would walk forever.
        expect(p.a.y).toBeLessThan(p.b.y)
        expect(p.c.y).toBeLessThan(p.d.y)
        expect(p.d.y).toBeLessThan(p.e.y)
    })

    test('a graph whose arrows all converge still comes out as one tree', async ({ page }) => {
        // Every leaf is a source, so no node reaches the graph along the arrows — the best
        // any of them manages is 3 of the 17. A directed spanning walk therefore left all
        // twelve leaves as roots of their own, hung side by side under the synthetic forest
        // root, with most edges dropping out of the hierarchy and drawn across the layout.
        // The layout now reads the edges both ways instead and re-roots at the middle.
        const p = await positionsAfterLayout(page, 'converging', { type: 'tree' })

        expect(levelsOf(p)).toEqual([
            ['sink'],                          // the middle of the graph roots it...
            ['h0', 'h1', 'h2', 'h3'],          // ...its four hubs one level down...
            ['l0', 'l1', 'l10', 'l11', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7', 'l8', 'l9'],
        ])                                     // ...and every leaf on the last level
    })

    test('a forest is laid out side by side, not stacked on the origin', async ({ page }) => {
        // Three components the primary root cannot reach each other from. They used to have
        // no slot in the hierarchy at all — only the first component was positioned, and the
        // tree forces (which fall back to 0 for a node they have no position for) dragged the
        // rest onto (0, 0).
        await harness(page, 'loadAuto', { nodes: 12, radius: 10, components: 3 }, { layout: { type: 'tree' } })
        await harness(page, 'applyLayout')
        const p = (await harness(page, 'nodePositions')) as Positions
        const rows = new Set(Object.values(p).map(q => Math.round(q.y)))

        // Every node landed on a level of the hierarchy: a dozen nodes share a handful of
        // rows, rather than keeping the scattered positions of nodes nothing placed.
        expect(Object.keys(p)).toHaveLength(12)
        expect(rows.size).toBeLessThanOrEqual(5)
    })

    test('nodes with no edges are parked clear of the tree', async ({ page }) => {
        // They have no place in a hierarchy, so they used to be given one anyway — a slot on
        // the root's own row, packed tight against it. Now they go in the dead space beside
        // the shallow levels, at the trailing edge of the layout.
        await harness(page, 'loadAuto', { nodes: 16, radius: 10, isolated: 4 }, { layout: { type: 'tree' } })
        await harness(page, 'applyLayout')
        const placement = await page.evaluate(() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const g = (window.__pivotick as any).graph
            const touched = new Set<string>()
            for (const edge of g.getEdges()) {
                touched.add(edge.source.id)
                touched.add(edge.target.id)
            }
            const all = g.getNodes() as Array<{ id: string; x: number; y: number }>
            const linked = all.filter(n => touched.has(n.id))
            const parked = all.filter(n => !touched.has(n.id))
            const topRow = Math.min(...linked.map(n => n.y))
            return {
                parkedCount: parked.length,
                // The tree's own reach on the row the parked nodes sit on…
                treeEdge: Math.max(...linked.filter(n => Math.abs(n.y - topRow) < 1).map(n => n.x)),
                parkedMinX: Math.min(...parked.map(n => n.x)),
                parkedRows: [...new Set(parked.map(n => Math.round(n.y)))],
                topRow: Math.round(topRow),
            }
        })

        expect(placement.parkedCount).toBe(4)
        // …and they sit past it, on the shallow rows where a tree leaves room.
        expect(placement.parkedMinX).toBeGreaterThan(placement.treeEdge)
        expect(placement.parkedRows).toEqual([placement.topRow])
    })

    // ── Auto spacing ─────────────────────────────────────────────────────────
    // A tree is sized from the canvas and never looks at how big its nodes are, so
    // `spacing: 'auto'` derives both multipliers from what the nodes actually need.

    const spacingOf = (page: Page) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        page.evaluate(() => (window.__pivotick as any).graph.simulation.getTreeSpacing())

    test('auto leaves an uncrowded tree at the fitted layout', async ({ page }) => {
        await loadFixture(page, 'tree', { layout: { type: 'tree' } })
        // Auto never packs a tree tighter than the fitted layout, so a sparse graph is
        // untouched — which is what makes it safe as a default.
        expect(await spacingOf(page)).toEqual({ levelSpacing: 1, siblingSpacing: 1 })
    })

    test('auto opens up a tree whose nodes are too big for their level', async ({ page }) => {
        // 60 nodes of radius 30 in a random tree: the levels have room, the rows do not.
        await harness(page, 'loadAuto', { nodes: 60, radius: 30 }, { layout: { type: 'tree' } })
        const spacing = await spacingOf(page)
        expect(spacing.siblingSpacing).toBeGreaterThan(1)
        expect(spacing.levelSpacing).toBe(1)
    })

    test('auto reaches past 4x on a wide tree', async ({ page }) => {
        // 200 nodes of radius 10 want ~5.4× between siblings — an ordinary graph size
        // asking for more than the multipliers used to be allowed to give.
        await harness(page, 'loadAuto', { nodes: 200, radius: 10 }, { layout: { type: 'tree' } })
        expect((await spacingOf(page)).siblingSpacing).toBeGreaterThan(4)
    })

    test('auto opens up the levels of a deep chain', async ({ page }) => {
        // A 40-node chain is 39 levels deep: ~18px of canvas per level against the
        // ~44px two default nodes and an arrowhead need, so auto asks for ~2.4×.
        await harness(page, 'loadAuto', { nodes: 2, radius: 10 }, { layout: { type: 'tree' } })
        // Grown *after* the layout exists, so this also pins auto's promise to keep
        // re-deriving as the graph changes: the 2-node tree needed nothing.
        await harness(page, 'growAuto', 38, 10)
        const spacing = await spacingOf(page)
        expect(spacing.levelSpacing).toBeGreaterThan(2)
        expect(spacing.siblingSpacing).toBe(1)
    })

    test('a node with no usable radius does not blank the layout', async ({ page }) => {
        await loadFixture(page, 'tree', { layout: { type: 'tree' } })
        // A custom node has no radius until it has measured itself. That used to reach the
        // tuner as NaN, and from there the multiplier and every coordinate d3 derives from
        // it — a blank canvas rather than a slightly wrong one.
        const finite = await page.evaluate(() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const g = (window.__pivotick as any).graph
            g.getMutableNodes()[0].setCircleRadius(undefined)
            g.simulation.enableAutoTreeSpacing()
            return g.getNodes().every((n: { x: number; y: number }) =>
                Number.isFinite(n.x) && Number.isFinite(n.y))
        })
        expect(finite).toBe(true)
        expect(await spacingOf(page)).toEqual({ levelSpacing: 1, siblingSpacing: 1 })
    })

    test('a hand-set multiplier opts out of auto entirely', async ({ page }) => {
        // Configuring either multiplier is taken as having made up your mind: auto must
        // not tune a crowded graph out from under the value it was given.
        await harness(page, 'loadAuto', { nodes: 60, radius: 30 }, { layout: { type: 'tree', levelSpacing: 1.5 } })
        expect(await spacingOf(page)).toEqual({ levelSpacing: 1.5, siblingSpacing: 1 })
    })

    // T3.7 — a hierarchy declared in the data rather than derived from the edges.
    test('declared depth starts a second tree lower down', async ({ page }) => {
        const p = await positionsAfterLayout(page, 'declaredForest', { type: 'tree', depthKey: 'level' })
        const rows = rowsOf(p)
        // `b` asked for row 2 and gets it, two rows below the root that asked for nothing —
        // which is the thing a forest could not express at all before.
        expect(rows).toEqual({ a: 0, a1: 1, a2: 1, b: 2, b1: 3, b2: 3 })
    })

    test('without depthKey the same forest keeps both roots on one row', async ({ page }) => {
        // The `level` field is still in the fixture's data; not naming it must leave it inert.
        const p = await positionsAfterLayout(page, 'declaredForest', { type: 'tree' })
        expect(rowsOf(p)).toEqual({ a: 0, a1: 1, a2: 1, b: 0, b1: 1, b2: 1 })
    })

    test('declared depth pads the gap, clamps a conflict, honours a parent with no edge', async ({ page }) => {
        const p = await positionsAfterLayout(
            page, 'declaredHierarchy', { type: 'tree', parentKey: 'parentId', depthKey: 'level' }
        )
        expect(rowsOf(p)).toEqual({
            root: 0,
            mid: 1,
            // `deep` asked for row 4 under a parent on row 1: the two rows between stay empty.
            deep: 4,
            // `clash` asked for row 1, level with its own parent — clamped to just below it.
            clash: 2,
            // `free` has no edge at all and named `root` as its parent, so it hangs off it
            // rather than going to the parked wedge.
            free: 1,
        })
    })

    test('a clamped depth says so', async ({ page }) => {
        await loadFixture(page, 'declaredHierarchy', { layout: { type: 'tree', depthKey: 'level' } })
        const warnings = (await harness(page, 'warnings')) as string[]
        const clamps = warnings.filter((w) => /clamped to just below their parent/.test(w))
        expect(clamps).toHaveLength(1)
    })

    test('the empty rows are scaffolding, not nodes', async ({ page }) => {
        // `deep` asking for row 4 pads the hierarchy with two extra rows. They must never
        // reach the graph: no phantom node, and nothing drawn on those rows.
        await loadFixture(page, 'declaredHierarchy', { layout: { type: 'tree', depthKey: 'level' } })
        await harness(page, 'applyLayout')
        expect(await harness(page, 'counts')).toMatchObject({ nodes: 5, edges: 3 })
        expect(await page.locator('.node').count()).toBe(5)
    })

    test('declared hierarchy — vertical', async ({ page }) => {
        await loadFixture(page, 'declaredForest', { layout: { type: 'tree', depthKey: 'level' } })
        await harness(page, 'applyLayout')
        await expectCanvas(page, 'layout-tree-declared-forest.png')
    })

    test('ego tree positions — neighbours fan out from the root', async ({ page }) => {
        const p = await positionsAfterLayout(page, 'egoNet', { type: 'egoTree', rootId: 'ego' })
        const neighbours = ['n1', 'n2', 'n3', 'n4', 'n5', 'n6']
        // Every neighbour is one level below the ego and they share that row.
        for (const id of neighbours) {
            expect(p[id].y).toBeGreaterThan(p.ego.y)
            expect(Math.abs(p[id].y - p.n1.y)).toBeLessThan(1)
        }
        // The ego is horizontally centred within its neighbours' spread.
        const xs = neighbours.map((id) => p[id].x)
        expect(p.ego.x).toBeGreaterThan(Math.min(...xs))
        expect(p.ego.x).toBeLessThan(Math.max(...xs))
    })
})
