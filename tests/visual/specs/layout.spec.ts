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
