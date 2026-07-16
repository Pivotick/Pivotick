import {
    test,
    expect,
    gotoHarness,
    loadFixture,
    harness,
    expectElement,
} from '../helpers'

// ── Faceted multi-selection sidebar ──────────────────────────────────────────
// When several nodes are selected, the Properties panel renders one "facet card"
// per attribute, classified by how the values distribute across the selection:
//   • shared — every node carries the same single value (a full-width bar),
//   • values — a few repeated values (a segmented distribution bar + rows),
//   • unique — every value differs (a wrapped list of chips).
// The `facetSample` fixture is built to exercise all three at once (see fixtures).

/** Full-mode override that builds (and expands) the sidebar. */
const FULL = { UI: { mode: 'full', sidebar: { collapsed: false } } }

test.describe('facets', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    test('renders faceted breakdown for a multi-selection', async ({ page }) => {
        await loadFixture(page, 'facetSample', FULL)
        await harness(page, 'multiSelect', ['C1', 'C2', 'C3', 'C4', 'C5', 'C6'])

        const sidebar = page.locator('.pvt-sidebar')
        await expect(sidebar).not.toHaveClass(/pvt-sidebar-collapsed/)

        // Scope to the Properties panel — the Neighbours "Stats" tab reuses the
        // same facet cards, so counting sidebar-wide would double-count.
        const props = sidebar.locator('.pvt-properties-body-panel')

        // One card per attribute: id + label (unique) + group (shared) +
        // gender + is_active (distributions) = 5.
        await expect(props.locator('.pvt-facet-card')).toHaveCount(5)

        // Each classification is represented: `group` is shared across all six,
        // `gender`/`is_active` are small distributions, `id`/`label` are unique.
        await expect(props.locator('.pvt-facet-badge--shared')).toHaveCount(1)
        await expect(props.locator('.pvt-facet-badge--values')).toHaveCount(2)
        await expect(props.locator('.pvt-facet-badge--unique')).toHaveCount(2)

        // The shared `group` badge reads "shared" (every node carries value C).
        await expect(props.locator('.pvt-facet-badge--shared')).toHaveText('shared')

        // Snapshot the properties panel (not the whole sidebar) so the baseline
        // is stable — it excludes the asynchronously-drawn neighbour ego-graph.
        await expectElement(props, 'facets-multi-select.png')
    })
})
