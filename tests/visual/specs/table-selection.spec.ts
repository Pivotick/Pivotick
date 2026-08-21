import { test, expect, gotoHarness, loadFixture, harness } from '../helpers'

// ── Table ↔ graph selection ─────────────────────────────────────────────────
// The dock's real job: a better instrument for building the selection the
// sidebar's bulk actions already operate on. Which means both directions have to
// agree, and neither may loop.

type Page = import('@playwright/test').Page

const FULL = { UI: { mode: 'full', sidebar: { collapsed: false }, table: { open: true } } }

const openDock = async (page: Page) => {
    await loadFixture(page, 'basic', FULL)
    await page.locator('.pvt-table-row').first().waitFor()
}

const row = (page: Page, id: string) => page.locator(`.pvt-table-row[data-id="${id}"]`)

const markedRows = (page: Page) =>
    page.locator('.pvt-table-row-selected').evaluateAll((rows) =>
        rows.map((element) => (element as HTMLElement).dataset.id!).sort())

/**
 * Poll rather than sleep. Selection sync and the grid rebuild both land on a later
 * frame, and a fixed wait is exactly the kind of thing that passes locally and
 * flakes in a loaded parallel run.
 */
const expectMarked = (page: Page, ids: string[]) =>
    expect.poll(() => markedRows(page)).toEqual(ids)

const expectSelected = (page: Page, ids: string[]) =>
    expect.poll(() => selectedIds(page)).toEqual(ids)

const selectedIds = async (page: Page) =>
    ((await harness(page, 'selectedNodeIds')) as string[]).slice().sort()

test.describe('table selection', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
        await openDock(page)
    })

    test('clicking a row selects that node and marks the row', async ({ page }) => {
        await row(page, 'c').click()

        expect(await selectedIds(page)).toEqual(['c'])
        expect(await markedRows(page)).toEqual(['c'])
    })

    test('clicking another row replaces the selection', async ({ page }) => {
        await row(page, 'c').click()
        await row(page, 'd').click()

        expect(await selectedIds(page)).toEqual(['d'])
        expect(await markedRows(page)).toEqual(['d'])
    })

    test('Ctrl-click adds and removes one row', async ({ page }) => {
        await row(page, 'a').click()
        await row(page, 'c').click({ modifiers: ['ControlOrMeta'] })
        expect(await selectedIds(page)).toEqual(['a', 'c'])

        await row(page, 'a').click({ modifiers: ['ControlOrMeta'] })
        expect(await selectedIds(page)).toEqual(['c'])
        expect(await markedRows(page)).toEqual(['c'])
    })

    // The range runs over the rows as listed, which is what makes "sort by degree,
    // take the top twenty" work.
    test('Shift-click takes a range in the listed order', async ({ page }) => {
        const ids = await page.locator('.pvt-table-row').evaluateAll((rows) =>
            rows.map((element) => (element as HTMLElement).dataset.id!))

        await row(page, ids[1]).click()
        await row(page, ids[3]).click({ modifiers: ['Shift'] })

        expect(await selectedIds(page)).toEqual([ids[1], ids[2], ids[3]].sort())
    })

    // Shift-click is the browser's "extend the text selection to here" too, and it used
    // to drag a blue smear across every row the range covered. Plain clicks still put a
    // caret in the cell, so the values stay selectable.
    test('taking a range does not smear a text selection across the rows', async ({ page }) => {
        const selectedText = () => page.evaluate(() => (window.getSelection()?.toString() ?? '').trim())

        await row(page, 'a').click()
        await row(page, 'e').click({ modifiers: ['Shift'] })

        expect((await selectedIds(page)).length).toBeGreaterThan(1)
        expect(await selectedText()).toBe('')

        // Still ordinary text: dragging across a cell picks the value up, which is the
        // gesture that survives here — double-click is spoken for, as "take me there".
        const cell = row(page, 'a').locator('.pvt-table-td').nth(1)
        const box = (await cell.boundingBox())!
        await page.mouse.move(box.x + 4, box.y + box.height / 2)
        await page.mouse.down()
        await page.mouse.move(box.x + box.width - 6, box.y + box.height / 2, { steps: 8 })
        await page.mouse.up()

        expect(await selectedText()).not.toBe('')
    })

    test('Select all takes every row currently listed', async ({ page }) => {
        await page.locator('.pvt-table-selectall').click()

        expect(await selectedIds(page)).toEqual(['a', 'b', 'c', 'd', 'e', 'hub'])
        expect(await markedRows(page)).toEqual(['a', 'b', 'c', 'd', 'e', 'hub'])
    })

    // Narrow first, then select — the selection follows what you can see, not the
    // whole graph.
    test('Select all respects a column filter', async ({ page }) => {
        await loadFixture(page, 'basic', {
            UI: {
                mode: 'full',
                sidebar: { collapsed: false },
                table: { open: true, columns: [{ key: 'label', label: 'Label', type: 'text', filterable: true }] },
            },
        })
        await page.locator('.pvt-table-row').first().waitFor()

        await page.locator('.pvt-table-filter').first().fill('HUB')
        await expect(page.locator('.pvt-table-row')).toHaveCount(1)
        await page.locator('.pvt-table-selectall').click()

        await expectSelected(page, ['hub'])
    })

    // Graph → table.
    test('selecting on the canvas marks the row', async ({ page }) => {
        await harness(page, 'selectNode', 'e')

        await expectMarked(page, ['e'])
    })

    test('a canvas multi-selection marks every matching row', async ({ page }) => {
        await harness(page, 'multiSelect', ['b', 'd'])

        await expectMarked(page, ['b', 'd'])
    })

    test('deselecting on the canvas clears the marks', async ({ page }) => {
        await harness(page, 'selectNode', 'e')
        await expectMarked(page, ['e'])

        await harness(page, 'deselectAll')
        await expectMarked(page, [])
    })

    // Marks survive a re-sort: the rows are rebuilt, the selection is not.
    test('the marks survive a re-sort', async ({ page }) => {
        await row(page, 'c').click()
        await page.locator('.pvt-table-th-label', { hasText: 'Degree' }).click()

        expect(await markedRows(page)).toEqual(['c'])
        expect(await selectedIds(page)).toEqual(['c'])
    })

    // A hidden node's row is a row like any other — that is the point of listing it.
    test('a filtered-out node can still be selected from its row', async ({ page }) => {
        await harness(page, 'setFilter', 'label', { value: 'HUB', matchMode: 'exact' })
        // Wait for the filter to have actually landed on the graph before clicking.
        await expect.poll(() => page.evaluate(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            () => (window.__pivotick as any).graph.getMutableVisibleNodes().length)).toBe(1)

        await row(page, 'a').click()

        await expectSelected(page, ['a'])
        await expectMarked(page, ['a'])
        // And the canvas is not dimmed for a selection it cannot show.
        expect(await page.locator('.pvt-node-selected-highlight-shadow').count()).toBe(0)
    })
})
