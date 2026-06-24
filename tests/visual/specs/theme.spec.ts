import { test, gotoHarness, loadFixture, harness, expectCanvas } from '../helpers'

/**
 * Area 2 — themes (T2.1–T2.3).
 *
 * The harness pins everything to `theme: 'light'` by default; these mirror the
 * light-theme load/selection baselines under `{ UI: { theme: 'dark' } }` to catch
 * regressions in the dark palette. The theme is applied by `UIManager`, which sets
 * `data-theme="dark"` on the `.pivotick` container — no new harness verb needed,
 * the existing `load(name, overrides)` deep-merges the option.
 */
const DARK = { UI: { theme: 'dark' } }

test.describe('themes', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    // T2.1 — basic graph in the dark palette (nodes, edges, grid, canvas bg).
    test('dark theme — basic graph', async ({ page }) => {
        await loadFixture(page, 'basic', DARK)
        await expectCanvas(page, 'dark-basic-graph.png')
    })

    // T2.2 — markdown note rendered in the dark palette.
    test('dark theme — note', async ({ page }) => {
        await loadFixture(page, 'withNote', DARK)
        await expectCanvas(page, 'dark-note.png')
    })

    // T2.3 — theme × selection: selected-node visuals over the dark palette.
    test('dark theme — selected node', async ({ page }) => {
        await loadFixture(page, 'basic', DARK)
        await harness(page, 'selectNode', 'a')
        await expectCanvas(page, 'dark-node-selected.png')
    })
})
