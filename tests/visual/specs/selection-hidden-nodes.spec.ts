import { test, expect, gotoHarness, loadFixture, harness } from '../helpers'

// ── Selecting nodes that aren't on screen ────────────────────────────────────
// A hidden node can be selected without ever being drawn — from a filtered-out
// search result, or a row in the data dock. Its element is gone from the DOM, so
// nothing highlights; focus-mode dimming must not fire on the strength of a
// selection like that, or the canvas greys out with nothing lit and reads as
// broken.
//
// Also covers the plural selection API (selectElements / addToSelection /
// removeFromSelection), which is what a row-based surface needs.

type Page = import('@playwright/test').Page

/* eslint-disable @typescript-eslint/no-explicit-any */

/** How many nodes are currently dimmed by focus mode. */
const dimmedCount = (page: Page) =>
    page.locator('.pvt-node-selected-highlight-shadow').count()

/** How many nodes are drawn as selected. */
const litCount = (page: Page) =>
    page.locator('.pvt-node-selected-highlight').count()

const selectIds = (page: Page, ids: string[], method = 'selectElements') =>
    page.evaluate(([m, list]) => {
        const graph = (window.__pivotick as any).graph
        const nodes = (list as string[]).map((id) => graph.getMutableNode(id)).filter(Boolean)
        graph[m as string](nodes)
    }, [method, ids] as const)

/** Select a mixture of a node and an edge, to exercise the guard. */
const selectNodeAndEdge = (page: Page, nodeId: string, edgeId: string) =>
    page.evaluate(([n, e]) => {
        const graph = (window.__pivotick as any).graph
        graph.selectElements([graph.getMutableNode(n), graph.getMutableEdge(e)])
    }, [nodeId, edgeId] as const)

const selectedIds = (page: Page) => harness(page, 'selectedNodeIds') as Promise<string[]>

test.describe('selecting hidden nodes', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
        await loadFixture(page, 'basic')
    })

    // Precondition: focus-mode dimming works at all. `a` is adjacent to b, e and
    // hub, so c and d are the ones that dim.
    test('selecting a visible node dims the non-adjacent ones', async ({ page }) => {
        await harness(page, 'selectNode', 'a')

        expect(await litCount(page)).toBe(1)
        expect(await dimmedCount(page)).toBeGreaterThan(0)
    })

    // The bug: nothing is lit, so nothing should be dimmed either.
    test('selecting only a hidden node dims nothing', async ({ page }) => {
        await harness(page, 'hideNode', 'a')
        await harness(page, 'selectNode', 'a')

        // It really is selected — the selection is tracked by id, not by element.
        expect(await selectedIds(page)).toEqual(['a'])
        // …but it isn't drawn, so the canvas must be left alone.
        expect(await litCount(page)).toBe(0)
        expect(await dimmedCount(page)).toBe(0)
    })

    // One visible node in the selection is enough to justify dimming.
    test('a mixed visible + hidden selection dims normally', async ({ page }) => {
        await harness(page, 'hideNode', 'a')
        await selectIds(page, ['a', 'b'])

        expect((await selectedIds(page)).sort()).toEqual(['a', 'b'])
        expect(await litCount(page)).toBe(1)          // only `b` is drawable
        expect(await dimmedCount(page)).toBeGreaterThan(0)
    })
})

test.describe('plural selection API', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
        await loadFixture(page, 'basic')
    })

    test('selectElements replaces the selection', async ({ page }) => {
        await selectIds(page, ['a', 'b', 'c'])
        expect((await selectedIds(page)).sort()).toEqual(['a', 'b', 'c'])

        await selectIds(page, ['d', 'e'])
        expect((await selectedIds(page)).sort()).toEqual(['d', 'e'])
    })

    test('addToSelection keeps what is already selected, and ignores duplicates', async ({ page }) => {
        await selectIds(page, ['a', 'b'])
        await selectIds(page, ['b', 'c'], 'addToSelection')

        expect((await selectedIds(page)).sort()).toEqual(['a', 'b', 'c'])
    })

    test('removeFromSelection leaves the rest in place', async ({ page }) => {
        await selectIds(page, ['a', 'b', 'c'])
        await selectIds(page, ['b'], 'removeFromSelection')

        expect((await selectedIds(page)).sort()).toEqual(['a', 'c'])
    })

    test('an empty array clears the selection', async ({ page }) => {
        await selectIds(page, ['a', 'b'])
        await selectIds(page, [])

        expect(await selectedIds(page)).toEqual([])
    })

    // Nodes and edges can't be selected together — the interaction layer clears
    // one kind when the other is set — so say so rather than silently dropping one.
    test('a mixed node + edge array selects the nodes and warns', async ({ page }) => {
        await selectNodeAndEdge(page, 'a', 'b-c')

        expect(await selectedIds(page)).toEqual(['a'])
        const warnings = (await harness(page, 'warnings')) as string[]
        expect(warnings.join('\n')).toContain('cannot select nodes and edges together')
    })
})
