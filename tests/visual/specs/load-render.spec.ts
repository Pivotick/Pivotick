import { test, gotoHarness, loadFixture, expectCanvas } from '../helpers'

test.describe('load & render', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    test('renders the basic graph', async ({ page }) => {
        await loadFixture(page, 'basic')
        await expectCanvas(page, 'basic-graph.png')
    })

    test('renders a graph with a markdown note', async ({ page }) => {
        await loadFixture(page, 'withNote')
        await expectCanvas(page, 'with-note.png')
    })

    test('renders a note linked to a node', async ({ page }) => {
        await loadFixture(page, 'withLinkedNote')
        await expectCanvas(page, 'with-linked-note.png')
    })
})
