import { test, expect, gotoHarness, loadFixture, harness } from '../helpers'

// ── Filtering by clicking the connection-stat facet (Neighbors › Stats) ───────
// For a single selected node the Stats tab shows a "Label" facet: the
// distribution of its connections' edge labels. Like the node-property facets,
// the coloured bar segments are clickable:
//   • plain click        → select the neighbours linked through that label,
//   • Alt/Ctrl/Cmd-click → select the neighbours linked through any OTHER label.
// The `neighbors` fixture hub has requests×3 / queries×2 / authenticates×1 and
// one unlabeled edge, so the facet is a segmented distribution.

const FULL = { UI: { mode: 'full', sidebar: { collapsed: false } } }

/** The current node selection, sorted so equality checks read declaratively. */
async function selectedIds(page: import('@playwright/test').Page): Promise<string[]> {
    return ((await harness(page, 'selectedNodeIds')) as string[]).slice().sort()
}

/** Open the Neighbors › Stats tab for the currently selected node. */
async function openStatsTab(page: import('@playwright/test').Page) {
    await page.locator('.pvt-neighbors-header-panel [data-tab-control="stats"]').click()
    return page.locator('.pvt-neighbor-panel div[data-tab-panel="stats"]')
}

test.describe('connection-stat facet filter', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
        await loadFixture(page, 'neighbors', FULL)
        await harness(page, 'selectNode', 'hub')
    })

    test('clicking a label segment selects the neighbours linked through it', async ({ page }) => {
        const stats = await openStatsTab(page)

        // The "requests" segment covers the three clients (web, mobile, admin).
        const requestsSeg = stats.locator('.pvt-facet-bar-seg[title^="requests"]')
        await expect(requestsSeg).toHaveClass(/pvt-facet-filterable/)

        await requestsSeg.click()
        expect(await selectedIds(page)).toEqual(['admin', 'mobile', 'web'])
    })

    test('Alt-clicking a label segment selects the neighbours linked through other labels', async ({ page }) => {
        const stats = await openStatsTab(page)

        // Exclude "queries" → everything except the two DB services (pg, redis):
        // the three clients + auth + the unlabeled health probe.
        await stats.locator('.pvt-facet-bar-seg[title^="queries"]').click({ modifiers: ['Alt'] })
        expect(await selectedIds(page)).toEqual(['admin', 'auth', 'health', 'mobile', 'web'])
    })

    test('the unlabeled connection is not a filter affordance', async ({ page }) => {
        const stats = await openStatsTab(page)

        // Three real labels are clickable; the empty-label segment is inert.
        await expect(stats.locator('.pvt-facet-bar-seg.pvt-facet-filterable')).toHaveCount(3)
    })
})
