import type { Page } from '@playwright/test'
import { test, expect, gotoHarness, loadFixture, harness, openNodeTooltip } from '../helpers'
import type { TranslateCall } from '../harness/harness'
import type { MessageKey, MessageParams, PluralForms } from '../../../src/interfaces/I18n'

/**
 * `GraphOptions.i18n`: the language of the text the library writes itself. `messages`
 * rewords built-in strings, `translate` bridges the host's own library, and English fills
 * every gap. The locale also picks plural forms and how numbers, lists and sorts are
 * written, and goes on the graph's root as `lang` when the host declares one.
 *
 * The empty-canvas card is the visible surface: its message is a catalogue entry.
 */

const EMPTY_MESSAGE = 'Nothing on the canvas yet'
const FULL = { UI: { mode: 'full', sidebar: { collapsed: false } } }

const emptyCard = (page: Page) => page.locator('.pvt-empty-state-card')

/** What the loaded graph's `i18n.t` says for `key`. */
function message(page: Page, key: MessageKey, params: MessageParams = {}): Promise<string> {
    return page.evaluate(([k, p]) => window.__pivotick.graph!.i18n.t(k, p), [key, params] as const)
}

/** `simplify.typeLabel` for each count, under plural forms the test supplies for it. */
async function countedUnder(page: Page, locale: string, forms: PluralForms, counts: number[]): Promise<string[]> {
    await loadFixture(page, 'empty', { i18n: { locale, messages: { 'simplify.typeLabel': forms } } })
    const said: string[] = []
    for (const count of counts) said.push(await message(page, 'simplify.typeLabel', { count }))
    return said
}

/** `items` joined as a sentence by the loaded graph. */
function listed(page: Page, items: string[]): Promise<string> {
    return page.evaluate((i) => window.__pivotick.graph!.i18n.formatList(i), items)
}

/** `items` in the loaded graph's sort order. */
function sorted(page: Page, items: string[]): Promise<string[]> {
    return page.evaluate((i) => [...i].sort(window.__pivotick.graph!.i18n.compare), items)
}

/** The `lang` on the loaded graph's root, `null` when the library set none. */
async function rootLang(page: Page): Promise<string | null> {
    return (await harness(page, 'rootLangs') as { tested: string | null }).tested
}

const translateCalls = async (page: Page): Promise<TranslateCall[]> =>
    await harness(page, 'translateCalls') as TranslateCall[]

test.describe('i18n: messages', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    test('a messages entry rewords a built-in string', async ({ page }) => {
        await loadFixture(page, 'empty', { i18n: { locale: 'fr', messages: { 'emptyState.message': 'Rien sur le canevas' } } })
        await expect(emptyCard(page)).toHaveText('Rien sur le canevas')
    })

    test('the chrome takes its words from the messages, in text and in tooltips', async ({ page }) => {
        await loadFixture(page, 'basic', {
            ...FULL,
            i18n: { locale: 'fr', messages: { 'topBar.search': 'Rechercher', 'navigation.zoomIn': 'Zoom avant' } },
        })
        await expect(page.locator('#pvt-searchbox-button .action-text')).toHaveText('Rechercher')
        await expect(page.locator('#pvt-graphnavigation-zoom-in')).toHaveAttribute('title', 'Zoom avant')
        // Other keys use the bundled French catalogue.
        await expect(page.locator('#pvt-filter-button .action-text')).toHaveText('Filtrer le graphe')
    })

    test('a key the messages leave out uses the bundled language', async ({ page }) => {
        await loadFixture(page, 'empty', { i18n: { locale: 'fr', messages: { 'busy.label': 'Patientez…' } } })
        await expect(emptyCard(page)).toHaveText('Le canevas est encore vide')
    })

    test("the feature's own option wins over the messages", async ({ page }) => {
        await loadFixture(page, 'empty', {
            UI: { emptyState: { render: 'Drop a file here' } },
            i18n: { messages: { 'emptyState.message': 'Rien sur le canevas' } },
        })
        await expect(emptyCard(page)).toHaveText('Drop a file here')
    })

    test('placeholders are filled, numbers in the locale’s digits, strings as written', async ({ page }) => {
        await loadFixture(page, 'empty')
        expect(await message(page, 'simplify.typeLabel', { count: 1234, type: 'ip' })).toBe('1,234 × ip')
        expect(await message(page, 'simplify.typeLabel', { count: '1234', type: 'ip' })).toBe('1234 × ip')

        await loadFixture(page, 'empty', { i18n: { locale: 'de' } })
        expect(await message(page, 'simplify.typeLabel', { count: 1234, type: 'ip' })).toBe('1.234 × ip')
    })

    test('plural forms follow the locale: Polish has three, French counts zero as one', async ({ page }) => {
        const polish = { one: '{count} węzeł', few: '{count} węzły', many: '{count} węzłów', other: '{count} węzła' }
        expect(await countedUnder(page, 'pl', polish, [1, 3, 5, 22, 1.5]))
            .toEqual(['1 węzeł', '3 węzły', '5 węzłów', '22 węzły', '1,5 węzła'])

        const french = { one: '{count} nœud', other: '{count} nœuds' }
        expect(await countedUnder(page, 'fr', french, [0, 1, 2])).toEqual(['0 nœud', '1 nœud', '2 nœuds'])

        const english = { one: '{count} node', other: '{count} nodes' }
        expect(await countedUnder(page, 'en', english, [0, 1, 2])).toEqual(['0 nodes', '1 node', '2 nodes'])
    })

    test('a built-in English message keeps English plurals under a locale that has no translation for it', async ({ page }) => {
        await loadFixture(page, 'empty', { i18n: { locale: 'hi' } })
        // Hindi counts zero as one; fallback English must keep English plural rules.
        expect(await message(page, 'count.nodes', { count: 0 })).toBe('0 nodes')
        expect(await message(page, 'count.nodes', { count: 1 })).toBe('1 node')
    })
})

test.describe('i18n: translate', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    test('translate is asked for each key, with the raw params and the English', async ({ page }) => {
        await harness(page, 'loadTranslated', 'empty', { answers: { 'emptyState.message': 'Rien ici' } })
        await expect(emptyCard(page)).toHaveText('Rien ici')
        expect(await translateCalls(page)).toContainEqual({ key: 'emptyState.message', params: {}, fallback: EMPTY_MESSAGE })

        // No answer for this one: the English shows, and the host saw the count unformatted.
        expect(await message(page, 'simplify.typeLabel', { count: 1234, type: 'ip' })).toBe('1,234 × ip')
        expect((await translateCalls(page)).at(-1))
            .toEqual({ key: 'simplify.typeLabel', params: { count: 1234, type: 'ip' }, fallback: '1,234 × ip' })
    })

    test('messages win over translate, which is then not asked', async ({ page }) => {
        await harness(page, 'loadTranslated', 'empty', {
            answers: { 'emptyState.message': 'from translate' },
            i18n: { messages: { 'emptyState.message': 'from messages' } },
        })
        await expect(emptyCard(page)).toHaveText('from messages')
        expect((await translateCalls(page)).map((call) => call.key)).not.toContain('emptyState.message')
    })

    test('a translate that throws shows the English and says why', async ({ page }) => {
        await harness(page, 'loadTranslated', 'empty', { throwing: ['emptyState.message'] })
        await expect(emptyCard(page)).toHaveText(EMPTY_MESSAGE)
        expect(await harness(page, 'warnings')).toContainEqual(expect.stringContaining('i18n.translate threw for "emptyState.message"'))
    })
})

test.describe('i18n: formats', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    test('a list is joined the way the locale writes one', async ({ page }) => {
        await loadFixture(page, 'empty')
        expect(await listed(page, ['ip', 'domain', 'file'])).toBe('ip, domain, and file')
        await loadFixture(page, 'empty', { i18n: { locale: 'fr' } })
        expect(await listed(page, ['ip', 'domain', 'file'])).toBe('ip, domain et file')
    })

    test('a sort follows the locale, and numbers inside words sort as numbers', async ({ page }) => {
        await loadFixture(page, 'empty')
        expect(await sorted(page, ['zebra', 'äpple', 'item 10', 'item 9'])).toEqual(['äpple', 'item 9', 'item 10', 'zebra'])
        // Swedish puts ä after z.
        await loadFixture(page, 'empty', { i18n: { locale: 'sv' } })
        expect(await sorted(page, ['zebra', 'äpple'])).toEqual(['zebra', 'äpple'])
    })
})

test.describe('i18n: lang', () => {
    test.beforeEach(async ({ page }) => {
        await gotoHarness(page)
    })

    test('with no locale declared the root has no lang, so the page’s own applies', async ({ page }) => {
        await loadFixture(page, 'basic')
        expect(await rootLang(page)).toBeNull()
    })

    test('a declared locale goes on the root, written canonically', async ({ page }) => {
        await loadFixture(page, 'basic', { i18n: { locale: 'pt-br' } })
        expect(await rootLang(page)).toBe('pt-BR')
    })

    test('a tag that is no language is refused with a warning, and English is used', async ({ page }) => {
        await loadFixture(page, 'basic', { i18n: { locale: 'not a tag!' } })
        expect(await rootLang(page)).toBeNull()
        expect(await page.evaluate(() => window.__pivotick.graph!.i18n.locale)).toBe('en')
        expect(await harness(page, 'warnings')).toContainEqual(expect.stringContaining('"not a tag!" is not a language tag'))
    })

    test('the tooltip, mounted outside the root, carries its language', async ({ page }) => {
        await loadFixture(page, 'basic', { i18n: { locale: 'fr' } })
        const tip = await openNodeTooltip(page, 'a')
        await expect(tip).toHaveAttribute('lang', 'fr')
    })

    test('two graphs on one page keep their own language', async ({ page }) => {
        await harness(page, 'loadBesideAnotherGraph', 'basic', { i18n: { locale: 'fr' }, otherI18n: { locale: 'de' } })
        expect(await harness(page, 'rootLangs')).toEqual({ tested: 'fr', other: 'de' })
    })

    test('the neighbours ego graph speaks its parent’s language', async ({ page }) => {
        await harness(page, 'loadTypedFilterable', { ...FULL, i18n: { locale: 'fr' } })
        await harness(page, 'selectNode', 'r1')
        // On the ego graph's own root, not inherited from the main one around it.
        await expect(page.locator('.main-egograph-container .pivotick')).toHaveAttribute('lang', 'fr')
    })

    test("a plugin reads the graph's language from its context", async ({ page }) => {
        await loadFixture(page, 'basic', { i18n: { locale: 'fr' } })
        const seen = await page.evaluate(() => {
            const graph = window.__pivotick.graph!
            let reading = ''
            graph.use({
                name: 'i18n-probe',
                install: (ctx) => {
                    reading = `${ctx.i18n.locale} ${ctx.i18n === graph.i18n ? 'shared' : 'copied'}`
                },
            })
            return reading
        })
        expect(seen).toBe('fr shared')
    })
})
