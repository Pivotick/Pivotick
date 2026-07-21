import {
    test,
    expect,
    gotoHarness,
    loadFixture,
    harness,
    expectElement,
    nodeEl,
} from '../helpers'
import type { Page } from '@playwright/test'

// ── B3 sidebar clear-X + bulk-action row ─────────────────────────────────────
// Opt into the experimental B3 chrome in full mode (the sidebar is full-only).
// A node selection reveals a clear-selection X plus a bulk-action row whose four
// functional actions (Pin / Unpin / Hide / Delete) apply to the whole selection;
// Isolate / Group / Ungroup / Bulk-edit render disabled with a "SOON" affordance.

const B3_FULL = { UI: { mode: 'full', experimentalB3Chrome: true, sidebar: { collapsed: false } } }

const FUNCTIONAL = ['pin', 'unpin', 'hide', 'delete']
const SOON = ['isolate', 'group', 'ungroup', 'bulk-edit']

/**
 * Per-node freeze state. The `basic` fixture pins every node's `fx/fy` for
 * deterministic baselines but leaves `frozen` false — so `frozen` (not `fixed`)
 * is what the Pin/Unpin actions actually flip.
 */
const nodeStates = (page: Page, ids: string[]) =>
    page.evaluate(
        (nodeIds) =>
            nodeIds.map((id) => {
                const node = window.__pivotick.graph!.getMutableNode(id)
                return { id, frozen: !!node?.frozen, fixed: node?.fx != null }
            }),
        ids
    )

test.describe('sidebar bulk actions', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    test('a node selection reveals the clear-X and the bulk-action row', async ({ page }) => {
        await loadFixture(page, 'basic', B3_FULL)
        const sidebar = page.locator('.pvt-sidebar')
        const row = sidebar.locator('.pvt-sidebar-bulkactions')
        const clearX = sidebar.locator('.pvt-sidebar-clear')

        // Nothing selected → both are dormant.
        await expect(row).toBeHidden()
        await expect(clearX).not.toBeVisible()

        await harness(page, 'multiSelect', ['a', 'b'])

        await expect(clearX).toBeVisible()
        await expect(row).toBeVisible()
        await expect(row.locator('.pvt-sidebar-bulkaction')).toHaveCount(FUNCTIONAL.length + SOON.length)
        for (const id of FUNCTIONAL) {
            await expect(row.locator(`.pvt-sidebar-bulkaction[data-action="${id}"]`)).toBeEnabled()
        }
        for (const id of SOON) {
            await expect(row.locator(`.pvt-sidebar-bulkaction[data-action="${id}"]`)).toBeDisabled()
        }

        await expectElement(row, 'sidebar-bulk-row.png')
    })

    test('the clear-X clears the selection and tears the row back down', async ({ page }) => {
        await loadFixture(page, 'basic', B3_FULL)
        const sidebar = page.locator('.pvt-sidebar')
        const clearX = sidebar.locator('.pvt-sidebar-clear')

        await harness(page, 'multiSelect', ['a', 'b'])
        await expect(clearX).toBeVisible()

        await clearX.click()

        expect(await harness(page, 'selectedNodeIds')).toEqual([])
        await expect(sidebar.locator('.pvt-sidebar-bulkactions')).toBeHidden()
        await expect(clearX).not.toBeVisible()
    })

    test('Pin freezes the selection; Unpin releases it', async ({ page }) => {
        await loadFixture(page, 'basic', B3_FULL)
        const row = page.locator('.pvt-sidebar .pvt-sidebar-bulkactions')

        await harness(page, 'multiSelect', ['a', 'b'])
        // Baseline: fixture-pinned in place, but not yet frozen.
        expect(await nodeStates(page, ['a', 'b'])).toEqual([
            { id: 'a', frozen: false, fixed: true },
            { id: 'b', frozen: false, fixed: true },
        ])

        await row.locator('.pvt-sidebar-bulkaction[data-action="pin"]').click()
        expect((await nodeStates(page, ['a', 'b'])).every((s) => s.frozen)).toBe(true)

        await row.locator('.pvt-sidebar-bulkaction[data-action="unpin"]').click()
        expect(await nodeStates(page, ['a', 'b'])).toEqual([
            { id: 'a', frozen: false, fixed: false },
            { id: 'b', frozen: false, fixed: false },
        ])
    })

    test('Hide removes the selected nodes from the view and clears the selection', async ({ page }) => {
        await loadFixture(page, 'basic', B3_FULL)
        const row = page.locator('.pvt-sidebar .pvt-sidebar-bulkactions')

        await harness(page, 'multiSelect', ['a', 'b'])
        await expect(nodeEl(page, 'a')).toBeVisible()

        await row.locator('.pvt-sidebar-bulkaction[data-action="hide"]').click()

        await expect(nodeEl(page, 'a')).not.toBeVisible()
        await expect(nodeEl(page, 'b')).not.toBeVisible()
        expect(await harness(page, 'selectedNodeIds')).toEqual([])
        await expect(row).toBeHidden()
    })

    test('Delete removes the selected nodes from the graph', async ({ page }) => {
        await loadFixture(page, 'basic', B3_FULL)
        const row = page.locator('.pvt-sidebar .pvt-sidebar-bulkactions')

        const before = (await harness(page, 'counts')) as { nodes: number }
        await harness(page, 'multiSelect', ['a', 'b'])

        await row.locator('.pvt-sidebar-bulkaction[data-action="delete"]').click()

        const after = (await harness(page, 'counts')) as { nodes: number }
        expect(after.nodes).toBe(before.nodes - 2)
        expect(await harness(page, 'selectedNodeIds')).toEqual([])
        await expect(row).toBeHidden()
    })

    test('an edge selection shows the clear-X but not the node bulk row', async ({ page }) => {
        await loadFixture(page, 'basic', B3_FULL)
        const sidebar = page.locator('.pvt-sidebar')

        await harness(page, 'selectEdge', 'a-b')

        await expect(sidebar.locator('.pvt-sidebar-clear')).toBeVisible()
        await expect(sidebar.locator('.pvt-sidebar-bulkactions')).toBeHidden()
    })
})
