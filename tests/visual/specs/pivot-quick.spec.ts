import type { Locator, Page } from '@playwright/test'
import { test, expect, gotoHarness, loadFixture, harness, nodeEl } from '../helpers'
import type { PivotFixtureSpec } from '../harness/harness'

// The one-click pivot: *Pivot ▸* in the context menu, one row per pivot that applies,
// and a row that *is* the run — no counts to read, nothing to narrow.
//
// Two things are asserted here, and they are the whole feature. The surface: a submenu
// the context menu never had, listing the registry filtered by `appliesTo`. And the
// deal that makes a blind run safe: where the results land is the pivot's `autoIngest`
// where it declared one, and otherwise how many candidates are *new* — few enough and
// they land, more and triage opens. A run made from the panel is untouched by it.

const FULL = { UI: { mode: 'full', sidebar: { collapsed: true }, table: { open: true } } }

const menu = (page: Page): Locator => page.locator('.pvt-contextmenu:not(.pvt-contextmenu-flyout)')
const flyout = (page: Page): Locator => page.locator('.pvt-contextmenu-flyout')
const pivotRow = (page: Page): Locator => menu(page).locator('.pvt-action-item', { hasText: 'Pivot' }).first()
const flyoutRows = (page: Page): Promise<string[]> =>
    flyout(page).locator('.pvt-action-item').evaluateAll(
        rows => rows.map(row => (row.querySelector('.pvt-action-text')?.textContent ?? '').trim())
    )
const entry = (page: Page, id: string): Locator => page.locator(`.pvt-pivot-entry[data-pivot="${id}"]`)
/** The submenu's scroll container: the list itself, not the flex row holding it. */
const list = (page: Page): Locator => flyout(page).locator('.pvt-action-list')

/** The active rail mode, read from the live store. */
const railMode = (page: Page): Promise<string> => page.evaluate(() =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window.__pivotick as any).graph.UIManager.modeStore.getMode() as string
)

const load = async (page: Page, spec: PivotFixtureSpec = {}, ui: object = FULL): Promise<void> => {
    await harness(page, 'loadWithPivots', 'basic', spec, ui)
    await page.locator('.zoom-layer:not(.hidden)').first().waitFor({ state: 'attached' })
}

/** Right-click a node, the way the context menu is actually reached. */
const openNodeMenu = async (page: Page, id: string): Promise<void> => {
    await nodeEl(page, id).click({ button: 'right' })
    await expect(menu(page)).toHaveClass(/shown/)
}

/** Open the pivot submenu the way an analyst does: the pointer arriving on the row. */
const openPivotSubmenu = async (page: Page, id: string): Promise<void> => {
    await openNodeMenu(page, id)
    await pivotRow(page).hover()
    await expect(flyout(page)).toHaveClass(/shown/)
}

/** The zoom layer's transform, to show the graph behind the menu was left alone. */
const zoomTransform = (page: Page): Promise<string> =>
    page.locator('.zoom-layer:not(.hidden)').first().evaluate(el => el.getAttribute('transform') ?? '')

/** Nodes and edges on the canvas — what a run that landed is judged by. */
const counts = async (page: Page): Promise<{ nodes: number, edges: number }> => {
    const all = await harness(page, 'counts') as { nodes: number, edges: number }
    return { nodes: all.nodes, edges: all.edges }
}

/** Which provider calls have happened, as `pivotId:call` pairs. */
const calls = async (page: Page): Promise<string[]> => {
    const log = await harness(page, 'pivotCalls') as Array<{ pivot: string, call: string }>
    return log.map(call => `${call.pivot}:${call.call}`)
}

/** The origin each fetch was made with, which is the only place a bulk run is visible. */
const fetchOrigins = async (page: Page): Promise<string[][]> => {
    const log = await harness(page, 'pivotCalls') as Array<{ call: string, nodes: string[] }>
    return log.filter(call => call.call === 'fetch').map(call => call.nodes)
}

test.describe('one-click pivot', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    // ── the submenu ─────────────────────────────────────────────────────────
    test('Pivot opens a submenu of what applies, with the panel behind the last row', async ({ page }) => {
        await load(page)
        await openPivotSubmenu(page, 'a')

        // The registry as `appliesTo` leaves it: `search-archive` is origin-less, so it
        // is not a question about this node and is not offered for it.
        expect(await flyoutRows(page)).toEqual([
            'Correlations', 'Objects & attributes', 'Everything, everywhere', 'No advertised count',
            'Open pivot panel…',
        ])
        // Reading the menu costs nothing: the panel is where counts are asked for.
        expect(await calls(page)).toEqual([])
    })

    test('the row is a door, not an action: it opens a panel and keeps the menu', async ({ page }) => {
        await load(page)
        await openNodeMenu(page, 'a')

        await pivotRow(page).click()
        await expect(flyout(page)).toHaveClass(/shown/)
        // A door, so the click neither ran anything nor dismissed what it hangs off —
        // and it opens rather than toggles, because the pointer travelling to the row
        // has already opened the panel the click is aimed at.
        await expect(menu(page)).toHaveClass(/shown/)
        expect(await calls(page)).toEqual([])

        // Leaving is what closes it: the pointer arriving on another row takes it away.
        await menu(page).locator('.pvt-action-item', { hasText: 'Select Neighbors' }).hover()
        await expect(flyout(page)).toHaveCount(0)
        await expect(menu(page)).toHaveClass(/shown/)
    })

    test('the panel row still routes into the mode, and no submenu is left behind', async ({ page }) => {
        await load(page)
        await openPivotSubmenu(page, 'a')

        await flyout(page).locator('.pvt-action-item', { hasText: 'Open pivot panel…' }).click()
        expect(await railMode(page)).toBe('pivot')
        // Both the menu and its submenu are gone: the flyout lives outside the menu's
        // own DOM, so closing one has to be made to close the other.
        await expect(menu(page)).not.toHaveClass(/shown/)
        await expect(flyout(page)).toHaveCount(0)
    })

    test('the submenu is placed against its row and inside the viewport', async ({ page }) => {
        await load(page, { pivots: ['blind'] })
        await openPivotSubmenu(page, 'a')

        const rowBox = (await pivotRow(page).boundingBox())!
        const flyoutBox = (await flyout(page).boundingBox())!
        // Beside the row it belongs to, overlapping it slightly so the pointer can
        // travel there without crossing a gap that belongs to neither.
        expect(flyoutBox.x).toBeGreaterThan(rowBox.x)
        expect(flyoutBox.x).toBeLessThan(rowBox.x + rowBox.width)
        expect(Math.abs(flyoutBox.y - rowBox.y)).toBeLessThan(20)
        // Placed at all: `position: fixed` cannot spill past the viewport, so an
        // unplaced panel is not clipped but gone.
        const viewport = page.viewportSize()!
        expect(flyoutBox.x + flyoutBox.width).toBeLessThanOrEqual(viewport.width)
        expect(flyoutBox.y + flyoutBox.height).toBeLessThanOrEqual(viewport.height)
    })

    test('a long registry scrolls inside the submenu instead of running off the screen', async ({ page }) => {
        // One pivot per enrichment module is the shape that reaches thirty: bare runs,
        // none of which can advertise a count.
        await load(page, { pivots: ['blind'], bulk: 30 })
        await openPivotSubmenu(page, 'a')
        await expect(flyout(page).locator('.pvt-action-item')).toHaveCount(32)

        // Capped, and inside the viewport rather than cut off by it.
        const box = (await flyout(page).boundingBox())!
        const viewport = page.viewportSize()!
        expect(box.height).toBeLessThanOrEqual(390)
        expect(box.y + box.height).toBeLessThanOrEqual(viewport.height)

        // Which means the rest of the list has to be somewhere: it scrolls, and it ends
        // mid-row so that it says so. An overlay scrollbar paints nothing at rest, so a
        // row cut in half is the only mark that there is more below.
        const cut = await list(page).evaluate(el => {
            const rowHeight = el.firstElementChild!.getBoundingClientRect().height
            return {
                hidden: el.scrollHeight - el.clientHeight,
                fraction: (el.clientHeight / rowHeight) % 1,
            }
        })
        expect(cut.hidden).toBeGreaterThan(0)
        expect(cut.fraction).toBeGreaterThan(0.3)
        expect(cut.fraction).toBeLessThan(0.7)

        // The list opens at its top. Capping a centring flex row instead of the list
        // put the first ten rows *above* the top edge, where scrollTop cannot reach.
        const firstRow = await list(page).evaluate(el => {
            const row = el.querySelector('.pvt-action-item')!.getBoundingClientRect()
            const box = el.getBoundingClientRect()
            return { above: box.top - row.top, text: el.querySelector('.pvt-action-text')?.textContent }
        })
        expect(firstRow.above).toBeLessThanOrEqual(0)
        expect(firstRow.text).toBe('No advertised count')

        // Reachable has to mean runnable, so a row past the fold is run.
        const last = flyout(page).locator('.pvt-action-item', { hasText: 'whois lookup 30' })
        await last.scrollIntoViewIfNeeded()
        await last.click()
        await expect.poll(() => harness(page, 'nodeData', 'bulk-30-result')).not.toBeNull()
    })

    test('a wheel inside the submenu scrolls it, and leaves the graph alone', async ({ page }) => {
        await load(page, { pivots: ['blind'], bulk: 30 })
        await openPivotSubmenu(page, 'a')
        const before = await zoomTransform(page)

        const box = (await flyout(page).boundingBox())!
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
        await page.mouse.wheel(0, 600)

        await expect.poll(() => list(page).evaluate(el => el.scrollTop)).toBeGreaterThan(0)
        // The canvas behind it did not zoom — which would also have closed the menu the
        // wheel came from, since a zoom hides it.
        expect(await zoomTransform(page)).toBe(before)
        await expect(flyout(page)).toHaveClass(/shown/)
        await expect(menu(page)).toHaveClass(/shown/)
    })

    test('with no pivots registered there is no Pivot row at all', async ({ page }) => {
        await loadFixture(page, 'basic', FULL)
        await openNodeMenu(page, 'a')
        await expect(menu(page).locator('.pvt-action-item', { hasText: 'Pivot' })).toHaveCount(0)
    })

    // ── the run ─────────────────────────────────────────────────────────────
    test('a small result lands on the canvas with no pane and no mode switch', async ({ page }) => {
        await load(page, { pivots: ['blind'] })
        const before = await counts(page)

        await openPivotSubmenu(page, 'a')
        await flyout(page).locator('.pvt-action-item', { hasText: 'No advertised count' }).click()

        // Three nodes: under the limit, so nothing was ever offered for triage.
        await expect.poll(() => counts(page).then(c => c.nodes)).toBe(before.nodes + 3)
        expect(await harness(page, 'dockTabIds')).toEqual(['table'])
        expect(await harness(page, 'pivotCandidates', 'blind')).toBeNull()
        // The gesture answered where it was made; it did not move the analyst.
        expect(await railMode(page)).toBe('select')
        await expect(menu(page)).not.toHaveClass(/shown/)
    })

    test('over the limit the same run opens triage instead, and lands nothing', async ({ page }) => {
        await load(page, { pivots: ['blind'], quickLimit: 2 })
        const before = await counts(page)

        const outcome = await harness(page, 'runQuickPivot', 'blind', ['a'])
        expect((outcome as { status: string }).status).toBe('staged')

        expect(await harness(page, 'dockTabIds')).toEqual(['table', 'pivot-triage'])
        expect(await counts(page)).toEqual(before)
    })

    test('the limit counts the rows triage would show, not what the provider returned', async ({ page }) => {
        // Three nodes and one edge between two nodes already on canvas. The edge is a
        // row of its own, so this is four rows against a limit of three.
        await load(page, { pivots: ['blind'], quickLimit: 3, edgeOnly: [['a', 'b']] })
        expect(((await harness(page, 'runQuickPivot', 'blind', ['a'])) as { status: string }).status).toBe('staged')

        // The same three nodes with no edge row fit, and land.
        await load(page, { pivots: ['blind'], quickLimit: 3 })
        expect(((await harness(page, 'runQuickPivot', 'blind', ['a'])) as { status: string }).status).toBe('ingested')
    })

    test('candidates already on canvas are not new, so they never fill the limit', async ({ page }) => {
        await load(page, {
            pivots: ['event-objects', 'union-children'],
            quickLimit: 0,
            union: { parent: 'event-a', children: ['object-0', 'object-12'] },
        })
        await harness(page, 'runPivot', 'event-objects', ['a'])
        const before = await harness(page, 'childIds', 'event-a') as string[]

        // The container comes back matching a node already on canvas, so there is
        // nothing to ask about: zero new rows clears even a limit of zero. Its children
        // are not rows either — a container is one row here and one object on canvas,
        // however many things are inside it.
        const outcome = await harness(page, 'runQuickPivot', 'union-children', ['a'])

        expect((outcome as { status: string }).status).toBe('ingested')
        expect(await harness(page, 'dockTabIds')).toEqual(['table'])
        expect(await harness(page, 'childIds', 'event-a')).toEqual([...before, 'object-12'])
    })

    // ── what the pivot itself declared still wins ───────────────────────────
    test('a pivot that asked for triage gets it, however small the result', async ({ page }) => {
        await load(page, { pivots: ['blind'], stage: ['blind'] })
        const before = await counts(page)

        const outcome = await harness(page, 'runQuickPivot', 'blind', ['a'])
        expect((outcome as { status: string }).status).toBe('staged')
        expect(await counts(page)).toEqual(before)
    })

    test('a pivot that asked to land does, however low the limit', async ({ page }) => {
        await load(page, { pivots: ['blind'], autoIngest: ['blind'], quickLimit: 0 })
        const before = await counts(page)

        const outcome = await harness(page, 'runQuickPivot', 'blind', ['a'])
        expect((outcome as { status: string }).status).toBe('ingested')
        expect((await counts(page)).nodes).toBe(before.nodes + 3)
    })

    test('a panel run is not a one-click run: it still stages', async ({ page }) => {
        await load(page, { pivots: ['blind'] })

        // The same pivot, the same three candidates, the same default limit of 50 — but
        // reached by going somewhere to look, which is answered by rows, not by results
        // that have already landed.
        const outcome = await harness(page, 'runPivot', 'blind', ['a'])
        expect((outcome as { status: string }).status).toBe('staged')
        expect(await harness(page, 'dockTabIds')).toEqual(['table', 'pivot-triage'])
    })

    // ── the answer a click cannot show by itself ─────────────────────────────
    test('a refusal made before the fetch opens the panel on that pivot', async ({ page }) => {
        await load(page, { pivots: ['correlation'] })

        // 2,143 advertised against a cap of 2,000: nothing is fetched, so there is no
        // pane to carry the number or the narrowing that lifts it.
        const outcome = await harness(page, 'runQuickPivot', 'correlation', ['a'])
        expect((outcome as { status: string }).status).toBe('refused')
        expect(await harness(page, 'dockTabIds')).toEqual(['table'])

        expect(await railMode(page)).toBe('pivot')
        await expect(entry(page, 'correlation')).toHaveClass(/pvt-pivot-focus/)
        await expect(entry(page, 'correlation').locator('.pvt-pivot-gate-blocked')).toBeVisible()
    })

    // ── the origin ──────────────────────────────────────────────────────────
    test('the origin is the selection when the clicked node belongs to it', async ({ page }) => {
        await load(page, { pivots: ['subset-only'] })
        await harness(page, 'multiSelect', ['a', 'b'])

        await openPivotSubmenu(page, 'a')
        await flyout(page).locator('.pvt-action-item', { hasText: 'Only a, b and c' }).click()

        // One request for both nodes — the reason the contract is array-shaped.
        await expect.poll(() => fetchOrigins(page)).toEqual([['a', 'b']])
    })

    test('clicking outside the selection asks about that node alone', async ({ page }) => {
        await load(page, { pivots: ['subset-only'] })
        await harness(page, 'multiSelect', ['b', 'c'])

        await openPivotSubmenu(page, 'a')
        await flyout(page).locator('.pvt-action-item', { hasText: 'Only a, b and c' }).click()

        await expect.poll(() => fetchOrigins(page)).toEqual([['a']])
        // And the selection it was not about is left where it was.
        expect(await harness(page, 'selectedNodeIds')).toEqual(['b', 'c'])
    })
})
