/**
 * Where edges meet nodes.
 *
 * These assertions are numeric, not screenshots: an edge endpoint moves by a few
 * pixels, which a pixel diff at this suite's threshold will not notice. Each case
 * reads the drawn path's own endpoint out of the `d` attribute and compares it
 * against the box the node *actually rendered* — measured from the DOM, so the
 * expectation never leans on the same maths the library used to place it.
 *
 * The matrix covers every node shape (including HTML-in-SVG cards, the usual way
 * an integration styles a node) crossed with every kind of edge the router can
 * draw: straight, curved, and self-loop.
 */
import { expect, gotoHarness, test } from '../helpers'
import type { AnchorProbe, AnchorSubject } from '../harness/harness'

/**
 * Shapes whose border is a rectangle: an edge must stop on that rectangle.
 * `square` and `customPath` are drawn as one; `frameImage` becomes one once the
 * picture's aspect ratio is known; the two card subjects are HTML boxes.
 */
const RECTANGULAR: AnchorSubject[] = ['square', 'customPath', 'frameImage', 'htmlCard', 'renderNodeCard']

/**
 * Shapes deliberately left on their circle radius. A bounding box is a worse fit
 * than a circle for these — on the diagonals it sits well outside the drawn
 * shape. `htmlSmallCard` is here because its card is *inside* the shape drawn
 * behind it, so the shape still decides where edges land.
 */
const ROUND: AnchorSubject[] = ['circle', 'triangle', 'hexagon', 'htmlSmallCard']

/** Subjects much wider than they are tall — where a circle is most obviously wrong. */
const ELONGATED: AnchorSubject[] = ['customPath', 'frameImage', 'htmlCard', 'renderNodeCard']

/**
 * The edge is drawn a few px clear of the border so an arrowhead has room:
 * `drawOffset*` is 4–8, and a curved edge crossing near a corner can sit up to
 * √2× further out. Anything past this band is a node whose border was guessed.
 */
const MIN_GAP = 0
const MAX_GAP = 12

/** Half-extents of everything the node actually draws — shape and card together. */
function drawnHalfExtents(probe: AnchorProbe): { halfWidth: number; halfHeight: number } {
    return {
        halfWidth: Math.max((probe.shapeBox?.width ?? 0) / 2, (probe.cardBox?.width ?? 0) / 2),
        halfHeight: Math.max((probe.shapeBox?.height ?? 0) / 2, (probe.cardBox?.height ?? 0) / 2),
    }
}

/**
 * How far outside a centred rectangle a point sits, 0 on the border and negative
 * inside it. The plain rectangle distance function — no library code involved.
 */
function gapOutsideRectangle(probe: AnchorProbe): number {
    const { halfWidth, halfHeight } = drawnHalfExtents(probe)
    const overshootX = Math.abs(probe.anchor.x - probe.center.x) - halfWidth
    const overshootY = Math.abs(probe.anchor.y - probe.center.y) - halfHeight
    if (overshootX <= 0 && overshootY <= 0) return Math.max(overshootX, overshootY)
    return Math.hypot(Math.max(overshootX, 0), Math.max(overshootY, 0))
}

/** How far outside the node's circle a point sits. */
function gapOutsideCircle(probe: AnchorProbe): number {
    const distance = Math.hypot(probe.anchor.x - probe.center.x, probe.anchor.y - probe.center.y)
    return distance - probe.circleRadius
}

function distanceFromCentre(probe: AnchorProbe): number {
    return Math.hypot(probe.anchor.x - probe.center.x, probe.anchor.y - probe.center.y)
}

function probesFor(probes: AnchorProbe[], subject: AnchorSubject): AnchorProbe[] {
    const matching = probes.filter((probe) => probe.subject === subject)
    expect(matching, `no probes captured for ${subject}`).not.toHaveLength(0)
    return matching
}

/** `subject|east`, `subject|diag`, … — one specific edge end. */
function probeForEdge(probes: AnchorProbe[], subject: AnchorSubject, edge: string): AnchorProbe {
    const match = probes.find((probe) => probe.edgeId === `${subject}|${edge}` && probe.end === 'from')
    expect(match, `no ${edge} probe for ${subject}`).toBeTruthy()
    return match as AnchorProbe
}

async function loadMatrix(page: Parameters<typeof gotoHarness>[0], subject: AnchorSubject): Promise<AnchorProbe[]> {
    await gotoHarness(page)
    const mode = subject === 'renderNodeCard' ? 'renderNode' : 'shapes'
    await page.evaluate((m) => window.__pivotick.loadAnchorMatrix(m as 'shapes' | 'renderNode'), mode)
    return page.evaluate(() => window.__pivotick.probeAnchors())
}

test.describe('edge anchoring', () => {

    for (const subject of RECTANGULAR) {
        test(`every kind of edge stops on ${subject}'s drawn border`, async ({ page }) => {
            const probes = await loadMatrix(page, subject)

            for (const probe of probesFor(probes, subject)) {
                const gap = gapOutsideRectangle(probe)
                const where = `${probe.edgeId} (${probe.kind}, ${probe.end} end)`
                // Inside the border means the edge is drawn over the node.
                expect(gap, `${where} cuts into the node`).toBeGreaterThanOrEqual(MIN_GAP)
                // Far outside means the border was approximated by a circle.
                expect(gap, `${where} floats off the node`).toBeLessThanOrEqual(MAX_GAP)
            }
        })
    }

    for (const subject of ROUND) {
        test(`${subject} keeps anchoring on its circle`, async ({ page }) => {
            const probes = await loadMatrix(page, subject)
            const captured = probesFor(probes, subject)

            // A round shape must never be handed a rectangular border: its box is a
            // worse fit than its radius.
            expect(captured[0].borderBox, `${subject} was given a rectangular border`).toBeNull()

            for (const probe of captured) {
                const gap = gapOutsideCircle(probe)
                const where = `${probe.edgeId} (${probe.kind})`
                expect(gap, `${where} cuts into the node`).toBeGreaterThanOrEqual(MIN_GAP)
                expect(gap, `${where} floats off the node`).toBeLessThanOrEqual(MAX_GAP)
            }
        })
    }

    for (const subject of ELONGATED) {
        test(`${subject} anchors closer on its short side than its long one`, async ({ page }) => {
            const probes = await loadMatrix(page, subject)

            // Straight out along the long axis, versus straight out at 45° where a
            // wide box's border is much nearer. A bounding circle would put both at
            // the same distance, so this is the assertion a circle cannot pass.
            const alongLongAxis = distanceFromCentre(probeForEdge(probes, subject, 'east'))
            const acrossTheCorner = distanceFromCentre(probeForEdge(probes, subject, 'diag'))

            expect(
                acrossTheCorner,
                `${subject}: diagonal anchor ${acrossTheCorner.toFixed(1)} vs long-axis ${alongLongAxis.toFixed(1)} — `
                + 'these being equal means the node was treated as a circle'
            ).toBeLessThan(alongLongAxis * 0.7)
        })
    }

    for (const subject of [...RECTANGULAR, ...ROUND]) {
        test(`straight, curved and self-loop edges agree on ${subject}'s border`, async ({ page }) => {
            const probes = await loadMatrix(page, subject)
            const isRound = ROUND.includes(subject)
            const gapOf = isRound ? gapOutsideCircle : gapOutsideRectangle

            const byKind = new Map<string, number[]>()
            for (const probe of probesFor(probes, subject)) {
                byKind.set(probe.kind, [...(byKind.get(probe.kind) ?? []), gapOf(probe)])
            }
            // All three kinds must actually be exercised, or the comparison is empty.
            expect([...byKind.keys()].sort()).toEqual(['curved', 'selfLoop', 'straight'])

            const gaps = [...byKind.values()].flat()
            const spread = Math.max(...gaps) - Math.min(...gaps)
            const summary = [...byKind.entries()]
                .map(([kind, values]) => `${kind}=${values.map((v) => v.toFixed(1)).join(',')}`)
                .join(' ')
            expect(spread, `${subject} anchors inconsistently by edge kind: ${summary}`).toBeLessThan(8)
        })
    }

    test('an HTML card drives the size the rest of the graph sees', async ({ page }) => {
        const probes = await loadMatrix(page, 'htmlCard')
        const card = probesFor(probes, 'htmlCard')[0]

        // The foreignObject grew from its `2 × size` placeholder to the real card…
        expect(card.cardBox).toEqual({ width: 180, height: 60 })
        // …the border followed it…
        expect(card.borderBox).toEqual({ halfWidth: 90, halfHeight: 30 })
        // …and so did the radius collision and charge are driven by.
        expect(card.circleRadius).toBe(90)
    })

    test('a card smaller than its shape leaves the node alone', async ({ page }) => {
        const probes = await loadMatrix(page, 'htmlSmallCard')
        const card = probesFor(probes, 'htmlSmallCard')[0]

        // The card is still sized to its content, so it is not clipped …
        expect(card.cardBox).toEqual({ width: 100, height: 40 })
        // … but the circle drawn behind it is bigger, so that is what edges meet.
        expect(card.borderBox).toBeNull()
        expect(card.circleRadius).toBe(60)
    })

    test('a note connector lands on a card, not on its bounding circle', async ({ page }) => {
        await gotoHarness(page)
        const probe = await page.evaluate(async () => {
            await window.__pivotick.loadAnchorMatrix('shapes')
            window.__pivotick.addNote({
                id: 'attached',
                x: 600, y: 3500, width: 160, height: 80,
                content: 'note',
                attachedElement: { type: 'node', id: 'htmlCard' },
            })
            return window.__pivotick.probeNoteConnector('attached')
        })

        expect(probe, 'no note connector was drawn').toBeTruthy()
        const { anchor, center } = probe as { anchor: { x: number; y: number }; center: { x: number; y: number } }
        // The card is 180×60, so its border is 30px away vertically and 90 across.
        // A bounding circle would hold the connector 90px off on every side.
        const overshootX = Math.abs(anchor.x - center.x) - 90
        const overshootY = Math.abs(anchor.y - center.y) - 30
        const gap = overshootX <= 0 && overshootY <= 0
            ? Math.max(overshootX, overshootY)
            : Math.hypot(Math.max(overshootX, 0), Math.max(overshootY, 0))
        expect(gap).toBeGreaterThanOrEqual(MIN_GAP)
        expect(gap).toBeLessThanOrEqual(MAX_GAP)
    })

    test('a card added while zoomed is still measured at its own size', async ({ page }) => {
        await gotoHarness(page)
        const measured = await page.evaluate(async () => {
            await window.__pivotick.loadAnchorMatrix('renderNode')
            return window.__pivotick.addCardWhileZoomed('late-card', 2.5)
        })

        // The card is measured in screen pixels, so at 2.5× it reads back 450×150.
        // Storing that would make the node — and every edge meeting it — 2.5× too big.
        expect(measured.zoom).toBeGreaterThan(1)
        expect(measured.cardBox).toEqual({ width: 180, height: 60 })
    })

    test('re-drawing edges resolves no node styles', async ({ page }) => {
        await gotoHarness(page)
        const perTick = await page.evaluate(async () => {
            await window.__pivotick.loadAnchorMatrix('shapes')
            return window.__pivotick.countStyleResolvesPerTick(30)
        })

        // Anchoring reads geometry the node already cached. Resolving a style per
        // edge end per frame would also call the integration's own style callbacks
        // 60 times a second, so this has to stay exactly 0.
        expect(perTick).toBe(0)
    })
})
