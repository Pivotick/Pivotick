import { test, expect, gotoHarness } from '../helpers'
import type { Page } from '@playwright/test'
import type { AutoState } from '../harness/harness'

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

/**
 * The same reopen under auto physics. Auto re-tunes once the opening pass lands; that tune
 * may move the knobs, but must not reheat a layout the host vouched for.
 *
 * Square cards are drawn at a guessed radius and measured a frame later, so the tune after
 * the opening pass sees twice the radius the opening tune did, and lands outside the deadband.
 */
test.describe('warmupTicks: 0 under auto physics', () => {
    const cards = { render: { defaultNodeStyle: { shape: 'square', size: 40 } } }
    const reopen = { physics: 'auto', warmupTicks: 0, d3Alpha: 0.05, d3LinkDistance: 200 }

    const autoState = (page: Page) => page.evaluate(() => window.__pivotick.autoState())

    /**
     * Load the cards under auto, let them settle, then reopen them where they were left.
     * Resolves the knobs auto settled on the first time.
     */
    async function reopenUnderAuto(page: Page, useWorker: boolean): Promise<AutoState['knobs']> {
        await page.evaluate(([sim, o]) => window.__pivotick.loadPositioned(sim, o), [{ useWorker, physics: 'auto' }, cards] as const)
        const { knobs } = await autoState(page)
        await page.evaluate(([sim, o]) => window.__pivotick.reopenAsLeft(sim, o), [{ useWorker, ...reopen }, cards] as const)
        return knobs
    }

    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    for (const useWorker of [true, false]) {
        const thread = useWorker ? 'worker' : 'main thread'

        test(`a settled graph reopens as it was left (${thread})`, async ({ page }) => {
            const settledOn = await reopenUnderAuto(page, useWorker)
            expect(await driftAfter(page, 2000)).toBeLessThan(10)
            // Auto did re-tune to the measured cards; it just left the layout where it was.
            expect((await autoState(page)).knobs).toEqual(settledOn)
        })
    }

    test('nodes added afterwards re-tune and reheat', async ({ page }) => {
        await reopenUnderAuto(page, false)
        await page.waitForTimeout(500)
        await page.evaluate(() => window.__pivotick.resetReheatCount())

        await page.evaluate(() => window.__pivotick.growAuto(12, 40))
        await page.waitForTimeout(500)
        expect((await autoState(page)).skipped).toBe(false)
        expect(await page.evaluate(() => window.__pivotick.reheatCount())).toBe(1)
    })
})
