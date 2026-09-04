import type { Page } from '@playwright/test'
import { test, expect, gotoHarness, harness, loadFixture } from '../helpers'
import type { RecordedEdgeBinding, RecordedPlacement } from '../harness/harness'

// `graph.updateData` with an id the graph already holds. The signature says the
// existing node is "replaced", and it used to be replaced *literally* — a new Node
// object written into the map under the old id. Everything else in the library went
// on holding the old one: its edges, the simulation, the DOM binding. And everything
// the old object had learned since it was constructed went with it.
//
// So these assertions are structural rather than visual. A graph whose edges point at
// discarded nodes screenshots perfectly, right up until something moves.

const binding = async (page: Page, edgeId: string): Promise<RecordedEdgeBinding> =>
    (await harness(page, 'edgeBinding', edgeId)) as RecordedEdgeBinding

const placement = async (page: Page, id: string): Promise<RecordedPlacement> =>
    (await harness(page, 'nodePlacement', id)) as RecordedPlacement

const sources = async (page: Page, nodeId: string): Promise<string[]> =>
    (await harness(page, 'nodeSources', nodeId)) as string[]

const dataOf = async (page: Page, id: string): Promise<Record<string, unknown>> =>
    (await harness(page, 'nodeData', id)) as Record<string, unknown>

const degree = async (page: Page, id: string): Promise<{ out: number; in: number }> =>
    (await harness(page, 'nodeDegree', id)) as { out: number; in: number }

const ends = async (page: Page, edgeId: string): Promise<{ from: string; to: string }> =>
    (await harness(page, 'edgeEnds', edgeId)) as { from: string; to: string }

const refresh = async (page: Page, id: string): Promise<void> => {
    await harness(page, 'updateExistingNode', id, { label: 'refreshed' })
}

test.describe('updateData — the graph keeps using the node it already had', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
        await loadFixture(page, 'basic')
    })

    test('the new data lands', async ({ page }) => {
        await refresh(page, 'a')

        expect((await dataOf(page, 'a')).label).toBe('refreshed')
    })

    test('the edges on both sides of it still hang off it', async ({ page }) => {
        await refresh(page, 'a')

        // `a-b` leaves the updated node and `e-a` arrives at it, so both the `from` and
        // the `to` side are checked. Each must name the very Node the graph holds, and
        // that node must count the edge in its own degree.
        for (const edgeId of ['a-b', 'e-a']) {
            const bound = await binding(page, edgeId)
            expect(bound.bound, `${edgeId} is bound to the graph's node`).toBe(true)
            expect(bound.counted, `${edgeId} is counted by its endpoints`).toBe(true)
        }
    })

    test('it stays where it was, and stays pinned there', async ({ page }) => {
        await harness(page, 'moveNode', 'a', 120, 80)

        await refresh(page, 'a')

        expect(await placement(page, 'a')).toEqual({ x: 120, y: 80, pinned: true })
    })
})

test.describe('updateData — an updated edge leaves no second copy behind', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
        await loadFixture(page, 'basic')
    })

    test('refreshing an edge does not double-count it on its endpoints', async ({ page }) => {
        const before = { a: await degree(page, 'a'), b: await degree(page, 'b') }

        await harness(page, 'updateExistingEdge', 'a-b')

        // Building the incoming Edge registered it on both endpoints. Discarding it
        // without unregistering left the pair counting `a-b` twice.
        expect(await degree(page, 'a')).toEqual(before.a)
        expect(await degree(page, 'b')).toEqual(before.b)
        expect((await binding(page, 'a-b')).counted).toBe(true)
    })

    test('an edge moved to another node stops being counted by the one it left', async ({ page }) => {
        const before = { a: await degree(page, 'a'), b: await degree(page, 'b'), c: await degree(page, 'c') }

        await harness(page, 'updateExistingEdge', 'a-b', 'a', 'c')

        expect(await ends(page, 'a-b')).toEqual({ from: 'a', to: 'c' })
        expect(await degree(page, 'a')).toEqual(before.a)
        expect(await degree(page, 'b')).toEqual({ ...before.b, in: before.b.in - 1 })
        expect(await degree(page, 'c')).toEqual({ ...before.c, in: before.c.in + 1 })
        expect((await binding(page, 'a-b')).counted).toBe(true)
    })
})

test.describe('updateData — the graph keeps what the node had learned', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
        await harness(page, 'loadWithPivots', 'basic', {})
        await page.locator('.zoom-layer:not(.hidden)').first().waitFor({ state: 'attached' })
    })

    test('a pivot still vouches for an ingested node whose data was refreshed', async ({ page }) => {
        await harness(page, 'runPivot', 'misp-event-objects', ['a'])
        expect(await sources(page, 'event-a')).toEqual(['misp-event-objects'])

        await refresh(page, 'event-a')

        // A replacement reported 'seed' here — the answer for a node no pivot vouches
        // for — so removal by source stopped reaching anything that had been updated.
        expect(await sources(page, 'event-a')).toEqual(['misp-event-objects'])

        const dropped = (await harness(page, 'removeBySource', 'misp-event-objects')) as {
            nodes: string[]
        }
        expect(dropped.nodes).toContain('event-a')
        expect(await harness(page, 'hasGraphNode', 'event-a')).toBe(false)
    })
})
