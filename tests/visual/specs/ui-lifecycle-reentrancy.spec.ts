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
 * needing the (in-page-only) UIComponent class. `callGraphReady()` re-runs the
 * `graphReady` broadcast — the only public way to re-enter an `emitPhase` loop
 * on an already-live UIManager, which is exactly where the double-fire lived.
 *
 * The graph is booted in `light` mode (the harness default), so the GraphToolbar
 * is mounted and its `e` / `Escape` keybindings exist to assert on.
 */

test.beforeEach(async ({ page }) => {
    await gotoHarness(page)
    await loadFixture(page, 'basic')
})

test('an element added during a graphReady broadcast receives each phase exactly once', async ({ page }) => {
    const counts = await page.evaluate(() => {
        const um = (window as unknown as { __pivotick: { graph: { UIManager: {
            addElement: (el: unknown) => void
            callGraphReady: () => void
        } } } }).__pivotick.graph.UIManager

        const c = { parentGraphReady: 0, childAfterMount: 0, childGraphReady: 0 }
        const child = {
            mount() {}, afterMount() { c.childAfterMount++ },
            graphReady() { c.childGraphReady++ }, destroy() {},
        }
        // Only add the child on a broadcast we explicitly arm, so the catch-up
        // that `addElement(parent)` triggers doesn't add it early.
        let armed = false
        const parent = {
            mount() {}, afterMount() {},
            graphReady() { c.parentGraphReady++; if (armed) { armed = false; um.addElement(child) } },
            destroy() {},
        }

        // graphReady already fired at load, so this catches `parent` up once (armed=false → no child yet).
        um.addElement(parent)
        // Arm, then re-broadcast. During the loop `parent.graphReady` adds `child`
        // mid-flight: addElement catches it up once; the snapshotted loop must not
        // then visit the freshly-pushed entry a second time.
        armed = true
        um.callGraphReady()
        return c
    })

    expect(counts.parentGraphReady).toBe(2) // once on catch-up, once in the re-broadcast
    expect(counts.childAfterMount).toBe(1)  // caught up on add, never double-fired
    expect(counts.childGraphReady).toBe(1)  // the fix: caught up once, not re-visited by the live loop
})

test('an onPhase(graphReady) handler registered during a graphReady broadcast runs exactly once', async ({ page }) => {
    const counts = await page.evaluate(() => {
        const um = (window as unknown as { __pivotick: { graph: { UIManager: {
            onPhase: (phase: string, cb: () => void) => () => void
            callGraphReady: () => void
        } } } }).__pivotick.graph.UIManager

        const c = { outer: 0, inner: 0 }
        const inner = () => { c.inner++ }
        let armed = false
        const outer = () => { c.outer++; if (armed) { armed = false; um.onPhase('graphReady', inner) } }

        um.onPhase('graphReady', outer) // catch-up runs `outer` once (armed=false → no inner registered)
        armed = true
        um.callGraphReady()             // `outer` registers `inner` mid-loop; onPhase catches it up once,
                                        // and the snapshotted handler loop must not re-run it
        return c
    })

    expect(counts.outer).toBe(2)
    expect(counts.inner).toBe(1) // the fix: caught up once, not re-run by the live loop
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

test('the GraphToolbar e/Escape keybindings are removed on destroy', async ({ page }) => {
    const result = await page.evaluate(() => {
        const um = (window as unknown as { __pivotick: { graph: { UIManager: {
            keyManager: { bindings: Map<string, unknown> }
            destroy: () => void
        } } } }).__pivotick.graph.UIManager
        const bindings = um.keyManager.bindings
        const before = { e: bindings.has('e'), escape: bindings.has('Escape') }
        um.destroy()
        const after = { e: bindings.has('e'), escape: bindings.has('Escape') }
        return { before, after }
    })

    expect(result.before).toEqual({ e: true, escape: true })   // toolbar registered both in light mode
    expect(result.after).toEqual({ e: false, escape: false })  // tracked disposers ran on destroy (Fix B)
})
