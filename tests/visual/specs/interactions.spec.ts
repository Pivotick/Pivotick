import type { Page } from '@playwright/test'
import {
    test,
    expect,
    gotoHarness,
    loadFixture,
    harness,
    nodeEl,
    centerOf,
    canvas,
    expectElement,
    waitForViewSettled,
} from '../helpers'

/** Whether the menu sits in the fullscreened subtree — the only part the browser paints. */
const menuIsInsideFullscreen = (page: Page): Promise<boolean> =>
    page.evaluate(() =>
        Boolean(document.fullscreenElement?.contains(document.querySelector('.pvt-contextmenu')))
    )

/**
 * What a click at the menu's own centre would land on.
 *
 * An element outside the fullscreened subtree keeps its box and its computed
 * style, so `toBeVisible()` calls it visible while the browser paints and
 * hit-tests straight through it. This is the difference the eye sees.
 */
const whatIsAtMenuCentre = (page: Page): Promise<string> =>
    page.evaluate(() => {
        const menu = document.querySelector('.pvt-contextmenu')
        if (!menu) return 'no menu'
        const box = menu.getBoundingClientRect()
        const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
        return hit?.closest('.pvt-contextmenu') ? 'the menu' : (hit?.tagName.toLowerCase() ?? 'nothing')
    })

// ── Area 7 — hover, tooltip & context menu ──────────────────────────────────
// All of these are driven with *real* pointer gestures (P0.6 explicitly allows
// this in place of harness verbs): the tooltip appears on hover, the menus on a
// right-click — the gesture *is* the thing under test, and the harness already
// mounts both elements in its light mode (`buildUIGraphNavigation` wires the
// Tooltip and ContextMenu whenever their `enabled` flag is set, which it is by
// default). No new fixture or verb is needed.
//
// The tooltip and context menu are appended to `document.body`, *outside*
// `.pvt-canvas`, so each baseline screenshots that element directly
// (`expectElement`) rather than the canvas. Their *content* is a pure function
// of the node/edge/note data, but each is auto-sized and positioned at the
// gesture point — so the crop's pixel-snapped height depends on the fractional
// screen position of the hovered/clicked element. Under the settled force layout
// that position drifts a touch run-to-run (the README's known caveat), flipping
// the snapped height by a pixel. So every test `pin()`s the fixture's designed
// positions first, anchoring the gesture deterministically (the same fix Area 6
// used for its drift-sensitive scenes).
//
// T7.2 (node hover highlight) is **descoped**: there is no built-in hover effect
// on graph nodes/neighbours — `nodeHoverIn` only emits the event and opens the
// tooltip (no `:hover` styling, no highlight class). Its only visual is the
// tooltip, already covered by T7.1, so a separate baseline would be a duplicate.

test.describe('interactions', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    // T7.1 — hovering a node shows its tooltip (node preview + name + properties)
    // after the built-in show delay. The tooltip's proximity guard compares the
    // hovered-node trigger point against the last canvas mousemove, so we prime
    // the pointer just above the node, then glide onto it.
    test('shows the node tooltip on hover', async ({ page }) => {
        await loadFixture(page, 'basic')
        await harness(page, 'pin')

        const a = await centerOf(nodeEl(page, 'a'))
        await page.mouse.move(a.x, a.y - 60)
        await page.mouse.move(a.x, a.y, { steps: 10 })

        const tip = page.locator('.pvt-tooltip')
        await expect(tip).toHaveClass(/shown/)
        await expectElement(tip, 'tooltip-node.png')
    })

    // T7.3 — right-clicking a node opens the node context menu (Pin / Focus /
    // Hide quick-actions + Select Neighbors / Hide Children / Connect / Inspect).
    test('shows the node context menu', async ({ page }) => {
        await loadFixture(page, 'basic')
        await harness(page, 'pin')

        await nodeEl(page, 'a').click({ button: 'right' })

        const menu = page.locator('.pvt-contextmenu')
        await expect(menu).toHaveClass(/shown/)
        await expectElement(menu, 'contextmenu-node.png')
    })

    // T7.4 — right-clicking empty canvas opens the canvas context menu (Pin All /
    // Unpin All + Add Note). The bottom-right corner stays empty after the fit and
    // is clear of the B3 chrome (mode rail + tool panel top-left, nav top-right).
    test('shows the canvas context menu', async ({ page }) => {
        await loadFixture(page, 'basic')
        await harness(page, 'pin')

        const box = await canvas(page).boundingBox()
        if (!box) throw new Error('canvas has no bounding box')
        await page.mouse.click(box.x + box.width - 40, box.y + box.height - 40, { button: 'right' })

        const menu = page.locator('.pvt-contextmenu')
        await expect(menu).toHaveClass(/shown/)
        // Step off the menu so the baseline captures its resting look, not a hover.
        await page.mouse.move(box.x + 20, box.y + 20)
        await expectElement(menu, 'contextmenu-canvas.png')
    })

    // T7.5 — right-clicking a note opens the note context menu (Hide Note +
    // Remove Note).
    test('shows the note context menu', async ({ page }) => {
        await loadFixture(page, 'withNote')
        await harness(page, 'pin')

        await page.locator('.pvt-note').first().click({ button: 'right' })

        const menu = page.locator('.pvt-contextmenu')
        await expect(menu).toHaveClass(/shown/)
        await expectElement(menu, 'contextmenu-note.png')
    })

    // The menu is parented to the `.pivotick` root rather than `<body>`: while the
    // container is fullscreen the browser renders only its subtree, so a body-level
    // menu still had a box and its styles but was never painted, and a right-click
    // looked like it did nothing.
    test('opens the context menu while fullscreen', async ({ page }) => {
        await loadFixture(page, 'basic')
        await harness(page, 'pin')

        // Clicking the rail button is the user gesture the Fullscreen API demands.
        await page.locator('#pvt-graphnavigation-fullscreen').click()
        await expect
            .poll(() => page.evaluate(() => Boolean(document.fullscreenElement)))
            .toBe(true)
        // Going fullscreen resizes the canvas, which re-fits the view.
        await waitForViewSettled(page)

        await nodeEl(page, 'a').click({ button: 'right' })

        const fsMenu = page.locator('.pvt-contextmenu')
        await expect(fsMenu).toHaveClass(/shown/)
        expect(await menuIsInsideFullscreen(page)).toBe(true)
        expect(await whatIsAtMenuCentre(page)).toBe('the menu')
    })
})
