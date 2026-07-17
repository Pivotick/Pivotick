import {
    test,
    expect,
    gotoHarness,
    loadFixture,
    harness,
    expectElement,
} from '../helpers'

// ── Single-selection PROPERTIES panel ────────────────────────────────────────
// When exactly one node is selected, the Properties panel renders a monospace
// section header ("`.PROPERTIES` · N fields") followed by one type-aware row per
// property. The `nodePanel` fixture carries one value per renderer:
//   • id / label / text → scalar text with a copy button,
//   • style             → a nested object, shown as a syntax-highlighted JSON block,
//   • url               → a clickable link with an external-link glyph.

const FULL = { UI: { mode: 'full', sidebar: { collapsed: false } } }
const DOMAIN_ID =
    'domain::torsiqlecptj74i5rksxunffxb3it5pitd5lbyemvadmzrxeih7vjuad.onion'

test.describe('node panel', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    test('renders a type-aware breakdown for a single selection', async ({ page }) => {
        await loadFixture(page, 'nodePanel', FULL)
        await harness(page, 'selectNode', DOMAIN_ID)

        const sidebar = page.locator('.pvt-sidebar')
        await expect(sidebar).not.toHaveClass(/pvt-sidebar-collapsed/)

        const props = sidebar.locator('.pvt-properties-body-panel')
        const panel = props.locator('.pvt-node-props')
        await expect(panel).toBeVisible()

        // Section header reflects the field count: id, label, text, style, url.
        await expect(panel.locator('.pvt-node-props-count')).toHaveText('5 fields')

        // The object-valued `style` becomes a JSON block with a key-count badge;
        // every other renderer is represented exactly once alongside it.
        await expect(props.locator('.pvt-prop-value--json')).toHaveCount(1)
        await expect(props.locator('.pvt-prop-badge')).toHaveText('{ } 7 keys')

        // `url` renders as a link (no copy button); scalars get copy buttons.
        const link = props.locator('.pvt-prop-value--link')
        await expect(link).toHaveCount(1)
        await expect(link).toHaveAttribute('href', /crawlers\/showDomain/)
        await expect(props.locator('.pvt-prop-copy')).toHaveCount(3)

        // Baseline captures just the Properties panel — it excludes the
        // asynchronously-drawn neighbour ego-graph, so it stays stable.
        await expectElement(props, 'node-panel-single-select.png')
    })
})
