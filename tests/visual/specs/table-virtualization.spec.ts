import { test, expect, gotoHarness, harness } from '../helpers'

// ── Row windowing ───────────────────────────────────────────────────────────
// Under the threshold every row is in the DOM, which keeps the ordinary case easy
// to debug and to screenshot. Over it, only a window of rows is rendered while the
// scroll height still measures the whole dataset.

type Page = import('@playwright/test').Page

const FULL = (table: Record<string, unknown> = {}) => ({
    UI: { mode: 'full', sidebar: { collapsed: false }, table: { open: true, ...table } },
})

const load = async (page: Page, count: number, table: Record<string, unknown> = {}) => {
    await harness(page, 'loadManyNodes', count, FULL(table))
    await page.locator('.pvt-table-row').first().waitFor()
}

const renderedRows = (page: Page) => page.locator('.pvt-table-row').count()
const rowsContainer = (page: Page) => page.locator('.pvt-table-rows')
const body = (page: Page) => page.locator('.pvt-dock-body')

const summary = (page: Page) =>
    page.locator('.pvt-table-summary').evaluate((el) => (el.textContent ?? '').trim())

test.describe('table row windowing', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    test('under the threshold every row is rendered', async ({ page }) => {
        await load(page, 40, { virtualizeAbove: 200 })

        expect(await renderedRows(page)).toBe(40)
        await expect(rowsContainer(page)).not.toHaveClass(/pvt-table-rows-windowed/)
        expect(await summary(page)).toBe('40 nodes')
    })

    test('over the threshold only a window is rendered', async ({ page }) => {
        await load(page, 800, { virtualizeAbove: 200 })

        await expect(rowsContainer(page)).toHaveClass(/pvt-table-rows-windowed/)
        // A few screens' worth, nowhere near 800.
        const rendered = await renderedRows(page)
        expect(rendered).toBeGreaterThan(0)
        expect(rendered).toBeLessThan(120)
        // …and the count still reports the whole dataset.
        expect(await summary(page)).toBe('800 nodes')
    })

    test('the scroll height measures the data, not the rendered rows', async ({ page }) => {
        await load(page, 800, { virtualizeAbove: 200 })

        const heights = await rowsContainer(page).evaluate((element) => ({
            declared: (element as HTMLElement).style.height,
            scroll: element.scrollHeight,
        }))
        // 800 rows × 24px.
        expect(heights.declared).toBe('19200px')
        expect(heights.scroll).toBeGreaterThan(19000)
    })

    test('scrolling brings later rows in and lets earlier ones go', async ({ page }) => {
        await load(page, 800, { virtualizeAbove: 200 })

        const firstIds = await page.locator('.pvt-table-row').evaluateAll((rows) =>
            rows.map((row) => (row as HTMLElement).dataset.id!))
        expect(firstIds).toContain('bulk-0')

        await body(page).evaluate((element) => { element.scrollTop = 9600 })
        await expect.poll(() => page.locator('.pvt-table-row').evaluateAll((rows) =>
            rows.map((row) => (row as HTMLElement).dataset.id!))).not.toContain('bulk-0')

        const laterIds = await page.locator('.pvt-table-row').evaluateAll((rows) =>
            rows.map((row) => (row as HTMLElement).dataset.id!))
        // 9600px / 24px = row 400.
        expect(laterIds.some((id) => id === 'bulk-400')).toBe(true)
    })

    // Sorting reorders the underlying array, so the window has to reflect the new order
    // rather than the old positions.
    test('sorting a windowed table reorders it', async ({ page }) => {
        await load(page, 800, { virtualizeAbove: 200 })

        const seqHeading = page.locator('.pvt-table-th-label', { hasText: 'Seq' })
        await seqHeading.click()
        await seqHeading.click()

        const ids = await page.locator('.pvt-table-row').evaluateAll((rows) =>
            rows.map((row) => (row as HTMLElement).dataset.id!))
        // Descending by `seq` puts the last node first.
        expect(ids[0]).toBe('bulk-799')
    })

    test('a windowed row can still be selected', async ({ page }) => {
        await load(page, 800, { virtualizeAbove: 200 })

        await page.locator('.pvt-table-row[data-id="bulk-3"]').click()

        await expect.poll(() => harness(page, 'selectedNodeIds')).toEqual(['bulk-3'])
        await expect(page.locator('.pvt-table-row-selected')).toHaveCount(1)
    })

    // The reader's place is kept across a rebuild — otherwise any graph change would
    // fling them back to the top.
    test('a rebuild keeps the scroll position', async ({ page }) => {
        await load(page, 800, { virtualizeAbove: 200 })

        await body(page).evaluate((element) => { element.scrollTop = 4800 })
        await expect.poll(() => body(page).evaluate((element) => element.scrollTop)).toBe(4800)

        // Any data change triggers the coalesced rebuild.
        await harness(page, 'addNode', 'zz', 10, 10, 'ZZ')
        await expect.poll(() => summary(page)).toBe('801 nodes')

        expect(await body(page).evaluate((element) => element.scrollTop)).toBe(4800)
    })
})
