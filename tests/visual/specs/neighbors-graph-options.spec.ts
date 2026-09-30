import type { Page } from '@playwright/test'
import { test, expect, gotoHarness, harness } from '../helpers'

// ── The neighbours panel's graph takes its own options ───────────────────────
// `neighborsPanel.graph.render` is merged over the render options the ego graph
// inherits from the main graph, and `neighborsPanel.graph.layout` over its
// radial egoTree layout. `fitAndCenter` stops at a lower `render.maxZoom`.
// Fixture `filterable`: r1–r3 routers in a triangle, h3 a host whose one
// neighbour is sw2.

const FULL = { UI: { mode: 'full', sidebar: { collapsed: false } } }
const EGO = '.main-egograph-container'

const RED = 'rgb(255, 0, 0)'
const GREEN = 'rgb(0, 170, 0)'

async function load(page: Page, neighborsGraph?: object, render: object = {}): Promise<void> {
    await harness(page, 'loadTypedFilterable', {
        ...FULL,
        render,
        UI: { ...FULL.UI, neighborsPanel: neighborsGraph ? { graph: neighborsGraph } : {} },
    })
}

/** Select a node and wait for its ego graph to be drawn and shown. */
async function openEgoGraph(page: Page, id: string, neighbour: string): Promise<void> {
    await harness(page, 'selectNode', id)
    await expect.poll(() => harness(page, 'egoNodeFill', neighbour)).not.toBeNull()
    await expect(page.locator(EGO)).toHaveCSS('visibility', 'visible')
}

/** A node shape's fill, in the ego graph or in the main graph. */
async function nodeFill(page: Page, id: string, where: 'ego' | 'main'): Promise<string | null> {
    if (where === 'ego') return harness(page, 'egoNodeFill', id) as Promise<string | null>
    const paint = await harness(page, 'nodeShapePaint', id) as { fill: string } | null
    return paint?.fill ?? null
}

/** The ego graph's current zoom scale, read off its zoom layer. */
function egoScale(page: Page): Promise<number> {
    return page.evaluate((ego) => {
        const layer = document.querySelector(`${ego} .zoom-layer`) as SVGGraphicsElement | null
        return layer?.transform.baseVal.consolidate()?.matrix.a ?? 1
    }, EGO)
}

/** Distance between two nodes in the ego graph, in graph units. */
async function egoDistance(page: Page, a: string, b: string): Promise<number> {
    type Point = { x: number, y: number }
    const pa = await harness(page, 'egoNodePosition', a) as Point
    const pb = await harness(page, 'egoNodePosition', b) as Point
    return Math.hypot(pa.x - pb.x, pa.y - pb.y)
}

/** Wait for the ego graph's fit to finish: two reads a frame apart agree. */
async function settledEgoScale(page: Page): Promise<number> {
    let previous = NaN
    await expect.poll(async () => {
        const current = await egoScale(page)
        const settled = current === previous
        previous = current
        return settled
    }, { intervals: [150] }).toBe(true)
    return previous
}

test.describe('neighbours graph options', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    test('with nothing set, the ego graph draws with the main graph styles', async ({ page }) => {
        await load(page, undefined, { nodeStyleMap: { router: { color: RED } } })
        await openEgoGraph(page, 'r1', 'r2')
        expect(await nodeFill(page, 'r2', 'ego')).toBe(RED)
    })

    test('graph.render styles reach the ego graph and leave the main graph alone', async ({ page }) => {
        await load(page, { render: { nodeStyleMap: { router: { color: GREEN } } } }, { nodeStyleMap: { router: { color: RED } } })
        await openEgoGraph(page, 'r1', 'r2')
        expect(await nodeFill(page, 'r2', 'ego')).toBe(GREEN)
        expect(await nodeFill(page, 'r2', 'main')).toBe(RED)
    })

    test('the panel keeps its own settings over the host\'s', async ({ page }) => {
        await load(page, { render: { zoomEnabled: true, dragEnabled: true } })
        await openEgoGraph(page, 'r1', 'r2')
        const scale = await settledEgoScale(page)

        // Zoom stays off: a wheel over the panel graph does not change its scale.
        await page.locator(EGO).hover()
        await page.mouse.wheel(0, -400)
        await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 300)))
        expect(await egoScale(page)).toBe(scale)
    })

    test('graph.layout reaches the ego graph', async ({ page }) => {
        await load(page, { layout: { radialGap: 60, spacing: 'manual' } })
        await openEgoGraph(page, 'h3', 'sw2')
        const tight = await egoDistance(page, 'h3', 'sw2')

        await load(page, { layout: { radialGap: 240, spacing: 'manual' } })
        await openEgoGraph(page, 'h3', 'sw2')
        const wide = await egoDistance(page, 'h3', 'sw2')

        expect(wide).toBeGreaterThan(tight * 2)
    })

    test('a one-neighbour ego graph zooms in past 1 by default', async ({ page }) => {
        await load(page)
        await openEgoGraph(page, 'h3', 'sw2')
        expect(await settledEgoScale(page)).toBeGreaterThan(1)
    })

    test('with graph.render.maxZoom 1, a one-neighbour ego graph fits at 1', async ({ page }) => {
        await load(page, { render: { maxZoom: 1 } })
        await openEgoGraph(page, 'h3', 'sw2')
        expect(await settledEgoScale(page)).toBeCloseTo(1, 5)
    })

    // Built while the collapsed sidebar gave it no width, the ego graph used to skip its
    // fit and stay pinned to the top-left corner once the sidebar opened.
    test('an ego graph built in a collapsed sidebar fits once the sidebar opens', async ({ page }) => {
        await load(page)
        await openEgoGraph(page, 'r1', 'r2')
        await settledEgoScale(page)
        const fitted = await egoViewport(page)

        await harness(page, 'loadTypedFilterable', { UI: { mode: 'full', sidebar: { collapsed: true } } })
        await harness(page, 'selectNode', 'r1')
        await expect.poll(() => harness(page, 'egoNodeFill', 'r2')).not.toBeNull()
        await page.locator('.pvt-sidebar-collapse-container').click()

        await expect.poll(() => egoViewport(page)).toEqual(fitted)
    })
})

/** The ego graph's zoom layer transform, rounded so two equal fits compare equal. */
function egoViewport(page: Page): Promise<{ x: number, y: number, scale: number }> {
    return page.evaluate((ego) => {
        const layer = document.querySelector(`${ego} .zoom-layer`) as SVGGraphicsElement | null
        const m = layer?.transform.baseVal.consolidate()?.matrix
        const round = (v: number) => Math.round(v * 100) / 100
        return { x: round(m?.e ?? 0), y: round(m?.f ?? 0), scale: round(m?.a ?? 1) }
    }, EGO)
}
