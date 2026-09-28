import { test, expect, gotoHarness, loadFixture, harness, nodeEl } from '../helpers'
import type { Page } from '@playwright/test'

/**
 * The collapsed cue: the dashed rim a closed container wears to say it opens. It follows
 * `render.enableNodeExpansion` like the chevron does, and follows the node's children as
 * they change after the first render.
 */

/** A stroke nobody would pick by accident, so the node's own style is easy to spot. */
const DECLARED_STROKE = { strokeColor: '#c81e3c', strokeWidth: 3 }

async function loadClustered(page: Page, render: Record<string, unknown> = {}) {
    await loadFixture(page, 'clustered', {
        render: { defaultNodeStyle: DECLARED_STROKE, ...render },
    })
    await harness(page, 'pin')
}

/** The node's own stroke as drawn, beside the presentation attributes it was given. */
async function strokeOf(page: Page, id: string) {
    return nodeEl(page, id).locator(':scope > .node').evaluate((shape) => {
        const probe = document.createElement('span')
        probe.style.color = shape.getAttribute('stroke') ?? ''
        document.body.appendChild(probe)
        const declaredColor = getComputedStyle(probe).color
        probe.remove()

        const drawn = getComputedStyle(shape)
        return {
            declared: { color: declaredColor, width: `${shape.getAttribute('stroke-width')}px` },
            drawn: { color: drawn.stroke, width: drawn.strokeWidth },
            dashed: drawn.strokeDasharray !== 'none',
        }
    })
}

/** No stylesheet rule wins over the node's declared stroke, and nothing dashes it. */
async function expectOwnStroke(page: Page, id: string) {
    const stroke = await strokeOf(page, id)
    expect(stroke.drawn).toEqual(stroke.declared)
    expect(stroke.dashed).toBe(false)
}

test.describe('collapsed cluster cue', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    test('expansion off: a container keeps its own stroke, undashed', async ({ page }) => {
        await loadClustered(page, { enableNodeExpansion: false })
        const group = nodeEl(page, 'group')

        await expect(group).toHaveClass(/pvt-node-has-children/)
        await expect(group).not.toHaveClass(/pvt-node-expandable/)
        await expectOwnStroke(page, 'group')
    })

    test('expansion on: a collapsed container wears the dashed cue', async ({ page }) => {
        await loadClustered(page)
        const group = nodeEl(page, 'group')

        await expect(group).toHaveClass(/pvt-node-expandable/)
        expect((await strokeOf(page, 'group')).dashed).toBe(true)
        // A leaf beside it is untouched.
        await expectOwnStroke(page, 'ext1')
    })

    test('a node that gains children picks up the cue on the next update', async ({ page }) => {
        await loadClustered(page)
        const ext1 = nodeEl(page, 'ext1')
        await expect(ext1).not.toHaveClass(/pvt-node-expandable/)

        await page.evaluate(() => {
            const graph = window.__pivotick.graph!
            graph.unionChildren(graph.getMutableNode('ext1')!, [{ id: 'ext1-child' }])
        })

        await expect(ext1).toHaveClass(/pvt-node-has-children/)
        await expect(ext1).toHaveClass(/pvt-node-expandable/)
        expect((await strokeOf(page, 'ext1')).dashed).toBe(true)
    })
})
