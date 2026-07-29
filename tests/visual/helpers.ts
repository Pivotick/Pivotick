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

/**
 * Screenshot an arbitrary locator against the named baseline. For body-attached
 * chrome (the tooltip / context menu) that lives outside `.pvt-canvas`, so its
 * baseline captures the element itself rather than the whole viewport.
 */
export async function expectElement(locator: Locator, name: string): Promise<void> {
    await expect(locator).toHaveScreenshot(name)
}

/** Hover a node the way a user would: prime just above its top edge, then glide down onto
 * it in small steps so the tooltip's proximity guard (last mousemove within 50px of the
 * hover-in point) passes regardless of node size, then return the shown tooltip. */
export async function openNodeTooltip(page: Page, id: string): Promise<Locator> {
    const nb = await nodeEl(page, id).boundingBox()
    if (!nb) throw new Error(`node ${id} has no bounding box`)
    const cx = nb.x + nb.width / 2
    await page.mouse.move(cx, nb.y - 10)
    await page.mouse.move(cx, nb.y + nb.height / 2, { steps: 25 })
    const tip = page.locator('.pvt-tooltip')
    await expect(tip).toHaveClass(/shown/)
    return tip
}

/** Centre point of a located element, in page coordinates. */
export async function centerOf(locator: Locator): Promise<{ x: number; y: number }> {
    const box = await locator.boundingBox()
    if (!box) throw new Error('Element has no bounding box (not visible?)')
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}
