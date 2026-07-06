import { test, expect, gotoHarness, loadFixture } from '../helpers'
import type { Page } from '@playwright/test'

/**
 * Behavioural (non-screenshot) test for the child↔child cross-cluster edge
 * (library-fixes PRD #6).
 *
 * The `linkedClusters` fixture has `group-a {a1,a2,a3}`, `group-b {b1,b2,b3}` and a
 * real edge `a3 → b1` whose endpoints are children of *different* clusters. Before
 * the fix, collapsing either group dropped that dependency: no edge was drawn and
 * the sim had no link between the clusters (so they drifted apart). The fix stands
 * the dependency in with a synthetic edge between the two nodes actually shown for
 * each collapse state — `group-a → group-b` when both are boxes, `a3 → group-b`
 * when A is open, `group-a → b1` when B is open — and the real `a3 → b1` only when
 * both are expanded.
 *
 * Screenshots are intentionally avoided: we read the rendered DOM edge + the live
 * sim link, which are environment-independent (unlike pixel baselines).
 */

/** What's carrying the a3→b1 dependency this frame. */
interface DependencyState {
    /** ids of every *visible* edge that stands in for (or is) the a3→b1 dependency, with `[dom]` if rendered. */
    shownAs: string[]
    /** the d3 link force holds a group-a↔group-b link this frame. */
    simLinked: boolean
}

/** Set both clusters' expansion, let the sim + cluster render settle, and report the dependency edge. */
async function dependencyState(page: Page, aExpanded: boolean, bExpanded: boolean): Promise<DependencyState> {
    return page.evaluate(async ([aExp, bExp]) => {
        const g = window.__pivotick.graph!
        const a = g.getMutableNode('group-a')!
        const b = g.getMutableNode('group-b')!
        if (!!a.expanded !== aExp) g.toggleExpandNode(a)
        if (!!b.expanded !== bExp) g.toggleExpandNode(b)
        await g.simulation.waitForSimulationStop()
        await new Promise((r) => setTimeout(r, 350)) // cluster bubble/badges finish a few rAFs later

        // Every id that can represent the a3→b1 dependency: the real edge + its stand-ins.
        const depIds = new Set(['a3-b1', 'synthetic-group-a-group-b', 'synthetic-a3-group-b', 'synthetic-group-a-b1'])
        const shownAs = g.getMutableEdges()
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .filter((e: any) => depIds.has(e.id) && e.visible)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((e: any) => `${e.id}${document.getElementById(`edge-${e.domID}`) ? '[dom]' : '[nodom]'}`)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const d3sim = g.simulation.getSimulation() as any
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const simLinked = (d3sim.force('link').links() as any[]).some(
            (l) => (l.source.id === 'group-a' && l.target.id === 'group-b') ||
                (l.source.id === 'group-b' && l.target.id === 'group-a')
        )
        return { shownAs, simLinked }
    }, [aExpanded, bExpanded])
}

test.describe('cross-cluster edge (child ↔ child)', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    test('the a3→b1 dependency follows the collapse state through every combination', async ({ page }) => {
        await loadFixture(page, 'linkedClusters', {
            simulation: { enabled: true, useWorker: false },
            render: { enableNodeExpansion: true },
        })

        // Both collapsed: folds into a rendered group-a → group-b box arrow, force-linked.
        const bothCollapsed = await dependencyState(page, false, false)
        console.log('[cross-cluster] both collapsed:', JSON.stringify(bothCollapsed))
        expect(bothCollapsed.shownAs).toEqual(['synthetic-group-a-group-b[dom]'])
        expect(bothCollapsed.simLinked).toBe(true)

        // A open, B collapsed: re-targets to the visible child a3 → group-b box.
        const aOpen = await dependencyState(page, true, false)
        console.log('[cross-cluster] A open, B collapsed:', JSON.stringify(aOpen))
        expect(aOpen.shownAs).toEqual(['synthetic-a3-group-b[dom]'])
        expect(aOpen.simLinked).toBe(true)

        // A collapsed, B open: the mirror — group-a box → the visible child b1.
        const bOpen = await dependencyState(page, false, true)
        console.log('[cross-cluster] A collapsed, B open:', JSON.stringify(bOpen))
        expect(bOpen.shownAs).toEqual(['synthetic-group-a-b1[dom]'])
        expect(bOpen.simLinked).toBe(true)

        // Both open: the real a3 → b1 edge is drawn; no stand-in remains.
        const bothOpen = await dependencyState(page, true, true)
        console.log('[cross-cluster] both open:', JSON.stringify(bothOpen))
        expect(bothOpen.shownAs).toEqual(['a3-b1[dom]'])

        // Round-trip back to both-collapsed restores exactly the box arrow.
        const recollapsed = await dependencyState(page, false, false)
        console.log('[cross-cluster] both collapsed again:', JSON.stringify(recollapsed))
        expect(recollapsed.shownAs).toEqual(['synthetic-group-a-group-b[dom]'])
        expect(recollapsed.simLinked).toBe(true)
    })
})
