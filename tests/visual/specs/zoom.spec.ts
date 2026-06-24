import { test, gotoHarness, loadFixture, canvas, centerOf, expectCanvas } from '../helpers'

test.describe('zoom & pan', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
        await loadFixture(page, 'basic')
    })

    test('zooms in on a wheel scroll over the graph centre', async ({ page }) => {
        // The graph is fit-centred in the canvas, so the canvas centre ≈ graph centre.
        const center = await centerOf(canvas(page))
        await page.mouse.move(center.x, center.y)
        await page.mouse.wheel(0, -120) // one notch up — d3-zoom zooms in toward the cursor
        await expectCanvas(page, 'zoom-wheel-in.png')
    })

    test('pans with a middle-button drag', async ({ page }) => {
        const center = await centerOf(canvas(page))
        await page.mouse.move(center.x, center.y)
        await page.mouse.down({ button: 'middle' })
        await page.mouse.move(center.x + 160, center.y + 100, { steps: 10 })
        await page.mouse.up({ button: 'middle' })
        await expectCanvas(page, 'pan-drag.png')
    })
})
