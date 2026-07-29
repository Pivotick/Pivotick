import { test, expect, gotoHarness, loadFixture } from '../helpers'

/**
 * Non-visual regression cover for the UI-lifecycle reentrancy fix
 * (prd/ui-lifecycle-emitphase-reentrancy.md). The invariants are about how many
 * times a lifecycle phase fires during a broadcast, not about pixels, so every
 * test runs its logic in-page against the live UIManager
 * (`window.__pivotick.graph.UIManager`, a public field) and asserts on returned
 * call-counts.
 *
 * A "probe element" is a minimal duck-typed UIComponent: `emitPhase` only ever
 * calls mount / afterMount / graphReady / destroy on the entries in `elements`,
 * so a plain object with those four methods drives the real lifecycle without
 * needing the (in-page-only) UIComponent class. `graphReady` is a once-only phase
 * (it fires at load; `setData()` no longer re-broadcasts it), so a later
 * `callGraphReady()` is a no-op — these tests lock in that fire-once contract and
 * the addElement/onPhase catch-up that replaces re-broadcasting.
 *
 * The graph is booted in `light` mode (the harness default), so the ModeRail is
 * mounted and its `v` / `c` keybindings exist to assert on.
 */

test.beforeEach(async ({ page }) => {
    await gotoHarness(page)
    await loadFixture(page, 'basic')
})

test('graphReady is fire-once: callGraphReady() does not re-fire it, and a late-added element is caught up exactly once', async ({ page }) => {
    const counts = await page.evaluate(() => {
        const um = (window as unknown as { __pivotick: { graph: { UIManager: {
            addElement: (el: unknown) => void
            callGraphReady: () => void
        } } } }).__pivotick.graph.UIManager

        const c = { existingGraphReady: 0, lateAfterMount: 0, lateGraphReady: 0 }

        // graphReady already fired at load, so addElement catches this element up once.
        const existing = {
            mount() {}, afterMount() {},
            graphReady() { c.existingGraphReady++ }, destroy() {},
        }
        um.addElement(existing)

        // Fire-once: a further callGraphReady() must NOT re-broadcast, so
        // existing.graphReady does not run a second time.
        um.callGraphReady()

        // A later addition is still caught up exactly once (afterMount + graphReady already emitted).
        const late = {
            mount() {}, afterMount() { c.lateAfterMount++ },
            graphReady() { c.lateGraphReady++ }, destroy() {},
        }
        um.addElement(late)
        um.callGraphReady() // still a no-op

        return c
    })

    expect(counts.existingGraphReady).toBe(1) // caught up on add; callGraphReady did not re-fire
    expect(counts.lateAfterMount).toBe(1)     // caught up once
    expect(counts.lateGraphReady).toBe(1)     // caught up once, never re-broadcast
})

test('onPhase(graphReady) registered after the broadcast runs once (catch-up) and is not re-run by callGraphReady()', async ({ page }) => {
    const counts = await page.evaluate(() => {
        const um = (window as unknown as { __pivotick: { graph: { UIManager: {
            onPhase: (phase: string, cb: () => void) => () => void
            callGraphReady: () => void
        } } } }).__pivotick.graph.UIManager

        const c = { handler: 0 }
        // graphReady already emitted, so onPhase runs the handler once immediately (catch-up).
        um.onPhase('graphReady', () => { c.handler++ })
        // Fire-once: callGraphReady() does not re-broadcast, so the handler is not re-run.
        um.callGraphReady()
        return c
    })

    expect(counts.handler).toBe(1) // caught up once on registration; no re-broadcast
})

test('addElement and installPlugin after destroy() warn once each and are true no-ops', async ({ page }) => {
    const result = await page.evaluate(() => {
        const pv = (window as unknown as { __pivotick: { graph: {
            UIManager: { destroy: () => void; addElement: (el: unknown) => void }
            use: (p: { name: string; install: () => void }) => unknown
        } } }).__pivotick
        const um = pv.graph.UIManager

        const warnings: string[] = []
        const origWarn = console.warn
        console.warn = (...args: unknown[]) => { warnings.push(args.map(String).join(' ')) }
        try {
            um.destroy()
            const probe = {
                fired: 0,
                mount() { this.fired++ }, afterMount() { this.fired++ },
                graphReady() { this.fired++ }, destroy() {},
            }
            um.addElement(probe)
            let installed = false
            pv.graph.use({ name: 'ghost', install: () => { installed = true } })
            return { warnings, probeFired: probe.fired, installed }
        } finally {
            console.warn = origWarn
        }
    })

    expect(result.probeFired).toBe(0)   // not mounted, no phase fired → genuinely nothing happened
    expect(result.installed).toBe(false) // install() never ran
    expect(result.warnings).toHaveLength(2) // one refusal warning per call
    expect(result.warnings.every((w) => /destroy/i.test(w))).toBe(true)
})

test('the ModeRail v/c keybindings are removed on destroy', async ({ page }) => {
    const result = await page.evaluate(() => {
        const um = (window as unknown as { __pivotick: { graph: { UIManager: {
            keyManager: { bindings: Map<string, unknown> }
            destroy: () => void
        } } } }).__pivotick.graph.UIManager
        const bindings = um.keyManager.bindings
        const before = { v: bindings.has('v'), c: bindings.has('c') }
        um.destroy()
        const after = { v: bindings.has('v'), c: bindings.has('c') }
        return { before, after }
    })

    expect(result.before).toEqual({ v: true, c: true })   // ModeRail registered both in light mode
    expect(result.after).toEqual({ v: false, c: false })  // tracked disposers ran on destroy (Fix B)
})
