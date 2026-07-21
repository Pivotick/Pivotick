import { test, expect, gotoHarness, loadFixture, harness } from '../helpers'

// ── The Neighbors › List tab ──────────────────────────────────────────────────
// Each connection is one clickable row: a direction glyph (out / in), the
// neighbour's node preview + name, and — only for a labelled edge — a subtle
// label chip. Clicking a row walks the selection to that neighbour.

const FULL = { UI: { mode: 'full', sidebar: { collapsed: false } } }

async function selectedIds(page: import('@playwright/test').Page): Promise<string[]> {
    return ((await harness(page, 'selectedNodeIds')) as string[]).slice().sort()
}

/** Open the Neighbors › List tab for the currently selected node. */
async function openListTab(page: import('@playwright/test').Page) {
    await page.locator('.pvt-neighbors-header-panel [data-tab-control="list"]').click()
    const list = page.locator('.pvt-neighbor-panel div[data-tab-panel="list"]')
    await list.locator('.pvt-neighbor-row').first().waitFor()
    return list
}

/** The row for a given neighbour, addressed by the id stamped on it. */
function row(list: import('@playwright/test').Locator, nodeId: string) {
    return list.locator(`.pvt-neighbor-row[data-node-id="${nodeId}"]`)
}

test.describe('connection list', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
        await loadFixture(page, 'neighbors', FULL)
        await harness(page, 'selectNode', 'hub')
    })

    test('renders one row per connection', async ({ page }) => {
        const list = await openListTab(page)
        await expect(list.locator('.pvt-neighbor-row')).toHaveCount(7)
    })

    test('marks each row with its edge direction', async ({ page }) => {
        const list = await openListTab(page)
        // hub → pg is outgoing; web → hub is incoming.
        await expect(row(list, 'pg').locator('.pvt-neighbor-row__dir')).toHaveClass(/edge-out/)
        await expect(row(list, 'web').locator('.pvt-neighbor-row__dir')).toHaveClass(/edge-in/)
    })

    test('shows a label chip only for labelled edges', async ({ page }) => {
        const list = await openListTab(page)
        // A labelled edge carries its label verbatim…
        await expect(row(list, 'pg').locator('.pvt-neighbor-row__label')).toHaveText('queries')
        // …an unlabeled edge shows no chip at all (no loud "— empty —" pill).
        await expect(row(list, 'health').locator('.pvt-neighbor-row__label')).toHaveCount(0)
    })

    test('keeps the full neighbour name (CSS truncates long ones)', async ({ page }) => {
        const list = await openListTab(page)
        await expect(row(list, 'admin').locator('.pvt-neighbor-row__name'))
            .toHaveText('Administration Console Dashboard')
    })

    test('clicking a row walks the selection to that neighbour', async ({ page }) => {
        const list = await openListTab(page)
        await row(list, 'web').click()
        expect(await selectedIds(page)).toEqual(['web'])
    })
})
