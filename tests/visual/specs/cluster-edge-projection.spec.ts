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

/** How a drawn line looks: its stroke colour, its label text, and whether it is dotted. */
async function lineLook(page: Page, line: string): Promise<{ stroke: string, label: string | null, dotted: boolean }> {
    return page.evaluate((line) => {
        const edge = window.__pivotick.graph!.getDrawnEdges().find((e) => `${e.from.id}->${e.to.id}` === line)!
        const group = edge.getGraphElement()!
        const path = group.querySelector('path') as SVGPathElement
        return {
            stroke: getComputedStyle(path).stroke,
            label: group.querySelector('.pvt-edge-label')?.textContent ?? null,
            dotted: getComputedStyle(path).strokeDasharray !== 'none',
        }
    }, line)
}

/** A screen point `fraction` of the way along a drawn edge, and whether a bubble's fill is on top there. */
async function pointAlong(page: Page, edgeId: string, fraction: number): Promise<{ x: number, y: number, onBubble: boolean }> {
    return page.evaluate(([edgeId, fraction]) => {
        const edge = window.__pivotick.graph!.getDrawnEdges().find((e) => e.id === edgeId)!
        const path = edge.getGraphElement()!.querySelector('path') as SVGPathElement
        const p = path.getPointAtLength(path.getTotalLength() * fraction).matrixTransform(path.getScreenCTM()!)
        const onBubble = document.elementFromPoint(p.x, p.y)?.classList.contains('pvt-cluster-area') ?? false
        return { x: p.x, y: p.y, onBubble }
    }, [edgeId, fraction] as const)
}

/** A point on `cluster`'s bubble fill at least 15px from every drawn line. */
async function pointOnBareBubble(page: Page, cluster: string): Promise<{ x: number, y: number }> {
    return page.evaluate((cluster) => {
        const g = window.__pivotick.graph!
        const area = g.getMutableNode(cluster)!.getGraphElement()!.querySelector('.pvt-cluster-area')!
        const box = area.getBoundingClientRect()
        const paths = g.getDrawnEdges().map((e) => e.getGraphElement()!.querySelector('path') as SVGPathElement)
        const nearALine = (x: number, y: number) => paths.some((path) => {
            const ctm = path.getScreenCTM()!
            const width = path.style.strokeWidth
            path.style.strokeWidth = String(30 / Math.hypot(ctm.a, ctm.b))
            const near = path.isPointInStroke(new DOMPoint(x, y).matrixTransform(ctm.inverse()))
            path.style.strokeWidth = width
            return near
        })
        for (let fy = 0.1; fy < 1; fy += 0.1) {
            for (let fx = 0.1; fx < 1; fx += 0.1) {
                const x = box.left + box.width * fx
                const y = box.top + box.height * fy
                if (document.elementFromPoint(x, y) === area && !nearALine(x, y)) return { x, y }
            }
        }
        throw new Error(`no bare spot on ${cluster}'s bubble`)
    }, cluster)
}

/** Start recording hover events on nodes and edges, as `edgeIn:X-b1`, `nodeOut:A`, ... */
async function recordHovers(page: Page): Promise<void> {
    await page.evaluate(() => {
        const log: string[] = []
        ;(window as unknown as { hovers: string[] }).hovers = log
        const interaction = window.__pivotick.graph!.renderer.getGraphInteraction()
        interaction.on('edgeHoverIn', (_event, edge) => log.push(`edgeIn:${edge.id}`))
        interaction.on('edgeHoverOut', (_event, edge) => log.push(`edgeOut:${edge.id}`))
        interaction.on('nodeHoverIn', (_event, node) => log.push(`nodeIn:${node.id}`))
        interaction.on('nodeHoverOut', (_event, node) => log.push(`nodeOut:${node.id}`))
    })
}

/** The hover events since the last call, clearing the record. */
async function takeHovers(page: Page): Promise<string[]> {
    return page.evaluate(() => (window as unknown as { hovers: string[] }).hovers.splice(0))
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
        const point = await pointAlong(page, 'X-b1', 0.75)
        expect(point.onBubble).toBe(true)

        await page.mouse.click(point.x, point.y)
        await expect.poll(() => selectedEdgeId(page)).toBe('X-b1')
    })

    test('a line inside an open bubble takes the hover from the bubble', async ({ page }) => {
        await harness(page, 'expand', ['A', 'B'])
        await expectLines(page, A_B_OPEN)
        await recordHovers(page)

        // Resting on the bubble away from any line hovers the cluster, as before.
        const bare = await pointOnBareBubble(page, 'A')
        await page.mouse.move(bare.x, bare.y)
        await takeHovers(page)

        // Onto the line in one step, so no neighbouring line is crossed on the way: the edge
        // is hovered, and the cluster under it hears nothing.
        const onLine = await pointAlong(page, 'X-b1', 0.75)
        expect(onLine.onBubble).toBe(true)
        await page.mouse.move(onLine.x, onLine.y)
        await expect.poll(() => takeHovers(page)).toEqual(['edgeIn:X-b1'])

        await page.mouse.move(bare.x, bare.y)
        await expect.poll(() => takeHovers(page)).toEqual(['edgeOut:X-b1'])
    })

    test('a folded line for one edge looks like that edge, dotted', async ({ page }) => {
        // `a1→X` is red and labelled in the fixture.
        const red = 'rgb(214, 39, 40)'

        // `A→X` stands for `a1→X` alone, so it takes its colour and label.
        expect(await lineLook(page, 'A->X')).toEqual({ stroke: red, label: 'a1-x', dotted: true })
        // `X→A` stands for four edges, so it has no look of its own to borrow.
        const several = await lineLook(page, 'X->A')
        expect(several.stroke).not.toBe(red)
        expect(several.label).toBeNull()
        expect(several.dotted).toBe(true)

        // Once A is open the real edge is drawn, solid.
        await harness(page, 'expand', ['A'])
        await expectLines(page, A_OPEN)
        expect(await lineLook(page, 'a1->X')).toEqual({ stroke: red, label: 'a1-x', dotted: false })
    })
})

test.describe('edges across clusters, in the sidebar', () => {
    test('selecting a line for several edges says how many it stands for', async ({ page }) => {
        await gotoHarness(page)
        await loadFixture(page, 'nestedClusters', { ...OPTIONS, UI: { mode: 'full', sidebar: { collapsed: false } } })
        await expectLines(page, ALL_CLOSED)
        const subtitle = page.locator('.pvt-mainheader-nodeinfo-subtitle')

        await clickLine(page, 'X->A')
        await expect(subtitle).toHaveText('Stands for 4 edges')

        // A line for one edge is that edge, so the header describes it instead.
        await clickLine(page, 'A->X')
        await expect.poll(() => selectedEdgeId(page)).toBe('a1-X')
        await expect(subtitle).not.toContainText('Stands for')
    })
})

test.describe('edges across clusters, laid out in the worker', () => {
    test('the worker layout draws the same lines', async ({ page }) => {
        // Count workers started, so the test cannot pass on a silent main-thread fallback.
        await page.addInitScript(() => {
            const RealWorker = window.Worker
            const counter = window as unknown as { workersStarted: number }
            counter.workersStarted = 0
            window.Worker = class extends RealWorker {
                constructor(...args: ConstructorParameters<typeof Worker>) {
                    super(...args)
                    counter.workersStarted++
                }
            }
        })
        await gotoHarness(page)
        await loadFixture(page, 'nestedClusters', { ...OPTIONS, simulation: { enabled: true, useWorker: true } })

        await expectLines(page, ALL_CLOSED)
        const workersStarted = await page.evaluate(() => (window as unknown as { workersStarted: number }).workersStarted)
        expect(workersStarted).toBeGreaterThan(0)

        await harness(page, 'expand', ['A', 'B', 'C'])
        await expectLines(page, A_B_C_OPEN)
    })
})
