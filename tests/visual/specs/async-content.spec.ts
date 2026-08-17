import type { Locator, Page } from '@playwright/test'
import {
    test,
    expect,
    gotoHarness,
    harness,
    openNodeTooltip,
    expectElement,
} from '../helpers'

// ── Async content renderers ──────────────────────────────────────────────────
// A consumer content hook may return a promise. The library owns the three
// parts a consumer cannot get right on its own: it mounts a placeholder, it
// swaps the content in when the promise settles, and it drops the result if
// the slot has since gone away.
//
// The harness hands back promises it holds open until a test settles them by
// hand (`settleAsync` / `failAsync`), keyed `<hook>:<element>`. That makes the
// pending window, the staleness drop and out-of-order arrivals observable
// rather than raced against.

const FULL = { UI: { mode: 'full', sidebar: { collapsed: false } } }

const tooltip = (page: Page): Locator => page.locator('.pvt-tooltip')
const asyncContent = (scope: Locator | Page): Locator => scope.locator('.pvt-test-async')
const skeleton = (scope: Locator | Page): Locator => scope.locator('.pvt-async-skeleton')
const errorLine = (scope: Locator | Page): Locator => scope.locator('.pvt-async-error')
const pendingSlot = (scope: Locator | Page): Locator => scope.locator('.pvt-async-slot.pvt-async-pending')
const propertiesBody = (page: Page): Locator => page.locator('.pvt-properties-body-panel')

/**
 * Hover a node, from a standing start over empty canvas.
 *
 * Two tooltip behaviours make the approach matter. Its proximity guard compares
 * the hover-in point against the last canvas mousemove it saw, so a hover that
 * arrives before any mousemove has been processed is silently refused; and
 * moving straight from one node to the next drags the pointer across the open
 * tooltip, whose `mouseleave` cancels the show already scheduled for the second
 * node. Stepping off onto empty canvas first avoids both — and is what a
 * pointer travelling between two nodes does anyway.
 */
async function hoverNode(page: Page, id: string): Promise<Locator> {
    await page.mouse.move(5, 5)
    await expect(tooltip(page)).not.toHaveClass(/shown/)
    return openNodeTooltip(page, id)
}

/** Hover a node, and assert its tooltip is waiting on content rather than showing it. */
async function hoverPending(page: Page, id: string): Promise<Locator> {
    const tip = await hoverNode(page, id)
    await expect(skeleton(tip)).toBeVisible()
    return tip
}

test.describe('async content renderers', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    test('a pending tooltip shows a placeholder, then swaps in the content', async ({ page }) => {
        await harness(page, 'loadAsyncContent', 'basic', { hooks: ['tooltip.renderNodeExtra'] })

        const tip = await hoverPending(page, 'a')
        // The whole point: a promise must never be stringified into the slot.
        await expect(tip).not.toContainText('{}')
        await expectElement(tip, 'async-tooltip-pending.png')

        await harness(page, 'settleAsync', 'tooltip.renderNodeExtra:a', 'enriched for a')
        await expect(asyncContent(tip)).toHaveText('enriched for a')
        await expect(skeleton(tip)).toHaveCount(0)
        await expectElement(tip, 'async-tooltip-resolved.png')
    })

    test('a rejected render shows an error affordance instead of a stuck spinner', async ({ page }) => {
        await harness(page, 'loadAsyncContent', 'basic', { hooks: ['tooltip.renderNodeExtra'] })

        const tip = await hoverPending(page, 'a')
        await harness(page, 'failAsync', 'tooltip.renderNodeExtra:a', 'enrichment endpoint down')

        await expect(errorLine(tip)).toBeVisible()
        await expect(skeleton(tip)).toHaveCount(0)
        await expect(pendingSlot(tip)).toHaveCount(0)
    })

    test('hovering another node drops the first result and aborts its signal', async ({ page }) => {
        await harness(page, 'loadAsyncContent', 'basic', { hooks: ['tooltip.renderNodeExtra'] })

        await hoverPending(page, 'a')
        // Move to `b` while `a` is still in flight — the tooltip is one reused
        // container, so this is the race the library has to own.
        const tip = await hoverPending(page, 'b')
        expect(await harness(page, 'asyncAborted', 'tooltip.renderNodeExtra:a')).toBe(true)
        expect(await harness(page, 'asyncStale', 'tooltip.renderNodeExtra:a')).toBe(true)

        // `a` resolving late must not paint into a tooltip describing `b`.
        await harness(page, 'settleAsync', 'tooltip.renderNodeExtra:a', 'STALE a')
        await harness(page, 'settleAsync', 'tooltip.renderNodeExtra:b', 'fresh b')
        await expect(asyncContent(tip)).toHaveText('fresh b')
        await expect(tip).not.toContainText('STALE a')
    })

    test('only the most recent render commits, whatever order they resolve in', async ({ page }) => {
        await harness(page, 'loadAsyncContent', 'basic', { hooks: ['tooltip.renderNodeExtra'] })

        await hoverPending(page, 'a')
        await hoverPending(page, 'b')
        const tip = await hoverPending(page, 'c')

        // Out of order on purpose: the newest (c) lands first, the oldest (a) last.
        await harness(page, 'settleAsync', 'tooltip.renderNodeExtra:c', 'newest c')
        await expect(asyncContent(tip)).toHaveText('newest c')

        await harness(page, 'settleAsync', 'tooltip.renderNodeExtra:b', 'older b')
        await harness(page, 'settleAsync', 'tooltip.renderNodeExtra:a', 'oldest a')
        await expect(asyncContent(tip)).toHaveText('newest c')
        await expect(tip).not.toContainText('older b')
        await expect(tip).not.toContainText('oldest a')
    })

    test('hiding the tooltip calls off the render it was waiting on', async ({ page }) => {
        await harness(page, 'loadAsyncContent', 'basic', { hooks: ['tooltip.renderNodeExtra'] })

        await hoverPending(page, 'a')
        // Off the node entirely: nothing is going to read that content now.
        await page.mouse.move(5, 5)
        await expect(tooltip(page)).not.toHaveClass(/shown/)
        expect(await harness(page, 'asyncAborted', 'tooltip.renderNodeExtra:a')).toBe(true)
    })

    test('an async properties map fills the tooltip property list', async ({ page }) => {
        await harness(page, 'loadAsyncContent', 'basic', { hooks: ['tooltip.nodePropertiesMap'] })

        const tip = await hoverPending(page, 'a')
        await harness(page, 'settleAsync', 'tooltip.nodePropertiesMap:a', 'fetched rows')
        await expect(tip.locator('.pvt-properties-container')).toContainText('fetched rows')
        await expect(skeleton(tip)).toHaveCount(0)
    })

    test('the properties panel drops a result once the selection has moved on', async ({ page }) => {
        await harness(page, 'loadAsyncContent', 'basic', { hooks: ['propertiesPanel.nodePropertiesMap'] }, FULL)

        await harness(page, 'selectNode', 'a')
        await expect(skeleton(propertiesBody(page))).toBeVisible()

        await harness(page, 'selectNode', 'b')
        expect(await harness(page, 'asyncAborted', 'propertiesPanel.nodePropertiesMap:a')).toBe(true)

        await harness(page, 'settleAsync', 'propertiesPanel.nodePropertiesMap:a', 'STALE a rows')
        await harness(page, 'settleAsync', 'propertiesPanel.nodePropertiesMap:b', 'b rows')
        await expect(propertiesBody(page)).toContainText('b rows')
        await expect(propertiesBody(page)).not.toContainText('STALE a rows')
    })

    test('a synchronous hook renders in place, with no placeholder frame', async ({ page }) => {
        await harness(page, 'loadAsyncContent', 'basic', { syncHooks: ['tooltip.renderNodeExtra'] })

        // Same hook, same surface — but returning content rather than a promise.
        // It must be in the DOM the moment the tooltip is, never a slot.
        const tip = await hoverNode(page, 'a')
        await expect(asyncContent(tip)).toHaveText('sync tooltip.renderNodeExtra · a')
        await expect(pendingSlot(tip)).toHaveCount(0)
        await expect(skeleton(tip)).toHaveCount(0)
        expect(await harness(page, 'pendingAsync')).toEqual([])
        expect(await harness(page, 'asyncCallCount', 'tooltip.renderNodeExtra')).toBe(1)
    })

    test('the placeholder and the error affordance are overridable', async ({ page }) => {
        await harness(page, 'loadAsyncContent', 'basic', {
            hooks: ['tooltip.renderNodeExtra'],
            placeholder: 'fetching…',
            error: 'no luck',
        })

        const tip = await hoverNode(page, 'a')
        await expect(tip).toContainText('fetching…')
        await expect(skeleton(tip)).toHaveCount(0)

        await harness(page, 'failAsync', 'tooltip.renderNodeExtra:a')
        await expect(tip).toContainText('no luck')
        await expect(errorLine(tip)).toHaveCount(0)
    })

    test('an extra panel renders asynchronously and re-fetches on refresh', async ({ page }) => {
        await harness(page, 'loadAsyncContent', 'basic', { hooks: ['extraPanel.render'] }, FULL)
        await harness(page, 'addPanel', { id: 'tray', alwaysVisible: true, async: true })

        const panel = page.locator('[data-panel-id="tray"]')
        await expect(skeleton(panel)).toBeVisible()

        await harness(page, 'settleAsync', 'extraPanel.render:tray', 'inventory')
        await expect(panel.locator('.pvt-test-panel-summary'))
            .toHaveText('nothing selected · renders=1 · inventory')

        // A refresh supersedes the settled render and asks again.
        await harness(page, 'refreshPanel', 'tray')
        await expect(skeleton(panel)).toBeVisible()
        await harness(page, 'settleAsync', 'extraPanel.render:tray', 'inventory v2')
        await expect(panel.locator('.pvt-test-panel-summary'))
            .toHaveText('nothing selected · renders=2 · inventory v2')
    })

    test('the main header and neighbours panel resolve asynchronously too', async ({ page }) => {
        await harness(page, 'loadAsyncContent', 'basic', {
            hooks: ['mainHeader.render', 'neighborsPanel.render'],
        }, FULL)

        const header = page.locator('.pvt-mainheader-panel')
        const neighbors = page.locator('.pvt-neighbor-panel')

        await harness(page, 'selectNode', 'a')
        await expect(skeleton(header)).toBeVisible()
        await expect(skeleton(neighbors)).toBeVisible()

        await harness(page, 'settleAsync', 'mainHeader.render:node a', 'header for a')
        await harness(page, 'settleAsync', 'neighborsPanel.render:node a', 'neighbours of a')
        await expect(asyncContent(header)).toHaveText('header for a')
        await expect(asyncContent(neighbors)).toHaveText('neighbours of a')

        // Clearing the selection re-renders both against `null`, and abandons
        // anything the previous selection was still waiting on.
        await harness(page, 'deselectAll')
        await expect(skeleton(header)).toBeVisible()
        await harness(page, 'settleAsync', 'mainHeader.render:nothing selected', 'no selection')
        await expect(asyncContent(header)).toHaveText('no selection')
    })

    test('tearing the graph down aborts whatever is still in flight', async ({ page }) => {
        await harness(page, 'loadAsyncContent', 'basic', { hooks: ['propertiesPanel.nodePropertiesMap'] }, FULL)
        await harness(page, 'selectNode', 'a')
        expect(await harness(page, 'pendingAsync')).toEqual(['propertiesPanel.nodePropertiesMap:a'])

        await harness(page, 'destroyGraph')
        expect(await harness(page, 'asyncAborted', 'propertiesPanel.nodePropertiesMap:a')).toBe(true)
    })
})
