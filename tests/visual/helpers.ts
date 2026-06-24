/**
 * Shared helpers for visual tests: navigating to the harness, loading fixtures,
 * locating graph elements, and taking stable screenshots.
 */
import { test, expect, type Page, type Locator } from '@playwright/test'
import type { HarnessApi } from './harness/harness'
import type { FixtureName, RawNote } from './harness/fixtures'

export { test, expect }

const HARNESS_URL = '/tests/visual/harness/index.html'

/** The graph viewport: grid background + SVG + on-canvas overlays (excludes sidebar). */
export function canvas(page: Page): Locator {
    return page.locator('.pvt-canvas').first()
}

export function nodeEl(page: Page, id: string): Locator {
    return page.locator(`#node-${id}`)
}

export function noteEl(page: Page, id: string): Locator {
    return page.locator(`#note-${id}`)
}

/** Open the harness page and wait until the control API is installed. */
export async function gotoHarness(page: Page): Promise<void> {
    await page.goto(HARNESS_URL)
    await page.waitForFunction(() => Boolean(window.__pivotick))
}

/** Load a fixture and wait until the graph has fully rendered. */
export async function loadFixture(
    page: Page,
    name: FixtureName,
    overrides: Record<string, unknown> = {}
): Promise<void> {
    await page.evaluate(
        ([n, o]) => window.__pivotick.load(n as FixtureName, o as Record<string, unknown>),
        [name, overrides] as const
    )
    // Belt-and-suspenders: the zoom layer is only un-hidden once layout is "done".
    await page.locator('.zoom-layer:not(.hidden)').first().waitFor({ state: 'attached' })
}

/**
 * Run a method of the harness API in the page and return its (serialisable) result.
 *
 * @example await harness(page, 'connect', 'a', 'b')
 */
export async function harness<K extends keyof HarnessApi>(
    page: Page,
    method: K,
    ...args: Parameters<Extract<HarnessApi[K], (...a: never[]) => unknown>>
): Promise<unknown> {
    return page.evaluate(
        ([m, a]) => {
            const api = window.__pivotick as unknown as Record<string, (...x: unknown[]) => unknown>
            return api[m as string](...(a as unknown[]))
        },
        [method, args] as const
    )
}

/** Convenience wrapper around the typed note payload. */
export async function addNote(page: Page, note: RawNote): Promise<string> {
    return harness(page, 'addNote', note) as Promise<string>
}

/** Screenshot the graph viewport against the named baseline. */
export async function expectCanvas(page: Page, name: string): Promise<void> {
    await expect(canvas(page)).toHaveScreenshot(name)
}

/** Centre point of a located element, in page coordinates. */
export async function centerOf(locator: Locator): Promise<{ x: number; y: number }> {
    const box = await locator.boundingBox()
    if (!box) throw new Error('Element has no bounding box (not visible?)')
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}
