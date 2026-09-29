import { test, expect, gotoHarness, loadFixture, harness, nodeEl, openNodeTooltip, centerOf, canvas } from '../helpers'
import type { Page } from '@playwright/test'

// The context menu over a selection, and the other ways to act on one: a right-click on
// a selected node acts on the whole selection, a right-click on a table row opens the
// menu its dot has, and Del hides what is selected.

const FULL = { UI: { mode: 'full', sidebar: { collapsed: false } } }
const WITH_TABLE = { UI: { mode: 'full', sidebar: { collapsed: false }, table: { open: true } } }

const menu = (page: Page) => page.locator('.pvt-contextmenu:not(.pvt-contextmenu-flyout)')
const menuEntry = (page: Page, text: string) => menu(page).getByText(text, { exact: true })
const caption = (page: Page) => menu(page).locator('.pvt-contextmenu-caption')
const quickAction = (page: Page, title: string) => menu(page).locator(`.pvt-contextmenu-topbar [title="${title}"]`)
const row = (page: Page, id: string) => page.locator(`.pvt-dock .pvt-table-row[data-id="${id}"]`)

const selectedIds = async (page: Page) =>
    ((await harness(page, 'selectedNodeIds')) as string[]).slice().sort()

/** Ids of the nodes the filters hide. */
const hiddenIds = (page: Page) =>
    page.evaluate(() => window.__pivotick.graph!.getMutableNodes().filter((node) => !node.visible).map((node) => node.id).sort())

test.beforeEach(async ({ page }) => {
    await gotoHarness(page)
})

test.describe('the menu over a selection', () => {
    test('a selected node opens the selection menu, which hides every selected node', async ({ page }) => {
        await loadFixture(page, 'basic', FULL)
        await harness(page, 'multiSelect', ['a', 'b'])

        await nodeEl(page, 'a').click({ button: 'right' })
        await expect(caption(page)).toHaveText('2 selected')
        // One node's own entries have no place in it.
        await expect(menuEntry(page, 'Inspect Properties')).toHaveCount(0)
        await expect(menuEntry(page, 'Connect to...')).toHaveCount(0)

        await quickAction(page, 'Hide Selected').click()
        await expect.poll(() => hiddenIds(page)).toEqual(['a', 'b'])
        await expect.poll(() => selectedIds(page)).toEqual([])
    })

    test('a node outside the selection opens its own menu and leaves the selection alone', async ({ page }) => {
        await loadFixture(page, 'basic', FULL)
        await harness(page, 'multiSelect', ['a', 'b'])

        await nodeEl(page, 'c').click({ button: 'right' })
        await expect(menuEntry(page, 'Inspect Properties')).toBeVisible()
        await expect(caption(page)).toHaveCount(0)
        expect(await selectedIds(page)).toEqual(['a', 'b'])
    })

    test('Select Neighbors selects what the selection links to', async ({ page }) => {
        await loadFixture(page, 'basic', FULL)
        const expected = await page.evaluate(() => {
            const graph = window.__pivotick.graph!
            const own = new Set(['a', 'b'])
            const ids = new Set<string>()
            for (const id of own) {
                const node = graph.getMutableNode(id)!
                for (const other of [...node.getConnectedNodes(), ...node.getConnectingNodes()]) if (!own.has(other.id)) ids.add(other.id)
            }
            return [...ids].sort()
        })
        expect(expected.length).toBeGreaterThan(0)
        await harness(page, 'multiSelect', ['a', 'b'])

        await nodeEl(page, 'b').click({ button: 'right' })
        await menuEntry(page, 'Select Neighbors').click()
        await expect.poll(() => selectedIds(page)).toEqual(expected)
    })
})

test.describe('the Delete key', () => {
    test('hides the selected nodes, as one undo step', async ({ page }) => {
        await loadFixture(page, 'basic', FULL)
        await harness(page, 'multiSelect', ['a', 'c'])
        await page.locator('.pivotick').first().focus()

        await page.keyboard.press('Delete')
        await expect.poll(() => hiddenIds(page)).toEqual(['a', 'c'])
        expect(await page.evaluate(() => window.__pivotick.graph!.getMutableNodes().length)).toBeGreaterThan(2)

        await page.keyboard.press('Control+z')
        await expect.poll(() => hiddenIds(page)).toEqual([])
    })
})

test.describe('the table rows', () => {
    test('a right-click on a row opens the menu for its node, over the dock', async ({ page }) => {
        await loadFixture(page, 'basic', WITH_TABLE)
        await row(page, 'c').click({ button: 'right' })
        await expect(menu(page)).toHaveClass(/shown/)
        await expect(menuEntry(page, 'Inspect Properties')).toBeVisible()

        // A click anywhere else in the dock closes it.
        await page.locator('.pvt-dock .pvt-table-row[data-id="d"]').click()
        await expect(menu(page)).not.toHaveClass(/shown/)
    })

    test('a row of the selection opens the selection menu', async ({ page }) => {
        await loadFixture(page, 'basic', WITH_TABLE)
        await row(page, 'a').click()
        await row(page, 'c').click({ modifiers: ['ControlOrMeta'] })

        await row(page, 'c').click({ button: 'right' })
        await expect(caption(page)).toHaveText('2 selected')
    })

    test('a member of a closed group can be pulled out from its row', async ({ page }) => {
        await page.setViewportSize({ width: 1400, height: 900 })
        await harness(page, 'loadSimplify', { UI: { mode: 'full', table: { open: true }, simplify: { rules: [{ kind: 'neighbours' }] } } }, 'simplify', false)
        expect(await page.evaluate(() => window.__pivotick.graph!.simplify.groupOf('dom-3')?.open)).toBe(false)

        await row(page, 'dom-3').click({ button: 'right' })
        await menuEntry(page, 'Pull out of group').click()
        await expect.poll(() => page.evaluate(() => window.__pivotick.graph!.simplify.isPulledOut('dom-3'))).toBe(true)
        await expect.poll(() => page.evaluate(() => window.__pivotick.graph!.getCanvasNodes().some((node) => node.id === 'dom-3'))).toBe(true)
    })
})

test.describe('the sidebar header count', () => {
    test('follows nodes being added and removed', async ({ page }) => {
        await loadFixture(page, 'basic', FULL)
        const header = page.locator('.pvt-mainheader-count')
        const count = () => page.evaluate(() => {
            const graph = window.__pivotick.graph!
            return `Showing ${graph.getMutableVisibleNodes().length} nodes and ${graph.getMutableVisibleEdges().length} edges`
        })
        await expect(header).toHaveText(await count())

        await page.evaluate(() => window.__pivotick.graph!.addNode({ id: 'late', data: {} }))
        await expect(header).toHaveText(await count())
        await expect(header).toContainText(/Showing \d+ nodes/)

        await page.evaluate(() => window.__pivotick.graph!.removeNode('late'))
        await expect(header).toHaveText(await count())
    })
})

test.describe('the tooltip', () => {
    test('takes the theme the graph was forced to', async ({ page }) => {
        await loadFixture(page, 'basic', { UI: { theme: 'dark' } })
        const tip = await openNodeTooltip(page, 'a')
        await expect(tip).toHaveAttribute('data-theme', 'dark')
    })

    test("a pinned tooltip's link ends on the node, not on its label", async ({ page }) => {
        await loadFixture(page, 'basic', FULL)
        await page.evaluate(() => {
            const node = window.__pivotick.graph!.getMutableNode('a')!
            node.updateStyle({ text: 'a long label drawn under the node', textTruncate: false, textVerticalShift: -1.4 })
        })
        await harness(page, 'rerender')
        // Hovered on the shape: the node's box now takes in the label, and its middle is air.
        await expect(canvas(page).locator('#node-a .pvt-node-label')).toHaveCount(1)
        const shape = canvas(page).locator('#node-a circle.node')
        const box = (await shape.boundingBox())!
        const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
        await page.mouse.move(centre.x, box.y - 10)
        await page.mouse.move(centre.x, centre.y, { steps: 25 })
        const tip = page.locator('.pvt-tooltip')
        await expect(tip).toHaveClass(/shown/)
        await tip.locator('.pin-button').click()
        // The link is drawn as the pinned copy moves: drag it away by its top bar.
        const bar = page.locator('.pvt-tooltip-floating .pvt-tooltip-topbar')
        const grip = (await bar.boundingBox())!
        await page.mouse.move(grip.x + 8, grip.y + grip.height / 2)
        await page.mouse.down()
        await page.mouse.move(grip.x + 120, grip.y + 80, { steps: 10 })
        await page.mouse.up()
        const link = page.locator('path.pivotick-shadowlink').last()
        await expect(link).toHaveAttribute('d', /L/)

        const end = await link.evaluate((path) => {
            const [x, y] = (path.getAttribute('d') ?? '').split('L')[1].trim().split(/\s+/).map(Number)
            return { x, y }
        })
        const shapeCentre = await centerOf(shape)
        expect(Math.abs(end.x - shapeCentre.x)).toBeLessThan(2)
        expect(Math.abs(end.y - shapeCentre.y)).toBeLessThan(2)
    })
})
