import type { Page } from '@playwright/test'
import { test, expect, gotoHarness, loadFixture, harness } from '../helpers'
import type {
    RecordedCandidates, RecordedHistoryEntry, RecordedHistoryPreview, RecordedRunOutcome,
} from '../harness/harness'

// `graph.history` — the engine, with no UI on it yet.
//
// It records four kinds of thing: a pivot ingest, a deletion, a durable hide or
// unhide, and an element drawn by hand. Undo is contiguous and travels a span; a
// sealed entry inside one is passed over rather than walling it off; and a preview
// states the net effect by playing the span against a copy of the graph.
//
// Every assertion here is numeric. A screenshot cannot tell a node that came back
// with its provenance intact from one that came back an orphan, and that distinction
// is what the whole feature rests on.

const AIL = 'ail-correlation'

/** The sidebar bulk-action row only exists in full mode with the sidebar open. */
const B3_FULL = { UI: { mode: 'full', sidebar: { collapsed: false } } }

// ── readers over the serialisable harness API ────────────────────────────────
const counts = async (page: Page): Promise<{ nodes: number; edges: number }> => {
    const all = (await harness(page, 'counts')) as { nodes: number; edges: number }
    return { nodes: all.nodes, edges: all.edges }
}

const entries = async (page: Page): Promise<RecordedHistoryEntry[]> =>
    (await harness(page, 'historyEntries')) as RecordedHistoryEntry[]

/** Just the labels, which is what most assertions about the rows are about. */
const labels = async (page: Page): Promise<string[]> =>
    (await entries(page)).map((entry) => entry.label)

const undoThrough = async (page: Page, entryId?: string): Promise<string[]> =>
    (await harness(page, 'undoThrough', entryId)) as string[]

const redoThrough = async (page: Page, entryId?: string): Promise<string[]> =>
    (await harness(page, 'redoThrough', entryId)) as string[]

const preview = async (
    page: Page,
    entryId: string,
    direction: 'undo' | 'redo' = 'undo'
): Promise<RecordedHistoryPreview> =>
    (await harness(page, 'historyPreview', entryId, direction)) as RecordedHistoryPreview

const hidden = async (page: Page): Promise<string[]> =>
    ((await harness(page, 'excludedNodeIds')) as string[]).sort()

const sources = async (page: Page, nodeId: string): Promise<string[]> =>
    (await harness(page, 'nodeSources', nodeId)) as string[]

const hasNode = async (page: Page, id: string): Promise<boolean> =>
    (await harness(page, 'hasGraphNode', id)) as boolean

/** Stage the AIL pivot narrowed to URLs, then ingest the first `n` landable rows. */
async function ingest(page: Page, n: number): Promise<RecordedRunOutcome> {
    const outcome = (await harness(page, 'runPivot', AIL, ['a'], { type: ['url'] })) as RecordedRunOutcome
    expect(outcome.status).toBe('staged')
    const set = (await harness(page, 'pivotCandidates', AIL)) as RecordedCandidates
    const ids = set.rows
        .filter((row) => !row.deduped && row.state === 'candidate')
        .slice(0, n)
        .map((row) => row.id)
    await harness(page, 'markPivotCandidates', AIL, ids)
    return (await harness(page, 'ingestPivot', AIL)) as RecordedRunOutcome
}

test.describe('history — what it records', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
        await loadFixture(page, 'basic')
        await harness(page, 'configureWritePath', {})
    })

    test('a deletion, a hide and a hand-drawn node each land as one row', async ({ page }) => {
        await harness(page, 'requestDelete', { nodes: ['a'], origin: 'bulk-action' })
        await harness(page, 'excludeNode', 'b')
        await harness(page, 'createNodeAt', 40, 40)

        expect(await labels(page)).toEqual([
            'Created “New node”',
            'Hid 1 node',
            expect.stringMatching(/^Deleted 1 node, \d+ edges?$/) as unknown as string,
        ])
        expect((await entries(page)).map((entry) => entry.kind)).toEqual(['create', 'visibility', 'delete'])
    })

    test('hiding a selection of three is one act, so it is one row', async ({ page }) => {
        await loadFixture(page, 'basic', B3_FULL)
        await harness(page, 'multiSelect', ['a', 'b', 'c'])
        await page.locator('.pvt-sidebar .pvt-sidebar-bulkaction[data-action="hide"]').click()

        await expect.poll(() => hidden(page)).toEqual(['a', 'b', 'c'])
        expect(await labels(page)).toEqual(['Hid 3 nodes'])

        // …and comes back as one, too.
        await undoThrough(page)
        expect(await hidden(page)).toEqual([])
    })

    test('a hand-drawn node is vouched for by `manual`, not mistaken for seed data', async ({ page }) => {
        const id = (await harness(page, 'createNodeAt', 40, 40)) as string
        expect(await sources(page, id)).toEqual(['manual'])
        expect(await sources(page, 'a')).toEqual(['seed'])

        await undoThrough(page)
        expect(await hasNode(page, id)).toBe(false)

        await redoThrough(page)
        expect(await hasNode(page, id)).toBe(true)
        expect(await sources(page, id)).toEqual(['manual'])
    })

    test('a programmatic mutation is not an entry — only a gesture is', async ({ page }) => {
        await harness(page, 'addNode', 'programmatic', 200, 200)
        await harness(page, 'graphRemoveNode', 'e')
        expect(await entries(page)).toEqual([])
    })
})

test.describe('history — travelling a span', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
        await loadFixture(page, 'basic')
        await harness(page, 'configureWritePath', {})
    })

    test('clicking the third row down reverses those three, as one announcement', async ({ page }) => {
        const before = await counts(page)
        await harness(page, 'requestDelete', { nodes: ['a'], origin: 'bulk-action' })
        await harness(page, 'excludeNode', 'b')
        await harness(page, 'createNodeAt', 40, 40)

        const oldest = (await entries(page))[2]
        await harness(page, 'watchBatches')
        const reversed = await undoThrough(page, oldest.id)

        expect(reversed).toHaveLength(3)
        expect(await counts(page)).toEqual(before)
        expect(await hidden(page)).toEqual([])
        // Three entries, one `dataBatchChanged`, one re-render.
        expect(await harness(page, 'batchSizes')).toEqual([expect.any(Number)])
    })

    test('a new action strands whatever was undone: redo is strictly linear', async ({ page }) => {
        await harness(page, 'excludeNode', 'b')
        await undoThrough(page)
        expect(await harness(page, 'redoableEntryIds')).toHaveLength(1)

        await harness(page, 'excludeNode', 'c')
        expect(await harness(page, 'redoableEntryIds')).toEqual([])
        expect(await labels(page)).toEqual(['Hid 1 node'])
    })

    test('the stack holds at thirty, and the evicted entry is no longer reachable', async ({ page }) => {
        for (let i = 1; i <= 31; i++) await harness(page, 'addNode', `n${i}`, 300 + i * 4, 300)
        for (let i = 1; i <= 31; i++) await harness(page, 'excludeNode', `n${i}`)

        const rows = await entries(page)
        expect(rows).toHaveLength(30)
        // The window kept is n2…n31: the oldest hide fell off the bottom.
        expect(rows[0].nodes).toEqual(['n31'])
        expect(rows[29].nodes).toEqual(['n2'])

        // Undoing everything still reachable leaves the evicted hide standing — the
        // documented asymmetry: eviction loses the ability to restore, not to remove.
        await undoThrough(page, rows[29].id)
        expect(await hidden(page)).toEqual(['n1'])
    })
})

test.describe('history — sealed entries', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
        await loadFixture(page, 'basic')
    })

    test('a sealed entry inside a span is passed over, and the preview says so first', async ({ page }) => {
        await harness(page, 'configureWritePath', { deleteHook: 'accept-persisted' })
        await harness(page, 'requestDelete', { nodes: ['a'], origin: 'bulk-action' })
        await harness(page, 'excludeNode', 'b')

        const rows = await entries(page)
        expect(rows.map((entry) => entry.sealed)).toEqual([false, true])

        const planned = await preview(page, rows[1].id)
        expect(planned.entries).toHaveLength(2)
        expect(planned.skipped).toEqual([rows[1].id])
        expect(planned.effect.nodesRestored).toBe(0)

        const reversed = await undoThrough(page, rows[1].id)
        expect(reversed).toEqual([rows[0].id])
        expect(await hidden(page)).toEqual([])
        // The delete was written through to a backend, so the canvas keeps agreeing with it.
        expect(await hasNode(page, 'a')).toBe(false)
    })

    test('a sealed creation is listed but never taken back', async ({ page }) => {
        await harness(page, 'configureWritePath', { nodeCreateHook: 'accept-persisted' })
        await harness(page, 'createNodeAt', 40, 40)

        expect((await entries(page))[0].sealed).toBe(true)
        await undoThrough(page)
        expect(await hasNode(page, 'persisted-node')).toBe(true)
    })
})

test.describe('history — the preview is played, not described', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
        await loadFixture(page, 'basic')
        await harness(page, 'configureWritePath', {})
    })

    test('a hide cancelled by a later unhide nets to zero', async ({ page }) => {
        await harness(page, 'excludeNode', 'b')
        await harness(page, 'includeNode', 'b')

        const rows = await entries(page)
        expect(rows.map((entry) => entry.label)).toEqual(['Showed 1 node', 'Hid 1 node'])

        const planned = await preview(page, rows[1].id)
        expect(planned.entries).toHaveLength(2)
        // Reversing both puts the node back exactly where it is: nothing moves.
        expect(planned.effect.nodesHidden).toBe(0)
        expect(planned.effect.nodesShown).toBe(0)
    })

    test('looking costs nothing: the canvas is untouched by a preview', async ({ page }) => {
        const before = await counts(page)
        await harness(page, 'requestDelete', { nodes: ['a'], origin: 'bulk-action' })
        const [row] = await entries(page)

        const planned = await preview(page, row.id)
        expect(planned.effect.nodesRestored).toBe(1)
        expect(planned.effect.edgesRestored).toBeGreaterThan(0)
        // A deletion's elements are gone, so the row lights nothing on the canvas.
        expect(planned.nodes).toEqual([])
        expect(await counts(page)).toEqual({ nodes: before.nodes - 1, edges: before.edges - planned.effect.edgesRestored })

        await undoThrough(page, row.id)
        expect(await counts(page)).toEqual(before)
    })
})

test.describe('history — a deletion remembers who vouched for what', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
        await harness(page, 'loadWithPivots', 'basic', {})
        await page.locator('.zoom-layer:not(.hidden)').first().waitFor({ state: 'attached' })
        await harness(page, 'configureWritePath', {})
    })

    test('undoing a delete then the run that landed it leaves no orphan behind', async ({ page }) => {
        const before = await counts(page)
        const run = await ingest(page, 3)
        const landed = run.nodes
        expect(landed).toHaveLength(3)

        // Delete one of the three by hand, then take both steps back as one span.
        await harness(page, 'requestDelete', { nodes: [landed[0]], origin: 'bulk-action' })
        expect(await hasNode(page, landed[0])).toBe(false)

        const rows = await entries(page)
        expect(rows.map((entry) => entry.kind)).toEqual(['delete', 'pivot'])

        await undoThrough(page, run.runId)
        // Without the restored ledger the deleted node would come back reporting
        // `'seed'`, and undoing the run would strand it on the canvas for good.
        expect(await counts(page)).toEqual(before)
    })

    test('undoing only the delete brings the node back still vouched for by the run', async ({ page }) => {
        const run = await ingest(page, 3)
        const [first] = run.nodes

        await harness(page, 'requestDelete', { nodes: [first], origin: 'bulk-action' })
        await undoThrough(page)

        expect(await hasNode(page, first)).toBe(true)
        expect(await sources(page, first)).toEqual([AIL])

        // …so the run can still account for it.
        await undoThrough(page, run.runId)
        expect(await hasNode(page, first)).toBe(false)
    })
})
