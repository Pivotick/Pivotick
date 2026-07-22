import {
    test,
    expect,
    gotoHarness,
    loadFixture,
    expectElement,
} from '../helpers'

// ── B3 View flyout ───────────────────────────────────────────────────────────
// Verify the flyout toggles with the mode rail's View button and that its
// controls drive the real Simulation API (layout change, physics
// presets/sliders/run, grid + freeze toggles).

const B3 = {}
type Page = import('@playwright/test').Page

const openFlyout = (page: Page) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    page.evaluate(() => (window.__pivotick as any).graph.UIManager.modeStore.setMode('view'))

const knobs = (page: Page) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    page.evaluate(() => (window.__pivotick as any).graph.simulation.getPhysicsKnobs())

const simFlag = (page: Page, fn: string) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    page.evaluate((f) => (window.__pivotick as any).graph.simulation[f](), fn)

test.describe('view-flyout', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    // Closed on load (D5); the rail's View button opens it.
    test('is closed until the View button opens it', async ({ page }) => {
        await loadFixture(page, 'basic', B3)
        const panel = page.locator('.pvt-viewflyout-panel')
        await expect(panel).not.toHaveClass(/open/)

        await page.locator('.pvt-moderail-button[data-mode="view"]').click()
        await expect(panel).toHaveClass(/open/)

        await expectElement(panel, 'viewflyout-open.png')
    })

    // A preset snaps all four sliders (and the underlying knobs).
    test('applying the Loose preset sets all four sliders', async ({ page }) => {
        await loadFixture(page, 'basic', B3)
        await openFlyout(page)

        await page.locator('.pvt-viewflyout-preset[data-preset="loose"]').click()
        await expect(page.locator('.pvt-viewflyout-preset[data-preset="loose"]')).toHaveClass(/active/)

        expect(await knobs(page)).toEqual({ repulsion: 70, linkDistance: 150, collisionRadius: 26, friction: 28 })
        await expect(page.locator('.pvt-viewflyout-slider-value[data-value="repulsion"]')).toHaveText('70')
    })

    // Dragging a slider drives the setter API.
    test('moving a slider updates the simulation knob', async ({ page }) => {
        await loadFixture(page, 'basic', B3)
        await openFlyout(page)

        await page.locator('.pvt-viewflyout-range[data-slider="repulsion"]').evaluate((el: HTMLInputElement) => {
            el.value = '85'
            el.dispatchEvent(new Event('input', { bubbles: true }))
        })

        expect((await knobs(page)).repulsion).toBe(85)
        await expect(page.locator('.pvt-viewflyout-slider-value[data-value="repulsion"]')).toHaveText('85')
    })

    // The run toggle flips the simulation on/off.
    test('run toggle enables/disables physics', async ({ page }) => {
        await loadFixture(page, 'basic', B3) // harness starts with simulation disabled
        await openFlyout(page)
        expect(await simFlag(page, 'isEnabled')).toBe(false)

        await page.locator('.pvt-viewflyout-run').click()
        expect(await simFlag(page, 'isEnabled')).toBe(true)
    })

    // Physics presets + sliders grey out under a non-force layout (D6/D7).
    test('a tree layout greys out the physics controls', async ({ page }) => {
        await loadFixture(page, 'tree', B3) // acyclic → tree layouts allowed
        await openFlyout(page)

        await page.locator('.pvt-viewflyout-layout-select').selectOption('tree-v')

        await expect(page.locator('.pvt-viewflyout-physics')).toHaveClass(/pvt-viewflyout-disabled/)
        await expect(page.locator('.pvt-viewflyout-range[data-slider="repulsion"]')).toBeDisabled()
    })

    // Tree layouts are unavailable on a cyclic graph.
    test('tree layouts are disabled on a cyclic graph', async ({ page }) => {
        await loadFixture(page, 'basic', B3) // basic has a pentagon cycle
        await openFlyout(page)
        const treeDisabled = await page
            .locator('.pvt-viewflyout-layout-select option[value="tree-v"]')
            .evaluate((o: HTMLOptionElement) => o.disabled)
        expect(treeDisabled).toBe(true)
    })

    // Grid + freeze toggles reflect the underlying simulation state.
    test('snap / freeze toggles drive the simulation flags', async ({ page }) => {
        await loadFixture(page, 'basic', B3)
        await openFlyout(page)

        const snap = page.locator('.pvt-viewflyout-toggle[data-toggle="snap"]')
        expect(await simFlag(page, 'isGridSnappingEnabled')).toBe(false)
        await snap.click()
        expect(await simFlag(page, 'isGridSnappingEnabled')).toBe(true)
        await expect(snap).toHaveAttribute('aria-pressed', 'true')

        const freezeBefore = await simFlag(page, 'isFreezeNodesOnDrag')
        await page.locator('.pvt-viewflyout-toggle[data-toggle="freeze"]').click()
        expect(await simFlag(page, 'isFreezeNodesOnDrag')).toBe(!freezeBefore)
    })
})
