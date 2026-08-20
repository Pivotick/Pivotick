import { test, expect, gotoHarness, loadFixture, harness } from '../helpers'

// ── The grid inside the dock ─────────────────────────────────────────────────
// Rows, sorting, the Visibility column, table-local column filters, and the
// column picker.
//
// The invariant worth defending: the grid lists the WHOLE graph and reports each
// node's visibility, and narrowing the rows never touches the canvas. Those two
// together are what make it a reading lens rather than a second filter fighting
// the first.

type Page = import('@playwright/test').Page

/* eslint-disable @typescript-eslint/no-explicit-any */

const FULL = { UI: { mode: 'full', sidebar: { collapsed: false }, table: { open: true } } }

const openDock = async (page: Page, fixture = 'basic', overrides: Record<string, unknown> = FULL) => {
    await loadFixture(page, fixture as never, overrides)
    await page.locator('.pvt-table-grid').waitFor()
    // The grid builds on a coalescing frame, so wait for rows rather than assume.
    await page.locator('.pvt-table-row').first().waitFor()
}

/**
 * Column headings, in the order they are shown. `textContent`, not `innerText`:
 * the headings are `text-transform: uppercase`, which `innerText` would apply.
 */
const headings = (page: Page) =>
    page.locator('.pvt-table-th-label').evaluateAll((cells) =>
        cells.map((cell) => (cell.textContent ?? '').trim()))

const rowIds = (page: Page) =>
    page.locator('.pvt-table-row').evaluateAll((rows) => rows.map((row) => (row as HTMLElement).dataset.id!))

/** One column's cells, top to bottom, by heading. */
const columnCells = async (page: Page, heading: string) => {
    const index = (await headings(page)).indexOf(heading)
    expect(index).toBeGreaterThanOrEqual(0)
    return page.locator('.pvt-table-row').evaluateAll(
        (rows, i) => rows.map((row) => row.children[i as number]?.textContent?.trim() ?? ''),
        index,
    )
}

const summary = (page: Page) =>
    page.locator('.pvt-table-summary').evaluate((el) => (el.textContent ?? '').trim())

const visibleNodeCount = (page: Page) =>
    page.evaluate(() => (window.__pivotick as any).graph.getMutableVisibleNodes().length)

/** The Visibility column, keyed by row id. */
const visibilityById = async (page: Page) => {
    const rows = await rowIds(page)
    const states = await columnCells(page, 'Visibility')
    return Object.fromEntries(rows.map((id, i) => [id, states[i]]))
}

test.describe('table grid', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    test('leads with the graph-aware columns, then the data', async ({ page }) => {
        await openDock(page)

        const columns = await headings(page)
        expect(columns.slice(0, 3)).toEqual(['Label', 'Degree', 'Visibility'])
        // `label` is the built-in Label column's source, so it is not repeated.
        expect(columns.filter((name) => name === 'Label')).toHaveLength(1)
    })

    test('lists every node, with a count', async ({ page }) => {
        await openDock(page)

        expect((await rowIds(page)).sort()).toEqual(['a', 'b', 'c', 'd', 'e', 'hub'])
        expect(await summary(page)).toBe('6 nodes')
    })

    test('the Label column shows the display name', async ({ page }) => {
        await openDock(page)
        expect((await columnCells(page, 'Label')).sort()).toEqual(['A', 'B', 'C', 'D', 'E', 'HUB'])
    })

    test('Degree is computed from the edges', async ({ page }) => {
        await openDock(page)

        const rows = await rowIds(page)
        const degrees = await columnCells(page, 'Degree')
        const byId = Object.fromEntries(rows.map((id, i) => [id, degrees[i]]))
        // a: a-b, e-a, hub-a. hub: hub-a, hub-c.
        expect(byId.a).toBe('3')
        expect(byId.hub).toBe('2')
    })

    // The superset rule: a hidden node stays listed, and the column says why.
    // Note `graph.hideNode()` is deliberately not exercised here — it flips visibility
    // and re-renders without emitting any event, so nothing can observe it (the minimap
    // has the same blind spot). The observable paths are the query engine's.
    test('a manually excluded node stays listed, marked excluded', async ({ page }) => {
        await openDock(page)
        await harness(page, 'excludeNode', 'a')
        await expect.poll(() => visibilityById(page).then((byId) => byId.a)).toBe('excluded')

        // Still all six rows — nothing is dropped from the table.
        expect((await rowIds(page)).sort()).toEqual(['a', 'b', 'c', 'd', 'e', 'hub'])

        const byId = await visibilityById(page)
        expect(byId.a).toBe('excluded')
        expect(byId.c).toBe('visible')
    })

    test('a filtered-out node stays listed, marked filtered', async ({ page }) => {
        await openDock(page)
        // Only HUB matches, so the other five are hidden by the graph filter.
        await harness(page, 'setFilter', 'label', { value: 'HUB', matchMode: 'exact' })
        await expect.poll(() => visibleNodeCount(page)).toBe(1)
        await expect.poll(() => visibilityById(page).then((byId) => byId.a)).toBe('filtered')

        expect((await rowIds(page)).sort()).toEqual(['a', 'b', 'c', 'd', 'e', 'hub'])

        const byId = await visibilityById(page)
        expect(byId.hub).toBe('visible')
        expect(byId.a).toBe('filtered')
        expect(byId.e).toBe('filtered')
    })

    test('clicking a heading sorts, and clicking again reverses', async ({ page }) => {
        await openDock(page)

        const degreeHeading = page.locator('.pvt-table-th-label', { hasText: 'Degree' })
        await degreeHeading.click()
        const ascending = (await columnCells(page, 'Degree')).map(Number)
        expect(ascending).toEqual([...ascending].sort((a, b) => a - b))

        await degreeHeading.click()
        const descending = (await columnCells(page, 'Degree')).map(Number)
        expect(descending).toEqual([...ascending].reverse())
    })

    // The load-bearing separation: narrowing rows is reading, not filtering the graph.
    test('a column filter narrows the rows and leaves the canvas alone', async ({ page }) => {
        await loadFixture(page, 'basic', {
            UI: {
                mode: 'full',
                sidebar: { collapsed: false },
                table: { open: true, columns: [{ key: 'label', label: 'Label', type: 'text', filterable: true }] },
            },
        })
        await page.locator('.pvt-table-row').first().waitFor()

        const before = await visibleNodeCount(page)
        expect(await rowIds(page)).toHaveLength(6)

        await page.locator('.pvt-table-filter').first().fill('HUB')
        await expect(page.locator('.pvt-table-row')).toHaveCount(1)

        expect(await rowIds(page)).toEqual(['hub'])
        expect(await summary(page)).toBe('1 of 6 nodes')
        // The graph did not move.
        expect(await visibleNodeCount(page)).toBe(before)
    })

    test('the column picker hides and restores a column', async ({ page }) => {
        await openDock(page)
        expect(await headings(page)).toContain('Degree')

        await page.locator('.pvt-table-columns-button').click()
        const degreeToggle = page.locator('.pvt-table-columns-row', { hasText: 'Degree' }).locator('input')
        await degreeToggle.uncheck()
        expect(await headings(page)).not.toContain('Degree')

        await degreeToggle.check()
        expect(await headings(page)).toContain('Degree')
    })

    // Declared facets describe the data once; the filter panel and the grid both read them.
    test('declared facets become the data columns', async ({ page }) => {
        await loadFixture(page, 'mispLike', {
            UI: {
                mode: 'full',
                sidebar: { collapsed: false },
                table: { open: true },
                filter: {
                    facets: [
                        { key: 'category', label: 'Category', type: 'multiselect' },
                        { key: 'to_ids', label: 'To IDs', type: 'boolean' },
                    ],
                },
            },
        })
        await page.locator('.pvt-table-row').first().waitFor()

        const columns = await headings(page)
        expect(columns).toEqual(['Label', 'Degree', 'Visibility', 'Category', 'To IDs'])
    })

    test('a new node appears without reopening the dock', async ({ page }) => {
        await openDock(page)
        expect(await rowIds(page)).toHaveLength(6)

        await harness(page, 'addNode', 'zz', 200, 200, 'ZZ')
        await expect(page.locator('.pvt-table-row')).toHaveCount(7)

        expect(await rowIds(page)).toContain('zz')
    })
})
