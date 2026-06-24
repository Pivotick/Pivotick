import { test, gotoHarness, loadFixture, harness, expectCanvas } from '../helpers'
import type { Page } from '@playwright/test'
import type { FixtureName } from '../harness/fixtures'

/**
 * Area 1 — node & edge styling (T1.1–T1.10).
 *
 * Pure render, no interaction: the most stable, highest-coverage-per-effort
 * baselines. Each test loads a focused fixture (see `fixtures.ts`) that isolates
 * one styling concern, so a failure points straight at what regressed.
 *
 * Fixtures are loaded *pinned* (`harness.pin`): the graph's initial layout pass
 * would otherwise treat the fixture coordinates as mere seeds and settle them
 * with the force sim, scattering these deliberately laid-out side-by-side scenes.
 */
async function loadPinned(page: Page, name: FixtureName, overrides: Record<string, unknown> = {}) {
    await loadFixture(page, name, overrides)
    await harness(page, 'pin')
}

test.describe('node & edge styling', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    // T1.1 — circle / square / triangle / hexagon / custom SVG path, side by side.
    test('node shapes', async ({ page }) => {
        await loadPinned(page, 'nodeShapes')
        await expectCanvas(page, 'node-shapes.png')
    })

    // T1.2 — distinct sizes, fills, stroke colour and stroke width.
    test('node size & colour variation', async ({ page }) => {
        await loadPinned(page, 'nodeStyles')
        await expectCanvas(page, 'node-size-color.png')
    })

    // T1.3 — one node each for iconUnicode / iconClass / svgIcon / imagePath.
    // `iconClass` reads the glyph from the consumer's icon-library CSS via the
    // `--fa` custom property. Pivotick ships no icon font, so we inject a tiny
    // self-contained stand-in stylesheet here to exercise that contract
    // deterministically (here `--fa: "\2605"` → ★).
    test('node icons', async ({ page }) => {
        await page.addStyleTag({ content: '.test-glyph { --fa: "\\2605"; }' })
        await loadPinned(page, 'nodeIcons')
        await expectCanvas(page, 'node-icons.png')
    })

    // T1.4 — long-label truncation, vertical/horizontal shift, a rotated label.
    test('node labels', async ({ page }) => {
        await loadPinned(page, 'nodeLabels')
        await expectCanvas(page, 'node-labels.png')
    })

    // T1.5 — straight vs curved vs bidirectional (reciprocal edges curve apart).
    test('edge curve styles', async ({ page }) => {
        await loadPinned(page, 'edgeCurves')
        await expectCanvas(page, 'edge-curves.png')
    })

    // T1.6 — self-loop arc (from === to) with an offset label.
    test('self-loop edge', async ({ page }) => {
        await loadPinned(page, 'selfLoop')
        await expectCanvas(page, 'edge-self-loop.png')
    })

    // T1.7 — arrow / circle / diamond / bigcircle end-markers.
    test('edge end-markers', async ({ page }) => {
        await loadPinned(page, 'edgeMarkers')
        await expectCanvas(page, 'edge-markers.png')
    })

    // T1.8 — dashed edge (no animateDash, so the dash is a static frame).
    test('dashed edge', async ({ page }) => {
        await loadPinned(page, 'edgeDashed')
        await expectCanvas(page, 'edge-dashed.png')
    })

    // T1.9 — label with background box; label rotated to follow its edge.
    test('edge labels', async ({ page }) => {
        await loadPinned(page, 'edgeLabels')
        await expectCanvas(page, 'edge-labels.png')
    })

    // T1.10 — undirected graph: no arrowheads on any edge.
    test('undirected graph has no arrowheads', async ({ page }) => {
        await loadPinned(page, 'basic', { isDirected: false })
        await expectCanvas(page, 'undirected-graph.png')
    })
})
