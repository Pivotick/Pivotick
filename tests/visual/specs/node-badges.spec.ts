import { test, expect, gotoHarness, harness, loadFixture, expectCanvas, nodeEl } from '../helpers'
import type { Page } from '@playwright/test'
import type { BadgeHarnessSpec, NodeBadgeSnapshot, NodeRimBox } from '../harness/harness'

/**
 * Node badges (prd/misp/node-badges.md): small indicators pinned to a node's rim, in a
 * decoration channel of their own so a node can carry a fact that colour, shape, size,
 * icon and picture are already spent on.
 *
 * Two properties carry most of these tests. First, a badge is **glued to the shape**, not
 * to a number resolved once at draw time — framed pictures, custom paths and measured HTML
 * cards all learn their real size a frame or a network round-trip later, so every one of
 * them is checked against the box the node actually ended up with. Second, badges are
 * **hit-testable without stealing anything**: an inert one lets its click through to the
 * node, and one with a handler consumes it — proved by what ends up selected.
 *
 * Placement is asserted as a *relation* to the node's own drawn geometry (inside the
 * bounding-box corner for a circle, outside it for a square) rather than against numbers
 * copied from the drawer, so these tests can still fail if the drawer's maths changes.
 */

/* ---------- readers ---------- */

async function badgesOn(page: Page, id: string): Promise<NodeBadgeSnapshot[]> {
    return (await harness(page, 'nodeBadges', id)) as NodeBadgeSnapshot[]
}

/** Just the text each badge wears, in DOM order — the quickest shape of "what got drawn". */
async function badgeTexts(page: Page, id: string): Promise<string[]> {
    return (await badgesOn(page, id)).map((badge) => badge.text)
}

/** Which corners a node's badges landed in, in DOM order. */
async function badgeCorners(page: Page, id: string): Promise<string[]> {
    return (await badgesOn(page, id)).map((badge) => badge.position)
}

/** How far the node's own drawn shape reaches — what placement is judged against. */
async function rimBox(page: Page, id: string): Promise<NodeRimBox> {
    return (await harness(page, 'nodeRimBox', id)) as NodeRimBox
}

async function iconAnchor(page: Page, id: string): Promise<{ x: number, y: number } | null> {
    return (await harness(page, 'nodeIconAnchor', id)) as { x: number, y: number } | null
}

async function clickLog(page: Page): Promise<string[]> {
    return (await harness(page, 'badgeClickLog')) as string[]
}

async function selected(page: Page): Promise<string[]> {
    return (await harness(page, 'selectedNodeIds')) as string[]
}

/* ---------- helpers ---------- */

async function loadBadges(page: Page, spec: BadgeHarnessSpec = {}): Promise<void> {
    await page.evaluate((s) => window.__pivotick.loadBadges(s), spec)
    await page.locator('.pvt-node-badge').first().waitFor({ state: 'attached' })
}

/** Distance from the node's centre to the badge's centre. */
function reach(badge: NodeBadgeSnapshot): number {
    return Math.hypot(badge.cx, badge.cy)
}

/** Does the badge sit beyond the corner of the node's bounding box? */
function beyondBoxCorner(badge: NodeBadgeSnapshot, box: NodeRimBox): boolean {
    return Math.abs(badge.cx) > box.hx && Math.abs(badge.cy) > box.hy
}

/** Click a badge by the text it wears. */
async function clickBadge(page: Page, id: string, text: string): Promise<void> {
    await nodeEl(page, id)
        .locator('.pvt-node-badge')
        .filter({ has: page.locator(`text="${text}"`) })
        .first()
        .click()
}

/* ---------- placement ---------- */

test.describe('placement', () => {
    test('auto-fills free corners clockwise from the top-right', async ({ page }) => {
        await gotoHarness(page)
        await loadBadges(page)

        expect(await badgeCorners(page, 'circle')).toEqual(['ne', 'se'])
        expect(await badgeTexts(page, 'circle')).toEqual(['3', '7'])
    })

    test('reserves both East corners on a node with children', async ({ page }) => {
        await gotoHarness(page)
        await loadBadges(page)

        // The expand affordance sits 'ne' collapsed and 'se' expanded, so it owns both for
        // the node's whole life — otherwise every badge would jump corners on expand.
        expect(await badgeCorners(page, 'cluster')).toEqual(['sw', 'nw'])
        expect(await badgeCorners(page, 'sqcluster')).toEqual(['sw'])
    })

    test('honours an explicit corner even when two badges ask for the same one', async ({ page }) => {
        await gotoHarness(page)
        await loadBadges(page)

        const [first, second] = await badgesOn(page, 'explicit')
        expect([first.position, second.position]).toEqual(['nw', 'nw'])
        expect({ x: first.cx, y: first.cy }).toEqual({ x: second.cx, y: second.cy })
    })
})

/* ---------- rim geometry ---------- */

test.describe('rim geometry', () => {
    test('a round node keeps its badge inside the bounding-box corner', async ({ page }) => {
        await gotoHarness(page)
        await loadBadges(page)

        const box = await rimBox(page, 'circle')
        const [badge] = await badgesOn(page, 'circle')

        expect(box.round).toBe(true)
        // A circle meets the 45° ray short of its box, so pinning to the corner would leave
        // the badge floating in space beside the node.
        expect(Math.abs(badge.cx)).toBeLessThan(box.hx)
        expect(reach(badge)).toBeCloseTo(box.hx + 2, 1)
    })

    test('a square puts its badge on the actual corner, further out than a circle of the same size', async ({ page }) => {
        await gotoHarness(page)
        await loadBadges(page)

        const squareBox = await rimBox(page, 'square')
        const [squareBadge] = await badgesOn(page, 'square')
        const [circleBadge] = await badgesOn(page, 'circle')

        expect(squareBox.round).toBe(false)
        expect(beyondBoxCorner(squareBadge, squareBox)).toBe(true)
        // Both nodes were declared `size: 24`. Treating the square as a circumscribed circle
        // — the maths the expand icon used to use — would bury its badge inside the shape.
        expect(Math.abs(squareBadge.cx)).toBeGreaterThan(Math.abs(circleBadge.cx))
    })

    test('the expand affordance uses the same corner maths as the badges', async ({ page }) => {
        await gotoHarness(page)
        await loadBadges(page)

        const box = await rimBox(page, 'sqcluster')
        const anchor = await iconAnchor(page, 'sqcluster')

        // On a square this is the whole point of the change: the old circumscribed-circle
        // offset put the '+' at ~0.5 x size, well inside the shape it is meant to hang off.
        expect(anchor!.x).toBeGreaterThan(box.hx)
        expect(anchor!.y).toBeLessThan(-box.hy)
    })

    test('scales with the node but stays inside the legibility clamp', async ({ page }) => {
        await gotoHarness(page)
        await loadBadges(page)

        const [small] = await badgesOn(page, 'small')   // size 5  -> below the floor
        const [medium] = await badgesOn(page, 'circle') // size 24 -> inside the band
        const [big] = await badgesOn(page, 'big')       // size 48 -> above the ceiling

        expect(small.radius).toBe(6)
        expect(big.radius).toBe(14)
        expect(medium.radius).toBeGreaterThan(small.radius)
        expect(medium.radius).toBeLessThan(big.radius)
    })
})

/* ---------- staying attached ---------- */

test.describe('attachment', () => {
    test('follows a framed picture to the box it settles on, not the square it was guessed at', async ({ page }) => {
        await gotoHarness(page)
        await loadBadges(page)

        // The frame is 2:1 landscape, and only says so once the image probe resolves — so
        // the badge has to be re-anchored after the fact or it sits over the picture.
        await expect.poll(async () => (await rimBox(page, 'framed')).hy).toBeLessThan(20)

        const box = await rimBox(page, 'framed')
        const [badge] = await badgesOn(page, 'framed')

        expect(box.hx).toBeGreaterThan(box.hy)          // the landscape frame, not the square guess
        expect(beyondBoxCorner(badge, box)).toBe(true)
        expect(Math.abs(badge.cx)).toBeGreaterThan(Math.abs(badge.cy))
    })

    test('rides to the cluster rim when the node expands, keeping its corners', async ({ page }) => {
        await gotoHarness(page)
        await loadBadges(page)

        const before = await badgesOn(page, 'cluster')
        expect(await harness(page, 'badgeGroupOffset', 'cluster')).toEqual({ x: 0, y: 0 })

        await harness(page, 'expand', 'cluster')

        // The whole group shifts north-west with the shape; the badges keep their corners,
        // so a badge never changes what it means halfway through an interaction.
        const offset = (await harness(page, 'badgeGroupOffset', 'cluster')) as { x: number, y: number }
        expect(offset.x).toBeLessThan(0)
        expect(offset.y).toBeLessThan(0)
        expect(await badgeCorners(page, 'cluster')).toEqual(before.map((badge) => badge.position))
    })

    test('anchors to a custom HTML card once it has been measured', async ({ page }) => {
        await gotoHarness(page)
        await loadBadges(page, { customNodes: true })

        // `renderNode` skips the default node render entirely — there is no `.node` shape,
        // so the rim has to come off the measured foreignObject.
        const box = await rimBox(page, 'card-0')
        const [badge] = await badgesOn(page, 'card-0')

        expect(box.hx).toBeCloseTo(70, 0)
        expect(box.hy).toBeCloseTo(22, 0)
        expect(beyondBoxCorner(badge, box)).toBe(true)
    })
})

/* ---------- how the style resolves ---------- */

test.describe('resolution', () => {
    test('a narrower declaration replaces a broader one rather than adding to it', async ({ page }) => {
        await gotoHarness(page)
        await loadBadges(page, { precedence: true })

        // `nodeStyleMap` badges every node; `circle` declares its own and `square` declares none.
        expect(await badgeTexts(page, 'small')).toEqual(['MAP'])
        expect(await badgeTexts(page, 'circle')).toEqual(['OWN'])
        expect(await badgeTexts(page, 'square')).toEqual([])
    })

    test('a graph declaring no badges draws no badge group at all', async ({ page }) => {
        await gotoHarness(page)
        await loadFixture(page, 'basic')

        expect(await badgesOn(page, 'a')).toEqual([])
        await expect(page.locator('.pvt-node-badges')).toHaveCount(0)
    })
})

/* ---------- overflow ---------- */

test.describe('overflow', () => {
    test('folds what does not fit into a +n that names it', async ({ page }) => {
        await gotoHarness(page)
        await loadBadges(page)

        // Six badges, four corners: three show and the last corner reports the rest.
        expect(await badgeTexts(page, 'overflow')).toEqual(['1', '2', '3', '+3'])

        const badges = await badgesOn(page, 'overflow')
        const plus = badges[badges.length - 1]
        expect(plus.overflow).toBe(true)
        expect(plus.title).toBe('4 things\n5 things\n6 things')
        expect(plus.interactive).toBe(false)
        // Neutral chrome: it stands for a mixed set, so it wears none of their colour.
        expect(plus.fill).not.toBe(badges[0].fill)
    })

    test('a node with children has room for one badge beside the overflow', async ({ page }) => {
        await gotoHarness(page)
        await loadBadges(page)

        // Both East corners are reserved for the expand affordance, so only two slots remain.
        expect(await badgeTexts(page, 'cluster')).toEqual(['W', '+3'])
    })
})

/* ---------- interaction ---------- */

test.describe('interaction', () => {
    test('an inert badge lets its click through to the node', async ({ page }) => {
        await gotoHarness(page)
        await loadBadges(page)

        expect((await badgesOn(page, 'clickable'))[1].interactive).toBe(false)
        await clickBadge(page, 'clickable', 'D')

        // It still reports the click on the bus, but never becomes a dead spot on the node.
        expect(await clickLog(page)).toEqual(['bus:D'])
        expect(await selected(page)).toEqual(['clickable'])
    })

    test('a badge with a handler fires it and keeps the node unselected', async ({ page }) => {
        await gotoHarness(page)
        await loadBadges(page)

        expect((await badgesOn(page, 'clickable'))[0].interactive).toBe(true)
        await clickBadge(page, 'clickable', 'C')

        expect(await clickLog(page)).toEqual(['bus:C', 'badge:C'])
        expect(await selected(page)).toEqual([])
    })

    test('the graph-wide handler runs after the badge’s own', async ({ page }) => {
        await gotoHarness(page)
        await loadBadges(page, { globalHandler: true })

        await clickBadge(page, 'clickable', 'C')
        expect(await clickLog(page)).toEqual(['bus:C', 'badge:C', 'global:C'])
    })

    test('declaring the graph-wide handler makes every badge consume its click', async ({ page }) => {
        await gotoHarness(page)
        await loadBadges(page, { globalHandler: true })

        // 'D' carries no onClick of its own, but there is now something for it to reach.
        expect((await badgesOn(page, 'clickable'))[1].interactive).toBe(true)
        await clickBadge(page, 'clickable', 'D')

        expect(await clickLog(page)).toEqual(['bus:D', 'global:D'])
        expect(await selected(page)).toEqual([])
    })

    test('a bus listener can cancel both handlers', async ({ page }) => {
        await gotoHarness(page)
        await loadBadges(page, { globalHandler: true, cancelBus: true })

        await clickBadge(page, 'clickable', 'C')
        expect(await clickLog(page)).toEqual(['bus:C'])
    })

    test('pressing a badge still drags the node', async ({ page }) => {
        await gotoHarness(page)
        await loadBadges(page)

        const before = (await harness(page, 'nodePositions')) as Record<string, { x: number, y: number }>
        const badge = nodeEl(page, 'clickable')
            .locator('.pvt-node-badge')
            .filter({ has: page.locator('text="C"') })
            .first()
        const box = (await badge.boundingBox())!

        // pointerdown is never consumed, so the badge is a handle on the node, not a hole in it.
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
        await page.mouse.down()
        await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2 + 60, { steps: 8 })
        await page.mouse.up()

        const after = (await harness(page, 'nodePositions')) as Record<string, { x: number, y: number }>
        expect(after['clickable'].x).not.toBeCloseTo(before['clickable'].x, 1)
    })
})

/* ---------- how it looks ---------- */

test('badges on every shape and size', async ({ page }) => {
    await gotoHarness(page)
    await loadBadges(page)
    await expect.poll(async () => (await rimBox(page, 'framed')).hy).toBeLessThan(20)

    await expectCanvas(page, 'node-badges.png')
})
