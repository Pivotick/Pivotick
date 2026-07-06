import { test, expect, gotoHarness, loadFixture } from '../helpers'
import type { Page } from '@playwright/test'

/**
 * Behavioural (non-screenshot) test: an expanded cluster over-repels and the sim
 * never settles when its node is dragged.
 *
 * Repro (clusters & hierarchy): expand a cluster, then drag its node. Its
 * charge is scaled off the large containment-bubble radius (×the parent weight),
 * so it shoves its neighbours far away instead of cooling. The fix bases an
 * expanded cluster's charge on its *collapsed* radius, so it repels no harder
 * than it did collapsed.
 *
 * We drive the real main-thread sim (worker off — the drag/reheat path is
 * main-thread only) and read two live signals:
 *  - the charge strength the sim actually assigns to the expanded cluster, and
 *  - how far its neighbours end up after a drag-reheat.
 */

/** Result of {@link dragExpandedClusterAndSettle}. */
interface SettleResult {
    /** Charge strength the live sim assigns to the expanded `group` node. */
    groupCharge: number
    /** Farthest a main-sim neighbour (ext1/ext2) ends up from the cluster, px. */
    spread: number
    /** Ticks the sim needed to cool back below alphaMin after release. */
    ticks: number
    alpha: number
    expanded: boolean
    nodeCount: number
}

/**
 * Expand `group`, then reproduce the drag-reheat gesture on it and let the sim
 * cool. Runs entirely against the live d3 sim so the measurement is synchronous
 * and deterministic (no rAF/wall-clock timing). Mirrors `createDragBehavior`:
 * warm to alphaTarget 0.3 while the dragged node is pinned + moved, then release
 * (alphaTarget 0) and tick until settled.
 */
async function dragExpandedClusterAndSettle(page: Page): Promise<SettleResult> {
    return page.evaluate(async () => {
        const g = window.__pivotick.graph!
        const simMgr = g.simulation
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const d3sim = simMgr.getSimulation() as any

        const group = g.getMutableNode('group')!
        if (!group.expanded) g.toggleExpandNode(group)
        await simMgr.waitForSimulationStop()
        // Cluster bubble/badges finish over a few rAFs after the sim stops.
        await new Promise((r) => setTimeout(r, 400))

        const neighbours = ['ext1', 'ext2'].map((id) => g.getMutableNode(id)!)
        // Post-layout, the sim clears fx/fy; make sure neighbours are free to move.
        for (const n of neighbours) { n.fx = undefined; n.fy = undefined }

        // The strength the sim assigns to the expanded cluster right now.
        const groupCharge = d3sim.force('charge').strength()(group)

        // --- drag-reheat gesture ---
        group.fx = group.x; group.fy = group.y
        d3sim.alphaTarget(0.3).alpha(0.3)
        for (let i = 0; i < 90; i++) { group.fx += 2; group.fy += 1; d3sim.tick() }
        d3sim.alphaTarget(0); group.fx = undefined; group.fy = undefined

        let ticks = 0
        while (d3sim.alpha() > d3sim.alphaMin() && ticks < 3000) { d3sim.tick(); ticks++ }

        const cx = group.x ?? 0, cy = group.y ?? 0
        const spread = Math.max(...neighbours.map((n) => Math.hypot((n.x ?? 0) - cx, (n.y ?? 0) - cy)))

        return {
            groupCharge: Math.round(groupCharge),
            spread: Math.round(spread),
            ticks,
            alpha: d3sim.alpha(),
            expanded: group.expanded === true,
            nodeCount: d3sim.nodes().length,
        }
    })
}

test.describe('cluster drag settle', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    test('expanded cluster does not over-repel its neighbours when dragged', async ({ page }) => {
        await loadFixture(page, 'clustered', {
            simulation: { enabled: true, useWorker: false },
            render: { enableNodeExpansion: true },
        })

        const r = await dragExpandedClusterAndSettle(page)
        // Surface the live numbers so the outcome is inspectable, not just pass/fail.
        console.log('[cluster-drag] settle result:', JSON.stringify(r))

        // Sanity: we actually expanded and the sim held the graph's nodes.
        expect(r.expanded).toBe(true)
        expect(r.nodeCount).toBeGreaterThan(0)

        // Primary signal: the fix bases the charge on the collapsed radius (~10)
        // ×10 parent weight ≈ 1500; the bug scaled off the ~140px bubble radius
        // ≈ 6800. 2500 sits cleanly between the two.
        expect(Math.abs(r.groupCharge)).toBeLessThan(2500)

        // Secondary sanity bound: with the weaker charge, neighbours settle nearer
        // (measured ~673px fixed vs ~988px buggy) — guard against a blow-up.
        expect(r.spread).toBeLessThan(1500)
    })

    // A node linked to a child of an expanded cluster must stay anchored while the
    // drag is *held* (alphaTarget kept warm). Before the fix, expanding dropped the
    // synthetic external→cluster anchor (the child endpoint left the sim), so the
    // other cluster's charge pushed the node off indefinitely.
    test('held drag keeps a linked node anchored', async ({ page }) => {
        await loadFixture(page, 'linkedClusters', {
            simulation: { enabled: true, useWorker: false },
            render: { enableNodeExpansion: true },
        })

        const r = await page.evaluate(async () => {
            const g = window.__pivotick.graph!
            const simMgr = g.simulation
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const d3sim = simMgr.getSimulation() as any
            const groupA = g.getMutableNode('group-a')!
            if (!groupA.expanded) g.toggleExpandNode(groupA)  // mirrors gallery onLoaded
            await simMgr.waitForSimulationStop()
            await new Promise((res) => setTimeout(res, 400))

            // core links to a child of each group; it must remain anchored to group-a.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const links = (d3sim.force('link').links() as any[]).map((l) => `${l.source.id}->${l.target.id}`)
            const core = g.getMutableNode('core')!
            for (const n of d3sim.nodes()) { if (n.id !== 'group-a') { n.fx = undefined; n.fy = undefined } }
            const sx = core.x ?? 0, sy = core.y ?? 0

            // Hold the drag: pin group-a, keep the sim warm, and tick (never release).
            groupA.freeze()
            d3sim.alphaTarget(0.3).alpha(0.3)
            let maxDrift = 0
            for (let step = 0; step < 10; step++) {
                for (let i = 0; i < 60; i++) d3sim.tick()
                maxDrift = Math.max(maxDrift, Math.hypot((core.x ?? 0) - sx, (core.y ?? 0) - sy))
            }
            return { links, maxDrift: Math.round(maxDrift) }
        })
        console.log('[cluster-drag] held-drag anchoring:', JSON.stringify(r))

        // core is anchored to the expanded cluster, not its now-out-of-sim child.
        expect(r.links).toContain('core->group-a')
        expect(r.links).not.toContain('core->a1')
        // Bounded wobble that settles (~415px), not the unbounded runaway (>3000px)
        // the missing anchor produced.
        expect(r.maxDrift).toBeLessThan(800)
    })
})
