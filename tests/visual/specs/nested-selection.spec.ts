import { test, expect, gotoHarness, loadFixture, harness, canvas, nodeEl, centerOf, expectCanvas, waitForViewSettled } from '../helpers'

// ── Selecting a node inside a closed cluster ─────────────────────────────────
// A host that keeps its clusters shut (`render.enableNodeExpansion: false`) still
// selects what is inside them: from its own sidebar, from search, from the dock.
// The child is never drawn, so the canvas lights the cluster drawn for it and the
// camera goes there. The selection itself stays the child, so the sidebar can
// show what was asked for.
//
// Fixture `clusteredTable`: `team-a` holds a1..a4, `team-b` holds b1, b2 and the
// cluster `squad` (s1, s2). `gateway` links to a2 and `store`; `store` links to
// nothing inside `team-a`, so it is the node focus mode shades for `team-a`.

type Page = import('@playwright/test').Page

/* eslint-disable @typescript-eslint/no-explicit-any */

const SHUT = { UI: { mode: 'full' }, render: { enableNodeExpansion: false, enableFocusMode: true } }

const loadShut = async (page: Page, overrides: Record<string, unknown> = SHUT) => {
    await loadFixture(page, 'clusteredTable' as never, overrides)
    await waitForViewSettled(page)
}

const selectedIds = (page: Page) => harness(page, 'selectedNodeIds') as Promise<string[]>

/** The nodes the main canvas draws with the selection ring (the sidebar's neighbour graph rings its own copy). */
const ringedIds = (page: Page) =>
    canvas(page).locator('g.pvt-node.pvt-node-selected-highlight')
        .evaluateAll((els) => els.map((el) => el.id.replace(/^node-/, '')).sort())

/** Whether focus mode has shaded a drawn node. */
const isDimmed = async (page: Page, id: string) =>
    /pvt-node-selected-highlight-shadow/.test(await nodeEl(page, id).getAttribute('class') ?? '')

const isExpanded = (page: Page, id: string) =>
    page.evaluate((nodeId) => (window.__pivotick as any).graph.getMutableNode(nodeId).expanded === true, id)

/** How far, in screen pixels, a drawn node sits from the middle of the canvas. */
async function offCentre(page: Page, id: string): Promise<number> {
    const node = await centerOf(nodeEl(page, id))
    const middle = await centerOf(page.locator('svg.pvt-canvas-element').first())
    return Math.hypot(node.x - middle.x, node.y - middle.y)
}

/** Wait out `focusElement`'s 300ms camera transition, then read how far off-centre `id` is. */
const settledOffCentre = async (page: Page, id: string) => {
    await waitForViewSettled(page)
    return offCentre(page, id)
}

const CENTRED = 4

test.describe('a child of a closed cluster, selected', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
        await loadShut(page)
    })

    test('lights its cluster, and the child stays the selection', async ({ page }) => {
        await harness(page, 'selectNode', 'a1')

        expect(await selectedIds(page)).toEqual(['a1'])
        expect(await ringedIds(page)).toEqual(['team-a'])
        // Focus mode shades what the cluster does not touch, and nothing it does.
        expect(await isDimmed(page, 'store')).toBe(true)
        expect(await isDimmed(page, 'team-a')).toBe(false)
        expect(await isDimmed(page, 'gateway')).toBe(false)
        await expectCanvas(page, 'nested-child-lights-cluster.png')
    })

    test('two levels down, it lights the outermost closed cluster', async ({ page }) => {
        await harness(page, 'selectNode', 's1')

        expect(await selectedIds(page)).toEqual(['s1'])
        expect(await ringedIds(page)).toEqual(['team-b'])
    })

    test('cluster, then child, then cluster again: one ring each time', async ({ page }) => {
        for (const id of ['team-a', 'a1', 'team-a']) {
            await harness(page, 'selectNode', id)
            expect(await selectedIds(page)).toEqual([id])
            expect(await ringedIds(page)).toEqual(['team-a'])
        }
    })

    test('focusElement on the child centres its cluster', async ({ page }) => {
        // Precondition: the fit leaves `team-a` well left of centre, so a no-op can't pass.
        expect(await offCentre(page, 'team-a')).toBeGreaterThan(50)

        await page.evaluate(() => {
            const graph = (window.__pivotick as any).graph
            graph.focusElement(graph.getMutableNode('a1'))
        })

        expect(await settledOffCentre(page, 'team-a')).toBeLessThan(CENTRED)
    })
})

test.describe('reaching a child of a closed cluster', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    test('a search pick selects the child and centres its cluster, which stays shut', async ({ page }) => {
        await loadShut(page)
        expect(await offCentre(page, 'team-a')).toBeGreaterThan(50)

        await page.locator('#pvt-searchbox-button').click()
        await page.locator('#pvt-search-input').fill('a1')
        await expect(page.locator('.pvt-search-result')).toHaveCount(1)
        await page.locator('#pvt-search-input').press('Enter')

        await expect.poll(() => selectedIds(page)).toEqual(['a1'])
        expect(await ringedIds(page)).toEqual(['team-a'])
        expect(await settledOffCentre(page, 'team-a')).toBeLessThan(CENTRED)
        expect(await isExpanded(page, 'team-a')).toBe(false)
    })

    test('double-clicking its dock row centres its cluster without opening it', async ({ page }) => {
        await loadShut(page, { ...SHUT, UI: { mode: 'full', table: { open: true } } })
        await page.locator('.pvt-table-row[data-id="a1"]').waitFor()
        expect(await offCentre(page, 'team-a')).toBeGreaterThan(50)

        await page.locator('.pvt-table-row[data-id="a1"]').dblclick()

        expect(await selectedIds(page)).toEqual(['a1'])
        expect(await settledOffCentre(page, 'team-a')).toBeLessThan(CENTRED)
        expect(await isExpanded(page, 'team-a')).toBe(false)
    })
})
