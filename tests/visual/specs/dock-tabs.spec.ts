import { test, expect, gotoHarness, harness, loadFixture } from '../helpers'

// ── Dock tabs, and the second occupant ──────────────────────────────────────
// `addDockTab()` (prd/dock-tabs.md). Two claims carry this file:
//
//  1. **The table did not get worse to make room.** Its Nodes / Edges strip is now the
//     dock's own, so with nothing else registered the header is what it always was —
//     the whole table suite passes against unregenerated baselines, and the assertions
//     here are about the strip's *identity*, not its pixels.
//  2. **The API is enough to build a pane with.** The event log ships on nothing but
//     `addDockTab` and the public event buses, and it uses the activation hooks the
//     *opposite* way round from the table: the table stops working when hidden and
//     re-derives, the log keeps recording and stops painting. If the hooks were
//     table-shaped, the log could not do that.

type Page = import('@playwright/test').Page

const FULL = { UI: { mode: 'full', sidebar: { collapsed: false }, table: { open: true } } }
/**
 * Full mode with nothing built in to fill the dock. `UI.dock` is the only way to say
 * "open" here — `UI.table` is switched off, so its copies of the region's settings are
 * out of reach. That is the case a plugin-only dock creates.
 */
const NO_TABLE = { UI: { mode: 'full', sidebar: { collapsed: false }, table: false, dock: { open: true } } }

const strip = (page: Page) => page.locator('.pvt-dock-tabs')
const tabs = (page: Page) => page.locator('.pvt-dock-tab')
const dock = (page: Page) => page.locator('.pvt-dock')

const tabLabels = (page: Page) =>
    tabs(page).evaluateAll(nodes => nodes.map(node => (node.textContent ?? '').trim()))

/** Height of the dock's grid row, as the layout actually resolved it. */
const rowHeight = (page: Page) =>
    page.evaluate(() => {
        const layout = document.querySelector('.pvt-layout') as HTMLElement
        return parseFloat(getComputedStyle(layout).getPropertyValue('--pvt-dock-height')) || 0
    })

const openDock = async (page: Page, overrides: Record<string, unknown> = FULL) => {
    await loadFixture(page, 'basic', overrides)
    await page.locator('.pvt-table-row').first().waitFor()
}

test.describe('dock tab registry', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    // The table is not a special case: it comes through `addDockTab` like anything else,
    // which is what makes a plugin's tab its equal rather than its guest.
    test('the table registers one tab per TableTab', async ({ page }) => {
        await openDock(page)
        expect(await harness(page, 'dockTabIds')).toEqual(['table-nodes', 'table-edges'])
        expect(await harness(page, 'activeDockTabId')).toBe('table-nodes')
        expect(await tabLabels(page)).toEqual(['Nodes', 'Edges'])
    })

    // Equal `order` keeps registration order, and a late arrival registers later by
    // definition — so a plugin lands after the built-in tabs without saying so.
    test('a registered tab lands after the built-in ones and joins the strip', async ({ page }) => {
        await openDock(page)
        await harness(page, 'addTestDockTab', 'audit', 'Audit')

        expect(await harness(page, 'dockTabIds')).toEqual(['table-nodes', 'table-edges', 'audit'])
        expect(await tabLabels(page)).toEqual(['Nodes', 'Edges', 'Audit'])
        // Arriving must not steal the front, nor unfold a dock somebody folded.
        expect(await harness(page, 'activeDockTabId')).toBe('table-nodes')
    })

    test('order places a tab ahead of the built-in ones', async ({ page }) => {
        await openDock(page)
        await harness(page, 'addTestDockTab', 'first', 'First', -10)
        expect(await tabLabels(page)).toEqual(['First', 'Nodes', 'Edges'])
    })

    test('a duplicate id is refused, not stacked', async ({ page }) => {
        await openDock(page)
        await harness(page, 'addTestDockTab', 'audit', 'Audit')
        await harness(page, 'addTestDockTab', 'audit', 'Audit again')

        expect(await harness(page, 'dockTabIds')).toEqual(['table-nodes', 'table-edges', 'audit'])
        expect(await harness(page, 'warnings'))
            .toEqual(expect.arrayContaining([expect.stringContaining('already registered')]))
    })

    test('the disposer removes the tab, and twice is a no-op', async ({ page }) => {
        await openDock(page)
        await harness(page, 'addTestDockTab', 'audit', 'Audit')
        await harness(page, 'removeTestDockTab', 'audit')
        expect(await harness(page, 'dockTabIds')).toEqual(['table-nodes', 'table-edges'])

        // Second call goes through the disposer's own idempotence, so it must not warn
        // about a tab that is legitimately already gone.
        await harness(page, 'removeTestDockTab', 'audit')
        const warnings = (await harness(page, 'warnings')) as string[]
        expect(warnings.filter(w => w.includes('No dock tab'))).toHaveLength(0)
    })

    // Removing the visible tab has to hand the front to a survivor, or the region shows
    // a header over nothing.
    test('removing the active tab promotes another', async ({ page }) => {
        await openDock(page)
        await harness(page, 'addTestDockTab', 'audit', 'Audit')
        await page.locator('.pvt-dock-tab[data-tab="audit"]').click()
        expect(await harness(page, 'activeDockTabId')).toBe('audit')

        await harness(page, 'removeTestDockTab', 'audit')
        expect(await harness(page, 'activeDockTabId')).toBe('table-nodes')
        expect(await harness(page, 'activeDockBodyText')).toContain('A')
    })
})

test.describe('the dock tab strip', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    // The rule the table's own strip already followed, now the dock's: nothing should
    // point at a switch with one setting.
    test('one tab renders no strip; a second brings it in', async ({ page }) => {
        await openDock(page, {
            UI: { mode: 'full', sidebar: { collapsed: false }, table: { open: true, tabs: ['nodes'] } },
        })
        await expect(tabs(page)).toHaveCount(0)
        await expect(strip(page)).toBeHidden()

        await harness(page, 'addTestDockTab', 'audit', 'Audit')
        await expect(tabs(page)).toHaveCount(2)
        await expect(strip(page)).toBeVisible()
    })

    test('switching swaps the body and the toolbar together', async ({ page }) => {
        await openDock(page)
        await harness(page, 'addTestDockTab', 'audit', 'Audit')

        // The table's controls are on the bar, and the test tab's are not.
        await expect(page.locator('.pvt-table-columns-button')).toBeVisible()
        await expect(page.locator('.pvt-test-dock-control')).toHaveCount(0)

        await page.locator('.pvt-dock-tab[data-tab="audit"]').click()
        await expect(page.locator('.pvt-test-dock-body')).toBeVisible()
        await expect(page.locator('.pvt-test-dock-control')).toBeVisible()
        // The table's controls mean nothing over another pane, so they go with it.
        await expect(page.locator('.pvt-table-columns-button')).toHaveCount(0)
        await expect(page.locator('.pvt-table-row')).toHaveCount(0)

        await page.locator('.pvt-dock-tab[data-tab="table-nodes"]').click()
        await expect(page.locator('.pvt-table-columns-button')).toBeVisible()
        await expect(page.locator('.pvt-test-dock-control')).toHaveCount(0)
    })

    // The region's state is the dock's, and switching what is inside it is not a reason
    // for the row to move — the same invariant the hoist established for rebuilds.
    test('switching tabs leaves the height and the fold alone', async ({ page }) => {
        await openDock(page)
        await harness(page, 'addTestDockTab', 'audit', 'Audit')
        const before = await rowHeight(page)

        await page.locator('.pvt-dock-tab[data-tab="audit"]').click()
        expect(await rowHeight(page)).toBeCloseTo(before, 1)
        await expect(dock(page)).toHaveClass(/pvt-dock-open/)
        await expect(dock(page)).not.toHaveClass(/pvt-dock-collapsed/)
    })

    // Each tab's own view state is the table's promise, and it has to survive a detour
    // through a pane that has nothing to do with it.
    test('the table keeps its sort across a detour through another tab', async ({ page }) => {
        await openDock(page)
        await harness(page, 'addTestDockTab', 'audit', 'Audit')

        const degree = page.locator('.pvt-table-th-label', { hasText: 'Degree' })
        await degree.click()
        await degree.click()
        const before = await page.locator('.pvt-table-row')
            .evaluateAll(rows => rows.map(row => (row as HTMLElement).dataset.id!))

        await page.locator('.pvt-dock-tab[data-tab="audit"]').click()
        await expect(page.locator('.pvt-test-dock-body')).toBeVisible()
        await page.locator('.pvt-dock-tab[data-tab="table-nodes"]').click()
        await page.locator('.pvt-table-row').first().waitFor()

        const after = await page.locator('.pvt-table-row')
            .evaluateAll(rows => rows.map(row => (row as HTMLElement).dataset.id!))
        expect(after).toEqual(before)
    })

    // D-3's failure mode is silent: a hidden grid that stopped rebuilding and never
    // caught up looks fine, just wrong. So change the data *while* it is hidden.
    test('a data change while the table is hidden shows up on return', async ({ page }) => {
        await openDock(page)
        await harness(page, 'addTestDockTab', 'audit', 'Audit')
        const rowsBefore = await page.locator('.pvt-table-row').count()

        await page.locator('.pvt-dock-tab[data-tab="audit"]').click()
        await expect(page.locator('.pvt-table-row')).toHaveCount(0)
        await page.evaluate(() => {
            window.__pivotick.graph.addNode({ id: 'ADDED_WHILE_HIDDEN', data: { label: 'Ghost' } } as never)
        })

        await page.locator('.pvt-dock-tab[data-tab="table-nodes"]').click()
        await expect(page.locator('.pvt-table-row')).toHaveCount(rowsBefore + 1)
        await expect(page.locator('.pvt-table-row[data-id="ADDED_WHILE_HIDDEN"]')).toHaveCount(1)
    })

    // The region exists for its occupants. With none left it must not linger as a bar
    // over nothing — it gives the row back to the canvas.
    test('an empty registry gives the row back', async ({ page }) => {
        await loadFixture(page, 'basic', NO_TABLE)
        await expect(dock(page)).toHaveCount(0)

        await harness(page, 'addTestDockTab', 'only', 'Only')
        await expect(dock(page)).toBeVisible()
        expect(await harness(page, 'activeDockTabId')).toBe('only')

        await harness(page, 'removeTestDockTab', 'only')
        await expect(dock(page)).toBeHidden()
        expect(await rowHeight(page)).toBe(0)
    })
})

test.describe('the event log — the dock\'s second occupant', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    test('joins the strip beside the table', async ({ page }) => {
        await harness(page, 'loadWithEventLog', 'basic', {}, FULL)
        expect(await tabLabels(page)).toEqual(['Nodes', 'Edges', 'Events'])
        expect(await harness(page, 'activeDockTabId')).toBe('table-nodes')
    })

    // The whole point of D-4: plugins install after the UI is built, so a tab has to be
    // able to bring the region with it rather than needing the table switched on.
    test('brings the dock with it when the table is switched off', async ({ page }) => {
        await harness(page, 'loadWithEventLog', 'basic', {}, NO_TABLE)

        await expect(dock(page)).toBeVisible()
        expect(await harness(page, 'dockTabIds')).toHaveLength(1)
        // One occupant, so no strip — the log is simply what the dock is.
        await expect(tabs(page)).toHaveCount(0)
    })

    test('records off the public buses, and Clear empties it', async ({ page }) => {
        await harness(page, 'loadWithEventLog', 'basic', {}, NO_TABLE)
        await page.locator('.pvt-eventlog').waitFor()

        await page.evaluate(() => {
            window.__pivotick.graph.addNode({ id: 'LOGGED', data: { label: 'Logged' } } as never)
        })
        await expect(page.locator('.pvt-eventlog-row').first()).toBeVisible()
        expect(await harness(page, 'eventLogTypes')).toContain('nodeAdd')
        await expect(page.locator('.pvt-eventlog-row', { hasText: 'Logged' })).toHaveCount(1)

        await page.locator('.pvt-eventlog-clear').click()
        await expect(page.locator('.pvt-eventlog-row')).toHaveCount(0)
        await expect(page.locator('.pvt-eventlog-empty')).toBeVisible()
    })

    test('Pause stops recording, and the list survives it', async ({ page }) => {
        await harness(page, 'loadWithEventLog', 'basic', {}, NO_TABLE)
        await page.locator('.pvt-eventlog').waitFor()
        await page.locator('.pvt-eventlog-clear').click()

        await page.locator('.pvt-eventlog-pause').click()
        await page.evaluate(() => {
            window.__pivotick.graph.addNode({ id: 'WHILE_PAUSED', data: { label: 'Nope' } } as never)
        })
        await expect(page.locator('.pvt-eventlog-row')).toHaveCount(0)

        await page.locator('.pvt-eventlog-pause').click()
        await page.evaluate(() => {
            window.__pivotick.graph.addNode({ id: 'AFTER_RESUME', data: { label: 'Yes' } } as never)
        })
        await expect(page.locator('.pvt-eventlog-row', { hasText: 'Yes' })).toHaveCount(1)
        await expect(page.locator('.pvt-eventlog-row', { hasText: 'Nope' })).toHaveCount(0)
    })

    // The contrast that proves the activation hooks are not table-shaped. The table
    // stops working while hidden because it can re-derive; the log cannot — an event is
    // gone once it has fired — so it keeps recording and only stops painting.
    test('keeps recording while hidden, and paints the backlog on return', async ({ page }) => {
        await harness(page, 'loadWithEventLog', 'basic', {}, FULL)
        await page.locator('.pvt-dock-tab[data-tab="table-nodes"]').waitFor()

        // The log has never been activated, so it has no DOM at all yet.
        await expect(page.locator('.pvt-eventlog')).toHaveCount(0)
        await page.evaluate(() => {
            window.__pivotick.graph.addNode({ id: 'BEFORE_FIRST_LOOK', data: { label: 'Early' } } as never)
        })
        expect(await harness(page, 'eventLogTypes')).toContain('nodeAdd')

        const eventsTab = page.locator('.pvt-dock-tab', { hasText: 'Events' })
        await eventsTab.click()
        await expect(page.locator('.pvt-eventlog-row', { hasText: 'Early' })).toHaveCount(1)

        // Back to the table, emit again, and return: the entry recorded while the log
        // was off screen has to be on the list.
        await page.locator('.pvt-dock-tab[data-tab="table-nodes"]').click()
        await page.evaluate(() => {
            window.__pivotick.graph.addNode({ id: 'WHILE_LOG_HIDDEN', data: { label: 'Later' } } as never)
        })
        await eventsTab.click()
        await expect(page.locator('.pvt-eventlog-row', { hasText: 'Later' })).toHaveCount(1)
        await expect(page.locator('.pvt-eventlog-row', { hasText: 'Early' })).toHaveCount(1)
    })

    test('the kind filter narrows the list to one bus', async ({ page }) => {
        await harness(page, 'loadWithEventLog', 'basic', {}, NO_TABLE)
        await page.locator('.pvt-eventlog').waitFor()
        await page.locator('.pvt-eventlog-clear').click()

        await page.evaluate(() => {
            const graph = window.__pivotick.graph
            graph.addNode({ id: 'MIXED', data: { label: 'Mixed' } } as never)
            graph.queryEngine.setFilter('label', 'A' as never)
        })
        await expect(page.locator('.pvt-eventlog-row[data-kind="data"]').first()).toBeVisible()
        await expect(page.locator('.pvt-eventlog-row[data-kind="filter"]').first()).toBeVisible()

        await page.locator('.pvt-eventlog-kind').selectOption('filter')
        await expect(page.locator('.pvt-eventlog-row[data-kind="data"]')).toHaveCount(0)
        await expect(page.locator('.pvt-eventlog-row[data-kind="filter"]').first()).toBeVisible()
    })

    // The dock is a `full`-mode grid row. Asked for explicitly, so silence would be worse
    // than a warning.
    test('says why it did not mount outside full mode', async ({ page }) => {
        await harness(page, 'loadWithEventLog', 'basic', {}, { UI: { mode: 'light' } })
        await expect(page.locator('.pvt-eventlog')).toHaveCount(0)
        expect(await harness(page, 'warnings'))
            .toEqual(expect.arrayContaining([expect.stringContaining('\'full\' mode only')]))
    })
})
