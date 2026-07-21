import { test, expect, gotoHarness, loadFixture } from '../helpers'

/**
 * Non-visual cover for the plugin-API contract fixes
 * (prd/plugin-api-contract-truth.md): name-based de-duplication and the live
 * `ctx.layout` getter. Both run in-page against the live graph
 * (`window.__pivotick.graph`, whose `UIManager` field is public), asserting on
 * returned values rather than pixels. The harness boots in `light` mode, so the
 * layout and its slots exist.
 */

test.beforeEach(async ({ page }) => {
    await gotoHarness(page)
    await loadFixture(page, 'basic')
})

test('installing the same plugin name twice installs it once and warns once', async ({ page }) => {
    const r = await page.evaluate(() => {
        const graph = (window as unknown as { __pivotick: { graph: {
            use: (p: { name: string; install: () => void }) => unknown
        } } }).__pivotick.graph

        const warnings: string[] = []
        const origWarn = console.warn
        console.warn = (...args: unknown[]) => { warnings.push(args.map(String).join(' ')) }
        try {
            let installs = 0
            // Two distinct objects sharing a name — dedup is by name, not identity.
            const make = () => ({ name: 'dup', install: () => { installs++ } })
            graph.use(make())
            graph.use(make())
            return { installs, warnings }
        } finally {
            console.warn = origWarn
        }
    })

    expect(r.installs).toBe(1)             // the duplicate never ran install()
    expect(r.warnings).toHaveLength(1)     // exactly one warning for the duplicate
    expect(/already installed/i.test(r.warnings[0])).toBe(true)
})

test('plugins with different names each install', async ({ page }) => {
    const installed = await page.evaluate(() => {
        const graph = (window as unknown as { __pivotick: { graph: {
            use: (p: { name: string; install: () => void }) => unknown
        } } }).__pivotick.graph
        const names: string[] = []
        graph.use({ name: 'one', install: () => names.push('one') })
        graph.use({ name: 'two', install: () => names.push('two') })
        return names
    })

    expect(installed).toEqual(['one', 'two'])
})

test('the dedup registry is cleared on destroy', async ({ page }) => {
    const sizes = await page.evaluate(() => {
        const graph = (window as unknown as { __pivotick: { graph: {
            use: (p: { name: string; install: () => void }) => unknown
            UIManager: { installedPlugins: Set<string>; destroy: () => void }
        } } }).__pivotick.graph
        graph.use({ name: 'x', install: () => {} })
        const before = graph.UIManager.installedPlugins.size
        graph.UIManager.destroy()
        const after = graph.UIManager.installedPlugins.size
        return { before, after }
    })

    expect(sizes.before).toBe(1)
    expect(sizes.after).toBe(0) // reset, so a rebuilt UI can reinstall the same name
})

test('ctx.layout is a live view of ui.layout, not an install-time snapshot', async ({ page }) => {
    const r = await page.evaluate(() => {
        const graph = (window as unknown as { __pivotick: { graph: {
            use: (p: { name: string; install: (ctx: { layout: unknown }) => void }) => unknown
            UIManager: { layout: unknown; destroy: () => void }
        } } }).__pivotick.graph
        const um = graph.UIManager

        let ctxRef: { layout: unknown } | null = null
        graph.use({ name: 'probe', install: (ctx) => { ctxRef = ctx } })
        const ctx = ctxRef as unknown as { layout: unknown }

        const before = { defined: Boolean(ctx.layout), matchesUi: ctx.layout === um.layout }
        // destroy() clears the registry, so ui.layout becomes undefined. A live
        // getter must follow it there; an install-time snapshot would stay defined.
        um.destroy()
        const after = { undefinedNow: ctx.layout === undefined, matchesUi: ctx.layout === um.layout }
        return { before, after }
    })

    expect(r.before).toEqual({ defined: true, matchesUi: true })
    expect(r.after).toEqual({ undefinedNow: true, matchesUi: true })
})
