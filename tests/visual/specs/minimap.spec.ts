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

/**
 * How much node ink the minimap is actually showing: pixels drawn in the fixtures'
 * blue node colour. Reading the canvas back is the only way to assert the *drawing*
 * changed rather than merely that a redraw was scheduled.
 */
async function inkPixels(page: Page): Promise<number> {
    return page.evaluate(() => {
        const surface = document.querySelector('.pvt-minimap-surface') as HTMLCanvasElement
        const context = surface.getContext('2d')!
        const { data } = context.getImageData(0, 0, surface.width, surface.height)
        let count = 0
        for (let index = 0; index < data.length; index += 4) {
            const [red, green, blue, alpha] = [data[index], data[index + 1], data[index + 2], data[index + 3]]
            if (alpha > 200 && blue > 150 && red < 120 && green < 170) count++
        }
        return count
    })
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

    test('filtered-out nodes leave the minimap', async ({ page }) => {
        // Filtering hides nodes through the query engine, which emits neither a data
        // event nor a tick — so this is about the minimap noticing at all.
        await harness(page, 'loadWithMinimap', 'basic')
        await waitForViewSettled(page)
        const before = { dots: await inkPixels(page), rebuilds: await harness(page, 'minimapRebuilds') }
        expect(before.dots).toBeGreaterThan(0)

        // Every node in `basic` carries an upper-cased label; keep only one of them.
        await harness(page, 'setFilter', 'label', { value: 'A', matchMode: 'exact' })

        expect(await harness(page, 'visibleNodeIds')).toEqual(['a'])
        await expect.poll(async () => (await harness(page, 'minimapRebuilds')) as number)
            .toBeGreaterThan(before.rebuilds as number)
        // The drawing itself lost ink: five of the six nodes are gone from the picture.
        await expect.poll(async () => await inkPixels(page)).toBeLessThan(before.dots / 2)

        // …and they come back.
        await harness(page, 'resetFilters')
        await expect.poll(async () => await inkPixels(page)).toBeGreaterThan(before.dots / 2)
    })

    test('a node dragged with the simulation off still moves in the minimap', async ({ page }) => {
        // No simulation means no ticks, so the drop has to be noticed on its own.
        await harness(page, 'loadWithMinimap', 'basic')
        await waitForViewSettled(page)
        const rebuilds = (await harness(page, 'minimapRebuilds')) as number

        const node = page.locator('#node-hub')
        const box = (await node.boundingBox())!
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
        await page.mouse.down()
        await page.mouse.move(box.x + 220, box.y + 140, { steps: 8 })
        await page.mouse.up()

        await expect.poll(async () => (await harness(page, 'minimapRebuilds')) as number)
            .toBeGreaterThan(rebuilds)
    })

    test('the collapse toggle folds it away to just the button, and back', async ({ page }) => {
        await harness(page, 'loadWithMinimap', 'basic')
        await waitForViewSettled(page)
        const expanded = await minimapBox(page)
        const toggle = page.locator('.pvt-minimap-toggle')

        // Really small, and it lives inside the minimap rather than beside it.
        const button = (await toggle.boundingBox())!
        expect(button.width).toBeLessThanOrEqual(20)
        expect(button.height).toBeLessThanOrEqual(20)

        await toggle.click()

        // Nothing left but the button — and it folded into its own corner, so the docked
        // edges (right / bottom here) did not move.
        await expect(page.locator('.pvt-minimap-surface')).toBeHidden()
        const collapsed = await minimapBox(page)
        expect(collapsed.width).toBeLessThanOrEqual(20)
        expect(collapsed.height).toBeLessThanOrEqual(20)
        expect(collapsed.x + collapsed.width).toBeCloseTo(expanded.x + expanded.width, 0)
        expect(collapsed.y + collapsed.height).toBeCloseTo(expanded.y + expanded.height, 0)

        // Coming back re-rasterises rather than trusting a canvas that was resized away,
        // so there is real ink on the surface again.
        const rebuilds = (await harness(page, 'minimapRebuilds')) as number
        await toggle.click()
        await expect(page.locator('.pvt-minimap-surface')).toBeVisible()
        expect((await minimapBox(page)).width).toBeCloseTo(expanded.width, 0)
        await expect.poll(async () => (await harness(page, 'minimapRebuilds')) as number)
            .toBeGreaterThan(rebuilds)
        await expect.poll(async () => await inkPixels(page)).toBeGreaterThan(0)
    })

    test('it can open collapsed, and draws nothing until it is opened', async ({ page }) => {
        await harness(page, 'loadWithMinimap', 'basic', { collapsed: true })

        await expect(page.locator('.pvt-minimap-toggle')).toBeVisible()
        await expect(page.locator('.pvt-minimap-surface')).toBeHidden()
        // Put away it costs nothing at all: the O(N) pass never ran.
        expect(await harness(page, 'minimapRebuilds')).toBe(0)

        await page.locator('.pvt-minimap-toggle').click()
        await expect.poll(async () => await inkPixels(page)).toBeGreaterThan(0)
    })

    test('static mode gets no minimap, and says why', async ({ page }) => {
        await harness(page, 'loadWithMinimap', 'basic', {}, { UI: { mode: 'static' } })

        await expect(page.locator('.pvt-minimap')).toHaveCount(0)
        expect(await harness(page, 'warnings')).toEqual(
            expect.arrayContaining([expect.stringContaining('not available in \'static\' mode')])
        )
    })
})
