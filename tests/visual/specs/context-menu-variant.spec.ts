import type { Locator, Page } from '@playwright/test'
import { test, expect, gotoHarness, loadFixture, nodeEl, canvas, waitForViewSettled } from '../helpers'

// A consumer's menu entry may leave `variant` out; it defaults to `outline-primary`, the
// variant every built-in row declares, so it lights up on hover like its neighbours.

const CONSUMER_MENUS = {
    UI: {
        contextMenu: {
            menuNode: {
                menu: [
                    { text: 'Open its event' },
                    { text: 'More', submenu: [{ text: 'Copy value' }] },
                ],
            },
            menuCanvas: { menu: [{ text: 'Remove fetched correlations' }] },
        },
    },
}

const menu = (page: Page): Locator => page.locator('.pvt-contextmenu:not(.pvt-contextmenu-flyout)')
const flyout = (page: Page): Locator => page.locator('.pvt-contextmenu-flyout')
const row = (scope: Locator, text: string): Locator => scope.locator('.pvt-action-item', { hasText: text }).first()

/** The row's background while the pointer is on it. */
async function hoverBackground(item: Locator): Promise<string> {
    await item.hover()
    return item.evaluate(el => getComputedStyle(el).backgroundColor)
}

async function openNodeMenu(page: Page, id: string): Promise<void> {
    // A late-landing initial fit emits `canvasZoom`, which closes the menu.
    await waitForViewSettled(page)
    await nodeEl(page, id).click({ button: 'right' })
    await expect(menu(page)).toHaveClass(/shown/)
}

test.describe('context menu — the default variant', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
        await loadFixture(page, 'basic', CONSUMER_MENUS)
    })

    test('a node-menu row with no variant hovers like a built-in one', async ({ page }) => {
        await openNodeMenu(page, 'a')
        const own = row(menu(page), 'Open its event')
        await expect(own).toHaveClass(/\bpvt-action-item-outline-primary\b/)

        const builtIn = await hoverBackground(row(menu(page), 'Select Neighbors'))
        expect(await hoverBackground(own)).toBe(builtIn)
    })

    test('a submenu row with no variant gets it too', async ({ page }) => {
        await openNodeMenu(page, 'a')
        await row(menu(page), 'More').click()
        await expect(row(flyout(page), 'Copy value')).toHaveClass(/\bpvt-action-item-outline-primary\b/)
    })

    test('a canvas-menu row with no variant gets it too', async ({ page }) => {
        await waitForViewSettled(page)
        const box = await canvas(page).boundingBox()
        if (!box) throw new Error('canvas has no bounding box')
        await page.mouse.click(box.x + box.width - 230, box.y + box.height - 170, { button: 'right' })
        await expect(menu(page)).toHaveClass(/shown/)
        await expect(row(menu(page), 'Remove fetched correlations'))
            .toHaveClass(/\bpvt-action-item-outline-primary\b/)
    })
})
