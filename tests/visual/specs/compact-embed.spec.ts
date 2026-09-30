import type { Page } from '@playwright/test'
import { test, expect, gotoHarness, harness } from '../helpers'

/**
 * A viewer embedded in a small box, and a tree that holds groups. The fixture is a value
 * with the objects it occurs in, each object in one event; a rule folds an event's objects
 * into one group when there are three or more (`ev-1`: 12, `ev-3`: 5; `ev-2` and `ev-4`
 * stay loose). Read from the model and the drawn lines, not from screenshots.
 */

const load = async (page: Page, overrides: object = {}): Promise<void> => {
    await harness(page, 'loadNeighbourhood', overrides)
}

const canvasHeight = (page: Page): Promise<number> =>
    page.evaluate(() => window.__pivotick.graph!.renderer.getCanvas().clientHeight)

const zoom = (page: Page): Promise<number> =>
    page.evaluate(() => (window.__pivotick.graph!.renderer as unknown as { getZoomTransform: () => { k: number } }).getZoomTransform().k)

/** The id of the group holding this event's objects. */
const groupOf = (page: Page, event: string): Promise<string> =>
    page.evaluate((event) => window.__pivotick.graph!.simplify.getGroups()
        .find((group) => group.members.some((member) => member.id.startsWith(`${event}-obj-`)))!.id, event)

/** Where a node or a group is drawn, in graph coordinates. */
const positionOf = (page: Page, id: string): Promise<{ x: number, y: number }> =>
    page.evaluate((id) => {
        const node = window.__pivotick.graph!.getCanvasNode(id)!
        return { x: node.x ?? NaN, y: node.y ?? NaN }
    }, id)

/** Where a node is drawn on screen, relative to the canvas. */
const onScreen = (page: Page, id: string): Promise<{ x: number, y: number, width: number, height: number }> =>
    page.evaluate((id) => {
        const graph = window.__pivotick.graph!
        const node = graph.getCanvasNode(id)!
        const t = (graph.renderer as unknown as { getZoomTransform: () => { k: number, x: number, y: number } }).getZoomTransform()
        const canvas = graph.renderer.getCanvas()
        return { x: t.k * (node.x ?? 0) + t.x, y: t.k * (node.y ?? 0) + t.y, width: canvas.clientWidth, height: canvas.clientHeight }
    }, id)

/** The line drawn from `value` to a group: whether it is a stand-in, and the label on it. */
const lineIntoGroup = (page: Page, groupId: string): Promise<{ synthetic: boolean, label: string | null }> =>
    page.evaluate((groupId) => {
        const graph = window.__pivotick.graph!
        const group = graph.getCanvasNode(groupId)!
        const line = graph.getDrawnEdgesTouching([group]).find((edge) => edge.from.id === 'value')!
        const element = line.getGraphElement()!
        return {
            synthetic: element.classList.contains('pvt-edge-synthetic'),
            label: element.querySelector('.label-container')?.textContent?.trim() || null,
        }
    }, groupId)

test.beforeEach(async ({ page }) => {
    await gotoHarness(page)
})

test.describe('canvas floor', () => {
    test('a viewer takes the height of a box shorter than 300px', async ({ page }) => {
        await harness(page, 'setContainerSize', 340, 190)
        await load(page, { UI: { mode: 'viewer' } })
        expect(await canvasHeight(page)).toBe(190)
    })

    test('a mode with chrome keeps its 300px floor', async ({ page }) => {
        await harness(page, 'setContainerSize', 340, 190)
        // Light mode would step down to viewer in a box this small; full mode does not.
        await load(page, { UI: { mode: 'full' } })
        expect(await canvasHeight(page)).toBe(300)
    })
})

test.describe('a tree over groups', () => {
    test('a group sits on its members’ level, beside the loose objects', async ({ page }) => {
        await load(page)
        const group = await positionOf(page, await groupOf(page, 'ev-1'))
        const looseObject = await positionOf(page, 'ev-2-obj-0')
        const value = await positionOf(page, 'value')
        const event = await positionOf(page, 'ev-1')
        expect(group.x).toBeCloseTo(looseObject.x, 0)
        expect(group.x).toBeGreaterThan(value.x)
        expect(group.x).toBeLessThan(event.x)
    })

    test('a group takes one row, not one per member', async ({ page }) => {
        await load(page)
        const ids = [await groupOf(page, 'ev-1'), 'ev-2-obj-0', 'ev-2-obj-1', await groupOf(page, 'ev-3'), 'ev-4-obj-0']
        const rows = (await Promise.all(ids.map((id) => positionOf(page, id)))).map((p) => p.y).sort((a, b) => a - b)
        const gaps = rows.slice(1).map((y, i) => y - rows[i])
        // A tidy tree spaces cousins twice as far as siblings; rows kept for 12 folded
        // members would open a gap many times that.
        expect(Math.max(...gaps)).toBeLessThanOrEqual(2 * Math.min(...gaps) + 1)
    })

    test('in a radial tree a group sits on its members’ ring', async ({ page }) => {
        await load(page, { layout: { radial: true, horizontal: false } })
        const value = await positionOf(page, 'value')
        const radius = (p: { x: number, y: number }) => Math.hypot(p.x - value.x, p.y - value.y)
        const group = radius(await positionOf(page, await groupOf(page, 'ev-1')))
        const looseObject = radius(await positionOf(page, 'ev-2-obj-0'))
        expect(group).toBeCloseTo(looseObject, 0)
    })

    test('opening a group puts its members on the level it held', async ({ page }) => {
        await load(page)
        const id = await groupOf(page, 'ev-1')
        const level = (await positionOf(page, id)).x
        await page.evaluate((id) => window.__pivotick.graph!.simplify.open(id), id)
        for (const member of ['ev-1-obj-0', 'ev-1-obj-5', 'ev-1-obj-11']) {
            expect((await positionOf(page, member)).x).toBeCloseTo(level, 0)
        }
    })
})

test.describe('the opening fit', () => {
    test('is done by the time `ready` fires', async ({ page }) => {
        await harness(page, 'setContainerSize', 400, 300)
        await load(page, { UI: { mode: 'viewer' } })
        const atReady = await page.evaluate(() => window.__pivotick.zoomAtReady)
        const settled = await zoom(page)
        expect(settled).toBeLessThan(0.9)
        expect(atReady).toBeCloseTo(settled, 3)
    })

    test('`minFitScale` holds the zoom and centres the anchor’s row, the view stopping at the content’s edge', async ({ page }) => {
        await harness(page, 'setContainerSize', 600, 300)
        await load(page, { UI: { mode: 'viewer' }, render: { minFitScale: 1, fitAnchor: 'value' } })
        expect(await zoom(page)).toBe(1)
        const value = await onScreen(page, 'value')
        // The value is the tree's leftmost dot: the view stops there rather than centring it.
        expect(value.x).toBeGreaterThan(0)
        expect(value.x).toBeLessThan(value.width / 4)
        expect(value.y).toBeCloseTo(value.height / 2, 0)
    })

    test('`minFitScale` below the fitted zoom changes nothing', async ({ page }) => {
        await harness(page, 'setContainerSize', 600, 300)
        await load(page, { UI: { mode: 'viewer' } })
        const fitted = await zoom(page)
        await load(page, { UI: { mode: 'viewer' }, render: { minFitScale: fitted / 2, fitAnchor: 'value' } })
        expect(await zoom(page)).toBeCloseTo(fitted, 3)
    })
})

test.describe('a group’s line', () => {
    test('keeps the label its members share, and stays dotted', async ({ page }) => {
        await load(page, { render: { minLabelFontSize: 0 } })
        expect(await lineIntoGroup(page, await groupOf(page, 'ev-1'))).toEqual({ synthetic: true, label: 'ip-dst' })
    })

    test('carries no label when its members’ labels differ', async ({ page }) => {
        await load(page, { render: { minLabelFontSize: 0 } })
        expect(await lineIntoGroup(page, await groupOf(page, 'ev-3'))).toEqual({ synthetic: true, label: null })
    })
})
