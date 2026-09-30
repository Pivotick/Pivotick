import type { Page } from '@playwright/test'
import { test, expect, gotoHarness, harness, nodeEl, canvas, waitForViewSettled } from '../helpers'

/**
 * Every node, group and selection menu reads in four bands: *Pivot ▸*, the group entries,
 * everything else with the app's entries last, then the delete.
 *
 * The `basic` fixture with every fake pivot, the table open, and a hand-made group over
 * `b` and `c`. The app declares one entry in `menuNode` and one in `menuSelection`.
 */

const APP_MENUS = {
    menuNode: { menu: [{ text: 'App node entry' }] },
    menuSelection: { menu: [{ text: 'App selection entry' }] },
}

const menu = (page: Page) => page.locator('.pvt-contextmenu:not(.pvt-contextmenu-flyout)')

/** The main list's rows, top to bottom, without their shortcut hints. Hidden entries are not drawn. */
async function menuRows(page: Page): Promise<string[]> {
    await expect(menu(page)).toHaveClass(/shown/)
    return menu(page).locator('.pvt-contextmenu-mainmenu > .pvt-action-list > .pvt-action-item')
        .evaluateAll((rows) => rows.map((row) => (row as HTMLElement).innerText.split('\n')[0].trim()))
}

async function load(page: Page, ui: Record<string, unknown> = {}, grouped = true): Promise<void> {
    await harness(page, 'loadWithPivots', 'basic', {}, {
        UI: { mode: 'full', table: { open: true }, contextMenu: APP_MENUS, ...ui },
    })
    if (grouped) {
        await page.evaluate(() => window.__pivotick.graph!.simplify.setManualGroups([{ id: 'pvt-manual-1', title: 'Picked', members: ['b', 'c'] }]))
    }
    // A late-landing initial fit emits `canvasZoom`, which closes the menu.
    await waitForViewSettled(page)
}

async function openGroup(page: Page): Promise<void> {
    await page.evaluate(() => window.__pivotick.graph!.simplify.open('pvt-manual-1'))
    await waitForViewSettled(page)
}

async function rightClickNode(page: Page, id: string): Promise<string[]> {
    await nodeEl(page, id).click({ button: 'right' })
    return menuRows(page)
}

async function rightClickGroup(page: Page): Promise<string[]> {
    const domId = await page.evaluate(() => window.__pivotick.graph!.simplify.getGroupNode('pvt-manual-1')!.domID)
    await canvas(page).locator(`#node-${domId}`).first().click({ button: 'right' })
    return menuRows(page)
}

async function rightClickSelection(page: Page, ids: string[]): Promise<string[]> {
    await harness(page, 'multiSelect', ids)
    return rightClickNode(page, ids[0])
}

test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 })
    await gotoHarness(page)
})

test.describe('context menu order', () => {
    test('a node in a group: Pivot, its group entry, the rest, the app\'s, then Delete Node', async ({ page }) => {
        await load(page)
        await openGroup(page)
        expect(await rightClickNode(page, 'b')).toEqual([
            'Pivot',
            'Pull out of group',
            'Select Neighbors', 'Hide Children', 'Connect to...', 'Inspect Properties',
            'App node entry',
            'Delete Node',
        ])
    })

    test('a pulled-out node: Put back in group sits in the group band', async ({ page }) => {
        await load(page)
        await openGroup(page)
        await page.evaluate(() => window.__pivotick.graph!.simplify.pullOut(['b']))
        const rows = await rightClickNode(page, 'b')
        expect(rows.slice(0, 2)).toEqual(['Pivot', 'Put back in group'])
    })

    test('a group: Pivot, its group entries, Select Neighbors, then Delete members', async ({ page }) => {
        await load(page)
        expect(await rightClickGroup(page)).toEqual([
            'Pivot',
            'Open group', 'Select members', 'View members in table', 'Rename group', 'Ungroup',
            'Select Neighbors',
            'Delete members',
        ])
    })

    test('a selection holding a group\'s member: Pivot, the group entries, the rest, the app\'s, then Delete Selected', async ({ page }) => {
        await load(page)
        await openGroup(page)
        expect(await rightClickSelection(page, ['a', 'b'])).toEqual([
            'Pivot',
            'Group selected nodes', 'Pull out of group', 'Ungroup',
            'Select Neighbors',
            'App selection entry',
            'Delete Selected',
        ])
    })

    test('with simplification off, the group band is empty', async ({ page }) => {
        await load(page, { simplify: { enabled: false } }, false)
        expect(await rightClickNode(page, 'b')).toEqual([
            'Pivot',
            'Select Neighbors', 'Hide Children', 'Connect to...', 'Inspect Properties',
            'App node entry',
            'Delete Node',
        ])
        await page.keyboard.press('Escape')
        expect(await rightClickSelection(page, ['a', 'b'])).toEqual([
            'Pivot',
            'Select Neighbors',
            'App selection entry',
            'Delete Selected',
        ])
    })

    test('with deletion off, the app\'s entry closes the menu', async ({ page }) => {
        await load(page, { editors: { deletion: { enabled: false } } })
        await openGroup(page)
        expect((await rightClickNode(page, 'b')).at(-1)).toBe('App node entry')
        await page.keyboard.press('Escape')
        expect((await rightClickSelection(page, ['a', 'b'])).at(-1)).toBe('App selection entry')
    })
})

/** Right-click an empty stretch of the canvas, away from the chrome in its corners. */
/** A point on bare canvas, 30px clear of any node, edge or chrome in each direction. */
const bareCanvasPoint = (page: Page) => page.evaluate(() => {
    const svg = document.querySelector('.pvt-canvas-element')!
    const box = svg.getBoundingClientRect()
    const bare = (x: number, y: number) => document.elementFromPoint(x, y) === svg
    for (let y = box.top + 60; y < box.bottom - 30; y += 20) {
        for (let x = box.left + 30; x < box.right - 30; x += 20) {
            if ([[0, 0], [30, 0], [-30, 0], [0, 30], [0, -30]].every(([dx, dy]) => bare(x + dx, y + dy))) return { x, y }
        }
    }
    throw new Error('no bare canvas point')
})

async function rightClickCanvas(page: Page): Promise<string[]> {
    const point = await bareCanvasPoint(page)
    await page.mouse.click(point.x, point.y, { button: 'right' })
    return menuRows(page)
}

/** Ids of the pinned nodes and groups. */
const pinnedIds = (page: Page) => page.evaluate(() => {
    const graph = window.__pivotick.graph!
    return [...new Set([...graph.getMutableNodes(), ...graph.getCanvasNodes()])].filter((node) => node.frozen).map((node) => node.id).sort()
})

test.describe('the canvas menu', () => {
    test('offers no release while nothing is pinned', async ({ page }) => {
        await load(page)
        const rows = await rightClickCanvas(page)
        expect(rows).toContain('Add Note')
        expect(rows).not.toContain('Release pinned nodes')
    })

    test('Release pinned nodes unpins every pinned node and group', async ({ page }) => {
        await load(page)
        await page.evaluate(() => {
            const graph = window.__pivotick.graph!
            graph.getMutableNode('a')!.freeze()
            graph.getMutableNode('d')!.freeze()
            graph.simplify.getGroupNode('pvt-manual-1')!.freeze()
        })
        expect(await pinnedIds(page)).toHaveLength(3)

        expect((await rightClickCanvas(page)).at(-1)).toBe('Release pinned nodes')
        await menu(page).locator('.pvt-action-item', { hasText: 'Release pinned nodes' }).click()
        await expect.poll(() => pinnedIds(page)).toEqual([])
    })
})
