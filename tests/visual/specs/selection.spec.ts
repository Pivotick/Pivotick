import {
    test,
    expect,
    gotoHarness,
    loadFixture,
    harness,
    nodeEl,
    centerOf,
    canvas,
    expectCanvas,
    ringIsDrawn,
} from '../helpers'
import type { NodeShapePaint } from '../harness/harness'

test.describe('selection', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
        await loadFixture(page, 'basic')
    })

    test('highlights a selected node', async ({ page }) => {
        await harness(page, 'selectNode', 'a')
        await expectCanvas(page, 'node-selected.png')
    })

    // The colour of a node is what says which node it is, so selecting one must not repaint
    // it. The ring is the whole signal — the invariant the screenshot above can only show,
    // not state. Selection used to replace the fill and leave the rim alone.
    test('a selected node keeps its own colour and gains a ring', async ({ page }) => {
        const ringColor = await harness(page, 'themeColor', '--pvt-node-selected-stroke')
        const idle = await harness(page, 'nodeShapePaint', 'a') as NodeShapePaint
        expect(idle.stroke).not.toBe(ringColor)

        await harness(page, 'selectNode', 'a')
        const selected = await harness(page, 'nodeShapePaint', 'a') as NodeShapePaint

        expect(selected.fill).toBe(idle.fill)
        expect(selected.stroke).toBe(ringColor)
        expect(ringIsDrawn(selected)).toBe(true)
    })

    // Selection and highlight both draw a ring now, and they land on the same rim. Whichever
    // arrives second, the node still has to read as selected — highlighting one from a table
    // row or a note link must not look like it was let go of.
    test('a highlighted node that is selected keeps the selection ring', async ({ page }) => {
        const selectedRing = await harness(page, 'themeColor', '--pvt-node-selected-stroke')
        const highlightRing = await harness(page, 'themeColor', '--pvt-node-highlighted-stroke')
        expect(selectedRing).not.toBe(highlightRing)

        // Highlighted alone, the rim is the highlight colour.
        await harness(page, 'highlightNode', 'a')
        const highlighted = await harness(page, 'nodeShapePaint', 'a') as NodeShapePaint
        expect(highlighted.stroke).toBe(highlightRing)

        await harness(page, 'selectNode', 'a')
        const both = await harness(page, 'nodeShapePaint', 'a') as NodeShapePaint
        expect(both.stroke).toBe(selectedRing)
        expect(ringIsDrawn(both)).toBe(true)
    })

    test('highlights a selected edge', async ({ page }) => {
        await harness(page, 'selectEdge', 'a-b')
        await expectCanvas(page, 'edge-selected.png')
    })

    // Selecting an edge deliberately does *not* mark it dirty — a full redraw recreates the
    // label and loses the listeners hung off it — so for a long time nothing applied the
    // class at all and a selected edge looked exactly like an idle one.
    test('a selected edge takes the selection colour, and gives it back', async ({ page }) => {
        const selectionColor = await harness(page, 'themeColor', '--pvt-edge-selected-stroke')
        const idle = await harness(page, 'edgePaint', 'a-b') as NodeShapePaint
        expect(idle.stroke).not.toBe(selectionColor)

        await harness(page, 'selectEdge', 'a-b')
        const selected = await harness(page, 'edgePaint', 'a-b') as NodeShapePaint
        expect(selected.stroke).toBe(selectionColor)
        expect(parseFloat(selected.strokeWidth)).toBeGreaterThan(parseFloat(idle.strokeWidth))

        await harness(page, 'deselectAll')
        expect(await harness(page, 'edgePaint', 'a-b')).toEqual(idle)
    })

    // The end marker swaps to a `_selected` variant, and the swap runs on every render pass
    // now — so it has to resolve from the base id rather than append to whatever is there.
    test('an edge’s end marker swaps to the selected variant and back', async ({ page }) => {
        const idle = await harness(page, 'edgeMarkers', 'a-b')
        expect(idle?.end).toBe('url(#arrow)')

        await harness(page, 'selectEdge', 'a-b')
        expect((await harness(page, 'edgeMarkers', 'a-b'))?.end).toBe('url(#arrow_selected)')

        await harness(page, 'deselectAll')
        expect(await harness(page, 'edgeMarkers', 'a-b')).toEqual(idle)

        // Twice through, because appending rather than resolving only shows up on the second.
        await harness(page, 'selectEdge', 'a-b')
        expect((await harness(page, 'edgeMarkers', 'a-b'))?.end).toBe('url(#arrow_selected)')
    })

    // An edge carries no state animation, so unlike a node nothing overrides a width of 0 —
    // which the dark theme's node-highlight width is, and edges used to borrow it.
    test('a highlighted edge stays visible in both themes', async ({ page }) => {
        for (const theme of ['light', 'dark'] as const) {
            await loadFixture(page, 'basic', { UI: { theme } })
            await harness(page, 'highlightEdge', 'a-b')

            const paint = await harness(page, 'edgePaint', 'a-b') as NodeShapePaint
            expect(parseFloat(paint.strokeWidth), theme).toBeGreaterThan(0)
            expect(paint.filter, theme).toContain('drop-shadow')
        }
    })

    // Same rim, same rule as for nodes: an edge that is both must read as selected.
    test('a highlighted edge that is selected keeps the selection colour', async ({ page }) => {
        const selectionColor = await harness(page, 'themeColor', '--pvt-edge-selected-stroke')
        const highlightColor = await harness(page, 'themeColor', '--pvt-edge-highlighted-stroke')
        expect(selectionColor).not.toBe(highlightColor)

        await harness(page, 'highlightEdge', 'a-b')
        expect((await harness(page, 'edgePaint', 'a-b') as NodeShapePaint).stroke).toBe(highlightColor)

        await harness(page, 'selectEdge', 'a-b')
        expect((await harness(page, 'edgePaint', 'a-b') as NodeShapePaint).stroke).toBe(selectionColor)
    })

    test('clears selection', async ({ page }) => {
        await harness(page, 'selectNode', 'a')
        await harness(page, 'deselectAll')
        await expectCanvas(page, 'selection-cleared.png')
    })

    // ── Area 6 — multi-selection & selection tools ──────────────────────────────
    // Multi-select state is set through the harness (the deterministic equivalent
    // of shift-clicking — same `selectNodes` path); the rubber-band, lasso and
    // group-drag are driven with *real* pointer events because their visual is the
    // live interaction, not just the resulting state. The box and lasso commit their
    // selection only on mouse *release*, so each snapshots the overlay mid-drag and
    // then releases to verify (and, for the lasso, show) the nodes it selected.
    //
    // Every Area 6 test `pin()`s the fixture's designed positions first. The other
    // selection tests above ride the settled force layout, which drifts a couple of
    // percent under parallel-run CPU contention — fine at their tolerance, but these
    // scenes pin so the baselines are an exact function of the fixture (matching the
    // styling/layout areas).

    // T6.1 — two nodes highlighted at once; with focus mode on, the nodes adjacent
    // to neither selected node (d, e) and their edges dim out.
    test('highlights multiple selected nodes', async ({ page }) => {
        await harness(page, 'pin')
        await harness(page, 'multiSelect', ['b', 'hub'])
        await expectCanvas(page, 'multi-select.png')
    })

    // T6.2 — Shift+left-drag draws the rubber-band selection box. A plain drag is a
    // no-op (it would pan); Shift filters out the zoom and puts SelectionBox in
    // "add" mode. Snapshot the rectangle *before* mouseup, which clears it.
    test('draws the selection box mid-drag and selects enclosed nodes', async ({ page }) => {
        await harness(page, 'pin')

        // Size the box from the live node positions so it provably encloses two
        // nodes (b and c). They must have non-zero x/y: `getNodesInRect` skips any
        // node with a falsy x or y, so the x=0 nodes (a, hub) can't be box-selected.
        const b = await centerOf(nodeEl(page, 'b'))
        const c = await centerOf(nodeEl(page, 'c'))
        const startX = Math.min(b.x, c.x) - 70
        const startY = Math.min(b.y, c.y) - 70
        const endX = Math.max(b.x, c.x) + 70
        const endY = Math.max(b.y, c.y) + 70

        await page.keyboard.down('Shift')
        await page.mouse.move(startX, startY)
        await page.mouse.down()
        await page.mouse.move(endX, endY, { steps: 12 })

        await expect(canvas(page).locator('.pvt-selection-rectangle')).toBeVisible()
        await expectCanvas(page, 'selection-box.png')

        // Releasing commits the selection — the box covered at least two nodes.
        await page.mouse.up()
        await page.keyboard.up('Shift')
        const selected = (await harness(page, 'selectedNodeIds')) as string[]
        expect(selected.length).toBeGreaterThanOrEqual(2)
    })

    // T6.3 — lasso mode: a left-drag traces an open polygon (the loop only closes +
    // selects on pointerup). Enabling lasso also stops the drag from panning. We
    // snapshot the open polygon mid-drag, then release and snapshot the result so
    // the selected node is actually visible (it isn't, mid-drag — nothing's selected
    // until release).
    test('draws the lasso polygon, then selects the enclosed node on release', async ({ page }) => {
        await harness(page, 'pin')
        await harness(page, 'enableLasso')

        // Trace a polygon around hub (the central node). The press starts up-left of
        // it, on empty canvas.
        const hub = await centerOf(nodeEl(page, 'hub'))
        await page.mouse.move(hub.x - 180, hub.y - 150)
        await page.mouse.down()
        await page.mouse.move(hub.x + 180, hub.y - 120, { steps: 8 })
        await page.mouse.move(hub.x + 150, hub.y + 170, { steps: 8 })
        await page.mouse.move(hub.x - 160, hub.y + 140, { steps: 8 })

        // Mid-drag the polygon is still open; nothing is selected yet.
        await expect(canvas(page).locator('.pvt-lasso-overlay polyline')).toBeVisible()
        await expectCanvas(page, 'lasso.png')

        // Release: the loop closes and the nodes whose centres it encloses are
        // selected — here hub, shown highlighted with the rest dimmed by focus mode.
        await page.mouse.up()
        const selected = (await harness(page, 'selectedNodeIds')) as string[]
        expect(selected).toContain('hub')
        await expectCanvas(page, 'lasso-selected.png')
    })

    // T6.4 — focus-mode dimming on a single selection: b is selected, its neighbours
    // a/c stay lit, and the non-adjacent d/e/hub get the `-highlight-shadow` class.
    test('dims non-adjacent nodes in focus mode', async ({ page }) => {
        await harness(page, 'pin')
        await harness(page, 'selectNode', 'b')

        // Focus mode tags each node's <g> with a CSS class; read it back to assert
        // the dim state explicitly (not just visually). `isSelected` = the selected
        // node's own highlight; `isDimmed` = the faded "shadow" applied to nodes
        // adjacent to nothing selected.
        const classesOf = (id: string) =>
            page.evaluate((i) => Array.from(document.getElementById('node-' + i)?.classList ?? []), id)
        const isSelected = async (id: string) => (await classesOf(id)).includes('pvt-node-selected-highlight')
        const isDimmed = async (id: string) => (await classesOf(id)).includes('pvt-node-selected-highlight-shadow')

        // b is the selected node, so it's highlighted and never dimmed.
        expect(await isSelected('b')).toBe(true)
        expect(await isDimmed('b')).toBe(false)
        // a and c share an edge with b, so they stay lit.
        expect(await isDimmed('a')).toBe(false)
        expect(await isDimmed('c')).toBe(false)
        // d, e and hub are adjacent to neither selected node, so they're dimmed.
        expect(await isDimmed('d')).toBe(true)
        expect(await isDimmed('e')).toBe(true)
        expect(await isDimmed('hub')).toBe(true)

        await expectCanvas(page, 'focus-mode-dim.png')
    })

    // T6.5 — dragging one node of a multi-selection moves the whole selection by the
    // same delta; an unselected node stays put.
    test('moves the whole selection when one selected node is dragged', async ({ page }) => {
        type Positions = Record<string, { x: number; y: number }>
        // Pin every node first: dragging a node restarts the force pass, which would
        // otherwise drift the *un*selected nodes (and add force noise to the dragged
        // ones). Pinned, only the dragged selection moves — and by an exact delta.
        await harness(page, 'pin')
        await harness(page, 'multiSelect', ['a', 'b'])
        const before = (await harness(page, 'nodePositions')) as Positions

        const start = await centerOf(nodeEl(page, 'b'))
        await page.mouse.move(start.x, start.y)
        await page.mouse.down()
        await page.mouse.move(start.x + 130, start.y + 90, { steps: 12 })
        await page.mouse.up()

        const after = (await harness(page, 'nodePositions')) as Positions
        // How far each node moved (graph units).
        const moved = (id: string) => Math.hypot(after[id].x - before[id].x, after[id].y - before[id].y)

        // The grabbed node really moved — this guards against a no-op drag, which
        // would otherwise pass the "same delta" check trivially (0 ≈ 0).
        expect(moved('b')).toBeGreaterThan(20)
        // The *other* selected node moved by the same vector — i.e. they travelled
        // together, which is the whole point of a multi-node drag.
        expect(after.a.x - before.a.x).toBeCloseTo(after.b.x - before.b.x, 2)
        expect(after.a.y - before.a.y).toBeCloseTo(after.b.y - before.b.y, 2)
        // The unselected node didn't move at all.
        expect(moved('hub')).toBeLessThan(0.5)

        await expectCanvas(page, 'multi-node-drag.png')
    })
})
