import type { Page } from '@playwright/test'
import {
    test,
    expect,
    gotoHarness,
    loadFixture,
    harness,
    nodeEl,

    centerOf,
} from '../helpers'
import type { RecordedDeleteContext, RecordedDeleteOutcome } from '../harness/harness'

// The before-delete hook (`onBeforeDelete`). Every user-initiated delete — the
// sidebar bulk row, the node / edge / note context-menu entries — resolves its whole
// target set (including the edges a node removal cascades into), hands it to the
// consumer, and removes only what comes back accepted.
//
// The affordance tests drive the real widgets; the contract cases (cascade, narrow,
// pending lock, programmatic bypass) drive `graph.editing.requestDelete`, the same
// entry point those widgets call.

const B3_FULL = { UI: { mode: 'full', sidebar: { collapsed: false } } }

// ── small, self-documenting readers over the serialisable harness API ────────
const counts = async (page: Page): Promise<{ nodes: number; edges: number }> =>
    (await harness(page, 'counts')) as { nodes: number; edges: number }

/** How many times `onBeforeDelete` was invoked (0 when absent / not consulted). */
const deleteHookCalls = async (page: Page): Promise<number> =>
    ((await harness(page, 'writePathCalls')) as { delete: number }).delete

/** What the hook was actually told about, per invocation. */
const hookSaw = async (page: Page): Promise<RecordedDeleteContext[]> =>
    (await harness(page, 'deleteContexts')) as RecordedDeleteContext[]

/** Ids that actually left the model (empty ⇒ nothing was removed / no remove events). */
const removed = async (page: Page): Promise<{ nodes: string[]; edges: string[]; notes: string[] }> =>
    (await harness(page, 'removedIds')) as { nodes: string[]; edges: string[]; notes: string[] }

const requestDelete = async (
    page: Page,
    spec: { nodes?: string[]; edges?: string[]; notes?: string[]; origin?: 'bulk-action' | 'context-menu' }
): Promise<RecordedDeleteOutcome> =>
    (await harness(page, 'requestDelete', spec)) as RecordedDeleteOutcome

const selectedNodeIds = async (page: Page): Promise<string[]> =>
    (await harness(page, 'selectedNodeIds')) as string[]

const bulkDeleteButton = (page: Page) =>
    page.locator('.pvt-sidebar .pvt-sidebar-bulkaction[data-action="delete"]')

/** Open an element's context menu and click one of its entries. */
async function pickFromContextMenu(page: Page, target: { x: number; y: number }, entry: string): Promise<void> {
    await page.mouse.click(target.x, target.y, { button: 'right' })
    await expect(page.locator('.pvt-contextmenu')).toHaveClass(/shown/)
    await page.locator('.pvt-contextmenu .pvt-action-item', { hasText: entry }).click()
}

/** A point that actually lies on the named edge's rendered path. */
async function edgePoint(page: Page, id: string): Promise<{ x: number; y: number }> {
    const point = (await harness(page, 'edgePoint', id)) as { x: number; y: number } | null
    if (!point) throw new Error(`edge ${id} is not rendered`)
    return point
}

test.describe('delete — the bulk-action row', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
        await loadFixture(page, 'basic', B3_FULL)
    })

    test('absent hook: Delete removes the selection, exactly as before', async ({ page }) => {
        await harness(page, 'configureWritePath', {}) // record removals, install no hook
        const before = await counts(page)
        await harness(page, 'multiSelect', ['a', 'b'])

        await bulkDeleteButton(page).click()

        await expect.poll(async () => (await counts(page)).nodes).toBe(before.nodes - 2)
        expect(await deleteHookCalls(page)).toBe(0)
        expect((await removed(page)).nodes).toEqual(['a', 'b'])
        expect(await selectedNodeIds(page)).toEqual([])
    })

    test('veto (sync) removes nothing and keeps the selection intact', async ({ page }) => {
        await harness(page, 'configureWritePath', { deleteHook: 'veto' })
        const before = await counts(page)
        await harness(page, 'multiSelect', ['a', 'b'])

        await bulkDeleteButton(page).click()

        await expect.poll(() => deleteHookCalls(page)).toBe(1)
        expect(await counts(page)).toEqual(before)
        expect(await removed(page)).toEqual({ nodes: [], edges: [], notes: [] })
        // The row is still there to act on — a veto is not a "done".
        expect(await selectedNodeIds(page)).toEqual(['a', 'b'])
        await expect(bulkDeleteButton(page)).toBeVisible()
    })

    test('veto (async) removes nothing either', async ({ page }) => {
        await harness(page, 'configureWritePath', { deleteHook: 'veto-async', asyncDelayMs: 120 })
        const before = await counts(page)
        await harness(page, 'multiSelect', ['a', 'b'])

        await bulkDeleteButton(page).click()

        await expect.poll(() => deleteHookCalls(page)).toBe(1)
        expect(await counts(page)).toEqual(before)
        expect(await removed(page)).toEqual({ nodes: [], edges: [], notes: [] })
        expect(await selectedNodeIds(page)).toEqual(['a', 'b'])
    })

    test('accept removes the selection and reports origin "bulk-action"', async ({ page }) => {
        await harness(page, 'configureWritePath', { deleteHook: 'accept' })
        await harness(page, 'multiSelect', ['a', 'b'])

        await bulkDeleteButton(page).click()

        await expect.poll(async () => (await removed(page)).nodes).toEqual(['a', 'b'])
        expect((await hookSaw(page))[0].origin).toBe('bulk-action')
        await expect(nodeEl(page, 'a')).toHaveCount(0)
    })

    test('a narrowed decision removes only the subset the consumer kept', async ({ page }) => {
        await harness(page, 'configureWritePath', { deleteHook: 'narrow-nodes' })
        await harness(page, 'multiSelect', ['a', 'b'])

        await bulkDeleteButton(page).click()

        // The hook kept the first node only; `b` stays in the model and on canvas.
        await expect.poll(async () => (await removed(page)).nodes).toEqual(['a'])
        await expect(nodeEl(page, 'b')).toHaveCount(1)
    })

    test('the Delete button is absent when deletion is disabled', async ({ page }) => {
        await loadFixture(page, 'basic', {
            UI: { mode: 'full', sidebar: { collapsed: false }, editors: { deletion: { enabled: false } } },
        })
        await harness(page, 'multiSelect', ['a', 'b'])

        await expect(page.locator('.pvt-sidebar .pvt-sidebar-bulkactions')).toBeVisible()
        await expect(bulkDeleteButton(page)).toHaveCount(0)
    })
})

test.describe('delete — the context-menu entries', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    test('Delete Node routes through the hook with origin "context-menu"', async ({ page }) => {
        await loadFixture(page, 'basic')
        await harness(page, 'configureWritePath', { deleteHook: 'accept' })

        await pickFromContextMenu(page, await centerOf(nodeEl(page, 'a')), 'Delete Node')

        await expect.poll(async () => (await removed(page)).nodes).toEqual(['a'])
        expect((await hookSaw(page))[0]).toMatchObject({ nodes: ['a'], origin: 'context-menu' })
    })

    test('Delete Edge routes through the hook and removes only that edge', async ({ page }) => {
        await loadFixture(page, 'basic')
        await harness(page, 'configureWritePath', { deleteHook: 'accept' })
        const before = await counts(page)

        await pickFromContextMenu(page, await edgePoint(page, 'a-b'), 'Delete Edge')

        await expect.poll(async () => (await removed(page)).edges).toEqual(['a-b'])
        expect((await hookSaw(page))[0]).toMatchObject({ edges: ['a-b'], nodes: [], origin: 'context-menu' })
        expect((await counts(page)).nodes).toBe(before.nodes) // no node went with it
    })

    test('Remove Note routes through the hook, and a veto keeps the note', async ({ page }) => {
        await loadFixture(page, 'withNote')
        await harness(page, 'configureWritePath', { deleteHook: 'veto' })

        // The note's DOM id is generated, so reach it by class (one note in the fixture).
        const noteContent = page.locator('.pvt-note-content')
        await expect(noteContent).toHaveCount(1)
        await pickFromContextMenu(page, await centerOf(noteContent), 'Remove Note')

        await expect.poll(() => deleteHookCalls(page)).toBe(1)
        expect((await hookSaw(page))[0]).toMatchObject({ notes: ['note1'], origin: 'context-menu' })
        expect(await harness(page, 'noteIds')).toEqual(['note1'])
        await expect(noteContent).toHaveCount(1)
    })

    test('the write-path entries are absent when their editors are disabled', async ({ page }) => {
        await loadFixture(page, 'basic', {
            UI: { editors: { deletion: { enabled: false }, edgeEditor: { enabled: false } } },
        })

        await nodeEl(page, 'a').click({ button: 'right' })
        await expect(page.locator('.pvt-contextmenu')).toHaveClass(/shown/)
        await expect(page.locator('.pvt-contextmenu .pvt-action-item', { hasText: 'Delete Node' })).toHaveCount(0)
        // A non-gated default is untouched.
        await expect(page.locator('.pvt-contextmenu .pvt-action-item', { hasText: 'Inspect Properties' })).toHaveCount(1)

        const point = await edgePoint(page, 'a-b')
        await page.mouse.click(point.x, point.y, { button: 'right' })
        await expect(page.locator('.pvt-contextmenu .pvt-action-item', { hasText: 'Delete Edge' })).toHaveCount(0)
        await expect(page.locator('.pvt-contextmenu .pvt-action-item', { hasText: 'Edit Edge' })).toHaveCount(0)
    })
})

test.describe('delete — the hook contract', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
        await loadFixture(page, 'basic')
    })

    test('cascadingEdges lists exactly the edges the node removal will destroy', async ({ page }) => {
        await harness(page, 'configureWritePath', { deleteHook: 'accept' })

        const outcome = await requestDelete(page, { nodes: ['a'] })

        // `a` is wired to b, e and hub in the `basic` fixture — the library resolves
        // that consequence, the consumer doesn't re-derive it.
        expect((await hookSaw(page))[0].cascadingEdges.sort()).toEqual(['a-b', 'e-a', 'hub-a'])
        expect((await hookSaw(page))[0].edges).toEqual([])
        // …and the outcome reports them as removed, alongside the node.
        expect(outcome.nodes).toEqual(['a'])
        expect(outcome.edges.sort()).toEqual(['a-b', 'e-a', 'hub-a'])
        expect((await removed(page)).edges.sort()).toEqual(['a-b', 'e-a', 'hub-a'])
    })

    test('a named edge is reported once — under edges, never also under the cascade', async ({ page }) => {
        await harness(page, 'configureWritePath', { deleteHook: 'accept' })

        await requestDelete(page, { nodes: ['a'], edges: ['a-b'] })

        const seen = (await hookSaw(page))[0]
        expect(seen.edges).toEqual(['a-b'])
        expect(seen.cascadingEdges.sort()).toEqual(['e-a', 'hub-a'])
    })

    test('narrowing is per kind: an omitted key stays "as requested"', async ({ page }) => {
        // `spare-edges` returns `{ accept: true, edges: [] }` — so the named edge is
        // spared while the nodes (omitted, hence unchanged) still go.
        await harness(page, 'configureWritePath', { deleteHook: 'spare-edges' })

        const outcome = await requestDelete(page, { nodes: ['a'], edges: ['c-d'] })

        expect(outcome.nodes).toEqual(['a'])
        expect(outcome.edges).not.toContain('c-d')
        expect((await removed(page)).edges).not.toContain('c-d')
        // The node's own cascade still follows it — that isn't narrowable.
        expect(outcome.edges.sort()).toEqual(['a-b', 'e-a', 'hub-a'])
    })

    test('a veto fires no remove events at all', async ({ page }) => {
        await harness(page, 'configureWritePath', { deleteHook: 'veto' })
        const before = await counts(page)

        const outcome = await requestDelete(page, { nodes: ['a'], edges: ['c-d'] })

        expect(outcome).toEqual({ accepted: false, nodes: [], edges: [], notes: [] })
        expect(await counts(page)).toEqual(before)
        expect(await removed(page)).toEqual({ nodes: [], edges: [], notes: [] })
    })

    test('a second request is ignored while an async decision is pending', async ({ page }) => {
        await harness(page, 'configureWritePath', { deleteHook: 'accept-async', asyncDelayMs: 300 })

        const [first, second] = (await harness(
            page, 'raceDeleteRequests', { nodes: ['a'] }, { nodes: ['b'] }
        )) as RecordedDeleteOutcome[]

        expect(second).toEqual({ accepted: false, nodes: [], edges: [], notes: [] })
        expect(first.nodes).toEqual(['a'])
        // The hook was entered exactly once — the lock swallowed the second gesture.
        expect(await deleteHookCalls(page)).toBe(1)
        await expect(nodeEl(page, 'b')).toHaveCount(1)
    })

    test('programmatic removal bypasses the hook entirely', async ({ page }) => {
        // A veto that would refuse every *user* delete must not gate consumer code.
        await harness(page, 'configureWritePath', { deleteHook: 'veto' })

        await harness(page, 'graphRemoveEdge', 'c-d')
        await harness(page, 'graphRemoveNode', 'a')

        expect(await deleteHookCalls(page)).toBe(0)
        expect((await removed(page)).nodes).toEqual(['a'])
        expect((await removed(page)).edges).toContain('c-d')
        await expect(nodeEl(page, 'a')).toHaveCount(0)
    })
})

test.describe('delete — the ctx.confirm() modal', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
        await loadFixture(page, 'basic')
        await harness(page, 'configureWritePath', { deleteHook: 'confirm' })
    })

    const confirmBody = (page: Page) => page.locator('.pvt-confirm-modal-body')
    const modalButton = (page: Page, label: string) =>
        page.locator('.pvt-modal__footer button', { hasText: label })

    test('confirming goes through to the delete', async ({ page }) => {
        const pending = requestDelete(page, { nodes: ['a'] })

        await expect(confirmBody(page)).toContainText('1 node(s) will go.')
        await modalButton(page, 'Confirm').click()

        expect((await pending).nodes).toEqual(['a'])
        expect((await removed(page)).nodes).toEqual(['a'])
    })

    test('cancelling resolves false, so nothing is removed', async ({ page }) => {
        const before = await counts(page)
        const pending = requestDelete(page, { nodes: ['a'] })

        await confirmBody(page).waitFor({ state: 'visible' })
        await modalButton(page, 'Cancel').click()

        expect((await pending).accepted).toBe(false)
        expect(await counts(page)).toEqual(before)
        expect(await removed(page)).toEqual({ nodes: [], edges: [], notes: [] })
    })
})
