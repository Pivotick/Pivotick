import {
    test,
    expect,
    gotoHarness,
    loadFixture,
    expectElement,
} from '../helpers'

// ── B3 View flyout ───────────────────────────────────────────────────────────
// Verify the flyout toggles with the mode rail's View button and that its
// switches drive the real Simulation API (grid snapping, freeze-on-drag, …).
// Layout + physics live in their own rail mode — see physics-flyout.spec.ts.

const B3 = {}
type Page = import('@playwright/test').Page

const openFlyout = (page: Page) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    page.evaluate(() => (window.__pivotick as any).graph.UIManager.modeStore.setMode('view'))

const simFlag = (page: Page, fn: string) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    page.evaluate((f) => (window.__pivotick as any).graph.simulation[f](), fn)

const panel = (page: Page) => page.locator('.pvt-flyout-panel.pvt-flyout-view')

test.describe('view-flyout', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    // Closed on load (D5); the rail's View button opens it.
    test('is closed until the View button opens it', async ({ page }) => {
        await loadFixture(page, 'basic', B3)
        await expect(panel(page)).not.toHaveClass(/open/)

        await page.locator('.pvt-moderail-button[data-mode="view"]').click()
        await expect(panel(page)).toHaveClass(/open/)

        await expectElement(panel(page), 'viewflyout-open.png')
    })

    // Grid + freeze toggles reflect the underlying simulation state.
    test('snap / freeze toggles drive the simulation flags', async ({ page }) => {
        await loadFixture(page, 'basic', B3)
        await openFlyout(page)

        const snap = panel(page).locator('.pvt-flyout-toggle[data-toggle="snap"]')
        expect(await simFlag(page, 'isGridSnappingEnabled')).toBe(false)
        await snap.click()
        expect(await simFlag(page, 'isGridSnappingEnabled')).toBe(true)
        await expect(snap).toHaveAttribute('aria-pressed', 'true')

        const freezeBefore = await simFlag(page, 'isFreezeNodesOnDrag')
        await panel(page).locator('.pvt-flyout-toggle[data-toggle="freeze"]').click()
        expect(await simFlag(page, 'isFreezeNodesOnDrag')).toBe(!freezeBefore)
    })

    // The grid highlight is applied to the layout root, so the canvas and the
    // transparent top-bar strip brighten together.
    test('the grid-highlight toggle marks the layout root', async ({ page }) => {
        await loadFixture(page, 'basic', B3)
        await openFlyout(page)

        const root = page.locator('.pvt-layout')
        await expect(root).not.toHaveClass(/grid-highlighted/)

        await panel(page).locator('.pvt-flyout-toggle[data-toggle="highlight"]').click()
        await expect(root).toHaveClass(/grid-highlighted/)
    })

    // Physics moved out: the View flyout carries switches only.
    test('holds no layout or physics controls', async ({ page }) => {
        await loadFixture(page, 'basic', B3)
        await openFlyout(page)

        await expect(panel(page).locator('.pvt-physicsflyout-layout-select')).toHaveCount(0)
        await expect(panel(page).locator('.pvt-physicsflyout-range')).toHaveCount(0)
        await expect(panel(page).locator('.pvt-flyout-toggle')).toHaveCount(4)
    })
})
