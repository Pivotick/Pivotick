import { test, expect, gotoHarness, loadFixture } from '../helpers'

// ── The physics measures the container, not the canvas ───────────────────────
// The simulation derives its gravity centre and its density-based force scaling
// from a measured rectangle. That rectangle has to be the *root container*:
// chrome (a sidebar, the data dock) resizes the canvas, and a layout has to come
// out the same whether chrome happens to be open or not.
//
// These assert the *inputs* — the measured rect and the gravity centre — rather
// than settled node positions, so they don't depend on force outcomes.

type Page = import('@playwright/test').Page

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Where gravity is pulling, read straight off the live force. */
const gravityCentre = (page: Page) =>
    page.evaluate(() => {
        const gravity = (window.__pivotick as any).graph.simulation.simulationForces.gravity
        return { x: gravity.x(), y: gravity.y() }
    })

/** The rect the simulation tuned itself against. */
const measuredArea = (page: Page) =>
    page.evaluate(() => {
        const rect = (window.__pivotick as any).graph.simulation.containerBCR
        return { width: rect.width, height: rect.height }
    })

/** Charge strength after density scaling — zero means every force was wiped out. */
const scaledCharge = (page: Page) =>
    page.evaluate(() => (window.__pivotick as any).graph.simulation.scaledForces.d3ManyBodyStrength)

const boxOf = (page: Page, selector: string) =>
    page.evaluate((s) => {
        const rect = document.querySelector(s)!.getBoundingClientRect()
        return { width: rect.width, height: rect.height }
    }, selector)

/** Give the ResizeObserver a couple of frames to land. */
const settleObserver = (page: Page) =>
    page.evaluate(() => new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    }))

/** `full` mode so the sidebar takes real width off the canvas. */
const FULL = { UI: { mode: 'full', sidebar: { collapsed: false } } }

test.describe('physics container measurement', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    // The whole point: with a sidebar open the canvas is narrower than the
    // container, and gravity must follow the container.
    test('gravity centres on the container, not the narrower canvas', async ({ page }) => {
        await loadFixture(page, 'basic', FULL)

        const container = await boxOf(page, '.pivotick')
        const canvas = await boxOf(page, '.pvt-canvas')

        // Precondition — without this the test proves nothing.
        expect(canvas.width).toBeLessThan(container.width)

        expect(await measuredArea(page)).toEqual({ width: container.width, height: container.height })
        expect(await gravityCentre(page)).toEqual({ x: container.width / 2, y: container.height / 2 })
    })

    // Chrome opening is exactly this: the canvas shrinks, the container doesn't.
    // Stands in for the data dock, which shrinks the canvas the same way.
    test('shrinking the canvas leaves the physics untouched', async ({ page }) => {
        await loadFixture(page, 'basic', FULL)

        const before = await gravityCentre(page)
        const area = await measuredArea(page)

        await page.evaluate(() => {
            (document.querySelector('.pvt-canvas') as HTMLElement).style.height = '360px'
        })
        await settleObserver(page)

        // The canvas really did change…
        const canvas = await boxOf(page, '.pvt-canvas')
        expect(canvas.height).toBeCloseTo(360, 0)

        // …and the physics did not notice.
        expect(await gravityCentre(page)).toEqual(before)
        expect(await measuredArea(page)).toEqual(area)
    })

    // A real container resize *should* re-tune — that is the canvas-adaptive
    // behaviour an embeddable library wants to keep.
    test('resizing the container re-aims gravity', async ({ page }) => {
        await loadFixture(page, 'basic', FULL)

        await page.evaluate(() => window.__pivotick.setContainerSize(900, 600))
        await settleObserver(page)

        expect(await measuredArea(page)).toEqual({ width: 900, height: 600 })
        expect(await gravityCentre(page)).toEqual({ x: 450, y: 300 })
    })

    // A zero-area container would make the density divide by zero, scaling every
    // force to nothing and collapsing the graph onto the gravity point.
    test('a zero-area container falls back instead of zeroing the forces', async ({ page }) => {
        await loadFixture(page, 'basic', FULL)

        await page.evaluate(() => window.__pivotick.setContainerSize(0, 0))
        await settleObserver(page)

        const area = await measuredArea(page)
        expect(area.width).toBeGreaterThan(0)
        expect(area.height).toBeGreaterThan(0)
        expect(await scaledCharge(page)).not.toBe(0)
    })
})
