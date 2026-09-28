import type { Locator, Page } from '@playwright/test'
import { test, expect, gotoHarness, harness } from '../helpers'
import type { PivotFixtureSpec } from '../harness/harness'

/**
 * *Ingest in a group*: a pivot landing folded as it lands, one group per type, by the
 * Pivot landings rule. Read from `graph.simplify` and the canvas's dots.
 *
 * The CORRELATION provider returns `ip-0…ip-37` and `paste-0…paste-94` for the types
 * asked, each linked from the origin `a`; a `seen` floor of N drops the first N of each.
 */

const CORRELATION = 'correlation'
const FULL = { UI: { mode: 'full', sidebar: { collapsed: true }, table: { open: true } } }

interface GroupReading { rule: string, members: string[] }

const footer = (page: Page): Locator => page.locator('.pvt-triage-foot')
const button = (page: Page, name: string): Locator => footer(page).locator('button', { hasText: name }).first()
const toast = (page: Page): Locator => page.locator('.pivotick-toast')

async function landingGroups(page: Page): Promise<GroupReading[]> {
    return page.evaluate(() => window.__pivotick.graph!.simplify.getGroups()
        .filter((group) => group.rule === 'landings')
        .map((group) => ({ rule: group.rule, members: group.members.map((member) => member.id).sort() }))
        .sort((a, b) => a.members[0].localeCompare(b.members[0])))
}

/** How many members each landing group holds, by the type of its first member. */
async function landingSizes(page: Page): Promise<Record<string, number>> {
    const sizes: Record<string, number> = {}
    for (const group of await landingGroups(page)) sizes[group.members[0].split('-')[0]] = group.members.length
    return sizes
}

async function isDrawn(page: Page, id: string): Promise<boolean> {
    return page.evaluate((id) => window.__pivotick.graph!.getCanvasNodes().some((node) => node.id === id), id)
}

const load = async (page: Page, spec: PivotFixtureSpec = {}, ui: object = FULL): Promise<void> => {
    await harness(page, 'loadWithPivots', 'basic', spec, ui)
    await page.locator('.zoom-layer:not(.hidden)').first().waitFor({ state: 'attached' })
}

/** Stage CORRELATION on `a` for these types, then mark every row. */
async function stageAndMarkAll(page: Page, narrowing: Record<string, unknown>): Promise<void> {
    const outcome = await harness(page, 'runPivot', CORRELATION, ['a'], narrowing)
    expect((outcome as { status: string }).status).toBe('staged')
    await page.locator('.pvt-triage-row').first().waitFor()
    await button(page, 'Select all').click()
}

async function ingestInAGroup(page: Page): Promise<void> {
    await button(page, 'Ingest in a group').click()
    await expect(toast(page)).toContainText('Ingested')
}

test.describe('ingest in a group', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    test('lands one group per type, off the origin, with its own rule card first', async ({ page }) => {
        await load(page, { typed: true })
        await stageAndMarkAll(page, { type: ['ip', 'paste'] })
        await expect(button(page, 'Ingest in a group')).toHaveText('Ingest in a group (133)')
        await ingestInAGroup(page)

        await expect.poll(() => landingSizes(page)).toEqual({ ip: 38, paste: 95 })
        expect(await isDrawn(page, 'ip-0')).toBe(false)
        expect(await isDrawn(page, 'a')).toBe(true)
        const anchors = await page.evaluate(() => window.__pivotick.graph!.simplify.getGroups()
            .map((group) => group.anchors.map((anchor) => anchor.id)))
        expect(anchors).toEqual([['a'], ['a']])

        const rules = await page.evaluate(() => window.__pivotick.graph!.simplify.getRules()
            .map((rule) => `${rule.id}:${rule.enabled ? 'on' : 'off'}`))
        expect(rules[0]).toBe('landings:on')
    })

    test('a type with a single node lands as a plain node', async ({ page }) => {
        await load(page, { typed: true })
        await stageAndMarkAll(page, { type: ['ip', 'paste'], seen: { min: 37 } })
        await ingestInAGroup(page)

        await expect.poll(() => landingSizes(page)).toEqual({ paste: 58 })
        expect(await isDrawn(page, 'ip-0')).toBe(true)
    })

    test('a member that gains a link stays in its group', async ({ page }) => {
        await load(page, { typed: true })
        await stageAndMarkAll(page, { type: ['ip'] })
        await ingestInAGroup(page)
        await expect.poll(() => landingSizes(page)).toEqual({ ip: 38 })

        await page.evaluate(() => { window.__pivotick.graph!.addEdge({ from: 'b', to: 'ip-3' }) })
        await expect.poll(() => landingSizes(page)).toEqual({ ip: 38 })
    })

    test('a node already on the canvas stays where it is', async ({ page }) => {
        await load(page, { typed: true, collide: ['b'] })
        await stageAndMarkAll(page, { type: ['ip'] })
        await ingestInAGroup(page)

        const [group] = await landingGroups(page)
        expect(group.members).toHaveLength(37)
        expect(group.members).not.toContain('b')
        expect(await isDrawn(page, 'b')).toBe(true)
    })

    test('undo dissolves the group and redo brings it back', async ({ page }) => {
        await load(page, { typed: true })
        await stageAndMarkAll(page, { type: ['ip'] })
        await ingestInAGroup(page)
        await expect.poll(() => landingSizes(page)).toEqual({ ip: 38 })

        await page.evaluate(() => { window.__pivotick.graph!.history.undo() })
        await expect.poll(() => landingGroups(page)).toEqual([])
        await page.evaluate(() => { window.__pivotick.graph!.history.redo() })
        await expect.poll(() => landingSizes(page)).toEqual({ ip: 38 })
    })

    test('a plain ingest lands loose and adds no rule', async ({ page }) => {
        await load(page, { typed: true })
        await stageAndMarkAll(page, { type: ['ip'] })
        await button(page, 'Ingest selected').click()
        await expect(toast(page)).toContainText('Ingested')

        expect(await landingGroups(page)).toEqual([])
        expect(await isDrawn(page, 'ip-0')).toBe(true)
        const ids = await page.evaluate(() => window.__pivotick.graph!.simplify.getRules().map((rule) => rule.id))
        expect(ids).not.toContain('landings')
    })

    test('is not offered when the graph does not simplify', async ({ page }) => {
        await load(page, { typed: true }, { UI: { ...FULL.UI, simplify: { enabled: false } } })
        await stageAndMarkAll(page, { type: ['ip'] })
        await expect(button(page, 'Ingest selected')).toBeVisible()
        await expect(footer(page).locator('.pvt-triage-ingest-group')).toHaveCount(0)
    })
})
