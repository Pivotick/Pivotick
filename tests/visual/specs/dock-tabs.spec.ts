import { test, expect, gotoHarness, harness, loadFixture } from '../helpers'

// ── Dock tabs, and the second occupant ──────────────────────────────────────
// `addDockTab()` (prd/archive/dock-tabs.md). The model is **nested**: the dock's strip names
// *panes* (`Table`, `Events`), and a pane with several views of its own draws its own
// switch. So `Nodes` / `Edges` are the table's, not the dock's — they are two views of
// one pane, and listing them beside another pane's tab would claim otherwise.
//
// Three claims carry this file:
//
//  1. **The table did not get worse to make room.** On its own it is a single pane, so
//     the dock draws no strip at all and its header is exactly what it always was — the
//     whole table suite passes against unregenerated baselines.
//  2. **The two levels are visually distinct.** Outer tabs are full-height and
//     underlined; the inner switch is a pill group. Adjacent strips that looked alike
//     would defeat the point of nesting them.
//  3. **The API is enough to build a pane with.** The event log ships on nothing but
//     `addDockTab` and the public event buses, and it uses the activation hooks the
//     *opposite* way round from the table.

type Page = import('@playwright/test').Page

const FULL = { UI: { mode: 'full', sidebar: { collapsed: false }, table: { open: true } } }
/**
 * Full mode with nothing built in to fill the dock. `UI.dock` is the only way to say
 * "open" here — `UI.table` is switched off, so its copies of the region's settings are
 * out of reach. That is the case a plugin-only dock creates.
 */
const NO_TABLE = { UI: { mode: 'full', sidebar: { collapsed: false }, table: false, dock: { open: true } } }

/** The dock's own strip — panes. */
const paneStrip = (page: Page) => page.locator('.pvt-dock-tabs')
const paneTabs = (page: Page) => page.locator('.pvt-dock-tab')
/** The table's own strip — views of one pane. */
const viewTabs = (page: Page) => page.locator('.pvt-dock-view')
const dock = (page: Page) => page.locator('.pvt-dock')

const paneLabels = (page: Page) =>
    paneTabs(page).evaluateAll(nodes => nodes.map(node => (node.textContent ?? '').trim()))

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

/** Move the graph, so a pane has something to have missed while it was hidden. */
const addNode = (page: Page, id: string, label: string) =>
    page.evaluate(([id, label]) => {
        window.__pivotick.graph.addNode({ id, data: { label } } as never)
    }, [id, label])

test.describe('dock tab registry', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    // One pane, not two. The table's Nodes / Edges live inside it and never reach the
    // registry — this is the assertion that pins the nested model down.
    test('the table registers a single pane, and keeps its own views', async ({ page }) => {
        await openDock(page)
        expect(await harness(page, 'dockTabIds')).toEqual(['table'])
        expect(await harness(page, 'activeDockTabId')).toBe('table')

        // Alone, there is nothing to switch between at the pane level…
        await expect(paneTabs(page)).toHaveCount(0)
        await expect(paneStrip(page)).toBeHidden()
        // …but the table's own two views are on the bar as always.
        await expect(viewTabs(page)).toHaveCount(2)
    })

    test('a registered pane joins the strip, after the built-in one', async ({ page }) => {
        await openDock(page)
        await harness(page, 'addTestDockTab', 'audit', 'Audit')

        expect(await harness(page, 'dockTabIds')).toEqual(['table', 'audit'])
        expect(await paneLabels(page)).toEqual(['Table', 'Audit'])
        // Arriving must not steal the front, nor unfold a dock somebody folded.
        expect(await harness(page, 'activeDockTabId')).toBe('table')
    })

    test('order places a pane ahead of the built-in one', async ({ page }) => {
        await openDock(page)
        await harness(page, 'addTestDockTab', 'first', 'First', -10)
        expect(await paneLabels(page)).toEqual(['First', 'Table'])
    })

    test('a duplicate id is refused, not stacked', async ({ page }) => {
        await openDock(page)
        await harness(page, 'addTestDockTab', 'audit', 'Audit')
        await harness(page, 'addTestDockTab', 'audit', 'Audit again')

        expect(await harness(page, 'dockTabIds')).toEqual(['table', 'audit'])
        expect(await harness(page, 'warnings'))
            .toEqual(expect.arrayContaining([expect.stringContaining('already registered')]))
    })

    test('the disposer removes the pane, and twice is a no-op', async ({ page }) => {
        await openDock(page)
        await harness(page, 'addTestDockTab', 'audit', 'Audit')
        await harness(page, 'removeTestDockTab', 'audit')
        expect(await harness(page, 'dockTabIds')).toEqual(['table'])

        // Second call goes through the disposer's own idempotence, so it must not warn
        // about a tab that is legitimately already gone.
        await harness(page, 'removeTestDockTab', 'audit')
        const warnings = (await harness(page, 'warnings')) as string[]
        expect(warnings.filter(w => w.includes('No dock tab'))).toHaveLength(0)
    })

    test('removing the active pane promotes another', async ({ page }) => {
        await openDock(page)
        await harness(page, 'addTestDockTab', 'audit', 'Audit')
        await page.locator('.pvt-dock-tab[data-tab="audit"]').click()
        expect(await harness(page, 'activeDockTabId')).toBe('audit')

        await harness(page, 'removeTestDockTab', 'audit')
        expect(await harness(page, 'activeDockTabId')).toBe('table')
        await expect(page.locator('.pvt-table-row').first()).toBeVisible()
    })
})

test.describe('the two levels of switch', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    // The whole reason for nesting: an outer tab and an inner one sitting side by side
    // must not look like siblings. Outer are full-height and underlined; inner are pills.
    test('outer tabs are underlined, inner ones are pills', async ({ page }) => {
        await openDock(page)
        await harness(page, 'addTestDockTab', 'audit', 'Audit')

        const outer = await page.locator('.pvt-dock-tab.active').evaluate((el) => {
            const s = getComputedStyle(el)
            return { borderBottom: parseFloat(s.borderBottomWidth), radius: parseFloat(s.borderTopLeftRadius), bg: s.backgroundColor }
        })
        const inner = await page.locator('.pvt-dock-view.active').evaluate((el) => {
            const s = getComputedStyle(el)
            return { borderBottom: parseFloat(s.borderBottomWidth), radius: parseFloat(s.borderTopLeftRadius), bg: s.backgroundColor }
        })

        // Outer: an underline, square corners, no fill.
        expect(outer.borderBottom).toBeGreaterThanOrEqual(2)
        expect(outer.radius).toBe(0)
        expect(outer.bg).toMatch(/rgba\(0, 0, 0, 0\)|transparent/)
        // Inner: a filled, rounded pill with a hairline border.
        expect(inner.radius).toBeGreaterThan(0)
        expect(inner.bg).not.toMatch(/rgba\(0, 0, 0, 0\)|transparent/)
        expect(inner.borderBottom).toBeLessThan(2)
    })

    // The outer tab stretches the bar so its underline meets the header's bottom rule;
    // the inner pill does not. That is what makes one read as attached and the other as
    // a control sitting in the bar.
    test('an outer tab spans the header, an inner one does not', async ({ page }) => {
        await openDock(page)
        await harness(page, 'addTestDockTab', 'audit', 'Audit')

        const header = (await page.locator('.pvt-dock-header').boundingBox())!
        const outer = (await page.locator('.pvt-dock-tab.active').boundingBox())!
        const inner = (await page.locator('.pvt-dock-view.active').boundingBox())!

        expect(outer.height).toBeGreaterThanOrEqual(header.height - 1)
        expect(inner.height).toBeLessThan(header.height - 4)
    })

    // Switching pane takes the table's own switch away with the rest of its controls —
    // an inner strip belonging to a pane nobody is looking at would be nonsense.
    test('switching pane swaps the body, the controls and the inner strip', async ({ page }) => {
        await openDock(page)
        await harness(page, 'addTestDockTab', 'audit', 'Audit')

        await expect(viewTabs(page)).toHaveCount(2)
        await expect(page.locator('.pvt-table-columns-button')).toBeVisible()
        await expect(page.locator('.pvt-test-dock-control')).toHaveCount(0)

        await page.locator('.pvt-dock-tab[data-tab="audit"]').click()
        await expect(page.locator('.pvt-test-dock-body')).toBeVisible()
        await expect(page.locator('.pvt-test-dock-control')).toBeVisible()
        await expect(page.locator('.pvt-table-columns-button')).toHaveCount(0)
        await expect(viewTabs(page)).toHaveCount(0)
        await expect(page.locator('.pvt-table-row')).toHaveCount(0)

        await page.locator('.pvt-dock-tab[data-tab="table"]').click()
        await expect(viewTabs(page)).toHaveCount(2)
        await expect(page.locator('.pvt-table-columns-button')).toBeVisible()
    })

    // The inner switch goes through `handle.refresh()`, so the dock is never left holding
    // a stale grid to re-attach. Prove it by switching view, leaving the pane, coming back.
    test('an inner switch survives leaving the pane and returning', async ({ page }) => {
        await openDock(page)
        await harness(page, 'addTestDockTab', 'audit', 'Audit')

        await page.locator('.pvt-dock-view[data-tab="edges"]').click()
        await page.locator('.pvt-table-row').first().waitFor()
        const headings = () => page.locator('.pvt-table-th-label')
            .evaluateAll(cells => cells.map(c => (c.textContent ?? '').trim()).slice(0, 4))
        expect(await headings()).toEqual(['Visibility', 'Source', 'Label', 'Target'])

        await page.locator('.pvt-dock-tab[data-tab="audit"]').click()
        await expect(page.locator('.pvt-test-dock-body')).toBeVisible()
        await page.locator('.pvt-dock-tab[data-tab="table"]').click()
        await page.locator('.pvt-table-row').first().waitFor()

        // Still Edges, and still the edges grid — not a stale node grid re-attached.
        expect(await headings()).toEqual(['Visibility', 'Source', 'Label', 'Target'])
        await expect(page.locator('.pvt-dock-view[data-tab="edges"]')).toHaveClass(/active/)
        await expect(page.locator('.pvt-table-row')).toHaveCount(7)
    })

    // `refresh()` has to rebuild the **toolbar** as well as the body. A pane's controls
    // usually *are* its view switch, so refreshing only the body leaves the control
    // marking the view you just left — which is exactly what shipped first.
    test('refresh rebuilds the controls, not just the body', async ({ page }) => {
        await openDock(page)
        await expect(page.locator('.pvt-dock-view[data-tab="nodes"]')).toHaveClass(/active/)

        await page.locator('.pvt-dock-view[data-tab="edges"]').click()
        await page.locator('.pvt-table-row').first().waitFor()

        // The strip is rebuilt by the refresh, so it must come back marking Edges.
        await expect(page.locator('.pvt-dock-view[data-tab="edges"]')).toHaveClass(/active/)
        await expect(page.locator('.pvt-dock-view[data-tab="nodes"]')).not.toHaveClass(/active/)
    })

    // The region's state is the dock's, and switching what is inside it is not a reason
    // for the row to move.
    test('switching panes leaves the height and the fold alone', async ({ page }) => {
        await openDock(page)
        await harness(page, 'addTestDockTab', 'audit', 'Audit')
        const before = await rowHeight(page)

        await page.locator('.pvt-dock-tab[data-tab="audit"]').click()
        expect(await rowHeight(page)).toBeCloseTo(before, 1)
        await expect(dock(page)).toHaveClass(/pvt-dock-open/)
        await expect(dock(page)).not.toHaveClass(/pvt-dock-collapsed/)
    })

    test('each inner view keeps its own sort across a detour through another pane', async ({ page }) => {
        await openDock(page)
        await harness(page, 'addTestDockTab', 'audit', 'Audit')

        const degree = page.locator('.pvt-table-th-label', { hasText: 'Degree' })
        await degree.click()
        await degree.click()
        const before = await page.locator('.pvt-table-row')
            .evaluateAll(rows => rows.map(row => (row as HTMLElement).dataset.id!))

        await page.locator('.pvt-dock-tab[data-tab="audit"]').click()
        await expect(page.locator('.pvt-test-dock-body')).toBeVisible()
        await page.locator('.pvt-dock-tab[data-tab="table"]').click()
        await page.locator('.pvt-table-row').first().waitFor()

        const after = await page.locator('.pvt-table-row')
            .evaluateAll(rows => rows.map(row => (row as HTMLElement).dataset.id!))
        expect(after).toEqual(before)
    })

    // D-3's failure mode is silent: a hidden pane that stopped rebuilding and never
    // caught up looks fine, just wrong. So change the data *while* it is hidden.
    test('a data change while the table pane is hidden shows up on return', async ({ page }) => {
        await openDock(page)
        await harness(page, 'addTestDockTab', 'audit', 'Audit')
        const rowsBefore = await page.locator('.pvt-table-row').count()

        await page.locator('.pvt-dock-tab[data-tab="audit"]').click()
        await expect(page.locator('.pvt-table-row')).toHaveCount(0)
        await addNode(page, 'ADDED_WHILE_HIDDEN', 'Ghost')

        await page.locator('.pvt-dock-tab[data-tab="table"]').click()
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

    // `refresh` on a pane nobody is looking at must not build anything — it drops the
    // cached body so the next activation rebuilds it.
    test('refreshing a hidden pane defers the rebuild to its next activation', async ({ page }) => {
        await openDock(page)
        await harness(page, 'addTestDockTab', 'audit', 'Audit')
        await page.locator('.pvt-dock-tab[data-tab="audit"]').click()
        await expect(page.locator('.pvt-test-dock-body')).toBeVisible()

        await harness(page, 'refreshDockTab', 'table')
        // Nothing of the table appears while it is hidden…
        await expect(page.locator('.pvt-table-row')).toHaveCount(0)
        // …and it comes back whole.
        await page.locator('.pvt-dock-tab[data-tab="table"]').click()
        await expect(page.locator('.pvt-table-row').first()).toBeVisible()
    })
})

test.describe('a pane contributed by a plugin', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    test('joins the strip beside the table', async ({ page }) => {
        await harness(page, 'loadWithPluginPane', 'basic', FULL)
        expect(await paneLabels(page)).toEqual(['Table', 'Recorder'])
        expect(await harness(page, 'activeDockTabId')).toBe('table')
        // The table's own views stay the table's.
        await expect(viewTabs(page)).toHaveCount(2)
    })

    // The whole point of D-4, and the reason `ensureDock()` is load-bearing rather than
    // defensive: plugins install *after* the UI is built, so a tab has to be able to
    // bring the region with it rather than needing the table switched on. This is the
    // plugin route specifically — `addTestDockTab` reaches `UIManager` directly.
    test('brings the dock with it when the table is switched off', async ({ page }) => {
        await harness(page, 'loadWithPluginPane', 'basic', NO_TABLE)

        await expect(dock(page)).toBeVisible()
        expect(await harness(page, 'dockTabIds')).toEqual(['pluginPane'])
        // One pane, so no strip — the pane is simply what the dock is.
        await expect(paneTabs(page)).toHaveCount(0)
    })

    // The contrast that proves the activation hooks are not table-shaped. The table stops
    // working while hidden because it can re-derive; a pane watching a live bus cannot —
    // an event is gone once it has fired — so it keeps recording and only stops painting.
    test('keeps working while hidden, and paints the backlog on return', async ({ page }) => {
        await harness(page, 'loadWithPluginPane', 'basic', FULL)
        await page.locator('.pvt-dock-tab[data-tab="table"]').waitFor()

        // Never activated, so it has no DOM at all yet — but it is already recording.
        await expect(page.locator('.pvt-plugin-pane')).toHaveCount(0)
        await addNode(page, 'BEFORE_FIRST_LOOK', 'Early')
        expect(await harness(page, 'pluginPaneRecorded')).toContain('Early')

        const recorder = page.locator('.pvt-dock-tab', { hasText: 'Recorder' })
        await recorder.click()
        await expect(page.locator('.pvt-plugin-pane-row', { hasText: 'Early' })).toHaveCount(1)

        // Back to the table, emit again, and return: what was recorded while the pane was
        // off screen has to be on the list.
        await page.locator('.pvt-dock-tab[data-tab="table"]').click()
        await addNode(page, 'WHILE_PANE_HIDDEN', 'Later')
        await recorder.click()
        await expect(page.locator('.pvt-plugin-pane-row', { hasText: 'Later' })).toHaveCount(1)
        await expect(page.locator('.pvt-plugin-pane-row', { hasText: 'Early' })).toHaveCount(1)
    })
})

// ── the strip's own furniture ────────────────────────────────────────────────────
test.describe('the tab strip', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    const sep = (page: Page) => page.locator('.pvt-dock-sep')
    const ICON = '<svg viewBox="0 0 24 24"><path d="M12 2l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/></svg>'

    // Several tabs that are the same *kind* of pane read as one list of strangers
    // without a glyph saying where each came from.
    test('a tab draws the icon it declared, and one without draws none', async ({ page }) => {
        await openDock(page)
        await harness(page, 'addTestDockTab', 'plain', 'Plain')
        await harness(page, 'addTestDockTab', 'marked', 'Marked', undefined, ICON)

        const icons = (id: string) =>
            page.locator(`.pvt-dock-tab[data-tab="${id}"] .pvt-dock-tab-icon svg`)
        await expect(icons('marked')).toHaveCount(1)
        await expect(icons('plain')).toHaveCount(0)
        await expect(icons('table')).toHaveCount(0)
        // The glyph is decoration on a button that already says what it is.
        await expect(page.locator('.pvt-dock-tab[data-tab="marked"]')).toHaveText('Marked')
    })

    // It divides two things, so it is drawn only with something on both sides.
    test('the separator needs a strip on one side and controls on the other', async ({ page }) => {
        // Table alone: one tab, so no strip at all.
        await openDock(page)
        await expect(paneTabs(page)).toHaveCount(0)
        await expect(sep(page)).toBeHidden()

        // Two tabs and the table's own controls.
        await harness(page, 'addTestDockTab', 'second', 'Second')
        await expect(paneTabs(page)).toHaveCount(2)
        await expect(sep(page)).toBeVisible()
    })

    // Closing one review pane should leave you in the next one, not back at the table.
    test('a closed tab hands over to the last one open, not the first', async ({ page }) => {
        await openDock(page)
        await harness(page, 'addTestDockTab', 'one', 'One')
        await harness(page, 'addTestDockTab', 'two', 'Two')
        await harness(page, 'addTestDockTab', 'three', 'Three')

        // Each in turn, which is what a run of fetches does: every pane comes to the
        // front as it arrives.
        for (const id of ['one', 'two', 'three']) {
            await page.locator(`.pvt-dock-tab[data-tab="${id}"]`).click()
        }
        expect(await harness(page, 'activeDockTabId')).toBe('three')

        // Closing walks back down the panes rather than jumping to the table.
        await harness(page, 'removeTestDockTab', 'three')
        expect(await harness(page, 'activeDockTabId')).toBe('two')

        await harness(page, 'removeTestDockTab', 'two')
        expect(await harness(page, 'activeDockTabId')).toBe('one')

        await harness(page, 'removeTestDockTab', 'one')
        expect(await harness(page, 'activeDockTabId')).toBe('table')
    })

    // A tab nobody ever opened is not somewhere to be sent back to.
    test('the hand-over skips panes that were never on show', async ({ page }) => {
        await openDock(page)
        await harness(page, 'addTestDockTab', 'unseen', 'Unseen')
        await harness(page, 'addTestDockTab', 'seen', 'Seen')
        await page.locator('.pvt-dock-tab[data-tab="seen"]').click()

        await harness(page, 'removeTestDockTab', 'seen')
        expect(await harness(page, 'activeDockTabId')).toBe('table')
    })
})
