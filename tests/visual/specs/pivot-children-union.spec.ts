import type { Page } from '@playwright/test'
import { test, expect, gotoHarness, harness } from '../helpers'
import type {
    PivotFixtureSpec, RecordedEdgeBinding, RecordedHistoryPreview, RecordedRunOutcome,
} from '../harness/harness'

// Children union by id (M1b): a pivot result whose node id matches one already on
// canvas merges its children in — added, never updated, never removed — and the
// union recurses. Plus the thing that makes the walkthrough real: a container a
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

const binding = async (page: Page, edgeId: string): Promise<RecordedEdgeBinding> =>
    (await harness(page, 'edgeBinding', edgeId)) as RecordedEdgeBinding

test.describe('pivot children union', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    test('a container a pivot ingested expands like any other', async ({ page }) => {
        await load(page)
        await run(page, 'event-objects', ['a'])

        expect(await childIds(page, 'event-a')).toHaveLength(12)
        // Children belong to the graph, not only to their parent's array.
        expect(await harness(page, 'nodeData', 'object-0')).not.toBeNull()

        await harness(page, 'expand', 'event-a')
        expect(await harness(page, 'isExpanded', 'event-a')).toBe(true)
        expect(await harness(page, 'subgraphNodeCount', 'event-a')).toBe(12)
    })

    test('a re-pivot adds children by id, updates none and removes none', async ({ page }) => {
        await load(page, {
            pivots: ['event-objects', 'union-children'],
            // object-0 is already there, object-12 is new, and the container itself
            // matches a node on canvas so it dedups.
            union: { parent: 'event-a', children: ['object-0', 'object-12'] },
        })
        await run(page, 'event-objects', ['a'])
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
            pivots: ['event-objects', 'union-children'],
            union: { parent: 'event-a', children: [{ id: 'object-0', children: ['attr-1', 'attr-2'] }] },
        })
        await run(page, 'event-objects', ['a'])
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
            pivots: ['event-objects', 'union-children'],
            union: { parent: 'event-a', children: ['object-12', 'object-13'] },
        })
        await run(page, 'event-objects', ['a'])
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
            pivots: ['event-objects', 'union-children'],
            union: { parent: 'event-a', children: ['object-12', { id: 'object-13', children: ['attr-9'] }] },
        })
        await run(page, 'event-objects', ['a'])
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
            pivots: ['event-objects', 'union-children'],
            // object-0 came from the container run; the union asserts it again.
            union: { parent: 'event-a', children: ['object-0', 'object-12'] },
        })
        const container = await run(page, 'event-objects', ['a'])
        await run(page, 'union-children', ['a'])
        const merge = await harness(page, 'ingestPivot', 'union-children') as RecordedRunOutcome

        // A matching child is not re-added, so only the new one carries the union's tag.
        expect(await harness(page, 'nodeSources', 'object-0')).toEqual(['event-objects'])
        expect(await harness(page, 'nodeSources', 'object-12')).toEqual(['union-children'])

        await harness(page, 'undoPivot', merge.runId)
        expect(await harness(page, 'nodeData', 'object-0')).not.toBeNull()
        expect(await harness(page, 'nodeData', 'object-12')).toBeNull()

        // And the run that did bring them takes the whole container with it.
        await harness(page, 'undoPivot', container.runId)
        expect(await harness(page, 'nodeData', 'event-a')).toBeNull()
        expect(await harness(page, 'nodeData', 'object-0')).toBeNull()
    })

    test('removeBySource reaches into a container', async ({ page }) => {
        await load(page, {
            pivots: ['event-objects', 'union-children'],
            union: { parent: 'event-a', children: ['object-12'] },
        })
        await run(page, 'event-objects', ['a'])
        await run(page, 'union-children', ['a'])
        await harness(page, 'ingestPivot', 'union-children')

        const removed = (await harness(page, 'removeBySource', 'union-children')) as { nodes: string[] }

        expect(removed.nodes).toEqual(['object-12'])
        expect(await childIds(page, 'event-a')).toHaveLength(12)
        // The container itself is vouched for by the other pivot, so it stays.
        expect(await harness(page, 'nodeData', 'event-a')).not.toBeNull()
    })

    test('undoing a removeBySource puts a child back inside its container', async ({ page }) => {
        await load(page, {
            pivots: ['event-objects', 'union-children'],
            union: { parent: 'event-a', children: ['object-12'] },
        })
        await run(page, 'event-objects', ['a'])
        await run(page, 'union-children', ['a'])
        await harness(page, 'ingestPivot', 'union-children')
        await harness(page, 'removeBySource', 'union-children')

        await harness(page, 'undoThrough')
        // Back as a child, not as a loose node on the canvas.
        expect(await childIds(page, 'event-a')).toContain('object-12')
        expect(await harness(page, 'nodeSources', 'object-12')).toEqual(['union-children'])
    })

    test('undoing the removal of a whole container brings its children with it', async ({ page }) => {
        await load(page)
        await run(page, 'event-objects', ['a'])
        const children = await childIds(page, 'event-a')

        await harness(page, 'removeBySource', 'event-objects')
        expect(await harness(page, 'nodeData', 'event-a')).toBeNull()

        await harness(page, 'undoThrough')
        expect((await childIds(page, 'event-a')).sort()).toEqual([...children].sort())
        expect(await harness(page, 'nodeSources', 'object-0')).toEqual(['event-objects'])
    })
})

// A container arrives carrying a child whose id is already a node on canvas — the
// everyday shape, where the object a lookup returns contains the very attribute
// that was pivoted on. Registering that child under the taken id used to hand the id
// to something hidden inside a cluster, while the node's own edges went on pointing
// at an object the graph no longer held and nothing moves again.
//
// `b` is the collision throughout: a seed node of the `basic` fixture, with `a-b`
// already hanging off it.
test.describe('a container child whose id is already on canvas', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    const collides = async (page: Page, parent: string): Promise<void> => {
        await load(page, { pivots: ['union-children'], union: { parent, children: ['b', 'object-12'] } })
    }

    test('a new container leaves it on canvas, with its edges still on it', async ({ page }) => {
        await collides(page, 'container')
        await run(page, 'union-children', ['a'])
        // The container is a new node, so it is a triage row rather than a dedup.
        await harness(page, 'markPivotCandidates', 'union-children', 'all')
        await harness(page, 'ingestPivot', 'union-children')

        // The container landed, without taking the id it does not own.
        expect(await childIds(page, 'container')).toEqual(['object-12'])
        expect(await harness(page, 'nodeContainer', 'b')).toBeNull()

        const bound = await binding(page, 'a-b')
        expect(bound.bound, 'a-b is bound to the graph\'s own node').toBe(true)
        expect(bound.counted, 'a-b is counted by its endpoints').toBe(true)
    })

    test('a deduped container merging it in does the same', async ({ page }) => {
        await load(page, {
            pivots: ['event-objects', 'union-children'],
            union: { parent: 'event-a', children: ['b', 'object-12'] },
        })
        await run(page, 'event-objects', ['a'])
        await run(page, 'union-children', ['a'])
        await harness(page, 'ingestPivot', 'union-children')

        // Only the free id merged in, and it is what the run reports having added.
        expect(await childIds(page, 'event-a')).toHaveLength(13)
        expect(await childIds(page, 'event-a')).toContain('object-12')
        expect(await childIds(page, 'event-a')).not.toContain('b')
        expect(await harness(page, 'nodeContainer', 'b')).toBeNull()
        expect(await harness(page, 'nodeSources', 'b')).toEqual(['seed'])

        const bound = await binding(page, 'a-b')
        expect(bound.bound).toBe(true)
        expect(bound.counted).toBe(true)
    })

    test('a container carrying the same child twice keeps one of it', async ({ page }) => {
        await load(page, {
            pivots: ['union-children'],
            union: { parent: 'container', children: ['object-12', 'object-12'] },
        })
        await run(page, 'union-children', ['a'])
        await harness(page, 'markPivotCandidates', 'union-children', 'all')
        await harness(page, 'ingestPivot', 'union-children')

        // Both entries used to be kept as children while the map held only the second,
        // so an expanded container drew the same node twice.
        expect(await childIds(page, 'container')).toEqual(['object-12'])
    })
})

// A pivot whose results come inside containers, with its edges pointing at the
// contents: a correlation from a node on canvas to an attribute of another event.
// The edges follow their endpoints to whatever depth those land at.
test.describe('edges to a container\'s children', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    const correlations: Array<[string, string]> = [['a', 'x1'], ['a', 'x2']]
    const edgeIds = correlations.map(([from, to]) => `corr:${from}:${to}`)

    const hasEdge = async (page: Page, id: string): Promise<boolean> =>
        (await harness(page, 'edgeData', id)) !== null

    const edgesPresent = async (page: Page): Promise<boolean[]> =>
        Promise.all(edgeIds.map((id) => hasEdge(page, id)))

    // `c` is a leaf of the `basic` fixture, so the container dedups onto it;
    // `container` is new, so it is a triage row that has to be marked.
    const cases = [
        { name: 'already on canvas as a leaf', parent: 'c', mark: false },
        { name: 'new to the canvas', parent: 'container', mark: true },
    ]

    for (const { name, parent, mark } of cases) {
        const ingest = async (page: Page): Promise<RecordedRunOutcome> => {
            await load(page, {
                pivots: ['union-children'],
                union: { parent, children: ['x1', 'x2'], edges: correlations },
            })
            await run(page, 'union-children', ['a'])
            if (mark) await harness(page, 'markPivotCandidates', 'union-children', 'all')
            return (await harness(page, 'ingestPivot', 'union-children')) as RecordedRunOutcome
        }

        test(`a container ${name} lands its children and their edges`, async ({ page }) => {
            await ingest(page)

            expect(await childIds(page, parent)).toEqual(['x1', 'x2'])
            expect(await edgesPresent(page)).toEqual([true, true])
            const bound = await binding(page, edgeIds[0])
            expect(bound.bound, 'the edge is bound to the child the graph holds').toBe(true)
        })

        test(`undo of a container ${name} takes the edges with the children; redo restores both`, async ({ page }) => {
            const ingested = await ingest(page)

            const undo = (await harness(page, 'historyPreview', ingested.runId, 'undo')) as RecordedHistoryPreview
            expect(undo.effect.edgesRemoved, 'the preview counts the edges to children').toBe(2)

            await harness(page, 'undoPivot', ingested.runId)
            expect(await harness(page, 'nodeData', 'x1')).toBeNull()
            expect(await edgesPresent(page)).toEqual([false, false])

            const redo = (await harness(page, 'historyPreview', ingested.runId, 'redo')) as RecordedHistoryPreview
            expect(redo.effect.edgesRestored, 'the redo preview counts them back').toBe(2)

            await harness(page, 'redoPivot')
            expect(await childIds(page, parent)).toEqual(['x1', 'x2'])
            expect(await edgesPresent(page)).toEqual([true, true])
        })
    }
})
