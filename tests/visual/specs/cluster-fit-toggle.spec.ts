import { test, expect, gotoHarness, loadFixture } from '../helpers'
import type { Page } from '@playwright/test'

/**
 * Behavioural (non-screenshot) test for the `fitViewOnExpandCollapse` option
 * (default OFF): expanding/collapsing a cluster should reframe the viewport only
 * when the toggle is enabled.
 *
 * We read the applied zoom scale `k` before and after an expand. The zoom
 * transform is only ever touched by a fit — the sim moving nodes never changes
 * it — so `k` unchanged means no auto-fit ran, and `k` changed means the graph
 * reframed. Driven on the real main-thread sim (worker off) with wall-clock
 * timing, because the post-expand fit runs on a d3 transition that only fires
 * after the expand animation completes. Each measurement is taken once the sim
 * has stopped so it never races the one-shot fit issued on initial load.
 */

/** Wait for the sim to stop, then a margin, so any pending settle-aware fit has landed. */
async function settle(page: Page, marginMs = 1500): Promise<void> {
    await page.evaluate(async (marginMs) => {
        const g = window.__pivotick.graph!
        await g.simulation.waitForSimulationStop()
        await new Promise<void>((r) => setTimeout(r, marginMs))
    }, marginMs)
}

/** The applied zoom scale `k` (the `a` term of the zoom-layer transform matrix). */
async function scaleK(page: Page): Promise<number> {
    return page.evaluate(() => {
        const g = window.__pivotick.graph!
        const zg = g.renderer.getZoomGroup() as SVGGElement | null
        const m = zg?.transform.baseVal.consolidate()?.matrix
        return m ? +m.a.toFixed(3) : 0
    })
}

/** Toggle a cluster open and report whether it is now expanded. */
async function expandCluster(page: Page, nodeId: string): Promise<boolean> {
    return page.evaluate((nodeId) => {
        const g = window.__pivotick.graph!
        const node = g.getMutableNode(nodeId)!
        g.toggleExpandNode(node)
        return node.expanded === true
    }, nodeId)
}

test.describe('fit view on expand/collapse toggle', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    test('an expand reframes the view only when the toggle is enabled', async ({ page }) => {
        // Default: fitViewOnExpandCollapse is off.
        await loadFixture(page, 'linkedClusters', {
            simulation: { enabled: true, useWorker: false },
            render: { enableNodeExpansion: true },
        })

        // Off (default): expanding a cluster must leave the viewport untouched.
        await settle(page) // let the initial load fit land before baselining
        const beforeOff = await scaleK(page)
        const offExpanded = await expandCluster(page, 'group-a')
        await settle(page)
        const afterOff = await scaleK(page)
        console.log('[fit-toggle] OFF:', JSON.stringify({ beforeOff, afterOff, offExpanded }))
        expect(offExpanded).toBe(true)
        expect(afterOff).toBe(beforeOff) // no reframe when off

        // Flip the toggle on (the same call the dropdown item makes).
        const enabled = await page.evaluate(() => {
            const g = window.__pivotick.graph!
            g.simulation.toggleFitViewOnExpandCollapse()
            return g.simulation.isFitViewOnExpandCollapse()
        })
        expect(enabled).toBe(true)

        // On: expanding the other cluster reframes the view (scale changes).
        const beforeOn = await scaleK(page)
        const onExpanded = await expandCluster(page, 'group-b')
        await settle(page)
        const afterOn = await scaleK(page)
        console.log('[fit-toggle] ON:', JSON.stringify({ beforeOn, afterOn, onExpanded }))
        expect(onExpanded).toBe(true)
        expect(afterOn).not.toBe(beforeOn) // reframed when on
    })
})
