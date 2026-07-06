import { test, expect, gotoHarness, loadFixture } from '../helpers'
import type { Page } from '@playwright/test'

/**
 * Behavioural (non-screenshot) test for library-fixes #7: `fitAndCenter()` right
 * after load/expand races the cluster render.
 *
 * Repro (clusters & hierarchy): expand a cluster and its bubble + nested subgraph
 * lay out over several animation frames + d3 transitions *after* the main sim
 * stops. A `fitAndCenter()` called immediately measures a transient (much
 * smaller) bbox and locks in a zoomed-in / off-centre transform that is never
 * corrected — the graph looks wrong until the user clicks the fit button.
 *
 * The fix adds `fitAndCenterWhenSettled()`, which polls the zoom-layer bbox until
 * it holds steady before fitting, and routes the load/expand fits through it.
 *
 * We drive the real main-thread sim (worker off) with real rAF/wall-clock timing
 * — the transient only exists while the subgraph is still settling — and read the
 * applied zoom transform (its scale `k`) at three moments: fit-immediately (bug),
 * fit-when-settled (fix), and a reference fit taken once everything has settled.
 */

interface FitResult {
    /** Scale `k` from an immediate fit right after expand — the transient (buggy) value. */
    immediateK: number
    /** Zoom-layer bbox at that transient moment (small: subgraphs not laid out yet). */
    transientBox: { w: number; h: number }
    /** Scale `k` from `fitAndCenterWhenSettled()` called at the same early moment. */
    settledK: number
    /** Scale `k` from a plain fit taken once everything has fully settled (ground truth). */
    referenceK: number
    /** Zoom-layer bbox once settled (larger: children laid out inside the clusters). */
    settledBox: { w: number; h: number }
    bothExpanded: boolean
}

/**
 * Expand both clusters, then capture the zoom scale from three fits: an immediate
 * `fitAndCenter()` (the race), a `fitAndCenterWhenSettled()` (the fix), and a
 * plain fit taken after a long settle (the reference). Uses real frame/wall-clock
 * timing so the transient layout state the bug hits actually occurs.
 */
async function expandThenCaptureFits(page: Page): Promise<FitResult> {
    return page.evaluate(async () => {
        const g = window.__pivotick.graph!
        const raf = () => new Promise<void>((r) => requestAnimationFrame(() => r()))
        const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
        const scaleOf = (): number => {
            const zg = g.renderer.getZoomGroup() as SVGGElement | null
            const m = zg?.transform.baseVal.consolidate()?.matrix
            return m ? m.a : 0
        }
        const boxOf = (): { w: number; h: number } => {
            const zg = g.renderer.getZoomGroup() as SVGGElement | null
            const b = zg?.getBBox()
            return { w: Math.round(b?.width ?? 0), h: Math.round(b?.height ?? 0) }
        }

        const groupA = g.getMutableNode('group-a')!
        const groupB = g.getMutableNode('group-b')!
        if (!groupA.expanded) g.toggleExpandNode(groupA)
        if (!groupB.expanded) g.toggleExpandNode(groupB)

        // One frame after expand the subgraphs have not laid out yet: fit here and
        // the transform is measured off a transient bbox — this is the bug.
        await raf()
        g.renderer.fitAndCenter()
        await raf()
        const immediateK = scaleOf()
        const transientBox = boxOf()

        // The fix: settle-aware fit issued at the same early moment. It should wait
        // for the bbox to stabilise and land on the settled framing.
        g.renderer.fitAndCenterWhenSettled()
        await sleep(1500)
        const settledK = scaleOf()

        // Ground truth: a plain fit once everything is unquestionably settled.
        g.renderer.fitAndCenter()
        await raf()
        const referenceK = scaleOf()
        const settledBox = boxOf()

        return {
            immediateK: +immediateK.toFixed(4),
            transientBox,
            settledK: +settledK.toFixed(4),
            referenceK: +referenceK.toFixed(4),
            settledBox,
            bothExpanded: groupA.expanded === true && groupB.expanded === true,
        }
    })
}

/** True when `a` is within `ratio` (fractional) of `b`. */
function withinRatio(a: number, b: number, ratio: number): boolean {
    return Math.abs(a - b) <= Math.abs(b) * ratio
}

test.describe('cluster fit settle', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    test('fitAndCenterWhenSettled frames the expanded clusters, immediate fit does not', async ({ page }) => {
        await loadFixture(page, 'linkedClusters', {
            simulation: { enabled: true, useWorker: false },
            render: { enableNodeExpansion: true },
        })

        const r = await expandThenCaptureFits(page)
        // Surface the live numbers so the outcome is inspectable, not just pass/fail.
        console.log('[cluster-fit] settle result:', JSON.stringify(r))

        // Sanity: both clusters really expanded and both fits produced a transform.
        expect(r.bothExpanded).toBe(true)
        expect(r.referenceK).toBeGreaterThan(0)

        // Root cause: the early bbox is much smaller than the settled one (children
        // not yet laid out inside the clusters) — measured ~377×165 vs ~520×571.
        expect(r.transientBox.w).toBeLessThan(r.settledBox.w)
        expect(r.transientBox.h).toBeLessThan(r.settledBox.h)

        // The fix: a settle-aware fit issued right after expand lands on the same
        // framing as the reference fit (measured k≈0.94 for both).
        expect(withinRatio(r.settledK, r.referenceK, 0.1)).toBe(true)

        // And it is far from the transient value an immediate fit would have locked
        // in (measured k≈2.86 — ~3× the correct scale, so content overflows unseen).
        expect(withinRatio(r.immediateK, r.referenceK, 0.1)).toBe(false)
        expect(Math.abs(r.immediateK - r.referenceK)).toBeGreaterThan(Math.abs(r.referenceK) * 0.5)
    })
})
