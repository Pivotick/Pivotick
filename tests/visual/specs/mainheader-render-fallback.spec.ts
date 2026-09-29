import type { Locator, Page } from '@playwright/test'
import { test, expect, gotoHarness, harness } from '../helpers'
import type { FallbackSurface, PropertiesFallbackSpec } from '../harness/harness'

// ── A custom main header `render` hands a selection back to the default ──────
// `mainHeader.render` returning (or resolving to) `undefined` draws the default
// header: the canvas total for nothing selected, the title for one element, the
// count for several. `null` draws nothing, never the text "null", in the header
// and in an extra panel alike.

const FULL = { UI: { mode: 'full', sidebar: { collapsed: false } } }

const header = (page: Page): Locator => page.locator('.pvt-mainheader-panel')
const extraPanelBody = (page: Page): Locator => page.locator('.pivotick-extrapanel-body-panel')
const customContent = (scope: Locator): Locator => scope.locator('.pvt-test-async')
const skeleton = (scope: Locator): Locator => scope.locator('.pvt-async-skeleton')
const defaultTitle = (page: Page): Locator => header(page).locator('.pvt-mainheader-nodeinfo-name')

async function load(page: Page, spec: PropertiesFallbackSpec, surface: FallbackSurface = 'mainHeader'): Promise<void> {
    await harness(page, 'loadRenderFallback', surface, 'basic', spec, FULL)
}

/** The header shows the library's canvas total, and nothing from `render`. */
async function expectCanvasTotal(page: Page): Promise<void> {
    await expect(header(page)).toHaveText(/^Showing \d+ nodes and \d+ edges$/)
    await expect(customContent(header(page))).toHaveCount(0)
}

/** The header shows the library's own title line with `text`, and nothing from `render`. */
async function expectDefaultTitle(page: Page, text: string | RegExp): Promise<void> {
    await expect(defaultTitle(page)).toHaveText(text)
    await expect(customContent(header(page))).toHaveCount(0)
}

/** Empty: no element, and in particular not the text "null". */
async function expectEmpty(scope: Locator): Promise<void> {
    await expect(scope).toBeEmpty()
}

test.describe('main header render falls back to the default', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    test.describe('sync', () => {
        test('nothing selected falls back to the canvas total', async ({ page }) => {
            await load(page, { node: 'custom' })
            await expectCanvasTotal(page)
        })

        test('a node falls back to its title', async ({ page }) => {
            await load(page, {})
            await harness(page, 'selectNode', 'a')
            await expectDefaultTitle(page, /\S/)
        })

        test('an edge falls back to its title', async ({ page }) => {
            await load(page, {})
            await harness(page, 'selectEdge', 'a-b')
            await expectDefaultTitle(page, /\S/)
        })

        test('several nodes fall back to the selection count', async ({ page }) => {
            await load(page, {})
            await harness(page, 'multiSelect', ['a', 'b', 'c'])
            await expectDefaultTitle(page, '3 nodes selected')
        })

        test('several edges fall back to the selection count', async ({ page }) => {
            await load(page, {})
            await harness(page, 'multiSelectEdges', ['a-b', 'b-c'])
            await expectDefaultTitle(page, '2 edges selected')
        })

        test('a node whose render returns an element draws only that element', async ({ page }) => {
            await load(page, { node: 'custom' })
            await harness(page, 'selectNode', 'a')
            await expect(customContent(header(page))).toHaveText('custom · node a')
            await expect(defaultTitle(page)).toHaveCount(0)
        })

        test('the canvas total comes back once the selection is cleared', async ({ page }) => {
            await load(page, { node: 'custom' })
            await harness(page, 'selectNode', 'a')
            await expect(customContent(header(page))).toBeVisible()
            await harness(page, 'clearSelection')
            await expectCanvasTotal(page)
        })

        test('null draws nothing, undefined draws the default', async ({ page }) => {
            await load(page, { none: 'null', node: 'undefined' })
            await expectEmpty(header(page))

            await harness(page, 'selectNode', 'a')
            await expectDefaultTitle(page, /\S/)
        })
    })

    test.describe('async', () => {
        test('nothing selected shows the placeholder, then the canvas total', async ({ page }) => {
            await load(page, { async: true })
            await expect(skeleton(header(page))).toBeVisible()

            await harness(page, 'settlePropertiesRender', 'nothing selected')
            await expectCanvasTotal(page)
        })

        test('a node shows the placeholder, then its title', async ({ page }) => {
            await load(page, { async: true })
            await harness(page, 'selectNode', 'a')
            await expect(skeleton(header(page))).toBeVisible()

            await harness(page, 'settlePropertiesRender', 'node a')
            await expectDefaultTitle(page, /\S/)
            await expect(skeleton(header(page))).toHaveCount(0)
        })

        test('an edge shows the placeholder, then its title', async ({ page }) => {
            await load(page, { async: true })
            await harness(page, 'selectEdge', 'a-b')
            await expect(skeleton(header(page))).toBeVisible()

            await harness(page, 'settlePropertiesRender', 'edge a-b')
            await expectDefaultTitle(page, /\S/)
        })

        test('several nodes show the placeholder, then the selection count', async ({ page }) => {
            await load(page, { async: true })
            await harness(page, 'multiSelect', ['a', 'b', 'c'])
            await expect(skeleton(header(page))).toBeVisible()

            await harness(page, 'settlePropertiesRender', '3 nodes')
            await expectDefaultTitle(page, '3 nodes selected')
        })

        test('several edges show the placeholder, then the selection count', async ({ page }) => {
            await load(page, { async: true })
            await harness(page, 'multiSelectEdges', ['a-b', 'b-c'])
            await expect(skeleton(header(page))).toBeVisible()

            await harness(page, 'settlePropertiesRender', '2 edges')
            await expectDefaultTitle(page, '2 edges selected')
        })

        test('a fallback arriving after the selection moved on is dropped', async ({ page }) => {
            await load(page, { async: true, edge: 'custom' })
            await harness(page, 'selectNode', 'a')
            await harness(page, 'selectEdge', 'a-b')

            await harness(page, 'settlePropertiesRender', 'edge a-b')
            await expect(customContent(header(page))).toHaveText('custom · edge a-b')

            // The node's render resolves late, to `undefined`: its fallback must not land.
            await harness(page, 'settlePropertiesRender', 'node a')
            await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)))
            await expect(customContent(header(page))).toHaveText('custom · edge a-b')
            await expect(defaultTitle(page)).toHaveCount(0)
        })

        test('null resolves to nothing, undefined to the default', async ({ page }) => {
            await load(page, { async: true, node: 'null' })
            await harness(page, 'selectNode', 'a')
            await harness(page, 'settlePropertiesRender', 'node a')
            await expectEmpty(header(page))

            await harness(page, 'selectEdge', 'a-b')
            await harness(page, 'settlePropertiesRender', 'edge a-b')
            await expectDefaultTitle(page, /\S/)
        })
    })
})

test.describe('an extra panel render returning null', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    test('draws an empty body, not the text "null"', async ({ page }) => {
        await load(page, { node: 'null' }, 'extraPanel')
        await harness(page, 'selectNode', 'a')
        await expectEmpty(extraPanelBody(page))
    })

    test('resolving to null draws an empty body', async ({ page }) => {
        await load(page, { async: true, node: 'null' }, 'extraPanel')
        await harness(page, 'selectNode', 'a')
        await expect(skeleton(extraPanelBody(page))).toBeVisible()

        await harness(page, 'settlePropertiesRender', 'node a')
        await expectEmpty(extraPanelBody(page))
    })
})
