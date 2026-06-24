import { test, gotoHarness, loadFixture, harness, expectCanvas } from '../helpers'

test.describe('zoom & pan', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
        await loadFixture(page, 'basic')
    })

    test('applies a centered 2x zoom', async ({ page }) => {
        // Place the graph origin at the viewport centre (1280x800) scaled 2x.
        await harness(page, 'setTransform', 2, 640, 400)
        await expectCanvas(page, 'zoom-2x.png')
    })

    test('pans the view', async ({ page }) => {
        await harness(page, 'setTransform', 1, 900, 250)
        await expectCanvas(page, 'panned.png')
    })
})
