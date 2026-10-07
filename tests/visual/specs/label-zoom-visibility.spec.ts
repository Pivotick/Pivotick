import { test, expect, gotoHarness, harness, waitForViewSettled, loadFixture } from '../helpers'
import type { Page } from '@playwright/test'

/**
 * `render.minLabelFontSize` defaults to 9 CSS pixels, and the `labelSizes` fixture draws its
 * labels at three declared sizes, so each crosses at a zoom of its own:
 *
 * | label                          | units | crosses at | gives way at (x 0.85) |
 * |--------------------------------|------:|-----------:|----------------------:|
 * | `big`'s, from its size of 40   |    18 |       0.50 |                  0.43 |
 * | `small`'s, at the 12 floor     |    12 |       0.75 |                  0.64 |
 * | the `big-small` edge's         |    12 |       0.75 |                  0.64 |
 *
 * The zooms below are chosen to sit clear of those lines, except where the band is the point.
 */
const EVERY_LABEL = 1.5
const ONLY_THE_BIG_ONE = 0.6
const NO_LABEL = 0.3
/** Below 12 units' threshold but inside its band: a label already drawn holds here. */
const INSIDE_THE_BAND = 0.7

async function labelShown(page: Page, id: string): Promise<boolean> {
    const node = await harness(page, 'nodeLabelVisible', id)
    return node || (await harness(page, 'edgeLabelVisible', id))
}

async function expectLabels(page: Page, expected: Record<string, boolean>): Promise<void> {
    const drawn = await harness(page, 'labelsDrawn')
    expect(drawn).toEqual(expect.objectContaining(expected))
}

test.describe('labels at zoom', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
        await loadFixture(page, 'labelSizes')
        await waitForViewSettled(page)
    })

    test('a label goes when the zoom shrinks it past legibility, and comes back', async ({ page }) => {
        await harness(page, 'setZoomScale', EVERY_LABEL)
        await expectLabels(page, { big: true, small: true, 'big-small': true })

        await harness(page, 'setZoomScale', NO_LABEL)
        await expectLabels(page, { big: false, small: false, 'big-small': false })

        await harness(page, 'setZoomScale', EVERY_LABEL)
        await expectLabels(page, { big: true, small: true, 'big-small': true })
    })

    test('a node label and an edge label of the same size answer together', async ({ page }) => {
        // `small`'s label and the edge's are both 12 units, and cross as one.
        await harness(page, 'setZoomScale', ONLY_THE_BIG_ONE)
        await expectLabels(page, { small: false, 'big-small': false })

        await harness(page, 'setZoomScale', 0.8)
        await expectLabels(page, { small: true, 'big-small': true })
    })

    test('a big node keeps its label at a zoom where a small one has lost it', async ({ page }) => {
        await harness(page, 'setZoomScale', ONLY_THE_BIG_ONE)
        await expectLabels(page, { big: true, small: false })
    })

    test('a label holds inside its band, and each size has a band of its own', async ({ page }) => {
        await harness(page, 'setZoomScale', EVERY_LABEL)
        await expectLabels(page, { big: true, small: true })

        // Under 12 units' threshold (0.75) but over the 0.64 its band reaches to.
        await harness(page, 'setZoomScale', INSIDE_THE_BAND)
        await expectLabels(page, { big: true, small: true })

        // Past the band, the 12-unit labels give way — and the 18-unit one, which is nowhere
        // near its own, does not go with them.
        await harness(page, 'setZoomScale', ONLY_THE_BIG_ONE)
        await expectLabels(page, { big: true, small: false, 'big-small': false })

        await harness(page, 'setZoomScale', 0.4)
        await expectLabels(page, { big: false })
    })

    test('an edge with no label builds no container', async ({ page }) => {
        await harness(page, 'setZoomScale', EVERY_LABEL)
        expect(await labelShown(page, 'big-small')).toBe(true)
        expect(await labelShown(page, 'small-plain')).toBe(false)
    })

    test('minLabelFontSize 0 draws every label at every zoom', async ({ page }) => {
        await loadFixture(page, 'labelSizes', { render: { minLabelFontSize: 0 } })
        await waitForViewSettled(page)

        await harness(page, 'setZoomScale', 0.1)
        await expectLabels(page, { big: true, small: true, 'big-small': true })
    })

    test('the extent a fit frames is the same whether labels are showing or not', async ({ page }) => {
        await harness(page, 'setZoomScale', NO_LABEL)
        expect(await labelShown(page, 'big-small')).toBe(false)
        const withoutLabels = await harness(page, 'contentBounds')

        await harness(page, 'setZoomScale', EVERY_LABEL)
        expect(await labelShown(page, 'big-small')).toBe(true)

        // Otherwise the fit zooms in to frame a label, which takes the label away, and the
        // view it settles on is not the one it measured.
        expect(await harness(page, 'contentBounds')).toEqual(withoutLabels)
    })

    test('a label leaving is off its edge before its fade is over', async ({ page }) => {
        await harness(page, 'setZoomScale', EVERY_LABEL)
        expect(await labelShown(page, 'big-small')).toBe(true)

        // Caught mid-fade: it is already out of the edge group, so the next tick does not
        // reposition it, and on the ghost layer instead.
        await harness(page, 'setZoomScale', NO_LABEL, false)
        expect(await labelShown(page, 'big-small')).toBe(false)
        expect(await harness(page, 'detailGhostCount')).toBeGreaterThan(0)

        await harness(page, 'settleDetailFade')
        expect(await harness(page, 'detailGhostCount')).toBe(0)
    })

    test('detailTransition 0 takes a label away in a single frame', async ({ page }) => {
        await loadFixture(page, 'labelSizes', { render: { detailTransition: 0 } })
        await waitForViewSettled(page)

        await harness(page, 'setZoomScale', EVERY_LABEL)
        await harness(page, 'setZoomScale', NO_LABEL, false)
        expect(await labelShown(page, 'big-small')).toBe(false)
        expect(await harness(page, 'detailGhostCount')).toBe(0)
    })
})

test.describe('a declared label font at zoom', () => {
    test('an 80-unit node labelled at 12 gives way with the other 12-unit labels', async ({ page }) => {
        await gotoHarness(page)
        await loadFixture(page, 'nodeLabelsFontSize')
        await waitForViewSettled(page)

        await harness(page, 'setZoomScale', EVERY_LABEL)
        await expectLabels(page, { 'big-declared': true, 'small-declared': true, 'big-derived': true })

        // The 80-unit node left on its derived 36 is nowhere near its own line (0.25).
        await harness(page, 'setZoomScale', ONLY_THE_BIG_ONE)
        await expectLabels(page, { 'big-declared': false, 'small-declared': false, 'big-derived': true })
    })
})

test.describe('a selected edge keeps its label', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
        await loadFixture(page, 'labelSizes')
        await waitForViewSettled(page)
        await harness(page, 'setZoomScale', NO_LABEL)
    })

    test('a lone selection shows it, at a size the zoom does not change', async ({ page }) => {
        expect(await labelShown(page, 'big-small')).toBe(false)

        await harness(page, 'selectEdge', 'big-small')
        expect(await labelShown(page, 'big-small')).toBe(true)
        const size = await harness(page, 'edgeLabelScreenSize', 'big-small')

        // Half the zoom again: riding the graph it would halve, counter-scaled it holds.
        await harness(page, 'setZoomScale', 0.15)
        expect(await harness(page, 'edgeLabelScreenSize', 'big-small')).toEqual(size)
    })

    test('selected while it is showing, it holds its size on the way back out', async ({ page }) => {
        await harness(page, 'setZoomScale', EVERY_LABEL)
        await harness(page, 'selectEdge', 'big-small')

        await harness(page, 'setZoomScale', NO_LABEL)
        expect(await labelShown(page, 'big-small')).toBe(true)
        const size = await harness(page, 'edgeLabelScreenSize', 'big-small')

        await harness(page, 'setZoomScale', 0.15)
        expect(await harness(page, 'edgeLabelScreenSize', 'big-small')).toEqual(size)
    })

    test('and gives it back on deselection', async ({ page }) => {
        await harness(page, 'selectEdge', 'big-small')
        expect(await labelShown(page, 'big-small')).toBe(true)

        await harness(page, 'clearSelection')
        await harness(page, 'settleDetailFade')
        expect(await labelShown(page, 'big-small')).toBe(false)
    })

    test('a multi-selection forces nothing', async ({ page }) => {
        await harness(page, 'multiSelectEdges', ['big-small', 'small-plain'])
        expect(await labelShown(page, 'big-small')).toBe(false)
    })

    test('a selected node forces nothing: it answers through its tooltip and its panel', async ({ page }) => {
        await harness(page, 'selectNode', 'small')
        expect(await labelShown(page, 'small')).toBe(false)
    })
})
