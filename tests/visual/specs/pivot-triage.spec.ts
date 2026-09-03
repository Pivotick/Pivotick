import type { Locator, Page } from '@playwright/test'
import { test, expect, gotoHarness, harness } from '../helpers'
import type { PivotFixtureSpec, RecordedCandidates } from '../harness/harness'

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

// ── the provider strip: the review tab's own vertical tabs ───────────────────
const providers = (page: Page): Locator => page.locator('.pvt-review-tab')
const provider = (page: Page, pivotId: string): Locator => page.locator(`.pvt-review-tab[data-pivot="${pivotId}"]`)
const onShow = (page: Page): Locator => page.locator('.pvt-review-tab:has(.pvt-review-main.active)')

/** `Correlations 210` — the name each staged provider carries, and its count. */
const providerRows = (page: Page): Promise<string[]> =>
    providers(page).evaluateAll(rows => rows.map(row => [
        row.querySelector('.pvt-review-label')?.textContent ?? '',
        row.querySelector('.pvt-review-count')?.textContent ?? '',
    ].filter(Boolean).join(' ')))

const row = (page: Page, id: string): Locator => page.locator(`.pvt-triage-row[data-candidate="${id}"]`)
const edgeRow = (page: Page, id: string): Locator => page.locator(`.pvt-triage-row[data-edge="${id}"]`)
const childCell = (page: Page, id: string): Locator => row(page, id).locator('[data-column="pvt:children"]')
const childToggle = (page: Page, id: string): Locator => row(page, id).locator('.pvt-triage-caret')
const childPanel = (page: Page): Locator => page.locator('.pvt-triage-children')
const tick = (page: Page, id: string): Locator => row(page, id).locator('input[type="checkbox"]')

/** Mark a row the way the pane offers it: the whole row is the hit target. */
const markRow = (page: Page, id: string): Promise<void> => row(page, id).click()

/** Shift-click, which carries the last click's verdict across the rows between. */
const markRange = (page: Page, id: string): Promise<void> => row(page, id).click({ modifiers: ['Shift'] })

const button = (scope: Locator, name: string): Locator => scope.locator('button', { hasText: name }).first()

/** The row search in the dock's header, which belongs to the provider on show. */
const searchBox = (page: Page): Locator => page.locator('.pvt-triage-search')

/** `Edges 2` — each block's lid, as its name and the count on it. */
const sections = (page: Page): Promise<string[]> =>
    page.locator('.pvt-triage-sechead').evaluateAll(heads => heads.map(head => [
        head.querySelector('.pvt-triage-sechead-title')?.textContent ?? '',
        head.querySelector('.pvt-triage-sechead-count')?.textContent ?? '',
    ].join(' ')))

const tabLabels = (page: Page): Promise<string[]> =>
    paneTabs(page).evaluateAll(nodes => nodes.map(node => (node.textContent ?? '').trim()))

/** How visible a provider row's close button is — it is revealed by the row, not drawn. */
const closeButtonOpacity = (page: Page, pivotId: string): Promise<string> =>
    provider(page, pivotId).locator('.pvt-review-close')
        .evaluate(button => window.getComputedStyle(button).opacity)

/** Drop a provider's candidates the way the strip offers it: the row's own ×. */
const closeProvider = async (page: Page, pivotId: string): Promise<void> => {
    await provider(page, pivotId).hover()
    await provider(page, pivotId).locator('.pvt-review-close').click()
}

const load = async (page: Page, spec: PivotFixtureSpec = {}): Promise<void> => {
    await harness(page, 'loadWithPivots', 'basic', spec, FULL)
    await page.locator('.zoom-layer:not(.hidden)').first().waitFor({ state: 'attached' })
}

const nodeCount = async (page: Page): Promise<number> =>
    ((await harness(page, 'counts')) as { nodes: number }).nodes

/** Nodes and edges on the canvas, which is what an ingest is judged by. */
const counts = async (page: Page): Promise<{ nodes: number, edges: number }> => {
    const all = await harness(page, 'counts') as { nodes: number, edges: number }
    return { nodes: all.nodes, edges: all.edges }
}

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

    test('a staged set opens the review pane, and nothing in it is in the graph', async ({ page }) => {
        await load(page)
        const before = await nodeCount(page)

        await stageUrls(page)

        // One review tab for every staged provider, beside the table rather than
        // replacing it (D27).
        expect(await harness(page, 'dockTabIds')).toEqual(['table', 'pivot-triage'])
        expect(await harness(page, 'activeDockTabId')).toBe('pivot-triage')
        // The tab carries a live count, which is what `DockTabHandle.setLabel` is for.
        expect(await tabLabels(page)).toEqual(['Table', 'Review (210)'])
        // The provider itself is named down the side, with its own share of that count.
        expect(await providerRows(page)).toEqual(['Correlations 210'])

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

    test('a failed fetch can be given up on as well as retried', async ({ page }) => {
        await load(page)
        await harness(page, 'pivotSummarize', AIL, ['a'], { type: ['url'] })
        await harness(page, 'setPivotFail', true)
        await harness(page, 'runPivot', AIL, ['a'], { type: ['url'] })
        await expect(stateBox(page)).toContainText("Couldn't fetch candidates.")

        // Beside Retry, since giving up is an answer to a failed fetch and the toolbar
        // should not be the only place holding it.
        await button(stateBox(page), 'Close').click()

        await expect(pane(page)).toHaveCount(0)
        expect(await harness(page, 'dockTabIds')).toEqual(['table'])
        // Nothing was staged, so there is nothing for it to have rejected either.
        expect(await harness(page, 'rejectedPivotIds', AIL)).toEqual([])
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

        await markRow(page, 'blind-0')
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
        // Still counted as untriaged? No — the count is what is left to decide on.
        expect(await providerRows(page)).toEqual(['No advertised count 2'])

        await button(rejected, 'undo').click()
        await expect(row(page, 'blind-0')).not.toHaveClass(/pvt-triage-row-rejected/)
        expect(await harness(page, 'rejectedPivotIds', 'blind')).toEqual([])
    })

    test('reject all remaining leaves what was marked, and the ingest closes the pane', async ({ page }) => {
        await load(page, { pivots: ['blind'] })
        await harness(page, 'runPivot', 'blind', ['a'])

        await markRow(page, 'blind-1')
        await button(footer(page), 'Reject all remaining').click()

        expect(await harness(page, 'rejectedPivotIds', 'blind')).toEqual(['blind-0', 'blind-2'])
        await expect(row(page, 'blind-1')).toHaveClass(/pvt-triage-row-marked/)

        await button(footer(page), 'Ingest selected').click()

        // Nothing is left to decide on here, so the pane goes rather than emptying
        // itself out behind a Close the analyst has to find before reaching the canvas.
        await expect(toast(page)).toContainText('Ingested 1 node')
        await expect(pane(page)).toHaveCount(0)
        expect(await harness(page, 'dockTabIds')).toEqual(['table'])
        // Closing is not a verdict: the two rejections are the session's, the ingested
        // row is on the canvas, and nothing else was decided on the analyst's behalf.
        expect(await harness(page, 'rejectedPivotIds', 'blind')).toEqual(['blind-0', 'blind-2'])
    })

    test('a pane emptied by an ingest stays while a re-run waits in it', async ({ page }) => {
        await load(page, { pivots: ['blind'] })
        await harness(page, 'runPivot', 'blind', ['a'])

        await markRow(page, 'blind-1')
        await harness(page, 'runPivot', 'blind', ['a'])
        await expect(banner(page)).toContainText('This pivot was run again.')

        await button(footer(page), 'Reject all remaining').click()
        await button(footer(page), 'Ingest selected').click()

        // The re-run's candidates are reachable from this banner and nowhere else, so
        // closing the pane would be a silent discard of them (D27).
        await expect(toast(page)).toContainText('Ingested 1 node')
        await expect(banner(page)).toContainText('This pivot was run again.')
        await expect(stateBox(page)).toContainText('Nothing left to triage')

        await button(banner(page), 'Show new').click()
        await expect(rows(page)).toHaveCount(3)
    })

    test('the whole row marks, and Shift takes the range from the last row clicked', async ({ page }) => {
        await load(page)
        await stageUrls(page)

        // The tick box is a state light rather than the hit target, so a click anywhere
        // on the row is the gesture — and it reaches the manager, not just the tint.
        await markRow(page, 'url-2')
        await expect(tick(page, 'url-2')).toBeChecked()
        await expect(row(page, 'url-2')).toContainText('will ingest')
        expect(await markedIds(page, AIL)).toEqual(['url-2'])

        // The leading bar a marked row carries, read numerically: the suite's pixel
        // threshold cannot see 2px of colour. It has to span the row's hairline too, or
        // a run of marked rows shows a notch at every row it crosses.
        const bar = await row(page, 'url-2').evaluate(element => {
            const height = parseFloat(getComputedStyle(element, '::before').height)
            return {
                width: getComputedStyle(element, '::before').width,
                spansTheHairline: Math.abs(height - element.getBoundingClientRect().height) < 0.5,
            }
        })
        expect(bar).toEqual({ width: '2px', spansTheHairline: true })

        await markRange(page, 'url-6')
        expect(await markedIds(page, AIL)).toEqual(['url-2', 'url-3', 'url-4', 'url-5', 'url-6'])
        await expect(button(footer(page), 'Ingest selected')).toContainText('(5)')
        // A range redraws the table, but never moves the analyst off the page they are on.
        await expect(rows(page)).toHaveCount(100)

        // A range applies the verdict its anchoring click reached, so unmarking a run of
        // rows is the same two gestures rather than one click per row.
        await markRow(page, 'url-3')
        expect(await markedIds(page, AIL)).toEqual(['url-2', 'url-4', 'url-5', 'url-6'])
        await markRange(page, 'url-5')
        expect(await markedIds(page, AIL)).toEqual(['url-2', 'url-6'])

        // The box keeps its own focus and its own key, and ticks its row exactly once —
        // which is the trap in making the row the hit target as well.
        await tick(page, 'url-8').focus()
        await page.keyboard.press('Space')
        await expect(tick(page, 'url-8')).toBeChecked()
        expect(await markedIds(page, AIL)).toEqual(['url-2', 'url-6', 'url-8'])
    })

    test('a range skips what has no verdict to give, and never leaves its own table', async ({ page }) => {
        // `b` and `c` come back already on canvas, so they head the table untickable.
        await load(page, { collide: ['b', 'c'], edgeOnly: [['a', 'b']] })
        await stageUrls(page)
        await harness(page, 'rejectPivotCandidates', AIL, ['url-3'])

        await markRow(page, 'url-5')
        // A row already on the canvas has no verdict to give: the click does nothing at
        // all, and leaves the anchor where it was.
        await markRow(page, 'b')
        await expect(tick(page, 'b')).toHaveCount(0)
        expect(await markedIds(page, AIL)).toEqual(['url-5'])

        // Upwards from the anchor, across both untickable rows and one already rejected.
        await markRange(page, 'url-2')
        expect(await markedIds(page, AIL)).toEqual(['url-2', 'url-4', 'url-5'])
        // A range must not overrule a verdict — that is what `undo` on the row is for.
        await expect(row(page, 'url-3')).toHaveClass(/pvt-triage-row-rejected/)

        // The edge table is a list of its own, so a Shift-click in it starts a selection
        // rather than dragging one out of the node table above.
        await page.locator('.pvt-triage-edges .pvt-triage-row').first().click({ modifiers: ['Shift'] })
        expect(await markedIds(page, AIL)).toEqual(['url-2', 'url-4', 'url-5', 'a-b'])
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
        await expect(page.locator('.pvt-triage-edges .pvt-triage-row')).toHaveCount(2)
        await expect(page.locator('.pvt-triage-edges .pvt-triage-th-label').first()).toHaveText('From')

        // Two blocks in one scroller, so each says what it is and how much it holds:
        // unnamed, the node table's column labels read as a stray row among the edges.
        expect(await sections(page)).toEqual(['Edges 2', 'Nodes 210'])
        await expect(page.locator('.pvt-triage-sechead').first())
            .toContainText('both ends are already on the canvas')
    })

    test('one table on its own is not named, since there is nothing to tell it from', async ({ page }) => {
        await load(page)
        await stageUrls(page)

        // The common case: nodes only. A title over a single table is a row of chrome
        // repeating the count the header line above it already carries.
        expect(await sections(page)).toEqual([])
        await expect(headline(page)).toContainText('210 fetched')
    })

    test('a result made only of edges is a table, not an empty pane', async ({ page }) => {
        await load(page, { edgeOnly: [['a', 'b'], ['c', 'd']] })
        const before = await counts(page)

        // A narrowing no node matches: everything that came back is edges.
        await harness(page, 'runPivot', AIL, ['a'], { type: ['nothing-of-that-kind'] })
        await expect(page.locator('.pvt-triage-edges .pvt-triage-row')).toHaveCount(2)

        // Reading the node rows alone called this an empty result and hid two verdicts.
        await expect(stateBox(page)).toHaveCount(0)
        await expect(headline(page)).toContainText('2 fetched')
        expect(await providerRows(page)).toEqual(['Correlations 2'])
        // Paging and select-all read the node table, so neither is drawn for a set
        // that has none.
        await expect(footer(page)).not.toContainText('shown')
        await expect(button(footer(page), 'Select all')).toHaveCount(0)

        await edgeRow(page, 'only-a-b').click()
        await button(footer(page), 'Ingest selected').click()

        await expect(toast(page)).toContainText('Ingested 1 edge')
        expect(await counts(page)).toEqual({ nodes: before.nodes, edges: before.edges + 1 })
    })

    test('ingest lands the marked rows, and the toast undoes the whole run', async ({ page }) => {
        await load(page)
        await stageUrls(page)
        const before = await nodeCount(page)

        await markRow(page, 'url-0')
        await markRow(page, 'url-1')
        // Marking is silent by design, so the table must not have been redrawn under us.
        await expect(rows(page)).toHaveCount(100)

        await button(footer(page), 'Ingest selected').click()

        // Two nodes, and the edge each one carried in from the origin.
        await expect(toast(page)).toContainText('Ingested 2 nodes, 2 edges')
        expect(await nodeCount(page)).toBe(before + 2)
        // Ingested rows leave the set; the rest are still waiting.
        await expect(headline(page)).toContainText('210 fetched')
        expect(await providerRows(page)).toEqual(['Correlations 208'])
        expect(await tabLabels(page)).toContain('Review (208)')

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
        await markRow(page, 'url-0')

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

    test('several providers share one review tab, and switch from its strip', async ({ page }) => {
        await load(page)
        await stageUrls(page)
        await harness(page, 'runPivot', 'blind', ['a'])
        await harness(page, 'runPivot', 'search-ail', [], { query: 'ransom' })

        // Three fetches, one tab: the dock's own strip lists panes, and these three are
        // one pane — the review of what is staged.
        expect(await harness(page, 'dockTabIds')).toEqual(['table', 'pivot-triage'])
        expect(await providerRows(page)).toEqual([
            'Correlations 210', 'No advertised count 3', 'Search AIL 30',
        ])
        // The tab's count is the whole queue's; the strip breaks it down.
        expect(await tabLabels(page)).toContain('Review (243)')
        // The analyst asked for the last fetch, so that is the one on show.
        await expect(onShow(page)).toHaveAttribute('data-pivot', 'search-ail')
        await expect(rows(page)).toHaveCount(30)

        await provider(page, AIL).locator('.pvt-review-main').click()
        await expect(rows(page)).toHaveCount(100)
        await expect(headline(page)).toContainText('210 fetched')

        // The search box narrows the provider it belongs to, and stays with it across a
        // detour through another one.
        await searchBox(page).fill('url 209')
        await expect(rows(page)).toHaveCount(1)
        await provider(page, 'blind').locator('.pvt-review-main').click()
        await expect(searchBox(page)).toHaveValue('')
        await expect(rows(page)).toHaveCount(3)
        await provider(page, AIL).locator('.pvt-review-main').click()
        await expect(searchBox(page)).toHaveValue('url 209')
        await expect(rows(page)).toHaveCount(1)

        // The way out is revealed by the row the pointer is on rather than drawn on
        // every row in the queue.
        expect(await closeButtonOpacity(page, 'search-ail')).toBe('0')
        await provider(page, 'search-ail').hover()
        expect(await closeButtonOpacity(page, 'search-ail')).toBe('1')
        // And by the row holding the focus, so a keyboard reaches it as well: this one
        // is nowhere near the pointer.
        await provider(page, 'blind').locator('.pvt-review-main').focus()
        expect(await closeButtonOpacity(page, 'blind')).toBe('1')

        // The arrows walk the queue, which is what keeps a fifty-provider strip to one
        // tab stop instead of a hundred.
        await onShow(page).locator('.pvt-review-main').press('ArrowDown')
        await expect(onShow(page)).toHaveAttribute('data-pivot', 'blind')
        await expect(rows(page)).toHaveCount(3)
        await onShow(page).locator('.pvt-review-main').press('ArrowUp')
        await expect(onShow(page)).toHaveAttribute('data-pivot', AIL)

        await closeProvider(page, AIL)

        // The next provider down takes over, rather than the top of the queue: closing
        // one review sends the analyst to the next one waiting.
        expect(await providerRows(page)).toEqual(['No advertised count 3', 'Search AIL 30'])
        await expect(onShow(page)).toHaveAttribute('data-pivot', 'blind')
        expect(await harness(page, 'dockTabIds')).toEqual(['table', 'pivot-triage'])
    })

    test('closing a provider rejects nothing', async ({ page }) => {
        await load(page)
        await stageUrls(page)

        await closeProvider(page, AIL)

        // The last provider takes the review tab with it.
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

    test('a staged container says how many children it carries', async ({ page }) => {
        // The container fixture normally lands straight on the canvas; staged, it is the
        // shape a real MISP object arrives in — one row holding a dozen attributes.
        await load(page, { pivots: ['misp-event-objects'], stage: ['misp-event-objects'] })

        const outcome = await harness(page, 'runPivot', 'misp-event-objects', ['a'])
        expect((outcome as { status: string }).status).toBe('staged')
        await rows(page).first().waitFor()

        // Still one row, as it always was — but no longer a row that hides its size.
        await expect(rows(page)).toHaveCount(1)
        expect(await columnLabels(page)).toEqual(['Candidate', 'Children', 'type'])
        await expect(childCell(page, 'event-a')).toHaveText('12')

        // And the number was true: ingesting it lands exactly the twelve it claimed.
        await markRow(page, 'event-a')
        await button(footer(page), 'Ingest selected').click()
        await expect(toast(page)).toContainText('Ingested')
        expect(await harness(page, 'childIds', 'event-a')).toHaveLength(12)
    })

    test('a container opens to show what it holds, and opening is not wanting it', async ({ page }) => {
        await load(page, {
            pivots: ['union-children'],
            // Nothing has ingested this container, so it stages as a new candidate —
            // and one of its children is a container in its own right.
            union: {
                parent: 'objects-5f2a',
                children: ['attr-0', 'attr-1', { id: 'attr-2', children: ['sub-0', 'sub-1'] }],
            },
        })

        await harness(page, 'runPivot', 'union-children', ['a'])
        await rows(page).first().waitFor()
        await expect(childCell(page, 'objects-5f2a')).toHaveText('3')

        await childToggle(page, 'objects-5f2a').click()

        // Each child by name, the keys they share, and the level the count never reached.
        await expect(childPanel(page)).toContainText('3 children — ingesting this row takes all of them.')
        await expect(childPanel(page).locator('.pvt-triage-childrow')).toHaveCount(3)
        await expect(childPanel(page)).toContainText('attr-2')
        await expect(childPanel(page)).toContainText('+2 inside')

        // The row is the mark target, so the guard that matters is this one: a click
        // meaning "let me look" left no verdict behind.
        expect(await markedIds(page, 'union-children')).toEqual([])
        await expect(row(page, 'objects-5f2a')).not.toHaveClass(/pvt-triage-row-marked/)

        // The caret is a hole in a hit target, so the rest of the row has to still be
        // one. This is the click that broke when the caret sat on the count instead:
        // with one data column, the row's centre landed on it.
        await markRow(page, 'objects-5f2a')
        expect(await markedIds(page, 'union-children')).toEqual(['objects-5f2a'])
        await markRow(page, 'objects-5f2a')

        // Open is the pane's own state, so a sort redraws the table with it still open.
        await page.locator('.pvt-triage-th-label[data-column="pvt:candidate"]').click()
        await expect(childPanel(page).locator('.pvt-triage-childrow')).toHaveCount(3)

        await childToggle(page, 'objects-5f2a').click()
        await expect(childPanel(page)).toHaveCount(0)
        expect(await markedIds(page, 'union-children')).toEqual([])
    })

    test('a set of flat candidates grows no Children column', async ({ page }) => {
        await load(page)
        await stageUrls(page)

        // A column of zeros says nothing. The pane only asks the question when some
        // candidate in the set is a container, which is the dock column's rule too.
        expect(await columnLabels(page)).not.toContain('Children')
        await expect(childCell(page, 'url-0')).toHaveCount(0)
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
/** What the manager holds as marked — the state **Ingest** reads, rather than the tint. */
async function markedIds(page: Page, pivotId: string): Promise<string[]> {
    const staged = await harness(page, 'pivotCandidates', pivotId) as RecordedCandidates
    return [...staged.rows, ...staged.edgeRows].filter(candidate => candidate.state === 'marked').map(candidate => candidate.id)
}

async function rowIds(page: Page): Promise<string[]> {
    return rows(page).evaluateAll(nodes => nodes.map(node => (node as HTMLElement).dataset.candidate ?? ''))
}

/** The node table's column headers, in the order they are drawn. */
async function columnLabels(page: Page): Promise<string[]> {
    return page.locator('.pvt-triage-grid').first().locator('.pvt-triage-th-label')
        .evaluateAll(nodes => nodes.map(node => (node.textContent ?? '').trim()))
}

/** The nth data cell of the first three rows — how a sort is read off the table. */
async function cells(page: Page, index: number): Promise<string[]> {
    const texts = await rows(page).evaluateAll((nodes, i) =>
        nodes.slice(0, 3).map(node => (node.children[i + 1]?.textContent ?? '').trim()),
    index)
    return texts
}
