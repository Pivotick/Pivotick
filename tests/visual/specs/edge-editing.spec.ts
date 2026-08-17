import type { Page } from '@playwright/test'
import {
    test,
    expect,
    gotoHarness,
    loadFixture,
    harness,
    expectCanvas,
    waitForViewSettled,
} from '../helpers'
import type { RecordedDataChange } from '../harness/harness'

// Editing an *existing* edge — the edge twin of `node-editing.spec.ts`. The edge
// context menu opens a session, the modal writes the draft, and
// `onBeforeEdgeEditCommit` gates the commit: accepted writes the data and announces
// `edgeChange`, refused leaves the edge exactly as it was.

const EDIT_BUTTON = '.pvt-modal__footer button'

const edgeData = async (page: Page, id: string): Promise<Record<string, unknown>> =>
    (await harness(page, 'edgeData', id)) as Record<string, unknown>

const edgeChanges = async (page: Page): Promise<RecordedDataChange[]> =>
    (await harness(page, 'edgeChanges')) as RecordedDataChange[]

/** What the edge's label reads, and where on screen it is drawn. */
const edgeLabel = async (page: Page, id: string): Promise<{ text: string; x: number; y: number }> => {
    const label = (await harness(page, 'edgeLabel', id)) as { text: string; x: number; y: number } | null
    if (!label) throw new Error(`edge ${id} has no rendered label`)
    return label
}

const commitCalls = async (page: Page): Promise<number> =>
    ((await harness(page, 'writePathCalls')) as { edgeEditCommit: number }).edgeEditCommit

const modal = (page: Page) => page.locator('#edit-edge-modal')
/** FormFactory renders each field as `#pvt-form-element-<key>`. */
const field = (page: Page, key: string) => modal(page).locator(`#pvt-form-element-${key}`)
const modalButton = (page: Page, label: string) => page.locator(EDIT_BUTTON, { hasText: label })

/** A point that actually lies on the named edge's rendered path. */
async function edgePoint(page: Page, id: string): Promise<{ x: number; y: number }> {
    const point = (await harness(page, 'edgePoint', id)) as { x: number; y: number } | null
    if (!point) throw new Error(`edge ${id} is not rendered`)
    return point
}

test.describe('edge editing', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
        await loadFixture(page, 'basic')
        await harness(page, 'configureWritePath', {})
    })

    test('the edge context menu opens a session whose form reflects the edge data', async ({ page }) => {
        await waitForViewSettled(page) // a late fit would emit canvasZoom and close the menu
        const point = await edgePoint(page, 'a-b')
        await page.mouse.click(point.x, point.y, { button: 'right' })
        await page.locator('.pvt-contextmenu .pvt-action-item', { hasText: 'Edit Edge' }).click()

        // `a-b` carries `{ label: 'links' }` in the `basic` fixture.
        await expect(modal(page).locator('.edgeinfo-name')).toHaveText('A → B')
        await expect(field(page, 'label')).toHaveValue('links')
    })

    test('committing writes the draft and announces edgeChange', async ({ page }) => {
        await harness(page, 'openEdgeSession', 'a-b')

        await field(page, 'label').fill('reports-to')
        await modalButton(page, 'Edit Edge').click()

        await expect.poll(async () => (await edgeData(page, 'a-b')).label).toBe('reports-to')
        await expect(modal(page)).toHaveCount(0)
        // One `edgeChange`, carrying both sides of the change.
        const changes = await edgeChanges(page)
        expect(changes).toHaveLength(1)
        expect(changes[0]).toMatchObject({ id: 'a-b', previous: { label: 'links' }, next: { label: 'reports-to' } })
    })

    test('the new label is repainted on the edge straight away', async ({ page }) => {
        // Regression guard: `update()` re-renders a dirty edge but leaves the fresh
        // label untransformed, so without a tick the new text only showed up once
        // something else moved the graph.
        await harness(page, 'openEdgeSession', 'a-b')
        await field(page, 'label').fill('reports-to')
        await modalButton(page, 'Edit Edge').click()
        await expect(modal(page)).toHaveCount(0)

        const label = await edgeLabel(page, 'a-b')
        const midpoint = await edgePoint(page, 'a-b')
        expect(label.text).toBe('reports-to')
        // …and drawn *on* the edge: an unplaced label sits at the graph origin instead.
        expect(Math.hypot(label.x - midpoint.x, label.y - midpoint.y)).toBeLessThan(30)

        await expectCanvas(page, 'edge-label-after-edit.png')
    })

    test('a labelless edge gains a drawn label on its first edit', async ({ page }) => {
        // `b-c` starts with no data, so it has no label element at all — the commit has
        // to create *and* place one.
        await harness(page, 'openEdgeSession', 'b-c')
        await field(page, 'label').fill('flows-to')
        await modalButton(page, 'Edit Edge').click()
        await expect(modal(page)).toHaveCount(0)

        const label = await edgeLabel(page, 'b-c')
        const midpoint = await edgePoint(page, 'b-c')
        expect(label.text).toBe('flows-to')
        expect(Math.hypot(label.x - midpoint.x, label.y - midpoint.y)).toBeLessThan(30)
    })

    test('the sidebar re-reads the selected edge it is showing', async ({ page }) => {
        // A commit has to refresh the panels too, or the sidebar keeps showing the label
        // the edge had before the edit.
        await loadFixture(page, 'basic', { UI: { mode: 'full', sidebar: { collapsed: false } } })
        await harness(page, 'configureWritePath', {})
        await harness(page, 'selectEdge', 'a-b')
        const sidebarTitle = page.locator('.pvt-sidebar .pvt-mainheader-nodeinfo-name')
        await expect(sidebarTitle).toHaveText('links')

        await harness(page, 'openEdgeSession', 'a-b')
        await field(page, 'label').fill('reports-to')
        await modalButton(page, 'Edit Edge').click()

        await expect(sidebarTitle).toHaveText('reports-to')
    })

    test('a vetoed commit leaves the edge untouched and the modal open', async ({ page }) => {
        await harness(page, 'configureWritePath', { edgeEditHook: 'veto' })
        await harness(page, 'openEdgeSession', 'a-b')

        await field(page, 'label').fill('reports-to')
        await modalButton(page, 'Edit Edge').click()

        await expect.poll(() => commitCalls(page)).toBe(1)
        expect((await edgeData(page, 'a-b')).label).toBe('links')
        expect(await edgeChanges(page)).toHaveLength(0)
        // Still open, so the user can correct the form and retry.
        await expect(modal(page)).toBeVisible()
    })

    test('an async veto behaves the same way', async ({ page }) => {
        await harness(page, 'configureWritePath', { edgeEditHook: 'veto-async', asyncDelayMs: 120 })
        await harness(page, 'openEdgeSession', 'a-b')

        await field(page, 'label').fill('nope')
        await modalButton(page, 'Edit Edge').click()

        await expect.poll(() => commitCalls(page)).toBe(1)
        expect((await edgeData(page, 'a-b')).label).toBe('links')
        await expect(modal(page)).toBeVisible()
    })

    test('an async accept commits once it settles', async ({ page }) => {
        await harness(page, 'configureWritePath', { edgeEditHook: 'accept-async', asyncDelayMs: 120 })
        await harness(page, 'openEdgeSession', 'a-b')

        await field(page, 'label').fill('later')
        await modalButton(page, 'Edit Edge').click()

        await expect.poll(async () => (await edgeData(page, 'a-b')).label).toBe('later')
        await expect(modal(page)).toHaveCount(0)
    })

    test('cancelling ends the session, so the edge can be reopened', async ({ page }) => {
        await harness(page, 'openEdgeSession', 'a-b')
        await modalButton(page, 'Cancel').click()
        await expect(modal(page)).toHaveCount(0)
        expect((await edgeData(page, 'a-b')).label).toBe('links')

        // A session that wasn't closed on dismissal would make this a no-op.
        await harness(page, 'openEdgeSession', 'a-b')
        await expect(field(page, 'label')).toHaveValue('links')
    })

    test('an edge with no data still gets an editable label field', async ({ page }) => {
        // `b-c` was created without data in the `basic` fixture.
        await harness(page, 'openEdgeSession', 'b-c')

        await expect(field(page, 'label')).toHaveValue('')
    })

    test('onEdgeEdit supplies the body once, and that body owns the draft', async ({ page }) => {
        await harness(page, 'configureWritePath', { edgeEditBody: true })
        await harness(page, 'openEdgeSession', 'a-b')

        // The custom body replaces the inferred form, and is built exactly once.
        const custom = page.locator('#edit-edge-modal .test-edge-body .test-edge-label')
        await expect(custom).toHaveValue('links')
        await expect(field(page, 'label')).toHaveCount(0)
        expect(((await harness(page, 'writePathCalls')) as { edgeEditBody: number }).edgeEditBody).toBe(1)

        // There is no form for the library to read — the draft the handler wrote is
        // what commits.
        await custom.fill('owns')
        await modalButton(page, 'Edit Edge').click()

        await expect.poll(async () => (await edgeData(page, 'a-b')).label).toBe('owns')
    })

    test('dismissing a session notifies onEdgeEditCancel', async ({ page }) => {
        await harness(page, 'configureWritePath', { edgeEditBody: true })
        await harness(page, 'openEdgeSession', 'a-b')

        await modalButton(page, 'Cancel').click()

        await expect
            .poll(async () => ((await harness(page, 'writePathCalls')) as { edgeEditCancel: number }).edgeEditCancel)
            .toBe(1)
        expect((await edgeData(page, 'a-b')).label).toBe('links')
    })

    test('declared fields replace the inferred ones', async ({ page }) => {
        await loadFixture(page, 'basic', {
            UI: {
                editors: {
                    edgeEditor: {
                        fields: [
                            { key: 'label', label: 'Relationship', type: 'select', defaultValue: 'links', options: [
                                { value: 'links', label: 'links' },
                                { value: 'manages', label: 'manages' },
                            ] },
                            { key: 'confidence', label: 'Confidence', type: 'text', defaultValue: '50' },
                        ],
                    },
                },
            },
        })
        await harness(page, 'configureWritePath', {})
        await harness(page, 'openEdgeSession', 'a-b')

        // The declared form, not one field per existing data key.
        await expect(modal(page).locator('.pvt-form-element')).toHaveCount(2)
        await field(page, 'confidence').fill('90')
        await modalButton(page, 'Edit Edge').click()

        await expect.poll(async () => (await edgeData(page, 'a-b')).confidence).toBe('90')
    })
})
