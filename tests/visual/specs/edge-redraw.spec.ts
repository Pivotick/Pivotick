import { test, expect, gotoHarness, harness, loadFixture, waitForViewSettled } from '../helpers'
import type { Page } from '@playwright/test'

/**
 * An edge's `d` is written when the layout moves, so anything that redraws an edge on a
 * graph whose simulation has already settled has to write the geometry itself. It did not,
 * and the graph drew as unconnected nodes with arrowheads floating in space — the markers
 * come from the render, the line did not.
 */
async function drawnEdges(page: Page): Promise<{ total: number; withD: number }> {
    return page.evaluate(() => {
        const paths = Array.from(document.querySelectorAll('g.pvt-edge-group path'))
        return {
            total: paths.length,
            withD: paths.filter((path) => (path.getAttribute('d') ?? '').length > 0).length,
        }
    })
}

/** Every edge on screen is actually drawn, not just present in the DOM. */
async function expectEveryEdgeDrawn(page: Page): Promise<void> {
    const edges = await drawnEdges(page)
    expect(edges.total).toBeGreaterThan(0)
    expect(edges.withD).toBe(edges.total)
}

test.describe('redrawing edges on a settled graph', () => {
    test('a renderer update keeps every edge drawn', async ({ page }) => {
        await gotoHarness(page)
        await loadFixture(page, 'basic')
        await waitForViewSettled(page)
        await expectEveryEdgeDrawn(page)

        await harness(page, 'rerender')
        await expectEveryEdgeDrawn(page)
    })

    test('a tier swap keeps every edge drawn', async ({ page }) => {
        await gotoHarness(page)
        await harness(page, 'loadWithTiers')
        await waitForViewSettled(page)

        // Each of these crosses a threshold, so every node is torn down and redrawn.
        await harness(page, 'setZoomScale', 0.5)
        await expectEveryEdgeDrawn(page)

        await harness(page, 'setZoomScale', 1.2)
        await expectEveryEdgeDrawn(page)
    })
})
