import { test, expect, gotoHarness, loadFixture, harness } from '../helpers'
import type { Page } from '@playwright/test'

// ── Regression: multi-select → deselect on the Neighbours ego-graph tab ───────
// Reproduces the "Could not resolve relative length" crash. Root cause:
// `clearNodeSelectionList` emitted `unselectNodes` *before* clearing its state,
// so the sidebar re-read a still-populated selection and rebuilt the ego-graph
// in the middle of an unselect — its zoom then ran against a torn-down SVG. A
// side effect was one leaked `.pivotick-shadowlink-container` per rebuild.
//
// Asserted deterministically:
//  1. every `unselectNodes` fires with an already-empty selection (the invariant
//     the fix restores — a stale non-empty selection is what triggered the rebuild)
//  2. the shared shadowlink singleton never accumulates across cycles
//  3. nothing throws

const FULL = { UI: { mode: 'full', sidebar: { collapsed: false } } }
const MULTI = ['hub', 'pg', 'web']

const shadowlinkCount = (page: Page): Promise<number> =>
    page.locator('body > .pivotick-shadowlink-container').count()

// The selection size observed live *inside* each unselectNodes handler.
const installUnselectProbe = (page: Page): Promise<void> =>
    page.evaluate(() => {
        const w = window as unknown as {
            __pivotick: { graph: { renderer: { getGraphInteraction(): {
                on(e: string, cb: () => void): void
                getSelectedNodeIDs(): string[] | undefined
            } } } }
            __unselectLiveSizes: number[]
        }
        w.__unselectLiveSizes = []
        const gi = w.__pivotick.graph.renderer.getGraphInteraction()
        gi.on('unselectNodes', () => {
            w.__unselectLiveSizes.push(gi.getSelectedNodeIDs()?.length ?? 0)
        })
    })

const unselectLiveSizes = (page: Page): Promise<number[]> =>
    page.evaluate(() => (window as unknown as { __unselectLiveSizes: number[] }).__unselectLiveSizes)

test.describe('neighbours multi-select unselect', () => {
    test('deselecting a multi-selection neither crashes nor leaks the ego-graph', async ({ page }) => {
        const pageErrors: string[] = []
        page.on('pageerror', (err) => pageErrors.push(err.message))

        await gotoHarness(page)
        await loadFixture(page, 'neighbors', FULL)
        await installUnselectProbe(page)

        // Baseline: one shared shadowlink singleton exists once the graph mounts.
        const baselineShadowlinks = await shadowlinkCount(page)

        for (let cycle = 0; cycle < 3; cycle++) {
            // Multi-select builds the ego-graph in the (default) Neighbor Graph tab.
            await harness(page, 'multiSelect', MULTI)
            await expect
                .poll(() => page.locator('.main-egograph-container svg').count(),
                    { message: 'ego-graph should build on multi-select' })
                .toBeGreaterThan(0)
            // Let the ego-graph's fit/sim animation frames run — this is when the
            // detached-SVG zoom used to fire.
            await page.waitForTimeout(120)

            // Click-on-canvas unselect (deselectAll → the same unselectAll path).
            await harness(page, 'deselectAll')
            await page.waitForTimeout(120)

            expect(await harness(page, 'selectedNodeIds')).toEqual([])
        }

        // The core invariant: no unselectNodes ever saw a still-populated selection.
        // (Buggy order emitted with the 3 nodes still present, rebuilding the ego-graph.)
        const liveSizes = await unselectLiveSizes(page)
        expect(liveSizes.length).toBeGreaterThan(0)
        expect(Math.max(...liveSizes)).toBe(0)

        // No leaked shadowlink containers accumulated over the cycles.
        expect(await shadowlinkCount(page)).toBe(baselineShadowlinks)
        // And nothing threw (catches the "Could not resolve relative length" crash).
        expect(pageErrors).toEqual([])
    })
})
