import { test, expect, gotoHarness, loadFixture, harness, expectCanvas, nodeEl } from '../helpers'
import type { Page } from '@playwright/test'
import type { FixtureName } from '../harness/fixtures'

/**
 * Area 4 — clustering / expand-collapse (T4.1–T4.3).
 *
 * The `clustered` fixture is a parent `group` (with a nested sub-cluster `c1`)
 * plus two external nodes whose edges point into the cluster. Determinism:
 *
 *  - Top-level positions are pinned (`harness.pin`) like the other static scenes.
 *  - A cluster's *children* are normally placed by a per-cluster force pass, which
 *    is timing-dependent. `harness.expand` freezes that pass and re-pins the
 *    children onto a fixed ring, so the expanded/nested baselines are stable.
 */
async function loadPinned(page: Page, name: FixtureName, overrides: Record<string, unknown> = {}) {
    await loadFixture(page, name, overrides)
    await harness(page, 'pin')
}

/**
 * Expand a cluster the way a user does — by clicking its affordance — leaving the library's
 * own placement alone. `harness.expand` re-seats the rim chrome itself after tightening the
 * bubble, so it cannot see where the library would have put it.
 */
async function expandByClick(page: Page, id: string) {
    await nodeEl(page, id).locator('.expand-icon circle').click()
    await nodeEl(page, id).locator('.pvt-cluster-area').waitFor({ state: 'attached' })
    // The bubble grows over a 250ms d3 transition, which Playwright's animation freeze
    // does not touch.
    await page.waitForTimeout(400)
}

/** How far from the cluster's centre the collapse affordance ended up. */
async function collapseIconReach(page: Page, id: string): Promise<number> {
    const anchor = await harness(page, 'nodeIconAnchor', id) as { x: number, y: number } | null
    if (!anchor) throw new Error(`node ${id} has no expand/collapse affordance`)
    return Math.hypot(anchor.x, anchor.y)
}

test.describe('clustering', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    // T4.1 — collapsed cluster: dashed parent circle + synthetic edges to `group`.
    test('collapsed cluster', async ({ page }) => {
        await loadPinned(page, 'clustered')
        await expectCanvas(page, 'cluster-collapsed.png')
    })

    // T4.2 — expanded cluster: children inside the cluster area (c1 a sub-cluster).
    test('expanded cluster', async ({ page }) => {
        await loadPinned(page, 'clustered')
        await harness(page, 'expand', 'group')
        await harness(page, 'fit')
        await expectCanvas(page, 'cluster-expanded.png')
    })

    // T4.3 — nested cluster: expand `group`, then the sub-cluster `c1` inside it.
    test('nested cluster', async ({ page }) => {
        await loadPinned(page, 'clustered')
        await harness(page, 'expand', ['group', 'c1'])
        await harness(page, 'fit')
        await expectCanvas(page, 'cluster-nested.png')
    })

    // T4.4 — the collapse affordance rides the bubble, not the node inside it. Expanding
    // pushes the node's own shape to the NW rim, so anchoring off that shape leaves the
    // affordance stranded near the cluster's centre. Screenshots are blind to a 16px circle
    // moving, so this is read off the geometry: the affordance sits on the 45° diagonal at
    // the bubble's radius plus the 2px rim padding.
    test('the collapse affordance sits on the cluster rim', async ({ page }) => {
        await loadPinned(page, 'clustered')
        await expandByClick(page, 'group')

        const radius = await harness(page, 'clusterRimRadius', 'group') as number
        expect(radius).toBeGreaterThan(0)
        expect(await collapseIconReach(page, 'group')).toBeCloseTo(radius + 2, 0)
    })
})
