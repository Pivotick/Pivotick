import { readFileSync } from 'node:fs'
import { test, expect, gotoHarness, loadFixture } from '../helpers'

// ── Export, and the Edges tab ───────────────────────────────────────────────
// Export means "what I am looking at": this tab, these columns in this order,
// this sort, this row filter. Not the whole graph — that is `graph.getNodes()`
// away for anyone with code.

type Page = import('@playwright/test').Page

const FULL = { UI: { mode: 'full', sidebar: { collapsed: false }, table: { open: true } } }

const openDock = async (page: Page, overrides: Record<string, unknown> = FULL) => {
    await loadFixture(page, 'basic', overrides)
    await page.locator('.pvt-table-row').first().waitFor()
}

/** Click an export button and return the file's text. */
async function exportText(page: Page, format: 'CSV' | 'JSON'): Promise<string> {
    const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.locator(`.pvt-table-export[data-format="${format.toLowerCase()}"]`).click(),
    ])
    const path = await download.path()
    expect(path).toBeTruthy()
    return readFileSync(path!, 'utf8')
}

test.describe('table export', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    test('CSV carries the visible columns and every listed row', async ({ page }) => {
        await openDock(page)
        const csv = await exportText(page, 'CSV')

        const lines = csv.split('\r\n')
        expect(lines[0]).toBe('Visibility,Degree,Label')
        // Six nodes plus the header.
        expect(lines).toHaveLength(7)
        expect(csv).toContain('visible,2,HUB')
    })

    test('JSON is one object per row, keyed by column label', async ({ page }) => {
        await openDock(page)
        const parsed = JSON.parse(await exportText(page, 'JSON'))

        expect(parsed).toHaveLength(6)
        expect(Object.keys(parsed[0])).toEqual(['Visibility', 'Degree', 'Label'])
        expect(parsed.find((row: Record<string, unknown>) => row.Label === 'HUB')).toMatchObject({
            Degree: 2, Visibility: 'visible',
        })
    })

    test('export follows the current sort', async ({ page }) => {
        await openDock(page)
        // Degree descending, so the first data row is one of the degree-3 nodes.
        const heading = page.locator('.pvt-table-th-label', { hasText: 'Degree' })
        await heading.click()
        await heading.click()

        const rows = (await exportText(page, 'CSV')).split('\r\n').slice(1)
        const degrees = rows.map((line) => Number(line.split(',')[1]))
        expect(degrees).toEqual([...degrees].sort((a, b) => b - a))
    })

    test('a column hidden in the picker is left out of the export', async ({ page }) => {
        await openDock(page)

        await page.locator('.pvt-table-columns-button').click()
        await page.locator('.pvt-table-columns-row', { hasText: 'Degree' }).locator('input').uncheck()

        const csv = await exportText(page, 'CSV')
        expect(csv.split('\r\n')[0]).toBe('Visibility,Label')
    })

    test('a row filter narrows the export too', async ({ page }) => {
        await openDock(page, {
            UI: {
                mode: 'full',
                sidebar: { collapsed: false },
                table: { open: true, columns: [{ key: 'label', label: 'Label', type: 'text', filterable: true }] },
            },
        })

        await page.locator('.pvt-table-filter').first().fill('HUB')
        await expect(page.locator('.pvt-table-row')).toHaveCount(1)

        const lines = (await exportText(page, 'CSV')).split('\r\n')
        expect(lines).toEqual(['Label', 'HUB'])
    })

    test('export: false leaves the buttons out', async ({ page }) => {
        await openDock(page, {
            UI: { mode: 'full', sidebar: { collapsed: false }, table: { open: true, export: false } },
        })
        await expect(page.locator('.pvt-table-export')).toHaveCount(0)
    })
})

test.describe('table edges tab', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    test('switching to Edges lists the edges, source to target', async ({ page }) => {
        await openDock(page)
        await page.locator('.pvt-table-tab[data-tab="edges"]').click()
        await page.locator('.pvt-table-row').first().waitFor()

        const headings = await page.locator('.pvt-table-th-label').evaluateAll((cells) =>
            cells.map((cell) => (cell.textContent ?? '').trim()))
        expect(headings.slice(0, 3)).toEqual(['Source', 'Label', 'Target'])

        // The basic fixture has seven edges.
        await expect(page.locator('.pvt-table-row')).toHaveCount(7)
        const csv = await exportText(page, 'CSV')
        expect(csv).toContain('A,links,B')
    })

    // Each tab keeps its own view state, so a detour through Edges must not have
    // rearranged the node table behind your back.
    test('each tab keeps its own sort', async ({ page }) => {
        await openDock(page)
        const degreeHeading = page.locator('.pvt-table-th-label', { hasText: 'Degree' })
        await degreeHeading.click()
        await degreeHeading.click()
        const nodeOrderBefore = await page.locator('.pvt-table-row').evaluateAll((rows) =>
            rows.map((row) => (row as HTMLElement).dataset.id!))

        await page.locator('.pvt-table-tab[data-tab="edges"]').click()
        await page.locator('.pvt-table-row').first().waitFor()
        await page.locator('.pvt-table-tab[data-tab="nodes"]').click()
        await page.locator('.pvt-table-row').first().waitFor()

        const nodeOrderAfter = await page.locator('.pvt-table-row').evaluateAll((rows) =>
            rows.map((row) => (row as HTMLElement).dataset.id!))
        expect(nodeOrderAfter).toEqual(nodeOrderBefore)
    })

    test('a single declared tab renders no strip', async ({ page }) => {
        await openDock(page, {
            UI: { mode: 'full', sidebar: { collapsed: false }, table: { open: true, tabs: ['nodes'] } },
        })
        await expect(page.locator('.pvt-table-tab')).toHaveCount(0)
    })
})
