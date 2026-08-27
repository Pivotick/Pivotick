import { test, expect, gotoHarness, harness, ringIsDrawn } from '../helpers'
import type { Page } from '@playwright/test'
import type { NodeShapePaint, NodeVisual } from '../harness/harness'
import { ROUNDED_CARD_RADIUS } from '../harness/sceneConstants'

/**
 * Custom HTML nodes: a card declared as `NodeStyle.html`, and what `shape: 'none'` adds.
 *
 * The scene (`loadCustomHtmlNodes`) declares every card through `nodeStyleMap`, so it also
 * stands as the proof that a card resolves through the ordinary style chain — the reason
 * `renderNode`, which is global and replaces the chain, is not the only way in.
 *
 * These mostly assert numbers rather than pixels: what a card is *worth* is the box it ends
 * up with, and at the threshold this suite compares at, a card that measured and one that
 * was squeezed into its placeholder differ by too little purple to fail on. The one
 * exception is the selected look, where the picture *is* the claim.
 */
async function visual(page: Page, id: string): Promise<NodeVisual> {
    const found = (await harness(page, 'nodeVisual', id)) as NodeVisual | null
    expect(found, `no node rendered for ${id}`).not.toBeNull()
    return found as NodeVisual
}

test.describe('custom HTML nodes', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
        await harness(page, 'loadCustomHtmlNodes')
    })

    // The bug this whole thing started from: a card whose root is `width: 100%` used to
    // resolve that against the placeholder box the renderer had just guessed, report the
    // guess back as its size, and leave the real content squeezed into it.
    test('a card that fills its box still measures its content', async ({ page }) => {
        const card = await visual(page, 'stretchCard')

        expect(card.cardBox).toEqual({ width: 260, height: 60 })
        // Measured in the shell the renderer owns, which is what makes that possible.
        expect(card.cardShelled).toBe(true)
    })

    test('a self-sizing card measures the same way', async ({ page }) => {
        const card = await visual(page, 'shapelessCard')

        expect(card.cardBox).toEqual({ width: 200, height: 50 })
    })

    // A string is half of both signatures and never measured: `fo.text()` left no element
    // child, so the card stayed at its placeholder size for good.
    test('a card returned as a string measures too', async ({ page }) => {
        const card = await visual(page, 'stringCard')

        expect(card.cardShelled).toBe(true)
        expect(card.cardBox?.width).toBeGreaterThan(0)
        // Text is narrower than the 76px placeholder it used to be stuck at, so a card
        // that measured is one that *shrank*.
        expect(card.cardBox?.height).toBeLessThan(76)
    })

    test("shape: 'none' draws no visible shape", async ({ page }) => {
        const shapeless = await visual(page, 'shapelessCard')
        const shaped = await visual(page, 'shapedCard')

        // A box is still there — it is what selection, hover and the pointer land on —
        // but painted in nothing. `transparent`, not `none`, which is not hit-testable.
        expect(shapeless.shapeTag).toBe('rect')
        expect(shapeless.shapeFill).toBe('transparent')
        // …where a shaped card keeps its hexagon, drawn in its colour, behind the card.
        expect(shaped.shapeTag).toBe('path')
        expect(shaped.shapeFill).not.toBe('transparent')
    })

    test("shape: 'none' hands the node's geometry to the card", async ({ page }) => {
        const shapeless = await visual(page, 'shapelessCard')

        // 200×50 card, `size: 38`. The card owns both, so the radius is half its longest
        // side and the border is the card — not the 38 the style map asked for.
        expect(shapeless.radius).toBe(100)
        expect(shapeless.borderBox).toEqual({ width: 200, height: 50 })
    })

    test('a shape behind the card is still the floor for it', async ({ page }) => {
        const shaped = await visual(page, 'shapedCard')

        // Same 200×50 card, but `size: 38` is a visible hexagon: the node can never be
        // smaller than what is still drawn, so the height is floored at 2 × 38.
        expect(shaped.radius).toBe(100)
        expect(shaped.borderBox).toEqual({ width: 200, height: 76 })
    })

    // The card follows the content, and so must the invisible box under it — otherwise the
    // hover ring and the selection glow stay pinned to the placeholder.
    test('the hit box follows the measured card', async ({ page }) => {
        const shapeless = await visual(page, 'shapelessCard')

        expect(shapeless.shapeBox).toEqual({ width: 200, height: 50 })
    })

    test("shape: 'none' with no card is invisible but still there", async ({ page }) => {
        const empty = await visual(page, 'shapelessEmpty')

        expect(empty.cardBox).toBeNull()
        expect(empty.shapeTag).toBe('rect')
        expect(empty.shapeFill).toBe('transparent')
        // At 2 × size, so there is something to click even with nothing drawn.
        expect(empty.shapeBox).toEqual({ width: 48, height: 48 })
    })

    test('an invisible node can still be selected by clicking it', async ({ page }) => {
        await page.locator('#node-shapelessEmpty').click({ force: true })

        expect(await harness(page, 'selectedNodeIds')).toEqual(['shapelessEmpty'])
    })

    // The point of keeping a box under the card: both state looks are `> .node` child
    // rules, so without one a card had no selected look at all. Asserted on the resolved
    // paint rather than on pixels — a screenshot here would be at the mercy of whatever
    // zoom the initial fit chose for the scene.
    test('the selected look reaches a card-only node', async ({ page }) => {
        const card = page.locator('#node-shapelessCard')
        const unselected = await harness(page, 'nodeShapePaint', 'shapelessCard') as NodeShapePaint

        // Idle, the box is drawn in nothing at all.
        expect(unselected.fill).toBe('rgba(0, 0, 0, 0)')
        expect(unselected.stroke).toBe('none')
        expect(unselected.filter).toBe('none')

        await card.click({ force: true })
        await expect(card).toHaveClass(/pvt-node-selected-highlight/)

        const selected = await harness(page, 'nodeShapePaint', 'shapelessCard') as NodeShapePaint
        // Selected, the box rings the card and glows. The fill stays out of it: the box is
        // behind an opaque card, so a fill would be invisible there anyway — the ring is
        // what clears the card's edge.
        expect(selected.fill).toBe(unselected.fill)
        expect(ringIsDrawn(selected)).toBe(true)
        expect(selected.filter).toContain('drop-shadow')
    })

    // The backing box carries the ring, but the badge rim and the pointer hit area are
    // measured off the very same box — so it has to stay exactly the card's size.
    test('the ring does not push the box off the card', async ({ page }) => {
        const shapeless = await visual(page, 'shapelessCard')

        expect(shapeless.shapeBox).toEqual(shapeless.cardBox)
    })

    // A sharp ring around a rounded card reads as a mistake, and the library cannot know the
    // radius an author chose — so the box reads it back off the card.
    test('the ring follows the card’s rounded corners', async ({ page }) => {
        const rounded = await visual(page, 'roundedCard')
        const square = await visual(page, 'shapelessCard')

        expect(rounded.shapeRx).toBe(ROUNDED_CARD_RADIUS)
        expect(square.shapeRx).toBe(0)
    })

    // `shape` and `text` are separate channels, so a card can carry a label beside it —
    // and a card that does not want one sets `text: ''`.
    test('a card and a label are independent', async ({ page }) => {
        const both = await visual(page, 'cardAndLabel')

        expect(both.cardBox).toEqual({ width: 200, height: 50 })
        expect(both.label).toBe('beside the card')
    })

    // A label-only node is the other thing `shape: 'none'` buys, and it only works if the
    // label is readable: `textColor` defaults to white, which on a shapeless node is drawn
    // straight onto the canvas.
    test("a label on a shapeless node is drawn to be readable", async ({ page }) => {
        const bare = await visual(page, 'labelOnly')
        const shaped = await visual(page, 'plain')

        expect(bare.label).toBe('label only')
        // The themed label colour, on the same pill a floated label gets…
        expect(bare.labelFill).toContain('--pvt-edge-label-color')
        expect(bare.labelPilled).toBe(true)
        // …where a label sitting on a shape still uses the node's own text colour.
        expect(shaped.labelFill).toContain('--pvt-node-text-color')
        expect(shaped.labelPilled).toBe(false)
    })

    // Returning nothing has to mean "not this one", or a callback cannot card some nodes
    // and leave the rest alone.
    test('an html callback that returns nothing leaves the node its shape', async ({ page }) => {
        const declined = await visual(page, 'declined')
        const plain = await visual(page, 'plain')

        expect(declined.cardBox).toBeNull()
        // Styled exactly like the node beside it that never asked for a card.
        expect(declined.shapeTag).toBe(plain.shapeTag)
        expect(declined.shapeFill).toBe(plain.shapeFill)
        expect(declined.radius).toBe(plain.radius)
    })
})

test.describe('renderNode', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
        await harness(page, 'loadCustomHtmlNodes', { renderNode: true })
    })

    // Its signature has always said `| void`, but a void return used to leave an empty
    // 20×20 foreignObject rather than falling through — so the callback was all-or-nothing
    // and shut out `nodeTypeAccessor` for the whole graph.
    test('returning nothing falls through to the style map', async ({ page }) => {
        const declined = await visual(page, 'plain')

        expect(declined.cardBox).toBeNull()
        expect(declined.shapeTag).toBe('path')
        expect(declined.radius).toBe(30)
    })

    test('the node it does card is the card', async ({ page }) => {
        const carded = await visual(page, 'stretchCard')

        expect(carded.cardBox).toEqual({ width: 260, height: 60 })
        // No shape of its own — but the invisible box is there, so selection and hover
        // have something to paint, which a renderNode card never used to.
        expect(carded.shapeTag).toBe('rect')
        expect(carded.shapeFill).toBe('transparent')
        expect(carded.shapeBox).toEqual({ width: 260, height: 60 })
    })
})
