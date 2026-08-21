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
/** There is no toolbar button for the dock — the bar's own chevron is the control. */
const pill = (page: Page) => page.locator('#pvt-table-button')
const chevron = (page: Page) => page.locator('.pvt-table-toggle')
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

type BoundingBox = { x: number, y: number, width: number, height: number }

function overlaps(a: BoundingBox, b: BoundingBox): boolean {
    return a.x < b.x + b.width && b.x < a.x + a.width
        && a.y < b.y + b.height && b.y < a.y + a.height
}

const settle = (page: Page) =>
    page.evaluate(() => new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    }))

test.describe('table dock', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    // The dock is on screen by default, folded to its bar. That bar is what replaced the
    // header pill, so it has to be there — and the pill has to be gone.
    test('full mode starts folded to its bar, with no toolbar button', async ({ page }) => {
        await loadFixture(page, 'basic', FULL)

        await expect(dock(page)).toBeVisible()
        await expect(dock(page)).toHaveClass(/pvt-table-collapsed/)
        await expect(page.locator('.pvt-table-body')).toBeHidden()
        expect(await rowHeight(page)).toBeGreaterThan(0)
        await expect(pill(page)).toHaveCount(0)
    })

    test('expanding takes the room from the canvas', async ({ page }) => {
        await loadFixture(page, 'basic', FULL)
        const foldedCanvas = await canvasHeight(page)
        const foldedRow = await rowHeight(page)

        await chevron(page).click()
        await settle(page)
        expect(await rowHeight(page)).toBeGreaterThan(foldedRow)
        // The canvas genuinely gave up the room — this is a split, not an overlay.
        expect(await canvasHeight(page)).toBeLessThan(foldedCanvas)

        await chevron(page).click()
        await settle(page)
        expect(await rowHeight(page)).toBe(foldedRow)
        expect(await canvasHeight(page)).toBeCloseTo(foldedCanvas, 0)
    })

    // One meaning: show the content, or fold it away again.
    test('Shift+T shows and folds the content', async ({ page }) => {
        await loadFixture(page, 'basic', FULL)
        const body = page.locator('.pvt-table-body')

        await page.locator('.pivotick').click({ position: { x: 5, y: 5 } })
        await page.keyboard.press('Shift+T')
        await settle(page)
        await expect(body).toBeVisible()

        await page.keyboard.press('Shift+T')
        await settle(page)
        await expect(body).toBeHidden()
        // Folded, not gone — the bar stays, or there would be no way back.
        await expect(dock(page)).toBeVisible()
    })

    // `open: false` is the zero-footprint opt-out, and the one state with no affordance
    // on screen at all — so the shortcut has to be able to bring the dock in.
    test('Shift+T brings in a dock that was switched off', async ({ page }) => {
        await loadFixture(page, 'basic', { UI: { mode: 'full', table: { open: false } } })
        await expect(dock(page)).toBeHidden()

        await page.locator('.pivotick').click({ position: { x: 5, y: 5 } })
        await page.keyboard.press('Shift+T')
        await settle(page)

        await expect(dock(page)).toBeVisible()
        await expect(page.locator('.pvt-table-body')).toBeVisible()
    })

    // The whole justification for D-F. Opening the dock resizes the canvas; the
    // physics must not notice, or a re-layout would differ depending on chrome.
    test('opening the dock leaves the physics untouched', async ({ page }) => {
        await loadFixture(page, 'basic', FULL)
        const before = await physicsState(page)

        await chevron(page).click()
        await settle(page)

        // The canvas really did shrink…
        expect(await rowHeight(page)).toBeGreaterThan(0)
        // …and nothing about the simulation moved.
        expect(await physicsState(page)).toEqual(before)
    })

    test('the collapse toggle folds it to its header bar', async ({ page }) => {
        await loadFixture(page, 'basic', FULL)
        await chevron(page).click()
        await settle(page)
        const expanded = await rowHeight(page)

        await chevron(page).click()
        await settle(page)

        await expect(dock(page)).toHaveClass(/pvt-table-collapsed/)
        await expect(page.locator('.pvt-table-body')).toBeHidden()
        // Still on screen, just folded — the header bar remains.
        const collapsed = await rowHeight(page)
        expect(collapsed).toBeGreaterThan(0)
        expect(collapsed).toBeLessThan(expanded)

        await chevron(page).click()
        await settle(page)
        await expect(dock(page)).not.toHaveClass(/pvt-table-collapsed/)
    })

    test('dragging the divider resizes it', async ({ page }) => {
        await loadFixture(page, 'basic', FULL)
        await chevron(page).click()
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
        await chevron(page).click()
        await settle(page)

        const handle = await divider(page).boundingBox()
        await page.mouse.move(handle!.x + handle!.width / 2, handle!.y + handle!.height / 2)
        await page.mouse.down()
        await page.mouse.move(handle!.x + handle!.width / 2, 0, { steps: 8 })
        await page.mouse.up()
        await settle(page)

        expect(await canvasHeight(page)).toBeGreaterThanOrEqual(199)
    })

    // The sidebar spans the dock's grid row, and hangs its collapse toggle off its own
    // bottom-right corner — which, with the dock always present, is where the dock's
    // chevron lives. They overlapped, and the chevron swallowed the toggle's clicks.
    test('the dock chevron does not sit on the sidebar collapse toggle', async ({ page }) => {
        await loadFixture(page, 'basic', FULL)
        const toggle = page.locator('.pvt-sidebar-collapse-container')

        const boxes = async () => {
            const a = await chevron(page).boundingBox()
            const b = await toggle.boundingBox()
            expect(a && b).toBeTruthy()
            return { a: a!, b: b! }
        }

        const folded = await boxes()
        expect(overlaps(folded.a, folded.b)).toBe(false)

        // And the sidebar toggle still does its job, which is what the overlap broke.
        await toggle.click()
        await expect(page.locator('.pvt-sidebar')).toHaveClass(/pvt-sidebar-collapsed/)

        // Expanded, the dock is taller — the toggle has to keep clear of that too.
        await chevron(page).click()
        await settle(page)
        const expanded = await boxes()
        expect(overlaps(expanded.a, expanded.b)).toBe(false)
    })

    // The sidebar's only right-edge separator is a black box-shadow, and on the dark
    // theme `--pvt-ui-bg` and `--pvt-chrome-bg` are the *same* colour — so without a
    // border of its own the dock and the sidebar merged into one surface.
    test('the dock draws an edge against the sidebar in both themes', async ({ page }) => {
        for (const theme of ['dark', 'light'] as const) {
            await loadFixture(page, 'basic', { UI: { mode: 'full', theme, sidebar: { collapsed: false }, table: { open: true } } })
            await page.locator('.pvt-table-row').first().waitFor()

            const edge = await page.evaluate(() => {
                const table = getComputedStyle(document.querySelector('.pvt-table')!)
                const sidebar = getComputedStyle(document.querySelector('.pvt-sidebar')!)
                return {
                    width: parseFloat(table.borderLeftWidth),
                    colour: table.borderLeftColor,
                    sidebarFill: sidebar.backgroundColor,
                }
            })

            expect(edge.width, `${theme}: dock has a left border`).toBeGreaterThan(0)
            // A border the same colour as what it sits against is not a separator.
            expect(edge.colour, `${theme}: edge is distinguishable`).not.toBe(edge.sidebarFill)
        }
    })

    test('light mode has no dock at all', async ({ page }) => {
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
