import { test, expect, gotoHarness } from '../helpers'
import type { AutoState } from '../harness/harness'
import type { AutoFixtureSpec } from '../harness/fixtures'

// ── The `Auto` physics preset ────────────────────────────────────────────────
// Every other spec in this suite pins `physics: 'manual'` and fixed node
// positions, because a moving layout makes a screenshot meaningless. This one is
// the exception: it lets the simulation place the nodes and then *measures* where
// they ended up, so the assertions are numbers (fill, overlaps, reheats) rather
// than pixels. The fixtures are the cases auto has to survive:
//
//   A  4 small nodes         — fills the canvas without becoming specks
//   B  5 large nodes         — no touching; the edge between two discs is visible
//   C  40 large nodes        — 0 overlaps, where a naive area budget provably fails
//   D  2 components + 2 isolated — everything stays in frame
//   E  growth 5 → 60 → 61    — calm: one reheat for the growth, none for the +1
//   F  2000 nodes            — auto tightens and the slow-tick watchdog holds off

type Page = import('@playwright/test').Page

const loadAuto = (page: Page, spec: AutoFixtureSpec, overrides: Record<string, unknown> = {}) =>
    page.evaluate(
        ([s, o]) => window.__pivotick.loadAuto(s as AutoFixtureSpec, o as Record<string, unknown>),
        [spec, overrides] as const
    )

const autoState = (page: Page): Promise<AutoState> =>
    page.evaluate(() => window.__pivotick.autoState())

const grow = (page: Page, count: number, radius: number) =>
    page.evaluate(([c, r]) => window.__pivotick.growAuto(c, r), [count, radius] as const)

const reheats = (page: Page) => page.evaluate(() => window.__pivotick.reheatCount())
const resetReheats = (page: Page) => page.evaluate(() => window.__pivotick.resetReheatCount())

/**
 * Drive a slider the way the flyout does — through the public setter, which is
 * also the path that takes auto out of the loop.
 */
const setKnob = (page: Page, knob: 'repulsion' | 'linkDistance', value: number) =>
    page.evaluate(([k, v]) => {
        const setter = k === 'repulsion' ? 'setRepulsion' : 'setLinkDistance'
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(window.__pivotick as any).graph.simulation[setter](v)
    }, [knob, value] as const)

/**
 * Wait until the tuner has *seen* a graph of `nodeCount` nodes.
 *
 * Auto is debounced, so "did it re-tune?" and "has it looked yet?" are different
 * questions, and a fixed sleep conflates them — a loaded machine then fails a test
 * about knobs for reasons that have nothing to do with knobs. Polling the node
 * count the last tune ran against separates the two: this resolves when auto has
 * had its look, and the assertions that follow are purely about what it decided.
 */
async function whenTuned(page: Page, nodeCount: number, timeoutMs = 8_000): Promise<AutoState> {
    const deadline = Date.now() + timeoutMs
    for (;;) {
        const state = await autoState(page)
        if (state.tunedNodeCount === nodeCount || Date.now() > deadline) return state
        await page.waitForTimeout(100)
    }
}

/**
 * Wait until the layout stops moving.
 *
 * Playwright's stability heuristics do not cover a force simulation: it keeps
 * ticking at a low alpha well past the point where the DOM looks settled, and
 * auto's own debounce can start another relaxation 150ms after the last change.
 * Poll the measured bounding box instead and accept it once two consecutive
 * samples agree.
 */
async function whenLayoutStable(page: Page, timeoutMs = 20_000): Promise<AutoState> {
    const deadline = Date.now() + timeoutMs
    let previous = ''
    let state = await autoState(page)
    for (;;) {
        const signature = [
            Math.round(state.measured.bbox.width),
            Math.round(state.measured.bbox.height),
            state.zoom.toFixed(3),
        ].join('/')
        if (signature === previous || Date.now() > deadline) return state
        previous = signature
        await page.waitForTimeout(300)
        state = await autoState(page)
    }
}

test.describe('auto-physics', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    // Fixture A. The complaint auto answers, in its purest form: four small nodes
    // used to sit in a knot in the middle of a 1280px canvas.
    //
    // Stated as a comparison rather than an absolute, deliberately. `cooldownTime` is
    // a wall-clock budget, so a busy machine simply ticks fewer times and settles a
    // smaller box — absolute coverage for four nodes ranges over 0.47–0.67 run to run
    // on an idle machine and lower under load. Running both arms back to back holds
    // that variable still, and says the thing worth saying: same graph, same machine,
    // only the knobs differ.
    test('A — four small nodes use the canvas instead of knotting in the middle', async ({ page }) => {
        await loadAuto(page, { nodes: 4, radius: 12 }, { simulation: { physics: 'manual' } })
        const pinned = await whenLayoutStable(page)

        await loadAuto(page, { nodes: 4, radius: 12 })
        const auto = await whenLayoutStable(page)

        expect(auto.auto).toBe(true)
        // The layout itself is 3-5x wider (measured fill 0.36-0.62 against 0.125)…
        expect(auto.measured.fill).toBeGreaterThan(pinned.measured.fill * 1.5)
        // …which lands as a quarter to twice again more of the screen covered
        // (measured 0.50-0.72 against 0.36).
        expect(auto.coverage).toBeGreaterThan(pinned.coverage * 1.2)
        // The nodes are smaller than in the pinned arm, and that is the trade being
        // made, not a regression: pinned wins its 34px radius by being so cramped
        // that the camera hits its 3x cap on a quarter of the screen. Auto spends
        // some of that magnification on using the canvas, and the floor here is what
        // stops it spending all of it — measured 13-20px against this 10px bound.
        expect(auto.zoom * 12).toBeGreaterThan(10)
        expect(auto.knobs.linkDistance).toBeGreaterThan(pinned.knobs.linkDistance)
    })

    // Fixture B. Absolute link distance is the reason large nodes read as touching:
    // no knob setting could put clear space between two 120px discs before the
    // ceiling moved from 260px to 600px.
    test('B — five large nodes settle with visible space between them', async ({ page }) => {
        await loadAuto(page, { nodes: 5, radius: 60 })
        const state = await whenLayoutStable(page)

        expect(state.measured.overlaps).toBe(0)
        // A gap, not just an absence of overlap: at least a third of a radius of daylight.
        expect(state.measured.nearestNeighbourGap).toBeGreaterThan(0.33)
        expect(state.knobs.linkDistance).toBeGreaterThan(2 * 60)
    })

    // Fixture C. The case a pure area budget fails: 40 nodes of radius 60 get a
    // per-node budget smaller than their own diameter, so only the clamps save it.
    test('C — forty large nodes settle with zero overlaps', async ({ page }) => {
        await loadAuto(page, { nodes: 40, radius: 60 })
        const state = await whenLayoutStable(page)

        expect(state.nodeCount).toBe(40)
        expect(state.measured.overlaps).toBe(0)
    })

    // Fixture D. Separate components have nothing but repulsion between them —
    // this is the `centering` knob's entire reason to exist.
    test('D — separate components and isolated nodes stay in frame', async ({ page }) => {
        await loadAuto(page, { nodes: 7, radius: 16, components: 2, isolated: 2 })
        const state = await whenLayoutStable(page)

        expect(state.nodeCount).toBe(7)
        expect(state.measured.bbox.width).toBeLessThanOrEqual(state.canvas.width)
        expect(state.measured.bbox.height).toBeLessThanOrEqual(state.canvas.height)
        expect(state.knobs.centering).toBeGreaterThan(0)
    })

    // Fixture E. The calm policy: every knob setter re-inits a force and reheats, so
    // without a deadband a pivot would reheat once per node arriving.
    test('E — growth reheats once; a single extra node reheats not at all', async ({ page }) => {
        await loadAuto(page, { nodes: 5, radius: 18 })
        await whenLayoutStable(page)
        const small = await autoState(page)

        // 5 → 60 is a real change of scale: auto should re-tune, exactly once.
        await resetReheats(page)
        await grow(page, 55, 18)
        const grown = await whenLayoutStable(page)
        expect(grown.nodeCount).toBe(60)
        expect(await reheats(page)).toBe(1)
        // …and it tightened, because 60 nodes share the same canvas as 5 did.
        expect(grown.knobs.linkDistance).toBeLessThan(small.knobs.linkDistance)

        // 60 → 61 moves nothing by more than the deadband, so nothing is applied.
        await resetReheats(page)
        await grow(page, 1, 18)
        const nudged = await whenTuned(page, 61)
        expect(nudged.tunedNodeCount).toBe(61) // auto did look…
        expect(nudged.skipped).toBe(true)      // …and decided nothing was worth applying
        expect(await reheats(page)).toBe(0)
        expect(nudged.knobs).toEqual(grown.knobs)
    })

    // Fixture F. At this size the answer is to tighten, not to spread.
    //
    // Note what is deliberately *not* asserted: that the slow-tick watchdog holds
    // off. It does not — but it fires at exactly the same sizes with the knobs
    // pinned (measured: physics off by 1000 nodes either way), so it is a limit of
    // rendering this many SVG nodes on the main thread, not something auto caused
    // or can fix. `auto never wakes a paused simulation` below covers the part that
    // *is* auto's responsibility.
    test('F — two thousand nodes tighten, far below what pinned knobs produce', async ({ page }) => {
        test.slow() // a 2000-node layout on the main thread is not a fast test

        await loadAuto(page, { nodes: 60, radius: 10 })
        const sixty = await whenLayoutStable(page)

        await loadAuto(page, { nodes: 2000, radius: 10 })
        const huge = await whenLayoutStable(page)
        expect(huge.nodeCount).toBe(2000)
        expect(huge.knobs.linkDistance).toBeLessThan(sixty.knobs.linkDistance)

        // The same 2000 nodes with the knobs left where the defaults put them sprawl
        // wider still. The margin is stated loosely on purpose: this fixture is a
        // random recursive tree, which is about the least compressible thing a force
        // layout can be handed — at 300 nodes it measures 1.9 canvases wide even with
        // repulsion at its minimum, so most of its size is topology, not tuning. Auto
        // is reliably tighter here (measured 7.5 vs 12.9 canvases); it is not, and
        // should not be, tight enough to fold a 2000-node tree into one screen.
        await loadAuto(page, { nodes: 2000, radius: 10 }, { simulation: { physics: 'manual' } })
        const pinned = await whenLayoutStable(page)
        expect(pinned.auto).toBe(false)
        expect(huge.measured.fill).toBeLessThan(pinned.measured.fill * 0.8)
        expect(huge.measured.overlaps).toBe(0)
    })

    // §8.4: auto computes and stores knobs whatever the simulation is doing, but it
    // never restarts one the user (or the watchdog) switched off.
    test('auto never wakes a paused simulation', async ({ page }) => {
        await loadAuto(page, { nodes: 6, radius: 18 })
        await whenLayoutStable(page)
        const before = await autoState(page)

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await page.evaluate(() => (window.__pivotick as any).graph.simulation.disable())
        await resetReheats(page)
        await grow(page, 60, 18)
        const after = await whenTuned(page, 66)

        expect(after.enabled).toBe(false) // still paused
        expect(await reheats(page)).toBe(0) // and never nudged
        expect(after.auto).toBe(true) // auto is still in charge…
        expect(after.knobs.linkDistance).not.toBe(before.knobs.linkDistance) // …and did re-tune
    })

    // Auto is all-or-nothing on purpose: the moment a person expresses a preference,
    // auto stops, so it can never overwrite that preference a moment later.
    test('turning a knob by hand stops auto for good', async ({ page }) => {
        await loadAuto(page, { nodes: 6, radius: 18 })
        await whenLayoutStable(page)
        expect((await autoState(page)).auto).toBe(true)

        await setKnob(page, 'repulsion', 85)
        const afterEdit = await autoState(page)
        expect(afterEdit.auto).toBe(false)
        expect(afterEdit.knobs.repulsion).toBe(85)

        // A change that would certainly have re-tuned, had auto still been listening.
        await grow(page, 40, 18)
        await whenLayoutStable(page)
        const afterGrowth = await autoState(page)
        expect(afterGrowth.auto).toBe(false)
        expect(afterGrowth.knobs).toEqual(afterEdit.knobs)
    })

    // Picking a character preset is just as deliberate as dragging a slider.
    test('a preset takes the knobs back from auto', async ({ page }) => {
        await loadAuto(page, { nodes: 6, radius: 18 })
        await whenLayoutStable(page)

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await page.evaluate(() => (window.__pivotick as any).graph.simulation.applyPhysicsPreset('tight'))
        const state = await autoState(page)
        expect(state.auto).toBe(false)
        expect(state.knobs.linkDistance).toBe(70)
    })

    // Default-on, but never over the top of a configuration someone wrote.
    test('a graph that configures its physics keeps it; one that does not gets auto', async ({ page }) => {
        const load = (simulation: Record<string, unknown>) =>
            page.evaluate(
                (s) => window.__pivotick.loadAutoWithConfig({ nodes: 6, radius: 18 }, s as Record<string, unknown>),
                simulation
            )

        await load({})
        expect((await autoState(page)).auto).toBe(true)

        // One auto-owned option is enough to mean "I have tuned this, leave it alone".
        await load({ d3LinkDistance: 200 })
        const configured = await autoState(page)
        expect(configured.auto).toBe(false)
        expect(configured.knobs.linkDistance).toBe(200)

        // Asking for auto *and* setting options is legal: the options seed the opening
        // frame, auto takes it from there.
        await load({ physics: 'auto', d3LinkDistance: 200 })
        expect((await autoState(page)).auto).toBe(true)
    })

    // Auto is force-only; tree layouts own their own spacing.
    test('auto is inert under a tree layout', async ({ page }) => {
        await loadAuto(page, { nodes: 8, radius: 14 })
        await whenLayoutStable(page)
        const before = await autoState(page)

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await page.evaluate(() => (window.__pivotick as any).graph.simulation.changeLayout('tree'))
        await resetReheats(page)
        await grow(page, 20, 14)
        await page.waitForTimeout(600)

        const after = await autoState(page)
        expect(after.knobs).toEqual(before.knobs)
    })
})
