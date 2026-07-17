import { test, expect, gotoHarness, loadFixture, harness } from '../helpers'
import type { Locator, Page } from '@playwright/test'

// ── Sidebar main header: long node titles ─────────────────────────────────────
// The title auto-fits first — shrinking the font (16 → 12px) so the whole value
// shows across up to two lines, and re-fitting when the sidebar width changes.
// When it still won't fit at the floor size it falls back type-awarely: prose
// gets a two-line clamp; an identifier gets a monospace, middle-elided form
// (`abc…xyz`) plus a copy button.

const FULL = { UI: { mode: 'full', sidebar: { collapsed: false } } }
const FULL_ONION = 'torsiqlecptj74i5rksxunffxb3it5pitd5lbyemvadmzrxeih7vjuad.onion'
const FULL_HUGE_ID = 'a3f9c1e8b7d64f20'.repeat(8)

const name = (page: Page): Locator => page.locator('.pvt-mainheader-nodeinfo-name')

async function fontSizePx(loc: Locator): Promise<number> {
    return loc.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
}
async function select(page: Page, id: string): Promise<void> {
    await harness(page, 'selectNode', id)
    await page.waitForTimeout(150) // the fit runs in a rAF after layout
}
/** Override the sidebar width; the header observes it and re-fits the title. */
async function setSidebarWidth(page: Page, px: number): Promise<void> {
    await page.evaluate((w) => {
        (document.querySelector('.pvt-layout') as HTMLElement)
            .style.setProperty('--pvt-sidebar-width', w + 'px')
    }, px)
    await page.waitForTimeout(200)
}

test.describe('main header long titles', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
        await loadFixture(page, 'longTitles', FULL)
    })

    test('a short title stays at full size on one line', async ({ page }) => {
        await select(page, 'short')
        await expect(name(page)).toHaveText('Web Frontend')
        expect(await fontSizePx(name(page))).toBe(16)
        await expect(name(page)).not.toHaveClass(/is-clamp|is-identifier/)
    })

    test('a mid title shows in full, wrapped (no elision)', async ({ page }) => {
        await select(page, 'mid')
        await expect(name(page)).toHaveText('Administration Console Dashboard — Service Instance 04')
        await expect(name(page)).not.toHaveClass(/is-clamp|is-identifier/)
    })

    test('narrowing the sidebar shrinks the font to keep the whole title', async ({ page }) => {
        await select(page, 'mid')
        expect(await fontSizePx(name(page))).toBe(16) // fits at 340px

        await setSidebarWidth(page, 300) // no longer fits at 16 → auto-fit shrinks
        expect(await fontSizePx(name(page))).toBeLessThan(16)
        // Still the whole title — auto-fit shrinks rather than eliding.
        await expect(name(page)).toHaveText('Administration Console Dashboard — Service Instance 04')
        await expect(name(page)).not.toHaveClass(/is-clamp|is-identifier/)
    })

    test('a long identifier shows in full when it fits shrunk', async ({ page }) => {
        await select(page, 'onion')
        // Auto-fit keeps the entire value (no ellipsis) — the win over the old
        // break-all clamp, which dropped the tail.
        await expect(name(page)).toHaveText(FULL_ONION)
        await expect(name(page)).not.toHaveClass(/is-identifier/)
    })

    test('an oversized identifier → monospace middle-ellipsis + copy', async ({ page }) => {
        await select(page, 'hugeId')
        const n = name(page)
        await expect(n).toHaveClass(/is-identifier/)

        const shown = (await n.textContent()) ?? ''
        expect(shown).toContain('…')                    // middle elided
        expect(shown.startsWith('a3f9c1e8')).toBe(true) // head kept
        expect(shown.endsWith('7d64f20')).toBe(true)    // tail kept
        // Full value preserved for hover + the copy button.
        await expect(n).toHaveAttribute('title', FULL_HUGE_ID)
        await expect(page.locator('.pvt-mainheader-nodeinfo-action .pvt-prop-copy')).toBeVisible()

        const family = await n.evaluate((el) => getComputedStyle(el).fontFamily)
        expect(family.toLowerCase()).toContain('mono')
    })

    test('the copy button puts the full identifier on the clipboard', async ({ page, context }) => {
        await context.grantPermissions(['clipboard-read', 'clipboard-write'])
        await select(page, 'hugeId')
        await page.locator('.pvt-mainheader-nodeinfo-action .pvt-prop-copy').click()
        const clip = await page.evaluate(() => navigator.clipboard.readText())
        expect(clip).toBe(FULL_HUGE_ID)
    })

    test('an oversized prose title → clean two-line clamp', async ({ page }) => {
        await select(page, 'prose')
        const n = name(page)
        await expect(n).toHaveClass(/is-clamp/)
        await expect(n).toHaveAttribute('title', /^This is an unusually long/)
        const lineClamp = await n.evaluate((el) => getComputedStyle(el).webkitLineClamp)
        expect(lineClamp).toBe('2')
    })
})
