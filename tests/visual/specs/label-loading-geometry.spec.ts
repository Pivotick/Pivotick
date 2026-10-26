import { test, expect, gotoHarness } from '../helpers'

/**
 * Firefox returns an empty text getBBox() inside a display:none zoom layer.
 * A floated group label then gets an 8x4 background at the node's centre until
 * another render. Exercise the real initial measurement, before opening a group,
 * pinning positions, or changing zoom can hide the failure with a redraw.
 */
test('packed label backgrounds are measured correctly during loading', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await gotoHarness(page)

    const result = await page.evaluate(async () => {
        const { Pivotick, Node, Edge } = await import('/src/index.ts')
        const measurements: { width: number, height: number, loading: boolean, invisible: boolean }[] = []
        const getBBox = SVGGraphicsElement.prototype.getBBox
        let graph: InstanceType<typeof Pivotick> | undefined

        // Observe native browser geometry; do not replace it with mocked boxes.
        SVGGraphicsElement.prototype.getBBox = function(...args) {
            const box = getBBox.apply(this, args)
            if (this.matches('.pvt-node-label') && this.textContent === '297 × message') {
                const layer = this.closest('.zoom-layer')!
                const style = getComputedStyle(layer)
                measurements.push({
                    width: box.width,
                    height: box.height,
                    loading: layer.classList.contains('hidden'),
                    invisible: style.display === 'none' || style.visibility === 'hidden',
                })
            }
            return box
        }

        try {
            const root = new Node('root', { type: 'user-account' }, { color: '#4dffff', size: 5 })
            const leaves = Array.from({ length: 297 }, (_, i) => new Node(`message-${i}`, { type: 'message' }, { color: '#4dffff', size: 5 }))
            const edges = leaves.map((node, i) => new Edge(`edge-${i}`, root, node, {}, {}, false))
            graph = new Pivotick(document.getElementById('app')!, { nodes: [root, ...leaves], edges }, {
                render: { minZoom: 1, maxZoom: 1, zoomAnimation: false, minLabelFontSize: 0 },
                simulation: { enabled: false, useWorker: false, warmupTicks: 0 },
                UI: { mode: 'viewer', simplify: { typeOf: node => node.getData().type as string, rules: [{ kind: 'neighbours', minSize: 10 }] } },
            })
            await new Promise<void>(resolve => graph!.on('ready', resolve))
            SVGGraphicsElement.prototype.getBBox = getBBox

            const group = graph.simplify.getGroupNode(graph.simplify.getGroups()[0].id)!
            const label = group.getGraphElement()!.querySelector('.pvt-node-label-group')!
            const text = label.querySelector('text')!.getBBox()
            const rect = label.querySelector('rect')!
            return {
                measurements,
                text: { x: text.x, y: text.y, width: text.width, height: text.height },
                rect: { x: +rect.getAttribute('x')!, y: +rect.getAttribute('y')!, width: +rect.getAttribute('width')!, height: +rect.getAttribute('height')! },
                count: group.info.members.length,
                open: group.info.open,
                nodes: graph.getNodeCount(),
                edges: graph.getEdgeCount(),
            }
        } finally {
            SVGGraphicsElement.prototype.getBBox = getBBox
            graph?.destroy()
        }
    })

    const initial = result.measurements.find(measurement => measurement.loading)
    expect(initial, 'measure the label while the graph is still loading').toBeDefined()
    expect(initial!.invisible, 'the loading graph must remain invisible').toBe(true)
    expect(initial!.width, JSON.stringify(result)).toBeGreaterThan(0)
    expect(initial!.height, JSON.stringify(result)).toBeGreaterThan(0)
    expect(result.rect.x).toBeCloseTo(result.text.x - 4, 1)
    expect(result.rect.y).toBeCloseTo(result.text.y - 2, 1)
    expect(result.rect.width).toBeCloseTo(result.text.width + 8, 1)
    expect(result.rect.height).toBeCloseTo(result.text.height + 4, 1)
    expect(result).toMatchObject({ count: 297, open: false, nodes: 298, edges: 297 })
    expect(errors).toEqual([])
})
