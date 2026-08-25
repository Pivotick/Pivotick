import type { Page } from '@playwright/test'
import { test, expect, gotoHarness, harness } from '../helpers'

// ── Sidebar overflow ─────────────────────────────────────────────────────────
// A selection with enough panels is taller than the viewport. The sidebar must
// stay inside the viewport and scroll its own content; it must never stretch the
// layout grid past the window (which clipped the bottom panels off-screen with
// no way to reach them).

const FULL = { UI: { mode: 'full', sidebar: { collapsed: false } } }

/** Six always-visible panels — plus properties + neighbours, comfortably over 800px. */
const MANY_PANELS = Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, alwaysVisible: true }))

/** Height of the sidebar's scroll container vs. the content it holds. */
function sidebarScrollMetrics(page: Page): Promise<{ viewport: number; content: number }> {
    return page.locator('.pvt-sidebar-elements').evaluate((el) => ({
        viewport: el.clientHeight,
        content: el.scrollHeight,
    }))
}

test.describe('sidebar scrolling', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    test('overflowing content scrolls inside the sidebar instead of stretching the layout', async ({ page }) => {
        await harness(page, 'loadWithPanels', 'neighbors', MANY_PANELS, FULL)
        await harness(page, 'selectNode', 'hub')

        const lastPanel = page.locator('.pvt-extra-panel > [data-panel-id]').last()
        await expect(lastPanel).toHaveClass(/enter-active/)

        // The content overflows, and the sidebar absorbs it: its box stops at the
        // window edge, so the graph canvas keeps the full height beside it.
        const { viewport, content } = await sidebarScrollMetrics(page)
        const windowHeight = page.viewportSize()!.height
        expect(content).toBeGreaterThan(windowHeight)
        expect(viewport).toBe(windowHeight)

        // The overflow is reachable: a wheel over the sidebar brings the last
        // panel — off-screen at rest — fully into view.
        expect((await lastPanel.boundingBox())!.y).toBeGreaterThan(windowHeight)
        await page.mouse.move(170, windowHeight / 2)
        await page.mouse.wheel(0, content - viewport)
        await expect(lastPanel).toBeInViewport({ ratio: 1 })
    })
})
