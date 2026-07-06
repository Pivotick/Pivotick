import { test, expect, gotoHarness } from '../helpers'
import type { Page } from '@playwright/test'

/**
 * Behavioural (non-screenshot) test for library-fixes #8: a custom `renderNode`
 * node's measured size must feed its collision radius.
 *
 * Repro (custom HTML node): a `renderNode` card is measured to size its
 * foreignObject, but the measured size was only pushed into the node radius when
 * `enableNodeExpansion` was on. A normal graph left every card at the default
 * r=10, so the force sim treated a large card as a tiny circle and packed the
 * cards until they overlapped. And even once set, the radius lands in a
 * post-reveal rAF *after* the sim has cooled — so without a nudge nothing
 * re-spaces.
 *
 * The fix feeds the measured half-size into `setCircleRadius` for custom nodes
 * regardless of expansion, and reheats the sim once so collision re-spaces the
 * freshly-sized cards.
 *
 * We drive the real main-thread sim (worker off) with real rAF/wall-clock timing
 * — the measurement + reheat only happen across animation frames — and read
 * three live signals once everything has settled:
 *  - the radius each card ends up with (measured, not the default 10),
 *  - the radius the collision force actually assigns each card, and
 *  - the closest any two cards end up (they start overlapping; collision, driven
 *    by the measured radius + the reheat, must push them apart).
 */

interface CollisionResult {
    /** `getCircleRadius()` for each card — should reflect the measured card, not r=10. */
    radii: number[]
    /** Radius the live collision force assigns each card (`1.2·r`). */
    collideRadii: number[]
    /** Closest centre-to-centre distance between any two cards after settling. */
    minDist: number
    count: number
}

/**
 * Load the custom-card graph, wait (real frames) until the measured size has fed
 * each card's radius, let the reheat run and the sim cool, then read the radii,
 * the collision-force radii, and the tightest pairwise spacing.
 */
async function settleAndMeasure(page: Page): Promise<CollisionResult> {
    return page.evaluate(async () => {
        const g = window.__pivotick.graph!
        const raf = () => new Promise<void>((r) => requestAnimationFrame(() => r()))
        const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
        const cards = () => g.getMutableNodes().filter((n) => n.visible)

        // Measurement lands over the next frames once the cards are on screen.
        for (let i = 0; i < 180; i++) {
            if (cards().every((n) => n.getCircleRadius() > 30)) break
            await raf()
        }
        // Let the debounced reheat fire, then let collision re-space and cool.
        await raf()
        await raf()
        await Promise.race([g.simulation.waitForSimulationStop(), sleep(5000)])
        await sleep(150)

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const d3sim = g.simulation.getSimulation() as any
        const collideRadius = d3sim.force('collide').radius() as (n: unknown) => number

        const list = cards()
        let minDist = Infinity
        for (let i = 0; i < list.length; i++) {
            for (let j = i + 1; j < list.length; j++) {
                const d = Math.hypot(
                    (list[i].x ?? 0) - (list[j].x ?? 0),
                    (list[i].y ?? 0) - (list[j].y ?? 0),
                )
                minDist = Math.min(minDist, d)
            }
        }

        return {
            radii: list.map((n) => Math.round(n.getCircleRadius())),
            collideRadii: list.map((n) => Math.round(collideRadius(n))),
            minDist: Math.round(minDist),
            count: list.length,
        }
    })
}

test.describe('custom node collision', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    test('a custom card\'s measured size feeds its collision radius and spreads the cards', async ({ page }) => {
        // Sim on, main-thread (worker off). Charge off so the *only* thing that can
        // separate the overlapping cards is collision, driven by the card radius.
        await page.evaluate(() =>
            window.__pivotick.loadCustomNodes({
                simulation: { enabled: true, useWorker: false, d3ManyBodyStrength: 0 },
            }),
        )
        await page.locator('.zoom-layer:not(.hidden)').first().waitFor({ state: 'attached' })

        const r = await settleAndMeasure(page)
        // Surface the live numbers so the outcome is inspectable, not just pass/fail.
        console.log('[custom-node] collision result:', JSON.stringify(r))

        expect(r.count).toBe(5)

        // The measured 140×44 card → radius = ½·max(w,h) = 70, not the default 10.
        for (const radius of r.radii) {
            expect(radius).toBeGreaterThanOrEqual(60)
            expect(radius).toBeLessThanOrEqual(80)
        }

        // Root cause / the fix: the collision force now sizes each card by its
        // measured radius (1.2·70 ≈ 84), not the fallback d3CollideRadius of 12.
        for (const cr of r.collideRadii) {
            expect(cr).toBeGreaterThanOrEqual(70)
        }

        // End-to-end: the cards start stacked within ~25px of the origin. With the
        // measured radius fed in and the sim reheated once, collision pushes them
        // apart to roughly touching (≈2·84). Before the fix they stayed at r=10
        // and collision (≈2·12) left them piled on top of each other.
        expect(r.minDist).toBeGreaterThan(120)
    })
})
