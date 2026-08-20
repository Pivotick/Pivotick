import {
    test,
    expect,
    gotoHarness,
    loadFixture,
    expectElement,
    harness,
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

/** The tree-spacing card, which stands in for the greyed-out simulation knobs. */
const spacingCard = (page: Page) => panel(page).locator('.pvt-physicsflyout-spacing')

const spacingSlider = (page: Page, key: string) =>
    panel(page).locator(`.pvt-physicsflyout-range[data-spacing="${key}"]`)

const treeSpacing = (page: Page) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    page.evaluate(() => (window.__pivotick as any).graph.simulation.getTreeSpacing())

const autoSpacingOn = (page: Page) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    page.evaluate(() => (window.__pivotick as any).graph.simulation.isAutoTreeSpacingEnabled())

const autoSpacingButton = (page: Page) => panel(page).locator('.pvt-physicsflyout-autospacing')

/** Drag a range input to `value` the way a user would: `input`, then release. */
const drag = (locator: import('@playwright/test').Locator, value: string) =>
    locator.evaluate((el: HTMLInputElement, v: string) => {
        el.value = v
        el.dispatchEvent(new Event('input', { bubbles: true }))
        el.dispatchEvent(new Event('change', { bubbles: true }))
    }, value)

/** How tall the laid-out graph is, in graph coordinates. */
const graphHeight = async (page: Page) => {
    const positions = (await harness(page, 'nodePositions')) as Record<string, { x: number; y: number }>
    const ys = Object.values(positions).map(p => p.y)
    return Math.max(...ys) - Math.min(...ys)
}

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

    // A preset snaps every slider (and the underlying knobs).
    test('applying the Loose preset sets every slider', async ({ page }) => {
        await loadFixture(page, 'basic', B3)
        await openFlyout(page)

        await panel(page).locator('.pvt-physicsflyout-preset[data-preset="loose"]').click()
        await expect(panel(page).locator('.pvt-physicsflyout-preset[data-preset="loose"]')).toHaveClass(/active/)

        expect(await knobs(page)).toEqual({
            repulsion: 70, linkDistance: 150, collisionRadius: 26, friction: 28, centering: 7, settleTime: 2.25,
        })
        await expect(panel(page).locator('.pvt-physicsflyout-slider-value[data-value="repulsion"]')).toHaveText('70')
        await expect(panel(page).locator('.pvt-physicsflyout-slider-value[data-value="settleTime"]')).toHaveText('2.25s')
    })

    // Tight's `friction` and `settleTime` are load-bearing rather than cosmetic: 58 against
    // a 2.25s settle was the heaviest damping in the set paired with the shortest run, and
    // a click reached only 60% of the way to where tight actually settles. Pinned here so
    // the pair cannot drift back apart. See prd/physics-preset-reheat.md.
    test('applying the Tight preset sets every slider', async ({ page }) => {
        await loadFixture(page, 'basic', B3)
        await openFlyout(page)

        await panel(page).locator('.pvt-physicsflyout-preset[data-preset="tight"]').click()
        await expect(panel(page).locator('.pvt-physicsflyout-preset[data-preset="tight"]')).toHaveClass(/active/)

        expect(await knobs(page)).toEqual({
            repulsion: 32, linkDistance: 70, collisionRadius: 16, friction: 45, centering: 7, settleTime: 3,
        })
        await expect(panel(page).locator('.pvt-physicsflyout-slider-value[data-value="settleTime"]')).toHaveText('3s')
    })

    // The preset row is [Auto] [Tight] [Loose] — "Default" is gone; Auto *is* the default.
    test('the preset row offers Auto, Tight and Loose', async ({ page }) => {
        await loadFixture(page, 'basic', B3)
        await openFlyout(page)

        const presets = panel(page).locator('.pvt-physicsflyout-preset')
        await expect(presets).toHaveCount(3)
        for (const name of ['auto', 'tight', 'loose']) {
            await expect(panel(page).locator(`.pvt-physicsflyout-preset[data-preset="${name}"]`)).toBeVisible()
        }
        await expect(panel(page).locator('.pvt-physicsflyout-preset[data-preset="default"]')).toHaveCount(0)
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

    // Presets + sliders go inert under a non-force layout (D6/D7) — and out of
    // sight, since the spacing card takes over the same job.
    test('a tree layout puts the physics controls away', async ({ page }) => {
        await loadFixture(page, 'tree', B3) // acyclic → tree layouts allowed
        await openFlyout(page)

        await layoutTile(page, 'tree-v').click()

        await expect(panel(page).locator('.pvt-physicsflyout-card')).toHaveClass(/pvt-physicsflyout-disabled/)
        await expect(panel(page).locator('.pvt-physicsflyout-range[data-slider="repulsion"]')).toBeDisabled()
        await expect(panel(page).locator('.pvt-physicsflyout-slider[data-row="repulsion"]')).toBeHidden()
        await expect(panel(page).locator('.pvt-physicsflyout-presets')).toBeHidden()
        // The run/pause toggle still applies to a tree's relaxation, so it stays — as does
        // the collision knob, which a tree does not zero (see its own test below).
        await expect(panel(page).locator('.pvt-physicsflyout-run')).toBeVisible()
    })

    // A tree layout ignores the physics knobs, so it offers its own distances instead.
    test('a tree layout swaps the physics knobs for spacing controls', async ({ page }) => {
        await loadFixture(page, 'tree', B3)
        await openFlyout(page)
        await expect(spacingCard(page)).toBeHidden()

        await layoutTile(page, 'tree-v').click()
        await expect(spacingCard(page)).toBeVisible()
        await expect(spacingSlider(page, 'levelSpacing')).toBeEnabled()
        await expectElement(panel(page), 'physicsflyout-tree-spacing.png')

        // Back on force, the physics knobs are the spacing controls again.
        await layoutTile(page, 'force').click()
        await expect(spacingCard(page)).toBeHidden()
    })

    // The slider drives the real layout: the tree comes out twice as deep.
    test('the level distance slider re-lays-out the tree further apart', async ({ page }) => {
        await loadFixture(page, 'tree', B3)
        await openFlyout(page)
        await layoutTile(page, 'tree-v').click()
        const fitted = await graphHeight(page)

        await drag(spacingSlider(page, 'levelSpacing'), '2')

        expect((await treeSpacing(page)).levelSpacing).toBe(2)
        await expect(panel(page).locator('.pvt-physicsflyout-slider-value[data-value="levelSpacing"]')).toHaveText('2×')
        expect(await graphHeight(page) / fitted).toBeGreaterThan(1.9)
    })

    // Switching orientation rebuilds the layout — the spacing has to survive it.
    test('spacing survives a switch to another tree orientation', async ({ page }) => {
        await loadFixture(page, 'tree', B3)
        await openFlyout(page)
        await layoutTile(page, 'tree-v').click()
        await drag(spacingSlider(page, 'levelSpacing'), '2.5')

        await layoutTile(page, 'tree-h').click()

        expect((await treeSpacing(page)).levelSpacing).toBe(2.5)
        await expect(spacingSlider(page, 'levelSpacing')).toHaveValue('2.5')
    })

    // The radial layout spreads every level over the full circle, so sibling
    // distance has nothing left to widen — its slider says so.
    test('the radial layout offers only level distance', async ({ page }) => {
        await loadFixture(page, 'tree', B3)
        await openFlyout(page)

        await layoutTile(page, 'tree-r').click()
        await expect(spacingSlider(page, 'levelSpacing')).toBeEnabled()
        await expect(spacingSlider(page, 'siblingSpacing')).toBeDisabled()

        await layoutTile(page, 'tree-v').click()
        await expect(spacingSlider(page, 'siblingSpacing')).toBeEnabled()
    })

    // Auto is where a tree's spacing starts, and a slider takes it over.
    test('dragging a spacing slider leaves Auto; the Auto button takes it back', async ({ page }) => {
        await loadFixture(page, 'tree', B3)
        await openFlyout(page)
        await layoutTile(page, 'tree-v').click()
        expect(await autoSpacingOn(page)).toBe(true)
        await expect(autoSpacingButton(page)).toHaveClass(/active/)

        await drag(spacingSlider(page, 'levelSpacing'), '3')
        expect(await autoSpacingOn(page)).toBe(false)
        await expect(autoSpacingButton(page)).not.toHaveClass(/active/)
        expect((await treeSpacing(page)).levelSpacing).toBe(3)

        await autoSpacingButton(page).click()
        expect(await autoSpacingOn(page)).toBe(true)
        await expect(autoSpacingButton(page)).toHaveClass(/active/)
        // Auto's answer for this small graph is the fitted layout, and the slider follows it.
        expect((await treeSpacing(page)).levelSpacing).toBe(1)
        await expect(spacingSlider(page, 'levelSpacing')).toHaveValue('1')
    })

    // A cycle used to disable all three tree tiles; the layout is built from a spanning
    // tree now, so they are offered like any other graph.
    test('tree layouts are offered on a cyclic graph', async ({ page }) => {
        await loadFixture(page, 'basic', B3) // basic has a pentagon cycle
        await openFlyout(page)

        for (const id of ['tree-v', 'tree-h', 'tree-r']) {
            await expect(layoutTile(page, id)).toBeEnabled()
        }

        await layoutTile(page, 'tree-v').click()
        expect(await simFlag(page, 'getLayoutType')).toBe('tree')
        await expect(layoutTile(page, 'tree-v')).toHaveClass(/active/)
    })

    // Collision is the one force a tree layout does not zero, so its knob stays live —
    // except under the radial layout, which pins both axes and leaves it nothing to push.
    test('collision radius stays live under a tree, except a radial one', async ({ page }) => {
        await loadFixture(page, 'tree', B3)
        await openFlyout(page)

        await layoutTile(page, 'tree-v').click()
        const collision = panel(page).locator('.pvt-physicsflyout-range[data-slider="collisionRadius"]')
        await expect(collision).toBeEnabled()
        await expect(collision).toBeVisible()
        // …while the knobs a tree really does ignore are gone.
        await expect(panel(page).locator('.pvt-physicsflyout-range[data-slider="repulsion"]')).toBeHidden()

        // And it still drives the simulation from there.
        await drag(collision, '40')
        expect((await knobs(page)).collisionRadius).toBe(40)

        await layoutTile(page, 'tree-r').click()
        await expect(collision).toBeDisabled()

        await layoutTile(page, 'force').click()
        await expect(panel(page).locator('.pvt-physicsflyout-range[data-slider="repulsion"]')).toBeVisible()
    })
})
