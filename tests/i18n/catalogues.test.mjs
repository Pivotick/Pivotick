import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { buildSync } from 'esbuild'
import { compileCatalogue, locales, parsePo, serializePo } from '../../scripts/i18n.mjs'

const result = buildSync({
    stdin: {
        contents: "export { I18n } from './src/i18n/I18n'\nexport { messagesEn } from './src/i18n/en'",
        resolveDir: fileURLToPath(new URL('../../', import.meta.url)),
    },
    bundle: true, write: false, platform: 'node', format: 'esm',
})
const { I18n, messagesEn: english } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
const read = locale => fs.readFile(new URL(`../../locales/${locale}.po`, import.meta.url), 'utf8')

for (const locale of Object.keys(locales)) {
    test(`${locale}: every English key has a usable translation with intact placeholders`, async () => {
        const messages = compileCatalogue(parsePo(await read(locale)), english, locale)
        assert.deepEqual(Object.keys(messages).sort(), Object.keys(english).sort())
        const i18n = new I18n({ locale })
        for (const [key, source] of Object.entries(english)) {
            const forms = typeof source === 'string' ? [source] : Object.values(source)
            const params = Object.fromEntries(forms.flatMap(text => [...text.matchAll(/\{(\w+)\}/g)].map(match => [match[1], 'VALUE'])))
            for (const count of [0, 1, 2, 1.5, 1000000]) {
                const text = i18n.t(key, { ...params, count })
                assert.ok(text.length > 0, key)
                assert.doesNotMatch(text, /\{\w+\}/, key)
            }
        }
    })
}

test('locale-only selection and regional aliases use bundled messages', () => {
    const expected = { fr: 'Rechercher', de: 'Suchen', pt: 'Pesquisar', zh: '搜索' }
    for (const [language, message] of Object.entries(expected)) {
        for (const locale of [language, { fr: 'fr-CA', de: 'de-CH', pt: 'pt-BR', zh: 'zh-Hans-CN' }[language]]) {
            assert.equal(new I18n({ locale }).t('topBar.search'), message)
        }
    }
    assert.equal(new I18n().t('topBar.search'), 'Search')
    assert.equal(new I18n({ locale: 'hi' }).t('count.nodes', { count: 0 }), '0 nodes')
})

test('bundled plurals follow locale rules, including Portuguese regional differences', () => {
    const counted = (locale, counts) => counts.map(count => new I18n({ locale }).t('count.nodes', { count }))
    assert.deepEqual(counted('fr', [0, 1, 2]), ['0 nœud', '1 nœud', '2 nœuds'])
    assert.deepEqual(counted('de', [0, 1, 2]), ['0 Knoten', '1 Knoten', '2 Knoten'])
    assert.deepEqual(counted('zh', [0, 1, 2]), ['0 个节点', '1 个节点', '2 个节点'])
    assert.deepEqual(counted('pt-BR', [0, 1, 2]), ['0 nó', '1 nó', '2 nós'])
    assert.deepEqual(counted('pt-PT', [0, 1, 2]), ['0 nós', '1 nó', '2 nós'])
    assert.equal(new I18n({ locale: 'fr' }).t('count.nodes', { count: 1000000 }), '1\u202f000\u202f000 nœuds')
})

test('messages override hooks, hooks override bundles, undefined keeps the bundle', () => {
    const calls = []
    const i18n = new I18n({
        locale: 'fr', messages: { 'busy.label': 'CUSTOM' },
        translate: (key, params, fallback) => {
            calls.push({ key, params, fallback })
            return key === 'count.nodes' ? 'HOOK' : undefined
        },
    })
    assert.equal(i18n.t('busy.label'), 'CUSTOM')
    assert.equal(calls.length, 0)
    assert.equal(i18n.t('count.nodes', { count: 1234 }), 'HOOK')
    assert.deepEqual(calls[0], { key: 'count.nodes', params: { count: 1234 }, fallback: '1\u202f234 nodes' })
    assert.equal(i18n.t('topBar.search'), 'Rechercher')
    assert.equal(new I18n({ locale: 'de' }).t('topBar.search'), 'Suchen')
})

test('a throwing hook falls back to the selected language', t => {
    const warnings = []
    t.mock.method(console, 'warn', (...args) => warnings.push(args))
    const i18n = new I18n({ locale: 'zh', translate: () => { throw new Error('offline') } })
    assert.equal(i18n.t('topBar.search'), '搜索')
    assert.equal(warnings.length, 1)
})

test('PO parsing handles multiline strings, escaped quotes, UTF-8, CRLF and translator comments', () => {
    const text = '# Translator note\nmsgctxt "key"\nmsgid "Hello \\\"world\\\""\nmsgstr ""\n"Bonjour "\n"à tous\\n"\n'
    const entries = parsePo(text.replaceAll('\n', '\r\n'))
    assert.equal(entries[0].msgid, 'Hello "world"')
    assert.equal(entries[0].msgstr, 'Bonjour à tous\n')
    assert.equal(entries[0].comments[0], '# Translator note')
    assert.deepEqual(parsePo(serializePo(entries)), entries)
    assert.throws(() => parsePo('msgid "unfinished'), /expected a gettext directive/)
    assert.throws(() => parsePo('msgid "a"\nmsgid "b"'), /duplicate msgid/)
})

test('invalid catalogues fail before reaching a published build', async () => {
    const original = parsePo(await read('de'))
    const invalid = change => {
        const entries = structuredClone(original)
        change(entries)
        return () => compileCatalogue(entries, english, 'de')
    }
    const find = entries => entries.find(entry => entry.msgctxt === 'count.nodes')
    assert.throws(invalid(entries => entries.pop()), /missing message/)
    assert.throws(invalid(entries => entries.push(structuredClone(entries[1]))), /duplicate message/)
    assert.throws(invalid(entries => { entries[1].msgctxt = 'unknown.key' }), /unknown message/)
    assert.throws(invalid(entries => { find(entries).msgid = 'Changed source' }), /outdated source/)
    assert.throws(invalid(entries => { find(entries)['msgstr[0]'] = 'Knoten' }), /placeholders differ/)
    assert.throws(invalid(entries => { find(entries)['msgstr[1]'] = '' }), /empty translation/)
    assert.throws(invalid(entries => { find(entries).flags = ['fuzzy'] }), /fuzzy translation/)
    assert.throws(invalid(entries => { delete find(entries)['msgstr[1]'] }), /invalid plural slots/)
    assert.throws(invalid(entries => { entries[0].msgstr = entries[0].msgstr.replace('Language: de', 'Language: fr') }), /wrong Language/)
    assert.throws(invalid(entries => { entries[0].msgstr = entries[0].msgstr.replace('nplurals=2', 'nplurals=3') }), /unexpected Plural-Forms/)
})
