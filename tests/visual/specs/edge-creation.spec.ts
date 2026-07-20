import type { Page } from '@playwright/test'
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

const SHADOW_EDGE = '.pvt-shadow-edge'

/**
 * Assert the shadow-edge preview is drawn and on-screen. `toBeVisible()` is
 * unreliable here: a horizontal preview line has a zero-height bounding box, which
 * Playwright treats as hidden — so instead check the path data is set (showShadowEdge
 * ran) and the element isn't `display:none` (not cleared).
 */
async function expectShadowShown(page: Page): Promise<void> {
    const shadow = canvas(page).locator(SHADOW_EDGE)
    await expect(shadow).toHaveAttribute('d', /^\s*M/)
    await expect(shadow).not.toHaveCSS('display', 'none')
}

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
        await expectShadowShown(page)
        await expectCanvas(page, 'shadow-link-preview.png')

        // Picking the second node commits the edge.
        await harness(page, 'pickConnectNode', 'b')
        const counts = (await harness(page, 'counts')) as { edges: number }
        expect(counts.edges).toBe(1)
        await expectCanvas(page, 'edge-committed.png')
    })
})

// ── Area 10 — edge creation, drag gestures ───────────────────────────────────
// The block above covers edge creation through the editing layer and the
// *click*-to-connect preview. This block adds the *drag*-to-connect gesture
// (pointer-down on a node, drag the shadow edge, drop on a target) and its Escape
// cancel — driven with real pointer/keyboard events, since the in-progress shadow
// edge *is* the thing under test.
//
// Setup choices:
//  - `render.dragEnabled:false` anchors the *source* node. In the app, node-drag
//    is gated off while a connection is in progress (Simulation's drag filter
//    returns false once `connectManager.isActiveAndNotIdle()`), so the source
//    stays put as you pull the shadow edge from it. Disabling the renderer's drag
//    behaviour reproduces that end-state without racing d3-drag's own gesture
//    against the session's pending-drag on the very first press.
//  - `startEdgeConnect` enters the node→edge mode the gesture needs: unlike
//    `startClickConnect` it wires the node pointer-down handler that begins a drag
//    connection (and mirrors the app's pan-suppression while connecting).
//  - `pin` fixes the two nodes at their fixture coordinates, so the gesture
//    targets and the snapshot are a pure function of the fixture.
//
// The shadow edge carries an infinite dash animation (`pvt-shadow-dash`);
// Playwright's `animations:'disabled'` freezes it to its initial frame, so it's
// deterministic (the `shadow-link-preview` baseline above relies on the same).

test.describe('edge creation — drag gestures', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
        await loadFixture(page, 'pair', { render: { dragEnabled: false } })
        await harness(page, 'pin')
        await harness(page, 'startEdgeConnect')
    })

    // T10.1 — pressing on A and dragging toward B (past the 4px threshold) shows
    // the shadow-edge preview mid-drag. Stop in the empty gap between the nodes so
    // it's a clean straight preview snapped to neither; snapshot before releasing.
    test('previews the shadow edge while dragging from a node', async ({ page }) => {
        const a = await centerOf(nodeEl(page, 'a'))
        const b = await centerOf(nodeEl(page, 'b'))
        const mid = { x: (a.x + b.x) / 2, y: a.y }

        await page.mouse.move(a.x, a.y)
        await page.mouse.down()
        await page.mouse.move(mid.x, mid.y, { steps: 10 })

        await expectShadowShown(page)
        await expectCanvas(page, 'drag-connect-preview.png')

        await page.mouse.up()
    })

    // T10.2a — dropping onto a node: dragging the cursor over B (within the 30px
    // snap radius) anchors the shadow edge to B's centre (an arc ending at B's rim
    // with the arrowhead). Releasing then commits the edge — proving the cursor
    // was within snap range, not just that the preview looked snapped.
    test('snaps the shadow edge to a node within range', async ({ page }) => {
        const a = await centerOf(nodeEl(page, 'a'))
        const b = await centerOf(nodeEl(page, 'b'))

        await page.mouse.move(a.x, a.y)
        await page.mouse.down()
        await page.mouse.move(b.x, b.y, { steps: 12 })

        await expectShadowShown(page)
        await expectCanvas(page, 'drag-target-valid.png')

        await page.mouse.up()
        const counts = (await harness(page, 'counts')) as { edges: number }
        expect(counts.edges).toBe(1)
    })

    // T10.2b — over empty canvas (no node within 30px) the shadow edge has no
    // target and follows the bare cursor. Up-and-over from the midline so the line
    // is plainly diagonal (distinct from T10.1's horizontal preview); releasing
    // commits nothing, proving there was no target.
    test('tracks the bare cursor over empty canvas', async ({ page }) => {
        const a = await centerOf(nodeEl(page, 'a'))
        const b = await centerOf(nodeEl(page, 'b'))
        const empty = { x: (a.x + b.x) / 2, y: a.y - 200 }

        await page.mouse.move(a.x, a.y)
        await page.mouse.down()
        await page.mouse.move(empty.x, empty.y, { steps: 12 })

        await expectShadowShown(page)
        await expectCanvas(page, 'drag-target-empty.png')

        await page.mouse.up()
        const counts = (await harness(page, 'counts')) as { edges: number }
        expect(counts.edges).toBe(0)
    })

    // T10.3 — Escape cancels an in-progress connection: the shadow edge is removed
    // and the canvas's connect-mode classes are cleared (no edge committed).
    // Escape is the toolbar's own keybinding (the toolbar is mounted in the
    // harness's light mode); the KeybindingManager only fires while the container
    // owns focus, so focus `.pivotick` first.
    test('cancels an in-progress connection on Escape', async ({ page }) => {
        const a = await centerOf(nodeEl(page, 'a'))
        const b = await centerOf(nodeEl(page, 'b'))
        const mid = { x: (a.x + b.x) / 2, y: a.y }

        await page.mouse.move(a.x, a.y)
        await page.mouse.down()
        await page.mouse.move(mid.x, mid.y, { steps: 10 })

        const shadow = canvas(page).locator(SHADOW_EDGE)
        await expectShadowShown(page)
        await expect(canvas(page)).toHaveClass(/pvt-connect-mode-active/)

        await page.locator('.pivotick').focus()
        await page.keyboard.press('Escape')

        await expect(shadow).toBeHidden()
        await expect(canvas(page)).not.toHaveClass(/pvt-connect-mode-active/)

        await page.mouse.up()
        const counts = (await harness(page, 'counts')) as { edges: number }
        expect(counts.edges).toBe(0)
        await expectCanvas(page, 'connect-cancelled.png')
    })
})
