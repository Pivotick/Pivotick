import { test, expect, gotoHarness, loadFixture, harness } from '../helpers'

/**
 * Regression: a node-data field whose value is `null`/`undefined` must not crash
 * the Graph-Filter facet builder. The filter form is (re)built on every
 * `dataBatchChanged` — which fires synchronously inside `new Graph()` — so a
 * single `null`-valued field (MISP serialises absent attributes as `null`) used
 * to throw `TypeError: Cannot read properties of null (reading 'length')` from
 * `GraphFilter.rebuild()`, aborting construction.
 * See prd/bug-graphfilter-null-value-crash.md.
 */
test.describe('graph filter — null/undefined field values', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    test('builds facets without crashing, omitting null/undefined', async ({ page }) => {
        const pageErrors: string[] = []
        page.on('pageerror', (err) => pageErrors.push(err.message))

        // Pre-fix this rejects: `new Graph()` throws mid-construction
        // (dataBatchChanged → rebuild → `v.length` on null).
        await loadFixture(page, 'nullableFields')

        // Construction completed: all three nodes are present, nothing threw.
        const counts = (await harness(page, 'counts')) as { nodes: number }
        expect(counts.nodes).toBe(3)
        expect(pageErrors).toEqual([])

        // Read the `object_relation` facet straight off the backing <select>
        // (PivotickPicker hides it but keeps its <option>s as the data source).
        await harness(page, 'openFilterPanel')
        const select = page.locator('select[data-field-key="object_relation"]')
        await select.waitFor({ state: 'attached' })
        const options = await select.locator('option').evaluateAll((opts) =>
            (opts as HTMLOptionElement[]).map((o) => ({ value: o.value, label: o.textContent ?? '' }))
        )

        // The only real value is 'rel'; null/undefined are dropped at collection,
        // so the sole non-placeholder facet (allowEmpty prepends an empty one) is 'rel'.
        const facets = options.filter((o) => o.value !== '')
        expect(facets.map((o) => o.label)).toEqual(['rel'])
        // Belt-and-braces: no null/undefined leaked in as an option label.
        expect(options.map((o) => o.label)).not.toContain('null')
        expect(options.map((o) => o.label)).not.toContain('undefined')
    })
})
