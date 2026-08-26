import { test, expect, gotoHarness, harness } from '../helpers'
import type { Page } from '@playwright/test'

/**
 * `UI.filter.hideDisconnected` — hide the nodes left with no visible relation, and the
 * View flyout switch that drives it.
 *
 * Counted rather than screenshotted: the suite ignores small pixel differences, and a
 * re-fit races the capture. What matters here is exactly which nodes survive, so every
 * assertion reads the drawn set.
 *
 * The fixture (`disconnectedLayers`) carries the three shapes the rule has to tell apart:
 * `loner` has no edge at all, `c`/`d` hold each other up with a single `correlation`, and
 * `a`/`b` are joined twice over — by a `tag` and by the hub — so switching `tag` off
 * strands nobody.
 */

const ALL = ['a', 'b', 'c', 'd', 'hub', 'loner']
const CONNECTED = ['a', 'b', 'c', 'd', 'hub']

/* ---------- readers ---------- */

async function visibleNodes(page: Page): Promise<string[]> {
    return ((await harness(page, 'visibleNodeIds')) as string[]).slice().sort()
}

/**
 * Poll rather than read once: hiding a node repaints on the next frame, and a one-shot
 * read passes locally and flakes in a loaded parallel run.
 */
async function expectDrawnNodes(page: Page, ids: string[]): Promise<void> {
    await expect.poll(() => visibleNodes(page)).toEqual(ids.slice().sort())
}

const orphanSwitch = (page: Page) =>
    page.locator('.pvt-flyout-view .pvt-flyout-toggle[data-toggle="orphans"]')

const orphanNote = (page: Page) => orphanSwitch(page).locator('.pvt-flyout-toggle-note')

/** Open the View flyout the way the rail does. */
async function openViewFlyout(page: Page): Promise<void> {
    await page.locator('.pvt-moderail-button[data-mode="view"]').click()
    await expect(page.locator('.pvt-flyout-panel.pvt-flyout-view')).toHaveClass(/open/)
}

/** Switch a layer off (or back on) through the panel's row, the way a user does. */
async function clickLayer(page: Page, value: string): Promise<void> {
    await page.locator(`.pvt-edge-layer[data-value="${value}"]`).click()
}

async function openFilterPanel(page: Page): Promise<void> {
    await harness(page, 'openFilterPanel')
    await expect(page.locator('.pvt-slide-panel.open'))
        .toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)')
}

const load = (page: Page, hideDisconnected = false) =>
    harness(page, 'loadWithEdgeLayers', 'disconnectedLayers', {}, { UI: { filter: { hideDisconnected } } })

test.beforeEach(async ({ page }) => {
    await gotoHarness(page)
})

/* ---------- the option ---------- */

test.describe('declared in the options', () => {
    // The point of pruning in the constructor: the loner is never drawn at all, so it
    // cannot appear and then vanish once the layout has settled.
    test('a node with no relation never reaches the canvas', async ({ page }) => {
        await load(page, true)

        await expectDrawnNodes(page, CONNECTED)
        expect(await harness(page, 'disconnectedNodeCount')).toBe(1)
        expect(await harness(page, 'hideDisconnectedOn')).toBe(true)
    })

    test('off by default, so the loner stays', async ({ page }) => {
        await load(page)

        await expectDrawnNodes(page, ALL)
        expect(await harness(page, 'disconnectedNodeCount')).toBe(0)
    })

    // The switch has to show the state it was handed, including the count — nothing
    // announced the startup pass, so the row reads it for itself.
    test('the switch shows the declared state and its count', async ({ page }) => {
        await load(page, true)
        await openViewFlyout(page)

        await expect(orphanSwitch(page)).toHaveAttribute('aria-pressed', 'true')
        // A bare count on the row — the words are in its tooltip, because the row has no
        // width for them (see syncOrphanNote).
        await expect(orphanNote(page)).toHaveText('1')
        await expect(orphanNote(page)).toHaveAttribute('title', '1 unconnected node hidden')
    })
})

/* ---------- the switch ---------- */

test.describe('the View flyout switch', () => {
    test('hides the unconnected node, and brings it back', async ({ page }) => {
        await load(page)
        await openViewFlyout(page)
        await expect(orphanNote(page)).toBeEmpty()

        await orphanSwitch(page).click()
        await expectDrawnNodes(page, CONNECTED)
        expect(await harness(page, 'hideDisconnectedOn')).toBe(true)
        await expect(orphanNote(page)).toHaveText('1')

        await orphanSwitch(page).click()
        await expectDrawnNodes(page, ALL)
        expect(await harness(page, 'hideDisconnectedOn')).toBe(false)
        await expect(orphanNote(page)).toBeEmpty()
    })
})

/* ---------- reapply ---------- */

test.describe('reapply', () => {
    // Filters are applied when a filter changes, not when the data does — so a node added
    // with no relation survives until something recomputes. That is what `reapply` is for,
    // and it is why a node created from code does not vanish under the user's cursor.
    test('a node added with no relation survives until reapply', async ({ page }) => {
        await load(page, true)
        await expectDrawnNodes(page, CONNECTED)

        await harness(page, 'addNode', 'fresh', 220, -20, 'Fresh')
        await expectDrawnNodes(page, [...CONNECTED, 'fresh'])

        await harness(page, 'reapplyFilters')
        await expectDrawnNodes(page, CONNECTED)
    })

    // …and one that got a relation in the meantime stays.
    test('a node given a relation survives the recompute', async ({ page }) => {
        await load(page, true)

        await harness(page, 'addNode', 'fresh', 220, -20, 'Fresh')
        await harness(page, 'connect', 'hub', 'fresh')

        await harness(page, 'reapplyFilters')
        await expectDrawnNodes(page, [...CONNECTED, 'fresh'])
    })
})

/* ---------- with edge layers ---------- */

test.describe('with a layer switched off', () => {
    // The case the feature exists for: `c` and `d` are held up by one `correlation`, so
    // switching that layer off leaves them with nothing.
    test('the nodes a layer stranded go with it', async ({ page }) => {
        await load(page, true)
        await openFilterPanel(page)

        await clickLayer(page, 'correlation')

        await expectDrawnNodes(page, ['a', 'b', 'hub'])
        expect(await harness(page, 'disconnectedNodeCount')).toBe(3)
    })

    // The negative case: `a`—`b` is a second route between two nodes the hub already
    // joins, so switching it off must strand nobody.
    test('a redundant layer strands nobody', async ({ page }) => {
        await load(page, true)
        await openFilterPanel(page)

        await clickLayer(page, 'tag')

        await expectDrawnNodes(page, CONNECTED)
        expect(await harness(page, 'disconnectedNodeCount')).toBe(1)
    })

    // Switching the layer back on has to restore the nodes it took, not just the lines.
    test('switching the layer back on restores its nodes', async ({ page }) => {
        await load(page, true)
        await openFilterPanel(page)

        await clickLayer(page, 'correlation')
        await expectDrawnNodes(page, ['a', 'b', 'hub'])

        await clickLayer(page, 'correlation')
        await expectDrawnNodes(page, CONNECTED)
    })

    // With the rule off, a layer toggle is still a lens: the stranded nodes stay put.
    test('with the rule off the stranded nodes stay', async ({ page }) => {
        await load(page)
        await openFilterPanel(page)

        await clickLayer(page, 'correlation')

        await expectDrawnNodes(page, ALL)
    })
})
