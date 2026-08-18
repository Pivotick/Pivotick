import {
    test,
    expect,
    gotoHarness,
    loadFixture,
    expectElement,
} from '../helpers'

// ── B3 Physics flyout ────────────────────────────────────────────────────────
// Layout + simulation used to sit in the View flyout; they now have their own
// rail mode. Verify the flyout toggles with the rail's Physics button and that
// its controls drive the real Simulation API (layout change, presets, sliders,
// run/pause), and that it excludes the View flyout.

const B3 = {}
type Page = import('@playwright/test').Page

const openFlyout = (page: Page) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    page.evaluate(() => (window.__pivotick as any).graph.UIManager.modeStore.setMode('physics'))

const knobs = (page: Page) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    page.evaluate(() => (window.__pivotick as any).graph.simulation.getPhysicsKnobs())

const simFlag = (page: Page, fn: string) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    page.evaluate((f) => (window.__pivotick as any).graph.simulation[f](), fn)

const panel = (page: Page) => page.locator('.pvt-flyout-panel.pvt-flyout-physics')

/** One of the four layout tiles that replaced the layout dropdown. */
const layoutTile = (page: Page, id: string) =>
    panel(page).locator(`.pvt-physicsflyout-layout[data-layout="${id}"]`)

test.describe('physics-flyout', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    // Closed on load; the rail's Physics button opens it.
    test('is closed until the Physics button opens it', async ({ page }) => {
        await loadFixture(page, 'basic', B3)
        await expect(panel(page)).not.toHaveClass(/open/)

        await page.locator('.pvt-moderail-button[data-mode="physics"]').click()
        await expect(panel(page)).toHaveClass(/open/)

        await expectElement(panel(page), 'physicsflyout-open.png')
    })

    // Both flyouts share a rail; opening one closes the other.
    test('opening Physics closes the View flyout', async ({ page }) => {
        await loadFixture(page, 'basic', B3)
        const view = page.locator('.pvt-flyout-panel.pvt-flyout-view')

        await page.locator('.pvt-moderail-button[data-mode="view"]').click()
        await expect(view).toHaveClass(/open/)

        await page.locator('.pvt-moderail-button[data-mode="physics"]').click()
        await expect(panel(page)).toHaveClass(/open/)
        await expect(view).not.toHaveClass(/open/)
    })

    // A preset snaps all four sliders (and the underlying knobs).
    test('applying the Loose preset sets all four sliders', async ({ page }) => {
        await loadFixture(page, 'basic', B3)
        await openFlyout(page)

        await panel(page).locator('.pvt-physicsflyout-preset[data-preset="loose"]').click()
        await expect(panel(page).locator('.pvt-physicsflyout-preset[data-preset="loose"]')).toHaveClass(/active/)

        expect(await knobs(page)).toEqual({ repulsion: 70, linkDistance: 150, collisionRadius: 26, friction: 28 })
        await expect(panel(page).locator('.pvt-physicsflyout-slider-value[data-value="repulsion"]')).toHaveText('70')
    })

    // Dragging a slider drives the setter API.
    test('moving a slider updates the simulation knob', async ({ page }) => {
        await loadFixture(page, 'basic', B3)
        await openFlyout(page)

        await panel(page).locator('.pvt-physicsflyout-range[data-slider="repulsion"]').evaluate((el: HTMLInputElement) => {
            el.value = '85'
            el.dispatchEvent(new Event('input', { bubbles: true }))
        })

        expect((await knobs(page)).repulsion).toBe(85)
        await expect(panel(page).locator('.pvt-physicsflyout-slider-value[data-value="repulsion"]')).toHaveText('85')
    })

    // The run toggle flips the simulation on/off.
    test('run toggle enables/disables physics', async ({ page }) => {
        await loadFixture(page, 'basic', B3) // harness starts with simulation disabled
        await openFlyout(page)
        expect(await simFlag(page, 'isEnabled')).toBe(false)

        await panel(page).locator('.pvt-physicsflyout-run').click()
        expect(await simFlag(page, 'isEnabled')).toBe(true)
    })

    // One click per layout: the tile switches the simulation and takes the highlight.
    test('a layout tile switches the layout in one click', async ({ page }) => {
        await loadFixture(page, 'tree', B3) // acyclic → tree layouts allowed
        await openFlyout(page)

        // Force is the layout the graph boots in, so its tile starts active.
        await expect(layoutTile(page, 'force')).toHaveClass(/active/)

        await layoutTile(page, 'tree-h').click()
        expect(await simFlag(page, 'getLayoutType')).toBe('tree')
        await expect(layoutTile(page, 'tree-h')).toHaveClass(/active/)
        await expect(layoutTile(page, 'tree-h')).toHaveAttribute('aria-pressed', 'true')
        await expect(layoutTile(page, 'force')).not.toHaveClass(/active/)

        // An acyclic graph offers all four tiles; the picked one carries the highlight.
        await expectElement(panel(page), 'physicsflyout-tree-layout.png')

        // And back: only one tile is ever active.
        await layoutTile(page, 'force').click()
        expect(await simFlag(page, 'getLayoutType')).toBe('force')
        await expect(layoutTile(page, 'force')).toHaveClass(/active/)
        await expect(layoutTile(page, 'tree-h')).not.toHaveClass(/active/)
    })

    // Presets + sliders grey out under a non-force layout (D6/D7).
    test('a tree layout greys out the physics controls', async ({ page }) => {
        await loadFixture(page, 'tree', B3) // acyclic → tree layouts allowed
        await openFlyout(page)

        await layoutTile(page, 'tree-v').click()

        await expect(panel(page).locator('.pvt-physicsflyout-card')).toHaveClass(/pvt-physicsflyout-disabled/)
        await expect(panel(page).locator('.pvt-physicsflyout-range[data-slider="repulsion"]')).toBeDisabled()
    })

    // Tree layouts are unavailable on a cyclic graph — their tiles refuse the click.
    test('tree layouts are disabled on a cyclic graph', async ({ page }) => {
        await loadFixture(page, 'basic', B3) // basic has a pentagon cycle
        await openFlyout(page)

        for (const id of ['tree-v', 'tree-h', 'tree-r']) {
            await expect(layoutTile(page, id)).toBeDisabled()
        }
        await expect(layoutTile(page, 'force')).toBeEnabled()
    })
})
