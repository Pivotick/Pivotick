import {
    test,
    expect,
    gotoHarness,
    loadFixture,
    harness,
} from '../helpers'

// ── Registered rail modes ────────────────────────────────────────────────────
// The rail's four built-in modes are hardcoded; anything else arrives through
// `addRailMode` and renders below a divider of its own. These cover the door
// itself — ordering, the tool panel it drives, and what happens when a mode is
// taken away — rather than how it looks, because a 54px rail button can move or
// vanish without a screenshot noticing.

/** Current mode-store state, read from the live graph. */
async function modeState(page: import('@playwright/test').Page) {
    return page.evaluate(() =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window.__pivotick as any).graph.UIManager.modeStore.getState()
    )
}

/** Every rail button id, in the order the rail draws them. */
function railButtonIds(page: import('@playwright/test').Page) {
    return page.locator('.pvt-moderail .pvt-moderail-button').evaluateAll(
        buttons => buttons.map(b => (b as HTMLElement).dataset.mode ?? '')
    )
}

const BUILTINS = ['select', 'create', 'view', 'physics']

test.describe('rail-modes', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
        // The harness turns the coming-soon Enrich slot on by default. Off here, so the
        // rail holds exactly the four built-ins and these assertions can be exact.
        await loadFixture(page, 'basic', { UI: { modeRail: { explore: false, enrich: false } } })
    })

    // A plugin installs after the rail has mounted, so this is the path that only
    // works because the rail subscribes to the registry and rebuilds.
    test('a plugin-registered mode appears after the built-ins', async ({ page }) => {
        await harness(page, 'addTestRailModeViaPlugin', { id: 'explore', label: 'Explore' })

        expect(await railButtonIds(page)).toEqual([...BUILTINS, 'explore'])
        expect(await harness(page, 'railModeIds')).toEqual(['explore'])
        // Its own divider separates it from the built-in block.
        await expect(page.locator('.pvt-moderail .pvt-moderail-divider')).toHaveCount(1)
    })

    test('registered modes sort by order, built-ins stay first', async ({ page }) => {
        await harness(page, 'addTestRailMode', { id: 'late', order: 10 })
        await harness(page, 'addTestRailMode', { id: 'early', order: -10 })

        expect(await railButtonIds(page)).toEqual([...BUILTINS, 'early', 'late'])
    })

    test('a duplicate id is refused', async ({ page }) => {
        await harness(page, 'addTestRailMode', { id: 'explore' })
        await harness(page, 'addTestRailMode', { id: 'explore' })

        expect(await harness(page, 'railModeIds')).toEqual(['explore'])
    })

    test('an id colliding with a built-in is refused', async ({ page }) => {
        await harness(page, 'addTestRailMode', { id: 'select' })

        expect(await harness(page, 'railModeIds')).toEqual([])
        expect(await railButtonIds(page)).toEqual(BUILTINS)
    })

    test('clicking the mode activates it and shows its tools', async ({ page }) => {
        await harness(page, 'addTestRailMode', {
            id: 'explore',
            label: 'Explore',
            tools: [{ id: 'expand' }, { id: 'walk' }],
            withRender: true,
        })

        await page.locator('.pvt-moderail-button[data-mode="explore"]').click()
        expect((await modeState(page)).mode).toBe('explore')
        expect(await harness(page, 'railModeEnters')).toEqual(['explore'])

        // The panel is titled by the mode and lists its rows, in order.
        await expect(page.locator('.pvt-toolpanel-title')).toHaveText('Explore')
        const rows = page.locator('.pvt-toolpanel-tool')
        await expect(rows).toHaveCount(2)
        await expect(rows.nth(0)).toHaveAttribute('data-tool', 'expand')

        // `render()` content is appended below the rows, not instead of them.
        await expect(page.locator('.pvt-toolpanel-panel .pvt-test-mode-extra')).toHaveText('Explore extra')

        await rows.nth(0).click()
        expect(await harness(page, 'railToolRuns')).toEqual(['explore:expand'])
    })

    // The panel opens on first entry (unlike Select) so the mode's tools are findable.
    test('the panel opens on first entry unless told otherwise', async ({ page }) => {
        await harness(page, 'addTestRailMode', { id: 'open', tools: [{ id: 'a' }] })
        await harness(page, 'addTestRailMode', { id: 'shut', panelOpen: false, tools: [{ id: 'a' }] })

        await page.locator('.pvt-moderail-button[data-mode="open"]').click()
        await expect(page.locator('.pvt-toolpanel-panel')).not.toHaveClass(/pvt-collapsed/)

        await page.locator('.pvt-moderail-button[data-mode="shut"]').click()
        await expect(page.locator('.pvt-toolpanel-panel')).toHaveClass(/pvt-collapsed/)
    })

    // The rail slot reflects the armed tool, taken off the tool itself.
    test('arming a toggle tool morphs the mode slot', async ({ page }) => {
        await harness(page, 'addTestRailMode', {
            id: 'explore',
            label: 'Explore',
            tools: [{ id: 'walk', label: 'Path walk', kind: 'toggle' }],
        })

        const slot = page.locator('.pvt-moderail-button[data-mode="explore"]')
        await slot.click()
        await expect(slot.locator('.pvt-moderail-label')).toHaveText('Explore')

        await page.locator('.pvt-toolpanel-tool[data-tool="walk"]').click()
        expect((await modeState(page)).armedTool.explore).toBe('walk')
        await expect(slot.locator('.pvt-moderail-label')).toHaveText('Path walk')
    })

    test('a shortcut activates the mode', async ({ page }) => {
        await harness(page, 'addTestRailMode', { id: 'explore', shortcut: 'E' })

        await page.locator('.pvt-layout').click({ position: { x: 5, y: 5 } })
        await page.keyboard.press('e')
        expect((await modeState(page)).mode).toBe('explore')
    })

    // Removing the mode a user is standing in has to leave them somewhere real.
    test('disposing the active mode sees it out and falls back to Select', async ({ page }) => {
        await harness(page, 'addTestRailMode', { id: 'explore' })
        await page.locator('.pvt-moderail-button[data-mode="explore"]').click()
        expect((await modeState(page)).mode).toBe('explore')

        await harness(page, 'removeTestRailMode', 'explore')

        expect(await harness(page, 'railModeExits')).toEqual(['explore'])
        expect((await modeState(page)).mode).toBe('select')
        expect(await railButtonIds(page)).toEqual(BUILTINS)
        // The disposer is idempotent — a second call is a no-op, not a second exit.
        await harness(page, 'removeTestRailMode', 'explore')
        expect(await harness(page, 'railModeExits')).toEqual(['explore'])
    })

    test('a flyout mode mounts its panel and takes it away again', async ({ page }) => {
        await harness(page, 'addTestRailMode', { id: 'inspect', label: 'Inspect', kind: 'flyout' })

        const panel = page.locator('.pvt-flyout-panel.pvt-flyout-inspect')
        await expect(panel).toHaveCount(1)
        await expect(panel).not.toHaveClass(/open/)

        await page.locator('.pvt-moderail-button[data-mode="inspect"]').click()
        await expect(panel).toHaveClass(/open/)
        expect((await modeState(page)).mode).toBe('inspect')

        // Exclusive with the built-in flyouts, for free — one store, one active mode.
        await page.locator('.pvt-moderail-button[data-mode="view"]').click()
        await expect(panel).not.toHaveClass(/open/)
        await expect(page.locator('.pvt-flyout-panel.pvt-flyout-view')).toHaveClass(/open/)

        await harness(page, 'removeTestRailMode', 'inspect')
        await expect(page.locator('.pvt-flyout-panel.pvt-flyout-inspect')).toHaveCount(0)
    })

    // A mode declaring `tools` as a function gets them re-read, so the row set can
    // follow the selection rather than only greying out.
    test('a flyout mode with no factory is refused', async ({ page }) => {
        await page.evaluate(() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const g = (window.__pivotick as any).graph
            g.UIManager.addRailMode({ id: 'broken', label: 'Broken', icon: '<svg></svg>', kind: 'flyout' })
        })

        expect(await harness(page, 'railModeIds')).toEqual([])
    })
})
