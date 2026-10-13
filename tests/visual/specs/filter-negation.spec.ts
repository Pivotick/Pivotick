import { test, expect, gotoHarness, harness } from '../helpers'
import type { Page, Locator } from '@playwright/test'

/**
 * Negated filters: `{ value, negate: true }` keeps what the same filter without it
 * would hide, plus whatever has no value for the key.
 *
 * Most cases are written as a partition — the positive filter and its negation, side
 * by side, together show every node exactly once — because that is the whole promise.
 * Against the `facetShapes` fixture (see `loadWithFacets` for the declared facets):
 *
 *   a1  ip-src  tags tlp:amber, malware    to_ids  7 sightings
 *   a2  domain  tags not-malware                   0
 *   a3  md5     tags tlp:amber, tlp:green  to_ids  3
 *   obj object  tags tlp:amber  (a cluster: c1 md5, c2 filename)
 */

const ALL = ['a1', 'a2', 'a3', 'obj']

async function visibleIds(page: Page): Promise<string[]> {
    return ((await harness(page, 'visibleNodeIds')) as string[]).slice().sort()
}

async function expectVisible(page: Page, ids: string[]): Promise<void> {
    await expect.poll(() => visibleIds(page)).toEqual(ids.slice().sort())
}

/**
 * Apply `filter` on `key`, then the same filter negated, and check each shows what the
 * other hides: `kept` under the filter, the rest of `all` under its negation.
 */
async function expectPartition(page: Page, key: string, filter: Record<string, unknown>, kept: string[], all = ALL): Promise<void> {
    await harness(page, 'setFilter', key, filter)
    await expectVisible(page, kept)
    await harness(page, 'setFilter', key, { ...filter, negate: true })
    await expectVisible(page, all.filter((id) => !kept.includes(id)))
}

async function openFilterPanel(page: Page): Promise<Locator> {
    await harness(page, 'openFilterPanel')
    const panel = page.locator('.pvt-slide-panel.open')
    await panel.waitFor({ state: 'visible' })
    return panel
}

/** A field of the open panel, found by its label. */
function field(panel: Locator, label: string): Locator {
    return panel.locator('.pvt-form-element').filter({ has: panel.page().locator('label', { hasText: new RegExp(`^${label}$`) }) })
}

/** Which way a field's switch points, read off the checked radio. */
async function direction(fieldLocator: Locator): Promise<string | null> {
    return fieldLocator.locator('.pvt-negate-switch input:checked').getAttribute('value')
}

test.beforeEach(async ({ page }) => {
    await gotoHarness(page)
})

test.describe('negated filters match the other way round', () => {
    test.beforeEach(async ({ page }) => {
        await harness(page, 'loadWithFacets', 'facetShapes')
    })

    test('a list reads "none of"', async ({ page }) => {
        await expectPartition(page, 'attr-type', { value: ['md5', 'domain'] }, ['a2', 'a3'])
    })

    test('array data: none of the picks may be present', async ({ page }) => {
        // a2's `not-malware` is not `malware`: membership, not substring, either way round.
        await expectPartition(page, 'tags', { value: ['malware'] }, ['a1'])
    })

    test("'all' negated is \"not all of\"", async ({ page }) => {
        await expectPartition(page, 'tags_all', { value: ['tlp:amber', 'tlp:green'] }, ['a3'])
    })

    test('a pattern reads "doesn\'t match"', async ({ page }) => {
        await expectPartition(page, 'value', { value: 'example' }, ['a2'])
    })

    test('a predicate facet is inverted', async ({ page }) => {
        await expectPartition(page, 'min_sightings', { value: '3' }, ['a1', 'a3'])
    })

    test('a value that narrows nothing still narrows nothing', async ({ page }) => {
        // Inverting "no constraint" would blank the graph.
        await harness(page, 'setFilter', 'attr-type', { value: [], negate: true })
        await expectVisible(page, ALL)
        await harness(page, 'setFilter', 'value', { value: '[unclosed', negate: true })
        await expectVisible(page, ALL)
    })

    test('the negation reaches the nodes inside an expanded cluster', async ({ page }) => {
        await harness(page, 'expand', 'obj')
        // `obj` is an `object`, so it stays; inside it the md5 goes.
        await harness(page, 'setFilter', 'attr-type', { value: ['md5'], negate: true })

        const inside = (await harness(page, 'subgraphVisibleNodeIds', 'obj')) as string[]
        expect(inside).toEqual(['c2'])
    })
})

test.describe('a node with no value', () => {
    // a: object_relation null, b: 'rel', c: undefined.
    test('is kept by a negated filter, so "is" and "is not" cover every node', async ({ page }) => {
        await harness(page, 'load', 'nullableFields')
        await expectPartition(page, 'object_relation', { value: ['rel'] }, ['b'], ['a', 'b', 'c'])
    })
})

test.describe('negated edge filters', () => {
    test('a negated pattern keeps every other relation', async ({ page }) => {
        await harness(page, 'loadWithEdgeLayers', 'edgeLayers', { key: 'relation', facetType: 'regex' })
        const every = ((await harness(page, 'visibleEdgeIds')) as string[]).slice().sort()

        await harness(page, 'setEdgeFilter', 'relation', { value: '^tag:', negate: true })

        await expect.poll(async () => ((await harness(page, 'visibleEdgeIds')) as string[]).slice().sort())
            .toEqual(every.filter((id) => !['hub-e', 'd-e'].includes(id)))
    })
})

test.describe('the panel\'s is / is not switch', () => {
    test.beforeEach(async ({ page }) => {
        await harness(page, 'loadWithFacets', 'facetShapes')
    })

    test('every field has one, except a true / false field', async ({ page }) => {
        const panel = await openFilterPanel(page)

        await expect(field(panel, 'Type').locator('.pvt-negate-switch')).toHaveCount(1)
        await expect(field(panel, 'Value').locator('.pvt-negate-switch')).toHaveCount(1)
        await expect(field(panel, 'IDS flag').locator('.pvt-negate-switch')).toHaveCount(0)
    })

    test('flipping it applies on the spot, and flipping back undoes it', async ({ page }) => {
        await harness(page, 'setFilter', 'attr-type', { value: ['md5'] })
        const panel = await openFilterPanel(page)
        const type = field(panel, 'Type')

        await type.locator('.pvt-negate-not').click()
        await expectVisible(page, ['a1', 'a2', 'obj'])
        await expect(type).toHaveClass(/pvt-form-element-negated/)

        await type.locator('.pvt-negate-is').click()
        await expectVisible(page, ['a3'])
        await expect(type).not.toHaveClass(/pvt-form-element-negated/)
    })

    test('a negated filter set from code turns the switch', async ({ page }) => {
        const panel = await openFilterPanel(page)
        await harness(page, 'setFilter', 'tags', { value: ['malware'], negate: true })

        await expect.poll(() => direction(field(panel, 'Tag'))).toBe('not')
        expect(await direction(field(panel, 'Type'))).toBe('is')
    })

    test('Reset turns every switch back to "is"', async ({ page }) => {
        await harness(page, 'setFilter', 'tags', { value: ['malware'], negate: true })
        const panel = await openFilterPanel(page)
        await expect.poll(() => direction(field(panel, 'Tag'))).toBe('not')

        await panel.locator('.pvt-filter-section-head button', { hasText: 'Reset' }).click()

        expect(await direction(field(panel, 'Tag'))).toBe('is')
        await expect(field(panel, 'Tag')).not.toHaveClass(/pvt-form-element-negated/)
        await expectVisible(page, ALL)
    })

    test('a negated field is drawn red, its picks struck through', async ({ page }) => {
        await harness(page, 'setFilter', 'tags', { value: ['malware'], negate: true })
        await harness(page, 'setFilter', 'value', { value: 'example', negate: true })
        const panel = await openFilterPanel(page)
        await expect(field(panel, 'Tag').locator('.pvt-picker__chip-label')).toHaveText('malware')

        await expect(panel).toHaveScreenshot('filter-panel-negated-fields.png')
    })
})
