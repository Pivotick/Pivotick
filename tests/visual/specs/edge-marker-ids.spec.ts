import { test, expect, gotoHarness, harness } from '../helpers'

// `url(#id)` resolves to the first element in the whole document with that id, not the one
// in the referring graph's own `<defs>`. Each graph's markers must carry ids no other graph
// shares, or a second graph on the page paints the first one's markers, and paints nothing
// when the first sits in a hidden tab.

const OWN_FILL = '#2563eb'
const OTHER_FILL = '#dc2626'
// The other graph is mounted first in the document, so the shared canvas helper would find it.
const TESTED_CANVAS = '#app .pvt-canvas'

test.describe('edge markers with two graphs on the page', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    test('a graph beside a hidden one draws its own arrowheads', async ({ page }) => {
        await harness(page, 'loadBesideAnotherGraph', 'basic', { hidden: true })

        expect((await harness(page, 'edgeEndMarker', 'a-b'))?.owner).toBe('own')
        await expect(page.locator(TESTED_CANVAS)).toHaveScreenshot('arrowheads-beside-hidden-graph.png')
    })

    test('a selected arrowhead is the graph’s own too', async ({ page }) => {
        await harness(page, 'loadBesideAnotherGraph', 'basic', { hidden: true })
        const idle = await harness(page, 'edgeEndMarker', 'a-b')

        await harness(page, 'selectEdge', 'a-b')
        const selected = await harness(page, 'edgeEndMarker', 'a-b')
        // A different marker from the idle one, and still in this graph.
        expect(selected?.reference).not.toBe(idle?.reference)
        expect(selected?.owner).toBe('own')
    })

    test('each graph draws the arrow its own markerStyleMap gives', async ({ page }) => {
        await harness(page, 'loadBesideAnotherGraph', 'basic', { arrowFill: OWN_FILL, otherArrowFill: OTHER_FILL })

        expect(await harness(page, 'edgeEndMarker', 'a-b')).toMatchObject({ owner: 'own', fill: OWN_FILL })
        expect(await harness(page, 'edgeEndMarker', 'other-edge', 'other')).toMatchObject({ owner: 'own', fill: OTHER_FILL })
    })

    test('no marker id is shared between the graphs', async ({ page }) => {
        await harness(page, 'loadBesideAnotherGraph', 'basic')

        expect(await harness(page, 'repeatedDefIds')).toEqual([])
    })

    test('the shadow edge of a new connection points at the graph’s own arrow', async ({ page }) => {
        await harness(page, 'loadBesideAnotherGraph', 'pair', { hidden: true })
        await harness(page, 'startClickConnect')
        await harness(page, 'pickConnectNode', 'a')
        const box = await page.locator('#app #node-b').boundingBox()
        await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)

        expect((await harness(page, 'shadowEdgeMarker')).owner).toBe('own')
    })
})
