import { test, expect, gotoHarness, loadFixture, harness, expectCanvas, nodeEl } from '../helpers'
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

/**
 * How far, in screen pixels, a glyph's box centre sits below its node's centre. Text left on
 * the alphabetic baseline rises from the centre, so this goes clearly negative.
 */
async function glyphOffsetFromCentre(page: Page, nodeId: string, glyphSelector: string): Promise<number> {
    const node = await nodeEl(page, nodeId).locator('circle').first().boundingBox()
    const glyph = await nodeEl(page, nodeId).locator(glyphSelector).boundingBox()
    if (!node || !glyph) throw new Error(`no glyph box on node ${nodeId}`)
    return (glyph.y + glyph.height / 2) - (node.y + node.height / 2)
}

/** A node label's drawn width in graph units, from its own `getBBox()`. */
async function labelWidth(page: Page, nodeId: string): Promise<number> {
    return nodeEl(page, nodeId).locator('text.pvt-node-label')
        .evaluate(el => (el as SVGTextElement).getBBox().width)
}

/** Whether a node label sits on the themed pill (a `rect` behind the text). */
async function labelHasPill(page: Page, nodeId: string): Promise<boolean> {
    return await nodeEl(page, nodeId).locator('g.pvt-node-label-group > rect').count() === 1
}

/** The `font-size` a node label is drawn at, in graph units. */
async function labelFontSize(page: Page, nodeId: string): Promise<number> {
    return Number(await nodeEl(page, nodeId).locator('text.pvt-node-label').getAttribute('font-size'))
}

/** How far below its node's centre a label is placed, in graph units. */
async function labelOffset(page: Page, nodeId: string): Promise<number> {
    return Number(await nodeEl(page, nodeId).locator('text.pvt-node-label').getAttribute('y'))
}

/** The height of the pill behind a floated label, in graph units. */
async function pillHeight(page: Page, nodeId: string): Promise<number> {
    return Number(await nodeEl(page, nodeId).locator('g.pvt-node-label-group > rect').getAttribute('height'))
}

/** Whether a node label was cut through a surrogate pair, leaving half a character. */
async function hasLoneSurrogate(page: Page, nodeId: string): Promise<boolean> {
    // Checked in the page: a lone surrogate may not survive the trip back to the test.
    return nodeEl(page, nodeId).locator('text.pvt-node-label')
        .evaluate(el => /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(el.textContent ?? ''))
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

    // T1.3b — text inside an svgIcon keeps `dominant-baseline`, so a glyph the caller
    // centres the way Pivotick does lands where Pivotick's own glyph does.
    test('svgIcon text keeps its baseline', async ({ page }) => {
        await loadPinned(page, 'svgIconTextGlyph')
        const svgText = nodeEl(page, 'svgtext').locator('svg.node-content text')

        await expect(svgText).toHaveAttribute('dominant-baseline', 'central')
        const pivotickOffset = await glyphOffsetFromCentre(page, 'unicode', 'text.icon-unicode')
        const svgIconOffset = await glyphOffsetFromCentre(page, 'svgtext', 'svg.node-content text')
        expect(Math.abs(svgIconOffset - pivotickOffset)).toBeLessThan(2)
    })

    // T1.4 — long-label truncation, vertical/horizontal shift, a rotated label.
    test('node labels', async ({ page }) => {
        await loadPinned(page, 'nodeLabels')
        await expectCanvas(page, 'node-labels.png')
    })

    // T1.4b — `textTruncate: false` draws the whole label instead of `head…tail`,
    // both inside the node and floated above it. The top node keeps the truncating
    // default for contrast; the edge label shows edges were never truncated.
    test('node labels without truncation', async ({ page }) => {
        await loadPinned(page, 'nodeLabelsFull')
        const labelOf = (id: string) => nodeEl(page, id).locator('text.pvt-node-label')
        const full = 'Supercalifragilistic node label'

        await expect(labelOf('truncated')).toHaveText(/…/)
        await expect(labelOf('full-inside')).toHaveText(full)
        await expect(labelOf('full-outside')).toHaveText(full)
        await expectCanvas(page, 'node-labels-full.png')
    })

    // T1.4c — `textMaxWidth` caps a label at a width in graph units, middle-eliding by code
    // point, and gives an inside label that spills the floated label's pill.
    test('node labels capped by textMaxWidth', async ({ page }) => {
        await loadPinned(page, 'nodeLabelsMaxWidth')
        const labelOf = (id: string) => nodeEl(page, id).locator('text.pvt-node-label')

        await expect(labelOf('cap-ip')).toHaveText('185.130.44.131')
        await expect(labelOf('default-ip')).toHaveText(/…/)
        await expect(labelOf('cap-blob')).toHaveText(/^chunk0000.*….*chunk0049$/)
        expect(await labelWidth(page, 'cap-blob')).toBeLessThanOrEqual(160)
        expect(await labelWidth(page, 'cap-inside')).toBeLessThanOrEqual(160)
        expect(await labelHasPill(page, 'cap-inside')).toBe(true)
        await expect(labelOf('cap-ignored')).toHaveText('Supercalifragilistic')
        await expect(labelOf('cap-emoji')).toHaveText(/…/)
        expect(await hasLoneSurrogate(page, 'cap-emoji')).toBe(false)
        expect(await labelWidth(page, 'cap-fn-wide')).toBeGreaterThan(160)
        expect(await labelWidth(page, 'cap-fn-narrow')).toBeLessThanOrEqual(60)
        await expectCanvas(page, 'node-labels-max-width.png')
    })

    // T1.4d — `textFontSize` sets a label's font in place of the size-derived one: an
    // 80-unit node's label matches a 16-unit node's, still clears the node, and keeps a pill
    // the height of a 12-unit label. The 80-unit node beside them keeps the derived 36.
    test('node labels at a declared font size', async ({ page }) => {
        await loadPinned(page, 'nodeLabelsFontSize')

        expect(await labelFontSize(page, 'big-declared')).toBe(12)
        expect(await labelFontSize(page, 'small-declared')).toBe(12)
        expect(await labelFontSize(page, 'big-derived')).toBe(36)
        // Offset is `size + fontSize / 2 x 1.2` below the centre: the node's edge plus a half-line.
        expect(await labelOffset(page, 'big-declared')).toBeCloseTo(80 + 6 * 1.2)
        expect(await labelOffset(page, 'big-derived')).toBeCloseTo(80 + 18 * 1.2)
        expect(await pillHeight(page, 'big-declared')).toBeCloseTo(await pillHeight(page, 'small-declared'))
        await expectCanvas(page, 'node-labels-font-size.png')
    })

    // T1.4e — a `textFontSize` that isn't a positive finite number is ignored, and a function
    // applies only where it returns a size.
    test('node label font size falls back where none is given', async ({ page }) => {
        await loadPinned(page, 'nodeLabelsFontSizeValues')

        for (const id of ['zero', 'negative', 'nan', 'fn-unnamed']) {
            expect(await labelFontSize(page, id), id).toBe(18)
        }
        expect(await labelFontSize(page, 'fn-named')).toBe(12)
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
