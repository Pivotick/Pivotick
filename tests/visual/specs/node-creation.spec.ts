import type { Page } from '@playwright/test'
import {
    test,
    expect,
    gotoHarness,
    loadFixture,
    harness,
    nodeEl,
    canvas,
    centerOf,
    waitForViewSettled,
} from '../helpers'

// Interactive node creation: the Create ▸ Add node tool and the canvas menu's
// "Add Node Here", both gated by `onBeforeNodeCreate`. The tool works without a
// hook (a default node); the hook is what makes the node carry real data — or
// refuses it outright.

type PWPage = Page

const setMode = (page: PWPage, mode: string) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    page.evaluate((m) => (window.__pivotick as any).graph.UIManager.modeStore.setMode(m), mode)

const addNodeTool = (page: PWPage) =>
    page.locator('.pvt-toolpanel-tool[data-tool="add-node"]')

const nodeCount = async (page: PWPage): Promise<number> =>
    ((await harness(page, 'counts')) as { nodes: number }).nodes

const createHookCalls = async (page: PWPage): Promise<number> =>
    ((await harness(page, 'writePathCalls')) as { nodeCreate: number }).nodeCreate

const nodeIds = async (page: PWPage): Promise<string[]> =>
    Object.keys((await harness(page, 'nodePositions')) as Record<string, unknown>)

const selectedNodeIds = async (page: PWPage): Promise<string[]> =>
    (await harness(page, 'selectedNodeIds')) as string[]

const nodeData = async (page: PWPage, id: string): Promise<Record<string, unknown>> =>
    (await harness(page, 'nodeData', id)) as Record<string, unknown>

/** The one id that wasn't in the graph before — the node the gesture created. */
function newId(before: string[], after: string[]): string {
    const added = after.filter((id) => !before.includes(id))
    expect(added, 'exactly one node was added').toHaveLength(1)
    return added[0]
}

/** Assert a rendered node sits (within a few px) where the gesture pointed. */
async function expectRenderedAt(page: PWPage, id: string, point: { x: number; y: number }): Promise<void> {
    const box = await nodeEl(page, id).boundingBox()
    expect(box, `node ${id} is rendered`).not.toBeNull()
    const centre = { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 }
    expect(Math.abs(centre.x - point.x), 'placed at the pointed x').toBeLessThan(8)
    expect(Math.abs(centre.y - point.y), 'placed at the pointed y').toBeLessThan(8)
}

/**
 * An empty patch of canvas, clear of the fixture's nodes and the B3 chrome, with
 * enough room to the right/below for the context menu — a menu that overflowed the
 * viewport would make Playwright scroll the page to click it.
 */
async function emptySpot(page: PWPage): Promise<{ x: number; y: number }> {
    // A late-landing initial fit emits `canvasZoom`, which closes the menu we are about
    // to open — so settle the view before handing out a click target.
    await waitForViewSettled(page)
    const box = await canvas(page).boundingBox()
    if (!box) throw new Error('canvas has no bounding box')
    return { x: box.x + box.width - 230, y: box.y + box.height - 170 }
}

test.describe('node creation — the Add node tool', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
        await loadFixture(page, 'basic')
        await setMode(page, 'create')
    })

    test('absent hook: it creates a default node at the view centre and selects it', async ({ page }) => {
        await harness(page, 'configureWritePath', {})
        const before = await nodeIds(page)

        await addNodeTool(page).click()

        await expect.poll(() => nodeCount(page)).toBe(before.length + 1)
        const id = newId(before, await nodeIds(page))
        expect(await nodeData(page, id)).toMatchObject({ label: 'New node' })
        // Selected, so the selection-gated Edit tool can name it straight away.
        expect(await selectedNodeIds(page)).toEqual([id])
        await expectRenderedAt(page, id, await centerOf(canvas(page)))
        expect(await createHookCalls(page)).toBe(0)
    })

    test('the hook supplies the id, data and style, and sees origin "tool"', async ({ page }) => {
        await harness(page, 'configureWritePath', { nodeCreateHook: 'accept-data' })

        await addNodeTool(page).click()

        await expect(nodeEl(page, 'created')).toHaveCount(1)
        expect(await nodeData(page, 'created')).toMatchObject({ label: 'Created', origin: 'tool' })
        expect(await createHookCalls(page)).toBe(1)
    })

    test('a veto creates nothing', async ({ page }) => {
        await harness(page, 'configureWritePath', { nodeCreateHook: 'veto' })
        const before = await nodeCount(page)

        await addNodeTool(page).click()

        await expect.poll(() => createHookCalls(page)).toBe(1)
        expect(await nodeCount(page)).toBe(before)
        expect(await selectedNodeIds(page)).toEqual([])
    })

    test('an async hook creates the node once it settles', async ({ page }) => {
        await harness(page, 'configureWritePath', { nodeCreateHook: 'accept-async', asyncDelayMs: 150 })
        const before = await nodeCount(page)

        await addNodeTool(page).click()

        await expect.poll(() => nodeCount(page)).toBe(before + 1)
    })

    test('ctx.promptData collects the payload through a modal; cancelling vetoes', async ({ page }) => {
        await harness(page, 'configureWritePath', { nodeCreateHook: 'prompt-data' })
        const before = await nodeCount(page)

        await addNodeTool(page).click()
        const body = page.locator('.pvt-prompt-modal-body')
        await body.locator('#pvt-form-element-label').fill('Attribute')
        await body.locator('#pvt-form-element-kind').fill('ip-src')
        await page.locator('.pvt-modal__footer button', { hasText: 'Add' }).click()

        await expect(nodeEl(page, 'prompted')).toHaveCount(1)
        expect(await nodeData(page, 'prompted')).toMatchObject({ label: 'Attribute', kind: 'ip-src' })

        // A cancelled prompt is a veto — nothing else lands.
        await addNodeTool(page).click()
        await page.locator('.pvt-prompt-modal-body').waitFor({ state: 'visible' })
        await page.locator('.pvt-modal__footer button', { hasText: 'Cancel' }).click()
        await expect.poll(() => nodeCount(page)).toBe(before + 1)
    })

    test('the tool is absent when node creation is disabled', async ({ page }) => {
        await loadFixture(page, 'basic', { UI: { editors: { nodeCreator: { enabled: false } } } })
        await setMode(page, 'create')

        await expect(page.locator('.pvt-toolpanel-tool[data-tool="add-edge"]')).toBeVisible()
        await expect(addNodeTool(page)).toHaveCount(0)
    })

    test('the Edit node tool is absent when the node editor is disabled', async ({ page }) => {
        await loadFixture(page, 'basic', { UI: { editors: { nodeEditor: { enabled: false } } } })
        await setMode(page, 'create')

        await expect(addNodeTool(page)).toBeVisible()
        await expect(page.locator('.pvt-toolpanel-tool[data-tool="edit"]')).toHaveCount(0)
    })
})

test.describe('node creation — "Add Node Here"', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
        await loadFixture(page, 'basic')
    })

    test('places the node at the clicked point, and reports origin "context-menu"', async ({ page }) => {
        await harness(page, 'configureWritePath', { nodeCreateHook: 'accept-data' })
        const spot = await emptySpot(page)

        await page.mouse.click(spot.x, spot.y, { button: 'right' })
        await expect(page.locator('.pvt-contextmenu')).toHaveClass(/shown/)
        await page.locator('.pvt-contextmenu .pvt-action-item', { hasText: 'Add Node Here' }).click()

        await expect(nodeEl(page, 'created')).toHaveCount(1)
        expect(await nodeData(page, 'created')).toMatchObject({ origin: 'context-menu' })
        await expectRenderedAt(page, 'created', spot)
    })

    test('the clicked point is right under zoom and pan', async ({ page }) => {
        await harness(page, 'configureWritePath', { nodeCreateHook: 'accept-data' })

        // Zoom in over the middle, then pan — so screen and graph space disagree.
        const centre = await centerOf(canvas(page))
        await page.mouse.move(centre.x, centre.y)
        await page.mouse.wheel(0, -240)
        await page.mouse.down({ button: 'middle' })
        await page.mouse.move(centre.x + 120, centre.y + 80, { steps: 6 })
        await page.mouse.up({ button: 'middle' })

        const spot = await emptySpot(page)
        await page.mouse.click(spot.x, spot.y, { button: 'right' })
        await page.locator('.pvt-contextmenu .pvt-action-item', { hasText: 'Add Node Here' }).click()

        await expect(nodeEl(page, 'created')).toHaveCount(1)
        await expectRenderedAt(page, 'created', spot)
    })

    test('the entry is absent when node creation is disabled', async ({ page }) => {
        await loadFixture(page, 'basic', { UI: { editors: { nodeCreator: { enabled: false } } } })
        const spot = await emptySpot(page)

        await page.mouse.click(spot.x, spot.y, { button: 'right' })
        await expect(page.locator('.pvt-contextmenu')).toHaveClass(/shown/)
        await expect(page.locator('.pvt-contextmenu .pvt-action-item', { hasText: 'Add Node Here' })).toHaveCount(0)
        // The canvas menu's other default is untouched.
        await expect(page.locator('.pvt-contextmenu .pvt-action-item', { hasText: 'Add Note' })).toHaveCount(1)
    })

    test('programmatic addNode bypasses the hook', async ({ page }) => {
        // A veto that refuses every *user* create must not gate consumer code.
        await harness(page, 'configureWritePath', { nodeCreateHook: 'veto' })

        await harness(page, 'addNode', 'programmatic', 0, 200)

        await expect(nodeEl(page, 'programmatic')).toHaveCount(1)
        expect(await createHookCalls(page)).toBe(0)
    })
})
