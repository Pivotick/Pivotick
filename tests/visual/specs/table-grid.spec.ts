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

/** One column's filter control, by its key and the role it plays (`text`/`value`/`min`/`max`). */
const filterIn = (page: Page, column: string, role: string) =>
    page.locator(`.pvt-table-th[data-column="${column}"] .pvt-table-filter[data-role="${role}"]`)

/** Column headings that carry a filter control of any kind. */
const filterableHeadings = (page: Page) =>
    page.locator('.pvt-table-th:has(.pvt-table-filter) .pvt-table-th-label').evaluateAll((cells) =>
        cells.map((cell) => (cell.textContent ?? '').trim()))

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

    test('opens with the status gutter and the name, and closes with the counts', async ({ page }) => {
        await openDock(page)

        const columns = await headings(page)
        // What you scan down to find a row leads; the data follows.
        expect(columns.slice(0, 2)).toEqual(['Visibility', 'Label'])
        // The counts are the graph's arithmetic, not the element's data, so they close
        // the row rather than pushing the data right. (`basic` has no clusters, so
        // `Children` isn't among them — see the cluster tests.)
        expect(columns.at(-1)).toBe('Degree')
        // `label` is the built-in Label column's source, so it is not repeated.
        expect(columns.filter((name) => name === 'Label')).toHaveLength(1)
    })

    // A column of single digits used to take the same `minmax(120px, 1fr)` share as the
    // name beside it, and its Min/Max pair stretched to fill that.
    test('a count column is narrow, and its bounds fit inside it', async ({ page }) => {
        await openDock(page)

        const cell = (key: string) => page.locator(`.pvt-table-th[data-column="${key}"]`)
        const width = (key: string) => cell(key).evaluate((el) => el.getBoundingClientRect().width)

        expect(await width('pvt:degree')).toBeLessThan(await width('pvt:label'))

        // And the controls stay inside the column they were compacted into: the library
        // sets no global `box-sizing`, so a `width: 100%` input overflows without one.
        const overflows = await cell('pvt:degree').evaluate((th) => {
            const bounds = th.getBoundingClientRect()
            return [...th.querySelectorAll('.pvt-table-filter')]
                .some((input) => input.getBoundingClientRect().right > bounds.right + 0.5)
        })
        expect(overflows).toBe(false)
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

    // Visibility leads the table as a status gutter, so each state has to be
    // distinguishable at a glance — and by more than hue alone.
    test('each visibility state gets its own chip styling', async ({ page }) => {
        await openDock(page)
        await harness(page, 'excludeNode', 'a')
        await expect.poll(() => visibilityById(page).then((byId) => byId.a)).toBe('excluded')

        const chip = (id: string) => page.locator(`.pvt-table-row[data-id="${id}"] .pvt-table-visibility`)
        await expect(chip('a')).toBeVisible()
        await expect(chip('c')).toBeVisible()

        const styles = await page.evaluate(() => {
            const read = (id: string) => {
                const el = document.querySelector(`.pvt-table-row[data-id="${id}"] .pvt-table-visibility`)!
                const s = getComputedStyle(el)
                return { color: s.color, background: s.backgroundColor, weight: s.fontWeight }
            }
            return { excluded: read('a'), visible: read('c') }
        })

        // Distinct colour *and* a distinct weight, so hue is not the only cue.
        expect(styles.excluded.color).not.toBe(styles.visible.color)
        expect(styles.excluded.weight).not.toBe(styles.visible.weight)
        // The hidden state is tinted; the ordinary one stays quiet.
        expect(styles.excluded.background).not.toBe(styles.visible.background)
    })

    // The chip is keyed on the column, not on the value — this is what stops a data
    // column that happens to say "visible" being dressed up as a status.
    test('a data column holding the word "visible" is not styled as a state', async ({ page }) => {
        await loadFixture(page, 'basic', {
            UI: {
                mode: 'full',
                sidebar: { collapsed: false },
                table: { open: true, columns: [{ key: 'label', label: 'State', type: 'text' }] },
            },
        })
        await page.locator('.pvt-table-row').first().waitFor()

        await expect(page.locator('.pvt-table-visibility')).toHaveCount(0)
        await expect(page.locator('.pvt-table-td[data-visibility]')).toHaveCount(0)
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

    // A table nobody configured is the one most likely to need narrowing before it can be
    // read, and its types are already inferred — so the derived set infers the controls
    // too. Asserted by narrowing for real, not by counting boxes.
    test('every derived column comes with a working filter', async ({ page }) => {
        await openDock(page)

        // Every one of them, including the graph-aware columns at the left edge.
        expect(await filterableHeadings(page)).toEqual(await headings(page))

        // `Degree` was derived as a numberRange, so its control is a pair of bounds —
        // which is the thing a substring box cannot express: only `a` and `c` have 3
        // edges, but "contains 3" would match nothing at all.
        await filterIn(page, 'pvt:degree', 'min').fill('3')
        expect((await rowIds(page)).sort()).toEqual(['a', 'c'])
        expect(await summary(page)).toBe('2 of 6 nodes')

        // And `Visibility` came out a select, which is the control only the derived set
        // offers: nothing else in the UI lists just what a filter took away.
        await expect(filterIn(page, 'pvt:visibility', 'value')).toHaveCount(1)
    })

    // The other half of the rule: a column set written out by hand is a statement, so it
    // gets the filters it asked for and no others.
    test('a declared column set gets no filter it did not ask for', async ({ page }) => {
        await loadFixture(page, 'basic', {
            UI: {
                mode: 'full',
                sidebar: { collapsed: false },
                table: {
                    open: true,
                    columns: [
                        { key: 'label', label: 'Label', type: 'text' },
                        { key: 'pvt:visibility', label: 'Visibility', type: 'select', filterable: true },
                    ],
                },
            },
        })
        await page.locator('.pvt-table-row').first().waitFor()

        expect(await headings(page)).toEqual(['Label', 'Visibility'])
        expect(await filterableHeadings(page)).toEqual(['Visibility'])
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

    // ── Clusters ─────────────────────────────────────────────────────────────
    // A cluster gets one row. Its children are not rows of this graph — they live in the
    // cluster's own subgraph — so `Children` is what tells you how big it is. Nothing else
    // in the UI does.

    test('a cluster is one row, with a count of what it holds', async ({ page }) => {
        await loadFixture(page, 'clustered', FULL)
        await page.locator('.pvt-table-row').first().waitFor()

        expect(await rowIds(page)).toEqual(['ext1', 'ext2', 'group'])
        // Direct children (c1, c2, c3) — c1's own two leaves are c1's business, and would
        // be its row's count if a subgraph were being listed.
        expect(await columnCells(page, 'Children')).toEqual(['0', '0', '3'])
    })

    // A column of zeros is not information, so it only appears where it can say something.
    test('Children stays out of a graph with no clusters', async ({ page }) => {
        await openDock(page)
        expect(await headings(page)).not.toContain('Children')
    })

    // ── Typed filter controls ────────────────────────────────────────────────
    // The control is chosen from the column's facet `type`, so the header offers what
    // the column can actually be asked. Every one of them still narrows rows only.

    /** The `filterable` fixture, with one column per control kind. */
    const TYPED_COLUMNS = {
        UI: {
            mode: 'full',
            sidebar: { collapsed: false },
            table: {
                open: true,
                columns: [
                    { key: 'label', label: 'Label', type: 'text', filterable: true },
                    { key: 'type', label: 'Type', type: 'select', filterable: true },
                    { key: 'ports', label: 'Ports', type: 'numberRange', filterable: true },
                ],
            },
        },
    }

    // A range is the thing a text box cannot express: `ports` holds 4.5 / 24.5 / 48.5,
    // and "contains 4" matches all three of them.
    test('a numeric column filters on bounds, not on substrings', async ({ page }) => {
        await loadFixture(page, 'filterable', TYPED_COLUMNS)
        await page.locator('.pvt-table-row').first().waitFor()
        expect(await rowIds(page)).toHaveLength(8)

        await filterIn(page, 'ports', 'min').fill('20')
        await filterIn(page, 'ports', 'max').fill('30')

        // The two switches (24.5) — not the routers above the range, nor the hosts below.
        expect(await rowIds(page)).toEqual(['sw1', 'sw2'])
        expect(await summary(page)).toBe('2 of 8 nodes')
    })

    // One end left empty is still a filter — "at least 20 ports" is the common ask.
    test('a numeric column takes a half-open range', async ({ page }) => {
        await loadFixture(page, 'filterable', TYPED_COLUMNS)
        await page.locator('.pvt-table-row').first().waitFor()

        await filterIn(page, 'ports', 'min').fill('20')

        expect(await rowIds(page)).toEqual(['r1', 'r2', 'r3', 'sw1', 'sw2'])
    })

    // A categorical column offers the values it actually holds, so you pick rather than
    // guess at the spelling.
    test('a categorical column offers the values present', async ({ page }) => {
        await loadFixture(page, 'filterable', TYPED_COLUMNS)
        await page.locator('.pvt-table-row').first().waitFor()

        const choice = filterIn(page, 'type', 'value')
        const options = await choice.locator('option').evaluateAll(
            (all) => all.map((option) => (option as HTMLOptionElement).textContent))
        expect(options).toEqual(['All', 'host', 'router', 'switch'])

        await choice.selectOption('switch')
        expect(await rowIds(page)).toEqual(['sw1', 'sw2'])

        // And back to everything, without having to clear a text box.
        await choice.selectOption('')
        expect(await rowIds(page)).toHaveLength(8)
    })

    // Narrowing rebuilds the rows and nothing else. It used to rebuild the header too,
    // which pulled the focus out from under whoever was typing into it.
    test('typing in a filter keeps the focus and the caret', async ({ page }) => {
        await loadFixture(page, 'filterable', TYPED_COLUMNS)
        await page.locator('.pvt-table-row').first().waitFor()

        const box = filterIn(page, 'label', 'text')
        await box.click()
        await page.keyboard.type('sw')
        await expect(page.locator('.pvt-table-row')).toHaveCount(2)

        await expect(box).toBeFocused()
        // The caret sat at the end, so typing on continues the word rather than splitting it.
        await page.keyboard.type('1')
        expect(await box.inputValue()).toBe('sw1')
        expect(await rowIds(page)).toEqual(['sw1'])
    })

    // The picker opens *upwards* in viewport coordinates: the dock sits at the bottom of
    // the layout and clips its overflow, so a downwards popover lands off-screen. Assert
    // it is genuinely on screen — `toBeVisible()` alone does not catch that, which is
    // exactly how this shipped broken once.
    test('the column picker opens where it can be seen', async ({ page }) => {
        await openDock(page)
        await page.locator('.pvt-table-columns-button').click()

        const picker = page.locator('.pvt-table-columns-picker')
        await expect(picker).toBeVisible()
        await expect(picker).toBeInViewport()

        // …and inside the graph's own container, not spilling past it.
        const boxes = await page.evaluate(() => {
            const rect = (selector: string) => {
                const r = document.querySelector(selector)!.getBoundingClientRect()
                return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }
            }
            return { picker: rect('.pvt-table-columns-picker'), container: rect('.pivotick') }
        })
        expect(boxes.picker.bottom).toBeLessThanOrEqual(boxes.container.bottom + 1)
        expect(boxes.picker.top).toBeGreaterThanOrEqual(boxes.container.top - 1)
        expect(boxes.picker.right).toBeLessThanOrEqual(boxes.container.right + 1)
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

    test('the picker closes on an outside click and on Escape', async ({ page }) => {
        await openDock(page)
        const picker = page.locator('.pvt-table-columns-picker')

        await page.locator('.pvt-table-columns-button').click()
        await expect(picker).toBeVisible()
        await page.locator('.pvt-table-summary').click()
        await expect(picker).toHaveCount(0)

        await page.locator('.pvt-table-columns-button').click()
        await expect(picker).toBeVisible()
        await page.keyboard.press('Escape')
        await expect(picker).toHaveCount(0)
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
        // `mispLike` has a cluster, so Children joins Degree in the trailing counts — the
        // facets still supply every *data* column, which is what this is about.
        expect(columns).toEqual(['Visibility', 'Label', 'Category', 'To IDs', 'Degree', 'Children'])
    })

    test('a new node appears without reopening the dock', async ({ page }) => {
        await openDock(page)
        expect(await rowIds(page)).toHaveLength(6)

        await harness(page, 'addNode', 'zz', 200, 200, 'ZZ')
        await expect(page.locator('.pvt-table-row')).toHaveCount(7)

        expect(await rowIds(page)).toContain('zz')
    })
})

/* ---------- the edges tab ---------- */

// An edge leaves the canvas for reasons of its own — its layer switched off — and for
// reasons that are not about it at all: an end of it left. The column has to tell those
// apart, and it has to keep up when nothing announces the change.
test.describe('table grid — edge visibility', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    const showEdges = async (page: Page) => {
        await page.locator('.pvt-dock-view[data-tab="edges"]').click()
        await page.locator('.pvt-table-row').first().waitFor()
    }

    test('an edge whose layer is off reads filtered', async ({ page }) => {
        await harness(page, 'loadWithEdgeLayers', 'edgeLayers', {}, FULL)
        await page.locator('.pvt-table-grid').waitFor()
        await showEdges(page)

        expect((await visibilityById(page))['hub-e']).toBe('visible')

        // `tag` covers hub-e and d-e; switching it off is the edge's own reason.
        await harness(page, 'setEdgeFilter', 'kind', { value: ['object-reference', 'correlation', 'analyst-relationship'] })
        await expect.poll(() => visibilityById(page).then((byId) => byId['hub-e'])).toBe('filtered')

        const byId = await visibilityById(page)
        expect(byId['d-e']).toBe('filtered')
        expect(byId['hub-a']).toBe('visible')
    })

    test('an edge whose node was excluded reads endpoint', async ({ page }) => {
        await openDock(page)
        await showEdges(page)

        await harness(page, 'excludeNode', 'a')

        // a-b, e-a and hub-a all touch `a` — nothing was done to the edges themselves.
        await expect.poll(() => visibilityById(page).then((byId) => byId['a-b'])).toBe('endpoint')

        const byId = await visibilityById(page)
        expect(byId['hub-a']).toBe('endpoint')
        expect(byId['b-c']).toBe('visible')
    })

    // The state nothing announces: opening a cluster shows the real edges into its
    // children and hides the stand-in, with no filter and no data change. The dock polls
    // a slow simulation tick for exactly this.
    test('opening a cluster updates the column with no filter event', async ({ page }) => {
        await openDock(page, 'clustered')
        await showEdges(page)

        // Collapsed: the real edge into the child is hidden, so its end is off the canvas.
        expect((await visibilityById(page))['ext1-c2']).toBe('endpoint')

        await harness(page, 'expand', 'group')

        await expect.poll(() => visibilityById(page).then((byId) => byId['ext1-c2'])).toBe('visible')
    })
})
