import type { Locator, Page } from '@playwright/test'
import {
    test,
    expect,
    gotoHarness,
    harness,
    expectElement,
} from '../helpers'

// ── Sidebar extra panels ─────────────────────────────────────────────────────
// A panel is a function of the current selection: `title` and `render` are
// re-invoked on every transition (nothing → node → edge → multi-selection →
// nothing), with the live element — the contract `ExtraPanel` documents. Panels
// are also registrable at any point in the graph's life, addressable by id, and
// removable; `reactive: false` pins one to a single render.
//
// Every harness panel renders `<selection> · renders=<n>`, so what the library
// handed the callback — and how many times — is readable straight off the DOM.

const FULL = { UI: { mode: 'full', sidebar: { collapsed: false } } }

const extraPanels = (page: Page): Locator => page.locator('.pvt-extra-panel')
const panel = (page: Page, id: string): Locator => page.locator(`[data-panel-id="${id}"]`)
const panelTitle = (page: Page, id: string): Locator =>
    panel(page, id).locator('.pivotick-extrapanel-header-panel')
const panelBody = (page: Page, id: string): Locator =>
    panel(page, id).locator('.pvt-test-panel-summary')

/** The panels' DOM order, which must mirror `UIManager.getPanels()`. */
function panelOrder(page: Page): Promise<string[]> {
    return page
        .locator('.pvt-extra-panel > [data-panel-id]')
        .evaluateAll((roots) => roots.map((root) => (root as HTMLElement).dataset.panelId ?? ''))
}

/**
 * A panel is only *shown* for the selection it describes — `alwaysVisible` panels
 * aside. Visibility is the `enter-active` class (the hidden state is opacity 0, so
 * `toBeVisible` can't see the difference); an extra-panel section with no visible
 * panel at all collapses via `display: none`.
 */
async function expectPanelShown(page: Page, id: string, shown: boolean): Promise<void> {
    if (shown) await expect(panel(page, id)).toHaveClass(/enter-active/)
    else await expect(panel(page, id)).not.toHaveClass(/enter-active/)
}

test.describe('sidebar extra panels', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    test('re-renders with the live selection on every transition', async ({ page }) => {
        await harness(page, 'loadWithPanels', 'basic', [{ id: 'sel', alwaysVisible: true }], FULL)

        // Mounted before anything is selected → rendered once, with `null`.
        await expect(panelBody(page, 'sel')).toHaveText('nothing selected · renders=1')
        await expect(panelTitle(page, 'sel')).toHaveText('sel · nothing selected')

        // Single node, then single edge: the callback gets the element itself.
        await harness(page, 'selectNode', 'a')
        await expect(panelBody(page, 'sel')).toHaveText('node a · renders=2')
        await expect(panelTitle(page, 'sel')).toHaveText('sel · node a')

        await harness(page, 'deselectAll')
        await expect(panelBody(page, 'sel')).toHaveText('nothing selected · renders=3')

        await harness(page, 'selectEdge', 'a-b')
        await expect(panelBody(page, 'sel')).toHaveText('edge a-b · renders=4')
        await expect(panelTitle(page, 'sel')).toHaveText('sel · edge a-b')

        // A multi-selection arrives as an array, and clearing it is `null` again.
        await harness(page, 'deselectAll')
        await harness(page, 'multiSelect', ['a', 'b', 'c'])
        await expect(panelBody(page, 'sel')).toHaveText('3 nodes · renders=6')
        await expect(panelTitle(page, 'sel')).toHaveText('sel · 3 nodes')

        await harness(page, 'deselectAll')
        await expect(panelBody(page, 'sel')).toHaveText('nothing selected · renders=7')
    })

    test('shows selection-scoped panels only while something is selected', async ({ page }) => {
        await harness(
            page,
            'loadWithPanels',
            'basic',
            [{ id: 'pinned-open', alwaysVisible: true }, { id: 'on-selection' }],
            FULL
        )

        await expectPanelShown(page, 'pinned-open', true)
        await expectPanelShown(page, 'on-selection', false)

        await harness(page, 'selectNode', 'a')
        await expectPanelShown(page, 'pinned-open', true)
        await expectPanelShown(page, 'on-selection', true)
        // Both panels describe the same node.
        await expect(panelBody(page, 'on-selection')).toHaveText('node a · renders=2')
        await expectElement(extraPanels(page), 'extra-panels-node-selected.png')

        await harness(page, 'deselectAll')
        await expectPanelShown(page, 'on-selection', false)
    })

    test('shows the panel title, and collapses the header when there is none', async ({ page }) => {
        await harness(
            page,
            'loadWithPanels',
            'basic',
            [{ id: 'titled', alwaysVisible: true }, { id: 'headless', alwaysVisible: true, noTitle: true }],
            FULL
        )

        await expect(panelTitle(page, 'titled')).toBeVisible()
        await expect(panelTitle(page, 'titled')).toHaveText('titled · nothing selected')
        // No title → an empty header element, which the CSS keeps collapsed.
        await expect(panelTitle(page, 'headless')).toBeHidden()
        await expect(panelBody(page, 'headless')).toHaveText('nothing selected · renders=1')
    })

    test('registers panels at runtime, caught up to the live selection', async ({ page }) => {
        await harness(page, 'loadWithPanels', 'basic', [], FULL)
        await harness(page, 'selectNode', 'b')

        // Added long after graphReady: it mounts immediately, already describing
        // what is selected right now.
        await harness(page, 'addPanel', { id: 'late' })
        await expect(panelBody(page, 'late')).toHaveText('node b · renders=1')
        await expectPanelShown(page, 'late', true)

        // A plugin's `install` uses the same door.
        await harness(page, 'addPanelViaPlugin', { id: 'from-plugin' })
        await expect(panelBody(page, 'from-plugin')).toHaveText('node b · renders=1')

        expect(await harness(page, 'panelIds')).toEqual(['late', 'from-plugin'])

        // `alwaysVisible` holds for runtime panels too: with the selection cleared,
        // the pinned-open one stays, the selection-scoped ones go.
        await harness(page, 'addPanel', { id: 'late-pinned-open', alwaysVisible: true })
        await harness(page, 'deselectAll')
        await expectPanelShown(page, 'late-pinned-open', true)
        await expectPanelShown(page, 'late', false)
        await expectPanelShown(page, 'from-plugin', false)
    })

    test('registers a panel handed over before graphReady', async ({ page }) => {
        await harness(
            page,
            'loadWithPanels',
            'basic',
            [{ id: 'early', register: 'early', alwaysVisible: true }],
            FULL
        )

        await expect(panelBody(page, 'early')).toHaveText('nothing selected · renders=1')
        expect(await harness(page, 'panelIds')).toEqual(['early'])
    })

    test('the disposer removes the panel and stops its re-renders', async ({ page }) => {
        await harness(page, 'loadWithPanels', 'basic', [], FULL)
        const id = 'disposable'
        await harness(page, 'addPanel', { id })
        await expect(panel(page, id)).toHaveCount(1)

        await harness(page, 'disposePanel', id)
        await expect(panel(page, id)).toHaveCount(0)
        expect(await harness(page, 'panelIds')).toEqual([])

        // Selection changes no longer reach it, and disposing twice is a no-op.
        const rendersAtDispose = await harness(page, 'panelRenderCount', id)
        await harness(page, 'selectNode', 'a')
        await harness(page, 'disposePanel', id)
        expect(await harness(page, 'panelRenderCount', id)).toBe(rendersAtDispose)
        await expect(panel(page, id)).toHaveCount(0)
    })

    test('reactive: false pins a panel until it is refreshed', async ({ page }) => {
        await harness(
            page,
            'loadWithPanels',
            'basic',
            [{ id: 'pinned', reactive: false, alwaysVisible: true }, { id: 'live', alwaysVisible: true }],
            FULL
        )

        await harness(page, 'selectNode', 'a')
        // The reactive panel followed the selection; the pinned one kept its first render.
        await expect(panelBody(page, 'live')).toHaveText('node a · renders=2')
        await expect(panelBody(page, 'pinned')).toHaveText('nothing selected · renders=1')

        // An explicit refresh rebuilds exactly that panel, against the current selection.
        await harness(page, 'refreshPanel', 'pinned')
        await expect(panelBody(page, 'pinned')).toHaveText('node a · renders=2')
        await expect(panelBody(page, 'live')).toHaveText('node a · renders=2')

        // …and refreshPanel() with no id refreshes all of them.
        await harness(page, 'refreshPanel')
        await expect(panelBody(page, 'pinned')).toHaveText('node a · renders=3')
        await expect(panelBody(page, 'live')).toHaveText('node a · renders=3')
    })

    test('a panel drives itself through the handle it is rendered with', async ({ page }) => {
        await harness(page, 'loadWithPanels', 'basic', [{ id: 'self', alwaysVisible: true, selfDriven: true }], FULL)

        // `handle.refresh()` from inside the panel's own button.
        await panel(page, 'self').locator('.pvt-test-panel-refresh').click()
        await expect(panelBody(page, 'self')).toHaveText('nothing selected · renders=2')

        // `handle.remove()` unregisters it — no consumer-held disposer involved.
        await panel(page, 'self').locator('.pvt-test-panel-remove').click()
        await expect(panel(page, 'self')).toHaveCount(0)
        expect(await harness(page, 'panelIds')).toEqual([])
    })

    test('order interleaves runtime panels with option-declared ones', async ({ page }) => {
        await harness(
            page,
            'loadWithPanels',
            'basic',
            [{ id: 'declared-1', alwaysVisible: true }, { id: 'declared-2', alwaysVisible: true }],
            FULL
        )
        // Negative order sorts above the declared pair; the default (0) appends
        // after them, so `UI.extraPanels` still reads top-to-bottom.
        await harness(page, 'addPanel', { id: 'runtime-top', order: -1, alwaysVisible: true })
        await harness(page, 'addPanel', { id: 'runtime-tail', alwaysVisible: true })

        const expected = ['runtime-top', 'declared-1', 'declared-2', 'runtime-tail']
        expect(await harness(page, 'panelIds')).toEqual(expected)
        expect(await panelOrder(page)).toEqual(expected)
    })

    test('panels go with the UI, and a late registration is refused', async ({ page }) => {
        await harness(page, 'loadWithPanels', 'basic', [{ id: 'doomed', alwaysVisible: true }], FULL)
        await expect(panel(page, 'doomed')).toHaveCount(1)

        expect(await harness(page, 'probePanelAfterTeardown', { id: 'too-late' })).toEqual({
            panelsBefore: 1,
            registered: false,
            domPanelsAfter: 0,
        })
    })
})
