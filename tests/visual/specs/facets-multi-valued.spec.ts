import type { Locator, Page } from '@playwright/test'
import { test, expect, gotoHarness, harness } from '../helpers'

// ── Multi-valued properties in the aggregated table ──────────────────────────
// A node with several tags has one `Tag` entry per tag. The `multiTag` fixture:
//   E1: tlp:clear, source:feed, tlp:amber   (kind: event)
//   E2: tlp:amber, source:feed              (kind: event)
//   E3: source:feed, tlp:clear              (kind: report)
// `tlp:amber` is third on E1 and first on E2, so keep/exclude cannot rely on
// reading a node's first `Tag`. Values overlap, so `Tag` draws one bar per
// value; the single-valued `kind` keeps its one partition bar.

const FULL = { UI: { mode: 'full', sidebar: { collapsed: false } } }
const EVENTS = ['E1', 'E2', 'E3']

const body = (page: Page): Locator => page.locator('.pvt-properties-body-panel')
const facetCard = (page: Page, name: string): Locator =>
    body(page).locator('.pvt-facet-card', { has: page.locator('.pvt-facet-label-name', { hasText: new RegExp(`^${name}$`) }) })
const valueRow = (card: Locator, value: string): Locator =>
    card.locator('.pvt-facet-row', { has: card.page().locator('.pvt-facet-value', { hasText: value }) })

async function selectedIds(page: Page): Promise<string[]> {
    return ((await harness(page, 'selectedNodeIds')) as string[]).slice().sort()
}

/** Each bar segment's width as a share of its own bar, in DOM order. */
async function segmentShares(card: Locator): Promise<number[]> {
    return card.locator('.pvt-facet-bar-seg').evaluateAll((segments) => segments.map((segment) => {
        const bar = segment.parentElement as HTMLElement
        return segment.getBoundingClientRect().width / bar.getBoundingClientRect().width
    }))
}

test.describe('multi-valued properties in the aggregated table', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
        await harness(page, 'loadMultiValuedTags', FULL)
        await harness(page, 'multiSelect', EVENTS)
        await expect(facetCard(page, 'Tag')).toBeVisible()
    })

    test('a value counts each node once', async ({ page }) => {
        const tags = facetCard(page, 'Tag')
        await expect(valueRow(tags, 'source:feed').locator('.pvt-facet-count')).toHaveText('3')
        await expect(valueRow(tags, 'tlp:amber').locator('.pvt-facet-count')).toHaveText('2')
        await expect(valueRow(tags, 'tlp:clear').locator('.pvt-facet-count')).toHaveText('2')
    })

    test('keep narrows to every node carrying the value, whatever its position', async ({ page }) => {
        await facetCard(page, 'Tag').locator('.pvt-facet-bar-seg[title^="tlp:amber"]').click()
        expect(await selectedIds(page)).toEqual(['E1', 'E2'])
    })

    test('exclude drops every node carrying the value, whatever its position', async ({ page }) => {
        await facetCard(page, 'Tag').locator('.pvt-facet-bar-seg[title^="tlp:amber"]').click({ modifiers: ['Alt'] })
        expect(await selectedIds(page)).toEqual(['E3'])
    })

    test('the row keep / exclude buttons narrow the same way', async ({ page }) => {
        const amber = valueRow(facetCard(page, 'Tag'), 'tlp:amber')
        await amber.hover()
        await amber.locator('.pvt-facet-action-exclude').click()
        expect(await selectedIds(page)).toEqual(['E3'])
    })

    test('a multi-valued property draws one bar per value, each its share of the selection', async ({ page }) => {
        const tags = facetCard(page, 'Tag')
        await expect(tags.locator('.pvt-facet-bar')).toHaveCount(3)
        const [feed, ...rest] = await segmentShares(tags)
        expect(feed).toBeCloseTo(1, 2)
        for (const share of rest) expect(share).toBeCloseTo(2 / 3, 2)
    })

    test('a value on every node is marked shared inside its card', async ({ page }) => {
        const tags = facetCard(page, 'Tag')
        await expect(valueRow(tags, 'source:feed').locator('.pvt-facet-shared-tag')).toHaveText('shared')
        await expect(valueRow(tags, 'tlp:amber').locator('.pvt-facet-shared-tag')).toHaveCount(0)
    })

    test('a single-valued property keeps its one partition bar', async ({ page }) => {
        const kinds = facetCard(page, 'kind')
        await expect(kinds.locator('.pvt-facet-bar')).toHaveCount(1)
        await expect(kinds.locator('.pvt-facet-bar-seg')).toHaveCount(2)
        const shares = await segmentShares(kinds)
        expect(shares.reduce((sum, share) => sum + share, 0)).toBeLessThanOrEqual(1)
        // The 2px gap between segments comes out of their widths.
        expect(shares[0]).toBeCloseTo(2 / 3, 1)
        expect(shares[1]).toBeCloseTo(1 / 3, 1)
    })

    test('multi-valued card', async ({ page }) => {
        await expect(facetCard(page, 'Tag')).toHaveScreenshot('multi-valued-card.png')
    })
})
