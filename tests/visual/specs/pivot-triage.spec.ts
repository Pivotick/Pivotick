import type { Locator, Page } from '@playwright/test'
import { test, expect, gotoHarness, harness } from '../helpers'
import type { PivotFixtureSpec } from '../harness/harness'

// The triage pane (M2): the dock tab that holds one pivot's candidates, and the two
// library additions it needed — an actionable toast, and a dock tab that can be
// relabelled.
//
// Everything here drives the real DOM rather than `graph.pivots`, because the pane is
// the part M1 could not test: which state is showing, what the header line says, which
// rows are ingestable, and whether ticking one row redraws the table under the analyst.
// What is *behind* those rows is M1's spec and is not re-asserted here — except for the
// one fact the whole feature rests on, which is checked at every ingest: a candidate is
// not in the graph until someone commits it.

const AIL = 'ail-correlation'
const FULL = { UI: { mode: 'full', sidebar: { collapsed: true }, table: { open: true } } }

// ── the pane, and the pieces of it that carry meaning ────────────────────────
const pane = (page: Page): Locator => page.locator('.pvt-triage')
const rows = (page: Page): Locator => page.locator('.pvt-triage-row')
const headline = (page: Page): Locator => page.locator('.pvt-triage-head')
const footer = (page: Page): Locator => page.locator('.pvt-triage-foot')
const banner = (page: Page): Locator => page.locator('.pvt-triage-banner')
const stateBox = (page: Page): Locator => page.locator('.pvt-triage-state')
const toast = (page: Page): Locator => page.locator('.pivotick-toast')
const paneTabs = (page: Page): Locator => page.locator('.pvt-dock-tab')

const row = (page: Page, id: string): Locator => page.locator(`.pvt-triage-row[data-candidate="${id}"]`)
const tick = (page: Page, id: string): Locator => row(page, id).locator('input[type="checkbox"]')

const button = (scope: Locator, name: string): Locator => scope.locator('button', { hasText: name }).first()

const tabLabels = (page: Page): Promise<string[]> =>
    paneTabs(page).evaluateAll(nodes => nodes.map(node => (node.textContent ?? '').trim()))

const load = async (page: Page, spec: PivotFixtureSpec = {}): Promise<void> => {
    await harness(page, 'loadWithPivots', 'basic', spec, FULL)
    await page.locator('.zoom-layer:not(.hidden)').first().waitFor({ state: 'attached' })
}

const nodeCount = async (page: Page): Promise<number> =>
    ((await harness(page, 'counts')) as { nodes: number }).nodes

/** Stage the AIL pivot narrowed to URLs — 210 candidates, the pane's working state. */
const stageUrls = async (page: Page): Promise<void> => {
    const outcome = await harness(page, 'runPivot', AIL, ['a'], { type: ['url'] })
    expect((outcome as { status: string }).status).toBe('staged')
    await rows(page).first().waitFor()
}

test.describe('pivot triage pane', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    test('a staged set opens its own pane, and nothing in it is in the graph', async ({ page }) => {
        await load(page)
        const before = await nodeCount(page)

        await stageUrls(page)

        // One pane per pivot, beside the table rather than replacing it (D27).
        expect(await harness(page, 'dockTabIds')).toEqual(['table', `pivot-triage:${AIL}`])
        expect(await harness(page, 'activeDockTabId')).toBe(`pivot-triage:${AIL}`)
        // The tab carries a live count, which is what `DockTabHandle.setLabel` is for.
        expect(await tabLabels(page)).toEqual(['Table', 'Correlations (210)'])

        await expect(headline(page)).toContainText('210 fetched')
        // Paged, not truncated: the first hundred are on screen and the rest are a page away.
        await expect(rows(page)).toHaveCount(100)
        await expect(footer(page)).toContainText('1–100 of 210')

        // The whole point of staging: 210 rows, and not one of them is a node.
        expect(await nodeCount(page)).toBe(before)
    })

    test('a fetch in flight says so and can be called off', async ({ page }) => {
        // Slow enough that the in-flight state is on screen for longer than Playwright's
        // ~350ms assertion polling: at 400ms the window fits between two polls.
        await load(page, { latency: 1200 })

        await harness(page, 'startPivotRun', AIL, ['a'], { type: ['url'] })
        await expect(stateBox(page)).toContainText('Fetching candidates…')

        await button(stateBox(page), 'Cancel').click()

        // Cancelled means nothing was staged, so the pane goes with the set.
        await expect(pane(page)).toHaveCount(0)
        expect(await harness(page, 'dockTabIds')).toEqual(['table'])
    })

    test('a failed fetch keeps its pane and retries with the same narrowing', async ({ page }) => {
        await load(page)
        // Cache the summary first, so the gate is a cache hit and the failure lands on
        // the fetch under test.
        await harness(page, 'pivotSummarize', AIL, ['a'], { type: ['url'] })
        await harness(page, 'setPivotFail', true)

        await harness(page, 'runPivot', AIL, ['a'], { type: ['url'] })
        await expect(stateBox(page)).toContainText("Couldn't fetch candidates.")

        await harness(page, 'setPivotFail', false)
        await button(stateBox(page), 'Retry').click()

        await expect(rows(page)).toHaveCount(100)
        await expect(headline(page)).toContainText('210 fetched')
    })

    test('a ceiling refusal states the number, the limit and the way forward', async ({ page }) => {
        await load(page)

        await harness(page, 'runPivot', 'oversized', ['a'])

        // Never a truncation, and never a bare "too many results" (D17).
        await expect(stateBox(page)).toContainText('The source returned 14,203 candidates, over the 10,000 limit.')
        await expect(stateBox(page)).toContainText('Nothing was staged — narrow and run again.')
        await expect(rows(page)).toHaveCount(0)
    })

    test('an empty result and an all-deduped one read as outcomes, not failures', async ({ page }) => {
        await load(page)
        await harness(page, 'runPivot', AIL, ['a'], { type: ['nothing-of-that-kind'] })
        await expect(stateBox(page)).toContainText('No candidates came back')

        // A pivot whose one result is a node already on canvas: normal, and its data was
        // deliberately left untouched (D23).
        await load(page, { pivots: ['union-children'], union: { parent: 'a', children: [] } })
        await harness(page, 'runPivot', 'union-children', ['a'])
        await expect(stateBox(page)).toContainText('already on the canvas — nothing to triage')
    })

    test('a row is marked, rejected in place, and the rejection taken back', async ({ page }) => {
        await load(page, { pivots: ['blind'] })
        await harness(page, 'runPivot', 'blind', ['a'])
        await expect(rows(page)).toHaveCount(3)

        await tick(page, 'blind-0').check()
        await expect(row(page, 'blind-0')).toHaveClass(/pvt-triage-row-marked/)
        await expect(row(page, 'blind-0')).toContainText('will ingest')
        await expect(button(footer(page), 'Ingest selected')).toContainText('(1)')

        await button(footer(page), 'Reject selected').click()

        // Struck where it happened rather than moved into a group, and it loses its
        // checkbox outright: a rejection is a verdict, not a deselection.
        const rejected = row(page, 'blind-0')
        await expect(rejected).toHaveClass(/pvt-triage-row-rejected/)
        await expect(rejected.locator('input[type="checkbox"]')).toHaveCount(0)
        expect(await rowIds(page)).toEqual(['blind-0', 'blind-1', 'blind-2'])
        // Still counted as untriaged? No — the tab's count is what is left to decide on.
        expect(await tabLabels(page)).toContain('No advertised count (2)')

        await button(rejected, 'undo').click()
        await expect(row(page, 'blind-0')).not.toHaveClass(/pvt-triage-row-rejected/)
        expect(await harness(page, 'rejectedPivotIds', 'blind')).toEqual([])
    })

    test('reject all remaining leaves what was marked and ends the triage', async ({ page }) => {
        await load(page, { pivots: ['blind'] })
        await harness(page, 'runPivot', 'blind', ['a'])

        await tick(page, 'blind-1').check()
        await button(footer(page), 'Reject all remaining').click()

        expect(await harness(page, 'rejectedPivotIds', 'blind')).toEqual(['blind-0', 'blind-2'])
        await expect(row(page, 'blind-1')).toHaveClass(/pvt-triage-row-marked/)

        await button(footer(page), 'Ingest selected').click()
        await expect(stateBox(page)).toContainText('Nothing left to triage')
        await expect(stateBox(page)).toContainText('1 ingested · 2 rejected')
    })

    test('filtering, sorting and paging are the pane reading, and never the graph', async ({ page }) => {
        await load(page)
        await stageUrls(page)
        const before = await nodeCount(page)

        // Sort ascending on the provider's own `seen` column, then flip it.
        const seen = page.locator('.pvt-triage-th-label[data-column="seen"]')
        await seen.click()
        expect(await cells(page, 2)).toEqual(['0', '1', '2'])
        await seen.click()
        expect(await cells(page, 2)).toEqual(['209', '208', '207'])

        // The next page, and back.
        await button(footer(page), '›').click()
        await expect(footer(page)).toContainText('101–200 of 210')
        await button(footer(page), '‹').click()
        await expect(footer(page)).toContainText('1–100 of 210')

        // Regex is legal here and nowhere near a backend: these rows are already in hand.
        await page.locator('.pvt-triage-regex input').check()
        await page.locator('.pvt-triage-search').fill('^url 1[0-9]$')
        await expect(rows(page)).toHaveCount(10)
        await expect(footer(page)).toContainText('Select all 10 matching')

        expect(await nodeCount(page)).toBe(before)
    })

    test('edge-only results get a section of their own', async ({ page }) => {
        await load(page, { edgeOnly: [['a', 'b'], ['c', 'd']] })
        await stageUrls(page)

        // Both endpoints already on canvas, so following-the-nodes would land them
        // unasked; they are rows instead (D24), and never squeezed into the node columns.
        await expect(page.locator('.pvt-triage-sechead')).toContainText('Edges between nodes already on canvas — 2')
        await expect(page.locator('.pvt-triage-edges .pvt-triage-row')).toHaveCount(2)
        await expect(page.locator('.pvt-triage-edges .pvt-triage-th-label').first()).toHaveText('From')
    })

    test('ingest lands the marked rows, and the toast undoes the whole run', async ({ page }) => {
        await load(page)
        await stageUrls(page)
        const before = await nodeCount(page)

        await tick(page, 'url-0').check()
        await tick(page, 'url-1').check()
        // Marking is silent by design, so the table must not have been redrawn under us.
        await expect(rows(page)).toHaveCount(100)

        await button(footer(page), 'Ingest selected').click()

        // Two nodes, and the edge each one carried in from the origin.
        await expect(toast(page)).toContainText('Ingested 2 nodes, 2 edges')
        expect(await nodeCount(page)).toBe(before + 2)
        // Ingested rows leave the set; the rest are still waiting.
        await expect(headline(page)).toContainText('210 fetched')
        expect(await tabLabels(page)).toContain('Correlations (208)')

        await button(toast(page), 'Undo').click()
        expect(await nodeCount(page)).toBe(before)
        await expect(toast(page)).toContainText('Undone')

        await button(toast(page), 'Redo').click()
        expect(await nodeCount(page)).toBe(before + 2)
        await expect(toast(page)).toContainText('Redone')
    })

    test('a re-run over marked rows is announced, never swapped in', async ({ page }) => {
        await load(page)
        await stageUrls(page)
        await tick(page, 'url-0').check()

        await harness(page, 'runPivot', AIL, ['a'], { type: ['url'] })

        // The analyst's triage is not the library's to throw away (D27).
        await expect(banner(page)).toContainText('This pivot was run again. 210 new candidates are ready.')
        await expect(row(page, 'url-0')).toHaveClass(/pvt-triage-row-marked/)

        await button(banner(page), 'Keep triaging').click()
        await expect(banner(page)).toHaveCount(0)
        await expect(row(page, 'url-0')).toHaveClass(/pvt-triage-row-marked/)

        await harness(page, 'runPivot', AIL, ['a'], { type: ['url'] })
        await button(banner(page), 'Show new').click()
        await expect(banner(page)).toHaveCount(0)
        // The replacement is of the candidate set, so nothing carries a mark now.
        await expect(row(page, 'url-0')).not.toHaveClass(/pvt-triage-row-marked/)
    })

    test('a re-run with nothing marked replaces the set outright', async ({ page }) => {
        await load(page)
        await stageUrls(page)

        await harness(page, 'runPivot', AIL, ['a'], { type: ['ip'] })

        await expect(banner(page)).toHaveCount(0)
        await expect(headline(page)).toContainText('38 fetched')
    })

    test('closing the pane rejects nothing', async ({ page }) => {
        await load(page)
        await stageUrls(page)

        await page.locator('.pvt-triage-toolbtn', { hasText: 'Close' }).click()

        expect(await harness(page, 'dockTabIds')).toEqual(['table'])
        expect(await harness(page, 'rejectedPivotIds', AIL)).toEqual([])
        // Leftovers are re-offered on the next run, all 210 of them.
        await stageUrls(page)
        await expect(headline(page)).toContainText('210 fetched')
    })

    test('what an earlier run rejected is suppressed, inspectable and restorable', async ({ page }) => {
        await load(page, { pivots: ['blind'] })
        await harness(page, 'runPivot', 'blind', ['a'])
        await harness(page, 'rejectPivotCandidates', 'blind', ['blind-0', 'blind-2'])

        await harness(page, 'runPivot', 'blind', ['a'])
        await expect(rows(page)).toHaveCount(1)
        await expect(headline(page)).toContainText('2 rejected earlier')

        // A claim the analyst would otherwise have to trust becomes a list they can read
        // — and the only way back out of a mis-rejection.
        await button(headline(page), '2 rejected earlier').click()
        const suppressed = page.locator('.pvt-triage-suppressed-row')
        await expect(suppressed).toHaveCount(2)

        await button(suppressed.first(), 'restore').click()
        expect(await harness(page, 'rejectedPivotIds', 'blind')).toEqual(['blind-2'])
    })

    test('an auto-ingest pivot brings no pane at all', async ({ page }) => {
        await load(page)

        const outcome = await harness(page, 'runPivot', 'misp-event-objects', ['a'])

        expect((outcome as { status: string }).status).toBe('ingested')
        // Nothing was ever offered for triage, so there is nothing waiting for it.
        expect(await harness(page, 'dockTabIds')).toEqual(['table'])
        await expect(toast(page)).toContainText('Ingested 1 node, 1 edge')
    })
})

/** The ids of the rows on screen, in the order they are drawn. */
async function rowIds(page: Page): Promise<string[]> {
    return rows(page).evaluateAll(nodes => nodes.map(node => (node as HTMLElement).dataset.candidate ?? ''))
}

/** The nth data cell of the first three rows — how a sort is read off the table. */
async function cells(page: Page, index: number): Promise<string[]> {
    const texts = await rows(page).evaluateAll((nodes, i) =>
        nodes.slice(0, 3).map(node => (node.children[i + 1]?.textContent ?? '').trim()),
    index)
    return texts
}
