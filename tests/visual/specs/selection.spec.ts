import { test, gotoHarness, loadFixture, harness, expectCanvas } from '../helpers'

test.describe('selection', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
        await loadFixture(page, 'basic')
    })

    test('highlights a selected node', async ({ page }) => {
        await harness(page, 'selectNode', 'a')
        await expectCanvas(page, 'node-selected.png')
    })

    test('highlights a selected edge', async ({ page }) => {
        await harness(page, 'selectEdge', 'a-b')
        await expectCanvas(page, 'edge-selected.png')
    })

    test('clears selection', async ({ page }) => {
        await harness(page, 'selectNode', 'a')
        await harness(page, 'deselectAll')
        await expectCanvas(page, 'selection-cleared.png')
    })
})
