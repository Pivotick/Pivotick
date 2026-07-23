import {
    test,
    expect,
    gotoHarness,
    loadFixture,
    harness,
    expectElement,
} from '../helpers'

type PWPage = import('@playwright/test').Page

// ── B3 contextual tool panel ─────────────────────────────────────────────────
// Assert the panel swaps its tool-set with the active mode, that each tool
// drives the real underlying logic, and that arming a modal tool collapses the
// panel + morphs the rail slot (one-shot actions just run).

const B3 = {}

const setMode = (page: PWPage, mode: string) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    page.evaluate((m) => (window.__pivotick as any).graph.UIManager.modeStore.setMode(m), mode)

const connectActive = (page: PWPage) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    page.evaluate(() => (window.__pivotick as any).graph.editing.connectManager.isActive())

// The armed edit tool drives the canvas cursor (crosshair to pick a source /
// arm the lasso, copy once a source is chosen) — a resolved computed value,
// not the class the TS toggles, since the class survived but its CSS didn't.
const canvasCursor = (page: PWPage) =>
    page.evaluate(() => getComputedStyle(document.querySelector('.pvt-canvas')!).cursor)

const armedTool = (page: PWPage, mode: string) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    page.evaluate((m) => (window.__pivotick as any).graph.UIManager.modeStore.getArmedTool(m), mode)

/** Trimmed label text of a rail mode slot (reflects the armed tool). */
const railLabel = async (page: PWPage, mode: string) =>
    ((await page.locator(`.pvt-moderail-button[data-mode="${mode}"] .pvt-moderail-label`).textContent()) ?? '').trim()

/** The collapsible panel box (the `.pvt-collapsed`-bearing element). */
const panelBox = (page: PWPage) => page.locator('.pvt-toolpanel-panel')
/** A mode rail slot — clicking the active one toggles its panel. */
const railSlot = (page: PWPage, mode: string) => page.locator(`.pvt-moderail-button[data-mode="${mode}"]`)

test.describe('tool-panel', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    test('Select mode shows its tool-set with Pointer active', async ({ page }) => {
        await loadFixture(page, 'basic', B3)
        const panel = page.locator('.pvt-toolpanel')

        await expect(panel.locator('.pvt-toolpanel-header')).toContainText('Select')
        await expect(panel.locator('.pvt-toolpanel-header .pvt-keyboard-shortcut')).toHaveText('V')
        await expect(panel.locator('.pvt-toolpanel-tool')).toHaveCount(4)
        await expect(panel.locator('.pvt-toolpanel-tool[data-tool="pointer"]')).toHaveClass(/active/)
        await expect(panel.locator('.pvt-toolpanel-tool[data-tool="path"]')).toBeDisabled()

        await expectElement(panel, 'toolpanel-select.png')
    })

    test('switching to Create swaps the tool-set', async ({ page }) => {
        await loadFixture(page, 'basic', B3)
        await setMode(page, 'create')
        const panel = page.locator('.pvt-toolpanel')

        await expect(panel.locator('.pvt-toolpanel-header')).toContainText('Create')
        await expect(panel.locator('.pvt-toolpanel-header .pvt-keyboard-shortcut')).toHaveText('C')
        await expect(panel.locator('.pvt-toolpanel-tool[data-tool="add-edge"]')).toBeVisible()
        await expect(panel.locator('.pvt-toolpanel-tool[data-tool="add-node"]')).toBeDisabled()

        await expectElement(panel, 'toolpanel-create.png')
    })

    test('Lasso arms lasso mode, collapses the panel, and morphs the rail slot', async ({ page }) => {
        await loadFixture(page, 'basic', B3)

        await page.locator('.pvt-toolpanel-tool[data-tool="lasso"]').click()
        // armed on the canvas + cursor; the panel collapses; the rail reads "Lasso"
        await expect(page.locator('.pvt-canvas')).toHaveClass(/canvas--lasso-mode/)
        expect(await canvasCursor(page)).toBe('crosshair')
        await expect(panelBox(page)).toHaveClass(/pvt-collapsed/)
        expect(await armedTool(page, 'select')).toBe('lasso')
        expect(await railLabel(page, 'select')).toBe('Lasso')

        // Re-open via the rail slot, then Pointer disarms + collapses to neutral.
        await railSlot(page, 'select').click()
        await expect(panelBox(page)).not.toHaveClass(/pvt-collapsed/)
        await page.locator('.pvt-toolpanel-tool[data-tool="pointer"]').click()
        await expect(page.locator('.pvt-canvas')).not.toHaveClass(/canvas--lasso-mode/)
        expect(await canvasCursor(page)).not.toBe('crosshair')
        await expect(panelBox(page)).toHaveClass(/pvt-collapsed/)
        expect(await railLabel(page, 'select')).toBe('Select')
    })

    test('Invert selects the complement of the current selection', async ({ page }) => {
        await loadFixture(page, 'basic', B3)
        await harness(page, 'selectNode', 'a')

        // A one-shot action: it runs and leaves the panel open (not collapsed).
        await page.locator('.pvt-toolpanel-tool[data-tool="invert"]').click()
        await expect(panelBox(page)).not.toHaveClass(/pvt-collapsed/)

        const ids = (await harness(page, 'selectedNodeIds')) as string[]
        expect(ids).not.toContain('a')
        expect([...ids].sort()).toEqual(['b', 'c', 'd', 'e', 'hub'])
    })

    test('Add edge arms the connect session, collapses, and Escape cancels it', async ({ page }) => {
        await loadFixture(page, 'basic', B3)
        await setMode(page, 'create')

        await page.locator('.pvt-toolpanel-tool[data-tool="add-edge"]').click()
        expect(await connectActive(page)).toBe(true)
        await expect(panelBox(page)).toHaveClass(/pvt-collapsed/)
        expect(await armedTool(page, 'create')).toBe('add-edge')
        expect(await railLabel(page, 'create')).toBe('Edge')

        // Escape cancels the session and reverts the rail slot to "Create".
        await page.locator('.pivotick').focus()
        await page.keyboard.press('Escape')
        expect(await connectActive(page)).toBe(false)
        expect(await armedTool(page, 'create')).toBe(null)
        expect(await railLabel(page, 'create')).toBe('Create')
    })

    test('Add note creates a note on the canvas', async ({ page }) => {
        await loadFixture(page, 'basic', B3)
        await setMode(page, 'create')

        const before = (await harness(page, 'counts')) as { notes: number }
        await page.locator('.pvt-toolpanel-tool[data-tool="add-note"]').click()
        const after = (await harness(page, 'counts')) as { notes: number }

        expect(after.notes).toBe(before.notes + 1)
    })

    test('collapse state persists per mode across switches', async ({ page }) => {
        await loadFixture(page, 'basic', B3)

        // Collapse Select (Pointer = collapse-to-neutral).
        await page.locator('.pvt-toolpanel-tool[data-tool="pointer"]').click()
        await expect(panelBox(page)).toHaveClass(/pvt-collapsed/)

        // Create is open by default.
        await setMode(page, 'create')
        await expect(panelBox(page)).not.toHaveClass(/pvt-collapsed/)

        // Returning to Select restores its collapsed state.
        await setMode(page, 'select')
        await expect(panelBox(page)).toHaveClass(/pvt-collapsed/)
    })

    test('View mode collapses the tool panel', async ({ page }) => {
        await loadFixture(page, 'basic', B3)
        await expect(panelBox(page)).not.toHaveClass(/pvt-collapsed/)

        await setMode(page, 'view')
        await expect(panelBox(page)).toHaveClass(/pvt-collapsed/)

        await setMode(page, 'select')
        await expect(panelBox(page)).not.toHaveClass(/pvt-collapsed/)
    })
})
