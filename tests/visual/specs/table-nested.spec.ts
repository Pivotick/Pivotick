import { readFileSync } from 'fs'
import { test, expect, expectElement, gotoHarness, loadFixture } from '../helpers'

// ── Nested nodes in the dock ─────────────────────────────────────────────────
// A cluster's contents get rows of their own, as peers of the graph's own nodes,
// with a `Cluster` column carrying the path. On by default; the header's
// **Nested nodes** switch takes them out, and `UI.table.nested: false` never
// offers them at all.
//
// Two facts drive every assertion here, and both come from the library rather
// than the table: a nested node **is** in `graph.nodes`, and it is **never drawn
// by this graph** — an expanded cluster renders a separate subgraph from
// `toDict()` data. So its `Visibility` has to be read off the clusters above it
// (`nested`), and "take me there" has to aim at a cluster, because focusing the
// node itself does nothing.

type Page = import('@playwright/test').Page

/* eslint-disable @typescript-eslint/no-explicit-any */

const FULL = { UI: { mode: 'full', sidebar: { collapsed: false }, table: { open: true } } }

/**
 * The graph's root nodes, in the order the grid lists them: the default sort is Label
 * ascending, and every fixture label is its id upper-cased.
 */
const TOP_LEVEL = ['gateway', 'store', 'team-a', 'team-b']

/** Every node the fixture holds, at all three depths — 13 in total. */
const EVERY_NODE = [
    'a1', 'a2', 'a3', 'a4',
    'b1', 'b2', 'gateway', 's1', 's2', 'squad', 'store', 'team-a', 'team-b',
]

const openDock = async (page: Page, overrides: Record<string, unknown> = FULL) => {
    await loadFixture(page, 'clusteredTable' as never, overrides)
    await page.locator('.pvt-table-grid').waitFor()
    await page.locator('.pvt-table-row').first().waitFor()
}

const rowIds = (page: Page) =>
    page.locator('.pvt-table-row').evaluateAll((rows) => rows.map((row) => (row as HTMLElement).dataset.id!))

const headings = (page: Page) =>
    page.locator('.pvt-table-th-label').evaluateAll((cells) =>
        cells.map((cell) => (cell.textContent ?? '').trim()))

/** One column's cells, top to bottom, by heading. */
const columnCells = async (page: Page, heading: string) => {
    const index = (await headings(page)).indexOf(heading)
    expect(index).toBeGreaterThanOrEqual(0)
    return page.locator('.pvt-table-row').evaluateAll(
        (rows, i) => rows.map((row) => row.children[i as number]?.textContent?.trim() ?? ''),
        index,
    )
}

/** One column, keyed by row id. */
const columnById = async (page: Page, heading: string) => {
    const ids = await rowIds(page)
    const cells = await columnCells(page, heading)
    return Object.fromEntries(ids.map((id, i) => [id, cells[i]]))
}

const nestedSwitch = (page: Page) => page.locator('.pvt-table-nested-toggle input')

const dockRegion = (page: Page) => page.locator('.pvt-dock')

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

test.describe('nested nodes are listed by default', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    test('every descendant is a row, with its path in a Cluster column', async ({ page }) => {
        await openDock(page)

        expect(await rowIds(page)).toEqual(EVERY_NODE)
        expect(await headings(page)).toContain('Cluster')

        const cluster = await columnById(page, 'Cluster')
        expect(cluster['a1']).toBe('TEAM-A')
        // Outermost first, so the path reads the way you would walk it.
        expect(cluster['s1']).toBe('TEAM-B / SQUAD')
        // A node of the root graph is in no cluster, and says so with a blank.
        expect(cluster['gateway']).toBe('')
    })

    test('a sort reaches every row, nesting and all', async ({ page }) => {
        await openDock(page)
        await page.locator('.pvt-table-th[data-column="severity"] .pvt-table-th-label').click()
        await page.locator('.pvt-table-th[data-column="severity"] .pvt-table-th-label').click()

        // The whole point of listing them flat: the graph's highest severity comes to the
        // top wherever it lives, and it lives two levels down inside a cluster.
        expect((await rowIds(page))[0]).toBe('a4')
    })

    test('a column filter narrows across clusters', async ({ page }) => {
        await openDock(page)
        await page.locator('.pvt-table-th[data-column="role"] .pvt-table-filter[data-role="value"]')
            .selectOption('cache')

        // One from each cluster, and no cluster rows dragged along as scaffolding.
        expect(await rowIds(page)).toEqual(['a4', 'b1'])
    })

    test('the switch takes the nested rows back out, and Children still counts them', async ({ page }) => {
        await openDock(page)
        await nestedSwitch(page).uncheck()

        expect(await rowIds(page)).toEqual(TOP_LEVEL)
        expect(await columnById(page, 'Children')).toMatchObject({ 'team-a': '4', 'team-b': '3', 'gateway': '0' })

        await nestedSwitch(page).check()
        expect(await rowIds(page)).toEqual(EVERY_NODE)
    })

    test('looks right', async ({ page }) => {
        await openDock(page)
        await expectElement(dockRegion(page), 'nested-flat.png')
    })
})

test.describe('nested nodes turned off, and graphs that have none', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    test('`nested: false` lists no nested rows and offers no switch', async ({ page }) => {
        await openDock(page, { UI: { ...FULL.UI, table: { open: true, nested: false } } })

        expect(await rowIds(page)).toEqual(TOP_LEVEL)
        await expect(page.locator('.pvt-table-nested')).toHaveCount(0)
        // No rows to place, so no column to place them in.
        expect(await headings(page)).not.toContain('Cluster')
    })

    test('a graph with no clusters is untouched — no Cluster column, no switch', async ({ page }) => {
        await loadFixture(page, 'basic' as never, FULL)
        await page.locator('.pvt-table-row').first().waitFor()

        expect(await headings(page)).not.toContain('Cluster')
        expect(await headings(page)).not.toContain('Children')
        // Built but never revealed: nothing here for it to be about.
        await expect(page.locator('.pvt-table-nested')).toBeHidden()
    })

    test('the edges tab never offers the switch', async ({ page }) => {
        await openDock(page)
        await expect(nestedSwitch(page)).toBeVisible()

        await page.locator('.pvt-dock-view[data-tab="edges"]').click()
        await page.locator('.pvt-table-row').first().waitFor()

        await expect(page.locator('.pvt-table-nested')).toHaveCount(0)
    })
})

test.describe('what a nested row reports', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    test('Visibility reads nested, not filtered', async ({ page }) => {
        await openDock(page)

        const states = await columnById(page, 'Visibility')
        // The clusters and the loose nodes are on the canvas; their contents are not.
        expect(states['team-a']).toBe('visible')
        expect(states['gateway']).toBe('visible')
        expect(states['a1']).toBe('nested')
        expect(states['s1']).toBe('nested')
    })

    test('opening the cluster on the canvas moves the reading to visible', async ({ page }) => {
        await openDock(page)
        await page.evaluate(() => {
            const graph = (window.__pivotick as any).graph
            graph.toggleExpandNode(graph.getMutableNode('team-a'))
        })
        // The dock listens to `onVisibleChange`, which a cluster toggle passes through.
        await expect
            .poll(async () => (await columnById(page, 'Visibility'))['a1'])
            .toBe('visible')

        // `squad` is two levels down and still shut, so its leaves have not moved.
        expect((await columnById(page, 'Visibility'))['s1']).toBe('nested')
    })

    test('a nested row can be selected without the canvas dimming or throwing', async ({ page }) => {
        const errors: string[] = []
        page.on('pageerror', (error) => errors.push(error.message))
        await openDock(page)

        await page.locator('.pvt-table-row[data-id="a1"]').click()
        await expect(page.locator('.pvt-table-row[data-id="a1"]')).toHaveClass(/pvt-table-row-selected/)
        // The sidebar can still show it — the row is the only way to reach it.
        expect(await page.evaluate(() =>
            (window.__pivotick as any).graph.renderer.getGraphInteraction().getSelectedNodeIDs(),
        )).toEqual(['a1'])
        expect(errors).toEqual([])
    })

    test('double-click opens the cluster hiding it', async ({ page }) => {
        await openDock(page)

        expect(await page.evaluate(() =>
            (window.__pivotick as any).graph.getMutableNode('team-a').expanded)).toBe(false)
        await page.locator('.pvt-table-row[data-id="a1"]').dblclick()
        expect(await page.evaluate(() =>
            (window.__pivotick as any).graph.getMutableNode('team-a').expanded)).toBe(true)
    })

    test('a push that names a nested node reaches inside the open cluster', async ({ page }) => {
        await openDock(page)
        // Open `team-a` first: its contents are drawn by its own subgraph, which is where
        // a filter naming one of them has to land.
        await page.evaluate(() => {
            const graph = (window.__pivotick as any).graph
            graph.toggleExpandNode(graph.getMutableNode('team-a'))
        })
        await expect.poll(async () => (await columnById(page, 'Visibility'))['a1']).toBe('visible')

        // Keep only `api`, then push. a2 (worker) and a4 (cache) are named for hiding.
        await page.locator('.pvt-table-th[data-column="role"] .pvt-table-filter[data-role="value"]')
            .selectOption('api')
        await page.locator('.pvt-table-apply').click()

        const insideCluster = () => page.evaluate(() => {
            const graph = (window.__pivotick as any).graph
            const sub = graph.getMutableNode('team-a').getSubgraph()
            return sub.getMutableNodes().filter((n: any) => n.visible).map((n: any) => n.id).sort()
        })
        // The push travels into the subgraph, so the cluster's interior narrows with the
        // rest of the canvas rather than ignoring a filter the table says is active.
        await expect.poll(insideCluster).toEqual(['a1', 'a3'])
    })

    test('export carries the nested rows and their path', async ({ page }) => {
        await openDock(page)
        const csv = await exportText(page, 'CSV')

        // Header plus 13 rows — what the table is showing is what comes out.
        expect(csv.trim().split('\r\n')).toHaveLength(14)
        expect(csv).toContain('nested,S1,TEAM-B / SQUAD')
    })
})
