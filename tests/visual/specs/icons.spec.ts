/**
 * Every inline icon in `src/ui/icons.ts` must be clean SVG markup. A malformed tag such as
 * `< path` paints nothing, so a screenshot cannot catch it, but the HTML parser keeps it as text
 * that leaks into the `textContent` (and accessible name) of whatever holds the icon.
 *
 * Both checks return the names of the offending icons, so a failure names the icon to fix.
 */
import { expect, gotoHarness, test } from '../helpers'

type Page = import('@playwright/test').Page

/** How many icons the module exports, so the checks below cannot pass on an empty list. */
async function iconCount(page: Page): Promise<number> {
    return page.evaluate(async () => {
        const icons: Record<string, unknown> = await import('/src/ui/icons.ts')
        return Object.values(icons).filter(svg => typeof svg === 'string').length
    })
}

/** Icons whose markup is not well-formed XML, e.g. `< path` or `stroke - linecap="round"`. */
async function iconsNotWellFormed(page: Page): Promise<string[]> {
    return page.evaluate(async () => {
        const icons: Record<string, unknown> = await import('/src/ui/icons.ts')
        const parser = new DOMParser()
        return Object.entries(icons)
            .filter(([, svg]) => typeof svg === 'string')
            .filter(([, svg]) => {
                const doc = parser.parseFromString(svg as string, 'image/svg+xml')
                return doc.getElementsByTagName('parsererror').length > 0
            })
            .map(([name]) => name)
    })
}

/** Icons that leave text behind once mounted as HTML, the way the UI inserts them. */
async function iconsWithStrayText(page: Page): Promise<string[]> {
    return page.evaluate(async () => {
        const icons: Record<string, unknown> = await import('/src/ui/icons.ts')
        const host = document.createElement('span')
        return Object.entries(icons)
            .filter(([, svg]) => typeof svg === 'string')
            .filter(([, svg]) => {
                host.innerHTML = svg as string
                return (host.textContent ?? '').trim() !== ''
            })
            .map(([name]) => name)
    })
}

test.describe('Inline icons', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    test('every icon is well-formed SVG', async ({ page }) => {
        expect(await iconCount(page)).toBeGreaterThan(50)
        expect(await iconsNotWellFormed(page)).toEqual([])
    })

    test('no icon adds text to the element holding it', async ({ page }) => {
        expect(await iconsWithStrayText(page)).toEqual([])
    })
})
