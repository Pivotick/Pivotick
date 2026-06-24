import {
    test,
    expect,
    gotoHarness,
    loadFixture,
    harness,
    nodeEl,
    centerOf,
    expectCanvas,
    canvas,
} from '../helpers'

test.describe('edge creation', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
        await loadFixture(page, 'pair')
    })

    test('creates an edge through the editing layer', async ({ page }) => {
        await harness(page, 'connect', 'a', 'b')
        const counts = (await harness(page, 'counts')) as { edges: number }
        expect(counts.edges).toBe(1)
        await expectCanvas(page, 'edge-created.png')
    })

    test('previews a shadow link, then commits it (click-to-connect)', async ({ page }) => {
        await harness(page, 'startClickConnect')
        await harness(page, 'pickConnectNode', 'a')

        // Move the real cursor across the canvas: the shadow edge tracks the pointer.
        const target = await centerOf(nodeEl(page, 'b'))
        await page.mouse.move(target.x, target.y)
        await expect(canvas(page).locator('.pvt-shadow-edge')).toBeVisible()
        await expectCanvas(page, 'shadow-link-preview.png')

        // Picking the second node commits the edge.
        await harness(page, 'pickConnectNode', 'b')
        const counts = (await harness(page, 'counts')) as { edges: number }
        expect(counts.edges).toBe(1)
        await expectCanvas(page, 'edge-committed.png')
    })
})
