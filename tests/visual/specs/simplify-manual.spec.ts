import type { Locator, Page } from '@playwright/test'
import { test, expect, gotoHarness, harness, canvas } from '../helpers'

/**
 * Groups made by hand: select nodes, Group, give it a title. Read from `graph.simplify`,
 * the history and the sidebar.
 *
 * The `simplify` fixture: `ev-a` and `ev-b` share six IPs and three TTPs, `ev-a` alone has
 * five domains, `hub` has seven file leaves (`file-0` carries a note), and `lonely` is an IP
 * with no link.
 */

interface GroupReading { id: string, rule: string, members: string[], title?: string, label: string }

async function groups(page: Page): Promise<GroupReading[]> {
    return page.evaluate(() => {
        const simplify = window.__pivotick.graph!.simplify
        return simplify.getGroups().map((group) => ({
            id: group.id,
            rule: group.rule,
            members: group.members.map((member) => member.id).sort(),
            title: group.title,
            label: simplify.labelOf(group),
        }))
    })
}

async function manualGroups(page: Page): Promise<GroupReading[]> {
    return (await groups(page)).filter((group) => group.rule === 'manual')
}

async function groupHolding(page: Page, member: string): Promise<GroupReading | undefined> {
    return (await groups(page)).find((group) => group.members.includes(member))
}

async function select(page: Page, ids: string[]): Promise<void> {
    await page.evaluate((ids) => {
        const graph = window.__pivotick.graph!
        graph.selectElements(ids.map((id) => graph.getMutableNode(id) ?? graph.simplify.getGroupNode(id)!))
    }, ids)
}

async function groupEntries(page: Page): Promise<string[]> {
    const entries = await harness(page, 'historyEntries') as Array<{ kind: string, label: string }>
    return entries.filter((entry) => entry.kind === 'group').map((entry) => entry.label)
}

const undo = (page: Page) => page.evaluate(() => { window.__pivotick.graph!.history.undo() })
const redo = (page: Page) => page.evaluate(() => { window.__pivotick.graph!.history.redo() })

const bulk = (page: Page, action: string): Locator => page.locator(`.pvt-sidebar-bulkaction[data-action="${action}"]`)
const panelAction = (page: Page, action: string): Locator => page.locator(`.pvt-sidebar-group-action[data-action="${action}"]`)
const titleInput = (page: Page): Locator => page.locator('.pvt-group-title-input')
const titleNote = (page: Page): Locator => page.locator('.pvt-group-title-note')

const FULL = { UI: { mode: 'full', sidebar: { collapsed: false } } }
const withNeighbours = { UI: { mode: 'full', sidebar: { collapsed: false }, simplify: { rules: [{ kind: 'neighbours' }] } } }

const load = (page: Page, overrides: Record<string, unknown> = FULL) => harness(page, 'loadSimplify', overrides)

/** Group the selection through the bulk bar, typing this title. */
async function groupThroughBar(page: Page, ids: string[], title: string): Promise<void> {
    await select(page, ids)
    await bulk(page, 'group').click()
    await titleInput(page).fill(title)
    await titleInput(page).press('Enter')
}

test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 })
    await gotoHarness(page)
})

test.describe('grouping a selection by hand', () => {
    test('the bulk bar groups the selection under the typed title and selects the group', async ({ page }) => {
        await load(page)
        await select(page, ['ip-0', 'dom-0', 'lonely'])
        await expect(bulk(page, 'group')).toBeEnabled()
        await expect(bulk(page, 'ungroup')).toBeDisabled()
        await bulk(page, 'group').click()
        await expect(titleInput(page)).toHaveValue('2 × ip, 1 × domain')
        await titleInput(page).fill('Suspects')
        await titleInput(page).press('Enter')

        await expect.poll(() => manualGroups(page)).toEqual([
            expect.objectContaining({ members: ['dom-0', 'ip-0', 'lonely'], title: 'Suspects', label: 'Suspects' }),
        ])
        const [group] = await manualGroups(page)
        expect(group.id).toMatch(/^pvt-manual-/)
        expect(await page.evaluate(() => window.__pivotick.graph!.renderer.getGraphInteraction().getSelectedNodeIDs())).toEqual([group.id])
        await expect(page.locator('.pvt-mainheader-nodeinfo-name')).toHaveText('Suspects')
        const rules = await page.evaluate(() => window.__pivotick.graph!.simplify.getRules().map((rule) => rule.id))
        expect(rules[0]).toBe('manual')
    })

    test('keeping the default title labels the group by its types', async ({ page }) => {
        await load(page)
        await select(page, ['ip-0', 'ip-1'])
        await bulk(page, 'group').click()
        await titleInput(page).press('Enter')
        await expect.poll(() => manualGroups(page)).toEqual([expect.objectContaining({ title: undefined, label: '2 × ip' })])
    })

    test('Esc cancels: no group, no history entry', async ({ page }) => {
        await load(page)
        await select(page, ['ip-0', 'ip-1'])
        await bulk(page, 'group').click()
        await titleInput(page).press('Escape')
        await expect(titleInput(page)).toHaveCount(0)
        expect(await manualGroups(page)).toEqual([])
        expect(await groupEntries(page)).toEqual([])
    })

    test('an annotated node stays out, and the prompt says so', async ({ page }) => {
        await load(page)
        await select(page, ['file-0', 'file-1', 'file-2'])
        await bulk(page, 'group').click()
        await expect(titleNote(page)).toContainText('1 of the selected node stays out')
        await titleInput(page).press('Enter')
        await expect.poll(() => manualGroups(page)).toEqual([expect.objectContaining({ members: ['file-1', 'file-2'] })])
    })

    test('a hand-made group wins over a rule group, and a selected group gives its members', async ({ page }) => {
        await load(page, withNeighbours)
        await expect.poll(async () => (await groupHolding(page, 'ip-0'))?.members.length).toBe(6)
        const ips = (await groupHolding(page, 'ip-0'))!

        await groupThroughBar(page, [ips.id, 'lonely'], 'All IPs')
        await expect.poll(() => groupHolding(page, 'ip-3')).toEqual(expect.objectContaining({
            rule: 'manual', title: 'All IPs', members: ['ip-0', 'ip-1', 'ip-2', 'ip-3', 'ip-4', 'ip-5', 'lonely'],
        }))

        // A node picked into a second hand-made group leaves the first.
        await groupThroughBar(page, ['ip-0', 'dom-0'], 'Pair')
        await expect.poll(async () => (await groupHolding(page, 'ip-0'))?.title).toBe('Pair')
        expect((await groupHolding(page, 'ip-1'))?.members).toHaveLength(6)
    })

    test('group, rename and ungroup are each one undo step', async ({ page }) => {
        await load(page)
        await groupThroughBar(page, ['ip-0', 'ip-1', 'dom-0'], 'Suspects')
        await expect.poll(() => manualGroups(page)).toHaveLength(1)

        await panelAction(page, 'rename').click()
        await titleInput(page).fill('Cleared')
        await titleInput(page).press('Enter')
        await expect.poll(async () => (await manualGroups(page))[0]?.title).toBe('Cleared')

        await panelAction(page, 'ungroup').click()
        await expect.poll(() => manualGroups(page)).toEqual([])
        expect(await groupEntries(page)).toEqual(['Ungrouped “Cleared”', 'Renamed to “Cleared”', 'Grouped “Suspects”'])

        await undo(page)
        await expect.poll(async () => (await manualGroups(page))[0]?.title).toBe('Cleared')
        await undo(page)
        await expect.poll(async () => (await manualGroups(page))[0]?.title).toBe('Suspects')
        await undo(page)
        await expect.poll(() => manualGroups(page)).toEqual([])
        await redo(page)
        await expect.poll(async () => (await manualGroups(page))[0]?.members).toEqual(['dom-0', 'ip-0', 'ip-1'])
    })

    test('an empty title labels the group by its types again', async ({ page }) => {
        await load(page)
        await groupThroughBar(page, ['ip-0', 'ip-1'], 'Pair')
        await panelAction(page, 'rename').click()
        await titleInput(page).fill('')
        await titleInput(page).press('Enter')
        await expect.poll(async () => (await manualGroups(page))[0]?.label).toBe('2 × ip')
    })

    test('the bulk bar ungroups the hand-made groups the selection holds', async ({ page }) => {
        await load(page)
        await groupThroughBar(page, ['ip-0', 'ip-1'], 'A')
        await groupThroughBar(page, ['dom-0', 'dom-1'], 'B')
        await expect.poll(() => manualGroups(page)).toHaveLength(2)
        const ids = (await manualGroups(page)).map((group) => group.id)

        await select(page, ids)
        await expect(bulk(page, 'ungroup')).toBeEnabled()
        await bulk(page, 'ungroup').click()
        await expect.poll(() => manualGroups(page)).toEqual([])
        expect(await groupEntries(page)).toEqual(['Ungrouped 2 groups', 'Grouped “B”', 'Grouped “A”'])
    })

    test('a group down to one member is not drawn, and comes back with its members', async ({ page }) => {
        await load(page)
        await groupThroughBar(page, ['ip-0', 'ip-1', 'ip-2'], 'Trio')
        await expect.poll(() => manualGroups(page)).toHaveLength(1)

        await page.evaluate(() => {
            const graph = window.__pivotick.graph!
            graph.removeNode('ip-1')
            graph.removeNode('ip-2')
        })
        await expect.poll(() => manualGroups(page)).toEqual([])
        await page.evaluate(() => {
            window.__pivotick.graph!.addNode({ id: 'ip-2', data: { type: 'ip' } })
        })
        await expect.poll(async () => (await manualGroups(page))[0]?.members).toEqual(['ip-0', 'ip-2'])
    })

    test('the host can save and restore the hand-made groups', async ({ page }) => {
        await load(page)
        await page.evaluate(() => {
            window.__pivotick.graph!.simplify.setManualGroups([{ id: 'pvt-manual-7', title: 'Kept', members: ['ip-0', 'dom-0'] }])
        })
        await expect.poll(() => manualGroups(page)).toEqual([expect.objectContaining({ id: 'pvt-manual-7', title: 'Kept' })])
        expect(await groupEntries(page)).toEqual([])
        const id = await page.evaluate(() => window.__pivotick.graph!.simplify.groupNodes(['ip-1', 'ip-2']))
        expect(id).toBe('pvt-manual-8')
    })

    test('the context menu groups the selection a node is part of', async ({ page }) => {
        await load(page)
        await select(page, ['ip-0', 'ip-1'])
        await canvas(page).locator('#node-ip-0').click({ button: 'right' })
        await page.locator('.pvt-contextmenu').getByText('Group selected nodes', { exact: true }).click()
        await titleInput(page).press('Enter')
        await expect.poll(async () => (await manualGroups(page))[0]?.members).toEqual(['ip-0', 'ip-1'])
    })

    test('without simplify there is nothing to group', async ({ page }) => {
        await load(page, { UI: { mode: 'full', sidebar: { collapsed: false }, simplify: { enabled: false } } })
        await select(page, ['ip-0', 'ip-1'])
        await expect(page.locator('.pvt-sidebar-bulkactions')).toBeVisible()
        await expect(bulk(page, 'group')).toHaveCount(0)
        await expect(bulk(page, 'ungroup')).toHaveCount(0)
    })
})

/* ---------- groups a host sets at load ---------- */

/** The harness's `HUB_PICKS`: two leaves of each of the four hubs. */
const HUB_PICKS = [0, 1, 2, 3].flatMap((h) => [`leaf-${h}-0`, `leaf-${h}-1`])

const loadHostGroups = (page: Page, group: 'none' | 'closed' | 'open', useWorker: boolean) =>
    harness(page, 'loadHostGroups', group, useWorker)
const pickSpread = (page: Page) => harness(page, 'spreadOf', HUB_PICKS) as Promise<number>

test.describe('groups a host sets right after new Graph()', () => {
    for (const useWorker of [true, false]) {
        test(`an open one is held together by the opening layout (${useWorker ? 'worker' : 'page'})`, async ({ page }) => {
            await loadHostGroups(page, 'none', useWorker)
            const loose = await pickSpread(page)
            await loadHostGroups(page, 'open', useWorker)
            // The live pull is off (the harness disables the simulation), so only the layout
            // pass holds them: about a quarter tighter under manual physics, none without it.
            expect(await pickSpread(page)).toBeLessThan(loose * 0.85)
        })
    }

    test('a closed one is laid out as one dot', async ({ page }) => {
        await page.evaluate(() => {
            const sent: string[][] = []
            ;(window as unknown as { layoutSent: string[][] }).layoutSent = sent
            const post = Worker.prototype.postMessage
            Worker.prototype.postMessage = function (this: Worker, message: { source?: string, nodes?: { id: string }[] }, ...rest: unknown[]) {
                if (message?.source === 'simulation-worker-wrapper') sent.push(message.nodes!.map((node) => node.id))
                return (post as (...args: unknown[]) => void).call(this, message, ...rest)
            } as typeof Worker.prototype.postMessage
        })
        await loadHostGroups(page, 'closed', true)
        const sent = await page.evaluate(() => (window as unknown as { layoutSent: string[][] }).layoutSent)
        expect(sent).toHaveLength(1)
        expect(sent[0]).toContain('pvt-manual-1')
        expect(sent[0].filter((id) => HUB_PICKS.includes(id))).toEqual([])
    })
})
