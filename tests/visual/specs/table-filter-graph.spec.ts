import { test, expect, gotoHarness, loadFixture, harness } from '../helpers'

// ── Applying the dock's column filters to the graph ──────────────────────────
// The dock's column filters narrow rows. Pressing "Apply to graph" pushes that
// narrowing onto the canvas as one reserved filter, hiding the elements the
// filters leave out.
//
// The invariants worth defending:
//
//  - Nothing happens until the button is pressed. The separation the `Visibility`
//    column depends on survives as the default (see table-grid.spec's "leaves the
//    canvas alone").
//  - The push says "hide exactly these ids", never "show only these" — so a
//    cluster's interior is untouched when the filter is handed down to it.
//  - The button's state is read back off the engine, so a filter cleared from
//    anywhere else un-lights it.
//
// Asserted numerically throughout: a screenshot cannot see which nodes a filter
// took away, nor what a button's label says about what a press would do.

type Page = import('@playwright/test').Page

/* eslint-disable @typescript-eslint/no-explicit-any */

const FULL = { UI: { mode: 'full', sidebar: { collapsed: false }, table: { open: true } } }

const openDock = async (page: Page, fixture = 'filterable', overrides: Record<string, unknown> = FULL) => {
    await loadFixture(page, fixture as never, overrides)
    await page.locator('.pvt-table-grid').waitFor()
    await page.locator('.pvt-table-row').first().waitFor()
}

const applyButton = (page: Page) => page.locator('.pvt-table-apply')

/**
 * Everything the button is saying at once. `action` is what a press would do, which
 * is the part that carries the design: `push` while there is something new to apply,
 * `clear` once the graph already agrees with the filters.
 */
const buttonState = (page: Page) => applyButton(page).evaluate((el) => {
    const button = el as HTMLButtonElement
    return {
        action: button.dataset.action,
        label: (button.textContent ?? '').trim(),
        lit: button.classList.contains('active'),
        disabled: button.disabled,
        hidden: button.hidden,
    }
})

/** One column's filter control, by column key and the role it plays. */
const filterIn = (page: Page, column: string, role: string) =>
    page.locator(`.pvt-table-th[data-column="${column}"] .pvt-table-filter[data-role="${role}"]`)

const summary = (page: Page) =>
    page.locator('.pvt-table-summary').evaluate((el) => (el.textContent ?? '').trim())

const rowIds = (page: Page) =>
    page.locator('.pvt-table-row').evaluateAll((rows) => rows.map((row) => (row as HTMLElement).dataset.id!))

/** Narrow the `type` column to one value — the dropdown the derived set infers for it. */
const chooseType = async (page: Page, value: string) => {
    await filterIn(page, 'type', 'value').selectOption(value)
    await expect(page.locator('.pvt-table-row')).toHaveCount(value === 'router' ? 3 : 8)
}

test.describe('table: applying column filters to the graph', () => {

    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    test('the button waits for a filter, then hides what it leaves out', async ({ page }) => {
        await openDock(page)

        // Offered, but with nothing to apply it says so rather than pretending.
        expect(await buttonState(page)).toMatchObject({ action: 'push', label: 'Apply to graph', lit: false, disabled: true })
        expect(await harness(page, 'visibleNodeIds')).toHaveLength(8)

        await chooseType(page, 'router')
        // The keystroke alone changes nothing on the canvas — only what a press would do.
        expect(await buttonState(page)).toMatchObject({ action: 'push', lit: false, disabled: false })
        expect(await harness(page, 'visibleNodeIds')).toHaveLength(8)

        await applyButton(page).click()

        expect(await harness(page, 'visibleNodeIds')).toEqual(['r1', 'r2', 'r3'])
        // Lit, and now offering the only sensible next act.
        await expect.poll(() => buttonState(page).then((state) => state.action)).toBe('clear')
        expect(await buttonState(page)).toMatchObject({ label: 'Clear', lit: true, disabled: false })
    })

    // One reserved key, so the filter panel's own form can never clobber it and the
    // header pill counts it as the one filter it is.
    test('the push lands as a single reserved filter', async ({ page }) => {
        await openDock(page)
        await chooseType(page, 'router')
        await applyButton(page).click()
        await expect.poll(() => harness(page, 'visibleNodeIds')).toHaveLength(3)

        expect(await harness(page, 'activeFilterKeys')).toEqual(['__table'])
    })

    test('pressing again restores the graph', async ({ page }) => {
        await openDock(page)
        await chooseType(page, 'router')
        await applyButton(page).click()
        await expect.poll(() => harness(page, 'visibleNodeIds')).toHaveLength(3)

        await applyButton(page).click()

        await expect.poll(() => harness(page, 'visibleNodeIds')).toHaveLength(8)
        expect(await harness(page, 'activeFilterKeys')).toEqual([])
        expect(await buttonState(page)).toMatchObject({ action: 'push', label: 'Apply to graph', lit: false })
    })

    // The count the dock reports has to cover both things it is doing at once: the rows
    // it narrowed, and the elements it is hiding.
    test('the summary reports the rows and the hiding apart', async ({ page }) => {
        await openDock(page)
        expect(await summary(page)).toBe('8 nodes')

        await chooseType(page, 'router')
        expect(await summary(page)).toBe('3 of 8 nodes')

        await applyButton(page).click()
        await expect.poll(() => summary(page)).toBe('3 of 8 nodes · 5 hidden')
    })

    // Stale is decided by comparing the hidden **sets**, not by whether a control moved.
    // So the button re-offers a press the moment the graph and the table stop agreeing —
    // and only then. It stays lit throughout, because the graph is still filtered by the
    // older push either way.
    test('editing a filter re-offers Apply only once the hidden set moves', async ({ page }) => {
        await openDock(page)
        await chooseType(page, 'router')
        await applyButton(page).click()
        await expect.poll(() => buttonState(page).then((state) => state.action)).toBe('clear')

        // Every node with 40+ ports is a router, so this second filter narrows the rows
        // to exactly the same three and excludes exactly the same five. A control moved;
        // what the graph should hide did not, so there is nothing to re-apply.
        await filterIn(page, 'ports', 'min').fill('40')
        expect(await buttonState(page)).toMatchObject({ action: 'clear', lit: true })

        // Switching to the switches does move it — five excluded becomes six.
        await filterIn(page, 'ports', 'min').fill('')
        await filterIn(page, 'type', 'value').selectOption('switch')
        await expect(page.locator('.pvt-table-row')).toHaveCount(2)

        expect(await buttonState(page)).toMatchObject({ action: 'push', label: 'Apply to graph', lit: true, disabled: false })
        // Still the old push until it is pressed again.
        expect(await harness(page, 'visibleNodeIds')).toEqual(['r1', 'r2', 'r3'])

        await applyButton(page).click()
        await expect.poll(() => harness(page, 'visibleNodeIds')).toEqual(['sw1', 'sw2'])
    })

    // Emptying the filters leaves the push as the only thing left, so a press can only
    // mean "undo it" — never "apply nothing", which would read as a no-op button.
    test('clearing the column filters leaves the button offering Clear', async ({ page }) => {
        await openDock(page)
        await chooseType(page, 'router')
        await applyButton(page).click()
        await expect.poll(() => buttonState(page).then((state) => state.action)).toBe('clear')

        await filterIn(page, 'type', 'value').selectOption('')
        await expect(page.locator('.pvt-table-row')).toHaveCount(8)

        expect(await buttonState(page)).toMatchObject({ action: 'clear', label: 'Clear', lit: true })
        // The graph is still filtered — the rows came back, the push did not go away.
        expect(await harness(page, 'visibleNodeIds')).toEqual(['r1', 'r2', 'r3'])
    })

    // The Visibility column's values *are* the graph's filter state, so pushing them
    // would hide whatever is on the canvas and then disagree with itself.
    test('a Visibility filter narrows rows but is never pushed', async ({ page }) => {
        await openDock(page)
        await harness(page, 'setFilter', 'type', { value: 'router', matchMode: 'exact' })
        await expect.poll(() => harness(page, 'visibleNodeIds')).toHaveLength(3)

        await filterIn(page, 'pvt:visibility', 'value').selectOption('filtered')
        await expect(page.locator('.pvt-table-row')).toHaveCount(5)

        // Rows narrowed to the five hidden nodes, and there is still nothing to apply.
        expect(await rowIds(page)).toEqual(['h1', 'h2', 'h3', 'sw1', 'sw2'])
        expect(await buttonState(page)).toMatchObject({ action: 'push', disabled: true })
    })

    // Read back off the engine every time, which is what makes this work.
    test('a filter reset from elsewhere un-lights the button', async ({ page }) => {
        await openDock(page)
        await chooseType(page, 'router')
        await applyButton(page).click()
        await expect.poll(() => buttonState(page).then((state) => state.action)).toBe('clear')

        await harness(page, 'resetFilters')

        await expect.poll(() => harness(page, 'visibleNodeIds')).toHaveLength(8)
        await expect.poll(() => buttonState(page).then((state) => state.lit)).toBe(false)
        expect(await buttonState(page)).toMatchObject({ action: 'push', label: 'Apply to graph' })
    })

    // A push is a filter the Attributes form structurally cannot show — its key is
    // reserved — and folding the dock away takes its button off the screen. Without this
    // section the header pill would count a filter nothing in the UI could name or undo.
    test('the filter panel names the push and can clear it', async ({ page }) => {
        await openDock(page)
        await chooseType(page, 'router')
        await applyButton(page).click()
        await expect.poll(() => harness(page, 'visibleNodeIds')).toHaveLength(3)

        await harness(page, 'openFilterPanel')
        const panel = page.locator('.pvt-slide-panel.open')
        await panel.waitFor({ state: 'visible' })

        const section = panel.locator('.pvt-filter-from-table')
        await expect(section).toBeVisible()
        await expect(section.locator('.pvt-filter-from-table-count')).toHaveText('5 nodes hidden')

        await section.locator('button').click()

        await expect.poll(() => harness(page, 'visibleNodeIds')).toHaveLength(8)
        await expect(section).toBeHidden()
        // And the dock's own button followed the clear it did not make.
        await expect.poll(() => buttonState(page).then((state) => state.lit)).toBe(false)
    })

    test('filterGraph: false leaves the button out', async ({ page }) => {
        await openDock(page, 'filterable', {
            UI: { mode: 'full', sidebar: { collapsed: false }, table: { open: true, filterGraph: false } },
        })
        await expect(applyButton(page)).toHaveCount(0)

        // And the column filters still narrow rows, as they always did.
        await chooseType(page, 'router')
        expect(await rowIds(page)).toEqual(['r1', 'r2', 'r3'])
        expect(await harness(page, 'visibleNodeIds')).toHaveLength(8)
    })

    // ── The other scope ──────────────────────────────────────────────────────

    test('an edge push hides relations and leaves the nodes alone', async ({ page }) => {
        await openDock(page)
        await page.locator('.pvt-dock-view[data-tab="edges"]').click()
        await expect(page.locator('.pvt-table-row')).toHaveCount(8)

        await filterIn(page, 'pvt:source', 'text').fill('sw')
        await expect(page.locator('.pvt-table-row')).toHaveCount(3)

        await applyButton(page).click()

        await expect.poll(() => harness(page, 'visibleEdgeIds')).toEqual(['sw1-h1', 'sw1-h2', 'sw2-h3'])
        // A layer is a lens: no node left the canvas with the relations.
        expect(await harness(page, 'visibleNodeIds')).toHaveLength(8)
    })

    // Both tabs keep their own filter, so both can be live at once.
    test('the two tabs push independently', async ({ page }) => {
        await openDock(page)
        await chooseType(page, 'router')
        await applyButton(page).click()
        await expect.poll(() => harness(page, 'visibleNodeIds')).toHaveLength(3)

        await page.locator('.pvt-dock-view[data-tab="edges"]').click()
        // A fresh tab, so a fresh button — the node push is not this tab's business.
        await expect.poll(() => buttonState(page).then((state) => state.lit)).toBe(false)

        await filterIn(page, 'pvt:source', 'text').fill('r1')
        await applyButton(page).click()

        await expect.poll(() => harness(page, 'activeFilterKeys')).toEqual(['__table', 'edge:__table'])
        // Back on Nodes, the node push is still lit and still hiding.
        await page.locator('.pvt-dock-view[data-tab="nodes"]').click()
        await expect.poll(() => buttonState(page).then((state) => state.lit)).toBe(true)
        expect(await harness(page, 'visibleNodeIds')).toEqual(['r1', 'r2', 'r3'])
    })

    // ── Clusters ─────────────────────────────────────────────────────────────
    // The engine hands the active filters down into every open cluster's own engine. A
    // "hide exactly these ids" filter can only act on ids it names; a "show only these"
    // one would blank the interior. This is the test that would fail if the push were
    // ever inverted.
    //
    // Read with nested rows off, so the pushed set is top-level ids only and the interior
    // is untouched *because nothing named it*. The other half — a push that does name a
    // nested node, and so does reach inside — is in table-nested.spec.ts.

    test('a push naming only top-level ids leaves an open cluster\'s interior alone', async ({ page }) => {
        await openDock(page, 'clustered', { UI: { ...FULL.UI, table: { open: true, nested: false } } })
        await harness(page, 'expand', 'group')
        expect(await harness(page, 'subgraphVisibleNodeIds', 'group')).toEqual(['c1', 'c2', 'c3'])

        // Narrow to the cluster row itself, so both external nodes are pushed out.
        await filterIn(page, 'pvt:label', 'text').fill('group')
        await expect(page.locator('.pvt-table-row')).toHaveCount(1)
        await applyButton(page).click()

        await expect.poll(() => harness(page, 'visibleNodeIds')).toEqual(['group'])
        expect(await harness(page, 'subgraphVisibleNodeIds', 'group')).toEqual(['c1', 'c2', 'c3'])
    })
})
