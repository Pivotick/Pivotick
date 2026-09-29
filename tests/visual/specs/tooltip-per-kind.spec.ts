import type { Locator, Page } from '@playwright/test'
import { test, expect, gotoHarness, harness, canvas, nodeEl, waitForViewSettled } from '../helpers'

/**
 * `UI.tooltip.enabled` per kind: a map of nodes / edges / groups, or a predicate, decides
 * which hovers show a tooltip.
 *
 * The `simplify` fixture with the neighbour rule: the six IPs fold into one group between
 * `ev-a` and `ev-b`; `hub` stays a plain node, and `ev-b-hub` a plain edge.
 */

type Enabled = boolean | { nodes?: boolean, edges?: boolean, groups?: boolean }

/** Past the tooltip's 400 ms show delay, with room to spare. */
const PAST_SHOW_DELAY = 800

const tooltip = (page: Page): Locator => page.locator('.pvt-tooltip')

/** Load, then wait out the opening fit: a node still moving under the pointer is never hovered. */
async function load(page: Page, enabled?: Enabled): Promise<void> {
    await harness(page, 'loadSimplify', {
        UI: {
            mode: 'full',
            simplify: { rules: [{ kind: 'neighbours' }] },
            ...(enabled === undefined ? {} : { tooltip: { enabled } }),
        },
    })
    await waitForViewSettled(page)
}

async function groupDomId(page: Page, member: string): Promise<string> {
    return page.evaluate((id) => {
        const simplify = window.__pivotick.graph!.simplify
        return simplify.getGroupNode(simplify.groupOf(id)!.id)!.domID
    }, member)
}

/** Bring the pointer onto a drawn node from just above it, the way a hand would. */
async function hover(page: Page, domId: string): Promise<void> {
    const box = (await canvas(page).locator(`#node-${domId} .node`).first().boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y - 10)
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 25 })
}

async function expectShown(page: Page): Promise<void> {
    await expect(tooltip(page)).toHaveClass(/shown/)
}

/** Nothing has opened once the show delay is well past. */
async function expectNothingShown(page: Page): Promise<void> {
    await page.waitForTimeout(PAST_SHOW_DELAY)
    await expect(tooltip(page)).not.toHaveClass(/shown/)
}

/** Hover an edge through the tooltip's own entry point: edge hovers are not wired to it. */
async function hoverEdge(page: Page, edgeId: string): Promise<void> {
    const box = (await nodeEl(page, 'hub').boundingBox())!
    const x = box.x + box.width / 2
    const y = box.y + box.height + 30
    await page.mouse.move(x, y)
    await page.evaluate(([id, x, y]) => {
        const graph = window.__pivotick.graph!
        const event = new MouseEvent('mousemove', { clientX: Number(x), clientY: Number(y) })
        graph.UIManager.tooltip!.edgeHovered(event, graph.getMutableEdge(String(id))!)
    }, [edgeId, x, y])
}

test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 })
    await gotoHarness(page)
})

test.describe('tooltips per kind', () => {
    test('groups only: a group shows its tooltip, a node and an edge do not', async ({ page }) => {
        await load(page, { nodes: false, edges: false, groups: true })
        await page.evaluate(() => {
            window.__pivotick.graph!.UIManager.getOptions().tooltip.renderGroupExtra = (group) => `${group.members.length} members`
        })
        await hover(page, await groupDomId(page, 'ip-0'))
        await expectShown(page)
        await expect(tooltip(page).locator('.pvt-group-summary-chip-label')).toHaveText(['EV-A', 'EV-B'])
        await expect(tooltip(page).locator('.pivotick-extra-content-container')).toHaveText('6 members')

        await page.mouse.move(10, 10)
        await expect(tooltip(page)).not.toHaveClass(/shown/)
        await hover(page, 'hub')
        await expectNothingShown(page)

        await hoverEdge(page, 'ev-b-hub')
        await expectNothingShown(page)
    })

    test('from an allowed group straight onto a refused node, the tooltip hides and nothing opens', async ({ page }) => {
        await load(page, { nodes: false, edges: false, groups: true })
        await hover(page, await groupDomId(page, 'ip-0'))
        await expectShown(page)

        await hover(page, 'ev-a')
        await expectNothingShown(page)
    })

    test('a missing key is on: { edges: false } keeps nodes and groups', async ({ page }) => {
        await load(page, { edges: false })
        await hover(page, 'hub')
        await expectShown(page)
        await page.mouse.move(10, 10)
        await expect(tooltip(page)).not.toHaveClass(/shown/)

        await hover(page, await groupDomId(page, 'ip-0'))
        await expectShown(page)
        await page.mouse.move(10, 10)
        await expect(tooltip(page)).not.toHaveClass(/shown/)

        await hoverEdge(page, 'ev-b-hub')
        await expectNothingShown(page)
    })

    test('an edge shows when its kind is on', async ({ page }) => {
        await load(page, { nodes: false })
        await hoverEdge(page, 'ev-b-hub')
        await expectShown(page)
    })

    test('a predicate is asked on every hover', async ({ page }) => {
        await load(page)
        await page.evaluate(() => {
            window.__pivotick.graph!.UIManager.getOptions().tooltip.enabled =
                (element, kind) => kind === 'node' && element.getData()?.type === 'event'
        })
        await hover(page, 'ev-a')
        await expectShown(page)
        await page.mouse.move(10, 10)
        await expect(tooltip(page)).not.toHaveClass(/shown/)

        await hover(page, 'hub')
        await expectNothingShown(page)
        await hover(page, await groupDomId(page, 'ip-0'))
        await expectNothingShown(page)
    })

    test('a predicate that throws shows nothing and logs once', async ({ page }) => {
        const errors: string[] = []
        page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
        await load(page)
        await page.evaluate(() => {
            window.__pivotick.graph!.UIManager.getOptions().tooltip.enabled = () => { throw new Error('bad predicate') }
        })
        await hover(page, 'hub')
        await expectNothingShown(page)
        await page.mouse.move(10, 10)
        await hover(page, 'hub')
        await expectNothingShown(page)

        expect(errors.filter((text) => text.includes('UI.tooltip.enabled threw for node "hub"'))).toHaveLength(1)
    })

    test('true, false and no option behave as before', async ({ page }) => {
        for (const enabled of [undefined, true]) {
            await load(page, enabled)
            await hover(page, 'hub')
            await expectShown(page)
            await page.mouse.move(10, 10)
        }
        await load(page, false)
        await expect(tooltip(page)).toHaveCount(0)
        await hover(page, 'hub')
        await expect(tooltip(page)).toHaveCount(0)
    })

    test('every kind off is the same as false: nothing is mounted', async ({ page }) => {
        await load(page, { nodes: false, edges: false, groups: false })
        await expect(tooltip(page)).toHaveCount(0)
    })

    test('the filter list\'s hover of a refused node shows nothing', async ({ page }) => {
        for (const [enabled, shows] of [[{ edges: false }, true], [{ nodes: false }, false]] as const) {
            await load(page, enabled)
            await harness(page, 'excludeNode', 'hub')
            await harness(page, 'openFilterPanel')
            const row = page.locator('.hidden-node', { hasText: 'hub' }).first()
            await row.hover()
            if (shows) await expectShown(page)
            else await expectNothingShown(page)
            await page.mouse.move(10, 10)
        }
    })
})
