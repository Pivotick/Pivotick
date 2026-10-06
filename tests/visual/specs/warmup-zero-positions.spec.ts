import { test, expect, gotoHarness } from '../helpers'
import type { Page } from '@playwright/test'

/**
 * Behavioural (non-screenshot) test: `simulation.warmupTicks: 0` keeps the positions the
 * nodes were given. A host reopening a stored graph hands over every node's `x`/`y` and
 * asks for no warmup; the layout must not run anyway, on either thread.
 */

/** Boot the positioned ring and resolve the farthest any node ended up from its given spot. */
async function driftAfterLoad(page: Page, simulation: Record<string, unknown>): Promise<number> {
    await page.evaluate((sim) => window.__pivotick.loadPositioned(sim), simulation)
    return page.evaluate(() => window.__pivotick.maxDriftFromGiven())
}

/** Let the live simulation run on real frames, then read the drift again. */
async function driftAfter(page: Page, ms: number): Promise<number> {
    await page.waitForTimeout(ms)
    return page.evaluate(() => window.__pivotick.maxDriftFromGiven())
}

test.describe('warmupTicks: 0 keeps given positions', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    for (const useWorker of [true, false]) {
        const thread = useWorker ? 'worker' : 'main thread'

        test(`the opening layout leaves them where they were (${thread})`, async ({ page }) => {
            // Live simulation off: what is measured is the opening layout alone.
            const drift = await driftAfterLoad(page, { enabled: false, useWorker, warmupTicks: 0 })
            expect(drift).toBeLessThan(1)
        })

        test(`a settled graph reopens as it was left (${thread})`, async ({ page }) => {
            await page.evaluate((sim) => window.__pivotick.loadPositioned(sim), { useWorker })
            await page.evaluate((sim) => window.__pivotick.reopenAsLeft(sim), { useWorker, warmupTicks: 0, d3Alpha: 0.05 })
            expect(await driftAfter(page, 1000)).toBeLessThan(5)
        })
    }

    test('without warmupTicks: 0, the opening layout still moves them', async ({ page }) => {
        const drift = await driftAfterLoad(page, { enabled: false, useWorker: false })
        expect(drift).toBeGreaterThan(50)
    })
})
