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

async function positionsAfterLayout(page: Page, name: 'tree' | 'egoNet', layout: Record<string, unknown>): Promise<Positions> {
    await loadFixture(page, name, { layout })
    await harness(page, 'applyLayout')
    return (await harness(page, 'nodePositions')) as Positions
}

/** Distance from the origin (radial layouts place the root at (0, 0)). */
const radius = (p: { x: number; y: number }) => Math.hypot(p.x, p.y)

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

    test('a hand-set multiplier opts out of auto entirely', async ({ page }) => {
        // Configuring either multiplier is taken as having made up your mind: auto must
        // not tune a crowded graph out from under the value it was given.
        await harness(page, 'loadAuto', { nodes: 60, radius: 30 }, { layout: { type: 'tree', levelSpacing: 1.5 } })
        expect(await spacingOf(page)).toEqual({ levelSpacing: 1.5, siblingSpacing: 1 })
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
