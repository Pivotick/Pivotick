import { test, expect, gotoHarness } from '../helpers'
import type { Locator, Page } from '@playwright/test'

/**
 * Host actions in the top bar (`UI.topBar.actions`): pills the host declares beside the
 * built-in ones, at either end of the strip, with a caret for a split button.
 */

const pill = (page: Page, id: string): Locator => page.locator(`.pvt-topbar-action[data-action="${id}"]`)
const caret = (page: Page, id: string): Locator => pill(page, id).locator('.pvt-topbar-caret')
const actionMenu = (page: Page): Locator => page.locator('.pvt-topbar-menu')
const promptInput = (page: Page): Locator => page.locator('.pvt-prompt-modal-body input')
const modalButton = (page: Page, name: string): Locator =>
    page.locator('.pvt-modal__footer button', { hasText: name })

/** What the strip holds, left to right: each pill's id or action id, and `history` for the group. */
async function stripOrder(page: Page): Promise<string[]> {
    return page.locator('.pvt-mainheader-elements').evaluate((strip) =>
        [...strip.querySelectorAll<HTMLElement>('.pvt-action-button, .pvt-undoredo-group')]
            .map((el) => el.dataset.action ?? (el.classList.contains('pvt-undoredo-group') ? 'history' : el.id)))
}

const calls = (page: Page): Promise<string[]> => page.evaluate(() => window.__pivotick.topBarCalls())
const prompts = (page: Page) => page.evaluate(() => window.__pivotick.topBarPromptValues())

/** Run the `save` pill's prompt through to a name, which turns it into the split "Update graph". */
async function saveAs(page: Page, name: string): Promise<void> {
    await pill(page, 'save').click()
    await promptInput(page).fill(name)
    await modalButton(page, 'OK').click()
    await expect(pill(page, 'save')).toHaveText('Update graph')
}

test.describe('top-bar actions', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
        await page.evaluate(() => window.__pivotick.loadWithTopBarActions())
    })

    test('declared actions sit at their placement, between the built-ins and history', async ({ page }) => {
        expect(await stripOrder(page)).toEqual([
            'pvt-searchbox-button', 'pvt-filter-button', 'pvt-notes-button',
            'export',
            'lock', 'save',
            'history',
        ])
    })

    test('an invisible action draws nothing', async ({ page }) => {
        await expect(pill(page, 'export')).toBeVisible()
        await expect(pill(page, 'hidden')).toHaveCount(0)
    })

    test('a disabled action is drawn disabled and does not run', async ({ page }) => {
        await page.evaluate(() => window.__pivotick.setTopBarLocked(true))
        // Nothing re-reads `enabled` until a refresh.
        await expect(pill(page, 'lock')).toHaveAttribute('aria-disabled', 'false')
        await page.evaluate(() => window.__pivotick.refreshTopBar())
        await expect(pill(page, 'lock')).toHaveAttribute('aria-disabled', 'true')
        await pill(page, 'lock').click({ force: true })
        expect(await calls(page)).toEqual([])
    })

    test('onclick runs with a context whose promptData resolves the form, null on cancel', async ({ page }) => {
        await pill(page, 'save').click()
        await expect(page.locator('.pvt-modal__header')).toContainText('Save as graph')
        await modalButton(page, 'Cancel').click()
        await expect.poll(() => prompts(page)).toEqual([null])
        await expect(pill(page, 'save')).toHaveText('Save as graph')

        await saveAs(page, 'Incident 42')
        expect(await prompts(page)).toEqual([null, { name: 'Incident 42' }])
        expect(await calls(page)).toEqual(['save', 'save'])
    })

    test('a text function is re-read, and a menu turns the pill into a split button', async ({ page }) => {
        await expect(caret(page, 'save')).toHaveCount(0)
        await saveAs(page, 'Incident 42')
        await expect(caret(page, 'save')).toBeVisible()
    })

    test('the caret opens the rows, Escape closes them, and a row runs', async ({ page }) => {
        await saveAs(page, 'Incident 42')

        await caret(page, 'save').click()
        await expect(actionMenu(page)).toBeVisible()
        await expect(actionMenu(page)).toContainText('Save as new graph…')
        await page.keyboard.press('Escape')
        await expect(actionMenu(page)).toHaveCount(0)

        await caret(page, 'save').click()
        await actionMenu(page).getByText('Save as new graph…').click()
        await expect(actionMenu(page)).toHaveCount(0)
        await modalButton(page, 'Cancel').click()
        await expect.poll(() => calls(page)).toEqual(['save', 'save-new'])
        // The label never ran.
        expect(await prompts(page)).toEqual([{ name: 'Incident 42' }, null])
    })

    // The refresh while the save is out gives the pill its caret, which rebuilds it: the
    // rebuilt pill has to come back from busy too, not only the one the click started on.
    test('a pill rebuilt while its onclick is out comes back enabled', async ({ page }) => {
        await page.evaluate(() => window.__pivotick.holdTopBarSave())
        await pill(page, 'save').click()
        await promptInput(page).fill('Incident 42')
        await modalButton(page, 'OK').click()
        await page.evaluate(() => window.__pivotick.refreshTopBar())
        await expect(caret(page, 'save')).toBeVisible()
        await expect(pill(page, 'save')).toHaveAttribute('aria-busy', '')

        await page.evaluate(() => window.__pivotick.releaseTopBarSave())
        await expect(pill(page, 'save')).not.toHaveAttribute('aria-busy')
        await expect(pill(page, 'save')).toHaveAttribute('aria-disabled', 'false')
        await caret(page, 'save').click()
        await expect(actionMenu(page)).toContainText('Save as new graph…')
    })

    test('a plugin adds a pill, and its disposer takes it away', async ({ page }) => {
        await page.evaluate(() => window.__pivotick.addPluginTopBarAction())
        expect(await stripOrder(page)).toEqual([
            'pvt-searchbox-button', 'pvt-filter-button', 'pvt-notes-button',
            'export',
            'lock', 'save', 'plugin-action',
            'history',
        ])
        await pill(page, 'plugin-action').click()
        expect(await calls(page)).toEqual(['plugin-action'])

        await page.evaluate(() => window.__pivotick.disposePluginTopBarAction())
        await expect(pill(page, 'plugin-action')).toHaveCount(0)
    })

    test('topBar.enabled: false draws none', async ({ page }) => {
        await page.evaluate(() => window.__pivotick.loadWithTopBarActions({ UI: { topBar: { enabled: false } } }))
        await expect(page.locator('.pvt-topbar-action')).toHaveCount(0)
    })

    test('the strip with host pills', async ({ page }) => {
        await saveAs(page, 'Incident 42')
        await expect(page.locator('.pvt-mainheader')).toHaveScreenshot('topbar-actions.png')
    })
})
