import { test, expect, gotoHarness, harness, expectCanvas, canvas, waitForViewSettled } from '../helpers'
import type { Page } from '@playwright/test'

/**
 * The minimap plugin (prd/minimap-plugin.md).
 *
 * Deliberately small: the interesting claims are numeric, not pixel-level — the
 * rectangle tracks the real viewport, clicking and dragging drive it through the new
 * `setViewport` API, and navigating never re-rasterises the cached content bitmap. One
 * screenshot covers the look.
 */

interface Bounds { x: number; y: number; width: number; height: number }

async function viewport(page: Page): Promise<Bounds> {
    const bounds = (await harness(page, 'minimapViewport')) as Bounds | null
    expect(bounds).not.toBeNull()
    return bounds!
}

async function viewCenter(page: Page): Promise<{ x: number, y: number }> {
    const center = (await harness(page, 'viewCenter')) as { x: number, y: number } | null
    expect(center).not.toBeNull()
    return center!
}

/** The minimap's own box, for aiming real pointer events at it. */
async function minimapBox(page: Page): Promise<{ x: number, y: number, width: number, height: number }> {
    const box = await page.locator('.pvt-minimap').boundingBox()
    expect(box).not.toBeNull()
    return box!
}

test.describe('minimap plugin', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    test('mounts in the canvas corner and tracks the visible region', async ({ page }) => {
        await harness(page, 'loadWithMinimap', 'basic')
        await expect(page.locator('.pvt-minimap-surface')).toBeVisible()

        // The rectangle is derived from the canvas corners, so it must agree with where
        // the view actually is: its centre is the view's centre.
        const [rect, center] = [await viewport(page), await viewCenter(page)]
        expect(rect.x + rect.width / 2).toBeCloseTo(center.x, 1)
        expect(rect.y + rect.height / 2).toBeCloseTo(center.y, 1)

        // Bottom-right by default: the only corner the chrome leaves free.
        const [box, canvasBox] = [await minimapBox(page), await canvas(page).boundingBox()]
        expect(box.x).toBeGreaterThan(canvasBox!.x + canvasBox!.width / 2)
        expect(box.y).toBeGreaterThan(canvasBox!.y + canvasBox!.height / 2)

        await expectCanvas(page, 'minimap-default.png')
    })

    test('clicking recentres the main view without changing the zoom', async ({ page }) => {
        await harness(page, 'loadWithMinimap', 'basic')
        // The initial fit-and-centre commits a few frames after load; driving the minimap
        // before it lands would have it fight us for the transform.
        await waitForViewSettled(page)
        const before = await viewport(page)

        // Click well off-centre inside the minimap.
        const box = await minimapBox(page)
        await page.mouse.click(box.x + box.width * 0.8, box.y + box.height * 0.75)

        const after = await viewport(page)
        // The view moved…
        expect(Math.abs(after.x - before.x) + Math.abs(after.y - before.y)).toBeGreaterThan(1)
        // …and the zoom is untouched, so the visible region is the same size.
        expect(after.width).toBeCloseTo(before.width, 1)
        expect(after.height).toBeCloseTo(before.height, 1)
    })

    test('dragging pans the main view', async ({ page }) => {
        await harness(page, 'loadWithMinimap', 'basic')
        await waitForViewSettled(page)
        const before = await viewCenter(page)

        const box = await minimapBox(page)
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
        await page.mouse.down()
        await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.8, { steps: 8 })
        await page.mouse.up()

        const after = await viewCenter(page)
        // Dragging down-right in the minimap moves the view down-right in graph space.
        expect(after.x).toBeGreaterThan(before.x)
        expect(after.y).toBeGreaterThan(before.y)
    })

    test('navigating the main view never re-rasterises the content bitmap', async ({ page }) => {
        await harness(page, 'loadWithMinimap', 'basic')
        await waitForViewSettled(page)
        const rebuilds = (await harness(page, 'minimapRebuilds')) as number
        expect(rebuilds).toBeGreaterThan(0)
        const before = await viewport(page)

        await page.locator('#pvt-graphnavigation-zoom-in').click()

        // The rectangle shrank (we zoomed in) …
        await expect.poll(async () => (await viewport(page)).width < before.width).toBe(true)
        // … and the O(N) pass did not run again: pan/zoom is a blit plus a rectangle.
        expect(await harness(page, 'minimapRebuilds')).toBe(rebuilds)
    })

    test('honours position and size, and follows the canvas aspect ratio', async ({ page }) => {
        await harness(page, 'loadWithMinimap', 'basic', { position: 'top-left', width: 260 })

        const box = await minimapBox(page)
        expect(box.width).toBeCloseTo(260, 0)
        // Height derived from the canvas: 1280×~750 in the harness, so ~0.6 × width.
        const canvasBox = (await canvas(page).boundingBox())!
        expect(box.height).toBeCloseTo(260 * (canvasBox.height / canvasBox.width), 0)
        // top-left clears the 54px mode rail rather than sitting under it.
        expect(box.x).toBeGreaterThan(canvasBox.x + 54)
    })

    test('switches to the density path on a large graph', async ({ page }) => {
        // Past 1500 nodes the bitmap is painted as density — one stamp per node, no
        // per-node style lookups and no edges.
        test.slow() // 1600 nodes is the main renderer's cost, not the minimap's
        await harness(page, 'loadManyNodesWithMinimap', 1600)

        await expect(page.locator('.pvt-minimap-surface')).toBeVisible()
        await expect.poll(async () => (await harness(page, 'minimapRebuilds')) as number)
            .toBeGreaterThan(0)
        expect(await harness(page, 'warnings')).toEqual([])
        await expectCanvas(page, 'minimap-density.png')
    })

    test('static mode gets no minimap, and says why', async ({ page }) => {
        await harness(page, 'loadWithMinimap', 'basic', {}, { UI: { mode: 'static' } })

        await expect(page.locator('.pvt-minimap')).toHaveCount(0)
        expect(await harness(page, 'warnings')).toEqual(
            expect.arrayContaining([expect.stringContaining('not available in \'static\' mode')])
        )
    })
})
