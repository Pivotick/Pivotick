import type { Locator, Page } from '@playwright/test'
import { test, expect, canvas, gotoHarness, loadFixture, harness, waitForViewSettled } from '../helpers'
import type {
    ForecastSnapshot, RecordedCandidates, RecordedEdgeBinding, RecordedHistoryEntry,
    RecordedHistoryPreview, RecordedRunOutcome,
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

const binding = async (page: Page, edgeId: string): Promise<RecordedEdgeBinding | null> =>
    (await harness(page, 'edgeBinding', edgeId)) as RecordedEdgeBinding | null

const forecast = async (page: Page): Promise<ForecastSnapshot> =>
    (await harness(page, 'forecast')) as ForecastSnapshot

/** Where a named set of nodes is standing: `[id, x, y]` each, in the order asked for. */
const positions = async (page: Page, ids: string[]): Promise<Array<[string, number, number]>> => {
    const all = (await harness(page, 'nodePositions')) as Record<string, { x: number, y: number }>
    return ids.map(id => [id, all[id]?.x ?? NaN, all[id]?.y ?? NaN])
}

const away = (point: { x: number, y: number }, x: number, y: number): number =>
    Math.hypot(point.x - x, point.y - y)

/** How far the layout may breathe after elements land back on the canvas. */
const SETTLE = 20

/** An edge stops on the node's rim, a few px clear of it — never further than this. */
const RIM = 40

// ── the dropdown ─────────────────────────────────────────────────────────────
const menuRows = (page: Page): Locator => page.locator('.pvt-history-row')

/** The one sentence in the footer that must be true before the click. */
const footSay = (page: Page): Locator => page.locator('.pvt-history-say')

const openHistory = async (page: Page, side: 'undo' | 'redo'): Promise<void> => {
    await page.locator(`#pvt-${side}-caret`).click()
    await expect(page.locator('.pvt-history')).toHaveClass(/open/)
}

/**
 * `n` visibility entries, each naming a different node, so every row is distinct
 * and the labels and clocks a screenshot captures never drift.
 */
const fillHistory = async (page: Page, n: number): Promise<void> => {
    await harness(page, 'configureWritePath', {})
    for (let i = 1; i <= n; i++) await harness(page, 'addNode', `n${i}`, 300 + i * 4, 300)
    for (let i = 1; i <= n; i++) await harness(page, 'excludeNode', `n${i}`)
}

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

test.describe('history — what a restored element hangs off', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
        await harness(page, 'loadWithPivots', 'basic', {})
        await page.locator('.zoom-layer:not(.hidden)').first().waitFor({ state: 'attached' })
        await harness(page, 'configureWritePath', {})
    })

    test('an edge redone onto a replayed node follows that node, not the copy it was drawn against', async ({ page }) => {
        const run = await ingest(page, 1)
        const landed = run.nodes[0]
        await harness(page, 'connect', 'b', landed)

        const [drawn] = await entries(page)
        expect(drawn.kind).toBe('create')
        const edgeId = drawn.edges[0]

        // Down past the ingest and back up again. The node is rebuilt from the run's
        // raw data, so it is a *different* object than the edge was drawn against.
        await undoThrough(page, run.runId)
        await redoThrough(page, drawn.id)

        const restored = await binding(page, edgeId)
        expect(restored?.bound).toBe(true)
        expect(restored?.counted).toBe(true)

        // And it is that node the drawn path tracks: move the node, the edge moves.
        await harness(page, 'moveNode', landed, 600, 260)
        const moved = await binding(page, edgeId)
        expect(moved?.toGap).toBeLessThan(RIM)
    })
})

test.describe('history — the top bar', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
        await loadFixture(page, 'basic', B3_FULL)
        await harness(page, 'configureWritePath', {})
    })

    const undoButton = (page: Page): Locator => page.locator('#pvt-undo-button')
    const redoButton = (page: Page): Locator => page.locator('#pvt-redo-button')

    test('the two buttons follow the history, and say what they would take back', async ({ page }) => {
        // They shipped as hardcoded placeholders for two releases. An Undo button reads
        // as a promise, so an empty history is the only reason one is disabled.
        await expect(undoButton(page)).toBeDisabled()
        await expect(redoButton(page)).toBeDisabled()

        await harness(page, 'excludeNode', 'b')
        await expect(undoButton(page)).toBeEnabled()
        await expect(undoButton(page)).toHaveAttribute('aria-label', 'Undo Hid 1 node')
        await expect(redoButton(page)).toBeDisabled()

        await undoButton(page).click()
        expect(await hidden(page)).toEqual([])
        await expect(undoButton(page)).toBeDisabled()
        await expect(redoButton(page)).toBeEnabled()
        await expect(redoButton(page)).toHaveAttribute('aria-label', 'Redo Hid 1 node')

        await redoButton(page).click()
        expect(await hidden(page)).toEqual(['b'])
    })

    test('the keyboard reaches them without the header', async ({ page }) => {
        await harness(page, 'excludeNode', 'b')
        await page.locator('.pvt-layout').click({ position: { x: 5, y: 5 } })

        await page.keyboard.press('Control+z')
        expect(await hidden(page)).toEqual([])

        await page.keyboard.press('Control+Shift+Z')
        expect(await hidden(page)).toEqual(['b'])

        // Cmd, for the same reason: `Mod+` answers to either.
        await page.keyboard.press('Meta+z')
        expect(await hidden(page)).toEqual([])
    })

    test('Ctrl+Z inside a text field is the browser\'s text undo, not the graph\'s', async ({ page }) => {
        // `filterable` for its numeric `ports` field, which the generated form draws as
        // a real text input.
        await loadFixture(page, 'filterable', B3_FULL)
        await harness(page, 'excludeNode', 'h2')
        await harness(page, 'openFilterPanel')
        const field = page.locator('.pvt-slide-panel.open input[type="number"], .pvt-slide-panel.open input[type="text"]').first()
        await field.waitFor({ state: 'visible' })
        await field.click()

        await page.keyboard.press('Control+z')

        // The graph is exactly where it was: the key never left the input.
        expect(await hidden(page)).toEqual(['h2'])
        expect(await entries(page)).toHaveLength(1)
    })
})

test.describe('history — the dropdown', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
        await loadFixture(page, 'basic', B3_FULL)
        await harness(page, 'configureWritePath', {})
    })

    /** A hide, a delete and a hand-drawn node — one of each of three kinds. */
    const threeThings = async (page: Page): Promise<void> => {
        await harness(page, 'excludeNode', 'b')
        await harness(page, 'requestDelete', { nodes: ['a'], origin: 'bulk-action' })
        await harness(page, 'createNodeAt', 40, 40)
    }

    test('the caret is dead until something has happened, then it opens the timeline', async ({ page }) => {
        await expect(page.locator('#pvt-undo-caret')).toBeDisabled()

        await threeThings(page)
        await openHistory(page, 'undo')

        // Newest first, so the rows read in the reverse of the order they happened.
        await expect(menuRows(page)).toHaveCount(3)
        await expect(menuRows(page).nth(0).locator('.pvt-history-label')).toHaveText('Created \u201cNew node\u201d')
        await expect(menuRows(page).nth(2).locator('.pvt-history-label')).toHaveText('Hid 1 node')
        // The gutter is a ruler: how many steps a click on that row travels.
        await expect(menuRows(page).locator('.pvt-history-step')).toHaveText(['1', '2', '3'])
        // Nothing undone, so the line is the first thing in the list and no scrolling
        // is needed to see it — which is the whole reason the newest sits at the top.
        await expect(page.locator('.pvt-history-now')).toBeVisible()
        expect(await page.locator('.pvt-history-scroll').evaluate((el) => el.scrollTop)).toBe(0)
        await expect(page.locator('.pvt-history-side')).toContainText('Undo side')
    })

    test('hovering the third row arms all three, and the footer states the effect', async ({ page }) => {
        await threeThings(page)
        await openHistory(page, 'undo')

        await menuRows(page).nth(2).hover()

        await expect(page.locator('.pvt-history-row.in-span')).toHaveCount(3)
        await expect(menuRows(page).nth(2)).toHaveClass(/armed/)
        await expect(footSay(page)).toHaveText('Undoes 3 steps')
        // The delete's node comes back, the created one goes: the net is the hide.
        await expect(page.locator('.pvt-history-delta')).toHaveText('1 node back in view')
    })

    test('hovering a row forecasts the change and leaves the rest of the canvas alone', async ({ page }) => {
        const created = (await harness(page, 'createNodeAt', 40, 40)) as string
        // A new node is selected on creation, and a selection dims the graph too — so
        // clear it, or the reader cannot tell the two kinds of dimming apart.
        await harness(page, 'deselectAll')
        await openHistory(page, 'undo')

        // The created node is what an undo would take out, so it drains — and it is the
        // *only* thing that changes. Nothing recedes to make it stand out.
        await menuRows(page).nth(0).hover()
        await expect.poll(() => forecast(page).then(seen => seen.removing)).toEqual([created])
        expect(await harness(page, 'emphasis')).toEqual({
            lit: ['a', 'b', 'c', 'd', 'e', 'hub'],
            dimmed: [created],
        })
    })

    test('hovering a redo row outlines what would come back', async ({ page }) => {
        const created = (await harness(page, 'createNodeAt', 40, 40)) as string
        await harness(page, 'deselectAll')
        // Read where it stands only once the layout has stopped moving it, or the
        // expectation is a position the node has already left.
        await waitForViewSettled(page)
        const [[, x, y]] = await positions(page, [created])

        // Take it back out. Now the redo row's element is not on the canvas at all,
        // which is exactly the case a highlight cannot speak about.
        await undoThrough(page)
        expect(await hasNode(page, created)).toBe(false)

        await openHistory(page, 'redo')
        await menuRows(page).nth(0).hover()

        const seen = await forecast(page)
        expect(seen.arriving.map(outline => outline.id)).toEqual([created])
        expect(seen.removing).toEqual([])
        // Where it would land, not just somewhere: the outline stands where the node did.
        expect(seen.arriving[0].kind).toBe('node')
        expect(away(seen.arriving[0], x, y)).toBeLessThan(2)
        // …and the graph around it is untouched.
        expect((await harness(page, 'emphasis')).dimmed).toEqual([])
    })

    test('a redone ingest comes back where it was, so the outline was not a guess', async ({ page }) => {
        await harness(page, 'loadWithPivots', 'basic', {})
        await page.locator('.zoom-layer:not(.hidden)').first().waitFor({ state: 'attached' })
        await harness(page, 'configureWritePath', {})

        const run = (await harness(page, 'runPivot', AIL, ['a'], { type: ['url'] })) as RecordedRunOutcome
        const set = (await harness(page, 'pivotCandidates', AIL)) as RecordedCandidates
        const ids = set.rows.filter(row => !row.deduped && row.state === 'candidate').slice(0, 3).map(row => row.id)
        await harness(page, 'markPivotCandidates', AIL, ids)
        const ingested = (await harness(page, 'ingestPivot', AIL)) as RecordedRunOutcome
        expect(ingested.nodes).toHaveLength(3)
        await waitForViewSettled(page)

        const before = await positions(page, ingested.nodes)
        await undoThrough(page, run.runId)
        await redoThrough(page)
        await waitForViewSettled(page)

        // The provider's raw data carries no coordinates, so a redo that did not
        // remember them would scatter these three somewhere else entirely. They land
        // back where they were and the layout then breathes a few px, no further.
        const after = await positions(page, ingested.nodes)
        for (const [index, [id, x, y]] of after.entries()) {
            const [, wasX, wasY] = before[index]
            expect(away({ x, y }, wasX, wasY), `${id} came back somewhere else`).toBeLessThan(SETTLE)
        }
    })

    test('clicking a row travels the whole span, and the rows stay listed', async ({ page }) => {
        const before = await counts(page)
        await threeThings(page)
        await openHistory(page, 'undo')

        await menuRows(page).nth(2).click()

        expect(await counts(page)).toEqual(before)
        expect(await hidden(page)).toEqual([])
        // They moved above the line rather than out of the list.
        await expect(menuRows(page)).toHaveCount(3)
        await expect(page.locator('.pvt-history-row.undone')).toHaveCount(3)
        await expect(page.locator('.pvt-history-now-meta')).toHaveText('3 undone \u00b7 0 done')
    })

    test('a sealed row is hatched, and the footer says how many are kept', async ({ page }) => {
        await harness(page, 'configureWritePath', { deleteHook: 'accept-persisted' })
        await harness(page, 'requestDelete', { nodes: ['a'], origin: 'bulk-action' })
        await harness(page, 'excludeNode', 'b')
        await openHistory(page, 'undo')

        await expect(menuRows(page).nth(1)).toHaveClass(/sealed/)
        await expect(menuRows(page).nth(1).locator('.pvt-history-chip')).toContainText('saved')

        await menuRows(page).nth(1).hover()
        await expect(menuRows(page).nth(1)).toHaveClass(/preview-kept/)
        await expect(footSay(page)).toHaveText('Undoes 1 of 2 \u00b7 1 saved item kept')

        await menuRows(page).nth(1).click()
        // The hide reversed; the delete the consumer wrote through did not.
        expect(await hidden(page)).toEqual([])
        expect(await hasNode(page, 'a')).toBe(false)
    })

    test('the redo caret opens the same list from the other side', async ({ page }) => {
        await threeThings(page)
        await undoThrough(page)
        await undoThrough(page)

        await openHistory(page, 'redo')
        await expect(page.locator('.pvt-history-side')).toContainText('Redo side')
        await expect(page.locator('.pvt-history-row.undone')).toHaveCount(2)

        // The undone rows sit above the line, and the one touching it redoes first.
        await page.locator('.pvt-history-row.undone').last().hover()
        await expect(footSay(page)).toHaveText('Redoes 1 step')
        await page.locator('.pvt-history-row.undone').first().hover()
        await expect(footSay(page)).toHaveText('Redoes 2 steps')

        await page.locator('.pvt-history-row.undone').first().click()
        await expect(page.locator('.pvt-history-row.undone')).toHaveCount(0)
    })

    test('at the cap a deep aim keeps its ends readable and says where now went', async ({ page }) => {
        await fillHistory(page, 31)
        await openHistory(page, 'undo')

        await expect(menuRows(page)).toHaveCount(30)
        await expect(page.locator('.pvt-history-count')).toHaveText('30 of 30 \u00b7 oldest evicted')

        await menuRows(page).nth(24).hover()

        // The rail and the strike run the span's whole length; the accent wash is
        // capped, so a 25-row aim does not paint the entire menu one colour.
        await expect(page.locator('.pvt-history-row.in-span')).toHaveCount(25)
        await expect(page.locator('.pvt-history-row.washed')).toHaveCount(8)
        await expect(footSay(page)).toHaveText('Undoes 25 steps')
        // The line has scrolled out of reach, so the menu says which way it went.
        await expect(page.locator('.pvt-history-jump.top')).toHaveClass(/on/)
        await page.locator('.pvt-history-jump.top').click()
        await expect(page.locator('.pvt-history-jump.top')).not.toHaveClass(/on/)
    })

    test('Escape closes it, and so does a click on the canvas', async ({ page }) => {
        await threeThings(page)
        await openHistory(page, 'undo')

        await page.keyboard.press('Escape')
        await expect(page.locator('.pvt-history')).not.toHaveClass(/open/)

        await openHistory(page, 'undo')
        await page.locator('.pvt-canvas').first().click({ position: { x: 260, y: 600 } })
        await expect(page.locator('.pvt-history')).not.toHaveClass(/open/)
        // Closing clears the highlight with it.
        await harness(page, 'deselectAll')
        await expect.poll(() => (harness(page, 'emphasis') as Promise<{ dimmed: string[] }>)
            .then(snapshot => snapshot.dimmed)).toEqual([])
    })

    test('the arrow keys aim and Enter travels', async ({ page }) => {
        const before = await counts(page)
        await threeThings(page)
        await openHistory(page, 'undo')

        await page.keyboard.press('ArrowDown')
        await expect(menuRows(page).nth(0)).toHaveClass(/armed/)
        await page.keyboard.press('ArrowDown')
        await page.keyboard.press('ArrowDown')
        await expect(menuRows(page).nth(2)).toHaveClass(/armed/)
        await expect(footSay(page)).toHaveText('Undoes 3 steps')

        await page.keyboard.press('Enter')
        expect(await counts(page)).toEqual(before)
    })
})

test.describe('history — how the dropdown looks', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    test('five entries', async ({ page }) => {
        await loadFixture(page, 'basic', B3_FULL)
        await fillHistory(page, 5)
        await openHistory(page, 'undo')
        await expect(page.locator('.pvt-history')).toHaveScreenshot('history-menu-five.png')
    })

    test('five entries, dark', async ({ page }) => {
        await loadFixture(page, 'basic', { UI: { mode: 'full', sidebar: { collapsed: false }, theme: 'dark' } })
        await fillHistory(page, 5)
        await openHistory(page, 'undo')
        await expect(page.locator('.pvt-history')).toHaveScreenshot('history-menu-five-dark.png')
    })

    test('thirty entries, with a nine-row span armed', async ({ page }) => {
        await loadFixture(page, 'basic', B3_FULL)
        await fillHistory(page, 30)
        await openHistory(page, 'undo')
        // Armed from the keyboard rather than the pointer: `hover` scrolls to reach a
        // row and how far it goes varies with load, which would reframe the shot.
        for (let i = 0; i < 9; i++) await page.keyboard.press('ArrowDown')
        await expect(menuRows(page).nth(8)).toHaveClass(/armed/)
        // `block: 'nearest'` nudges by the padding at most, so the line stays in frame.
        expect(await page.locator('.pvt-history-scroll').evaluate((el) => el.scrollTop)).toBeLessThan(10)
        await expect(page.locator('.pvt-history')).toHaveScreenshot('history-menu-thirty.png')
    })

    test('the redo side, with everything undone', async ({ page }) => {
        await loadFixture(page, 'basic', B3_FULL)
        await fillHistory(page, 4)
        await openHistory(page, 'undo')
        await menuRows(page).nth(3).click()
        await openHistory(page, 'redo')
        await expect(page.locator('.pvt-history-side')).toContainText('Redo side')
        await expect(page.locator('.pvt-history')).toHaveScreenshot('history-menu-redo.png')
    })

    /**
     * The forecast itself, which is the half of this feature only a picture shows: the
     * canvas keeps every bit of its ink, and the few elements the click would change
     * say so where they stand. Both shots arm the row from the keyboard, for the
     * reason the thirty-row shot gives.
     */
    test('a span that would take elements out drains them where they are', async ({ page }) => {
        await loadFixture(page, 'basic', B3_FULL)
        await harness(page, 'configureWritePath', {})
        await harness(page, 'requestDelete', { nodes: ['c'], origin: 'bulk-action' })
        await undoThrough(page)
        await waitForViewSettled(page)

        // Redoing the deletion takes the node and its edges back out.
        await openHistory(page, 'redo')
        await page.keyboard.press('ArrowDown')
        await expect(menuRows(page).nth(0)).toHaveClass(/armed/)
        await expect(canvas(page)).toHaveScreenshot('history-forecast-remove.png')
    })

    test('a span that would bring elements back outlines them where they stood', async ({ page }) => {
        await harness(page, 'loadWithPivots', 'basic', B3_FULL)
        await page.locator('.zoom-layer:not(.hidden)').first().waitFor({ state: 'attached' })
        await harness(page, 'configureWritePath', {})
        await ingest(page, 3)
        await waitForViewSettled(page)
        await undoThrough(page)
        await waitForViewSettled(page)
        // The undo left a smaller graph, so the view fitted in around it and the three
        // remembered positions are now off the edges. Pull back to bring them in frame —
        // a forecast points at where things were, which is not always where you are
        // looking.
        await harness(page, 'fit', 0.75)
        await waitForViewSettled(page)

        // Nothing of the ingest is on the canvas now, which is the case a highlight
        // has nothing to say about.
        await openHistory(page, 'redo')
        await page.keyboard.press('ArrowDown')
        await expect(menuRows(page).nth(0)).toHaveClass(/armed/)
        await expect(canvas(page)).toHaveScreenshot('history-forecast-restore.png')
    })
})
