import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { buildSync } from 'esbuild'
import MarkdownIt from 'markdown-it'
import { resolveConfig } from 'vitepress'
import { docs, extract, sources, headingId, keyFor, languages, protect, restore, validateTranslation, transformMarkdown, rebaseAssets } from '../../scripts/docs-i18n.mjs'

const compiled = buildSync({ entryPoints: [path.join(docs, '.vitepress/site-i18n.ts')], bundle: true, write: false, format: 'esm' })
const { localizedLink, siteText, searchTerms } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`)

test('translation markers preserve code, links, HTML, interpolation and API names', () => {
    const original = 'Call `getNode()` in **Pivotick**. [Guide](/api#nodes) <kbd>Ctrl</kbd> {{ value }}'
    const { template, values } = protect(original)
    assert.doesNotMatch(template, /getNode|\/api|<kbd>|\{\{ value/)
    assert.equal(restore(template, values), original)
    assert.throws(() => restore(template.replace('⟦0⟧', ''), values), /Missing/)
    assert.throws(() => restore(template + '⟦0⟧', values), /Invalid/)
    assert.throws(() => validateTranslation('[Guide](/guide)', '⟦1⟧Guide⟦0⟧'), /Changed Markdown links/)
})

test('code fences, source inclusions and Vue scripts do not become prose', () => {
    const seen = []
    const source = '# A & B\n\n::: tip\nUse `Graph`.\n:::\n\n```js\nconst message = "Never translate"\n```\n\n<script setup>\nimport { data } from "./options.js"\n</script>\n\n<<< ./options.js#data [Data]\n'
    const result = transformMarkdown(source, text => { seen.push(text); return text }, {})
    assert.ok(seen.includes('Use `Graph`.'))
    assert.ok(seen.includes('tip'))
    assert.ok(seen.includes('Data'))
    assert.ok(seen.every(text => !text.includes('Never translate') && !text.includes('import {') && !text.includes('<<<') && !text.includes(':::')))
    assert.match(result, /# A & B \{#a-b\}/)
    assert.match(result, /const message = "Never translate"/)
    const html = '<p class="hint">\nDrag the <code>viewer</code> rectangle\nwith the mouse.\n</p>\n'
    const localized = transformMarkdown(html, text => {
        assert.equal(text, 'Drag the <code>viewer</code> rectangle\nwith the mouse.')
        const { template, values } = protect(text)
        assert.doesNotMatch(template, /viewer/)
        return restore(template.replace('Drag the', 'Déplacez le'), values)
    })
    assert.match(localized, /Déplacez le <code>viewer<\/code>/)
})

test('API identifiers stay unchanged while structural headings are translated', () => {
    const result = transformMarkdown('# Class: Node\n\n## Methods\n\n### getNode()\n\n> **getNode**(`id`): `Node`\n\nReturns a node.\n', text => ({ Class: 'Klasse', Methods: 'Methoden', 'Returns a node.': 'Gibt einen Knoten zurück.' })[text] ?? text, { reference: true })
    assert.match(result, /# Klasse: Node/)
    assert.match(result, /## Methoden/)
    assert.match(result, /### getNode\(\)/)
    assert.match(result, /> \*\*getNode\*\*\(`id`\): `Node`/)
    const readme = transformMarkdown('# Core Features\n', () => '核心功能', { reference: true, route: 'reference/README.md' })
    assert.match(readme, /# 核心功能 \{#core-features\}/)
    const anchored = transformMarkdown('## Options {#options}\n', () => '选项{#options}')
    assert.match(anchored, /## 选项 \{#options\}/)
})

test('source URLs may change commit and line without invalidating prose translations', () => {
    assert.equal(keyFor('Defined in: [Graph.ts:1](https://github.com/Pivotick/Pivotick/blob/abc/src/Graph.ts#L1)'), keyFor('Defined in: [Graph.ts:99](https://github.com/Pivotick/Pivotick/blob/def/src/Graph.ts#L99)'))
    assert.equal(headingId('1. A & B: `get_nodes()`'), '_1-a-b-get-nodes')
})

test('a release bump keeps the version breadcrumb out of the prose catalogues', () => {
    assert.equal(keyFor('[**pivotick v2.0.1**](../README.md)'), keyFor('[**pivotick v2.1.0**](../README.md)'))
    assert.doesNotMatch(protect('[**pivotick v2.1.0**](../README.md)').template, /[a-z]/i)
})

test('locale routes stay on the same documentation page without changing asset URLs', () => {
    assert.equal(localizedLink('/ui-table#columns', 'fr'), '/fr/ui-table#columns')
    assert.equal(localizedLink('/api/html/classes/Pivotick.html', 'de'), '/de/reference/classes/Pivotick')
    assert.equal(localizedLink('/api/html/types/GraphUI.MenuActionItemOptions.html', 'fr'), '/fr/reference/pivotick/namespaces/GraphUI/type-aliases/MenuActionItemOptions')
    assert.equal(localizedLink('/api/html/classes/UIManager.html', 'pt'), '/pt/ui-sidebar#registering-panels-at-runtime')
    assert.equal(localizedLink('/api/html/interfaces/GraphQueryEngine.FilterFacet.html', 'zh'), '/zh/ui-filter#declared-facets')
    assert.equal(localizedLink('/fr/ui', 'fr'), '/fr/ui')
    assert.equal(localizedLink('/logo.svg', 'pt'), '/logo.svg')
    assert.equal(localizedLink('https://example.com/', 'zh'), 'https://example.com/')
    assert.equal(siteText('Change language', 'de'), 'Sprache ändern')
    assert.deepEqual(searchTerms('节点。Configuration / getNode()'), ['节点', 'Configuration', 'getNode'])
})

test('relocated pages share original JavaScript and images', () => {
    const source = '<script setup>\nimport { data } from "./options.js"\n</script>\n<<< ./options.js#data [Data]\n![Example](./pic.png)\n'
    const original = path.join(docs, 'examples/gallery/test/content.md')
    const target = path.join(docs, 'fr/examples/gallery/test/content.md')
    const result = rebaseAssets(source, original, target)
    assert.match(result, /\.\.\/\.\.\/\.\.\/\.\.\/examples\/gallery\/test\/options.js/)
    assert.match(result, /#data \[Data\]/)
    assert.match(result, /examples\/gallery\/test\/pic.png/)
})

test('site routes contain every language once and exclude public API sources and catalogues', async () => {
    const config = await resolveConfig(docs, 'build', 'production')
    const expected = (await sources()).flatMap(page => [page.route, ...languages.map(language => `${language}/${page.route}`)])
    assert.deepEqual([...config.pages].sort(), expected.sort())
})

test('all guide, gallery and API pages have complete protected prose in four languages', async () => {
    const { pages, units } = await extract()
    assert.ok(pages.filter(page => !page.reference).length >= 82)
    assert.ok(pages.filter(page => page.reference).length >= 250)
    for (const language of languages) {
        const catalogue = JSON.parse(await fs.readFile(path.join(docs, `translations/${language}.json`), 'utf8'))
        for (const [key, { source }] of Object.entries(units)) {
            assert.ok(catalogue[key]?.trim(), `${language}: ${source}`)
            restore(catalogue[key], protect(source).values)
        }
    }
})

test('every translated page preserves executable components, scripts and fenced code', async () => {
    const parser = new MarkdownIt({ html: true })
    const code = text => parser.parse(text, {}).filter(token => token.type === 'fence').map(token => token.content)
    const inlineCode = text => parser.parse(text, {}).flatMap(token => token.children ?? []).filter(token => token.type === 'code_inline').map(token => token.content).sort()
    const htmlCode = text => (text.match(/<code\b[^>]*>[\s\S]*?<\/code>/g) ?? []).sort()
    const links = text => parser.parse(text, {}).flatMap(token => token.children ?? [])
        .filter(token => token.type === 'link_open' || token.type === 'image')
        .map(token => [token.type, token.attrGet('href') ?? token.attrGet('src')]).sort()
    const scripts = text => text.match(/<(?:script|style)\b[\s\S]*?<\/(?:script|style)>/g) ?? []
    const components = text => text.match(/<Pivotick\b(?:"[^"]*"|'[^']*'|[^'">])*>(?:\s*<\/Pivotick>)?/g) ?? []
    for (const page of await sources()) {
        const original = await fs.readFile(page.file, 'utf8')
        for (const language of languages) {
            const target = path.join(docs, language, page.route)
            const localized = await fs.readFile(target, 'utf8')
            const expected = rebaseAssets(original, page.file, target)
            assert.deepEqual(code(localized), code(original), `${language}: fences in ${page.route}`)
            assert.deepEqual(inlineCode(localized), inlineCode(original), `${language}: inline code in ${page.route}`)
            assert.deepEqual(htmlCode(localized), htmlCode(original), `${language}: HTML code in ${page.route}`)
            assert.deepEqual(links(localized), links(expected), `${language}: links and images in ${page.route}`)
            assert.deepEqual(scripts(localized), scripts(expected), `${language}: script in ${page.route}`)
            assert.deepEqual(components(localized), components(expected), `${language}: component in ${page.route}`)
        }
    }
})
