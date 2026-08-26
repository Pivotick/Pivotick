import { test, expect, gotoHarness, harness, expectCanvas, expectElement } from '../helpers'
import type { Page } from '@playwright/test'
import type { EdgeLayerRow, EdgeSwatchSnapshot, LegendRow, LegendSectionSnapshot } from '../harness/harness'

/**
 * Edge layers: relations that come in **kinds**, each styled apart, keyed in the
 * legend, and switchable off.
 *
 * Two properties carry most of these tests. First, a layer is a **lens**: switching
 * one off changes which lines are drawn and nothing else, so `simulationEdgeIds()` —
 * the set d3's link force holds — must come back identical, which is what stops the
 * graph drifting. Second, the legend is **descriptive**: every line swatch here is
 * asserted against `renderer.getEdgeStyle(edge)`, i.e. against what is really painted.
 *
 * Cross-cluster stand-ins get their own group. A stand-in is deduped by node *pair*,
 * so one line can speak for several relations of several kinds — it survives while any
 * of them does, and only then goes.
 */

/* ---------- readers ---------- */

/** Ids of the edges currently drawn. */
async function drawnEdges(page: Page): Promise<string[]> {
    return (await harness(page, 'visibleEdgeIds')) as string[]
}

/** Ids of the edges the link force holds — the layout question. */
async function forceEdges(page: Page): Promise<string[]> {
    return (await harness(page, 'simulationEdgeIds')) as string[]
}

async function visibleNodes(page: Page): Promise<string[]> {
    return ((await harness(page, 'visibleNodeIds')) as string[]).slice().sort()
}

async function layerRows(page: Page): Promise<EdgeLayerRow[]> {
    return (await harness(page, 'edgeLayerRows')) as EdgeLayerRow[]
}

async function layerValues(page: Page): Promise<string[]> {
    return (await layerRows(page)).map((row) => row.value)
}

async function switchedOffLayers(page: Page): Promise<string[]> {
    return (await layerRows(page)).filter((row) => row.hidden).map((row) => row.value).sort()
}

async function legendSections(page: Page): Promise<LegendSectionSnapshot[]> {
    return (await harness(page, 'legendSections')) as LegendSectionSnapshot[]
}

async function activeFilterKeys(page: Page): Promise<string[]> {
    return (await harness(page, 'activeFilterKeys')) as string[]
}

/** The style the renderer resolves for one edge — the truth a swatch is checked against. */
async function paintedStyle(page: Page, id: string): Promise<EdgeSwatchSnapshot | null> {
    return (await harness(page, 'edgeStyleOf', id)) as EdgeSwatchSnapshot | null
}

/**
 * A declared colour as a swatch reads back. Swatch colours are written through the
 * CSSOM — so the browser drops a bogus value from consumer data instead of taking it
 * verbatim — which also normalises `#888888` to `rgb(136, 136, 136)`.
 */
async function asDrawn(page: Page, color: string): Promise<string> {
    return (await harness(page, 'cssColor', color)) as string
}

/** What the `index`-th line swatch inside `selector` actually draws. */
async function swatch(page: Page, selector: string, index: number): Promise<EdgeSwatchSnapshot | null> {
    return (await harness(page, 'edgeSwatchOf', selector, index)) as EdgeSwatchSnapshot | null
}

/* ---------- assertions ---------- */

/**
 * Poll rather than read once: a layer toggle repaints on the next frame, and a
 * one-shot read passes locally and flakes in a loaded parallel run.
 */
async function expectDrawnEdges(page: Page, ids: string[]): Promise<void> {
    await expect.poll(() => drawnEdges(page)).toEqual(ids.slice().sort())
}

async function expectEdgeDrawn(page: Page, id: string): Promise<void> {
    await expect.poll(() => drawnEdges(page)).toContain(id)
}

async function expectEdgeNotDrawn(page: Page, id: string): Promise<void> {
    await expect.poll(() => drawnEdges(page)).not.toContain(id)
}

/**
 * The heart of "a layer is a lens": run `act`, then prove the link force is holding
 * exactly the same edges and every node is still where it was. If a layer-hidden edge
 * left the force, the equilibrium would change and the graph would drift.
 */
async function expectLayoutUndisturbed(page: Page, act: () => Promise<void>): Promise<void> {
    const forceBefore = await forceEdges(page)
    const positionsBefore = await harness(page, 'nodePositions')

    await act()

    expect(await forceEdges(page)).toEqual(forceBefore)
    expect(await harness(page, 'nodePositions')).toEqual(positionsBefore)
}

/** Switch a layer off (or back on) through the panel's row, the way a user does. */
async function clickLayer(page: Page, value: string): Promise<void> {
    await page.locator(`.pvt-edge-layer[data-value="${value}"]`).click()
}

async function openFilterPanel(page: Page): Promise<void> {
    await harness(page, 'openFilterPanel')
}

test.beforeEach(async ({ page }) => {
    await gotoHarness(page)
})

/* ---------- per-kind styling ---------- */

test.describe('per-kind styling', () => {
    test('edgeStyleMap paints each kind apart', async ({ page }) => {
        await harness(page, 'loadWithEdgeLayers', 'edgeLayers')

        // Exactly the declaration in EDGE_STYLE_MAP, resolved by the renderer.
        expect(await paintedStyle(page, 'hub-a')).toMatchObject({ stroke: '#428bca', dashed: false })
        expect(await paintedStyle(page, 'a-b')).toMatchObject({ stroke: '#888888', dashed: true })
        expect(await paintedStyle(page, 'b-d')).toMatchObject({ stroke: '#f39a1f', dashed: true, marker: true })
        expect(await paintedStyle(page, 'd-e')).toMatchObject({ stroke: '#85CB33', dashed: false })

        await expectCanvas(page, 'edge-layers-styled.png')
    })

    test('a styleCb wins over the map, as it does for nodes', async ({ page }) => {
        await harness(page, 'loadWithEdgeLayers', 'edgeLayers', { styleCb: true })

        // Every kind, whatever the map says: styleCb bypasses it wholesale.
        expect(await paintedStyle(page, 'hub-a')).toMatchObject({ stroke: '#ff00ff' })
        expect(await paintedStyle(page, 'a-b')).toMatchObject({ stroke: '#ff00ff' })
    })

    test('without edgeStyleMap every kind keeps the default stroke', async ({ page }) => {
        await harness(page, 'loadWithEdgeLayers', 'edgeLayers', { noStyleMap: true })

        const objectRef = await paintedStyle(page, 'hub-a')
        expect(await paintedStyle(page, 'a-b')).toEqual(objectRef)
    })
})

/* ---------- the panel's Relationships section ---------- */

test.describe('the filter panel', () => {
    test('lists one live row per kind, with counts', async ({ page }) => {
        await harness(page, 'loadWithEdgeLayers', 'edgeLayers')
        await openFilterPanel(page)

        expect(await layerValues(page)).toEqual([
            'analyst-relationship', 'correlation', 'object-reference', 'tag',
        ])
        expect(await layerRows(page)).toMatchObject([
            { value: 'analyst-relationship', count: '1' },
            { value: 'correlation', count: '2' },
            { value: 'object-reference', count: '3' },
            { value: 'tag', count: '2' },
        ])

        await expectElement(page.locator('.pvt-edge-layers'), 'edge-layers-panel.png')
    })

    test('a swatch reports the stroke the renderer resolved', async ({ page }) => {
        await harness(page, 'loadWithEdgeLayers', 'edgeLayers')
        await openFilterPanel(page)

        // Rows are alphabetical, so index 1 is `correlation` — grey and dashed.
        expect(await swatch(page, '.pvt-edge-layers', 1))
            .toMatchObject({ stroke: await asDrawn(page, '#888888'), dashed: true })
        // …and index 0 is `analyst-relationship`, which also resolves a marker.
        expect(await swatch(page, '.pvt-edge-layers', 0))
            .toMatchObject({ stroke: await asDrawn(page, '#f39a1f'), dashed: true, marker: true })
    })

    test('switching a layer off removes only that kind of line', async ({ page }) => {
        await harness(page, 'loadWithEdgeLayers', 'edgeLayers')
        await openFilterPanel(page)

        await clickLayer(page, 'correlation')

        await expectDrawnEdges(page, ['hub-a', 'hub-b', 'hub-c', 'b-d', 'hub-e', 'd-e'])
        expect(await switchedOffLayers(page)).toEqual(['correlation'])
        expect(await harness(page, 'hiddenEdgeCount')).toBe(2)

        // The pill counts edges apart from nodes: a layer hid relations and nothing else.
        // (A graph with no layers still reads the old bare "N hidden" — see
        // filter-hidden-count.spec.)
        await expect(page.locator('.pvt-filter-hidden')).toHaveText('2 edges hidden')

        await expectCanvas(page, 'edge-layers-correlation-off.png')
    })

    test('a toggle disturbs neither the link force nor a single node', async ({ page }) => {
        await harness(page, 'loadWithEdgeLayers', 'edgeLayers')
        await openFilterPanel(page)

        await expectLayoutUndisturbed(page, async () => {
            await clickLayer(page, 'correlation')
            await expectEdgeNotDrawn(page, 'a-b')
        })
    })

    test('a node left with no visible edge stays on the canvas', async ({ page }) => {
        await harness(page, 'loadWithEdgeLayers', 'edgeLayers')
        await openFilterPanel(page)

        // `e` is only ever reached by `tag` edges, so switching that layer off strands it.
        await clickLayer(page, 'tag')
        await expectEdgeNotDrawn(page, 'hub-e')

        expect(await visibleNodes(page)).toContain('e')
        expect(await harness(page, 'hiddenNodeCount')).toBe(0)
    })

    test('every layer can be switched off, and Show all brings them back', async ({ page }) => {
        await harness(page, 'loadWithEdgeLayers', 'edgeLayers')
        await openFilterPanel(page)

        for (const value of await layerValues(page)) await clickLayer(page, value)
        await expectDrawnEdges(page, [])
        expect(await visibleNodes(page)).toHaveLength(6) // the nodes are untouched

        await page.locator('.pvt-edge-layers button:has-text("Show all")').click()
        await expectDrawnEdges(page, [
            'hub-a', 'hub-b', 'hub-c', 'a-b', 'c-d', 'b-d', 'hub-e', 'd-e',
        ])
        expect(await activeFilterKeys(page)).toEqual([])
    })

    test('a graph declaring no edge facets grows no section at all', async ({ page }) => {
        await harness(page, 'loadWithEdgeLayers', 'edgeLayers', { facet: false })
        await openFilterPanel(page)

        expect(await layerRows(page)).toEqual([])
        await expectDrawnEdges(page, [
            'hub-a', 'hub-b', 'hub-c', 'a-b', 'c-d', 'b-d', 'hub-e', 'd-e',
        ])
    })
})

/* ---------- alongside node filters ---------- */

test.describe('with a node filter active', () => {
    test('the two and together, and restore independently', async ({ page }) => {
        await harness(page, 'loadWithEdgeLayers', 'edgeLayers')
        await openFilterPanel(page)

        // Layer off → node filter → layer on: the two restore independently.
        await clickLayer(page, 'correlation')
        await expectEdgeNotDrawn(page, 'a-b')

        await harness(page, 'setFilter', 'label', { value: ['HUB', 'A', 'B'], matchMode: 'exact' })
        await expect.poll(() => visibleNodes(page)).toEqual(['a', 'b', 'hub'])
        // `a-b` is a correlation *and* has both endpoints — still off, on layer grounds.
        await expectDrawnEdges(page, ['hub-a', 'hub-b'])

        await clickLayer(page, 'correlation')
        await expectDrawnEdges(page, ['hub-a', 'hub-b', 'a-b'])
        // The node filter survived the layer coming back.
        expect(await visibleNodes(page)).toEqual(['a', 'b', 'hub'])
    })

    test('applying a node filter from the panel keeps the layers it does not own', async ({ page }) => {
        await harness(page, 'loadWithEdgeLayers', 'edgeLayers')
        await openFilterPanel(page)

        await clickLayer(page, 'correlation')
        expect(await switchedOffLayers(page)).toEqual(['correlation'])

        // The panel's button used to reset every filter first, which dropped the layer.
        await page.locator('.pvt-graph-filter-container button:has-text("Filter Graph")').click()

        expect(await switchedOffLayers(page)).toEqual(['correlation'])
        await expectEdgeNotDrawn(page, 'a-b')
    })
})

/* ---------- the other facet types ---------- */

test.describe('facet types beyond the layer', () => {
    test('a numberRange facet hides edges by weight', async ({ page }) => {
        await harness(page, 'loadWithEdgeLayers', 'edgeLayers',
            { key: 'weight', facetType: 'numberRange' })

        await harness(page, 'setEdgeFilter', 'weight', { value: { min: 5, max: 10 } })

        // Only the three edges weighted over 5 survive.
        await expectDrawnEdges(page, ['hub-c', 'c-d', 'd-e'])
    })

    test('a regex facet hides edges by label', async ({ page }) => {
        await harness(page, 'loadWithEdgeLayers', 'edgeLayers',
            { key: 'relation', facetType: 'regex' })

        await harness(page, 'setEdgeFilter', 'relation', { value: '^tag:' })

        await expectDrawnEdges(page, ['hub-e', 'd-e'])
    })

    test('a batched edge facet renders as a form field, not a layer row', async ({ page }) => {
        await harness(page, 'loadWithEdgeLayers', 'edgeLayers',
            { key: 'weight', facetType: 'numberRange' })
        await openFilterPanel(page)

        expect(await layerRows(page)).toEqual([])
        const fields = (await harness(page, 'filterFields')) as Array<{ key: string; type: string }>
        expect(fields).toContainEqual(expect.objectContaining({ key: 'edge:weight', type: 'numberRange' }))
    })
})

/* ---------- cross-cluster stand-ins ---------- */

test.describe('cross-cluster stand-ins', () => {
    /** The one line drawn between the two collapsed clusters. */
    const STAND_IN = 'synthetic-group-a-group-b'

    test('a stand-in survives while any relation it speaks for does', async ({ page }) => {
        await harness(page, 'loadWithEdgeLayers', 'edgeLayerClusters')

        // Collapsed, this line stands for a `correlation` and a `tag` at once.
        await expectEdgeDrawn(page, STAND_IN)

        await harness(page, 'setEdgeFilter', 'kind', {
            value: ['object-reference', 'tag'], matchMode: 'exact',
        })
        await expectEdgeDrawn(page, STAND_IN) // the tag still holds it up

        await harness(page, 'setEdgeFilter', 'kind', {
            value: ['object-reference', 'correlation'], matchMode: 'exact',
        })
        await expectEdgeDrawn(page, STAND_IN) // and so does the correlation, alone

        await harness(page, 'setEdgeFilter', 'kind', {
            value: ['object-reference'], matchMode: 'exact',
        })
        await expectEdgeNotDrawn(page, STAND_IN) // neither left: the line goes
    })

    test('an external stand-in carries the single kind of its real edge', async ({ page }) => {
        await harness(page, 'loadWithEdgeLayers', 'edgeLayerClusters')
        await expectEdgeDrawn(page, 'synthetic-core-group-a')

        await harness(page, 'setEdgeFilter', 'kind', { value: ['tag'], matchMode: 'exact' })

        // `core→a1` is an object-reference, so its stand-in goes with the layer.
        await expectEdgeNotDrawn(page, 'synthetic-core-group-a')
    })

    test('a numberRange facet reaches stand-ins too', async ({ page }) => {
        await harness(page, 'loadWithEdgeLayers', 'edgeLayerClusters',
            { key: 'weight', facetType: 'numberRange' })
        await expectEdgeDrawn(page, STAND_IN)

        // Every fixture edge weighs 1.5, so nothing survives a 5..10 window — including
        // the stand-ins, which answer through the real edges they speak for.
        await harness(page, 'setEdgeFilter', 'weight', { value: { min: 5, max: 10 } })
        await expectEdgeNotDrawn(page, STAND_IN)
    })

    test('a toggle with a collapsed cluster present leaves the layout alone', async ({ page }) => {
        await harness(page, 'loadWithEdgeLayers', 'edgeLayerClusters')

        await expectLayoutUndisturbed(page, async () => {
            await harness(page, 'setEdgeFilter', 'kind', {
                value: ['object-reference'], matchMode: 'exact',
            })
            await expectEdgeNotDrawn(page, STAND_IN)
        })

        await expectCanvas(page, 'edge-layers-clusters-correlation-off.png')
    })
})

/* ---------- the legend ---------- */

test.describe('an edge-scoped legend section', () => {
    test('lists the kinds with line swatches matching what is painted', async ({ page }) => {
        await harness(page, 'loadWithEdgeLayers', 'edgeLayers', { legend: true })

        const sections = await legendSections(page)
        expect(sections).toHaveLength(1)
        expect(sections[0].title).toBe('Relationship')
        expect(sections[0].rows.map((row: LegendRow) => row.id).sort()).toEqual([
            'analyst-relationship', 'correlation', 'object-reference', 'tag',
        ])

        // Descriptive: the swatch colour is the stroke the renderer resolved.
        const byId = new Map(sections[0].rows.map((row: LegendRow) => [row.id, row]))
        expect(byId.get('correlation')?.color).toBe(await asDrawn(page, '#888888'))
        expect(byId.get('analyst-relationship')?.color).toBe(await asDrawn(page, '#f39a1f'))

        // And the drawn line carries the dash, not just the colour. Rows are in
        // first-seen order, so every swatch is read rather than one guessed at.
        const swatches = await Promise.all(
            sections[0].rows.map((_, index) => swatch(page, '.pvt-legend-panel', index)))
        expect(swatches).toContainEqual(expect.objectContaining({
            stroke: await asDrawn(page, '#f39a1f'), dashed: true,
        }))
        expect(swatches).toContainEqual(expect.objectContaining({
            stroke: await asDrawn(page, '#428bca'), dashed: false,
        }))
    })

    test('sits beside a node section in one card, labels aligned', async ({ page }) => {
        await harness(page, 'loadWithEdgeLayers', 'edgeLayers', { legend: true, nodeSection: true })

        const sections = await legendSections(page)
        expect(sections.map((section) => section.title)).toEqual(['Element', 'Relationship'])

        // The shared 18px swatch slot is what keeps a mixed card's labels on one line.
        const labels = page.locator('.pvt-legend-panel .pvt-legend-label')
        const lefts = await labels.evaluateAll((nodes) =>
            nodes.map((node) => Math.round(node.getBoundingClientRect().left)))
        expect(new Set(lefts).size).toBe(1)

        await expectElement(page.locator('.pvt-legend-panel'), 'edge-layers-legend-mixed.png')
    })

    test('filters standalone, with no edge facet declared', async ({ page }) => {
        await harness(page, 'loadWithEdgeLayers', 'edgeLayers', { legend: true, facet: false })

        await page.locator('.pvt-legend-entry[data-id="correlation"]').click()

        await expectDrawnEdges(page, ['hub-a', 'hub-b', 'hub-c', 'b-d', 'hub-e', 'd-e'])
        expect(await visibleNodes(page)).toHaveLength(6) // nodes untouched
    })

    test('a legend toggle disturbs neither the link force nor a node', async ({ page }) => {
        await harness(page, 'loadWithEdgeLayers', 'edgeLayers', { legend: true })

        await expectLayoutUndisturbed(page, async () => {
            await page.locator('.pvt-legend-entry[data-id="correlation"]').click()
            await expectEdgeNotDrawn(page, 'a-b')
        })
    })

    test('legend and panel stay in sync in both directions', async ({ page }) => {
        await harness(page, 'loadWithEdgeLayers', 'edgeLayers', { legend: true })
        await openFilterPanel(page)

        // Legend → panel.
        await page.locator('.pvt-legend-entry[data-id="correlation"]').click()
        await expect.poll(() => switchedOffLayers(page)).toEqual(['correlation'])

        // Panel → legend.
        await clickLayer(page, 'tag')
        await expect.poll(async () => {
            const rows = (await harness(page, 'legendRows')) as LegendRow[]
            return rows.filter((row) => row.hidden).map((row) => row.id).sort()
        }).toEqual(['correlation', 'tag'])

        await expectDrawnEdges(page, ['hub-a', 'hub-b', 'hub-c', 'b-d'])
    })
})
