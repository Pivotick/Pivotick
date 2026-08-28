import { test, expect, gotoHarness, loadFixture, harness } from '../helpers'

// ── What "N hidden" counts ───────────────────────────────────────────────────
// The filter pill's muted subtext is `queryEngine.getHiddenNodeCount()`. It used
// to be `every node in the map − the visible top-level ones`, which quietly folded
// a cluster's collapsed descendants into the total: they are rows of their parent's
// subgraph, not of this graph, so no filter here can hide them.
//
// Nobody could see the contradiction until the data dock listed the same nodes
// beside the pill — the last test is that pairing, and is the one a regression
// would be noticed through.

type Page = import('@playwright/test').Page

const WITH_DOCK = { UI: { mode: 'full', sidebar: { collapsed: false }, table: { open: true } } }

/** The pill's "N hidden" subtext — `''` when the pill isn't showing one. */
const pillHiddenText = async (page: Page) => {
    const chip = page.locator('.pvt-filter-hidden')
    return (await chip.count()) === 0 ? '' : ((await chip.textContent()) ?? '').trim()
}

/** Rows the dock reports as off-canvas — the `Visibility` chip in any non-visible state. */
const dockHiddenRowCount = (page: Page) =>
    page.locator('.pvt-table-td[data-visibility="filtered"], .pvt-table-td[data-visibility="excluded"]').count()

test.describe('hidden-node count', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    // A flat graph: the plain case the old arithmetic already got right, kept so the
    // fix can't be mistaken for "count fewer nodes".
    test('counts the nodes a filter removed', async ({ page }) => {
        await loadFixture(page, 'filterable')
        await harness(page, 'setFilter', 'type', { value: 'router', matchMode: 'exact' })

        // 8 nodes, 3 routers.
        expect(await harness(page, 'visibleNodeIds')).toEqual(['r1', 'r2', 'r3'])
        expect(await harness(page, 'hiddenNodeCount')).toBe(5)
    })

    // Regression: `clustered` holds 3 top-level nodes over 5 collapsed descendants.
    // The filter hides exactly one of the three — the old count said 6.
    test('ignores a cluster\'s collapsed children', async ({ page }) => {
        await loadFixture(page, 'clustered')
        await harness(page, 'setFilter', 'label', { value: 'EXT', matchMode: 'partial' })

        expect(await harness(page, 'visibleNodeIds')).toEqual(['ext1', 'ext2'])
        expect(await harness(page, 'hiddenNodeCount')).toBe(1)
    })

    // Nothing is hidden here, so the pill must not offer a subtext at all — the old
    // count showed "5 hidden" over a graph with every node on screen.
    test('says nothing when a filter hides nothing', async ({ page }) => {
        await loadFixture(page, 'clustered')
        await harness(page, 'setFilter', 'label', { value: '', matchMode: 'partial' })

        expect(await harness(page, 'hiddenNodeCount')).toBe(0)
        await expect(page.locator('.pvt-filter-status')).toBeVisible()
        expect(await pillHiddenText(page)).toBe('')
    })

    // The pairing that exposed it: the pill and the dock describe the same nodes, so
    // they have to agree on how many of them are off the canvas.
    test('agrees with the dock\'s Visibility column', async ({ page }) => {
        await loadFixture(page, 'clustered', WITH_DOCK)
        await page.locator('.pvt-table-row').first().waitFor()
        await harness(page, 'setFilter', 'label', { value: 'EXT', matchMode: 'partial' })

        // The dock lists what the cluster holds too — 3 top-level nodes over 5
        // descendants. They do not disturb the pairing, because a nested row reads
        // `nested` rather than `filtered`: nothing filtered it, and no filter brings it
        // back. That distinction is the whole reason the count still agrees.
        await expect(page.locator('.pvt-table-row')).toHaveCount(8)
        await expect.poll(() => dockHiddenRowCount(page)).toBe(1)
        expect(await pillHiddenText(page)).toBe('1 hidden')
    })
})
