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
} from '../helpers'

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
})
