import {
    test,
    expect,
    gotoHarness,
    loadFixture,
    harness,
    expectElement,
} from '../helpers'

// ── B3 contextual tool panel ─────────────────────────────────────────────────
// Opt into the experimental B3 chrome; assert the panel swaps its tool-set with
// the active mode and that each tool drives the real underlying logic.

const B3 = { UI: { experimentalB3Chrome: true } }

const setMode = (page: import('@playwright/test').Page, mode: string) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    page.evaluate((m) => (window.__pivotick as any).graph.UIManager.modeStore.setMode(m), mode)

const connectActive = (page: import('@playwright/test').Page) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    page.evaluate(() => (window.__pivotick as any).graph.editing.connectManager.isActive())

test.describe('tool-panel', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    test('Select mode shows its tool-set with Pointer active', async ({ page }) => {
        await loadFixture(page, 'basic', B3)
        const panel = page.locator('.pvt-toolpanel')

        await expect(panel.locator('.pvt-toolpanel-header')).toContainText('Select')
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
        await expect(panel.locator('.pvt-toolpanel-tool[data-tool="add-edge"]')).toBeVisible()
        await expect(panel.locator('.pvt-toolpanel-tool[data-tool="add-node"]')).toBeDisabled()

        await expectElement(panel, 'toolpanel-create.png')
    })

    test('Lasso arms lasso mode on the canvas', async ({ page }) => {
        await loadFixture(page, 'basic', B3)
        const panel = page.locator('.pvt-toolpanel')

        await panel.locator('.pvt-toolpanel-tool[data-tool="lasso"]').click()
        await expect(panel.locator('.pvt-toolpanel-tool[data-tool="lasso"]')).toHaveClass(/active/)
        await expect(page.locator('.pvt-canvas')).toHaveClass(/canvas--lasso-mode/)

        // Clicking Pointer disarms it again.
        await panel.locator('.pvt-toolpanel-tool[data-tool="pointer"]').click()
        await expect(page.locator('.pvt-canvas')).not.toHaveClass(/canvas--lasso-mode/)
    })

    test('Invert selects the complement of the current selection', async ({ page }) => {
        await loadFixture(page, 'basic', B3)
        await harness(page, 'selectNode', 'a')

        await page.locator('.pvt-toolpanel-tool[data-tool="invert"]').click()

        const ids = (await harness(page, 'selectedNodeIds')) as string[]
        expect(ids).not.toContain('a')
        expect([...ids].sort()).toEqual(['b', 'c', 'd', 'e', 'hub'])
    })

    test('Add edge toggles the connect session', async ({ page }) => {
        await loadFixture(page, 'basic', B3)
        await setMode(page, 'create')
        const addEdge = page.locator('.pvt-toolpanel-tool[data-tool="add-edge"]')

        await addEdge.click()
        await expect(addEdge).toHaveClass(/active/)
        expect(await connectActive(page)).toBe(true)

        await addEdge.click()
        expect(await connectActive(page)).toBe(false)
    })

    test('Add note creates a note on the canvas', async ({ page }) => {
        await loadFixture(page, 'basic', B3)
        await setMode(page, 'create')

        const before = (await harness(page, 'counts')) as { notes: number }
        await page.locator('.pvt-toolpanel-tool[data-tool="add-note"]').click()
        const after = (await harness(page, 'counts')) as { notes: number }

        expect(after.notes).toBe(before.notes + 1)
    })
})
