import { test, expect, gotoHarness, loadFixture, harness } from '../helpers'

test.describe('node editing', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
        await loadFixture(page, 'basic')
    })

    test('opens the node edit modal', async ({ page }) => {
        await harness(page, 'openNodeEditor', 'a')

        const modal = page.locator('#edit-node-modal')
        await expect(modal).toBeVisible()
        // Snapshot just the modal — isolates it from the (separately tested) canvas.
        await expect(modal).toHaveScreenshot('node-edit-modal.png')
    })
})
