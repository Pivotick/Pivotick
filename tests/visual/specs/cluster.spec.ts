import { test, gotoHarness, loadFixture, harness, expectCanvas } from '../helpers'
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
})
