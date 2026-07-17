import { test, expect, gotoHarness, loadFixture, harness } from '../helpers'

// ── Filtering a multi-selection by clicking the facet cards ───────────────────
// Besides the row "Keep only" / "Exclude" icons, the coloured distribution-bar
// segments and the all-unique value pills are themselves clickable:
//   • plain click        → keep only nodes carrying that value,
//   • Alt/Ctrl/Cmd-click → exclude nodes carrying that value.
// The `facetSample` fixture (6 people, all group=C) gives a "values" distribution
// on `gender` (female ×4 / male ×2) and an all-unique `label`, so it exercises
// both a bar segment and a pill.

const FULL = { UI: { mode: 'full', sidebar: { collapsed: false } } }
const ALL = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6']

/** The current node selection, sorted so equality checks read declaratively. */
async function selectedIds(page: import('@playwright/test').Page): Promise<string[]> {
    return ((await harness(page, 'selectedNodeIds')) as string[]).slice().sort()
}

test.describe('facet filter clicks', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
        await loadFixture(page, 'facetSample', FULL)
    })

    test('clicking a bar segment keeps only nodes with that value', async ({ page }) => {
        await harness(page, 'multiSelect', ALL)
        const props = page.locator('.pvt-properties-body-panel')

        // The `gender` facet renders one bar segment per value; the "male" one
        // covers C2 and C5. Its class marks it as a filter affordance.
        const maleSeg = props.locator('.pvt-facet-bar-seg[title^="male"]')
        await expect(maleSeg).toHaveClass(/pvt-facet-filterable/)

        await maleSeg.click()
        expect(await selectedIds(page)).toEqual(['C2', 'C5'])
    })

    test('Alt-clicking a bar segment excludes nodes with that value', async ({ page }) => {
        await harness(page, 'multiSelect', ALL)
        const props = page.locator('.pvt-properties-body-panel')

        await props.locator('.pvt-facet-bar-seg[title^="male"]').click({ modifiers: ['Alt'] })
        // The two males (C2, C5) drop out; the four females remain.
        expect(await selectedIds(page)).toEqual(['C1', 'C3', 'C4', 'C6'])
    })

    test('clicking a unique-value pill keeps only that node', async ({ page }) => {
        await harness(page, 'multiSelect', ALL)
        const props = page.locator('.pvt-properties-body-panel')

        // `label` is all-unique → rendered as chips; "Mallory" is C1's label.
        const mallory = props.locator('.pvt-facet-chip', { hasText: 'Mallory' })
        await expect(mallory).toHaveClass(/pvt-facet-filterable/)

        await mallory.click()
        expect(await selectedIds(page)).toEqual(['C1'])
    })

    test('Alt-clicking a unique-value pill excludes that node', async ({ page }) => {
        await harness(page, 'multiSelect', ALL)
        const props = page.locator('.pvt-properties-body-panel')

        await props.locator('.pvt-facet-chip', { hasText: 'Mallory' }).click({ modifiers: ['Alt'] })
        // Only Mallory (C1) drops out.
        expect(await selectedIds(page)).toEqual(['C2', 'C3', 'C4', 'C5', 'C6'])
    })
})
