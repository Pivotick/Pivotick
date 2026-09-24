/**
 * What the canvas draws for edges across clusters, at every depth. The rule: each end of an
 * edge lands on the dot on screen for it (the node itself, or the outermost closed cluster
 * hiding it), and edges landing on the same pair of dots share one line. Both ends on one dot
 * draw nothing, except an edge from a cluster into itself, which loops on the closed cluster.
 *
 * Read off the rendered page: every edge element in the DOM, named by the pair of nodes it is
 * drawn between. Open clusters are drawn from copies of their children, so the edge objects'
 * own flags are not a reliable account of what is on screen.
 *
 * The `nestedClusters` fixture: X, Y on the main canvas; A { a1, B { b1, C { c1 } } } and
 * P { p1 { q1 } }; one edge of every shape (see the fixture).
 */
import type { Page } from '@playwright/test'
import { expect, gotoHarness, harness, loadFixture, test } from '../helpers'

const OPTIONS = {
    simulation: { enabled: true, useWorker: false },
    render: { enableNodeExpansion: true },
}

/** The lines on the canvas as `from->to`, sorted. A line with no drawn path reads `from->to(empty)`. */
async function drawnLines(page: Page): Promise<string[]> {
    return page.evaluate(() => {
        const g = window.__pivotick.graph!
        const byDomId = new Map(g.getDrawnEdges().map((edge) => [`edge-${edge.domID}`, edge]))
        return [...document.querySelectorAll('g.pvt-edge-group')].map((group) => {
            const edge = byDomId.get(group.id)
            if (!edge) return `unknown(${group.id})`
            const path = group.querySelector('path') as SVGPathElement | null
            const empty = !path || path.getTotalLength() === 0 ? '(empty)' : ''
            return `${edge.from.id}->${edge.to.id}${empty}`
        }).sort()
    })
}

async function expectLines(page: Page, lines: string[]): Promise<void> {
    await expect.poll(() => drawnLines(page)).toEqual([...lines].sort())
}

/** The edge the interaction layer holds as selected, by id. */
async function selectedEdgeId(page: Page): Promise<string | null> {
    return page.evaluate(() => window.__pivotick.graph!.renderer.getGraphInteraction().getSelectedEdge()?.edge.id ?? null)
}

/** Click a drawn line by the pair of nodes it joins. */
async function clickLine(page: Page, line: string): Promise<void> {
    await page.evaluate((line) => {
        const g = window.__pivotick.graph!
        const edge = g.getDrawnEdges().find((e) => `${e.from.id}->${e.to.id}` === line)
        edge?.getGraphElement()?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    }, line)
}

const ALL_CLOSED = ['X->A', 'A->X', 'A->Y', 'A->P', 'A->A']
const A_OPEN = ['X->a1', 'X->B', 'a1->X', 'a1->B', 'B->Y', 'B->P', 'A->B']
const A_B_OPEN = ['X->a1', 'X->b1', 'X->C', 'X->B', 'a1->X', 'a1->b1', 'b1->C', 'C->Y', 'C->P', 'A->C']
const A_B_C_OPEN = ['X->a1', 'X->b1', 'X->c1', 'X->B', 'a1->X', 'a1->b1', 'b1->c1', 'c1->Y', 'c1->P', 'A->c1']

test.describe('edges across clusters', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
        await loadFixture(page, 'nestedClusters', OPTIONS)
    })

    test('each open/closed state draws one line per pair of dots', async ({ page }) => {
        // `X→A` stands for four edges, `A→A` is `A→c1` looping on the closed cluster, and
        // `a1→b1`, `b1→c1` fold into A and draw nothing.
        await expectLines(page, ALL_CLOSED)

        // `X→B` is the real edge to B and the two into b1 and c1, on one line.
        await harness(page, 'expand', ['A'])
        await expectLines(page, A_OPEN)

        await harness(page, 'expand', ['A', 'B'])
        await expectLines(page, A_B_OPEN)

        await harness(page, 'expand', ['A', 'B', 'C'])
        await expectLines(page, A_B_C_OPEN)

        // Deep in A to deep in P, once both are open all the way down.
        await harness(page, 'expand', ['P', 'p1'])
        await expectLines(page, A_B_C_OPEN.map((line) => (line === 'c1->P' ? 'c1->q1' : line)))
    })

    test('closing the outer cluster with inner ones open, then reopening, draws the same', async ({ page }) => {
        await harness(page, 'expand', ['A', 'B', 'C'])
        await expectLines(page, A_B_C_OPEN)

        await harness(page, 'collapse', 'A')
        await expectLines(page, ALL_CLOSED)

        // Closing A closed everything inside it, so reopening shows B closed.
        await harness(page, 'expand', ['A'])
        await expectLines(page, A_OPEN)
    })

    test('an edge added into a closed cluster folds onto it, and goes when removed', async ({ page }) => {
        const addEdge = (from: string, to: string) => page.evaluate(([from, to]) => {
            window.__pivotick.graph!.addEdge({ id: `${from}-${to}`, from, to })
        }, [from, to])
        const removeEdge = (id: string) => page.evaluate((id) => window.__pivotick.graph!.removeEdge(id), id)

        await addEdge('Y', 'b1')
        await expectLines(page, [...ALL_CLOSED, 'Y->A'])

        await harness(page, 'expand', ['A', 'B'])
        await expectLines(page, [...A_B_OPEN, 'Y->b1'])

        await removeEdge('Y-b1')
        await expectLines(page, A_B_OPEN)
    })

    test('filtering out a deep child removes only the lines it held', async ({ page }) => {
        await harness(page, 'excludeNode', 'c1')
        // X→A still stands for X→a1, X→b1 and X→B.
        await expectLines(page, ['X->A', 'A->X'])

        await harness(page, 'expand', ['A', 'B', 'C'])
        await expectLines(page, ['X->a1', 'X->b1', 'X->B', 'a1->X', 'a1->b1'])
    })

    test('a line for one edge acts as that edge, a line for several stands on its own', async ({ page }) => {
        // `A→X` stands for `a1→X` alone: clicking it selects that real edge.
        await clickLine(page, 'A->X')
        await expect.poll(() => selectedEdgeId(page)).toBe('a1-X')

        // `X→A` stands for four edges: clicking selects the line itself.
        await clickLine(page, 'X->A')
        await expect.poll(() => selectedEdgeId(page)).toBe('synthetic-X-A')
    })

    test('a line inside an open bubble takes the click from the bubble', async ({ page }) => {
        await harness(page, 'expand', ['A', 'B'])
        await expectLines(page, A_B_OPEN)

        // Three quarters along X→b1 is well inside A's bubble, whose fill used to take it.
        const point = await page.evaluate(() => {
            const edge = window.__pivotick.graph!.getDrawnEdges().find((e) => e.id === 'X-b1')!
            const path = edge.getGraphElement()!.querySelector('path') as SVGPathElement
            const p = path.getPointAtLength(path.getTotalLength() * 0.75).matrixTransform(path.getScreenCTM()!)
            const onBubble = document.elementFromPoint(p.x, p.y)?.classList.contains('pvt-cluster-area') ?? false
            return { x: p.x, y: p.y, onBubble }
        })
        expect(point.onBubble).toBe(true)

        await page.mouse.click(point.x, point.y)
        await expect.poll(() => selectedEdgeId(page)).toBe('X-b1')
    })
})
