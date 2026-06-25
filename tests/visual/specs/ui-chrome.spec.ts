import {
    test,
    expect,
    gotoHarness,
    loadFixture,
    harness,
    expectElement,
} from '../helpers'

// ── Area 8 — UI chrome ───────────────────────────────────────────────────────
// Baselines for the UI "chrome" (sidebar, toolbar, navigation/controls and the
// inspect / search modals) rather than the graph canvas. Per the README's P0.7
// note, chrome pixels are more volatile, so every test targets a *specific*
// element locator (via `expectElement`), not the whole page.
//
// **Mode (the P0.7 question, resolved).** The toolbar, navigation, controls and
// the modal/mainheader containers are already built by the harness's existing
// **light** mode (the P0.7 correction in the PRD), and are positioned as canvas
// overlays / a top bar independent of the grid mode — so they look identical in
// light and full mode. T8.2–T8.5 therefore use the default light-mode harness.
// The **sidebar** is the one piece built *only* in `'full'` mode, so T8.1 loads
// full mode with the sidebar expanded through a plain `load()` override
// (`UI.mode:'full'`, `sidebar.collapsed:false`) — no new loader needed, since
// `load` already deep-merges options (the same path themes/layouts use). The
// 1280×800 viewport falls just under the `hasEnoughSpaceForFullMode` height
// check, but that only governs the `collapsed:'auto'` branch; an explicit
// `false` builds the sidebar regardless.
//
// **Entry mechanism (the P0.6 "pick per test" call).** Edit mode (T8.2) and the
// search modal (T8.5) are driven by their real entry points — the `e` shortcut
// and a click on the search button. The inspect modal (T8.4) uses the new
// `openInspect(id)` verb, which calls the same `createInspectModal` the `i`
// shortcut and the context-menu "Inspect Properties" item invoke (mirroring how
// T5.4 opens the filter panel by verb). These are chrome snapshots — the element
// rendering is what's under test, not the keystroke.

/** Full-mode override that builds (and expands) the sidebar. */
const FULL = { UI: { mode: 'full', sidebar: { collapsed: false } } }

test.describe('ui-chrome', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    // T8.1 — the sidebar (full mode) with node `a` selected: the overview,
    // properties and neighbours panels populate from the node and its edges
    // (a links to b, e and hub).
    //
    // The "Neighbor Graph" tab (default) renders a *nested* Pivotick sub-graph
    // asynchronously and keeps its container `visibility:hidden` until that graph
    // is ready and drawn — so we must wait for it explicitly. Relying on
    // `toHaveScreenshot`'s stability heuristic alone is a race: it can fire during
    // the quiescent gap *before* the sub-graph starts and lock in the empty
    // container. Waiting for the container to turn visible (the post-draw flip)
    // and for its node `<g>`s to exist guarantees the snapshot shows the drawn
    // graph. (The sub-graph itself is deterministic — it lays out with
    // `cooldownTime:0`, landing straight on the egoTree targets. Its content is a
    // layout-independent function of the node data, so no `pin()` is needed.)
    test('shows the sidebar with a node selected', async ({ page }) => {
        await loadFixture(page, 'basic', FULL)
        await harness(page, 'selectNode', 'a')

        const sidebar = page.locator('.pvt-sidebar')
        await expect(sidebar).not.toHaveClass(/pvt-sidebar-collapsed/)

        // The neighbour sub-graph: wait for it to flip visible and draw its four
        // node shapes (the ego node `a` plus its neighbours b, e, hub) before
        // snapshot. `.node` is the class on the shape element (circle/rect/path),
        // not the `<g>`.
        const neighborGraph = sidebar.locator('.main-egograph-container')
        await expect(neighborGraph).toBeVisible()
        await expect(neighborGraph.locator('.node')).toHaveCount(4)

        await expectElement(sidebar, 'sidebar-node-selected.png')
    })

    // T8.2 — the toolbar in edit mode. Pressing `e` (the toolbar's own shortcut)
    // toggles edit mode, revealing the tool groups (Add Node/Edge/Note + the
    // selection tools) and renaming the button to "Editing". Focus the container
    // first so the keybinding — gated on container focus — fires; using the
    // keyboard rather than clicking the button keeps the button unfocused, so no
    // focus ring bleeds into the baseline.
    test('shows the toolbar in edit mode', async ({ page }) => {
        await loadFixture(page, 'basic')
        await page.locator('.pivotick').focus()
        await page.keyboard.press('e')

        const toolbar = page.locator('.pvt-graphtoolbar')
        await expect(toolbar).toHaveClass(/edit-mode-active/)
        // The tool groups animate in (a width transition plus a rAF-added
        // `visible` class); wait for one to be shown before snapshotting.
        // Playwright freezes the transition itself to its end-state.
        await expect(toolbar.locator('.pvt-toolbar-group.visible').first()).toBeVisible()
        await expectElement(toolbar, 'toolbar-edit-mode.png')
    })

    // T8.3 — the navigation (fit / zoom in-out / fullscreen / options) and the
    // layout + physics controls. They live in opposite top corners of the canvas,
    // so each is snapshotted as its own element (two baselines) per the README's
    // "target specific elements" guidance. Loaded on the acyclic `tree` fixture
    // so the tree-layout buttons render enabled (a cyclic graph disables them).
    // The controls' fly-out sub-options are `:hover`-only, so they stay collapsed
    // in a no-hover screenshot — deterministic.
    test('shows the navigation and layout controls', async ({ page }) => {
        await loadFixture(page, 'tree')

        await expectElement(
            page.locator('.pvt-graphnavigation-elements'),
            'nav-controls-navigation.png'
        )
        await expectElement(
            page.locator('.pvt-graphcontrols-layout'),
            'nav-controls-controls.png'
        )
    })

    // T8.4 — the inspect-node modal: a header preview + name and a Properties /
    // JSON tab pair (Properties active by default). Opened via the `openInspect`
    // verb (same `createInspectModal` as the `i` shortcut / context menu).
    test('shows the inspect-node modal', async ({ page }) => {
        await loadFixture(page, 'basic')
        await harness(page, 'openInspect', 'a')

        const modal = page.locator('#inspect-node-modal')
        await expect(modal).toBeVisible()
        await expectElement(modal, 'inspect-modal.png')
    })

    // T8.5 — the search / node-picker modal (the Shift+J shortcut / search
    // button). Open it by clicking the real search button, type a query matching
    // several nodes, and snapshot the picker with its results. The `filterable`
    // fixture's nodes carry a `type` field, so "router" matches the three routers
    // (`r1`/`r2`/`r3`, in insertion order); each result's preview is a bbox-scaled
    // clone, so it's layout-independent.
    test('shows the search modal with results', async ({ page }) => {
        await loadFixture(page, 'filterable')
        await page.locator('#pvt-searchbox-button').click()

        const search = page.locator('.pvt-searchbox')
        await expect(search).toBeVisible()
        await page.locator('#pvt-search-input').fill('router')

        await expect(search.locator('.pvt-search-result')).toHaveCount(3)
        await expectElement(page.locator('.pvt-modal'), 'search-modal.png')
    })
})
