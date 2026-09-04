import type { Page } from '@playwright/test'
import { test, expect, gotoHarness, harness } from '../helpers'
import type { NodeBadgeSnapshot, PivotFixtureSpec } from '../harness/harness'

/**
 * What a pivot applies to, and what the rim says about it — the two at-scale findings
 * a real 118-provider backend turned up.
 *
 * **Partial applicability.** `appliesTo` used to answer once for the whole origin, so a
 * selection mixing two kinds of node only offered the providers that accepted both.
 * Returning the *nodes it keeps* instead lets a pivot take its share: `subset-only`
 * accepts everything in the basic fixture except `hub`, so an origin of `a` and `hub`
 * keeps it, run against `a` alone. The provider never sees a node it turned down, which
 * is the property most of these assertions are about.
 *
 * **The summary rim badge.** One badge per pivot stops being readable at a dozen
 * providers and cannot exist at a hundred, so `summary` collapses the rim to exactly one
 * badge whatever the provider count. Its number is the total the consumer declared for no
 * particular pivot, or — with nothing declared — how many pivots apply, which the library
 * can prove without asking a provider anything.
 *
 * Assertions here are numeric and read the drawn DOM. A screenshot cannot tell 3 badges
 * from 1, nor a declared total from a counted one, and those are the distinctions.
 */

const SUBSET = 'subset-only'

/** The panel and the rail only exist in full mode. */
const FULL = { UI: { mode: 'full', sidebar: { collapsed: true } } }

/* ---------- readers ---------- */

const load = async (page: Page, spec: PivotFixtureSpec = {}, overrides: object = {}): Promise<void> => {
    await harness(page, 'loadWithPivots', 'basic', spec, overrides)
    await page.locator('.zoom-layer:not(.hidden)').first().waitFor({ state: 'attached' })
}

/** Enter Pivot mode from the rail with an origin picked, the way an analyst does. */
const enterModeOn = async (page: Page, nodeIds: string[]): Promise<void> => {
    await harness(page, 'multiSelect', nodeIds)
    await page.locator('.pvt-moderail-button[data-mode="pivot"]').click()
    await page.locator('.pvt-pivot-panel').waitFor()
}

/** Which pivots the panel would offer for this origin. */
const appliesTo = async (page: Page, nodeIds: string[]): Promise<string[]> =>
    (await harness(page, 'pivotsFor', nodeIds)) as string[]

/** The origin one pivot would actually be run with — its share of what was picked. */
const originFor = async (page: Page, id: string, nodeIds: string[]): Promise<string[]> =>
    (await harness(page, 'pivotOriginFor', id, nodeIds)) as string[]

const badgesOn = async (page: Page, id: string): Promise<NodeBadgeSnapshot[]> =>
    (await harness(page, 'nodeBadges', id)) as NodeBadgeSnapshot[]

const badgeTexts = async (page: Page, id: string): Promise<string[]> =>
    (await badgesOn(page, id)).map((badge) => badge.text)

/** The nodes a provider was actually called with, in call order. */
const originsSeen = async (page: Page, id: string): Promise<string[][]> => {
    const calls = (await harness(page, 'pivotCalls')) as Array<{ pivot: string, call: string, nodes: string[] }>
    return calls.filter((call) => call.pivot === id).map((call) => call.nodes)
}

test.describe('pivot applicability — a pivot takes its share of a mixed origin', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
        await load(page, { pivots: [SUBSET, 'ail-correlation'] })
    })

    test('a pivot that accepts only some of the origin is still offered', async ({ page }) => {
        // `hub` alone: outside the accepted set, so it is not offered at all.
        expect(await appliesTo(page, ['hub'])).not.toContain(SUBSET)
        // `a` alone: squarely inside it.
        expect(await appliesTo(page, ['a'])).toContain(SUBSET)
        // Both together — the case that used to lose the pivot entirely.
        expect(await appliesTo(page, ['a', 'hub'])).toContain(SUBSET)
    })

    test('it reports the nodes it kept, not the ones it was offered', async ({ page }) => {
        expect(await originFor(page, SUBSET, ['a', 'hub'])).toEqual(['a'])
        expect(await originFor(page, SUBSET, ['a', 'b', 'hub'])).toEqual(['a', 'b'])
        expect(await originFor(page, SUBSET, ['hub'])).toEqual([])
    })

    test('a pivot with no appliesTo still takes the whole origin', async ({ page }) => {
        expect(await originFor(page, 'ail-correlation', ['a', 'hub'])).toEqual(['a', 'hub'])
    })

    test('the provider is never called with a node it turned down', async ({ page }) => {
        await harness(page, 'runPivot', SUBSET, ['a', 'hub'], {})
        // Both calls — the gate's summarize and the fetch — see `a` and only `a`.
        for (const origin of await originsSeen(page, SUBSET)) expect(origin).toEqual(['a'])
    })

    test('a run whose origin is entirely turned down fetches nothing', async ({ page }) => {
        const outcome = await harness(page, 'runPivot', SUBSET, ['hub'], {}) as { status: string, error: string | null }
        expect(outcome.status).toBe('failed')
        expect(outcome.error).toContain('does not apply')
        // The point of failing rather than narrowing to nothing: no provider call at all.
        expect(await originsSeen(page, SUBSET)).toEqual([])
    })

    test('the panel says which part of the origin it applies to', async ({ page }) => {
        await load(page, { pivots: [SUBSET, 'ail-correlation'] }, FULL)
        await enterModeOn(page, ['a', 'hub'])
        const entry = page.locator('.pvt-pivot-entry[data-pivot="subset-only"]')
        await expect(entry.locator('.pvt-pivot-scope')).toHaveText('Applies to 1 of the 2 picked')
        // A pivot that took the whole origin says nothing — the line is only ever a
        // qualification, never a restatement of what the origin block already shows.
        const whole = page.locator('.pvt-pivot-entry[data-pivot="ail-correlation"]')
        await expect(whole.locator('.pvt-pivot-scope')).toBeHidden()
    })
})

test.describe('pivot rim badge — one badge, whatever the provider count', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
        await load(page, { pivots: [SUBSET, 'ail-correlation', 'blind'] })
    })

    test('per-pivot is the default, and one badge per declaring pivot', async ({ page }) => {
        await harness(page, 'setNodePotential', 'a', 'ail-correlation', 2143)
        await harness(page, 'setNodePotential', 'a', SUBSET, 44)
        expect(await badgeTexts(page, 'a')).toEqual(['2k', '44'])
        // A node nobody declared for stays bare.
        expect(await badgeTexts(page, 'b')).toEqual([])
    })

    test('a summary declaration draws nothing in per-pivot mode', async ({ page }) => {
        // There is no pivot to open, so it has no per-pivot badge to be.
        await harness(page, 'setNodeSummaryPotential', 'a', 2199)
        expect(await badgeTexts(page, 'a')).toEqual([])
    })

    test('summary collapses several declarations to one badge', async ({ page }) => {
        await harness(page, 'setNodePotential', 'a', 'ail-correlation', 2143)
        await harness(page, 'setNodePotential', 'a', SUBSET, 44)
        await harness(page, 'setPivotRimBadge', 'summary')

        const badges = await badgesOn(page, 'a')
        expect(badges).toHaveLength(1)
        // Nothing was declared for *no* pivot, so it falls back to what applies.
        expect(badges[0].text).toBe(String(await harness(page, 'pivotApplicableCount', 'a')))
        expect(badges[0].interactive).toBe(true)
        expect(badges[0].overflow).toBe(false)
    })

    test('a declared total beats the count, and says so', async ({ page }) => {
        await harness(page, 'setNodeSummaryPotential', 'a', 2199)
        await harness(page, 'setPivotRimBadge', 'summary')

        const [badge] = await badgesOn(page, 'a')
        expect(badge.text).toBe('2k')
        expect(badge.title).toContain('2,199')
    })

    test('with nothing declared the badge counts the pivots that apply', async ({ page }) => {
        await harness(page, 'setPivotRimBadge', 'summary')

        // `hub` is outside `subset-only`'s set, so it carries one pivot fewer than `a`.
        const onA = Number(await harness(page, 'pivotApplicableCount', 'a'))
        const onHub = Number(await harness(page, 'pivotApplicableCount', 'hub'))
        expect(onA).toBe(onHub + 1)

        expect(await badgeTexts(page, 'a')).toEqual([String(onA)])
        expect(await badgeTexts(page, 'hub')).toEqual([String(onHub)])
        expect((await badgesOn(page, 'hub'))[0].title).toContain('appl')
    })

    test('off draws no library badge at all', async ({ page }) => {
        await harness(page, 'setNodePotential', 'a', 'ail-correlation', 2143)
        await harness(page, 'setPivotRimBadge', 'off')
        expect(await badgeTexts(page, 'a')).toEqual([])
        expect(await badgeTexts(page, 'hub')).toEqual([])
    })

    test('the count follows the registry without a repaint of its own', async ({ page }) => {
        await harness(page, 'setPivotRimBadge', 'summary')
        const before = Number(await harness(page, 'pivotApplicableCount', 'a'))

        await harness(page, 'unregisterPivot', SUBSET)
        expect(Number(await harness(page, 'pivotApplicableCount', 'a'))).toBe(before - 1)
    })
})
