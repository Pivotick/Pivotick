import type { Locator, Page } from '@playwright/test'
import { test, expect, gotoHarness, loadFixture, harness } from '../helpers'
import type { PivotFixtureSpec } from '../harness/harness'

// Pivot mode (M3): the rail mode that advertises what each pivot can reach, narrows it
// and runs it. The mode is the feature's intent boundary — entering it is what calls a
// provider — so most of what is asserted here is *when a call happens*, which no
// screenshot can see, alongside the panel's own states.

const AIL = 'ail-correlation'
const FULL = { UI: { mode: 'full', sidebar: { collapsed: true }, table: { open: true } } }

const railButton = (page: Page): Locator => page.locator('.pvt-moderail-button[data-mode="pivot"]')
const panel = (page: Page): Locator => page.locator('.pvt-pivot-panel')
const entry = (page: Page, id: string): Locator => page.locator(`.pvt-pivot-entry[data-pivot="${id}"]`)
const count = (page: Page, id: string): Locator => entry(page, id).locator('.pvt-pivot-count')
const breakdown = (page: Page, id: string): Locator => entry(page, id).locator('.pvt-pivot-breakdown')
const refusal = (page: Page, id: string): Locator => entry(page, id).locator('.pvt-pivot-refusal')
const heading = (page: Page): Locator => panel(page).locator('.pvt-pivot-heading')
const originBlock = (page: Page): Locator => panel(page).locator('.pvt-pivot-origin')

const button = (scope: Locator, name: string): Locator => scope.locator('button', { hasText: name }).first()

const load = async (page: Page, spec: PivotFixtureSpec = {}, overrides: object = FULL): Promise<void> => {
    await harness(page, 'loadWithPivots', 'basic', spec, overrides)
    await page.locator('.zoom-layer:not(.hidden)').first().waitFor({ state: 'attached' })
}

/** Which provider calls have happened, as `pivotId:call` pairs. */
const calls = async (page: Page): Promise<string[]> => {
    const log = await harness(page, 'pivotCalls') as Array<{ pivot: string, call: string }>
    return log.map(call => `${call.pivot}:${call.call}`)
}

/**
 * Tick one option of a narrowing multiselect, through the real picker. This is the
 * gesture the whole gate turns on, so it goes through the widget rather than around it.
 */
const narrowTo = async (page: Page, pivotId: string, key: string, option: string): Promise<void> => {
    const field = entry(page, pivotId).locator(`.pvt-form-element:has([data-field-key="${key}"])`)
    await field.locator('.pvt-picker__control').waitFor()
    await field.locator('.pvt-picker__control').click()
    await field.locator('.pvt-picker__option', { hasText: option }).first().click()
    // The picker stays open after a pick (it is a multiselect); an outside click inside
    // the panel closes it, so the buttons underneath are reachable again.
    await entry(page, pivotId).locator('.pvt-pivot-entry-label').click()
    await expect(field.locator('.pvt-picker__dropdown.open')).toHaveCount(0)
}

/** Enter Pivot mode from the rail, the way an analyst does. */
const enterMode = async (page: Page): Promise<void> => {
    await railButton(page).click()
    await panel(page).waitFor()
}

/** Select a node on the canvas — which is what building an origin amounts to. */
const pickOrigin = async (page: Page, nodeId: string): Promise<void> => {
    await harness(page, 'selectNode', nodeId)
}

test.describe('pivot mode', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    // ── the gate (D26) ──────────────────────────────────────────────────────
    test('the rail button exists only while a pivot is registered', async ({ page }) => {
        await loadFixture(page, 'basic', FULL)
        await expect(railButton(page)).toHaveCount(0)

        await harness(page, 'registerTestPivot', AIL)
        await expect(railButton(page)).toHaveCount(1)

        await harness(page, 'unregisterPivot', AIL)
        await expect(railButton(page)).toHaveCount(0)
    })

    test('pivotMode false suppresses the button, true forces it', async ({ page }) => {
        await load(page, {}, { UI: { ...FULL.UI, pivotMode: false } })
        await expect(railButton(page)).toHaveCount(0)

        await loadFixture(page, 'basic', { UI: { ...FULL.UI, pivotMode: true } })
        await expect(railButton(page)).toHaveCount(1)
    })

    // ── D11: the mode boundary is the intent boundary ───────────────────────
    test('selecting a node costs nothing until the mode is entered', async ({ page }) => {
        await load(page)
        await pickOrigin(page, 'a')
        expect(await calls(page)).toEqual([])

        await enterMode(page)
        await expect(count(page, AIL)).toHaveText('~2,143')
        expect(await calls(page)).toEqual([`${AIL}:summarize`, 'search-ail:summarize'])
    })

    test('leaving the mode stops asking, and re-entering serves the cache', async ({ page }) => {
        await load(page)
        await pickOrigin(page, 'a')
        await enterMode(page)
        await expect(count(page, AIL)).toHaveText('~2,143')
        const asked = (await calls(page)).length

        await page.locator('.pvt-moderail-button[data-mode="select"]').click()
        await pickOrigin(page, 'b')
        await pickOrigin(page, 'a')
        expect((await calls(page)).length).toBe(asked)

        // Same question, so the cached answer is painted without a skeleton (S2).
        await enterMode(page)
        await expect(count(page, AIL)).toHaveText('~2,143')
        expect((await calls(page)).length).toBe(asked)
    })

    test('the origin changing while the mode is open re-asks', async ({ page }) => {
        await load(page)
        await pickOrigin(page, 'a')
        await enterMode(page)
        await expect(count(page, AIL)).toHaveText('~2,143')

        await pickOrigin(page, 'b')
        await expect.poll(async () => (await calls(page)).filter(c => c === `${AIL}:summarize`).length)
            .toBe(2)
    })

    // ── the panel's states ──────────────────────────────────────────────────
    test('an empty origin says so and offers the origin-less pivots', async ({ page }) => {
        await load(page)
        await enterMode(page)

        await expect(originBlock(page)).toContainText('Nothing picked')
        await expect(heading(page)).toBeHidden()
        // Only `origin: 'none'` pivots apply to nothing at all (D19).
        await expect(entry(page, 'search-ail')).toBeVisible()
        await expect(entry(page, AIL)).toHaveCount(0)
    })

    test('an origin lists what applies, and folds the origin-less ones away', async ({ page }) => {
        await load(page)
        await pickOrigin(page, 'a')
        await enterMode(page)

        await expect(heading(page)).toHaveText('4 pivots apply')
        await expect(entry(page, AIL)).toBeVisible()
        // Still runnable, just answering a different question (C14).
        await expect(page.locator('.pvt-pivot-originless summary')).toHaveText('Without an origin (1)')
        await expect(page.locator('.pvt-pivot-originless').locator(entry(page, 'search-ail'))).toHaveCount(1)
    })

    test('the summary fills the count line and the breakdown', async ({ page }) => {
        await load(page)
        await pickOrigin(page, 'a')
        await enterMode(page)

        await expect(count(page, AIL)).toHaveText('~2,143')
        await expect(breakdown(page, AIL)).toHaveText('1,800 domains · 210 urls · 95 pastes · 38 ips')
    })

    test('a multi-node origin is one line, never one per node', async ({ page }) => {
        await load(page)
        await harness(page, 'multiSelect', ['a', 'b', 'c'])
        await enterMode(page)

        await expect(count(page, AIL)).toHaveText('~2,143 across 3 nodes')
    })

    test('a pivot with no summarize just offers Run', async ({ page }) => {
        await load(page)
        await pickOrigin(page, 'a')
        await enterMode(page)

        const blind = entry(page, 'blind')
        await expect(count(page, 'blind')).toHaveText('')
        await expect(button(blind, 'Run')).toBeEnabled()
        await expect(button(blind, 'Fetch')).toHaveCount(0)
    })

    test('a declared potential is the number shown before anything is asked', async ({ page }) => {
        await load(page, { pivots: ['misp-event-objects'] })
        await harness(page, 'setNodePotential', 'a', 'misp-event-objects', 2100)
        await pickOrigin(page, 'a')
        await enterMode(page)

        // No summarize on this pivot, so the declared count is all there is (D12).
        await expect(count(page, 'misp-event-objects')).toHaveText('~2,100 declared')
    })

    // ── the gate, and it lifting (D4 — the most important moment in the flow) ──
    test('over the cap Fetch is refused, and narrowing lifts it', async ({ page }) => {
        await load(page)
        await pickOrigin(page, 'a')
        await enterMode(page)

        const ail = entry(page, AIL)
        await expect(refusal(page, AIL)).toHaveText(
            "~2,143 exceeds this pivot's cap of 2,000 — narrow further to fetch"
        )
        await expect(button(ail, 'Fetch')).toBeDisabled()

        // Tick URLs: 210 of the 2,143, so the same question comes back under the cap.
        await narrowTo(page, AIL, 'type', 'URLs')
        await expect(count(page, AIL)).toHaveText('~210')
        await expect(refusal(page, AIL)).toBeHidden()
        await expect(button(ail, 'Fetch')).toBeEnabled()
    })

    test('a fetch stages candidates and links into their pane', async ({ page }) => {
        await load(page)
        await pickOrigin(page, 'a')
        await enterMode(page)
        await narrowTo(page, AIL, 'type', 'URLs')
        await expect(count(page, AIL)).toHaveText('~210')

        const before = (await harness(page, 'counts') as { nodes: number }).nodes
        await button(entry(page, AIL), 'Fetch').click()

        const link = entry(page, AIL).locator('.pvt-pivot-triage-link')
        await expect(link).toHaveText('210 in triage ▸')
        // Staged is not ingested: the graph has not moved (M1's one invariant).
        expect((await harness(page, 'counts') as { nodes: number }).nodes).toBe(before)

        await link.click()
        expect(await harness(page, 'activeDockTabId')).toBe(`pivot-triage:${AIL}`)
    })

    test('a failed summarize offers a retry that asks again', async ({ page }) => {
        await load(page, { fail: true })
        await pickOrigin(page, 'a')
        await enterMode(page)

        await expect(count(page, AIL)).toHaveText("Couldn't reach the source.")
        await harness(page, 'setPivotFail', false)
        await button(entry(page, AIL), 'Retry').click()
        await expect(count(page, AIL)).toHaveText('~2,143')
    })

    // ── the panel is the mode's workspace ───────────────────────────────────
    test('the panel is wider in this mode, and arming a tool keeps it open', async ({ page }) => {
        await load(page)
        await enterMode(page)

        const width = () => page.locator('.pvt-toolpanel').evaluate(
            el => Math.round(el.getBoundingClientRect().width)
        )
        expect(await width()).toBe(300)

        await page.locator('.pvt-toolpanel-tool[data-tool="lasso-origin"]').click()
        await expect(page.locator('.pvt-toolpanel-panel')).not.toHaveClass(/pvt-collapsed/)

        // Back to Select and the built-in width returns.
        await page.locator('.pvt-moderail-button[data-mode="select"]').click()
        expect(await width()).toBe(216)
    })

    test('the rail slot keeps the mode name while its resting tool is armed', async ({ page }) => {
        await load(page)
        await enterMode(page)
        await expect(railButton(page).locator('.pvt-moderail-label')).toHaveText('Pivot')

        await page.locator('.pvt-toolpanel-tool[data-tool="lasso-origin"]').click()
        await expect(railButton(page).locator('.pvt-moderail-label')).toHaveText('Lasso origin')
    })
})
