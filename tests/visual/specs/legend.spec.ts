import { test, expect, gotoHarness, loadFixture, harness, expectCanvas, canvas } from '../helpers'
import type { Page, Locator } from '@playwright/test'
import type { LegendRow, LegendSpec } from '../harness/harness'

/**
 * The canvas legend (prd/filterable-legend.md).
 *
 * The legend is **descriptive**: the fixture is coloured by a palette mapper the
 * way an integrator would colour it, and the legend only reports those colours
 * back — every swatch here is asserted against `renderer.getNodeStyle(node).color`,
 * i.e. against what is actually painted.
 *
 * Clicking an entry filters through the query engine, so "which node ids are still
 * visible" is the observable outcome of a toggle, and `activeFilterKeys()` proves
 * the legend leaves no phantom filter behind once everything is shown again. A few
 * screenshots cover the look (default, one category off, collapsed, plain key).
 */

/** The legend's rows, in display order. */
async function rows(page: Page): Promise<LegendRow[]> {
    return (await harness(page, 'legendRows')) as LegendRow[]
}

async function rowIds(page: Page): Promise<string[]> {
    return (await rows(page)).map((row) => row.id)
}

async function hiddenRowIds(page: Page): Promise<string[]> {
    return (await rows(page)).filter((row) => row.hidden).map((row) => row.id).sort()
}

/** Ids still on the canvas — a filtered-out node is removed from the render. */
async function visibleIds(page: Page): Promise<string[]> {
    return ((await harness(page, 'visibleNodeIds')) as string[]).slice().sort()
}

async function expectVisible(page: Page, ids: string[]): Promise<void> {
    expect(await visibleIds(page)).toEqual(ids.slice().sort())
}

async function activeFilterKeys(page: Page): Promise<string[]> {
    return (await harness(page, 'activeFilterKeys')) as string[]
}

function legendRow(page: Page, id: string): Locator {
    return page.locator(`.pvt-legend-entry[data-id="${id}"]`)
}

function legendAction(page: Page, action: string): Locator {
    return page.locator(`.pvt-legend-action[data-action="${action}"]`)
}

/**
 * Load a legend fixture and wait until its entries have been resolved — the first
 * resolution is deferred a frame (the renderer it samples is built after the UI).
 */
async function loadLegend(page: Page, spec: LegendSpec = {}, expectedEntries = 4): Promise<void> {
    await harness(page, 'loadWithLegend', 'mispLike', spec)
    await expect(page.locator('.pvt-legend-entry')).toHaveCount(expectedEntries)
}

test.describe('canvas legend', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    test('lists the graph categories with the colours actually painted', async ({ page }) => {
        await loadLegend(page)

        // One entry per distinct `attr-type` among the top-level nodes, labelled with
        // the raw value and counted across the graph.
        expect(await rows(page)).toEqual([
            { id: 'ip-src', label: 'ip-src', count: '1', color: await nodeColor(page, 'a1'), hidden: false, disabled: false },
            { id: 'domain', label: 'domain', count: '1', color: await nodeColor(page, 'a2'), hidden: false, disabled: false },
            { id: 'md5', label: 'md5', count: '1', color: await nodeColor(page, 'a3'), hidden: false, disabled: false },
            { id: 'object', label: 'object', count: '1', color: await nodeColor(page, 'obj'), hidden: false, disabled: false },
        ])
        // The title defaults to the prettified key.
        expect(await harness(page, 'legendTitle')).toBe('Attr Type')
        await expectCanvas(page, 'legend-derived.png')
    })

    test('clicking an entry hides that category, and only that', async ({ page }) => {
        await loadLegend(page)
        await expectVisible(page, ['a1', 'a2', 'a3', 'obj'])

        await legendRow(page, 'md5').click()

        await expectVisible(page, ['a1', 'a2', 'obj'])
        expect(await hiddenRowIds(page)).toEqual(['md5'])
        // The count is over the whole graph, so it doesn't flicker as you toggle.
        expect((await rows(page)).map((row) => row.count)).toEqual(['1', '1', '1', '1'])
        expect(await activeFilterKeys(page)).toEqual(['__legend'])
        expect(await harness(page, 'legendEvents')).toEqual([
            { hidden: ['md5'], visible: ['ip-src', 'domain', 'object'] },
        ])
        await expectCanvas(page, 'legend-one-hidden.png')
    })

    test('re-clicking restores the category and leaves no filter behind', async ({ page }) => {
        await loadLegend(page)

        await legendRow(page, 'md5').click()
        await legendRow(page, 'md5').click()

        await expectVisible(page, ['a1', 'a2', 'a3', 'obj'])
        expect(await hiddenRowIds(page)).toEqual([])
        expect(await activeFilterKeys(page)).toEqual([])
    })

    test('alt-click solos a category; invert and show-all get back', async ({ page }) => {
        await loadLegend(page)

        await legendRow(page, 'md5').click({ modifiers: ['Alt'] })
        await expectVisible(page, ['a3'])
        expect(await hiddenRowIds(page)).toEqual(['domain', 'ip-src', 'object'])

        await legendAction(page, 'invert').click()
        await expectVisible(page, ['a1', 'a2', 'obj'])
        expect(await hiddenRowIds(page)).toEqual(['md5'])

        await legendAction(page, 'show-all').click()
        await expectVisible(page, ['a1', 'a2', 'a3', 'obj'])
        expect(await activeFilterKeys(page)).toEqual([])
        // Nothing left to show ⇒ the action goes quiet.
        await expect(legendAction(page, 'show-all')).toBeDisabled()
    })

    test('a node added later in a hidden category arrives hidden', async ({ page }) => {
        await loadLegend(page)
        await legendRow(page, 'md5').click()

        await harness(page, 'addNode', 'a4', 200, 40, 'A4', { 'attr-type': 'md5' })

        // The predicate lives in the query engine's facet registry, so it applies to
        // nodes that didn't exist when the toggle happened.
        await expectVisible(page, ['a1', 'a2', 'obj'])
        // …and the legend catches up: md5 now counts two nodes, still hidden.
        await expect
            .poll(async () => (await rows(page)).find((row) => row.id === 'md5')?.count)
            .toBe('2')
        expect(await hiddenRowIds(page)).toEqual(['md5'])
    })

    test('resetFilters re-lights every entry', async ({ page }) => {
        await loadLegend(page)
        await legendRow(page, 'md5').click()
        await legendRow(page, 'domain').click()
        expect(await hiddenRowIds(page)).toEqual(['domain', 'md5'])

        await harness(page, 'resetFilters')

        expect(await hiddenRowIds(page)).toEqual([])
        await expectVisible(page, ['a1', 'a2', 'a3', 'obj'])
    })

    test('hiding every entry leaves only the nodes no entry covers', async ({ page }) => {
        // `object_relation` is set on one node, null on another and undefined on the
        // third: one entry, two nodes the legend can never hide.
        await harness(page, 'loadWithLegend', 'nullableFields', { key: 'object_relation' })
        await expect(page.locator('.pvt-legend-entry')).toHaveCount(1)
        expect(await rowIds(page)).toEqual(['rel'])

        await legendRow(page, 'rel').click()

        await expectVisible(page, ['a', 'c'])
        expect(await harness(page, 'warnings')).toEqual(
            expect.arrayContaining([expect.stringContaining('2 node(s) have no \'object_relation\'')])
        )
    })

    test('a category painted two colours keeps the first, and says so', async ({ page }) => {
        // a1 and a4 are both `ip-src`, but a4 is painted off-palette.
        await harness(page, 'loadWithLegend', 'mispLike', { conflictNodeId: 'a4' })
        await expect(page.locator('.pvt-legend-entry')).toHaveCount(4)
        await harness(page, 'addNode', 'a4', 200, 40, 'A4', { 'attr-type': 'ip-src' })
        await expect
            .poll(async () => (await rows(page)).find((row) => row.id === 'ip-src')?.count)
            .toBe('2')

        const ipRow = (await rows(page)).find((row) => row.id === 'ip-src')
        expect(ipRow?.color).toBe(await nodeColor(page, 'a1'))
        expect(await harness(page, 'warnings')).toEqual(
            expect.arrayContaining([expect.stringContaining('renders more than one colour')])
        )
    })

    test('declared entries win over derivation, as an array and as a function', async ({ page }) => {
        await loadLegend(page, { mode: 'declared-array' })

        // Declared labels and colours are used verbatim — nothing sampled.
        expect((await rows(page)).map((row) => [row.id, row.label, row.color])).toEqual([
            ['ip-src', 'IP-SRC', '#7EA2FB'],
            ['domain', 'DOMAIN', '#85CB33'],
            ['md5', 'MD5', '#FFB74D'],
            ['object', 'OBJECT', '#BA68C8'],
        ])
        await legendRow(page, 'md5').click()
        await expectVisible(page, ['a1', 'a2', 'obj'])
    })

    test('an entries function re-resolves on data change and keeps the toggle state', async ({ page }) => {
        // Five, not four: the function scans every node, so the cluster's children
        // contribute `filename` as well.
        await loadLegend(page, { mode: 'declared-function' }, 5)
        await legendRow(page, 'md5').click()

        await harness(page, 'addNode', 'a4', 200, 40, 'A4', { 'attr-type': 'sha256' })

        // The new category shows up because the function is re-run against the graph…
        await expect.poll(async () => (await rowIds(page)).includes('sha256')).toBe(true)
        // …and md5 is still switched off.
        expect(await hiddenRowIds(page)).toEqual(['md5'])
        await expectVisible(page, ['a1', 'a2', 'a4', 'obj'])
    })

    test('declared entries with nothing to match on warn instead of hiding the graph', async ({ page }) => {
        await loadLegend(page, { mode: 'declared-array', omitKey: true })

        await legendRow(page, 'md5').click()

        // The entry matches no node, so hiding it hides nothing.
        await expectVisible(page, ['a1', 'a2', 'a3', 'obj'])
        expect(await harness(page, 'warnings')).toEqual(
            expect.arrayContaining([expect.stringContaining('has no predicate')])
        )
    })

    test('a legend keyed on a declared facet drives that facet, not a second filter', async ({ page }) => {
        // `category` is declared as a multiselect facet, so the legend adopts it.
        await loadLegend(page, { key: 'category', withFacets: true }, 2)
        expect(await rowIds(page)).toEqual(['Network activity', 'Payload delivery'])

        await legendRow(page, 'Payload delivery').click()

        // One filter, under the declared key — no reserved key alongside it.
        expect(await activeFilterKeys(page)).toEqual(['category'])
        await expectVisible(page, ['a1', 'a2'])

        // The panel is the same filter seen from the other side (its form syncs on
        // `filterChange`, and its pickers are built a frame later).
        await harness(page, 'openFilterPanel')
        await expect(page.locator('.pvt-slide-panel.open')).toBeVisible()
        await expect
            .poll(async () => (await harness(page, 'panelValues')) as Record<string, unknown>)
            .toMatchObject({ category: ['Network activity'] })

        // …and a filter set from outside re-lights the legend.
        await harness(page, 'setFilter', 'category', { value: ['Payload delivery'], matchMode: 'exact' })
        expect(await hiddenRowIds(page)).toEqual(['Network activity'])
        await expectVisible(page, ['a3', 'obj'])
    })

    test('an adopted facet cannot be emptied, and says why', async ({ page }) => {
        await loadLegend(page, { key: 'category', withFacets: true }, 2)

        await legendRow(page, 'Payload delivery').click()

        // An empty value list means "no constraint" to the panel, so the legend
        // refuses to reach that state rather than showing the whole graph back.
        await expect(legendRow(page, 'Network activity')).toBeDisabled()
        await expect(legendAction(page, 'invert')).toBeEnabled()
        await expect(legendRow(page, 'Network activity')).toHaveAttribute('title', /last shown category/)
        await expectVisible(page, ['a1', 'a2'])
    })

    test('setLegend adds a legend to a graph that had none, and removes it again', async ({ page }) => {
        await loadFixture(page, 'mispLike')
        await expect(page.locator('.pvt-legend-entry')).toHaveCount(0)

        await harness(page, 'setLegend', { key: 'attr-type' })
        await expect(page.locator('.pvt-legend-entry')).toHaveCount(4)

        await legendRow(page, 'md5').click()
        await expectVisible(page, ['a1', 'a2', 'obj'])

        // A key no node carries has nothing to list, so it shows nothing at all
        // rather than an empty box with a title.
        await harness(page, 'setLegend', { key: 'not-a-field' })
        await expect(page.locator('.pvt-legend-panel')).toBeEmpty()

        await harness(page, 'setLegend', { key: 'attr-type' })
        await legendRow(page, 'md5').click()
        await harness(page, 'setLegend', false)
        await expect(page.locator('.pvt-legend-entry')).toHaveCount(0)
        // Removing the legend must not leave its filter hiding nodes.
        expect(await activeFilterKeys(page)).toEqual([])
        await expectVisible(page, ['a1', 'a2', 'a3', 'obj'])
    })

    test('filterable: false renders a plain key', async ({ page }) => {
        await loadLegend(page, { filterable: false, title: 'Attribute type' })

        expect(await harness(page, 'legendTitle')).toBe('Attribute type')
        await expect(legendAction(page, 'show-all')).toHaveCount(0)
        await expect(legendAction(page, 'invert')).toHaveCount(0)
        await expect(legendRow(page, 'md5')).not.toHaveAttribute('aria-pressed')

        await legendRow(page, 'md5').click()
        await expectVisible(page, ['a1', 'a2', 'a3', 'obj'])
        await expectCanvas(page, 'legend-plain-key.png')
    })

    test('the legend collapses to its header', async ({ page }) => {
        await loadLegend(page)

        await legendAction(page, 'collapse').click()

        await expect(page.locator('.pvt-legend-panel')).toHaveClass(/pvt-legend-collapsed/)
        await expect(page.locator('.pvt-legend-list')).toBeHidden()
        await expectCanvas(page, 'legend-collapsed.png')

        await legendAction(page, 'collapse').click()
        await expect(page.locator('.pvt-legend-list')).toBeVisible()
    })

    test('a long category list scrolls inside the legend', async ({ page }) => {
        await loadLegend(page)
        for (let index = 0; index < 30; index++) {
            await harness(page, 'addNode', `x${index}`, -400 + index * 12, 200, `X${index}`, {
                'attr-type': `type-${String(index).padStart(2, '0')}`,
            })
        }
        await expect.poll(async () => (await rows(page)).length).toBe(34)

        // The list scrolls itself, stays inside the canvas, and the page doesn't
        // grow a scrollbar because a category list got long.
        const overflow = await page.evaluate(() => {
            const list = document.querySelector('.pvt-legend-list') as HTMLElement
            const canvasEl = document.querySelector('.pvt-canvas') as HTMLElement
            const root = document.documentElement
            return {
                listScrolls: list.scrollHeight > list.clientHeight,
                legendFitsCanvas: list.getBoundingClientRect().height < canvasEl.clientHeight,
                pageScrolls: root.scrollWidth > root.clientWidth || root.scrollHeight > root.clientHeight,
            }
        })
        expect(overflow).toEqual({ listScrolls: true, legendFitsCanvas: true, pageScrolls: false })
        await expectCanvas(page, 'legend-long-list.png')
    })

    test('the legend docks in the requested corner', async ({ page }) => {
        await loadLegend(page, { position: 'top-right' })

        const canvasBox = await canvas(page).boundingBox()
        const legendBox = await page.locator('.pvt-legend-panel').boundingBox()
        expect(canvasBox && legendBox).toBeTruthy()
        // Right half, top half — the opposite corner from the default.
        expect(legendBox!.x).toBeGreaterThan(canvasBox!.x + canvasBox!.width / 2)
        expect(legendBox!.y).toBeLessThan(canvasBox!.y + canvasBox!.height / 2)
    })

    test('full mode has the legend, viewer mode has none', async ({ page }) => {
        // The specs above run in `light` (the harness default); full mode is the other
        // half of the gate.
        await harness(page, 'loadWithLegend', 'mispLike', { key: 'attr-type' }, { UI: { mode: 'full' } })
        await expect(page.locator('.pvt-legend-entry')).toHaveCount(4)
        await legendRow(page, 'md5').click()
        await expectVisible(page, ['a1', 'a2', 'obj'])

        // The legend is chrome, and `viewer` / `static` have none — the layout doesn't
        // even build a slot for it.
        await harness(page, 'loadWithLegend', 'mispLike', { key: 'attr-type' }, { UI: { mode: 'viewer' } })
        await expect(page.locator('.pvt-legend-panel')).toHaveCount(0)
        await expectVisible(page, ['a1', 'a2', 'a3', 'obj'])
    })

    // The legend appears with no `UI.legend` at all — but only when the dimension the
    // consumer already declared (`render.nodeTypeAccessor`) demonstrably *is* the
    // colour dimension. These cover both halves of that check.
    test.describe('without any UI.legend', () => {
        test('derives one when the declared type accessor explains the colours', async ({ page }) => {
            await harness(page, 'loadAutoLegend', 'mispLike')

            await expect(page.locator('.pvt-legend-entry')).toHaveCount(4)
            expect(await rowIds(page)).toEqual(['ip-src', 'domain', 'md5', 'object'])
            // No key name to prettify, so the header names the dimension itself.
            expect(await harness(page, 'legendTitle')).toBe('Type')

            // A legend nobody asked for filters like any other.
            await legendRow(page, 'md5').click()
            await expectVisible(page, ['a1', 'a2', 'obj'])
            await expectCanvas(page, 'legend-automatic.png')
        })

        test('stays silent when nothing declares the colour dimension', async ({ page }) => {
            // The common shape: colours come from an opaque accessor and no
            // `nodeTypeAccessor` is declared, so the library has nothing to key on.
            await harness(page, 'loadAutoLegend', 'mispLike', { accessor: null })

            await expect(page.locator('.pvt-legend-panel')).toBeEmpty()
            expect(await harness(page, 'warnings')).toEqual([])
        })

        test('stays silent when the declared dimension does not explain the colours', async ({ page }) => {
            // One colour for the whole graph: `attr-type` partitions the data but says
            // nothing about what the canvas looks like, so a swatch per type would be
            // an invention.
            await harness(page, 'loadAutoLegend', 'mispLike', { constantColor: true })

            await expect(page.locator('.pvt-legend-panel')).toBeEmpty()
            // Nobody asked for a legend, so its absence is not worth a warning.
            expect(await harness(page, 'warnings')).toEqual([])
        })

        test('stays silent when the dimension has too many values to be categories', async ({ page }) => {
            await harness(page, 'loadAutoLegend', 'mispLike')
            await expect(page.locator('.pvt-legend-entry')).toHaveCount(4)

            // An id-like dimension passes "one colour per value" trivially; what rules
            // it out is having a value per node.
            for (let index = 0; index < 25; index++) {
                await harness(page, 'addNode', `x${index}`, -400 + index * 12, 200, `X${index}`, {
                    'attr-type': `type-${index}`,
                })
            }

            await expect.poll(async () => (await rows(page)).length).toBe(0)
        })

        test('`legend: false` suppresses it even when the colours would explain themselves', async ({ page }) => {
            await harness(page, 'loadAutoLegend', 'mispLike', { legend: false })

            await expect(page.locator('.pvt-legend-panel')).toHaveCount(0)
        })

        test('`legend: true` derives one even when the check is inconclusive', async ({ page }) => {
            await harness(page, 'loadAutoLegend', 'mispLike', { constantColor: true, legend: true })

            expect(await rowIds(page)).toEqual(['ip-src', 'domain', 'md5', 'object'])
            // Every swatch is the same colour — which is the truth about this graph.
            expect(new Set((await rows(page)).map((row) => row.color)).size).toBe(1)
        })

        test('`legend: true` with nothing to key on says so', async ({ page }) => {
            await harness(page, 'loadAutoLegend', 'mispLike', { accessor: null, legend: true })

            await expect(page.locator('.pvt-legend-panel')).toBeEmpty()
            expect(await harness(page, 'warnings')).toEqual(
                expect.arrayContaining([expect.stringContaining('has nothing to list')])
            )
        })

        test('an options block with no key or entries still derives', async ({ page }) => {
            // `UI.legend` is about presentation here — where it sits — so the entries
            // are still worked out automatically.
            await harness(page, 'loadAutoLegend', 'mispLike', {}, { UI: { legend: { position: 'top-right' } } })

            await expect(page.locator('.pvt-legend-entry')).toHaveCount(4)
            await expect(page.locator('.pvt-legend')).toHaveAttribute('data-position', 'top-right')
        })
    })

    test('the legend hides a category inside an expanded cluster too', async ({ page }) => {
        // A cluster's children live in their own subgraph with their own query engine;
        // the legend's reserved facet has to travel down with the filter.
        await loadLegend(page)
        await harness(page, 'expand', 'obj')

        await legendRow(page, 'md5').click()

        // c1 is an md5 attribute inside the cluster, c2 a filename.
        expect(await harness(page, 'subgraphVisibleNodeIds', 'obj')).toEqual(['c2'])
    })
})

/** The colour the renderer resolved for a node — what the swatch must equal. */
async function nodeColor(page: Page, id: string): Promise<string> {
    return (await harness(page, 'nodeColor', id)) as string
}
