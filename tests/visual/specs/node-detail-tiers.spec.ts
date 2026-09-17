import { test, expect, gotoHarness, harness, waitForViewSettled, nodeEl } from '../helpers'
import type { Page } from '@playwright/test'

/**
 * The tiered fixture declares a 32-wide dot and a 140-wide chip, so the footprint is 70 and
 * each tier's threshold is its own width: the chip engages at a rendered footprint of 140
 * (k = 1) and the dot at 32 (k = 32/140). These are the zooms the tests straddle.
 */
const CHIP_ZOOM = 1.2
const DOT_ZOOM = 0.5
/** Inside the chip's hysteresis band (0.85 x 140 = 119 px, i.e. k = 0.85), below its threshold. */
const HYSTERESIS_ZOOM = 0.9

const FOOTPRINT = 70
const CARD = { width: 280, height: 150 }
/** Generous room for the gap an arrowhead leaves; well under the 70 a stale chip anchor gives. */
const ARROWHEAD_ROOM = 20

/** Which drawing a node is showing, by tier index; `'base'` is the floor style. */
async function tierOf(page: Page, id: string): Promise<string | null> {
    return harness(page, 'tierOf', id)
}

/**
 * The focus card is a `foreignObject` that grows to its content a frame after it is
 * appended, so this waits for the measurement rather than catching the placeholder.
 */
async function expectCardBox(page: Page, id: string): Promise<void> {
    await expect.poll(() => harness(page, 'focusCardBox', id)).toEqual(CARD)
}

test.describe('zoom-driven node detail', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    test('draws the richest tier that fits, and the dot once it does not', async ({ page }) => {
        await harness(page, 'loadWithTiers')
        await waitForViewSettled(page)

        await harness(page, 'setZoomScale', CHIP_ZOOM)
        expect(await tierOf(page, 'a')).toBe('1')

        await harness(page, 'setZoomScale', DOT_ZOOM)
        expect(await tierOf(page, 'a')).toBe('0')
    })

    test('holds the engaged tier inside the hysteresis band', async ({ page }) => {
        await harness(page, 'loadWithTiers')
        await waitForViewSettled(page)

        await harness(page, 'setZoomScale', CHIP_ZOOM)
        expect(await tierOf(page, 'a')).toBe('1')

        // Below the chip's threshold but inside its band: it holds rather than flipping.
        await harness(page, 'setZoomScale', HYSTERESIS_ZOOM)
        expect(await tierOf(page, 'a')).toBe('1')

        // Past the band, it gives way...
        await harness(page, 'setZoomScale', 0.8)
        expect(await tierOf(page, 'a')).toBe('0')

        // ...and re-engaging takes the full threshold, not the band's edge.
        await harness(page, 'setZoomScale', HYSTERESIS_ZOOM)
        expect(await tierOf(page, 'a')).toBe('0')
        await harness(page, 'setZoomScale', 1.05)
        expect(await tierOf(page, 'a')).toBe('1')
    })

    test('no node moves across a tier swap', async ({ page }) => {
        await harness(page, 'loadWithTiers')
        await waitForViewSettled(page)
        await harness(page, 'setZoomScale', DOT_ZOOM)

        const before = await harness(page, 'nodePositions')
        await harness(page, 'setZoomScale', CHIP_ZOOM)
        expect(await tierOf(page, 'a')).toBe('1')

        expect(await harness(page, 'nodePositions')).toEqual(before)
    })

    test('the footprint is the widest tier, whatever is drawn inside it', async ({ page }) => {
        await harness(page, 'loadWithTiers')
        await waitForViewSettled(page)

        await harness(page, 'setZoomScale', DOT_ZOOM)
        expect(await harness(page, 'layoutSizeOf', 'a')).toBe(FOOTPRINT)

        await harness(page, 'setZoomScale', CHIP_ZOOM)
        expect(await harness(page, 'layoutSizeOf', 'a')).toBe(FOOTPRINT)
    })

    test('a node added while zoomed past a threshold draws at its neighbours tier', async ({ page }) => {
        await harness(page, 'loadWithTiers')
        await waitForViewSettled(page)
        await harness(page, 'setZoomScale', CHIP_ZOOM)
        expect(await tierOf(page, 'a')).toBe('1')

        await harness(page, 'addNode', 'late', 60, 60)
        await nodeEl(page, 'late').waitFor({ state: 'attached' })
        expect(await tierOf(page, 'late')).toBe('1')
    })

    test('every node on the same tiers draws the same one, anywhere in the band', async ({ page }) => {
        await harness(page, 'loadWithTiers')
        await waitForViewSettled(page)

        // Walk across both thresholds and back, pausing inside each hysteresis band. Nodes
        // scroll in and out of the viewport on the way, and an off-screen one is re-picked
        // later than its neighbours — which used to leave it on a different tier for good.
        for (const scale of [1.2, 0.9, 0.5, 0.28, 0.5, 0.9, 1.2]) {
            await harness(page, 'setZoomScale', scale)
            const tiers = await harness(page, 'tiersDrawn')
            expect(new Set(Object.values(tiers)).size, `at zoom ${scale}: ${JSON.stringify(tiers)}`).toBe(1)
        }
    })

    test('edges re-anchor on the new drawing after a swap', async ({ page }) => {
        await harness(page, 'loadWithTiers')
        await waitForViewSettled(page)

        // The chip is 140 wide inside a 70 footprint; the dot is 32. An edge anchored on the
        // chip and left there would end a long way short of the dot it now points at.
        await harness(page, 'setZoomScale', CHIP_ZOOM)
        expect(await tierOf(page, 'a')).toBe('1')
        await harness(page, 'setZoomScale', DOT_ZOOM)
        expect(await tierOf(page, 'a')).toBe('0')

        // An edge stops a little short of the rim to leave room for its arrowhead, so a
        // correctly anchored endpoint sits ~8 units out. One still anchored on the chip
        // would sit 70 out — the chip's half-width — against the dot's 16.
        const gap = await harness(page, 'edgeGapAtNode', 'hub-a', 'a')
        expect(gap, 'edge endpoint should sit on the dot it points at').toBeLessThan(ARROWHEAD_ROOM)
    })

    test('a fit frames the footprints, so it lands the same at any tier', async ({ page }) => {
        await harness(page, 'loadWithTiers')
        await waitForViewSettled(page)

        await harness(page, 'setZoomScale', DOT_ZOOM)
        expect(await tierOf(page, 'a')).toBe('0')
        await harness(page, 'fit')
        await waitForViewSettled(page)
        const fromDots = await harness(page, 'zoomScale')

        await harness(page, 'setZoomScale', CHIP_ZOOM)
        expect(await tierOf(page, 'a')).toBe('1')
        await harness(page, 'fit')
        await waitForViewSettled(page)

        // Fitting from a canvas of dots and from a canvas of chips has to answer the same,
        // or the fit's own zoom change would move the ground it measured.
        expect(await harness(page, 'zoomScale')).toBeCloseTo(fromDots, 5)
    })

    test('a graph declaring no tiers carries no tier state and keeps its own spacing', async ({ page }) => {
        await harness(page, 'loadWithTiers', { tiers: false, focus: false })
        await waitForViewSettled(page)

        expect(await tierOf(page, 'a')).toBeNull()
        expect(await harness(page, 'layoutSizeOf', 'a')).toBeUndefined()
        expect(await harness(page, 'drawnRadiusOf', 'a')).toBeGreaterThan(0)
    })
})

test.describe('focus tier', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    test('hovering shows the card', async ({ page }) => {
        await harness(page, 'loadWithTiers')
        await waitForViewSettled(page)

        // A round zoom, so the counter-scale is exact and the card's box is not a rounding
        // of one: the fit lands on whatever scale the content happens to imply.
        await harness(page, 'setZoomScale', 1)
        await nodeEl(page, 'a').hover()
        await expectCardBox(page, 'a')

        // And is put away again on the way out.
        await page.mouse.move(2, 2)
        await expect.poll(() => harness(page, 'hasFocusCard', 'a')).toBe(false)
    })

    test('the card holds its size in CSS pixels at any zoom, and across a tier swap', async ({ page }) => {
        await harness(page, 'loadWithTiers')
        await waitForViewSettled(page)

        // Selection rather than hover: the card has to survive a zoom, and a zoom takes the
        // node out from under the pointer.
        await harness(page, 'setZoomScale', DOT_ZOOM)
        await harness(page, 'selectNode', 'a')
        expect(await tierOf(page, 'a')).toBe('0')
        await expectCardBox(page, 'a')

        // Past the chip's threshold, so the node is torn down and redrawn underneath it.
        await harness(page, 'setZoomScale', CHIP_ZOOM)
        expect(await tierOf(page, 'a')).toBe('1')
        await expectCardBox(page, 'a')
    })

    test('hovering moves nothing, even with no tiers to hide behind', async ({ page }) => {
        // No `tiers`, so nothing declares a footprint: this is the case where the card would
        // otherwise write the collision radius and reheat the layout on every hover.
        await harness(page, 'loadWithTiers', { tiers: false })
        await waitForViewSettled(page)

        const drawnBefore = await harness(page, 'drawnRadiusOf', 'a')
        const before = await harness(page, 'nodePositions')

        await nodeEl(page, 'a').hover()
        expect(await harness(page, 'hasFocusCard', 'a')).toBe(true)
        await page.waitForTimeout(500) // long enough for a reheat to have moved anything

        expect(await harness(page, 'nodePositions')).toEqual(before)
        expect(await harness(page, 'drawnRadiusOf', 'a')).toBe(drawnBefore)
    })

    test('a lone selection promotes; a wider one does not', async ({ page }) => {
        await harness(page, 'loadWithTiers')
        await waitForViewSettled(page)

        await harness(page, 'selectNode', 'a')
        expect(await harness(page, 'hasFocusCard', 'a')).toBe(true)

        await harness(page, 'multiSelect', ['a', 'b'])
        expect(await harness(page, 'hasFocusCard', 'a')).toBe(false)
        expect(await harness(page, 'hasFocusCard', 'b')).toBe(false)
    })

    test("'off' suppresses the card even with a focusTier declared", async ({ page }) => {
        await harness(page, 'loadWithTiers', { trigger: 'off' })
        await waitForViewSettled(page)

        await nodeEl(page, 'a').hover()
        expect(await harness(page, 'hasFocusCard', 'a')).toBe(false)

        await harness(page, 'selectNode', 'a')
        expect(await harness(page, 'hasFocusCard', 'a')).toBe(false)
    })

    test('a fit ignores the open card', async ({ page }) => {
        await harness(page, 'loadWithTiers')
        await waitForViewSettled(page)
        await harness(page, 'fit')
        await waitForViewSettled(page)
        const withoutCard = await harness(page, 'zoomScale')

        await harness(page, 'selectNode', 'a')
        expect(await harness(page, 'hasFocusCard', 'a')).toBe(true)
        await harness(page, 'fit')
        await waitForViewSettled(page)

        expect(await harness(page, 'zoomScale')).toBeCloseTo(withoutCard, 5)
    })
})

test.describe('tier cross-fade', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    test('a crossing cross-fades: both drawings are on screen, then only the new one', async ({ page }) => {
        await harness(page, 'loadWithTiers')
        await waitForViewSettled(page)
        await harness(page, 'setZoomScale', CHIP_ZOOM)

        // `false` stops the harness waiting the fade out, so the swap is caught mid-flight.
        await harness(page, 'setZoomScale', DOT_ZOOM, false)
        expect(await harness(page, 'tierGhostCount')).toBeGreaterThan(0)

        // The node itself has already moved on; the chip still on screen is the outgoing copy.
        expect(await tierOf(page, 'a')).toBe('0')

        await expect.poll(() => harness(page, 'tierGhostCount')).toBe(0)
    })

    test('no ghost outlives its fade, however fast the zoom is driven', async ({ page }) => {
        await harness(page, 'loadWithTiers')
        await waitForViewSettled(page)

        // Crossings back to back, each landing while the last is still fading.
        for (const scale of [CHIP_ZOOM, DOT_ZOOM, CHIP_ZOOM, DOT_ZOOM]) {
            await harness(page, 'setZoomScale', scale, false)
        }

        await expect.poll(() => harness(page, 'tierGhostCount')).toBe(0)
        expect(await tierOf(page, 'a')).toBe('0')
    })

    test('tierTransition 0 swaps in one frame, with nothing left behind', async ({ page }) => {
        await harness(page, 'loadWithTiers', {}, { render: { tierTransition: 0 } })
        await waitForViewSettled(page)
        await harness(page, 'setZoomScale', CHIP_ZOOM)

        await harness(page, 'setZoomScale', DOT_ZOOM, false)
        expect(await harness(page, 'tierGhostCount')).toBe(0)
        expect(await tierOf(page, 'a')).toBe('0')
    })

    test('a node still holds its place across a cross-faded swap', async ({ page }) => {
        await harness(page, 'loadWithTiers')
        await waitForViewSettled(page)
        await harness(page, 'setZoomScale', CHIP_ZOOM)

        const before = await harness(page, 'nodePositions')
        await harness(page, 'setZoomScale', DOT_ZOOM)
        await page.waitForTimeout(400)

        // The ghost is a copy on a layer of its own: it must not reach the layout, and the
        // fade must not leave the graph re-settling once it ends.
        expect(await harness(page, 'nodePositions')).toEqual(before)
        expect(await harness(page, 'tierGhostCount')).toBe(0)
    })

    test('the focus card fades out rather than vanishing, and stops counting as the card', async ({ page }) => {
        await harness(page, 'loadWithTiers')
        await waitForViewSettled(page)

        await harness(page, 'selectNode', 'a')
        expect(await harness(page, 'hasFocusCard', 'a')).toBe(true)

        // Widening the selection demotes it. The drawing is still on screen for the fade, but
        // it is no longer the node's card, so nothing should report one.
        await harness(page, 'multiSelect', ['a', 'b'])
        expect(await harness(page, 'hasFocusCard', 'a')).toBe(false)
        expect(await harness(page, 'leavingFocusCards')).toBeGreaterThan(0)

        await expect.poll(() => harness(page, 'leavingFocusCards')).toBe(0)
    })
})
