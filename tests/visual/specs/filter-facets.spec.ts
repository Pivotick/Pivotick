import { test, expect, gotoHarness, loadFixture, harness } from '../helpers'
import type { Page, Locator } from '@playwright/test'

/**
 * Declarative filter facets (prd/misp/declarative-filter-facets.md).
 *
 * Two halves, both against the MISP-shaped `mispLike` fixture:
 *
 *  - **the panel** — with `UI.filter.facets` declared, the form is generated from
 *    the declaration (exact fields, verbatim labels, declared widgets and order);
 *    without it, auto-derivation still runs and now reaches `numberRange`.
 *  - **the matcher** — array-valued data filters by *membership*, `'all'` means
 *    and-semantics, `accessor` facets read computed values, `predicate` facets
 *    decide for themselves, and a `regex` facet compiles case-insensitively.
 *
 * Filtered-out nodes are *removed* from the render, so "which ids are still
 * visible" is the whole observable outcome of a filter — that's what these assert
 * rather than pixels (one panel screenshot covers the generated form's look).
 */

/** Ids still on the canvas under the current filters. */
async function visibleIds(page: Page): Promise<string[]> {
    return ((await harness(page, 'visibleNodeIds')) as string[]).slice().sort()
}

async function expectVisible(page: Page, ids: string[]): Promise<void> {
    expect(await visibleIds(page)).toEqual(ids.slice().sort())
}

/** Ids still visible *inside* an expanded cluster (its own subgraph + query engine). */
async function expectVisibleInCluster(page: Page, clusterId: string, ids: string[]): Promise<void> {
    const visible = ((await harness(page, 'subgraphVisibleNodeIds', clusterId)) as string[]).slice().sort()
    expect(visible).toEqual(ids.slice().sort())
}

/** The panel's generated fields, in display order. */
async function panelFields(page: Page): Promise<Array<{ key: string; label: string; type: string }>> {
    return (await harness(page, 'filterFields')) as Array<{ key: string; label: string; type: string }>
}

async function panelFieldKeys(page: Page): Promise<string[]> {
    return (await panelFields(page)).map((field) => field.key)
}

/** Open the Graph-Filters panel and wait until its pickers have been built (rAF). */
async function openFilterPanel(page: Page, expectedPickers = 0): Promise<Locator> {
    await harness(page, 'openFilterPanel')
    const panel = page.locator('.pvt-slide-panel.open')
    await panel.waitFor({ state: 'visible' })
    if (expectedPickers > 0) {
        await expect(panel.locator('.pvt-picker')).toHaveCount(expectedPickers)
    }
    return panel
}

test.describe('declared filter facets', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    // The declaration is the single source of truth: exactly the declared fields,
    // in declared order (`order` overriding it), with labels used verbatim.
    test('the panel is generated from the declaration', async ({ page }) => {
        await harness(page, 'loadWithFacets', 'mispLike')

        expect(await panelFields(page)).toEqual([
            // Declared last, but `order: -1` puts it first.
            { key: 'min_sightings', label: 'Min sightings', type: 'text' },
            { key: 'category', label: 'Category', type: 'multiselect' },
            { key: 'attr-type', label: 'Type', type: 'multiselect' },
            { key: 'to_ids', label: 'IDS flag', type: 'select' },
            { key: 'value', label: 'Value', type: 'regex' },
            { key: 'tags', label: 'Tag', type: 'multiselect' },
            { key: 'tags_all', label: 'Has all tags', type: 'multiselect' },
            { key: 'child_type', label: 'Contains attribute of type', type: 'multiselect' },
        ])
    })

    // Auto-derivation contributes nothing once facets are declared — the noisy keys
    // that dominate a derived MISP panel are simply absent.
    test('declared facets replace auto-derivation', async ({ page }) => {
        await harness(page, 'loadWithFacets', 'mispLike')

        const keys = await panelFieldKeys(page)
        for (const derivedOnly of ['uuid', 'label', 'sightings']) {
            expect(keys).not.toContain(derivedOnly)
        }
    })

    test('the generated form renders', async ({ page }) => {
        await harness(page, 'loadWithFacets', 'mispLike')
        // 5 multiselects + the boolean select are picker-backed.
        const panel = await openFilterPanel(page, 6)
        await expect(panel).toHaveScreenshot('filter-panel-declared-facets.png')
    })

    // §3.3 — the blocker: `tags` is an array, so a filter has to test membership.
    // `a2` is tagged `not-malware`, which a substring match would wrongly match.
    test('array-valued data filters by membership, not substring', async ({ page }) => {
        await harness(page, 'loadWithFacets', 'mispLike')
        await harness(page, 'setFilter', 'tags', { value: 'malware' })

        await expectVisible(page, ['a1'])
    })

    test('a multiselect over array data is any-of', async ({ page }) => {
        await harness(page, 'loadWithFacets', 'mispLike')
        await harness(page, 'setFilter', 'tags', { value: ['malware', 'tlp:green'] })

        await expectVisible(page, ['a1', 'a3'])
    })

    // matchMode 'all': every selected tag must be present. Only a3 carries both.
    test("matchMode 'all' requires every selected value", async ({ page }) => {
        await harness(page, 'loadWithFacets', 'mispLike')
        await harness(page, 'setFilter', 'tags_all', { value: ['tlp:amber', 'tlp:green'] })

        await expectVisible(page, ['a3'])
    })

    // A computed facet: `child_type` lives on the node's children, not its own data.
    test('an accessor facet filters on a computed value', async ({ page }) => {
        await harness(page, 'loadWithFacets', 'mispLike')
        await harness(page, 'setFilter', 'child_type', { value: 'md5' })

        await expectVisible(page, ['obj'])
    })

    // A predicate facet decides membership itself (to_ids AND sightings >= n).
    test('a predicate facet decides for itself', async ({ page }) => {
        await harness(page, 'loadWithFacets', 'mispLike')
        await harness(page, 'setFilter', 'min_sightings', { value: '3' })

        await expectVisible(page, ['a1', 'a3'])
    })

    // Facets are declared in UI options, which a subgraph never receives — so the
    // engine hands them down. Without that, `min_sightings` would fall back to a
    // (non-existent) data key inside the cluster and hide both children.
    test('facets reach the nodes inside an expanded cluster', async ({ page }) => {
        await harness(page, 'loadWithFacets', 'mispLike')
        await harness(page, 'expand', 'obj')
        await harness(page, 'setFilter', 'min_sightings', { value: '2' })

        // c1: to_ids, 2 sightings ✓ — c2: neither.
        await expectVisibleInCluster(page, 'obj', ['c1'])
    })

    test('a regex facet matches case-insensitively', async ({ page }) => {
        await harness(page, 'loadWithFacets', 'mispLike')
        await harness(page, 'setFilter', 'value', { value: '^EVIL\\.' })

        await expectVisible(page, ['a2'])
    })

    // An uncompilable pattern is a field error, not an exception out of apply() —
    // and whatever was already applied stays applied.
    test('an invalid pattern is reported and leaves the filters alone', async ({ page }) => {
        await harness(page, 'loadWithFacets', 'mispLike')
        await harness(page, 'setFilter', 'tags', { value: 'malware' })
        await expectVisible(page, ['a1'])

        const panel = await openFilterPanel(page, 6)
        await panel.locator('[data-field-key="value"]').fill('[unclosed')
        await panel.getByRole('button', { name: 'Filter Graph' }).click()

        await expect(panel.locator('.pvt-form-error')).toHaveText('Invalid pattern')
        await expectVisible(page, ['a1'])
    })

    // Editing the offending field clears the error, and applying then works.
    test('fixing the pattern clears the error and applies', async ({ page }) => {
        await harness(page, 'loadWithFacets', 'mispLike')
        const panel = await openFilterPanel(page, 6)
        const pattern = panel.locator('[data-field-key="value"]')

        await pattern.fill('[unclosed')
        await panel.getByRole('button', { name: 'Filter Graph' }).click()
        await expect(panel.locator('.pvt-form-error')).toBeVisible()

        await pattern.fill('^8\\.')
        await expect(panel.locator('.pvt-form-error')).toHaveCount(0)
        await panel.getByRole('button', { name: 'Filter Graph' }).click()

        await expectVisible(page, ['a1'])
    })

    // Declaring facets must not cost the panel's existing wiring: a filter set from
    // code still lands in the form control, and still counts on the header pill.
    test('a programmatic filter round-trips into a declared field', async ({ page }) => {
        await harness(page, 'loadWithFacets', 'mispLike')
        await harness(page, 'setFilter', 'tags', { value: ['tlp:amber'] })

        const panel = await openFilterPanel(page, 6)
        const tagField = panel.locator('.pvt-form-element').filter({ hasText: 'Tag' }).first()
        await expect(tagField.locator('.pvt-picker__chip-label')).toHaveText('tlp:amber')

        // …and the header pill reports it (1 active filter, 1 node hidden: a2).
        const pill = page.locator('#pvt-filter-button')
        await expect(pill).toHaveClass(/pvt-filter-on/)
        await expect(pill.locator('.pvt-filter-count')).toHaveText('1')
    })

    // A boolean facet has to offer *false* as well as true — and read it back as a
    // boolean, or it could never match a `to_ids: false` node.
    test('a boolean facet can filter on false', async ({ page }) => {
        await harness(page, 'loadWithFacets', 'mispLike')
        await openFilterPanel(page, 6)

        await harness(page, 'setPanelValue', 'to_ids', 'false')
        expect(await harness(page, 'panelValues')).toMatchObject({ to_ids: false })

        await harness(page, 'setFilter', 'to_ids', { value: false })
        await expectVisible(page, ['a2', 'obj'])
    })
})

test.describe('auto-derived facets', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    // §4.3 — `numberRange` was unreachable: integers were folded into the value list
    // and the range branch guarded by an always-true test.
    test('a purely numeric field derives a numberRange', async ({ page }) => {
        await loadFixture(page, 'mispLike')

        expect(await panelFields(page)).toContainEqual({
            key: 'sightings', label: 'Sightings', type: 'numberRange',
        })
    })

    test('a derived numberRange filters by range', async ({ page }) => {
        await loadFixture(page, 'mispLike')
        await harness(page, 'setFilter', 'sightings', { value: { min: 3, max: undefined } })

        await expectVisible(page, ['a1', 'a3'])
    })

    // The cheap escape from `uuid`-style noise without declaring everything.
    test('excludeKeys drops keys from derivation', async ({ page }) => {
        await loadFixture(page, 'mispLike', { UI: { filter: { excludeKeys: ['uuid', 'value'] } } })

        const keys = await panelFieldKeys(page)
        expect(keys).not.toContain('uuid')
        expect(keys).not.toContain('value')
        expect(keys).toContain('category') // untouched
    })

    // Derived labels are prettified from the key (the panel's long-standing look).
    test('derived labels are prettified keys', async ({ page }) => {
        await loadFixture(page, 'mispLike')

        expect(await panelFields(page)).toContainEqual({
            key: 'attr-type', label: 'Attr Type', type: 'multiselect',
        })
    })

    // §3.6 — the documented default is 'exact'; the runtime used to default to
    // 'partial', so a programmatic filter substring-matched without being asked to.
    test('matchMode defaults to exact', async ({ page }) => {
        await loadFixture(page, 'mispLike')
        await harness(page, 'setFilter', 'category', { value: 'Payload' })

        // 'Payload' is a prefix of 'Payload delivery' but not equal to it.
        await expectVisible(page, [])
    })

    test('an explicit partial match still substring-matches', async ({ page }) => {
        await loadFixture(page, 'mispLike')
        await harness(page, 'setFilter', 'category', { value: 'Payload', matchMode: 'partial' })

        await expectVisible(page, ['a3', 'obj'])
    })
})
