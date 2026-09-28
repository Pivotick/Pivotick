import { test, expect, gotoHarness, harness, canvas, openNodeTooltip, centerOf } from '../helpers'
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

/** The drawn lines with one end on any of these nodes. */
function linesTouching(lines: string[], ids: string[]): string[] {
    return lines.filter((line) => line.split('->').some((end) => ids.includes(end)))
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

const loadSimplify = (page: Page, overrides: Record<string, unknown> = {}, fixture: 'simplify' | 'simplifyClusters' | 'simplifyChains' | 'simplifyCore' | 'simplifyCommunities' = 'simplify', look = false) =>
    harness(page, 'loadSimplify', overrides, fixture, look)

const withNeighbours = (extra: Record<string, unknown> = {}) =>
    ({ UI: { mode: 'full', simplify: { rules: [{ kind: 'neighbours', ...extra }] } } })

test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 })
    await gotoHarness(page)
})

test.describe('defaults', () => {
    test('full mode offers the built-in rules switched off, and folds nothing', async ({ page }) => {
        await loadSimplify(page, { UI: { mode: 'full' } })
        await expect(railButton(page)).toBeVisible()
        await expect(railCount(page)).toBeHidden()
        expect(await groups(page)).toEqual([])

        await openSimplifyFlyout(page)
        await expect(page.locator('.pvt-simplifyflyout-rule')).toHaveCount(4)
        for (const [order, id] of ['neighbours', 'chains', 'degree', 'kcore'].entries()) {
            await expect(ruleCard(page, id)).toHaveClass(/pvt-simplifyflyout-rule-off/)
            await expect(ruleSwitch(page, id)).toHaveAttribute('aria-pressed', 'false')
            await expect(ruleCard(page, id).locator('.pvt-simplifyflyout-rule-order')).toHaveText(String(order + 1))
        }
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

/*
 * The `simplifyChains` fixture: `ev` holds seven files, each with its own hash, but `ev`
 * also links `sha-6`, so `file-6` leads no chain of its own. Five isolated pairs
 * `dom-i → pip-i`, and `host-a` / `host-b` linked both ways.
 */
const CHAIN_FILES = ['file-0', 'file-1', 'file-2', 'file-3', 'file-4', 'file-5']
const CHAIN_HASHES = ['sha-0', 'sha-1', 'sha-2', 'sha-3', 'sha-4', 'sha-5']
const PAIR_HEADS = ['dom-0', 'dom-1', 'dom-2', 'dom-3', 'dom-4']
const PAIR_TAILS = ['pip-0', 'pip-1', 'pip-2', 'pip-3', 'pip-4']

const withChains = (extra: Record<string, unknown> = {}) =>
    ({ UI: { mode: 'full', simplify: { rules: [{ kind: 'chains', ...extra }] } } })

test.describe('the chain rule', () => {
    test('folds each level of a node\'s private chains: files, then their hashes', async ({ page }) => {
        await loadSimplify(page, withChains(), 'simplifyChains')
        await expectPartition(page, [CHAIN_FILES, CHAIN_HASHES, PAIR_HEADS, PAIR_TAILS])
        const files = (await groupHolding(page, 'file-0'))!
        const hashes = (await groupHolding(page, 'sha-0'))!
        expect(files.rule).toBe('chains')

        const lines = await drawnLines(page)
        // Twelve edges, two lines: the event to its files, the files to their hashes. The
        // file with a shared hash keeps its own lines.
        expect(lines).toEqual(expect.arrayContaining([`ev->${files.id}`, `${files.id}->${hashes.id}`, 'ev->file-6', 'file-6->sha-6', 'ev->sha-6']))
        expect(linesTouching(lines, [...CHAIN_FILES, ...CHAIN_HASHES])).toEqual([])
    })

    test('isolated pairs fold into their heads and their tails, linked by one line', async ({ page }) => {
        await loadSimplify(page, withChains(), 'simplifyChains')
        await expectPartition(page, [CHAIN_FILES, CHAIN_HASHES, PAIR_HEADS, PAIR_TAILS])
        const heads = (await groupHolding(page, 'dom-0'))!
        const tails = (await groupHolding(page, 'pip-0'))!
        expect(await drawnLines(page)).toContain(`${heads.id}->${tails.id}`)
        // Each group's anchors are what the canvas draws: the other group, not its members.
        expect(heads.anchors).toEqual([tails.id])
        expect(tails.anchors).toEqual([heads.id])
    })

    test('a shared hash and a cycle break the chain', async ({ page }) => {
        await loadSimplify(page, withChains(), 'simplifyChains')
        await expectPartition(page, [CHAIN_FILES, CHAIN_HASHES, PAIR_HEADS, PAIR_TAILS])
        for (const id of ['ev', 'file-6', 'sha-6', 'host-a', 'host-b']) expect(await groupHolding(page, id)).toBeUndefined()
    })

    test('a pulled-out head keeps its tail with it', async ({ page }) => {
        await loadSimplify(page, withChains({ minSize: 4 }), 'simplifyChains')
        await page.evaluate(() => window.__pivotick.graph!.simplify.pullOut('dom-0'))
        await expectPartition(page, [CHAIN_FILES, CHAIN_HASHES, PAIR_HEADS.slice(1), PAIR_TAILS.slice(1)])
        expect(await drawnLines(page)).toContain('dom-0->pip-0')
    })

    test('after the neighbour rule, it folds what that rule left', async ({ page }) => {
        await loadSimplify(page, { UI: { mode: 'full', simplify: { rules: [{ kind: 'neighbours' }, { kind: 'chains' }] } } }, 'simplifyChains')
        await expectPartition(page, [CHAIN_FILES, CHAIN_HASHES, PAIR_HEADS, PAIR_TAILS])
        expect((await groups(page)).every((group) => group.rule === 'chains')).toBe(true)

        await openSimplifyFlyout(page)
        await expect(ruleResult(page, 'neighbours')).toHaveText('Nothing to fold at 5 or more')
        await expect(ruleResult(page, 'chains')).toHaveText('4 groups · 22 nodes')
    })
})

/*
 * The `simplifyCore` fixture: `k0`–`k3` all linked together; `k0 → t0`, with `t0` holding
 * `t1` and `t2`; `b` bridging `k1` and `k2`; a triangle `x0`–`x2` linked to nothing else;
 * and `solo`, linked to nothing.
 */
const TREE = ['t0', 't1', 't2']
const TRIANGLE = ['x0', 'x1', 'x2']

const withRule = (rule: Record<string, unknown>) => ({ UI: { mode: 'full', simplify: { rules: [rule] } } })

test.describe('the degree rule', () => {
    test('folds nodes with fewer links into what they hang from, one group per anchor', async ({ page }) => {
        await loadSimplify(page, withRule({ kind: 'degree' }), 'simplifyCore')
        // Two links by default: the tree's two leaves, and the unlinked node.
        await expectPartition(page, [['t1', 't2'], ['solo']])
        const leaves = (await groupHolding(page, 't1'))!
        expect(leaves).toMatchObject({ rule: 'degree', anchors: ['t0'] })
        expect(await drawnLines(page)).toContain(`t0->${leaves.id}`)
    })

    test('a group may hold one node, and a run touching nothing left is a group of its own', async ({ page }) => {
        await loadSimplify(page, withRule({ kind: 'degree', minDegree: 3 }), 'simplifyCore')
        await expectPartition(page, [['t1', 't2'], ['b'], TRIANGLE, ['solo']])
        expect((await groupHolding(page, 'b'))!.anchors).toEqual(['k1', 'k2'])
        expect((await groupHolding(page, 'x0'))!.anchors).toEqual([])
    })

    test('a group mixes types when what it folds does', async ({ page }) => {
        await loadSimplify(page, withRule({ kind: 'degree', minDegree: 3 }))
        // IPs and TTPs both link only the two events.
        const shared = (await groupHolding(page, 'ttp-0'))!
        expect(shared.members).toEqual([...IPS, 'ttp-0', 'ttp-1', 'ttp-2'].sort())
        const typeCounts = await page.evaluate((id) => window.__pivotick.graph!.simplify.getGroups().find((group) => group.id === id)!.typeCounts, shared.id)
        expect(typeCounts).toEqual({ ip: 6, ttp: 3 })
    })
})

test.describe('the k-core rule', () => {
    test('peels whole trees, not only their leaves', async ({ page }) => {
        await loadSimplify(page, withRule({ kind: 'kcore' }), 'simplifyCore')
        // With its leaves gone t0 has one link left, so it goes too; the triangle and the
        // bridge keep two each.
        await expectPartition(page, [TREE, ['solo']])
        expect(await groupHolding(page, 't0')).toMatchObject({ rule: 'kcore', anchors: ['k0'] })
    })

    test('a stronger core folds everything outside the four linked events', async ({ page }) => {
        await loadSimplify(page, withRule({ kind: 'kcore', k: 3 }), 'simplifyCore')
        await expectPartition(page, [TREE, ['b'], TRIANGLE, ['solo']])
        expect(await canvasNodeIds(page)).toEqual(expect.arrayContaining(['k0', 'k1', 'k2', 'k3']))
    })

    test('after the neighbour rule, a group is one node to peel', async ({ page }) => {
        await loadSimplify(page, { UI: { mode: 'full', simplify: { rules: [{ kind: 'neighbours' }, { kind: 'degree', minDegree: 3 }] } } })
        const ipGroup = (await groupHolding(page, 'ip-0'))!
        expect(ipGroup.rule).toBe('neighbours')
        // The IP group and the three TTPs all hang off the two events: one group of nine.
        const fold = (await groups(page)).find((group) => group.rule === 'degree' && group.members.includes('ttp-0'))!
        expect(fold.members).toEqual([...IPS, 'ttp-0', 'ttp-1', 'ttp-2'].sort())
        expect(fold.anchors).toEqual(['ev-a', 'ev-b'])
        expect(await canvasNodeIds(page)).not.toContain(ipGroup.id)
        // The domain and file groups hang alone off their anchors: folding them would redraw the same dot.
        for (const member of ['dom-0', 'file-1']) expect((await groupHolding(page, member))!.rule).toBe('neighbours')
    })
})

test.describe('the threshold steppers', () => {
    test('each threshold rule names its own setting', async ({ page }) => {
        await loadSimplify(page, { UI: { mode: 'full' } })
        await openSimplifyFlyout(page)
        await expect(ruleCard(page, 'degree').locator('.pvt-simplifyflyout-rule-setting')).toContainText('Fewest links')
        await expect(ruleCard(page, 'kcore').locator('.pvt-simplifyflyout-rule-setting')).toContainText('Core strength')
    })

    test('fewest links steps between 1 and 10 and regroups on each click', async ({ page }) => {
        await loadSimplify(page, withRule({ kind: 'degree' }), 'simplifyCore')
        await openSimplifyFlyout(page)
        await stepperButton(page, 'degree', 1).click()
        await expectPartition(page, [['t1', 't2'], ['b'], TRIANGLE, ['solo']])

        await stepperButton(page, 'degree', -1).click()
        await stepperButton(page, 'degree', -1).click()
        await expectPartition(page, [['solo']])
        await expect(stepperButton(page, 'degree', -1)).toBeDisabled()
        await expect(ruleCard(page, 'degree').locator('input')).toHaveValue('1')
    })

    test('says so when every node has enough links', async ({ page }) => {
        await loadSimplify(page, withRule({ kind: 'degree', minDegree: 1 }), 'simplifyChains')
        await openSimplifyFlyout(page)
        await expect(ruleResult(page, 'degree')).toHaveText('Every node has 1 link or more')
    })
})

/*
 * The `simplifyCommunities` fixture: cliques `a`, `b`, `c`, `d` of four; `a`–`b` and
 * `c`–`d` tied by three links each, `b`–`c` by one. `a3` carries a note, `solo` is unlinked.
 */
const clique = (name: string) => [0, 1, 2, 3].map((i) => `${name}${i}`)
const CLIQUE_A = clique('a').filter((id) => id !== 'a3')

test.describe('the Communities rule', () => {
    test('folds densely linked neighbourhoods, leaving annotated and unlinked nodes out', async ({ page }) => {
        await loadSimplify(page, withRule({ kind: 'communities' }), 'simplifyCommunities')
        await expectPartition(page, [CLIQUE_A, clique('b'), clique('c'), clique('d')])
        const reading = await page.evaluate(() => window.__pivotick.graph!.simplify.getGroups().map((group) => ({ rule: group.rule, level: group.level })))
        expect(reading.every(({ rule, level }) => rule === 'communities' && level === 4)).toBe(true)
        expect(await groupHolding(page, 'solo')).toBeUndefined()
    })

    test('a coarser level folds the pairs of cliques, mixing their types', async ({ page }) => {
        await loadSimplify(page, withRule({ kind: 'communities' }), 'simplifyCommunities')
        await expectPartition(page, [CLIQUE_A, clique('b'), clique('c'), clique('d')])
        await openSimplifyFlyout(page)
        const slider = ruleCard(page, 'communities').locator('.pvt-simplifyflyout-slider input')
        await expect(ruleCard(page, 'communities').locator('.pvt-simplifyflyout-rule-setting')).toContainText('Level')
        await slider.fill('6')
        await expectPartition(page, [[...CLIQUE_A, ...clique('b')], [...clique('c'), ...clique('d')]])
        const typeCounts = await page.evaluate(() => window.__pivotick.graph!.simplify.getGroups().find((group) => group.members.some((member) => member.id === 'c0'))!.typeCounts)
        expect(typeCounts).toEqual({ ip: 4, domain: 4 })
    })

    test('while it computes, the card says so and the last groups stay', async ({ page }) => {
        await loadSimplify(page, withRule({ kind: 'communities' }), 'simplifyCommunities')
        await expectPartition(page, [CLIQUE_A, clique('b'), clique('c'), clique('d')])
        await openSimplifyFlyout(page)
        // One synchronous step: the change starts a job, and nothing has come back yet.
        const during = await page.evaluate(() => {
            const graph = window.__pivotick.graph!
            graph.addEdge({ id: 'solo-d0', from: 'solo', to: 'd0' } as never)
            return {
                computing: graph.simplify.getRules()[0].computing,
                groups: graph.simplify.getGroups().length,
                result: document.querySelector('.pvt-simplifyflyout-rule[data-rule="communities"] .pvt-simplifyflyout-rule-result')!.textContent,
            }
        })
        expect(during).toEqual({ computing: true, groups: 4, result: 'Grouping…' })
        await expectPartition(page, [CLIQUE_A, clique('b'), clique('c'), [...clique('d'), 'solo']])
        await expect(ruleResult(page, 'communities')).toHaveText('4 groups · 16 nodes')
    })

    test('runs in a copy of the compute worker, and on the page when told not to', async ({ page }) => {
        // Count the community jobs workers answered, from here on.
        await page.evaluate(() => {
            const counts = { answered: 0 }
            ;(window as unknown as { workerCounts: typeof counts }).workerCounts = counts
            const Native = window.Worker
            window.Worker = class extends Native {
                constructor(...args: ConstructorParameters<typeof Worker>) {
                    super(...args)
                    this.addEventListener('message', (e) => { if (e.data?.levels) counts.answered++ })
                }
            }
        })
        const counts = () => page.evaluate(() => (window as unknown as { workerCounts: { answered: number } }).workerCounts)
        await loadSimplify(page, withRule({ kind: 'communities' }), 'simplifyCommunities')
        await expectPartition(page, [CLIQUE_A, clique('b'), clique('c'), clique('d')])
        const withWorker = await counts()
        expect(withWorker.answered).toBe(1)

        await loadSimplify(page, withRule({ kind: 'communities', useWorker: false }), 'simplifyCommunities')
        await expectPartition(page, [CLIQUE_A, clique('b'), clique('c'), clique('d')])
        expect((await counts()).answered).toBe(withWorker.answered)
    })

    test('the page finds the same communities as the worker', async ({ page }) => {
        await loadSimplify(page, withRule({ kind: 'communities', level: 6, useWorker: false }), 'simplifyCommunities')
        await expectPartition(page, [[...CLIQUE_A, ...clique('b')], [...clique('c'), ...clique('d')]])
    })

    test('is offered only when declared', async ({ page }) => {
        await loadSimplify(page, { UI: { mode: 'full' } }, 'simplifyCommunities')
        await openSimplifyFlyout(page)
        await expect(ruleCard(page, 'communities')).toHaveCount(0)
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

/** Where these nodes are, in graph units. */
async function memberPositions(page: Page, ids: string[]): Promise<Record<string, { x: number, y: number }>> {
    return page.evaluate((nodeIds) => Object.fromEntries(nodeIds.map((id) => {
        const node = window.__pivotick.graph!.getMutableNode(id)!
        return [id, { x: node.x!, y: node.y! }]
    })), ids)
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

        await chip(page).locator('.pvt-group-chip-close').click()
        await expect.poll(async () => (await groupHolding(page, 'dom-0'))?.open).toBe(false)
        await expect(chip(page)).toHaveCount(0)
    })

    test('the chip names the rule that made the group', async ({ page }) => {
        await loadSimplify(page, withNeighbours())
        await page.evaluate(() => {
            const simplify = window.__pivotick.graph!.simplify
            simplify.open(simplify.groupOf('dom-0')!)
        })
        await expect(page.locator('.pvt-group-chip-label')).toHaveAttribute('title', 'Same neighbours · drag to move the group')
    })

    test('dragging the chip moves every member by the same amount, and leaves the group open', async ({ page }) => {
        await loadSimplify(page, withNeighbours())
        await page.evaluate(() => {
            const simplify = window.__pivotick.graph!.simplify
            simplify.open(simplify.groupOf('dom-0')!)
        })
        const before = await memberPositions(page, DOMAINS)
        const bystander = await memberPositions(page, ['ev-a'])
        const handle = await centerOf(page.locator('.pvt-group-chip-label'))
        await page.mouse.move(handle.x, handle.y)
        await page.mouse.down()
        await page.mouse.move(handle.x + 120, handle.y + 60, { steps: 10 })
        await page.mouse.up()

        const after = await memberPositions(page, DOMAINS)
        const moves = DOMAINS.map((id) => ({ dx: Math.round(after[id].x - before[id].x), dy: Math.round(after[id].y - before[id].y) }))
        expect(moves[0].dx).toBeGreaterThan(0)
        expect(moves[0].dy).toBeGreaterThan(0)
        expect(moves).toEqual(DOMAINS.map(() => moves[0]))
        // Anything else stayed where it was.
        expect(await memberPositions(page, ['ev-a'])).toEqual(bystander)
        expect((await groupHolding(page, 'dom-0'))!.open).toBe(true)
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

    test('fits its content without a scrollbar', async ({ page }) => {
        await loadSimplify(page, withNeighbours())
        const tip = await openNodeTooltip(page, await groupDomId(page, 'ip-0'))
        const overflow = await tip.locator('.pvt-tooltip-container').evaluate((box) => box.scrollHeight - box.clientHeight)
        expect(overflow).toBe(0)
    })

    test('reads in the dark theme: its chips are not black on black', async ({ page }) => {
        await page.emulateMedia({ colorScheme: 'dark' })
        await loadSimplify(page, withNeighbours())
        const tip = await openNodeTooltip(page, await groupDomId(page, 'ip-0'))
        await expect(tip.locator('.pvt-group-summary-chip-label').first()).toHaveCSS('color', 'rgb(255, 255, 255)')
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

const dockRows = (page: Page) => page.locator('.pvt-dock .pvt-table-row')
const dockScope = (page: Page) => page.locator('.pvt-dock .pvt-table-scope')
const dockLabelFilter = (page: Page) => page.locator('.pvt-dock .pvt-table-th[data-column="pvt:label"] .pvt-table-filter[data-role="text"]')

/** The ids the dock lists, sorted. */
async function dockRowIds(page: Page): Promise<string[]> {
    return (await dockRows(page).evaluateAll((rows) => rows.map((row) => (row as HTMLElement).dataset.id ?? ''))).sort()
}

test.describe('the members in the dock', () => {
    test('View in table lists only the group\'s members, and the column filters narrow within them', async ({ page }) => {
        await loadSimplify(page, withPanels())
        await selectGroupOf(page, 'ip-0')
        await panelAction(page, 'view-in-table').click()

        await expect(dockScope(page)).toHaveText('Members of 6 × ip×')
        await expect.poll(() => dockRowIds(page)).toEqual(IPS)
        await dockLabelFilter(page).fill('ip-2')
        await expect.poll(() => dockRowIds(page)).toEqual(['ip-2'])

        await dockScope(page).locator('.pvt-table-scope-clear').click()
        await expect(dockScope(page)).toHaveCount(0)
        // The filter stays; every node is weighed against it again.
        await expect.poll(() => dockRowIds(page)).toEqual(['ip-2'])
        await dockLabelFilter(page).fill('')
        await expect.poll(async () => (await dockRowIds(page)).length).toBeGreaterThan(IPS.length)
    })

    test('the list follows the group: a pulled-out member leaves it', async ({ page }) => {
        await loadSimplify(page, withPanels())
        await selectGroupOf(page, 'ip-0')
        await panelAction(page, 'view-in-table').click()
        await expect.poll(() => dockRowIds(page)).toEqual(IPS)

        await page.evaluate(() => window.__pivotick.graph!.simplify.pullOut('ip-2'))
        await expect.poll(() => dockRowIds(page)).toEqual(IPS.filter((ip) => ip !== 'ip-2'))
        await expect(dockScope(page)).toHaveText('Members of 5 × ip×')
    })

    test('the context menu offers it, and not without a table', async ({ page }) => {
        await loadSimplify(page, withNeighbours())
        await (await groupDot(page, 'dom-0')).click({ button: 'right' })
        await menuEntry(page, 'View members in table').click()
        await expect.poll(() => dockRowIds(page)).toEqual(DOMAINS)

        await loadSimplify(page, { UI: { mode: 'full', table: false, simplify: { rules: [{ kind: 'neighbours' }] } } })
        await (await groupDot(page, 'dom-0')).click({ button: 'right' })
        await expect(menuEntry(page, 'Select members')).toBeVisible()
        await expect(menuEntry(page, 'View members in table')).toHaveCount(0)
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

/* ---------- search ---------- */

async function searchFor(page: Page, query: string): Promise<void> {
    await page.locator('#pvt-searchbox-button').click()
    await page.locator('#pvt-search-input').fill(query)
}

const searchResults = (page: Page) => page.locator('.pvt-search-result')

/** Which drawn dots the canvas lights and which it fades, a group named by its first member. */
async function emphasis(page: Page): Promise<{ lit: string[], dimmed: string[] }> {
    return page.evaluate(() => {
        const lit: string[] = []
        const dimmed: string[] = []
        for (const node of window.__pivotick.graph!.getCanvasNodes()) {
            const painted = node.getGraphElement()?.firstElementChild
            if (!painted) continue
            const members = node.isGroup ? (node as unknown as { info: { members: { id: string }[] } }).info.members.map((member) => member.id).sort() : []
            const name = node.isGroup ? `group:${members[0]}` : node.id
            if (Number(getComputedStyle(painted).opacity) < 1) dimmed.push(name)
            else lit.push(name)
        }
        return { lit: lit.sort(), dimmed: dimmed.sort() }
    })
}

/** Give two of the six shared IPs an address, so a search matches part of their group. */
async function addressTwoIps(page: Page): Promise<void> {
    await page.evaluate(() => {
        const graph = window.__pivotick.graph!
        graph.getMutableNode('ip-0')!.setData({ type: 'ip', addr: '10.0.0.1' })
        graph.getMutableNode('ip-1')!.setData({ type: 'ip', addr: '10.0.0.2' })
    })
}

test.describe('search inside groups', () => {
    test('a match folded into a group names the group in its result row', async ({ page }) => {
        await loadSimplify(page, withNeighbours())
        await searchFor(page, 'ip')
        // The six shared IPs, folded, and the lone IP on the canvas.
        await expect(searchResults(page)).toHaveCount(7)
        await expect(page.locator('.pvt-search-result__group')).toHaveCount(6)
        await expect(page.locator('.pvt-search-result__group').first()).toHaveText('in 6 × ip')
        await expect(searchResults(page).last().locator('.pvt-search-result__group')).toHaveCount(0)
    })

    test('picking a folded match opens its group and selects it', async ({ page }) => {
        await loadSimplify(page, withNeighbours())
        await searchFor(page, 'ip')
        await page.locator('#pvt-search-input').press('Enter')
        await expect.poll(async () => (await groupHolding(page, 'ip-0'))?.open).toBe(true)
        await expect.poll(() => selectedIds(page)).toEqual(['ip-0'])
    })

    test('above the open limit, picking it selects the group instead', async ({ page }) => {
        await loadSimplify(page, { UI: { mode: 'full', simplify: { rules: [{ kind: 'neighbours' }], openConfirmAbove: 3 } } })
        await searchFor(page, 'ip')
        await page.locator('#pvt-search-input').press('Enter')
        const group = (await groupHolding(page, 'ip-0'))!
        await expect.poll(() => selectedIds(page)).toEqual([group.id])
        expect(group.open).toBe(false)
    })

    test('Show all lights every match and the group holding them, until Escape', async ({ page }) => {
        await loadSimplify(page, withNeighbours())
        await searchFor(page, 'ip')
        await page.locator('.pvt-search-showall').click()
        await expect(page.locator('.pvt-searchbox')).toHaveCount(0)
        await expect.poll(async () => (await emphasis(page)).lit).toEqual(['group:ip-0', 'lonely'])
        expect((await emphasis(page)).dimmed).toEqual(expect.arrayContaining(['ev-a', 'ev-b', 'group:dom-0']))

        await page.keyboard.press('Escape')
        await expect.poll(async () => (await emphasis(page)).dimmed).toEqual([])
        await expect(page.locator('.pvt-group-matches .pvt-group-match')).toHaveCount(0)
    })

    test('a lit group draws its share over its ring and counts it in its tooltip', async ({ page }) => {
        await loadSimplify(page, withNeighbours())
        await addressTwoIps(page)
        await searchFor(page, '10.0.0')
        await expect(searchResults(page)).toHaveCount(2)
        await page.locator('#pvt-search-input').press('Shift+Enter')

        const group = (await groupHolding(page, 'ip-0'))!
        const arc = page.locator('.pvt-group-matches .pvt-group-match')
        await expect(arc).toHaveCount(1)
        await expect(arc).toHaveAttribute('data-group', group.id)
        // Two of six: one arc, not the full ring's two halves.
        expect((await arc.getAttribute('d'))!.match(/A/g)).toHaveLength(1)

        const tip = await openNodeTooltip(page, await groupDomId(page, 'ip-0'))
        await expect(tip.locator('.pvt-group-summary-match')).toHaveText('2 of 6 match "10.0.0"')
    })
})
