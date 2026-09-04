import type { Locator, Page } from '@playwright/test'
import { test, expect, gotoHarness, loadFixture, harness, nodeEl } from '../helpers'
import type { PivotFixtureSpec, RecordedCandidates } from '../harness/harness'

// Pivot mode (M3): the rail mode that advertises what each pivot can reach, narrows it
// and runs it. The mode is the feature's intent boundary — entering it is what calls a
// provider — so most of what is asserted here is *when a call happens*, which no
// screenshot can see, alongside the panel's own states.

const CORRELATION = 'correlation'
const FULL = { UI: { mode: 'full', sidebar: { collapsed: true }, table: { open: true } } }

const railButton = (page: Page): Locator => page.locator('.pvt-moderail-button[data-mode="pivot"]')
const panel = (page: Page): Locator => page.locator('.pvt-pivot-panel')
const entry = (page: Page, id: string): Locator => page.locator(`.pvt-pivot-entry[data-pivot="${id}"]`)
// The head row's right-hand slot says one of several things, and which one it is *is*
// the assertion: a count the source answered with, the weaker declared hint, or the
// sentence a failure left behind.
const count = (page: Page, id: string): Locator => entry(page, id).locator('.pvt-pivot-count')
const hint = (page: Page, id: string): Locator => entry(page, id).locator('.pvt-pivot-hint')
const errorLine = (page: Page, id: string): Locator => entry(page, id).locator('.pvt-pivot-error')
const breakdown = (page: Page, id: string): Locator => entry(page, id).locator('.pvt-pivot-breakdown')
// The gate line is always there for a capped pivot; the assertion is which way it
// reads, so `refusal` matches only its blocked state.
const gate = (page: Page, id: string): Locator => entry(page, id).locator('.pvt-pivot-gate')
const refusal = (page: Page, id: string): Locator =>
    entry(page, id).locator('.pvt-pivot-gate.pvt-pivot-gate-blocked')
const heading = (page: Page): Locator => panel(page).locator('.pvt-pivot-heading')
const originBlock = (page: Page): Locator => panel(page).locator('.pvt-pivot-origin')

const button = (scope: Locator, name: string): Locator => scope.locator('button', { hasText: name }).first()

/**
 * An entry's laid-out height, to assert that a state change did not move the ones below.
 * `offsetHeight` rather than a bounding box: the panel scales as it opens, so a box read
 * mid-transition is a fraction of the real one.
 */
function entryHeight(page: Page, id: string): Promise<number> {
    return entry(page, id).evaluate(el => (el as HTMLElement).offsetHeight)
}

/** The active rail mode, read from the live store. */
const railMode = (page: Page): Promise<string> => page.evaluate(() =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window.__pivotick as any).graph.UIManager.modeStore.getMode() as string
)

/** Right-click a node, the way the context menu is actually reached. */
const openNodeMenu = async (page: Page, id: string): Promise<void> => {
    await nodeEl(page, id).click({ button: 'right' })
    await expect(page.locator('.pvt-contextmenu')).toHaveClass(/shown/)
}

const load = async (page: Page, spec: PivotFixtureSpec = {}, overrides: object = FULL): Promise<void> => {
    await harness(page, 'loadWithPivots', 'basic', spec, overrides)
    await page.locator('.zoom-layer:not(.hidden)').first().waitFor({ state: 'attached' })
}

/** Which provider calls have happened, as `pivotId:call` pairs. */
const calls = async (page: Page): Promise<string[]> => {
    const log = await harness(page, 'pivotCalls') as Array<{ pivot: string, call: string }>
    return log.map(call => `${call.pivot}:${call.call}`)
}

/**
 * Tick one option of a narrowing multiselect, through the real picker. This is the
 * gesture the whole gate turns on, so it goes through the widget rather than around it.
 */
/**
 * Narrow by one option of a multiselect facet, the way an analyst does: those are
 * drawn as a checkbox list with every option and its count on screen, so there is no
 * menu to open and nothing to close afterwards.
 */
const narrowTo = async (page: Page, pivotId: string, key: string, option: string): Promise<void> => {
    const field = entry(page, pivotId).locator(`.pvt-form-element:has([data-field-key="${key}"])`)
    const row = field.locator('.pvt-checkbox-option', { hasText: option }).first()
    await row.waitFor()
    await row.locator('input[type="checkbox"]').check()
}

/** Enter Pivot mode from the rail, the way an analyst does. */
const enterMode = async (page: Page): Promise<void> => {
    await railButton(page).click()
    await panel(page).waitFor()
}

/** Select a node on the canvas — which is what building an origin amounts to. */
const pickOrigin = async (page: Page, nodeId: string): Promise<void> => {
    await harness(page, 'selectNode', nodeId)
}

test.describe('pivot mode', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    // ── the gate ────────────────────────────────────────────────────────────
    test('the rail button exists only while a pivot is registered', async ({ page }) => {
        await loadFixture(page, 'basic', FULL)
        await expect(railButton(page)).toHaveCount(0)

        await harness(page, 'registerTestPivot', CORRELATION)
        await expect(railButton(page)).toHaveCount(1)

        await harness(page, 'unregisterPivot', CORRELATION)
        await expect(railButton(page)).toHaveCount(0)
    })

    test('pivotMode false suppresses the button, true forces it', async ({ page }) => {
        await load(page, {}, { UI: { ...FULL.UI, pivotMode: false } })
        await expect(railButton(page)).toHaveCount(0)

        await loadFixture(page, 'basic', { UI: { ...FULL.UI, pivotMode: true } })
        await expect(railButton(page)).toHaveCount(1)
    })

    // ── D11: the mode boundary is the intent boundary ───────────────────────
    test('selecting a node costs nothing until the mode is entered', async ({ page }) => {
        await load(page)
        await pickOrigin(page, 'a')
        expect(await calls(page)).toEqual([])

        await enterMode(page)
        await expect(count(page, CORRELATION)).toHaveText('~2,143')
        expect(await calls(page)).toEqual([`${CORRELATION}:summarize`, 'search-archive:summarize'])
    })

    test('leaving the mode stops asking, and re-entering serves the cache', async ({ page }) => {
        await load(page)
        await pickOrigin(page, 'a')
        await enterMode(page)
        await expect(count(page, CORRELATION)).toHaveText('~2,143')
        const asked = (await calls(page)).length

        await page.locator('.pvt-moderail-button[data-mode="select"]').click()
        await pickOrigin(page, 'b')
        await pickOrigin(page, 'a')
        expect((await calls(page)).length).toBe(asked)

        // Same question, so the cached answer is painted without a skeleton.
        await enterMode(page)
        await expect(count(page, CORRELATION)).toHaveText('~2,143')
        expect((await calls(page)).length).toBe(asked)
    })

    test('the origin changing while the mode is open re-asks', async ({ page }) => {
        await load(page)
        await pickOrigin(page, 'a')
        await enterMode(page)
        await expect(count(page, CORRELATION)).toHaveText('~2,143')

        await pickOrigin(page, 'b')
        await expect.poll(async () => (await calls(page)).filter(c => c === `${CORRELATION}:summarize`).length)
            .toBe(2)
    })

    // ── the panel's states ──────────────────────────────────────────────────
    test('an empty origin says so and offers the origin-less pivots', async ({ page }) => {
        await load(page)
        await enterMode(page)

        await expect(originBlock(page)).toContainText('Nothing picked')
        await expect(heading(page)).toBeHidden()
        // Only `origin: 'none'` pivots apply to nothing at all.
        await expect(entry(page, 'search-archive')).toBeVisible()
        await expect(entry(page, CORRELATION)).toHaveCount(0)
    })

    test('an origin lists what applies, and folds the origin-less ones away', async ({ page }) => {
        await load(page)
        await pickOrigin(page, 'a')
        await enterMode(page)

        await expect(heading(page)).toHaveText('4 pivots apply')
        await expect(entry(page, CORRELATION)).toBeVisible()
        // Still runnable, just answering a different question (C14).
        await expect(page.locator('.pvt-pivot-originless summary')).toHaveText('Without an origin (1)')
        await expect(page.locator('.pvt-pivot-originless').locator(entry(page, 'search-archive'))).toHaveCount(1)
    })

    test('the summary fills the count line and the breakdown', async ({ page }) => {
        await load(page)
        await pickOrigin(page, 'a')
        await enterMode(page)

        await expect(count(page, CORRELATION)).toHaveText('~2,143')
        await expect(breakdown(page, CORRELATION)).toHaveText('1,800 Domains · 210 URLs · 95 Pastes · 38 IPs')
    })

    test('a multi-node origin is one line, never one per node', async ({ page }) => {
        await load(page)
        await harness(page, 'multiSelect', ['a', 'b', 'c'])
        await enterMode(page)

        await expect(count(page, CORRELATION)).toHaveText('~2,143 across 3 nodes')
    })

    test('a pivot with no summarize just offers Run', async ({ page }) => {
        await load(page)
        await pickOrigin(page, 'a')
        await enterMode(page)

        const blind = entry(page, 'blind')
        // No count to gate on and no facets to narrow, so the verb takes the slot the
        // count would have had and the entry is a single line.
        await expect(count(page, 'blind')).toHaveCount(0)
        await expect(button(blind, 'Run')).toBeEnabled()
        await expect(button(blind, 'Fetch')).toHaveCount(0)
        await expect(blind.locator('.pvt-pivot-entry-head button')).toHaveText('Run')
    })

    test('a declared potential is the number shown before anything is asked', async ({ page }) => {
        await load(page, { pivots: ['event-objects'] })
        await harness(page, 'setNodePotential', 'a', 'event-objects', 2100)
        await pickOrigin(page, 'a')
        await enterMode(page)

        // No summarize on this pivot, so the declared count is all there is — and
        // it reads as the weaker claim it is, not as a count the source just answered.
        await expect(hint(page, 'event-objects')).toHaveText('~2,100 declared')
        await expect(count(page, 'event-objects')).toHaveCount(0)
    })

    // ── the gate, and it lifting (D4 — the most important moment in the flow) ──
    test('over the cap Fetch is refused, and narrowing lifts it', async ({ page }) => {
        await load(page)
        await pickOrigin(page, 'a')
        await enterMode(page)

        const correlation = entry(page, CORRELATION)
        await expect(refusal(page, CORRELATION)).toHaveText('Over the cap of 2,000 — narrow further to fetch')
        await expect(button(correlation, 'Fetch')).toBeDisabled()

        // The breakdown is what tells the analyst which type to tick, so it stays
        // readable while the gate is blocking.
        await expect(breakdown(page, CORRELATION)).toBeVisible()
        const blockedHeight = await entryHeight(page, CORRELATION)

        // Tick URLs: 210 of the 2,143, so the same question comes back under the cap.
        await narrowTo(page, CORRELATION, 'type', 'URLs')
        await expect(count(page, CORRELATION)).toHaveText('~210')
        await expect(refusal(page, CORRELATION)).toBeHidden()
        await expect(gate(page, CORRELATION)).toHaveText('Within the cap of 2,000')
        await expect(button(correlation, 'Fetch')).toBeEnabled()

        // Crossing the cap is a click on a checkbox the analyst is still aiming at, so
        // the entry must not change height and shift everything below it.
        expect(await entryHeight(page, CORRELATION)).toBe(blockedHeight)
    })

    test('a fetch stages candidates and links into their pane', async ({ page }) => {
        await load(page)
        await pickOrigin(page, 'a')
        await enterMode(page)
        await narrowTo(page, CORRELATION, 'type', 'URLs')
        await expect(count(page, CORRELATION)).toHaveText('~210')

        const before = (await harness(page, 'counts') as { nodes: number }).nodes
        await button(entry(page, CORRELATION), 'Fetch').click()

        const link = entry(page, CORRELATION).locator('.pvt-pivot-triage-link')
        await expect(link).toHaveText('210 in triage ▸')
        // Staged is not ingested: the graph has not moved (M1's one invariant).
        expect((await harness(page, 'counts') as { nodes: number }).nodes).toBe(before)

        await link.click()
        // One review tab holds every staged provider, so the link reveals this pivot's
        // row in its strip.
        expect(await harness(page, 'activeDockTabId')).toBe('pivot-triage')
        await expect(page.locator('.pvt-review-tab:has(.pvt-review-main.active)'))
            .toHaveAttribute('data-pivot', CORRELATION)
    })

    test('the panel lists what a pivot rejected, names it, and takes it back', async ({ page }) => {
        await load(page)
        await pickOrigin(page, 'a')
        await enterMode(page)
        await narrowTo(page, CORRELATION, 'type', 'IPs')
        await button(entry(page, CORRELATION), 'Fetch').click()
        await expect(entry(page, CORRELATION).locator('.pvt-pivot-triage-link')).toHaveText('38 in triage ▸')

        await harness(page, 'rejectPivotCandidates', CORRELATION, ['ip-0', 'ip-1'])
        const link = entry(page, CORRELATION).locator('.pvt-pivot-rejected-link')
        await expect(link).toHaveText('2 rejected ▸')

        await link.click()
        const rejected = entry(page, CORRELATION).locator('.pvt-pivot-rejected-row')
        await expect(rejected).toHaveCount(2)
        // Named as the triage table named them: `ip-0` is not something an analyst can
        // recognise well enough to change their mind about.
        await expect(rejected.first().locator('.pvt-pivot-rejected-label')).toHaveText('ip 0')

        await button(rejected.first(), 'restore').click()
        await expect(rejected).toHaveCount(1)
        expect(await harness(page, 'rejectedPivotIds', CORRELATION)).toEqual(['ip-1'])
    })

    test('rejections outlive the pane they were made in, and Restore all clears them', async ({ page }) => {
        await load(page)
        await pickOrigin(page, 'a')
        await enterMode(page)
        await narrowTo(page, CORRELATION, 'type', 'IPs')
        await button(entry(page, CORRELATION), 'Fetch').click()
        await expect(entry(page, CORRELATION).locator('.pvt-pivot-triage-link')).toBeVisible()

        await harness(page, 'rejectPivotCandidates', CORRELATION, ['ip-0', 'ip-1', 'ip-2'])
        // Dropping the set takes the pane and its rows with it. The verdicts are the
        // session's, not the pane's, so the panel still holds them.
        await harness(page, 'discardPivot', CORRELATION)
        await expect(entry(page, CORRELATION).locator('.pvt-pivot-triage-link')).toHaveCount(0)

        const link = entry(page, CORRELATION).locator('.pvt-pivot-rejected-link')
        await expect(link).toHaveText('3 rejected ▸')
        await link.click()
        await expect(entry(page, CORRELATION).locator('.pvt-pivot-rejected-row')).toHaveCount(3)

        await button(entry(page, CORRELATION).locator('.pvt-pivot-rejected-foot'), 'Restore all').click()
        await expect(link).toHaveCount(0)
        expect(await harness(page, 'rejectedPivotIds', CORRELATION)).toEqual([])

        // And the proof it was the memory that cleared, not just the list: the next run
        // offers all 38 again.
        await harness(page, 'runPivot', CORRELATION, ['a'], { type: ['ip'] })
        const staged = await harness(page, 'pivotCandidates', CORRELATION) as RecordedCandidates
        expect(staged.suppressed).toBe(0)
        expect(staged.rows).toHaveLength(38)
    })

    test('a failed summarize offers a retry that asks again', async ({ page }) => {
        await load(page, { fail: true })
        await pickOrigin(page, 'a')
        await enterMode(page)

        // The sentence and its way out are one line inside the entry that failed.
        await expect(errorLine(page, CORRELATION)).toContainText('Couldn\'t reach the source.')
        await harness(page, 'setPivotFail', false)
        await button(errorLine(page, CORRELATION), 'Retry').click()
        await expect(count(page, CORRELATION)).toHaveText('~2,143')
        await expect(errorLine(page, CORRELATION)).toBeHidden()
    })

    // ── the panel is the mode's workspace ───────────────────────────────────
    test('the panel is wider in this mode, and arming a tool keeps it open', async ({ page }) => {
        await load(page)
        await enterMode(page)

        const width = () => page.locator('.pvt-toolpanel').evaluate(
            el => Math.round(el.getBoundingClientRect().width)
        )
        expect(await width()).toBe(420)

        await page.locator('.pvt-toolpanel-tool[data-tool="lasso-origin"]').click()
        await expect(page.locator('.pvt-toolpanel-panel')).not.toHaveClass(/pvt-collapsed/)

        // Back to Select and the built-in width returns.
        await page.locator('.pvt-moderail-button[data-mode="select"]').click()
        expect(await width()).toBe(216)
    })

    // ── the ways in (D12, C12, and the flat context-menu entry) ─────────────
    test('a declared potential wears a badge that opens the mode scoped to it', async ({ page }) => {
        await load(page)
        await harness(page, 'setNodePotential', 'a', CORRELATION, 2100)

        const badge = nodeEl(page, 'a').locator('.pvt-node-badge').first()
        // Three characters is all a badge draws, so 2,100 arrives as `2k` rather than
        // being turned into `99+` on the way in (C11).
        await expect(badge.locator('.pvt-node-badge-text')).toHaveText('2k')
        // Self-contained, because the `+n` badge stacks these one per line (C13).
        await expect(badge.locator('title')).toHaveText('~2,100 · Correlations')

        await badge.click()
        expect(await railMode(page)).toBe('pivot')
        // The click is consumed by the badge, so selecting the node is deliberate here —
        // and it has to be, because the origin is the selection.
        await expect(originBlock(page)).toContainText('a')
        await expect(entry(page, CORRELATION)).toHaveClass(/pvt-pivot-focus/)
    })

    test('a potential for an unregistered pivot wears nothing', async ({ page }) => {
        await load(page, { pivots: [] })
        await harness(page, 'setNodePotential', 'a', CORRELATION, 2100)

        await expect(nodeEl(page, 'a').locator('.pvt-node-badge')).toHaveCount(0)
    })

    test('a zero potential clears the badge', async ({ page }) => {
        await load(page)
        await harness(page, 'setNodePotential', 'a', CORRELATION, 12)
        await expect(nodeEl(page, 'a').locator('.pvt-node-badge')).toHaveCount(1)

        await harness(page, 'setNodePotential', 'a', CORRELATION, 0)
        await expect(nodeEl(page, 'a').locator('.pvt-node-badge')).toHaveCount(0)
    })

    test('the context menu routes into the mode, and is absent with no pivots', async ({ page }) => {
        await load(page)
        await openNodeMenu(page, 'a')
        const item = page.locator('.pvt-contextmenu .pvt-action-item', { hasText: 'Pivot…' })
        await expect(item).toHaveCount(1)

        await item.click()
        expect(await railMode(page)).toBe('pivot')
        await expect(heading(page)).toHaveText('4 pivots apply')

        // Nothing applies, so there is no entry — absent, never disabled.
        await loadFixture(page, 'basic', FULL)
        await openNodeMenu(page, 'a')
        await expect(page.locator('.pvt-contextmenu .pvt-action-item', { hasText: 'Pivot…' })).toHaveCount(0)
    })

    // ── the one reporting gap M2 left ───────────────────────────────────────
    test('a failed auto-ingest fetch is reported, since it has no pane', async ({ page }) => {
        await load(page, { pivots: ['event-objects'], fail: true })

        await harness(page, 'runPivot', 'event-objects', ['a'])

        // No pane was ever offered, so the notifier is the only place this can be seen.
        expect(await harness(page, 'dockTabIds')).toEqual(['table'])
        await expect(page.locator('.pivotick-toast')).toContainText('Couldn\'t fetch Objects & attributes')
    })

    test('an auto-ingest over the ceiling says the number and the limit', async ({ page }) => {
        await load(page, { pivots: ['oversized'], ceiling: 100, autoIngest: ['oversized'] })

        await harness(page, 'runPivot', 'oversized', ['a'])

        await expect(page.locator('.pivotick-toast')).toContainText('14,203 candidates, over the 100 limit')
    })

    // ── origin-less pivots ──────────────────────────────────────────────────
    test('an origin-less pivot runs with no origin and stages into the same pane', async ({ page }) => {
        await load(page)
        await enterMode(page)

        const search = entry(page, 'search-archive')
        await expect(count(page, 'search-archive')).toHaveText('~30')
        await button(search, 'Fetch').click()

        await expect(search.locator('.pvt-pivot-triage-link')).toHaveText('30 in triage ▸')
        expect(await harness(page, 'dockTabIds')).toEqual(['table', 'pivot-triage'])
        await expect(page.locator('.pvt-review-tab')).toHaveAttribute('data-pivot', 'search-archive')
    })

    test('the rail slot keeps the mode name while its resting tool is armed', async ({ page }) => {
        await load(page)
        await enterMode(page)
        await expect(railButton(page).locator('.pvt-moderail-label')).toHaveText('Pivot')

        await page.locator('.pvt-toolpanel-tool[data-tool="lasso-origin"]').click()
        await expect(railButton(page).locator('.pvt-moderail-label')).toHaveText('Lasso origin')
    })

    // ── the bulk controls ───────────────────────────────────────────────────────
    // A backend that registers one pivot per enrichment module puts dozens in the
    // panel, none of which can advertise a count. Past `BULK_MIN` the panel grows a
    // filter box, tick boxes and a run tray; the three rules below are what make the
    // two of them worth having together rather than separately.

    const filterBox = (page: Page): Locator => panel(page).locator('.pvt-pivot-filter')
    const filterInput = (page: Page): Locator => panel(page).locator('.pvt-pivot-filter-input')
    const hits = (page: Page): Locator => panel(page).locator('.pvt-pivot-hits')
    const selectAll = (page: Page): Locator => panel(page).locator('.pvt-pivot-selectall')
    const tray = (page: Page): Locator => panel(page).locator('.pvt-pivot-tray')
    const trayCount = (page: Page): Locator => panel(page).locator('.pvt-pivot-tray-count')
    // `/^Run/` without the space: at rest the button is just "Run".
    const trayRun = (page: Page): Locator => tray(page).locator('button', { hasText: /^Run/ })
    const shownEntries = (page: Page): Locator => panel(page).locator('.pvt-pivot-entry')
    const tick = (page: Page, id: string): Locator => entry(page, id).locator('.pvt-pivot-check input')

    /** Load a panel long enough to earn the controls, with an origin picked. */
    const loadBulk = async (page: Page, bulk = 12): Promise<void> => {
        await load(page, { bulk })
        await pickOrigin(page, 'a')
        await enterMode(page)
        await expect(filterBox(page)).toBeVisible()
    }

    // One pivot has nothing to filter and nothing to batch with, so it stays the plain
    // entry it always was. Two is enough to be worth choosing between.
    test('a lone pivot earns no filter box and no tick boxes', async ({ page }) => {
        await load(page, { pivots: [CORRELATION] })
        await pickOrigin(page, 'a')
        await enterMode(page)

        await expect(entry(page, CORRELATION)).toBeVisible()
        await expect(filterBox(page)).toBeHidden()
        await expect(panel(page).locator('.pvt-pivot-check:visible')).toHaveCount(0)
        await expect(tray(page)).toBeHidden()
    })

    test('two of them are enough for the filter and the tick boxes', async ({ page }) => {
        await load(page, { pivots: [CORRELATION, 'blind'] })
        await pickOrigin(page, 'a')
        await enterMode(page)

        await expect(filterBox(page)).toBeVisible()
        await expect(panel(page).locator('.pvt-pivot-check:visible')).toHaveCount(2)
    })

    // The row is the hit target, not the 13px box inside it.
    test('clicking anywhere on a row picks it, but its own buttons still work', async ({ page }) => {
        await loadBulk(page)
        await filterInput(page).fill('geo')

        await entry(page, 'bulk-04').locator('.pvt-pivot-entry-label').click()
        await expect(trayCount(page)).toHaveText('1 selected')
        await expect(entry(page, 'bulk-04')).toHaveClass(/pvt-pivot-picked/)
        // The leading bar, read numerically: the suite's pixel threshold cannot see a
        // colour-only change, and this one shares its box-shadow with the row hairline.
        const shadow = await entry(page, 'bulk-04')
            .evaluate(el => getComputedStyle(el).boxShadow)
        expect(shadow).toContain('2px 0px 0px 0px inset')
        expect(shadow).toContain('0px -1px 0px 0px inset')

        await entry(page, 'bulk-04').locator('.pvt-pivot-entry-label').click()
        await expect(trayCount(page)).toHaveText('Nothing selected')

        // Run belongs to the entry, so it runs rather than picking.
        await button(entry(page, 'bulk-04'), 'Run').click()
        await expect.poll(async () => (await calls(page)).filter(c => c === 'bulk-04:fetch').length)
            .toBe(1)
        await expect(trayCount(page)).toHaveText('Nothing selected')
    })

    // A card around one line is more ink than the line; fifty of them is a column of
    // boxes. An entry only becomes a card once it has something else to say.
    test('an entry with nothing under its head row is drawn as a bare row', async ({ page }) => {
        await loadBulk(page)
        await expect(entry(page, 'bulk-01')).toHaveClass(/pvt-pivot-entry-plain/)
        // The CORRELATION pivot carries a count, a breakdown and a gate, so it keeps its card.
        await expect(entry(page, CORRELATION)).not.toHaveClass(/pvt-pivot-entry-plain/)

        const row = await entryHeight(page, 'bulk-01')
        const card = await entryHeight(page, CORRELATION)
        expect(row).toBeLessThan(40)
        expect(card).toBeGreaterThan(row)
    })

    test('a long one grows a filter, tick boxes and a tray', async ({ page }) => {
        await loadBulk(page)
        await expect(tick(page, 'bulk-01')).toBeVisible()
        // The tray is there from the start, holding its place and saying it is empty.
        await expect(trayCount(page)).toHaveText('Nothing selected')
        await expect(trayRun(page)).toBeDisabled()

        await filterInput(page).fill('whois')
        await expect(hits(page)).toHaveText('3 match')
        await expect(shownEntries(page)).toHaveCount(3)
    })

    // Rule 01. If clearing the box emptied the tray, searching would destroy the
    // selection and building one run out of two searches would be impossible.
    test('the selection outlives the filter that made it', async ({ page }) => {
        await loadBulk(page)

        await filterInput(page).fill('whois')
        await selectAll(page).click()
        await expect(trayCount(page)).toHaveText('3 selected')

        await filterInput(page).fill('')
        await expect(shownEntries(page)).toHaveCount(17)
        await expect(trayCount(page)).toHaveText('3 selected')

        // …and a second search adds to it rather than replacing it.
        await filterInput(page).fill('sandbox')
        await selectAll(page).click()
        await expect(trayRun(page)).toHaveText('Run 6')
    })

    // Rule 02. An unscoped "select all" in a list this long is a way to fire every
    // request at once by accident, so the verb always names what it will add.
    test('select-all names the number it will add, scoped to the filter', async ({ page }) => {
        await loadBulk(page)
        await expect(selectAll(page)).toHaveText('Select all 17')

        await filterInput(page).fill('geo')
        await expect(selectAll(page)).toHaveText('Select 3 matching')
        await selectAll(page).click()
        await expect(selectAll(page)).toHaveText('Deselect 3')
    })

    // Rule 03. Rules 01 and 02 make it possible to hold picks off-screen; this is the
    // control that admits it, and the same control shows them.
    test('the count says what the filter is hiding, and reveals it', async ({ page }) => {
        await loadBulk(page)
        await filterInput(page).fill('geo')
        await selectAll(page).click()

        await filterInput(page).fill('sandbox')
        await expect(trayCount(page)).toHaveText('3 selected · 3 hidden')

        await trayCount(page).click()
        await expect(hits(page)).toHaveText('Showing your 3 selected')
        await expect(shownEntries(page)).toHaveCount(3)
        await expect(trayCount(page)).toHaveText('3 selected')
    })

    // The tray appearing on the first tick would take its height off the scroller, and
    // the list would jump under the pointer just as the analyst aims at the next row.
    test('picking a row moves nothing', async ({ page }) => {
        await loadBulk(page)
        const geometry = () => panel(page).evaluate(el => {
            const box = (sel: string) => {
                const node = el.querySelector(sel) as HTMLElement | null
                return node ? [node.offsetWidth, node.offsetHeight] : null
            }
            return JSON.stringify({
                scroll: box('.pvt-pivot-scroll'),
                first: box('.pvt-pivot-entry'),
                tray: box('.pvt-pivot-tray'),
            })
        })

        const before = await geometry()
        await entry(page, 'bulk-01').locator('.pvt-pivot-entry-label').click()
        await expect(entry(page, 'bulk-01')).toHaveClass(/pvt-pivot-picked/)
        expect(await geometry()).toBe(before)
    })

    test('the tray runs every selected pivot, one run each', async ({ page }) => {
        await loadBulk(page)
        await filterInput(page).fill('geo')
        await selectAll(page).click()
        await trayRun(page).click()

        await expect.poll(async () => (await calls(page)).filter(c => c.endsWith(':fetch')).sort())
            .toEqual(['bulk-04:fetch', 'bulk-08:fetch', 'bulk-12:fetch'])
        // Each keeps its own candidate set, so each gets its own pane — three rows down
        // the review tab's strip, and still one tab in the dock.
        await expect(page.locator('.pvt-review-tab')).toHaveCount(3)
        expect(await harness(page, 'dockTabIds')).toEqual(['table', 'pivot-triage'])
    })

    test('the keyboard reaches the list and comes back', async ({ page }) => {
        await loadBulk(page)
        await filterInput(page).fill('geo')
        await filterInput(page).press('ArrowDown')
        await filterInput(page).press('ArrowDown')

        await expect(tick(page, 'bulk-04')).toBeFocused()
        await page.keyboard.press('Space')
        await expect(trayCount(page)).toHaveText('1 selected')
        // The box has to agree with the tray: it is the state light for exactly this.
        await expect(tick(page, 'bulk-04')).toBeChecked()

        await page.keyboard.press('Escape')
        await expect(filterInput(page)).toBeFocused()
    })

    test('over the caution the tray says what the click costs', async ({ page }) => {
        await loadBulk(page)
        await selectAll(page).click()
        await expect(tray(page).locator('.pvt-pivot-tray-caution'))
            .toHaveText(/17 pivots is over 8 — this asks every one of them at once\./)
    })

    // Being sent to one pivot outranks the filter: the badge would otherwise open the
    // mode and scroll to an entry the filter had taken out of the DOM.
    test('a badge clears a filter that would hide the pivot it opens', async ({ page }) => {
        await load(page, { bulk: 12, pivots: [CORRELATION] })
        await harness(page, 'setNodePotential', 'a', CORRELATION, 2100)
        await pickOrigin(page, 'a')
        await enterMode(page)
        await filterInput(page).fill('geo')
        await expect(entry(page, CORRELATION)).toBeHidden()

        await nodeEl(page, 'a').locator('.pvt-node-badge').first().click()

        await expect(filterInput(page)).toHaveValue('')
        await expect(entry(page, CORRELATION)).toBeVisible()
    })

    // A different origin is a different question; a selection built for the old one
    // would run against nodes it was never chosen for.
    test('a new origin drops the selection but keeps the filter', async ({ page }) => {
        await loadBulk(page)
        await filterInput(page).fill('geo')
        await selectAll(page).click()
        await expect(trayCount(page)).toHaveText('3 selected')

        await pickOrigin(page, 'b')
        await expect(trayCount(page)).toHaveText('Nothing selected')
        await expect(filterInput(page)).toHaveValue('geo')
    })
})
