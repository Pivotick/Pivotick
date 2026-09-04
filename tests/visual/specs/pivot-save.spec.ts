import type { Locator, Page } from '@playwright/test'
import { test, expect, gotoHarness, harness } from '../helpers'
import type {
    PivotFixtureSpec, RecordedCandidates, RecordedHistoryEntry, RecordedRunOutcome,
    RecordedSaveReport, SaveCall,
} from '../harness/harness'

// Writing an ingested run back out, and the ledger that says what has crossed.
//
// The library performs no write of its own — a pivot's `save` does — so what is
// asserted here is the bookkeeping: which elements a run created, whether they have
// been written, what a retry carries, and the ids a source system minted on the way
// through. All numeric, because a screenshot cannot tell a saved node from an unsaved
// one, and that distinction is the whole feature.
//
// The fake provider's `save` answers four ways (`SaveBehavior`), which is the point:
// a backend that writes everything, half of it, none of it, or all of it under names
// of its own choosing are four different problems for the ledger.

const CORRELATION = 'correlation'
const SEARCH = 'search-archive'

// ── readers over the serialisable harness API ────────────────────────────────
const load = async (page: Page, spec: PivotFixtureSpec = {}, overrides: object = {}): Promise<void> => {
    await harness(page, 'loadWithPivots', 'basic', spec, overrides)
    await page.locator('.zoom-layer:not(.hidden)').first().waitFor({ state: 'attached' })
}

/**
 * The CORRELATION fixture advertises 2,143 against a cap of 2,000, so every run here narrows
 * to *URLs* — 210, which the cap lets through. The arithmetic is the fixture's, not
 * this file's.
 */
const URLS = { type: ['url'] }

const run = async (
    page: Page,
    id: string,
    nodeIds: string[] = [],
    narrowing: Record<string, unknown> = {}
): Promise<RecordedRunOutcome> =>
    (await harness(page, 'runPivot', id, nodeIds, narrowing)) as RecordedRunOutcome

const ingest = async (page: Page, id = CORRELATION): Promise<RecordedRunOutcome> =>
    (await harness(page, 'ingestPivot', id)) as RecordedRunOutcome

const save = async (page: Page, target?: string): Promise<RecordedSaveReport> =>
    (await harness(page, 'pivotSave', target)) as RecordedSaveReport

const unsaved = async (page: Page, pivotId?: string): Promise<{ nodes: number; edges: number }> =>
    (await harness(page, 'pivotUnsavedCount', pivotId)) as { nodes: number; edges: number }

const saveCalls = async (page: Page): Promise<SaveCall[]> =>
    (await harness(page, 'saveCalls')) as SaveCall[]

const savedState = async (page: Page, nodeId: string): Promise<{ saved: boolean; savable: boolean }> =>
    (await harness(page, 'pivotSavedState', nodeId)) as { saved: boolean; savable: boolean }

const staged = async (page: Page, id = CORRELATION): Promise<RecordedCandidates | null> =>
    (await harness(page, 'pivotCandidates', id)) as RecordedCandidates | null

const entries = async (page: Page): Promise<RecordedHistoryEntry[]> =>
    (await harness(page, 'historyEntries')) as RecordedHistoryEntry[]

const counts = async (page: Page): Promise<{ nodes: number; edges: number }> => {
    const all = (await harness(page, 'counts')) as { nodes: number; edges: number }
    return { nodes: all.nodes, edges: all.edges }
}

/** Run one pivot, take everything it offered, and report what landed. */
const runAndIngest = async (
    page: Page,
    id: string,
    origin: string[] = ['a'],
    narrowing: Record<string, unknown> = URLS
): Promise<RecordedRunOutcome> => {
    await run(page, id, origin, narrowing)
    await harness(page, 'markPivotCandidates', id, 'all')
    return ingest(page, id)
}

// ── the ledger ───────────────────────────────────────────────────────────────

test.describe('pivot save — the ledger', () => {
    test('a pivot with no save produces nothing unsaved', async ({ page }) => {
        await gotoHarness(page)
        // `save: 'none'` is the default: the fixtures declare no `save` at all.
        await load(page, { pivots: [CORRELATION] })

        const landed = await runAndIngest(page, CORRELATION)
        expect(landed.nodes.length).toBeGreaterThan(0)

        expect(await unsaved(page)).toEqual({ nodes: 0, edges: 0 })
        expect(await harness(page, 'pivotUnsavedRuns')).toEqual([])
        // Not savable is a third state, distinct from unsaved: nothing to nag about.
        expect(await savedState(page, landed.nodes[0])).toEqual({ saved: false, savable: false })
    })

    test('what a run lands is unsaved until it is written, then it is not', async ({ page }) => {
        await gotoHarness(page)
        await load(page, { pivots: [CORRELATION], save: 'ok' })

        const landed = await runAndIngest(page, CORRELATION)
        const pending = await unsaved(page)
        expect(pending.nodes).toBe(landed.nodes.length)
        expect(pending.edges).toBe(landed.edges.length)
        expect(await savedState(page, landed.nodes[0])).toEqual({ saved: false, savable: true })

        const report = await save(page)
        expect(report.runs).toBe(1)
        expect(report.savedNodes).toBe(landed.nodes.length)
        expect(report.savedEdges).toBe(landed.edges.length)
        expect(report.pendingNodes + report.pendingEdges).toBe(0)
        expect(report.errors).toEqual([])

        expect(await unsaved(page)).toEqual({ nodes: 0, edges: 0 })
        expect(await savedState(page, landed.nodes[0])).toEqual({ saved: true, savable: true })
    })

    test('a half-succeeding save keeps the rest pending, and the retry carries exactly it', async ({ page }) => {
        await gotoHarness(page)
        await load(page, { pivots: [CORRELATION], save: 'half' })

        const landed = await runAndIngest(page, CORRELATION)
        const total = landed.nodes.length
        const first = await save(page)

        // Every other node written, no edges: what the fixture's `'half'` does.
        expect(first.savedNodes).toBe(Math.ceil(total / 2))
        expect(first.savedEdges).toBe(0)
        expect(first.pendingNodes).toBe(total - first.savedNodes)
        expect((await unsaved(page)).nodes).toBe(first.pendingNodes)

        // The retry is the same call, and it must not re-send what is already written.
        await harness(page, 'setSaveBehavior', 'ok')
        const second = await save(page)
        expect(second.savedNodes).toBe(first.pendingNodes)
        expect(await unsaved(page)).toEqual({ nodes: 0, edges: 0 })

        const calls = await saveCalls(page)
        expect(calls).toHaveLength(2)
        expect(calls[0].attempt).toBe(1)
        expect(calls[1].attempt).toBe(2)
        expect(calls[1].nodes).toHaveLength(first.pendingNodes)
        // The second payload and the first share nothing that was written.
        const writtenFirst = calls[0].nodes.filter((_, i) => i % 2 === 0)
        expect(calls[1].nodes.some((id) => writtenFirst.includes(id))).toBe(false)
    })

    test('a throwing save leaves every node on the canvas and every one of them unsaved', async ({ page }) => {
        await gotoHarness(page)
        await load(page, { pivots: [CORRELATION], save: 'throw' })

        const landed = await runAndIngest(page, CORRELATION)
        const before = await counts(page)

        const report = await save(page)
        expect(report.savedNodes).toBe(0)
        expect(report.pendingNodes).toBe(landed.nodes.length)
        expect(report.errors).toHaveLength(1)

        // A backend refusal is information about the backend, not a reversal of the
        // analyst's decision: nothing comes off the canvas.
        expect(await counts(page)).toEqual(before)
        expect((await unsaved(page)).nodes).toBe(landed.nodes.length)
    })

    test('two pivots keep separate ledgers, and saving one leaves the other alone', async ({ page }) => {
        await gotoHarness(page)
        await load(page, { pivots: [CORRELATION, SEARCH], save: 'ok' })

        const first = await runAndIngest(page, CORRELATION)
        const second = await runAndIngest(page, SEARCH, [], {})

        expect((await unsaved(page, CORRELATION)).nodes).toBe(first.nodes.length)
        expect((await unsaved(page, SEARCH)).nodes).toBe(second.nodes.length)

        // Addressed by pivot id: what a triage pane's own Save means.
        await save(page, CORRELATION)
        expect(await unsaved(page, CORRELATION)).toEqual({ nodes: 0, edges: 0 })
        expect((await unsaved(page, SEARCH)).nodes).toBe(second.nodes.length)
        expect((await saveCalls(page)).map((call) => call.pivot)).toEqual([CORRELATION])
    })

    test('a node one run created and another only vouched for saves with the run that created it', async ({ page }) => {
        await gotoHarness(page)
        await load(page, { pivots: [CORRELATION], save: 'ok' })

        const first = await runAndIngest(page, CORRELATION)
        // A second run of the same pivot re-offers what is now on canvas; those rows
        // are deduped, so the run vouches for them rather than creating them.
        await run(page, CORRELATION, ['a'], URLS)
        const set = await staged(page)
        expect(set?.deduped).toBeGreaterThan(0)
        await harness(page, 'markPivotCandidates', CORRELATION, 'all')
        const second = await ingest(page)

        await save(page)
        const calls = await saveCalls(page)
        const written = new Set(calls.flatMap((call) => [...call.nodes, ...call.children]))
        // The second run's payload never mentions a node the first one created.
        const secondCall = calls.find((call) => call.runId === second.runId)
        for (const id of first.nodes) {
            expect(secondCall?.nodes ?? []).not.toContain(id)
        }
        // …and every created node was written exactly once, by somebody.
        expect(first.nodes.every((id) => written.has(id))).toBe(true)
    })

    test('autoSave writes with no gesture', async ({ page }) => {
        await gotoHarness(page)
        await load(page, { pivots: [CORRELATION], save: 'ok', autoSave: [CORRELATION] })

        await runAndIngest(page, CORRELATION)
        // The save is fired after the ingest resolves rather than inside it, so the
        // canvas is never held up by a slow backend.
        await expect.poll(async () => (await saveCalls(page)).length).toBe(1)
        await expect.poll(async () => (await unsaved(page)).nodes).toBe(0)
    })

    test('a failed autoSave reports, and leaves the data on the canvas and unsaved', async ({ page }) => {
        await gotoHarness(page)
        await load(page, { pivots: [CORRELATION], save: 'throw', autoSave: [CORRELATION] })

        const landed = await runAndIngest(page, CORRELATION)
        await expect.poll(async () => (await saveCalls(page)).length).toBe(1)
        await expect.poll(async () => (await unsaved(page)).nodes).toBe(landed.nodes.length)
        expect((await counts(page)).nodes).toBeGreaterThan(landed.nodes.length)
        await expect(page.locator('.pivotick-toast')).toBeVisible()
    })

    test('undo after a save takes the nodes off the canvas and says the backend keeps them', async ({ page }) => {
        await gotoHarness(page)
        await load(page, { pivots: [CORRELATION], save: 'ok' })

        const landed = await runAndIngest(page, CORRELATION)
        await save(page)

        const marked = (await entries(page)).find((entry) => entry.id === landed.runId)
        // Marked written-through, not sealed: the row still reverses, and the menu
        // says the removal stops at the canvas.
        expect(marked?.persisted).toBe(true)
        expect(marked?.sealed).toBe(false)

        const before = (await counts(page)).nodes
        await harness(page, 'undoPivot')
        expect((await counts(page)).nodes).toBe(before - landed.nodes.length)
        // Gone from the canvas is gone from the count — there is nothing left to write.
        expect(await unsaved(page)).toEqual({ nodes: 0, edges: 0 })

        // …and a redo brings them back still saved, so nothing invites a second write.
        await harness(page, 'redoPivot')
        expect((await counts(page)).nodes).toBe(before)
        expect(await unsaved(page)).toEqual({ nodes: 0, edges: 0 })
        expect(await savedState(page, landed.nodes[0])).toEqual({ saved: true, savable: true })
    })
})

// ── ids the source system mints ──────────────────────────────────────────────

test.describe('pivot save — canonical ids', () => {
    test('a re-run under the ids a save minted dedups instead of duplicating', async ({ page }) => {
        await gotoHarness(page)
        await load(page, { pivots: [CORRELATION], save: 'mint' })

        const landed = await runAndIngest(page, CORRELATION)
        await save(page)
        const after = await counts(page)

        // The fake source now hands the same objects back under its own ids.
        await run(page, CORRELATION, ['a'], URLS)
        const set = await staged(page)
        expect(set?.deduped).toBe(landed.nodes.length)
        expect(set?.rows.every((row) => row.deduped)).toBe(true)

        // Nothing new landed even if the analyst takes the lot: they are all already here.
        await harness(page, 'markPivotCandidates', CORRELATION, 'all')
        await ingest(page)
        expect(await counts(page)).toEqual(after)
    })

    test('canonicalId reads back, and the node keeps the id it landed under', async ({ page }) => {
        await gotoHarness(page)
        await load(page, { pivots: [CORRELATION], save: 'mint' })

        const landed = await runAndIngest(page, CORRELATION)
        await save(page)

        const id = landed.nodes[0]
        expect(await harness(page, 'pivotCanonicalId', id)).toBe(`uuid-${id}`)
        // Re-keying a node would reach edges, clusters, selection and the history, so
        // the alias is kept beside the node rather than written onto it.
        expect(await savedState(page, id)).toEqual({ saved: true, savable: true })
        expect(await harness(page, 'pivotCanonicalId', `uuid-${id}`)).toBeNull()
    })
})

// ── the surfaces ─────────────────────────────────────────────────────────────

const FULL = { UI: { mode: 'full', sidebar: { collapsed: true }, table: { open: true } } }

const panel = (page: Page): Locator => page.locator('.pvt-pivot-panel')
const saveBar = (page: Page): Locator => page.locator('.pvt-pivot-unsaved')
const paneHead = (page: Page): Locator => page.locator('.pvt-triage-head').first()
/**
 * The save's own toast. Matched on its text rather than taken as the newest: the
 * ingest that produced the run has a toast of its own, and it is still on screen.
 */
const saveToast = (page: Page): Locator =>
    page.locator('.pivotick-toast').filter({ hasText: /Saved|Couldn't save/ })

/** Enter Pivot mode from the rail, the way an analyst does. */
const enterMode = async (page: Page): Promise<void> => {
    await page.locator('.pvt-moderail-button[data-mode="pivot"]').click()
    await panel(page).waitFor()
}

test.describe('pivot save — the surfaces', () => {
    test('the panel says how much is unsaved, and the one button clears it', async ({ page }) => {
        await gotoHarness(page)
        await load(page, { pivots: [CORRELATION], save: 'ok' }, FULL)
        await enterMode(page)

        // Nothing pulled in yet: an always-present "0 unsaved" would be a standing
        // reminder of nothing, so the line is away entirely.
        await expect(saveBar(page)).toBeHidden()

        const landed = await runAndIngest(page, CORRELATION)
        const total = landed.nodes.length + landed.edges.length
        await expect(saveBar(page)).toBeVisible()
        await expect(saveBar(page)).toContainText(`${total.toLocaleString()} unsaved`)

        await saveBar(page).locator('button').click()
        await expect(saveBar(page)).toBeHidden()
        await expect(saveToast(page)).toContainText('Saved')
        expect(await unsaved(page)).toEqual({ nodes: 0, edges: 0 })
    })

    test('a partial save leaves the count at what is left, and one toast carries the retry', async ({ page }) => {
        await gotoHarness(page)
        await load(page, { pivots: [CORRELATION], save: 'half' }, FULL)
        await enterMode(page)

        const landed = await runAndIngest(page, CORRELATION)
        const total = landed.nodes.length + landed.edges.length
        await saveBar(page).locator('button').click()

        const written = Math.ceil(landed.nodes.length / 2)
        await expect(saveToast(page)).toContainText(`Saved ${written} of ${total}`)
        await expect(saveBar(page)).toContainText(`${total - written} unsaved`)

        // The retry takes over the toast it was clicked on rather than stacking a
        // second one, and reports the whole rather than its own share.
        await harness(page, 'setSaveBehavior', 'ok')
        await page.locator('.pivotick-toast-action').click()
        await expect(saveBar(page)).toBeHidden()
        await expect(saveToast(page)).toHaveCount(1)
        // The whole of it, not the retry's own share — "Saved 9 of 12" becomes
        // "Saved 12", never "Saved 3".
        await expect(saveToast(page)).toContainText(`${landed.nodes.length.toLocaleString()} nodes`)
        await expect(saveToast(page)).not.toContainText(' of ')
    })

    test('a triage pane carries its own provider\'s count, and saves only that provider', async ({ page }) => {
        await gotoHarness(page)
        await load(page, { pivots: [CORRELATION, SEARCH], save: 'ok' }, FULL)

        // Another provider's work, ingested first, so "only that provider" has something
        // to be true about.
        const other = await runAndIngest(page, SEARCH, [], {})

        // A partial ingest, so the pane stays open with rows still waiting.
        await run(page, CORRELATION, ['a'], URLS)
        const set = await staged(page)
        const some = (set?.rows ?? []).filter((row) => !row.deduped).slice(0, 4).map((row) => row.id)
        await harness(page, 'markPivotCandidates', CORRELATION, some)
        const landed = await ingest(page)

        // Everything the run landed, edges included: a carried edge rides in with its
        // endpoints, and it is as unwritten as they are.
        const pending = landed.nodes.length + landed.edges.length
        expect(pending).toBe((await unsaved(page, CORRELATION)).nodes + (await unsaved(page, CORRELATION)).edges)
        await expect(paneHead(page)).toContainText(`${pending.toLocaleString()} unsaved`)
        await paneHead(page).locator('.pvt-triage-link').click()

        await expect(paneHead(page)).not.toContainText('unsaved')
        expect(await unsaved(page, CORRELATION)).toEqual({ nodes: 0, edges: 0 })
        // The other provider's runs were never in the payload.
        expect((await unsaved(page, SEARCH)).nodes).toBe(other.nodes.length)
        expect((await saveCalls(page)).every((call) => call.pivot === CORRELATION)).toBe(true)
    })

    test('pivotMarkUnsaved marks what has not been written, and unmarks it once it has', async ({ page }) => {
        await gotoHarness(page)
        await load(page, { pivots: [CORRELATION], save: 'ok' }, { ...FULL, pivotMarkUnsaved: true })

        const landed = await runAndIngest(page, CORRELATION)
        await expect(page.locator('.pvt-node-unsaved')).toHaveCount(landed.nodes.length)

        await save(page)
        await expect(page.locator('.pvt-node-unsaved')).toHaveCount(0)
    })
})
