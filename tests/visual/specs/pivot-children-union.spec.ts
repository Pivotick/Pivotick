import type { Page } from '@playwright/test'
import { test, expect, gotoHarness, harness } from '../helpers'
import type { PivotFixtureSpec, RecordedRunOutcome } from '../harness/harness'

// Children union by id (M1b): a pivot result whose node id matches one already on
// canvas merges its children in — added, never updated, never removed — and the
// union recurses. Plus the thing that makes the MISP walkthrough real: a container a
// pivot brought must expand like any other.
//
// Child sets are asserted numerically and by id: a screenshot cannot tell a merged
// cluster from a replaced one.

const load = async (page: Page, spec: PivotFixtureSpec = {}): Promise<void> => {
    await harness(page, 'loadWithPivots', 'basic', spec)
    await page.locator('.zoom-layer:not(.hidden)').first().waitFor({ state: 'attached' })
}

const run = async (
    page: Page,
    id: string,
    nodeIds: string[] = [],
    narrowing: Record<string, unknown> = {}
): Promise<RecordedRunOutcome> =>
    (await harness(page, 'runPivot', id, nodeIds, narrowing)) as RecordedRunOutcome

const childIds = async (page: Page, nodeId: string): Promise<string[]> =>
    (await harness(page, 'childIds', nodeId)) as string[]

test.describe('pivot children union', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    test('a container a pivot ingested expands like any other', async ({ page }) => {
        await load(page)
        await run(page, 'misp-event-objects', ['a'])

        expect(await childIds(page, 'event-a')).toHaveLength(12)
        // Children belong to the graph, not only to their parent's array.
        expect(await harness(page, 'nodeData', 'object-0')).not.toBeNull()

        await harness(page, 'expand', 'event-a')
        expect(await harness(page, 'isExpanded', 'event-a')).toBe(true)
        expect(await harness(page, 'subgraphNodeCount', 'event-a')).toBe(12)
    })

    test('a re-pivot adds children by id, updates none and removes none', async ({ page }) => {
        await load(page, {
            pivots: ['misp-event-objects', 'union-children'],
            // object-0 is already there, object-12 is new, and the container itself
            // matches a node on canvas so it dedups.
            union: { parent: 'event-a', children: ['object-0', 'object-12'] },
        })
        await run(page, 'misp-event-objects', ['a'])
        const before = await childIds(page, 'event-a')
        const containerData = await harness(page, 'nodeData', 'event-a')
        const matchedData = await harness(page, 'nodeData', 'object-0')

        const outcome = await run(page, 'union-children', ['a'])

        expect(outcome.status).toBe('staged')
        await harness(page, 'ingestPivot', 'union-children')

        // Added: one. Removed: none. The eleven the fragment never mentioned stay.
        expect(await childIds(page, 'event-a')).toEqual([...before, 'object-12'])
        // Updated: none — not the matching child's data, not the container's own.
        expect(await harness(page, 'nodeData', 'object-0')).toEqual(matchedData)
        expect(await harness(page, 'nodeData', 'event-a')).toEqual(containerData)
        // The new child is a node of the graph, not just an entry in an array.
        expect(await harness(page, 'nodeData', 'object-12')).toMatchObject({ from: 'union' })
    })

    test('the union recurses into grandchildren', async ({ page }) => {
        await load(page, {
            pivots: ['misp-event-objects', 'union-children'],
            union: { parent: 'event-a', children: [{ id: 'object-0', children: ['attr-1', 'attr-2'] }] },
        })
        await run(page, 'misp-event-objects', ['a'])
        expect(await childIds(page, 'object-0')).toEqual([])

        await run(page, 'union-children', ['a'])
        await harness(page, 'ingestPivot', 'union-children')

        // object-0 matched, so it was not replaced — its own children were merged.
        expect(await childIds(page, 'event-a')).toHaveLength(12)
        expect(await childIds(page, 'object-0')).toEqual(['attr-1', 'attr-2'])
        expect(await harness(page, 'nodeData', 'attr-1')).toMatchObject({ from: 'union' })
    })

    test('an expanded container merges too, and its subgraph follows', async ({ page }) => {
        await load(page, {
            pivots: ['misp-event-objects', 'union-children'],
            union: { parent: 'event-a', children: ['object-12', 'object-13'] },
        })
        await run(page, 'misp-event-objects', ['a'])
        await harness(page, 'expand', 'event-a')
        expect(await harness(page, 'subgraphNodeCount', 'event-a')).toBe(12)

        await run(page, 'union-children', ['a'])
        await harness(page, 'ingestPivot', 'union-children')

        expect(await harness(page, 'isExpanded', 'event-a')).toBe(true)
        // The subgraph is rebuilt wholesale from the container's children — the cheap
        // path this milestone chose deliberately.
        await expect.poll(async () => harness(page, 'subgraphNodeCount', 'event-a')).toBe(14)
    })

    test('undo takes union-added children back out; redo merges them again', async ({ page }) => {
        await load(page, {
            pivots: ['misp-event-objects', 'union-children'],
            union: { parent: 'event-a', children: ['object-12', { id: 'object-13', children: ['attr-9'] }] },
        })
        await run(page, 'misp-event-objects', ['a'])
        await run(page, 'union-children', ['a'])
        const ingested = await harness(page, 'ingestPivot', 'union-children') as RecordedRunOutcome
        expect(await childIds(page, 'event-a')).toHaveLength(14)

        await harness(page, 'undoPivot', ingested.runId)

        // The container and the twelve the other run brought stay; the merge is gone,
        // grandchild included.
        expect(await childIds(page, 'event-a')).toHaveLength(12)
        expect(await harness(page, 'nodeData', 'object-13')).toBeNull()
        expect(await harness(page, 'nodeData', 'attr-9')).toBeNull()

        await harness(page, 'redoPivot')
        expect(await childIds(page, 'event-a')).toHaveLength(14)
        expect(await childIds(page, 'object-13')).toEqual(['attr-9'])
        expect(await harness(page, 'nodeSources', 'object-13')).toEqual(['union-children'])
    })

    test('a child another source vouches for survives the undo', async ({ page }) => {
        await load(page, {
            pivots: ['misp-event-objects', 'union-children'],
            // object-0 came from the MISP run; the union asserts it again.
            union: { parent: 'event-a', children: ['object-0', 'object-12'] },
        })
        const misp = await run(page, 'misp-event-objects', ['a'])
        await run(page, 'union-children', ['a'])
        const merge = await harness(page, 'ingestPivot', 'union-children') as RecordedRunOutcome

        // A matching child is not re-added, so only the new one carries the union's tag.
        expect(await harness(page, 'nodeSources', 'object-0')).toEqual(['misp-event-objects'])
        expect(await harness(page, 'nodeSources', 'object-12')).toEqual(['union-children'])

        await harness(page, 'undoPivot', merge.runId)
        expect(await harness(page, 'nodeData', 'object-0')).not.toBeNull()
        expect(await harness(page, 'nodeData', 'object-12')).toBeNull()

        // And the run that did bring them takes the whole container with it.
        await harness(page, 'undoPivot', misp.runId)
        expect(await harness(page, 'nodeData', 'event-a')).toBeNull()
        expect(await harness(page, 'nodeData', 'object-0')).toBeNull()
    })

    test('removeBySource reaches into a container', async ({ page }) => {
        await load(page, {
            pivots: ['misp-event-objects', 'union-children'],
            union: { parent: 'event-a', children: ['object-12'] },
        })
        await run(page, 'misp-event-objects', ['a'])
        await run(page, 'union-children', ['a'])
        await harness(page, 'ingestPivot', 'union-children')

        const removed = (await harness(page, 'removeBySource', 'union-children')) as { nodes: string[] }

        expect(removed.nodes).toEqual(['object-12'])
        expect(await childIds(page, 'event-a')).toHaveLength(12)
        // The container itself is vouched for by the other pivot, so it stays.
        expect(await harness(page, 'nodeData', 'event-a')).not.toBeNull()
    })
})
