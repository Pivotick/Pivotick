import {
    test,
    expect,
    gotoHarness,
    loadFixture,
    expectElement,
} from '../helpers'

// ── B3 mode rail ─────────────────────────────────────────────────────────────
// The experimental B3 chrome (mode rail + contextual panels + View flyout) is
// gated behind `UI.experimentalB3Chrome` while the migration lands in small PRs.
// These tests opt in via that flag; the classic-chrome baselines are unaffected.
//
// The rail is a canvas overlay, so each visual assertion targets the
// `.pvt-moderail` element (per the chrome-test convention), not the whole page.

const B3 = { UI: { experimentalB3Chrome: true } }

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
        expect(await modeState(page)).toEqual({ mode: 'select', viewFlyoutOpen: false })

        await expectElement(rail, 'moderail-select.png')
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

    // View is an independent toggle — it highlights without leaving the pointer-mode.
    test('View toggles the flyout flag without changing pointer-mode', async ({ page }) => {
        await loadFixture(page, 'basic', B3)
        const rail = page.locator('.pvt-moderail')

        await rail.locator('.pvt-moderail-button[data-mode="view"]').click()

        await expect(rail.locator('.pvt-moderail-button[data-mode="view"]')).toHaveClass(/active/)
        const state = await modeState(page)
        expect(state.viewFlyoutOpen).toBe(true)
        expect(state.mode).toBe('select') // pointer-mode unchanged
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

    // Enrich is a disabled "SOON" affordance.
    test('Enrich renders disabled with a SOON badge', async ({ page }) => {
        await loadFixture(page, 'basic', B3)
        const enrich = page.locator('.pvt-moderail-button[data-mode="enrich"]')

        await expect(enrich).toBeDisabled()
        await expect(enrich.locator('.pvt-moderail-badge')).toHaveText('SOON')
    })
})
