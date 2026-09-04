import type { Page } from '@playwright/test'
import { test, expect, gotoHarness, harness } from '../helpers'
import type {
    PivotCall, PivotFixtureSpec, PivotFixtureName, RecordedCandidates, RecordedRunOutcome,
} from '../harness/harness'

// The pivot pipeline (M1): the registry, the two provider calls, the narrowing gate,
// the candidate model, ingest with its provenance, and run-scoped undo/redo.
//
// There is no pivot UI yet, so every case here drives `graph.pivots` — which is
// exactly how the milestone is specified: a pivot with `autoIngest: true` is end to
// end without a single pane. The assertions are numeric on purpose; a screenshot
// cannot tell a staged candidate from an ingested node, which is the one distinction
// this whole feature rests on.
//
// The fake provider's arithmetic: 1,800 + 210 + 95 + 38 = 2,143, and
// *URLs* alone is 210 — so the cap at 2,000 lifts because the numbers say so.

const CORRELATION = 'correlation'

// ── readers over the serialisable harness API ────────────────────────────────
const load = async (page: Page, spec: PivotFixtureSpec = {}): Promise<void> => {
    await harness(page, 'loadWithPivots', 'basic', spec)
    await page.locator('.zoom-layer:not(.hidden)').first().waitFor({ state: 'attached' })
}

const calls = async (page: Page): Promise<PivotCall[]> =>
    (await harness(page, 'pivotCalls')) as PivotCall[]

/** Just the call names, which is what most assertions here are about. */
const callNames = async (page: Page): Promise<string[]> =>
    (await calls(page)).map((call) => `${call.pivot}.${call.call}`)

/** Nodes and edges only — a note count in the comparison would be noise. */
const counts = async (page: Page): Promise<{ nodes: number; edges: number }> => {
    const all = (await harness(page, 'counts')) as { nodes: number; edges: number }
    return { nodes: all.nodes, edges: all.edges }
}

const run = async (
    page: Page,
    id: string,
    nodeIds: string[] = [],
    narrowing: Record<string, unknown> = {}
): Promise<RecordedRunOutcome> =>
    (await harness(page, 'runPivot', id, nodeIds, narrowing)) as RecordedRunOutcome

const staged = async (page: Page, id = CORRELATION): Promise<RecordedCandidates | null> =>
    (await harness(page, 'pivotCandidates', id)) as RecordedCandidates | null

const ingest = async (page: Page, id = CORRELATION): Promise<RecordedRunOutcome> =>
    (await harness(page, 'ingestPivot', id)) as RecordedRunOutcome

const sources = async (page: Page, nodeId: string): Promise<string[]> =>
    (await harness(page, 'nodeSources', nodeId)) as string[]

const batches = async (page: Page): Promise<number[]> =>
    (await harness(page, 'batchSizes')) as number[]

const positions = async (page: Page): Promise<Record<string, { x: number; y: number }>> =>
    (await harness(page, 'nodePositions')) as Record<string, { x: number; y: number }>

/**
 * The mean of some landed positions. Ingest jitters candidates around a seed point,
 * and adding nodes lets the graph settle a little, so the *centre* of what landed is
 * the honest thing to compare against the seed — not any single node.
 */
function centroid(points: Array<{ x: number; y: number }>): { x: number; y: number } {
    return {
        x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
        y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
    }
}

/** The ids of the first `n` landable (non-deduped, untriaged) rows. */
function landableIds(set: RecordedCandidates, n: number): string[] {
    return set.rows.filter((row) => !row.deduped && row.state === 'candidate').slice(0, n).map((row) => row.id)
}

/** Stage the CORRELATION pivot narrowed to URLs — the state every triage case starts from. */
async function stageUrls(page: Page): Promise<RecordedCandidates> {
    const outcome = await run(page, CORRELATION, ['a'], { type: ['url'] })
    expect(outcome.status).toBe('staged')
    const set = await staged(page)
    expect(set).not.toBeNull()
    return set as RecordedCandidates
}

test.describe('pivot pipeline', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    test('the registry answers what applies, without calling anything', async ({ page }) => {
        await load(page)

        expect(await harness(page, 'pivotCount')).toBe(5)
        // An empty origin is not "nothing applies": it is where origin-less pivots live.
        expect(await harness(page, 'pivotsFor', [])).toEqual(['search-archive'])
        // `appliesTo` filters rather than greys out, so a two-node origin simply has no
        // container entry.
        expect(await harness(page, 'pivotsFor', ['a'])).toEqual([CORRELATION, 'event-objects', 'oversized', 'blind'])
        expect(await harness(page, 'pivotsFor', ['a', 'b'])).toEqual([CORRELATION, 'oversized', 'blind'])

        // The whole point of D11: nothing above cost a backend call.
        expect(await calls(page)).toEqual([])
    })

    test('a summarize is cached per question and invalidated on demand', async ({ page }) => {
        await load(page)

        expect(await harness(page, 'pivotSummarize', CORRELATION, ['a'])).toEqual({
            total: 2143,
            facets: [{ key: 'type', type: 'multiselect', options: 4 }, { key: 'seen', type: 'numberRange', options: 0 }],
        })
        // The same question again is served from the cache: still one call.
        await harness(page, 'pivotSummarize', CORRELATION, ['a'])
        expect(await callNames(page)).toEqual([`${CORRELATION}.summarize`])

        // A different narrowing is a different question, and the count follows the facets.
        expect(((await harness(page, 'pivotSummarize', CORRELATION, ['a'], { type: ['url'] })) as { total: number }).total).toBe(210)
        expect(await callNames(page)).toEqual([`${CORRELATION}.summarize`, `${CORRELATION}.summarize`])

        await harness(page, 'invalidatePivot', CORRELATION)
        expect(await harness(page, 'cachedPivotSummary', CORRELATION, ['a'])).toBeNull()
        await harness(page, 'pivotSummarize', CORRELATION, ['a'])
        expect(await callNames(page)).toHaveLength(3)
    })

    test('a multi-node origin is one aggregated request', async ({ page }) => {
        await load(page)

        await harness(page, 'pivotSummarize', CORRELATION, ['a', 'b', 'c', 'd', 'e'])

        const log = await calls(page)
        expect(log).toHaveLength(1)
        expect(log[0].nodes).toEqual(['a', 'b', 'c', 'd', 'e'])
    })

    test('a superseded summarize is dropped, not rendered late', async ({ page }) => {
        await load(page, { latency: 120 })

        await harness(page, 'startPivotSummarize', CORRELATION, ['a'])
        await harness(page, 'startPivotSummarize', CORRELATION, ['a'], { type: ['url'] })
        await expect.poll(async () => ((await harness(page, 'summarizeResults')) as unknown[]).length).toBe(2)

        // The first call is cancelled and resolves with nothing; only the live question
        // produces a number.
        const results = (await harness(page, 'summarizeResults')) as Array<{ total: number | null }>
        expect(results.map((r) => r.total).sort()).toEqual([210, null])
        expect((await calls(page)).map((call) => call.outcome).sort()).toEqual(['cancelled', 'served'])
    })

    test('the gate refuses above the cap, and the refusal lifts once narrowed', async ({ page }) => {
        await load(page)

        const refused = await run(page, CORRELATION, ['a'])
        expect(refused.status).toBe('refused')
        expect(refused.refusal).toEqual({ kind: 'cap', count: 2143, limit: 2000 })
        // Refused *before* fetching: that is what two-phase buys.
        expect(await callNames(page)).toEqual([`${CORRELATION}.summarize`])
        expect(await staged(page)).toBeNull()

        const narrowed = await run(page, CORRELATION, ['a'], { type: ['url'] })
        expect(narrowed.status).toBe('staged')
        expect(await callNames(page)).toEqual([`${CORRELATION}.summarize`, `${CORRELATION}.summarize`, `${CORRELATION}.fetch`])
        expect((await staged(page))?.fetched).toBe(210)
    })

    test('a pivot with no summarize is not gated, and stages blind', async ({ page }) => {
        await load(page)

        // `blind` declares maxCandidates: 1 but advertises nothing, so there is no count
        // to judge — and the ceiling is the only backstop left.
        const outcome = await run(page, 'blind', ['a'])
        expect(outcome.status).toBe('staged')
        expect((await staged(page, 'blind'))?.fetched).toBe(3)
        expect(await callNames(page)).toEqual(['blind.fetch'])
    })

    test('candidates are staged, and are not in the graph', async ({ page }) => {
        await load(page)
        const before = await counts(page)

        const set = await stageUrls(page)

        expect(set.rows).toHaveLength(210)
        expect(await counts(page)).toEqual(before)
        expect(await harness(page, 'nodeData', 'url-0')).toBeNull()
        // Staging changes no data, so it emits nothing on the data bus.
        expect(await batches(page)).toEqual([])
    })

    test('ingest lands exactly the chosen subset, around its origin, as one batch', async ({ page }) => {
        await load(page)
        const before = await counts(page)
        const set = await stageUrls(page)
        const chosen = landableIds(set, 12)

        await harness(page, 'markPivotCandidates', CORRELATION, chosen)
        const outcome = await ingest(page)

        expect(outcome.status).toBe('ingested')
        expect(outcome.nodes).toEqual(chosen)
        // Each candidate carried one edge from the origin; both ends are now on canvas.
        expect(outcome.edges).toHaveLength(12)
        expect(await counts(page)).toEqual({ nodes: before.nodes + 12, edges: before.edges + 12 })

        // Twelve nodes and twelve edges are one announcement, not twenty-four.
        expect(await batches(page)).toEqual([24])

        // Unpositioned candidates are seeded around the node they came from: the pile
        // sits on `a`, and on no other node of the fixture.
        const where = await positions(page)
        const middle = centroid(chosen.map((id) => where[id]))
        const reach = (id: string): number => Math.hypot(middle.x - where[id].x, middle.y - where[id].y)
        expect(reach('a')).toBeLessThanOrEqual(160)
        for (const other of ['b', 'c', 'd', 'e', 'hub']) {
            expect(reach('a')).toBeLessThan(reach(other))
        }

        // The rest are still staged, and untouched.
        expect((await staged(page))?.rows).toHaveLength(198)
    })

    test('provenance tags what a run brought, and the seed keeps its own claim', async ({ page }) => {
        await load(page)
        const set = await stageUrls(page)
        const chosen = landableIds(set, 3)

        await harness(page, 'markPivotCandidates', CORRELATION, chosen)
        const outcome = await ingest(page)

        expect(await sources(page, chosen[0])).toEqual([CORRELATION])
        expect(await harness(page, 'edgeSources', outcome.edges[0])).toEqual([CORRELATION])
        // Nothing pivoted vouches for the fixture's own nodes.
        expect(await sources(page, 'a')).toEqual(['seed'])
        expect(await harness(page, 'edgeSources', 'a-b')).toEqual(['seed'])
    })

    test('two pivots vouching for one node: removing one source keeps it', async ({ page }) => {
        // `blind` lands blind-0..2; the CORRELATION provider then re-offers blind-0 as its first
        // candidate, so the same node is found by both pivots.
        await load(page, { collide: ['blind-0'] })

        await run(page, 'blind', ['a'])
        await harness(page, 'markPivotCandidates', 'blind', 'all')
        await ingest(page, 'blind')
        expect(await sources(page, 'blind-0')).toEqual(['blind'])

        const set = await stageUrls(page)
        // Already on canvas, so it is not offered for ingest — but the run still asserts it.
        expect(set.rows.find((row) => row.id === 'blind-0')?.deduped).toBe(true)
        expect(set.deduped).toBe(1)

        const outcome = await ingest(page)
        expect(outcome.deduped).toBe(1)
        expect(await sources(page, 'blind-0')).toEqual(['blind', CORRELATION])

        const removed = (await harness(page, 'removeBySource', 'blind')) as { nodes: string[] }
        expect(removed.nodes).toEqual(['blind-1', 'blind-2'])
        // blind-0 survives, one claim lighter, because CORRELATION still vouches for it.
        expect(await sources(page, 'blind-0')).toEqual([CORRELATION])
    })

    test('a deduped candidate leaves the existing node untouched', async ({ page }) => {
        await load(page, { collide: ['a'] })
        const dataBefore = await harness(page, 'nodeData', 'a')

        const set = await stageUrls(page)
        expect(set.rows.find((row) => row.id === 'a')?.deduped).toBe(true)
        await harness(page, 'markPivotCandidates', CORRELATION, 'all')
        await ingest(page)

        expect(await harness(page, 'nodeData', 'a')).toEqual(dataBefore)
    })

    test('an edge between two on-canvas nodes is a triage row of its own', async ({ page }) => {
        await load(page, { edgeOnly: [['b', 'd']] })
        const before = await counts(page)

        const set = await stageUrls(page)
        expect(set.edgeRows).toEqual([{ id: 'only-b-d', state: 'candidate' }])
        // Untriaged, so it has not landed.
        expect(await counts(page)).toEqual(before)

        await harness(page, 'markPivotCandidates', CORRELATION, ['only-b-d'])
        const outcome = await ingest(page)
        expect(outcome.edges).toEqual(['only-b-d'])
        expect(await counts(page)).toEqual({ nodes: before.nodes, edges: before.edges + 1 })
    })

    test('rejections are remembered per pivot and not re-offered', async ({ page }) => {
        await load(page)
        const set = await stageUrls(page)
        const rejects = landableIds(set, 5)

        await harness(page, 'rejectPivotCandidates', CORRELATION, rejects)
        expect(await harness(page, 'rejectedPivotIds', CORRELATION)).toEqual(rejects)

        // A re-run replaces the set — the provider still returns 210, and the five are
        // suppressed rather than silently missing.
        const again = await stageUrls(page)
        expect(again.fetched).toBe(210)
        expect(again.suppressed).toBe(5)
        expect(again.rows).toHaveLength(205)
        for (const id of rejects) expect(again.rows.find((row) => row.id === id)).toBeUndefined()

        // Untriaged leftovers *are* re-offered: only the explicit rejections are gone.
        expect(again.rows.every((row) => row.state === 'candidate')).toBe(true)
    })

    test('reject all remaining takes exactly the untriaged rows', async ({ page }) => {
        await load(page)
        const set = await stageUrls(page)
        const keep = landableIds(set, 2)

        await harness(page, 'markPivotCandidates', CORRELATION, keep)
        await harness(page, 'rejectRemainingPivotCandidates', CORRELATION)

        const after = await staged(page) as RecordedCandidates
        expect(after.rows.filter((row) => row.state === 'marked').map((row) => row.id)).toEqual(keep)
        expect(after.rows.filter((row) => row.state === 'rejected')).toHaveLength(208)
        expect(await harness(page, 'rejectedPivotIds', CORRELATION)).toHaveLength(208)
    })

    test('a rejection under one pivot does not hide the candidate from another', async ({ page }) => {
        await load(page, { collide: ['blind-0'] })

        await run(page, 'blind', ['a'])
        await harness(page, 'rejectPivotCandidates', 'blind', ['blind-0'])

        // CORRELATION offers the same id, in a different analytic context.
        const set = await stageUrls(page)
        expect(set.suppressed).toBe(0)
        expect(set.rows.find((row) => row.id === 'blind-0')).toBeDefined()
    })

    test('closing a pane rejects nothing', async ({ page }) => {
        await load(page)
        await stageUrls(page)

        await harness(page, 'discardPivot', CORRELATION)

        expect(await staged(page)).toBeNull()
        expect(await harness(page, 'rejectedPivotIds', CORRELATION)).toEqual([])
        expect((await stageUrls(page)).rows).toHaveLength(210)
    })

    test('the ceiling refuses an oversized payload instead of truncating it', async ({ page }) => {
        await load(page)
        const before = await counts(page)

        const outcome = await run(page, 'oversized', ['a'])

        expect(outcome.status).toBe('refused')
        expect(outcome.refusal).toEqual({ kind: 'ceiling', count: 14203, limit: 10000 })
        // No candidate was kept — but the set is, carrying the refusal, so the pane has
        // somewhere to say the number, the limit and the way forward.
        const set = await staged(page, 'oversized')
        expect(set?.rows).toEqual([])
        expect(set?.refused).toEqual({ kind: 'ceiling', count: 14203, limit: 10000 })
        expect(await counts(page)).toEqual(before)
    })

    test('a failing fetch is reported, and a retry works', async ({ page }) => {
        await load(page)
        // Cache the summary first, so the gate is a cache hit and the failure lands on
        // the call under test.
        await harness(page, 'pivotSummarize', CORRELATION, ['a'], { type: ['url'] })
        await harness(page, 'setPivotFail', true)

        const failed = await run(page, CORRELATION, ['a'], { type: ['url'] })
        expect(failed.status).toBe('failed')
        expect(failed.error).toContain('failed')
        // The set survives the failure, so a pane has somewhere to offer the retry.
        expect((await staged(page))?.error).toContain('failed')

        const retried = await run(page, CORRELATION, ['a'], { type: ['url'] })
        expect(retried.status).toBe('staged')
        expect((await staged(page))?.error).toBeNull()
    })

    test('a failing summarize fails the run instead of throwing', async ({ page }) => {
        await load(page, { fail: true })

        // The gate never saw a count, so there is nothing to judge and nothing to fetch.
        const outcome = await run(page, CORRELATION, ['a'], { type: ['url'] })
        expect(outcome.status).toBe('failed')
        expect(await callNames(page)).toEqual([`${CORRELATION}.summarize`])
        expect(await staged(page)).toBeNull()
    })

    test('an autoIngest pivot is end to end with no pane', async ({ page }) => {
        await load(page)
        const before = await counts(page)

        const outcome = await run(page, 'event-objects', ['a'])

        expect(outcome.status).toBe('ingested')
        expect(outcome.nodes).toEqual(['event-a'])
        expect(await staged(page, 'event-objects')).toBeNull()
        // The container arrived as a new node with its objects nested inside it, and a
        // container's children are nodes of the graph too: one plus twelve.
        expect(await counts(page)).toEqual({ nodes: before.nodes + 13, edges: before.edges + 1 })
        expect(await harness(page, 'childCount', 'event-a')).toBe(12)

        await harness(page, 'undoPivot')
        expect(await counts(page)).toEqual(before)
    })

    test('onBeforeIngest is called once with the whole set, and can narrow it', async ({ page }) => {
        await load(page)
        await harness(page, 'configureIngestHook', 'accept')
        const set = await stageUrls(page)
        const chosen = landableIds(set, 4)

        await harness(page, 'markPivotCandidates', CORRELATION, chosen)
        await ingest(page)

        expect(await harness(page, 'ingestHookCalls')).toBe(1)
        const seen = (await harness(page, 'ingestHookContexts')) as Array<{ nodes: string[]; origin: string[]; trigger: string }>
        expect(seen[0].nodes).toEqual(chosen)
        expect(seen[0].origin).toEqual(['a'])
        expect(seen[0].trigger).toBe('triage')
    })

    test('onBeforeIngest can veto, and lands nothing', async ({ page }) => {
        await load(page)
        await harness(page, 'configureIngestHook', 'veto')
        const before = await counts(page)
        const set = await stageUrls(page)

        await harness(page, 'markPivotCandidates', CORRELATION, landableIds(set, 6))
        const outcome = await ingest(page)

        expect(outcome.status).toBe('vetoed')
        expect(await counts(page)).toEqual(before)
        expect(await batches(page)).toEqual([])
    })

    test('onBeforeIngest can narrow the batch to one', async ({ page }) => {
        await load(page)
        await harness(page, 'configureIngestHook', 'narrow-first')
        const before = await counts(page)
        const set = await stageUrls(page)
        const chosen = landableIds(set, 6)

        await harness(page, 'markPivotCandidates', CORRELATION, chosen)
        const outcome = await ingest(page)

        expect(outcome.nodes).toEqual([chosen[0]])
        expect(await counts(page)).toEqual({ nodes: before.nodes + 1, edges: before.edges + 1 })
    })

    test('an autoIngest pivot is gated too', async ({ page }) => {
        await load(page)
        await harness(page, 'configureIngestHook', 'veto')
        const before = await counts(page)

        const outcome = await run(page, 'event-objects', ['a'])

        expect(outcome.status).toBe('vetoed')
        const seen = (await harness(page, 'ingestHookContexts')) as Array<{ trigger: string }>
        expect(seen[0].trigger).toBe('auto')
        expect(await counts(page)).toEqual(before)
    })

    test('undo drops a whole run; redo re-lands it without refetching', async ({ page }) => {
        await load(page)
        const before = await counts(page)
        const set = await stageUrls(page)
        const chosen = landableIds(set, 12)

        await harness(page, 'markPivotCandidates', CORRELATION, chosen)
        const outcome = await ingest(page)
        expect(await harness(page, 'pivotRunIds')).toEqual([outcome.runId])

        const callsAfterIngest = await callNames(page)
        await harness(page, 'resetBatchSizes')

        expect(await harness(page, 'undoPivot')).toBe(outcome.runId)
        expect(await counts(page)).toEqual(before)
        // Removing twelve nodes and their twelve edges is one announcement.
        expect(await batches(page)).toEqual([24])
        expect(await harness(page, 'pivotRunIds')).toEqual([])

        await harness(page, 'resetBatchSizes')
        expect(await harness(page, 'redoPivot')).toBe(outcome.runId)
        expect(await counts(page)).toEqual({ nodes: before.nodes + 12, edges: before.edges + 12 })
        expect(await sources(page, chosen[0])).toEqual([CORRELATION])
        // Redo re-lands the recorded delta: no provider was asked anything.
        expect(await callNames(page)).toEqual(callsAfterIngest)
        expect(await harness(page, 'pivotRunIds')).toEqual([outcome.runId])
    })

    test('two runs of one pivot are separate entries, undone as one contiguous span', async ({ page }) => {
        await load(page)
        const before = await counts(page)

        const first = await stageUrls(page)
        await harness(page, 'markPivotCandidates', CORRELATION, landableIds(first, 3))
        const runOne = await ingest(page)

        const second = await staged(page) as RecordedCandidates
        await harness(page, 'markPivotCandidates', CORRELATION, landableIds(second, 2))
        const runTwo = await ingest(page)

        expect(runOne.runId).not.toBe(runTwo.runId)
        expect(await harness(page, 'pivotRunIds')).toEqual([runOne.runId, runTwo.runId])
        // The same pivot twice: only the ordinal tells the two rows apart.
        const entries = await harness(page, 'historyEntries') as HistoryRow[]
        expect(entries.map((entry) => entry.ordinal)).toEqual([2, 1])
        expect(entries[0].label).toEqual(entries[1].label)

        // Aiming at the older run takes the newer one with it: undo is contiguous, and
        // reversing one old run alone is `removeBySource`, not this menu.
        const reversed = await harness(page, 'undoThrough', runOne.runId)
        expect(reversed).toEqual([runTwo.runId, runOne.runId])
        expect(await counts(page)).toEqual(before)
        expect(await harness(page, 'pivotRunIds')).toEqual([])
        expect(await harness(page, 'redoableEntryIds')).toEqual([runTwo.runId, runOne.runId])
    })

    test('a preview states what the span would do, without doing any of it', async ({ page }) => {
        await load(page)
        const before = await counts(page)

        const set = await stageUrls(page)
        await harness(page, 'markPivotCandidates', CORRELATION, landableIds(set, 4))
        const outcome = await ingest(page)

        const preview = await harness(page, 'historyPreview', outcome.runId) as HistoryPreviewRow
        expect(preview.entries).toEqual([outcome.runId])
        expect(preview.skipped).toEqual([])
        expect(preview.effect.nodesRemoved).toBe(4)
        // Looking is free: the canvas has not moved.
        expect(await counts(page)).toEqual({ nodes: before.nodes + 4, edges: before.edges + 4 })

        await harness(page, 'undoThrough', outcome.runId)
        expect(await counts(page)).toEqual(before)
    })

    test('an origin-less pivot runs with no selection and lands at the viewport centre', async ({ page }) => {
        await load(page)
        const before = await counts(page)

        const outcome = await run(page, 'search-archive', [], { query: 'onion' })
        expect(outcome.status).toBe('staged')
        expect((await staged(page, 'search-archive'))?.fetched).toBe(30)

        await harness(page, 'markPivotCandidates', 'search-archive', 'all')
        // Point the view away from the graph's own centre, so "the viewport centre" is a
        // number the seed can only have got from the camera.
        await harness(page, 'pointViewAt', 600, -400)
        const centre = (await harness(page, 'viewCenter')) as { x: number; y: number }
        expect(Math.round(centre.x)).toBe(600)
        const ingested = await ingest(page, 'search-archive')
        expect(ingested.nodes).toHaveLength(30)
        expect(await counts(page)).toEqual({ nodes: before.nodes + 30, edges: before.edges })

        // No origin to sit beside, so they land at the centre of the view — nowhere
        // near the graph's own centre, which is where a fallback would have put them.
        const where = await positions(page)
        const landed = centroid(ingested.nodes.map((id) => where[id]))
        expect(Math.hypot(landed.x - centre.x, landed.y - centre.y)).toBeLessThanOrEqual(200)
        expect(Math.hypot(landed.x - centre.x, landed.y - centre.y))
            .toBeLessThan(Math.hypot(landed.x, landed.y))
    })

    test('declared potential is data, and costs no provider call', async ({ page }) => {
        await load(page)

        await harness(page, 'setNodePotential', 'a', CORRELATION, 2100)
        await harness(page, 'setNodePotential', 'a', 'blind', 4)
        expect(await harness(page, 'nodePotentials', 'a')).toEqual([[CORRELATION, 2100], ['blind', 4]])

        // Zero clears the declaration rather than showing a zero.
        await harness(page, 'setNodePotential', 'a', 'blind', 0)
        expect(await harness(page, 'nodePotentials', 'a')).toEqual([[CORRELATION, 2100]])
        expect(await calls(page)).toEqual([])
    })

    test('the registry can be driven at runtime', async ({ page }) => {
        await load(page, { pivots: ['blind'] as PivotFixtureName[] })
        expect(await harness(page, 'pivotCount')).toBe(1)

        await harness(page, 'registerTestPivot', 'correlation')
        expect(await harness(page, 'pivotCount')).toBe(2)
        // A duplicate is skipped, not stacked.
        await harness(page, 'registerTestPivot', 'correlation')
        expect(await harness(page, 'pivotCount')).toBe(2)

        await stageUrls(page)
        await harness(page, 'unregisterPivot', CORRELATION)
        expect(await harness(page, 'pivotCount')).toBe(1)
        // Unregistering takes its staged candidates with it.
        expect(await staged(page)).toBeNull()
    })
})
