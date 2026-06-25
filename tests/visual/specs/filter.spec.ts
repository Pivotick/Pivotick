import { test, expect, gotoHarness, loadFixture, harness, expectCanvas } from '../helpers'
import type { Page } from '@playwright/test'
import type { FixtureName } from '../harness/fixtures'

/**
 * Area 5 — filtering / query engine (T5.1–T5.4).
 *
 * The `filterable` fixture is a small network whose nodes carry a categorical
 * `type` (`router`/`switch`/`host`) and a numeric `ports` field. Filtered-out
 * nodes are **removed** from the render (along with their edges), not dimmed.
 *
 *  - T5.1–T5.3 drive `graph.queryEngine` directly (set/reset/exclude) and
 *    screenshot the canvas. Positions are pinned (`harness.pin`) like the other
 *    static scenes so the framing is fixed: the same viewport frames the full
 *    graph, so removed nodes simply leave gaps (directly comparable across the
 *    applied / reset baselines).
 *  - T5.4 opens the Graph-Filters slide panel and snapshots the generated form.
 */
async function loadPinned(page: Page, name: FixtureName, overrides: Record<string, unknown> = {}) {
    await loadFixture(page, name, overrides)
    await harness(page, 'pin')
}

test.describe('filtering', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    // T5.1 — a filter removes non-matching nodes + their edges (keep only routers).
    test('filter hides nodes', async ({ page }) => {
        await loadPinned(page, 'filterable')
        await harness(page, 'setFilter', 'type', { value: 'router', matchMode: 'exact' })
        await expectCanvas(page, 'filter-applied.png')
    })

    // T5.2 — resetting the filter restores the full graph.
    test('filter then reset', async ({ page }) => {
        await loadPinned(page, 'filterable')
        await harness(page, 'setFilter', 'type', { value: 'router', matchMode: 'exact' })
        await harness(page, 'resetFilters')
        await expectCanvas(page, 'filter-reset.png')
    })

    // T5.3 — a single node hidden by hand (queryEngine.excludeNode).
    test('manually excluded node', async ({ page }) => {
        await loadPinned(page, 'filterable')
        await harness(page, 'excludeNode', 'h2')
        await expectCanvas(page, 'filter-node-excluded.png')
    })

    // T5.4 — the filter slide panel + its generated form (one control per data field).
    test('filter panel UI', async ({ page }) => {
        await loadFixture(page, 'filterable')
        await harness(page, 'openFilterPanel')
        const panel = page.locator('.pvt-slide-panel.open')
        await panel.waitFor({ state: 'visible' })
        await expect(panel).toHaveScreenshot('filter-panel.png')
    })
})
