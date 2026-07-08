import { test, expect, gotoHarness, harness } from '../helpers'

/**
 * Regression: the canvas visibility `IntersectionObserver` must not assume a
 * render has happened. When a graph is constructed with no data (or `init()`
 * throws), `nodeSelection` is never assigned, yet the observer is already live;
 * firing its re-measure callback used to throw
 * `Cannot read properties of undefined (reading 'each')` — a misleading
 * secondary error that masked the real construction failure.
 * See prd/bug-intersection-observer-nodeselection-undefined.md.
 */
test.describe('canvas visibility observer', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    test('re-measure callback is a no-op when nothing has rendered', async ({ page }) => {
        const pageErrors: string[] = []
        page.on('pageerror', (err) => pageErrors.push(err.message))

        const result = (await harness(page, 'probeUnrenderedVisibility')) as {
            nodeSelectionUnset: boolean
            remeasureThrew: boolean
        }

        // Precondition: data-less construction leaves nodeSelection unassigned.
        expect(result.nodeSelectionUnset).toBe(true)
        // The fix: the observer callback safely no-ops instead of throwing.
        expect(result.remeasureThrew).toBe(false)
        expect(pageErrors).toEqual([])
    })
})
