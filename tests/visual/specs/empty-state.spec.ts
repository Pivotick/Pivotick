/**
 * `UI.emptyState`: the card an empty canvas shows. It is up while the graph holds no
 * node and no note, follows the data both ways, re-renders on each appearance with
 * `initial` telling a never-filled graph from an emptied one, and lets the canvas's
 * gestures through everywhere but its interactive content.
 */
import { test, expect, gotoHarness, loadFixture, harness, canvas } from '../helpers'
import type { Page } from '@playwright/test'

const card = (page: Page) => page.locator('.pvt-empty-state-card')

/** Run `graph.history.undo()` / `redo()` in the page. */
async function history(page: Page, step: 'undo' | 'redo'): Promise<void> {
    await page.evaluate((s) => {
        const graph = (window.__pivotick as unknown as { graph: { history: Record<string, () => void> } }).graph
        graph.history[s]()
    }, step)
}

/** The zoom layer's transform, which a pan or a zoom over the canvas changes. */
async function viewTransform(page: Page): Promise<string | null> {
    return page.locator('.zoom-layer').first().getAttribute('transform')
}

test.describe('empty canvas state', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    test('an empty graph shows the default card', async ({ page }) => {
        await loadFixture(page, 'empty')
        await expect(card(page)).toHaveText('Nothing on the canvas yet')
        await expect(canvas(page)).toHaveScreenshot('empty-state-default.png')
    })

    for (const mode of ['full', 'viewer', 'static']) {
        test(`${mode} mode shows it too`, async ({ page }) => {
            await loadFixture(page, 'empty', { UI: { mode } })
            await expect(card(page)).toHaveText('Nothing on the canvas yet')
        })
    }

    test('a graph with nodes shows none', async ({ page }) => {
        await loadFixture(page, 'basic')
        await expect(card(page)).toHaveCount(0)
    })

    test('a note alone is enough to hide it', async ({ page }) => {
        await loadFixture(page, 'empty')
        await expect(card(page)).toBeVisible()
        await harness(page, 'addNote', { id: 'n1', content: 'A note', x: 0, y: 0 })
        await expect(card(page)).toHaveCount(0)
    })

    test('nodes all filtered out do not bring it up', async ({ page }) => {
        await loadFixture(page, 'filterable')
        await page.evaluate(() => {
            const graph = (window.__pivotick as unknown as {
                graph: { getMutableNodes(): Array<{ id: string }>, queryEngine: { excludeNode(id: string): void } }
            }).graph
            for (const node of graph.getMutableNodes()) graph.queryEngine.excludeNode(node.id)
        })
        await expect(card(page)).toHaveCount(0)
    })

    test('emptyState: false shows nothing', async ({ page }) => {
        await loadFixture(page, 'empty', { UI: { emptyState: false } })
        await expect(card(page)).toHaveCount(0)
    })

    test('it follows the data, and says when the analyst emptied the canvas', async ({ page }) => {
        await page.evaluate(() => window.__pivotick.loadEmptyState('empty'))
        await expect(card(page)).toContainText('Nothing here is related.')

        await harness(page, 'addRecordedNode', 'a')
        await expect(card(page)).toHaveCount(0)

        await history(page, 'undo')
        await expect(card(page)).toContainText('You emptied the canvas.')

        await history(page, 'redo')
        await expect(card(page)).toHaveCount(0)

        // One render per appearance, not per change.
        expect(await harness(page, 'emptyStateRenders')).toEqual([true, false])
    })

    test('a custom card renders its own content', async ({ page }) => {
        await page.evaluate(() => window.__pivotick.loadEmptyState('empty'))
        await expect(card(page).getByRole('button', { name: 'Find related' })).toBeVisible()
        await expect(canvas(page)).toHaveScreenshot('empty-state-custom.png')
    })

    test('its button takes clicks, the rest lets the canvas zoom through', async ({ page }) => {
        await page.evaluate(() => window.__pivotick.loadEmptyState('empty'))

        await card(page).getByRole('button', { name: 'Find related' }).click()
        expect(await harness(page, 'emptyStateClicks')).toBe(1)

        const box = await card(page).getByText('Nothing here is related.').boundingBox()
        if (!box) throw new Error('the card text has no box')
        const x = box.x + box.width / 2
        const y = box.y + box.height / 2
        expect(await page.evaluate(([px, py]) => document.elementFromPoint(px, py)?.tagName, [x, y])).toBe('svg')

        const before = await viewTransform(page)
        await page.mouse.move(x, y)
        await page.mouse.wheel(0, -400)
        await expect.poll(() => viewTransform(page)).not.toBe(before)
    })
})
