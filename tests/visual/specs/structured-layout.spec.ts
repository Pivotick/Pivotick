import type { Page } from '@playwright/test'
import { test, expect, gotoHarness, harness, loadFixture, expectCanvas, nodeEl } from '../helpers'

/**
 * The structured layout, on an event's object graph: two detection objects blocking the
 * same eight URLs, a file with four neighbours, and a domain nothing references. Read off
 * the model and the drawn labels; one screenshot for the picture as a whole.
 */

const URLS = ['intgmx', 'axwscw', 'kgodir', 'nvbvod', 'qpdjrn', 'isannt', 'pofkwn', 'xlalfg'].map((name) => `url-${name}`)
const FAN_PARENTS = ['suricata', 'script']
const FILE_NEIGHBOURS = ['email', 'dropped-script', 'registry-key', 'crypto-material']
const CONNECTED = [...URLS, ...FAN_PARENTS, 'file', ...FILE_NEIGHBOURS]

type Point = { x: number, y: number }
type Side = 'top' | 'bottom' | 'left' | 'right'

/** A small embedded viewer, the box the layout is for. */
const loadInCard = async (page: Page, overrides: object = {}, size: [number, number] = [580, 400]): Promise<void> => {
    await page.evaluate(([w, h]) => window.__pivotick.setContainerSize(w, h), size)
    await harness(page, 'loadObjectGraph', overrides)
}

const positions = (page: Page): Promise<Record<string, Point & { pinned: boolean }>> =>
    page.evaluate(() => Object.fromEntries(window.__pivotick.graph!.getCanvasNodes().map((node) => [
        node.id,
        { x: node.x ?? NaN, y: node.y ?? NaN, pinned: node.fx === node.x && node.fy === node.y },
    ])))

const zoom = (page: Page): Promise<number> =>
    page.evaluate(() => (window.__pivotick.graph!.renderer as unknown as { getZoomTransform: () => { k: number } }).getZoomTransform().k)

const layoutType = (page: Page): Promise<string> =>
    page.evaluate(() => window.__pivotick.graph!.simulation.getLayoutType())

const spread = (values: number[]): number => Math.max(...values) - Math.min(...values)

/** Whether the URLs sit on one line — a shared x (a column) or a shared y (a row) — evenly spaced. */
const linedUp = (at: Record<string, Point>): boolean => {
    const points = URLS.map((id) => at[id])
    const column = spread(points.map((p) => p.x)) < 1
    const row = spread(points.map((p) => p.y)) < 1
    if (!column && !row) return false
    const along = points.map((p) => (column ? p.y : p.x)).sort((a, b) => a - b)
    const steps = along.slice(1).map((value, i) => value - along[i])
    return spread(steps) < 1
}

/** Which side of the URL line a point is on: -1 or 1, across the line. */
const sideOfFan = (at: Record<string, Point>, point: Point): number => {
    const column = spread(URLS.map((id) => at[id].x)) < 1
    const line = column ? at[URLS[0]].x : at[URLS[0]].y
    return Math.sign((column ? point.x : point.y) - line)
}

/** The largest angle between two neighbours seen from the hub: under 180° means it is surrounded. */
const widestGap = (hub: Point, around: Point[]): number => {
    const angles = around.map((p) => Math.atan2(p.y - hub.y, p.x - hub.x)).sort((a, b) => a - b)
    const gaps = angles.map((angle, i) => (i + 1 < angles.length ? angles[i + 1] : angles[0] + 2 * Math.PI) - angle)
    return Math.max(...gaps) * 180 / Math.PI
}

/** The box a set of nodes spans, centres only. */
const boxOf = (at: Record<string, Point>, ids: string[]) => ({
    left: Math.min(...ids.map((id) => at[id].x)),
    right: Math.max(...ids.map((id) => at[id].x)),
    top: Math.min(...ids.map((id) => at[id].y)),
    bottom: Math.max(...ids.map((id) => at[id].y)),
})

const overlap = (a: ReturnType<typeof boxOf>, b: ReturnType<typeof boxOf>): boolean =>
    a.left <= b.right && b.left <= a.right && a.top <= b.bottom && b.top <= a.bottom

/** Which side of its node a label is drawn on, measured on screen. */
const drawnLabelSide = async (page: Page, id: string): Promise<Side> => {
    const label = await nodeEl(page, id).locator('.pvt-node-label-group').boundingBox()
    const centre = await page.evaluate((id) => {
        const graph = window.__pivotick.graph!
        const node = graph.getCanvasNode(id)!
        const t = (graph.renderer as unknown as { getZoomTransform: () => { k: number, x: number, y: number } }).getZoomTransform()
        const canvas = graph.renderer.getCanvas().getBoundingClientRect()
        return { x: canvas.left + t.k * (node.x ?? 0) + t.x, y: canvas.top + t.k * (node.y ?? 0) + t.y }
    }, id)
    if (!label) throw new Error(`${id} has no label`)
    const dx = label.x + label.width / 2 - centre.x
    const dy = label.y + label.height / 2 - centre.y
    if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left'
    return dy > 0 ? 'bottom' : 'top'
}

test.beforeEach(async ({ page }) => {
    await gotoHarness(page)
})

test.describe('choosing the layout', () => {
    test('simulation.layout is honoured when the top-level layout is not set', async ({ page }) => {
        await loadFixture(page, 'objectGraph', { simulation: { layout: { type: 'structured' } } })
        expect(await layoutType(page)).toBe('structured')
        expect(linedUp(await positions(page))).toBe(true)
    })

    test('the top-level layout wins when both are set', async ({ page }) => {
        await loadFixture(page, 'objectGraph', { layout: { type: 'tree' }, simulation: { layout: { type: 'structured' } } })
        expect(await layoutType(page)).toBe('tree')
    })

    test('changeLayout switches into it and back out', async ({ page }) => {
        await loadFixture(page, 'objectGraph')
        expect(linedUp(await positions(page))).toBe(false)

        await page.evaluate(() => window.__pivotick.graph!.simulation.changeLayout('structured'))
        expect(linedUp(await positions(page))).toBe(true)

        await page.evaluate(() => window.__pivotick.graph!.simulation.changeLayout('force'))
        const unpinned = await page.evaluate(() => window.__pivotick.graph!.getCanvasNodes().every((node) => node.fx === undefined && node.fy === undefined))
        expect(unpinned).toBe(true)
    })
})

test.describe('where nodes go', () => {
    test('a fan of like leaves lines up as one evenly spaced row or column', async ({ page }) => {
        await loadInCard(page)
        expect(linedUp(await positions(page))).toBe(true)
    })

    test('both parents of a fan sit on the same side of it', async ({ page }) => {
        await loadInCard(page)
        const at = await positions(page)
        const sides = FAN_PARENTS.map((id) => sideOfFan(at, at[id]))
        expect(sides[0]).not.toBe(0)
        expect(sides[0]).toBe(sides[1])
    })

    test('a hub is surrounded by its neighbours', async ({ page }) => {
        await loadInCard(page)
        const at = await positions(page)
        expect(widestGap(at.file, FILE_NEIGHBOURS.map((id) => at[id]))).toBeLessThan(180)
    })

    test('the components do not overlap', async ({ page }) => {
        await loadInCard(page)
        const at = await positions(page)
        const fan = boxOf(at, [...URLS, ...FAN_PARENTS])
        const star = boxOf(at, ['file', ...FILE_NEIGHBOURS])
        expect(overlap(fan, star)).toBe(false)
    })

    test('a node with no edge goes in the tray below everything else', async ({ page }) => {
        await loadInCard(page)
        const at = await positions(page)
        expect(at['domain-ip'].y).toBeGreaterThan(boxOf(at, CONNECTED).bottom)
    })

    test('trayPosition: right puts it beside everything else', async ({ page }) => {
        await loadInCard(page, { layout: { trayPosition: 'right' } })
        const at = await positions(page)
        expect(at['domain-ip'].x).toBeGreaterThan(boxOf(at, CONNECTED).right)
    })

    test('direction: column stands the fan up whatever the canvas', async ({ page }) => {
        await loadInCard(page, { layout: { direction: 'column' } })
        const at = await positions(page)
        expect(spread(URLS.map((id) => at[id].x))).toBeLessThan(1)
    })

    test('groupMin above the fan size places its leaves one by one, around their parents', async ({ page }) => {
        await loadInCard(page, { layout: { groupMin: 9 } })
        const at = await positions(page)
        expect(linedUp(at)).toBe(false)
        const between = { x: (at.suricata.x + at.script.x) / 2, y: (at.suricata.y + at.script.y) / 2 }
        expect(widestGap(between, URLS.map((id) => at[id]))).toBeLessThan(180)
    })

    test('every node is pinned where it was placed', async ({ page }) => {
        await loadInCard(page)
        const at = await positions(page)
        expect(Object.entries(at).filter(([, p]) => !p.pinned).map(([id]) => id)).toEqual([])
    })

    test('the same graph gives the same picture', async ({ page }) => {
        await loadInCard(page)
        const first = await positions(page)
        await loadInCard(page)
        expect(await positions(page)).toEqual(first)
    })

    test('the card fits the graph at a larger zoom than the force layout does', async ({ page }) => {
        await loadInCard(page)
        const structured = await zoom(page)
        await loadInCard(page, { layout: { type: 'force' } })
        expect(structured).toBeGreaterThan(await zoom(page))
    })
})

test.describe('labels', () => {
    test("a fan's labels sit on the side away from its parents", async ({ page }) => {
        // A portrait card stands the fan up, so the side asked for is not the style's own, below.
        await loadInCard(page, {}, [400, 600])
        const at = await positions(page)
        expect(spread(URLS.map((id) => at[id].x))).toBeLessThan(1)
        const away: Side = sideOfFan(at, at.suricata) < 0 ? 'right' : 'left'
        for (const id of URLS) expect(await drawnLabelSide(page, id)).toBe(away)
    })

    test("a parent's label sits on the side its edges leave free", async ({ page }) => {
        await loadInCard(page)
        const at = await positions(page)
        const column = spread(URLS.map((id) => at[id].x)) < 1
        const fanIs = sideOfFan(at, at.suricata) < 0 ? (column ? 'right' : 'bottom') : (column ? 'left' : 'top')
        const opposite: Record<Side, Side> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' }
        expect(await drawnLabelSide(page, 'suricata')).toBe(opposite[fanIs as Side])
    })

    test('labelSides: false leaves every label where the style put it', async ({ page }) => {
        await loadInCard(page, { layout: { labelSides: false } })
        for (const id of [...URLS, ...FAN_PARENTS]) expect(await drawnLabelSide(page, id)).toBe('bottom')
    })
})

test.describe('interaction', () => {
    test('a dragged node stays where it is dropped, and nothing else moves', async ({ page }) => {
        await loadInCard(page)
        const before = await positions(page)
        const box = await nodeEl(page, 'file').locator('.node').first().boundingBox()
        if (!box) throw new Error('file is not drawn')
        const [x, y] = [box.x + box.width / 2, box.y + box.height / 2]
        await page.mouse.move(x, y)
        await page.mouse.down()
        await page.mouse.move(x + 40, y + 30, { steps: 8 })
        await page.mouse.up()
        await page.waitForTimeout(300)

        const after = await positions(page)
        expect(Math.hypot(after.file.x - before.file.x, after.file.y - before.file.y)).toBeGreaterThan(20)
        const others = Object.keys(before).filter((id) => id !== 'file')
        expect(others.filter((id) => after[id].x !== before[id].x || after[id].y !== before[id].y)).toEqual([])
    })

    test('the physics flyout lights no tile and offers no tree controls', async ({ page }) => {
        await loadInCard(page, { UI: { mode: 'full' } }, [1280, 800])
        await page.evaluate(() => window.__pivotick.graph!.UIManager.modeStore.setMode('physics'))
        const panel = page.locator('.pvt-flyout-panel.pvt-flyout-physics')
        await expect(panel.locator('.pvt-physicsflyout-layout.active')).toHaveCount(0)
        await expect(panel.locator('.pvt-physicsflyout-rootrow')).toBeHidden()
        await expect(panel.locator('.pvt-physicsflyout-spacing')).toBeHidden()
    })
})

test('an object graph in a small viewer', async ({ page }) => {
    await loadInCard(page, { UI: { mode: 'viewer' } })
    await expectCanvas(page, 'structured-object-graph.png')
})
