import type { Locator, Page } from '@playwright/test'
import { test, expect, gotoHarness, harness } from '../helpers'
import type { PropertiesFallbackSpec } from '../harness/harness'

// ── A custom properties `render` hands a selection back to the default ────────
// `propertiesPanel.render` returning (or resolving to) `undefined` draws what
// the panel draws without a `render`: the property rows for one element, the
// aggregated table for several. `null` still draws nothing.

const FULL = { UI: { mode: 'full', sidebar: { collapsed: false } } }
const PEOPLE = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6']

const body = (page: Page): Locator => page.locator('.pvt-properties-body-panel')
const customContent = (page: Page): Locator => body(page).locator('.pvt-test-async')
const propertyRows = (page: Page): Locator => body(page).locator('.pvt-prop')
const aggregatedTable = (page: Page): Locator => body(page).locator('.pvt-aggregated-properties .pvt-facet-card')
const skeleton = (page: Page): Locator => body(page).locator('.pvt-async-skeleton')

async function load(page: Page, fixture: 'basic' | 'facetSample', spec: PropertiesFallbackSpec): Promise<void> {
    await harness(page, 'loadPropertiesFallback', fixture, spec, FULL)
}

/** The panel shows the library's own drawing, and nothing from `render`. */
async function expectDefaultRows(page: Page): Promise<void> {
    await expect(propertyRows(page).first()).toBeVisible()
    await expect(customContent(page)).toHaveCount(0)
}

async function expectAggregatedTable(page: Page): Promise<void> {
    await expect(aggregatedTable(page).first()).toBeVisible()
    await expect(customContent(page)).toHaveCount(0)
}

async function expectEmptyBody(page: Page): Promise<void> {
    await expect(body(page)).toBeEmpty()
}

async function selectedIds(page: Page): Promise<string[]> {
    return ((await harness(page, 'selectedNodeIds')) as string[]).slice().sort()
}

test.describe('properties render falls back to the default', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    test.describe('sync', () => {
        test('a node falls back to its property rows', async ({ page }) => {
            await load(page, 'basic', {})
            await harness(page, 'selectNode', 'a')
            await expectDefaultRows(page)
        })

        test('an edge falls back to its property rows', async ({ page }) => {
            await load(page, 'basic', {})
            await harness(page, 'selectEdge', 'a-b')
            await expectDefaultRows(page)
        })

        test('several nodes fall back to the aggregated table, whose chips narrow the selection', async ({ page }) => {
            await load(page, 'facetSample', { node: 'custom' })
            await harness(page, 'multiSelect', PEOPLE)
            await expectAggregatedTable(page)

            await body(page).locator('.pvt-facet-chip', { hasText: /^C3$/ }).click({ modifiers: ['Alt'] })
            expect(await selectedIds(page)).toEqual(['C1', 'C2', 'C4', 'C5', 'C6'])
        })

        test('several edges fall back to the aggregated table', async ({ page }) => {
            await load(page, 'basic', {})
            await harness(page, 'multiSelectEdges', ['a-b', 'b-c'])
            await expectAggregatedTable(page)
        })

        test('a node whose render returns an element draws only that element', async ({ page }) => {
            await load(page, 'basic', { node: 'custom' })
            await harness(page, 'selectNode', 'a')
            await expect(customContent(page)).toHaveText('custom · node a')
            await expect(propertyRows(page)).toHaveCount(0)
        })

        test('null draws nothing, undefined draws the default', async ({ page }) => {
            await load(page, 'basic', { node: 'null', edge: 'undefined' })

            await harness(page, 'selectNode', 'a')
            await expectEmptyBody(page)

            await harness(page, 'selectEdge', 'a-b')
            await expectDefaultRows(page)
        })
    })

    test.describe('async', () => {
        test('a node shows the placeholder, then its property rows', async ({ page }) => {
            await load(page, 'basic', { async: true })
            await harness(page, 'selectNode', 'a')
            await expect(skeleton(page)).toBeVisible()

            await harness(page, 'settlePropertiesRender', 'node a')
            await expectDefaultRows(page)
            await expect(skeleton(page)).toHaveCount(0)
        })

        test('an edge shows the placeholder, then its property rows', async ({ page }) => {
            await load(page, 'basic', { async: true })
            await harness(page, 'selectEdge', 'a-b')
            await expect(skeleton(page)).toBeVisible()

            await harness(page, 'settlePropertiesRender', 'edge a-b')
            await expectDefaultRows(page)
        })

        test('several nodes show the placeholder, then the aggregated table', async ({ page }) => {
            await load(page, 'facetSample', { async: true })
            await harness(page, 'multiSelect', PEOPLE)
            await expect(skeleton(page)).toBeVisible()

            await harness(page, 'settlePropertiesRender', '6 nodes')
            await expectAggregatedTable(page)
        })

        test('several edges show the placeholder, then the aggregated table', async ({ page }) => {
            await load(page, 'basic', { async: true })
            await harness(page, 'multiSelectEdges', ['a-b', 'b-c'])
            await expect(skeleton(page)).toBeVisible()

            await harness(page, 'settlePropertiesRender', '2 edges')
            await expectAggregatedTable(page)
        })

        test('a fallback arriving after the selection moved on is dropped', async ({ page }) => {
            await load(page, 'basic', { async: true, edge: 'custom' })
            await harness(page, 'selectNode', 'a')
            await harness(page, 'selectEdge', 'a-b')

            await harness(page, 'settlePropertiesRender', 'edge a-b')
            await expect(customContent(page)).toHaveText('custom · edge a-b')

            // The node's render resolves late, to `undefined`: its fallback must not land.
            await harness(page, 'settlePropertiesRender', 'node a')
            await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)))
            await expect(customContent(page)).toHaveText('custom · edge a-b')
            await expect(propertyRows(page)).toHaveCount(0)
        })

        test('null resolves to nothing, undefined to the default', async ({ page }) => {
            await load(page, 'basic', { async: true, node: 'null' })

            await harness(page, 'selectNode', 'a')
            await harness(page, 'settlePropertiesRender', 'node a')
            await expectEmptyBody(page)

            await harness(page, 'selectEdge', 'a-b')
            await harness(page, 'settlePropertiesRender', 'edge a-b')
            await expectDefaultRows(page)
        })
    })
})
