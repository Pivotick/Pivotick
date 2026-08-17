import type { Page } from '@playwright/test'
import {
    test,
    expect,
    gotoHarness,
    loadFixture,
    harness,
} from '../helpers'
import type { RecordedEdgeChange } from '../harness/harness'

// Editing an *existing* edge — the edge twin of `node-editing.spec.ts`. The edge
// context menu opens a session, the modal writes the draft, and
// `onBeforeEdgeEditCommit` gates the commit: accepted writes the data and announces
// `edgeChange`, refused leaves the edge exactly as it was.

const EDIT_BUTTON = '.pvt-modal__footer button'

const edgeData = async (page: Page, id: string): Promise<Record<string, unknown>> =>
    (await harness(page, 'edgeData', id)) as Record<string, unknown>

const edgeChanges = async (page: Page): Promise<RecordedEdgeChange[]> =>
    (await harness(page, 'edgeChanges')) as RecordedEdgeChange[]

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
        await field(page, 'label').fill('flows-to')
        await modalButton(page, 'Edit Edge').click()

        await expect.poll(async () => (await edgeData(page, 'b-c')).label).toBe('flows-to')
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
