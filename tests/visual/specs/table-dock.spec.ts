import { test, expect, gotoHarness, loadFixture } from '../helpers'

// ── The data dock's shell ────────────────────────────────────────────────────
// A real grid row under the canvas: resizable by its divider, collapsible to its
// header bar, gated to `full` mode, and off by option.
//
// The load-bearing assertion is that opening it does not disturb the physics.
// The dock shrinks the canvas, and a layout has to come out the same whether the
// dock happens to be open or not — see physics-container.spec.ts for the
// mechanism this relies on.

type Page = import('@playwright/test').Page

/* eslint-disable @typescript-eslint/no-explicit-any */

const FULL = { UI: { mode: 'full', sidebar: { collapsed: false } } }

const dock = (page: Page) => page.locator('.pvt-table')
const pill = (page: Page) => page.locator('#pvt-table-button')
const divider = (page: Page) => page.locator('.pvt-table-divider')

/** Height of the dock's grid row, as the layout actually resolved it. */
const rowHeight = (page: Page) =>
    page.evaluate(() => {
        const layout = document.querySelector('.pvt-layout') as HTMLElement
        return parseFloat(getComputedStyle(layout).getPropertyValue('--pvt-table-height')) || 0
    })

const canvasHeight = (page: Page) =>
    page.evaluate(() => document.querySelector('.pvt-canvas')!.getBoundingClientRect().height)

const physicsState = (page: Page) =>
    page.evaluate(() => {
        const sim = (window.__pivotick as any).graph.simulation
        return {
            width: sim.containerBCR.width,
            height: sim.containerBCR.height,
            gravityX: sim.simulationForces.gravity.x(),
            gravityY: sim.simulationForces.gravity.y(),
        }
    })

const settle = (page: Page) =>
    page.evaluate(() => new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    }))

test.describe('table dock', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    test('full mode offers a Table pill, closed until it is asked for', async ({ page }) => {
        await loadFixture(page, 'basic', FULL)

        await expect(pill(page)).toBeVisible()
        expect(await rowHeight(page)).toBe(0)
        await expect(dock(page)).toBeHidden()
    })

    test('the pill opens and closes the dock', async ({ page }) => {
        await loadFixture(page, 'basic', FULL)
        const closedCanvas = await canvasHeight(page)

        await pill(page).click()
        await settle(page)
        await expect(dock(page)).toBeVisible()
        expect(await rowHeight(page)).toBeGreaterThan(0)
        // The canvas genuinely gave up the room — this is a split, not an overlay.
        expect(await canvasHeight(page)).toBeLessThan(closedCanvas)

        await pill(page).click()
        await settle(page)
        await expect(dock(page)).toBeHidden()
        expect(await rowHeight(page)).toBe(0)
        expect(await canvasHeight(page)).toBeCloseTo(closedCanvas, 0)
    })

    test('Shift+T toggles it too', async ({ page }) => {
        await loadFixture(page, 'basic', FULL)

        await page.locator('.pivotick').click({ position: { x: 5, y: 5 } })
        await page.keyboard.press('Shift+T')
        await settle(page)
        await expect(dock(page)).toBeVisible()

        await page.keyboard.press('Shift+T')
        await settle(page)
        await expect(dock(page)).toBeHidden()
    })

    // The whole justification for D-F. Opening the dock resizes the canvas; the
    // physics must not notice, or a re-layout would differ depending on chrome.
    test('opening the dock leaves the physics untouched', async ({ page }) => {
        await loadFixture(page, 'basic', FULL)
        const before = await physicsState(page)

        await pill(page).click()
        await settle(page)

        // The canvas really did shrink…
        expect(await rowHeight(page)).toBeGreaterThan(0)
        // …and nothing about the simulation moved.
        expect(await physicsState(page)).toEqual(before)
    })

    test('the collapse toggle folds it to its header bar', async ({ page }) => {
        await loadFixture(page, 'basic', FULL)
        await pill(page).click()
        await settle(page)
        const expanded = await rowHeight(page)

        await page.locator('.pvt-table-toggle').click()
        await settle(page)

        await expect(dock(page)).toHaveClass(/pvt-table-collapsed/)
        await expect(page.locator('.pvt-table-body')).toBeHidden()
        // Still on screen, just folded — the header bar remains.
        const collapsed = await rowHeight(page)
        expect(collapsed).toBeGreaterThan(0)
        expect(collapsed).toBeLessThan(expanded)

        await page.locator('.pvt-table-toggle').click()
        await settle(page)
        await expect(dock(page)).not.toHaveClass(/pvt-table-collapsed/)
    })

    test('dragging the divider resizes it', async ({ page }) => {
        await loadFixture(page, 'basic', FULL)
        await pill(page).click()
        await settle(page)
        const before = await rowHeight(page)

        const handle = await divider(page).boundingBox()
        expect(handle).not.toBeNull()
        await page.mouse.move(handle!.x + handle!.width / 2, handle!.y + handle!.height / 2)
        await page.mouse.down()
        await page.mouse.move(handle!.x + handle!.width / 2, handle!.y - 90, { steps: 6 })
        await page.mouse.up()
        await settle(page)

        // Dragging the divider up makes the dock taller.
        expect(await rowHeight(page)).toBeGreaterThan(before)
    })

    // The canvas is what breaks if it runs out of room, so it keeps a floor no
    // matter how far the divider is dragged.
    test('the divider cannot starve the canvas', async ({ page }) => {
        await loadFixture(page, 'basic', FULL)
        await pill(page).click()
        await settle(page)

        const handle = await divider(page).boundingBox()
        await page.mouse.move(handle!.x + handle!.width / 2, handle!.y + handle!.height / 2)
        await page.mouse.down()
        await page.mouse.move(handle!.x + handle!.width / 2, 0, { steps: 8 })
        await page.mouse.up()
        await settle(page)

        expect(await canvasHeight(page)).toBeGreaterThanOrEqual(199)
    })

    test('light mode has neither pill nor dock', async ({ page }) => {
        await loadFixture(page, 'basic', { UI: { mode: 'light' } })

        await expect(pill(page)).toHaveCount(0)
        await expect(dock(page)).toHaveCount(0)
    })

    test('UI.table false suppresses it in full mode', async ({ page }) => {
        await loadFixture(page, 'basic', { UI: { mode: 'full', table: false } })

        await expect(pill(page)).toHaveCount(0)
        await expect(dock(page)).toHaveCount(0)
    })

    // `collapsed: 'auto'` folds the dock away when the layout can't spare the room
    // for it and a usable canvas both.
    test('auto-collapse folds it away on a short layout', async ({ page }) => {
        await loadFixture(page, 'basic', { UI: { mode: 'full', table: { open: true } } })
        await settle(page)
        await expect(dock(page)).not.toHaveClass(/pvt-table-collapsed/)

        await page.evaluate(() => window.__pivotick.setContainerSize(1000, 380))
        await settle(page)

        await expect(dock(page)).toHaveClass(/pvt-table-collapsed/)
    })
})
