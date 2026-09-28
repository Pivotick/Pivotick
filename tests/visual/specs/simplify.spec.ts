import { test, expect, gotoHarness, harness, canvas, openNodeTooltip } from '../helpers'
import type { Page } from '@playwright/test'

/**
 * `UI.simplify` — nodes that play the same role fold into one group drawn in their place,
 * and the Simplify rail mode that switches the rules.
 *
 * Read from the graph and the DOM rather than screenshotted, except for one picture of
 * the default look: what matters is exactly which nodes fold and where their lines go.
 *
 * The `simplify` fixture: `ev-a` and `ev-b` share six IPs and three TTPs, `ev-a` alone has
 * five domains, and `hub` has seven file leaves, `file-0` carrying a note. `lonely` is an
 * IP with no link at all.
 */

const IPS = ['ip-0', 'ip-1', 'ip-2', 'ip-3', 'ip-4', 'ip-5']
const DOMAINS = ['dom-0', 'dom-1', 'dom-2', 'dom-3', 'dom-4']
const UNANNOTATED_FILES = ['file-1', 'file-2', 'file-3', 'file-4', 'file-5', 'file-6']

interface GroupReading { id: string, rule: string, members: string[], anchors: string[], open: boolean }

/* ---------- readers ---------- */

async function groups(page: Page): Promise<GroupReading[]> {
    return page.evaluate(() => window.__pivotick.graph!.simplify.getGroups().map((group) => ({
        id: group.id,
        rule: group.rule,
        members: group.members.map((member) => member.id).sort(),
        anchors: group.anchors.map((anchor) => anchor.id).sort(),
        open: group.open,
    })))
}

/** Each group's members, sorted, so a test states the partition it expects. */
async function partition(page: Page): Promise<string[][]> {
    return (await groups(page)).map((group) => group.members).sort((a, b) => a[0].localeCompare(b[0]))
}

async function groupHolding(page: Page, member: string): Promise<GroupReading | undefined> {
    return (await groups(page)).find((group) => group.members.includes(member))
}

/** The ids of the dots on the main canvas, groups included. */
async function canvasNodeIds(page: Page): Promise<string[]> {
    return page.evaluate(() => window.__pivotick.graph!.getCanvasNodes().map((node) => node.id).sort())
}

/** The lines the canvas draws, as `from->to`. */
async function drawnLines(page: Page): Promise<string[]> {
    return page.evaluate(() => window.__pivotick.graph!.getDrawnEdges().map((edge) => `${edge.from.id}->${edge.to.id}`).sort())
}

async function expectPartition(page: Page, expected: string[][]): Promise<void> {
    const sorted = expected.map((members) => members.slice().sort()).sort((a, b) => a[0].localeCompare(b[0]))
    await expect.poll(() => partition(page)).toEqual(sorted)
}

/* ---------- the flyout ---------- */

const railButton = (page: Page) => page.locator('.pvt-moderail-button[data-mode="simplify"]')
const railCount = (page: Page) => railButton(page).locator('.pvt-moderail-count')
const ruleCard = (page: Page, id: string) => page.locator(`.pvt-simplifyflyout-rule[data-rule="${id}"]`)
const ruleSwitch = (page: Page, id: string) => ruleCard(page, id).locator('.pvt-simplifyflyout-rule-switch')
const ruleResult = (page: Page, id: string) => ruleCard(page, id).locator('.pvt-simplifyflyout-rule-result')
const stepperButton = (page: Page, id: string, step: 1 | -1) => ruleCard(page, id).locator(`.pvt-simplifyflyout-stepper button[data-step="${step}"]`)

async function openSimplifyFlyout(page: Page): Promise<void> {
    await railButton(page).click()
    await expect(page.locator('.pvt-flyout-panel.pvt-flyout-simplify')).toHaveClass(/open/)
}

const loadSimplify = (page: Page, overrides: Record<string, unknown> = {}, fixture: 'simplify' | 'simplifyClusters' = 'simplify', look = false) =>
    harness(page, 'loadSimplify', overrides, fixture, look)

const withNeighbours = (extra: Record<string, unknown> = {}) =>
    ({ UI: { mode: 'full', simplify: { rules: [{ kind: 'neighbours', ...extra }] } } })

test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 })
    await gotoHarness(page)
})

test.describe('defaults', () => {
    test('full mode offers the neighbour rule switched off, and folds nothing', async ({ page }) => {
        await loadSimplify(page, { UI: { mode: 'full' } })
        await expect(railButton(page)).toBeVisible()
        await expect(railCount(page)).toBeHidden()
        expect(await groups(page)).toEqual([])

        await openSimplifyFlyout(page)
        await expect(ruleCard(page, 'neighbours')).toHaveClass(/pvt-simplifyflyout-rule-off/)
        await expect(ruleSwitch(page, 'neighbours')).toHaveAttribute('aria-pressed', 'false')
    })

    test('light mode shows nothing unless rules are declared', async ({ page }) => {
        await loadSimplify(page)
        await expect(railButton(page)).toHaveCount(0)
        expect(await groups(page)).toEqual([])

        await loadSimplify(page, { UI: { simplify: { rules: [{ kind: 'neighbours' }] } } })
        await expect(railButton(page)).toBeVisible()
        expect((await groups(page)).length).toBeGreaterThan(0)
    })

    test('enabled: false removes the feature', async ({ page }) => {
        await loadSimplify(page, { UI: { mode: 'full', simplify: { enabled: false, rules: [{ kind: 'neighbours' }] } } })
        await expect(railButton(page)).toHaveCount(0)
        expect(await groups(page)).toEqual([])
    })
})

test.describe('the neighbour rule', () => {
    test('folds nodes of one type with exactly the same neighbours', async ({ page }) => {
        await loadSimplify(page, withNeighbours())
        // TTPs are three, under the smallest group of five; file-0 carries a note; the
        // lone IP has no neighbour to hang off.
        await expectPartition(page, [IPS, DOMAINS, UNANNOTATED_FILES])
        expect(await groupHolding(page, 'ip-0')).toMatchObject({ rule: 'neighbours', anchors: ['ev-a', 'ev-b'] })
        expect(await groupHolding(page, 'ttp-0')).toBeUndefined()
        expect(await groupHolding(page, 'file-0')).toBeUndefined()
        expect(await groupHolding(page, 'lonely')).toBeUndefined()
    })

    test('a group is drawn in its members\' place and their lines land on it', async ({ page }) => {
        await loadSimplify(page, withNeighbours())
        const ipGroup = (await groupHolding(page, 'ip-0'))!
        const canvasIds = await canvasNodeIds(page)
        expect(canvasIds).toContain(ipGroup.id)
        for (const ip of IPS) expect(canvasIds).not.toContain(ip)

        const lines = await drawnLines(page)
        // Twelve edges, two lines: one per anchor.
        expect(lines.filter((line) => line.endsWith(`->${ipGroup.id}`))).toEqual([`ev-a->${ipGroup.id}`, `ev-b->${ipGroup.id}`])
        expect(lines.some((line) => IPS.some((ip) => line.includes(ip)))).toBe(false)
        await expect(page.locator(`#node-${(await page.evaluate((id) => window.__pivotick.graph!.simplify.getGroupNode(id)!.domID, ipGroup.id))}`)).toBeAttached()
    })

    test('groups are view state: the data still holds every real node', async ({ page }) => {
        await loadSimplify(page, withNeighbours())
        const dataIds = await page.evaluate(() => window.__pivotick.graph!.getNodes().map((node) => node.id))
        expect(dataIds).toEqual(expect.arrayContaining([...IPS, ...DOMAINS, ...UNANNOTATED_FILES]))
        expect(dataIds.some((id) => id.startsWith('pvt-group-'))).toBe(false)
        // What the header's "Showing N nodes" counts: real nodes, folded ones included.
        expect(await page.evaluate(() => window.__pivotick.graph!.getMutableVisibleNodes().length)).toBe(25)
    })

    test('the table reads a folded node as grouped', async ({ page }) => {
        await loadSimplify(page, withNeighbours())
        const readings = await page.evaluate(async () => {
            const { nodeVisibility } = await import('/src/ui/elements/Table/TableColumns.ts')
            const graph = window.__pivotick.graph!
            return Object.fromEntries(['ip-0', 'ttp-0', 'file-0'].map((id) => [id, nodeVisibility(graph.getMutableNode(id)!, graph)]))
        })
        expect(readings).toEqual({ 'ip-0': 'grouped', 'ttp-0': 'visible', 'file-0': 'visible' })
    })
})

test.describe('the Simplify flyout', () => {
    test('switching the rule on folds, and the rail counts the groups', async ({ page }) => {
        await loadSimplify(page, { UI: { mode: 'full' } })
        await openSimplifyFlyout(page)
        await ruleSwitch(page, 'neighbours').click()

        await expectPartition(page, [IPS, DOMAINS, UNANNOTATED_FILES])
        await expect(railCount(page)).toHaveText('3')
        await expect(railButton(page)).toHaveAttribute('title', 'Simplify: 3 groups, 17 nodes folded')
        await expect(ruleResult(page, 'neighbours')).toHaveText('3 groups · 17 nodes')
        await expect(page.locator('[data-summary="shown"]')).toHaveText('11 of 25 nodes')
        await expect(page.locator('[data-summary="folded"]')).toHaveText('17 folded')
    })

    test('the stepper regroups on each click and says when nothing folds', async ({ page }) => {
        await loadSimplify(page, withNeighbours())
        await openSimplifyFlyout(page)
        await stepperButton(page, 'neighbours', 1).click()
        await stepperButton(page, 'neighbours', 1).click()
        await expect(ruleResult(page, 'neighbours')).toHaveText('Nothing to fold at 7 or more')
        await expect(railCount(page)).toBeHidden()
        expect(await groups(page)).toEqual([])

        await stepperButton(page, 'neighbours', -1).click()
        await stepperButton(page, 'neighbours', -1).click()
        await stepperButton(page, 'neighbours', -1).click()
        await stepperButton(page, 'neighbours', -1).click()
        // Down to three: the TTPs fold too.
        await expect(ruleResult(page, 'neighbours')).toHaveText('4 groups · 20 nodes')
    })

    test('an app rule carries a tag, and one that throws is switched off', async ({ page }) => {
        await loadSimplify(page, withNeighbours())
        await page.evaluate(() => {
            window.__pivotick.graph!.simplify.setRules([
                { kind: 'neighbours' },
                {
                    kind: 'custom', id: 'ttps', label: 'TTPs', description: 'Every TTP in one group.',
                    partition: (view) => new Map(view.nodes.filter((node) => view.typeOf(node) === 'ttp').map((node) => [node.id, 'ttp'])),
                },
                { kind: 'custom', id: 'broken', partition: () => { throw new Error('boom') } },
            ])
        })
        await expectPartition(page, [IPS, DOMAINS, UNANNOTATED_FILES, ['ttp-0', 'ttp-1', 'ttp-2']])

        await openSimplifyFlyout(page)
        await expect(ruleCard(page, 'ttps').locator('.pvt-simplifyflyout-rule-app')).toHaveText('app')
        await expect(ruleCard(page, 'ttps').locator('.pvt-simplifyflyout-rule-order')).toHaveText('2')
        await expect(ruleSwitch(page, 'broken')).toHaveAttribute('aria-pressed', 'false')
        await expect(ruleResult(page, 'broken')).toHaveText('This rule failed')
    })
})

test.describe('recomputing', () => {
    test('a node filter regroups, and the group keeps its id', async ({ page }) => {
        await loadSimplify(page, withNeighbours())
        const before = (await groupHolding(page, 'ip-0'))!

        await page.evaluate(() => window.__pivotick.graph!.queryEngine.excludeNode('ev-b'))
        await expect.poll(async () => (await groupHolding(page, 'ip-0'))?.anchors).toEqual(['ev-a'])
        expect((await groupHolding(page, 'ip-0'))!.id).toBe(before.id)
    })

    test('a new node with the same neighbours joins the existing group', async ({ page }) => {
        await loadSimplify(page, withNeighbours())
        const before = (await groupHolding(page, 'ip-0'))!
        await page.evaluate(() => {
            const graph = window.__pivotick.graph!
            graph.addNode({ id: 'ip-new', data: { type: 'ip' } } as never)
            graph.addEdge({ id: 'ev-a-ip-new', from: 'ev-a', to: 'ip-new' } as never)
            graph.addEdge({ id: 'ev-b-ip-new', from: 'ev-b', to: 'ip-new' } as never)
        })
        await expect.poll(async () => (await groupHolding(page, 'ip-new'))?.id).toBe(before.id)
    })

    test('a node that gains a link leaves its group', async ({ page }) => {
        await loadSimplify(page, withNeighbours())
        await page.evaluate(() => window.__pivotick.graph!.addEdge({ id: 'dom-0-hub', from: 'dom-0', to: 'hub' } as never))
        // Four domains left, under the smallest group: the group dissolves.
        await expect.poll(() => groupHolding(page, 'dom-1')).toBeUndefined()
        expect(await canvasNodeIds(page)).toEqual(expect.arrayContaining(DOMAINS))
    })

    test('pull out and put back, open and close', async ({ page }) => {
        await loadSimplify(page, withNeighbours())
        await page.evaluate(() => window.__pivotick.graph!.simplify.pullOut('ip-0'))
        await expect.poll(async () => (await groupHolding(page, 'ip-1'))?.members).toEqual(IPS.slice(1))
        expect(await canvasNodeIds(page)).toContain('ip-0')

        await page.evaluate(() => window.__pivotick.graph!.simplify.putBack('ip-0'))
        await expect.poll(async () => (await groupHolding(page, 'ip-1'))?.members).toEqual(IPS)

        const domGroup = (await groupHolding(page, 'dom-0'))!
        await page.evaluate((id) => window.__pivotick.graph!.simplify.open(id), domGroup.id)
        await expect.poll(async () => (await groupHolding(page, 'dom-0'))?.open).toBe(true)
        expect(await canvasNodeIds(page)).toEqual(expect.arrayContaining(DOMAINS))
        expect(await canvasNodeIds(page)).not.toContain(domGroup.id)

        await page.evaluate((id) => window.__pivotick.graph!.simplify.close(id), domGroup.id)
        await expect.poll(() => canvasNodeIds(page)).toContain(domGroup.id)
    })
})

test.describe('clusters', () => {
    test('closed clusters group; an expanded one is exempt while open', async ({ page }) => {
        await loadSimplify(page, { ...withNeighbours({ minSize: 4 }), render: { enableNodeExpansion: true } }, 'simplifyClusters')
        // c0's child links to x, so c0's drawn neighbours differ from the other five.
        await expectPartition(page, [['c1', 'c2', 'c3', 'c4', 'c5']])
        expect(await drawnLines(page)).toContain('c0->x')

        const before = (await groupHolding(page, 'c1'))!
        await page.evaluate(() => window.__pivotick.graph!.simplify.open(window.__pivotick.graph!.simplify.getGroups()[0]))
        await page.evaluate(() => {
            const graph = window.__pivotick.graph!
            graph.toggleExpandNode(graph.getMutableNode('c1')!)
        })
        await expectPartition(page, [['c2', 'c3', 'c4', 'c5']])
        expect((await groupHolding(page, 'c2'))!.id).toBe(before.id)
    })
})

test.describe('the look', () => {
    test('groupStyle and typeLabel override the default', async ({ page }) => {
        // The harness's look: IP groups drawn black, types named `6 IPs`.
        await loadSimplify(page, withNeighbours(), 'simplify', true)
        const readStyle = (member: string) => page.evaluate((id) => {
            const simplify = window.__pivotick.graph!.simplify
            const node = simplify.getGroupNode(simplify.groupOf(id)!.id)!
            return { color: node.getStyle().color, label: node.getData().label }
        }, member)
        expect(await readStyle('ip-0')).toEqual({ color: '#111111', label: '6 IPs' })
        expect(await readStyle('dom-0')).toEqual({ color: '#10b981', label: '5 domains' })
    })

    test('the default look: a ringed disc with its count, the label below', async ({ page }) => {
        await loadSimplify(page, withNeighbours())
        await expect(page.locator('.pvt-group-count')).toHaveCount(3)
        await expect(canvas(page)).toHaveScreenshot('simplify-default-look.png')
    })
})

/* ---------- interaction ---------- */

/** The DOM id suffix of the group holding a member, as `#node-<domID>` uses it. */
async function groupDomId(page: Page, member: string): Promise<string> {
    return page.evaluate((id) => {
        const simplify = window.__pivotick.graph!.simplify
        return simplify.getGroupNode(simplify.groupOf(id)!.id)!.domID
    }, member)
}

const groupDot = async (page: Page, member: string) => canvas(page).locator(`#node-${await groupDomId(page, member)}`)
const chip = (page: Page) => page.locator('.pvt-group-chip')
const groupPanel = (page: Page) => page.locator('.pvt-sidebar-group')
const panelAction = (page: Page, action: string) => groupPanel(page).locator(`.pvt-sidebar-group-action[data-action="${action}"]`)
const memberRows = (page: Page) => groupPanel(page).locator('.pvt-table-row')
const menuEntry = (page: Page, text: string) => page.locator('.pvt-contextmenu').getByText(text, { exact: true })

/** Whether focus mode greys this node out: it is neither selected nor one line away. */
async function isDimmed(page: Page, id: string): Promise<boolean> {
    return page.evaluate((nodeId) => {
        const graph = window.__pivotick.graph!
        const node = graph.getCanvasNode(nodeId) ?? graph.simplify.getGroupNode(nodeId)
        return !!node?.getGraphElement()?.classList.contains('pvt-node-selected-highlight-shadow')
    }, id)
}

async function selectGroupOf(page: Page, member: string): Promise<void> {
    await page.evaluate((id) => {
        const graph = window.__pivotick.graph!
        graph.selectElement(graph.simplify.getGroupNode(graph.simplify.groupOf(id)!.id)!)
    }, member)
}

async function selectedIds(page: Page): Promise<string[]> {
    return page.evaluate(() => (window.__pivotick.graph!.renderer.getGraphInteraction().getSelectedNodeIDs() ?? []).slice().sort())
}

/** Full mode with the sidebar open, so the group panel can be clicked. */
const withPanels = (extra: Record<string, unknown> = {}) =>
    ({ UI: { mode: 'full', sidebar: { collapsed: false }, simplify: { rules: [{ kind: 'neighbours' }], ...extra } } })

test.describe('opening a group', () => {
    test('an open group draws a wash and a chip; the chip folds it back', async ({ page }) => {
        await loadSimplify(page, withNeighbours())
        const domains = (await groupHolding(page, 'dom-0'))!
        await page.evaluate((id) => window.__pivotick.graph!.simplify.open(id), domains.id)

        await expect(page.locator(`.pvt-group-outline[data-group="${domains.id}"]`)).toHaveAttribute('d', /^M/)
        await expect(chip(page)).toHaveText('5 × domain×')
        await expect(canvas(page)).toHaveScreenshot('simplify-open-group.png')

        await chip(page).click()
        await expect.poll(async () => (await groupHolding(page, 'dom-0'))?.open).toBe(false)
        await expect(chip(page)).toHaveCount(0)
    })

    test('render.groupOutline names the chip', async ({ page }) => {
        await loadSimplify(page, withNeighbours())
        await page.evaluate(() => {
            // Functions don't cross into the page, so the option is set there.
            window.__pivotick.graph!.getOptions().render!.groupOutline = () => 'Domains of A'
            const simplify = window.__pivotick.graph!.simplify
            simplify.open(simplify.groupOf('dom-0')!)
        })
        await expect(page.locator('.pvt-group-chip-label')).toHaveText('Domains of A')
    })

    test('double-clicking a group opens it', async ({ page }) => {
        await loadSimplify(page, withNeighbours())
        await (await groupDot(page, 'dom-0')).dblclick()
        await expect.poll(async () => (await groupHolding(page, 'dom-0'))?.open).toBe(true)
    })

    test('above openConfirmAbove, a double-click asks first instead of opening', async ({ page }) => {
        await loadSimplify(page, { UI: { mode: 'full', simplify: { rules: [{ kind: 'neighbours' }], openConfirmAbove: 3 } } })
        await (await groupDot(page, 'dom-0')).dblclick()
        const toast = page.locator('.pivotick-toast').filter({ hasText: 'Put 5 × domain on the canvas?' })
        await expect(toast).toBeVisible()
        expect((await groupHolding(page, 'dom-0'))!.open).toBe(false)

        await toast.locator('.pivotick-toast-action').click()
        await expect.poll(async () => (await groupHolding(page, 'dom-0'))?.open).toBe(true)
    })
})

test.describe('selecting a group', () => {
    test('focus mode lights a selected group and its anchors, and nothing else', async ({ page }) => {
        await loadSimplify(page, withNeighbours())
        await selectGroupOf(page, 'ip-0')
        const ipGroup = (await groupHolding(page, 'ip-0'))!
        // The group and the two events its lines run to stay lit.
        expect(await isDimmed(page, ipGroup.id)).toBe(false)
        expect(await isDimmed(page, 'ev-a')).toBe(false)
        expect(await isDimmed(page, 'ev-b')).toBe(false)
        // A node with no line to the group is greyed out.
        expect(await isDimmed(page, 'hub')).toBe(true)
    })

    test('selecting an anchor lights the groups hanging off it', async ({ page }) => {
        await loadSimplify(page, withNeighbours())
        await page.evaluate(() => window.__pivotick.graph!.selectElement(window.__pivotick.graph!.getMutableNode('ev-a')!))
        expect(await isDimmed(page, (await groupHolding(page, 'ip-0'))!.id)).toBe(false)
        expect(await isDimmed(page, (await groupHolding(page, 'dom-0'))!.id)).toBe(false)
        expect(await isDimmed(page, (await groupHolding(page, 'file-1'))!.id)).toBe(true)
    })

    test('a selected group that dissolves leaves the selection', async ({ page }) => {
        await loadSimplify(page, withNeighbours())
        await selectGroupOf(page, 'dom-0')
        await page.evaluate(() => window.__pivotick.graph!.simplify.setRuleMinSize('neighbours', 10))
        await expect.poll(() => selectedIds(page)).toEqual([])
    })
})

test.describe('the group tooltip', () => {
    test('names the group, its rule and what it links to', async ({ page }) => {
        await loadSimplify(page, withNeighbours())
        const tip = await openNodeTooltip(page, await groupDomId(page, 'ip-0'))
        await expect(tip.locator('.pvt-mainheader-nodeinfo-name')).toHaveText('6 × ip')
        await expect(tip.locator('.pvt-mainheader-nodeinfo-subtitle')).toHaveText('Group · Same neighbours')
        await expect(tip.locator('.pvt-group-summary-chip-label')).toHaveText(['EV-A', 'EV-B'])
        await expect(tip.locator('.pvt-group-summary-hint')).toHaveText('Double-click to open · Select for the member list')
    })

    test('renderGroupExtra adds its own lines', async ({ page }) => {
        await loadSimplify(page, withNeighbours())
        await page.evaluate(() => {
            window.__pivotick.graph!.UIManager.getOptions().tooltip.renderGroupExtra = (group) => `${group.members.length} members`
        })
        const tip = await openNodeTooltip(page, await groupDomId(page, 'ip-0'))
        await expect(tip.locator('.pivotick-extra-content-container')).toHaveText('6 members')
    })
})

test.describe('the group sidebar', () => {
    test('lists the members and the actions; Edit is disabled', async ({ page }) => {
        await loadSimplify(page, withPanels())
        await selectGroupOf(page, 'ip-0')
        await expect(groupPanel(page)).toBeVisible()
        await expect(page.locator('.pvt-properties-panel')).toBeHidden()
        await expect(memberRows(page)).toHaveCount(6)
        await expect(panelAction(page, 'open')).toBeEnabled()
        await expect(panelAction(page, 'select-members')).toBeEnabled()
        await expect(panelAction(page, 'delete')).toHaveText('Delete 6')
        await expect(panelAction(page, 'edit')).toBeDisabled()
    })

    test('Pull out takes one member out of the group', async ({ page }) => {
        await loadSimplify(page, withPanels())
        await selectGroupOf(page, 'ip-0')
        await memberRows(page).filter({ hasText: 'ip-2' }).locator('.pvt-table-row-action').click()
        await expect.poll(async () => (await groupHolding(page, 'ip-0'))?.members).toEqual(IPS.filter((ip) => ip !== 'ip-2'))
        expect(await canvasNodeIds(page)).toContain('ip-2')
        await expect(memberRows(page)).toHaveCount(5)
    })

    test('Open becomes Close, and the group stays selected', async ({ page }) => {
        await loadSimplify(page, withPanels())
        await selectGroupOf(page, 'dom-0')
        await panelAction(page, 'open').click()
        await expect.poll(async () => (await groupHolding(page, 'dom-0'))?.open).toBe(true)
        await expect(panelAction(page, 'close')).toBeVisible()
        // An open group's members are what the canvas draws of it, so they stay lit.
        expect(await isDimmed(page, 'dom-0')).toBe(false)

        await panelAction(page, 'close').click()
        await expect.poll(async () => (await groupHolding(page, 'dom-0'))?.open).toBe(false)
    })

    test('above openConfirmAbove, Open asks inline', async ({ page }) => {
        await loadSimplify(page, withPanels({ openConfirmAbove: 3 }))
        await selectGroupOf(page, 'dom-0')
        await panelAction(page, 'open').click()
        await expect(groupPanel(page).locator('.pvt-sidebar-group-ask')).toHaveText('Put 5 × domain on the canvas?')
        expect((await groupHolding(page, 'dom-0'))!.open).toBe(false)

        await panelAction(page, 'confirm-open').click()
        await expect.poll(async () => (await groupHolding(page, 'dom-0'))?.open).toBe(true)
    })

    test('Select members opens the group and selects them', async ({ page }) => {
        await loadSimplify(page, withPanels())
        await selectGroupOf(page, 'dom-0')
        await panelAction(page, 'select-members').click()
        await expect.poll(() => selectedIds(page)).toEqual(DOMAINS)
        expect((await groupHolding(page, 'dom-0'))!.open).toBe(true)
    })

    test('Delete removes the members through the delete hook', async ({ page }) => {
        await loadSimplify(page, withPanels())
        await page.evaluate(() => {
            const graph = window.__pivotick.graph!
            ;(window as unknown as { asked: number }).asked = 0
            graph.getOptions().callbacks = graph.getOptions().callbacks ?? {}
            graph.getOptions().callbacks!.onBeforeDelete = (context) => {
                ;(window as unknown as { asked: number }).asked = context.nodes.length
                return true
            }
        })
        await selectGroupOf(page, 'dom-0')
        await panelAction(page, 'delete').click()
        await expect.poll(() => page.evaluate(() => (window as unknown as { asked: number }).asked)).toBe(5)
        await expect.poll(() => page.evaluate(() => window.__pivotick.graph!.getNodes().some((node) => node.id.startsWith('dom-')))).toBe(false)
    })
})

test.describe('the group context menu', () => {
    test('offers the group actions, not the single-node ones', async ({ page }) => {
        await loadSimplify(page, withNeighbours())
        await (await groupDot(page, 'ip-0')).click({ button: 'right' })
        await expect(menuEntry(page, 'Open group')).toBeVisible()
        await expect(menuEntry(page, 'Select members')).toBeVisible()
        await expect(menuEntry(page, 'Connect to...')).toHaveCount(0)
        await expect(menuEntry(page, 'Inspect Properties')).toHaveCount(0)

        await menuEntry(page, 'Select Neighbors').click()
        await expect.poll(() => selectedIds(page)).toEqual(['ev-a', 'ev-b'])
    })

    test('a member of an open group can be pulled out, then put back', async ({ page }) => {
        await loadSimplify(page, withNeighbours())
        await page.evaluate(() => {
            const simplify = window.__pivotick.graph!.simplify
            simplify.open(simplify.groupOf('dom-0')!)
        })
        await canvas(page).locator('#node-dom-3').click({ button: 'right' })
        await menuEntry(page, 'Pull out of group').click()
        await expect.poll(() => page.evaluate(() => window.__pivotick.graph!.simplify.isPulledOut('dom-3'))).toBe(true)

        await canvas(page).locator('#node-dom-3').click({ button: 'right' })
        await menuEntry(page, 'Put back in group').click()
        await expect.poll(() => page.evaluate(() => window.__pivotick.graph!.simplify.isPulledOut('dom-3'))).toBe(false)
    })
})

test.describe('the table', () => {
    test('a Group column names the group each node is in', async ({ page }) => {
        await loadSimplify(page, withNeighbours())
        const cells = await page.evaluate(async () => {
            const { resolveColumns, GROUP_COLUMN_KEY, readCell } = await import('/src/ui/elements/Table/TableColumns.ts')
            const graph = window.__pivotick.graph!
            const column = resolveColumns(graph.UIManager, 'nodes').find((candidate) => candidate.key === GROUP_COLUMN_KEY)!
            return Object.fromEntries(['ip-0', 'ttp-0'].map((id) => [id, readCell(column, graph.getMutableNode(id)!)]))
        })
        expect(cells).toEqual({ 'ip-0': '6 × ip', 'ttp-0': '' })
    })
})
