import {
    test,
    expect,
    gotoHarness,
    loadFixture,
    expectElement,
} from '../helpers'

// ── B3 mode rail ─────────────────────────────────────────────────────────────
// The B3 chrome (mode rail + contextual panels + View flyout) is the default
// full/light chrome.
//
// The rail is a canvas overlay, so each visual assertion targets the
// `.pvt-moderail` element (per the chrome-test convention), not the whole page.

// Enable both coming-soon data-zone modes so the rail exercises their SOON
// slots. They're hidden by default (opt-in) — see the "hidden by default" test.
const B3 = { UI: { modeRail: { explore: true, enrich: true } } }

/** Current mode-store state, read from the live graph. */
async function modeState(page: import('@playwright/test').Page) {
    return page.evaluate(() =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window.__pivotick as any).graph.UIManager.modeStore.getState()
    )
}

test.describe('mode-rail', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    // Default landing: Select active, View flyout closed (PRD D5).
    test('renders with Select active by default', async ({ page }) => {
        await loadFixture(page, 'basic', B3)

        const rail = page.locator('.pvt-moderail')
        await expect(rail.locator('.pvt-moderail-button[data-mode="select"]')).toHaveClass(/active/)
        await expect(rail.locator('.pvt-moderail-button[data-mode="create"]')).not.toHaveClass(/active/)
        expect((await modeState(page)).mode).toBe('select')

        await expectElement(rail, 'moderail-select.png')
    })

    // The Select/Create slots are split-buttons: arming a modal tool morphs the
    // active slot's icon + label (e.g. Select → Lasso).
    test('arming a tool morphs the active mode slot', async ({ page }) => {
        await loadFixture(page, 'basic', B3)
        // Select boots collapsed; open it so the Lasso tool is clickable.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await page.evaluate(() => (window.__pivotick as any).graph.UIManager.modeStore.setPanelOpen('select', true))
        const rail = page.locator('.pvt-moderail')
        const selectLabel = rail.locator('.pvt-moderail-button[data-mode="select"] .pvt-moderail-label')

        await expect(selectLabel).toHaveText('Select')
        await page.locator('.pvt-toolpanel-tool[data-tool="lasso"]').click()
        await expect(selectLabel).toHaveText('Lasso')

        await expectElement(rail, 'moderail-lasso.png')
    })

    // Clicking Create makes it the exclusive active pointer-mode.
    test('clicking Create switches the active mode', async ({ page }) => {
        await loadFixture(page, 'basic', B3)
        const rail = page.locator('.pvt-moderail')

        await rail.locator('.pvt-moderail-button[data-mode="create"]').click()

        await expect(rail.locator('.pvt-moderail-button[data-mode="create"]')).toHaveClass(/active/)
        await expect(rail.locator('.pvt-moderail-button[data-mode="select"]')).not.toHaveClass(/active/)
        expect((await modeState(page)).mode).toBe('create')

        await expectElement(rail, 'moderail-create.png')
    })

    // View is its own exclusive mode: activating it deactivates Select/Create,
    // and toggling it off returns to the previous pointer-mode.
    test('View is an exclusive mode; Select/Create switch off', async ({ page }) => {
        await loadFixture(page, 'basic', B3)
        const rail = page.locator('.pvt-moderail')
        const view = rail.locator('.pvt-moderail-button[data-mode="view"]')
        const select = rail.locator('.pvt-moderail-button[data-mode="select"]')

        await view.click()
        await expect(view).toHaveClass(/active/)
        await expect(select).not.toHaveClass(/active/)
        expect((await modeState(page)).mode).toBe('view')

        // Toggling View off returns to the previous pointer-mode (Select).
        await view.click()
        await expect(view).not.toHaveClass(/active/)
        await expect(select).toHaveClass(/active/)
        expect((await modeState(page)).mode).toBe('select')
    })

    // Keyboard: V → Select, C → Create (focus-gated key manager).
    test('V / C keys switch pointer-mode', async ({ page }) => {
        await loadFixture(page, 'basic', B3)
        await page.locator('.pivotick').focus()

        await page.keyboard.press('c')
        expect((await modeState(page)).mode).toBe('create')

        await page.keyboard.press('v')
        expect((await modeState(page)).mode).toBe('select')
    })

    // Explore and Enrich are disabled "SOON" affordances when enabled, ordered
    // Explore-then-Enrich after the divider (Explore sits between View and Enrich).
    test('Explore and Enrich render disabled with SOON badges', async ({ page }) => {
        await loadFixture(page, 'basic', B3)
        for (const mode of ['explore', 'enrich']) {
            const soon = page.locator(`.pvt-moderail-button[data-mode="${mode}"]`)
            await expect(soon).toBeDisabled()
            await expect(soon.locator('.pvt-moderail-badge')).toHaveText('SOON')
        }
    })

    // The coming-soon modes are opt-in: disabling them (as the library does by
    // default) drops the data zone — divider + Explore/Enrich — entirely.
    // (The shared harness opts Enrich in, so this test overrides both off.)
    test('disabled coming-soon modes drop the data zone', async ({ page }) => {
        await loadFixture(page, 'basic', { UI: { modeRail: { explore: false, enrich: false } } })
        await expect(page.locator('.pvt-moderail-button[data-mode="explore"]')).toHaveCount(0)
        await expect(page.locator('.pvt-moderail-button[data-mode="enrich"]')).toHaveCount(0)
        await expect(page.locator('.pvt-moderail-divider')).toHaveCount(0)
    })
})
