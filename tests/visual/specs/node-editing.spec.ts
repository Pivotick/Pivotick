import type { Page } from '@playwright/test'
import { test, expect, gotoHarness, loadFixture, harness } from '../helpers'
import type { RecordedDataChange } from '../harness/harness'

const modal = (page: Page) => page.locator('#edit-node-modal')
/** FormFactory renders each field as `#pvt-form-element-<key>`. */
const field = (page: Page, key: string) => modal(page).locator(`#pvt-form-element-${key}`)
const modalButton = (page: Page, label: string) =>
    page.locator('.pvt-modal__footer button', { hasText: label })

const nodeData = async (page: Page, id: string): Promise<Record<string, unknown>> =>
    (await harness(page, 'nodeData', id)) as Record<string, unknown>

const nodeChanges = async (page: Page): Promise<RecordedDataChange[]> =>
    (await harness(page, 'nodeChanges')) as RecordedDataChange[]

test.describe('node editing', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
        await loadFixture(page, 'basic')
    })

    test('opens the node edit modal', async ({ page }) => {
        await harness(page, 'openNodeEditor', 'a')

        const modal = page.locator('#edit-node-modal')
        await expect(modal).toBeVisible()
        // Snapshot just the modal — isolates it from the (separately tested) canvas.
        await expect(modal).toHaveScreenshot('node-edit-modal.png')
    })

    test('committing writes the draft and announces nodeChange', async ({ page }) => {
        // The node twin of the edge edit commit: an interactive edit is a data change,
        // so it reaches the data bus like a programmatic one does.
        await harness(page, 'configureWritePath', {})
        await harness(page, 'openNodeEditor', 'a')

        await field(page, 'label').fill('Alpha')
        await modalButton(page, 'Edit Node').click()

        await expect.poll(async () => (await nodeData(page, 'a')).label).toBe('Alpha')
        await expect(modal(page)).toHaveCount(0)
        const changes = await nodeChanges(page)
        expect(changes).toHaveLength(1)
        expect(changes[0]).toMatchObject({ id: 'a', previous: { label: 'A' }, next: { label: 'Alpha' } })
    })

    test('a vetoed commit announces nothing and leaves the node untouched', async ({ page }) => {
        await harness(page, 'configureWritePath', { nodeEditHook: 'veto' })
        await harness(page, 'openNodeEditor', 'a')

        await field(page, 'label').fill('Alpha')
        await modalButton(page, 'Edit Node').click()

        await expect
            .poll(async () => ((await harness(page, 'writePathCalls')) as { nodeEditCommit: number }).nodeEditCommit)
            .toBe(1)
        expect((await nodeData(page, 'a')).label).toBe('A')
        expect(await nodeChanges(page)).toHaveLength(0)
        await expect(modal(page)).toBeVisible()
    })
})
