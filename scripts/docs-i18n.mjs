import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath, pathToFileURL } from 'node:url'
import MarkdownIt from 'markdown-it'
import yaml from 'js-yaml'

export const root = fileURLToPath(new URL('../', import.meta.url))
export const docs = path.join(root, 'docs')
export const languages = ['zh', 'fr', 'de', 'pt']
const markdown = new MarkdownIt({ html: true })
export const headingId = text => text.normalize('NFKD').replace(/[\u0300-\u036f\u0000-\u001f]/g, '')
    .replace(/[\s~`!@#$%^&*()\-_+=[\]{}|\\;:"'“”‘’<>,.?/]+/g, '-')
    .replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '').replace(/^(\d)/, '_$1').toLowerCase()
const stableSource = text => text.replace(/\[[^\]]+\]\(https:\/\/github\.com\/Pivotick\/Pivotick\/blob\/[^)]+\)/g, '[source]')
export const keyFor = text => createHash('sha256').update(stableSource(text)).digest('hex').slice(0, 24)

export function protect(text) {
    const values = []
    const add = value => `⟦${values.push(value) - 1}⟧`
    // Code, URLs, HTML and Vue expressions are never sent for translation.
    const api = text.replace(/<code\b[^>]*>[\s\S]*?<\/code>|\[(?:Node|Edge|Graph|Note|Pivotick|I18n|Notifier|Simulation|Flyout|UIComponent)\]\([^)]*\.md(?:#[^)]*)?\)/g, add)
    const template = api.replace(/\[[^\]]+\]\(https:\/\/github\.com\/Pivotick\/Pivotick\/blob\/[^)]+\)|(`+)[\s\S]*?\1|<[^>]+>|\{\{[\s\S]*?\}\}|\]\([^\n]*?\)|\{#[^}]+\}|\\[<>|*_[\]`]|https?:\/\/[^\s)]+|\b(?:Pivotick|TypeScript|JavaScript|VitePress|TypeDoc|D3\.js|HTML|CSS|SVG|JSON|CSV|ESM|UMD|CLDR|BCP 47|Node\.js)\b|\b\w*[a-z][A-Z]\w*\b|\*\*|__|(?<!\w)[*_]|[*_](?!\w)|\[|\]/g, add)
    return { template, values }
}

export function restore(translated, values) {
    const seen = new Set()
    // Two code spans moved beside each other must not merge into a double-backtick span.
    translated = translated.replace(/(⟦\s*(\d+)\s*⟧)(?=⟦\s*(\d+)\s*⟧)/g, (marker, _whole, previous, next) =>
        values[Number(previous)]?.startsWith('`') && values[Number(next)]?.startsWith('`') ? marker + ' ' : marker)
    const result = translated.replace(/⟦\s*(\d+)\s*⟧/g, (_, index) => {
        const n = Number(index)
        if (n >= values.length || seen.has(n)) throw new Error('Invalid translation placeholder')
        seen.add(n)
        return values[n]
    })
    if (seen.size !== values.length) throw new Error('Missing translation placeholder')
    return result
}

export function validateTranslation(source, translated) {
    if (/[<>`]|\{\{/.test(translated)) throw new Error('Raw markup in translated prose')
    const output = restore(translated, protect(source).values)
    const links = text => markdown.parse(text, {}).flatMap(token => token.children ?? [])
        .filter(token => token.type === 'link_open' || token.type === 'image')
        .map(token => [token.type, token.attrGet('href') ?? token.attrGet('src')]).sort()
    if (JSON.stringify(links(source)) !== JSON.stringify(links(output))) throw new Error('Changed Markdown links or images')
    return output
}

const prose = text => /[A-Za-z]{2}/.test(protect(text).template.replace(/⟦\d+⟧/g, ''))
const structuralHeading = /^(?:(?:(?:Abstract )?(?:Class|Interface)|Type Alias|Variable|Namespace|Enumeration|Function): |(?:Constructors?|Methods?|Properties|Accessors|Parameters|Returns|Throws|Examples?|Remarks|See|Default(?: Value)?|Type Parameters|Extends|Extended by|Implements|Implementation of|Inherited from|Index|References|Modules|Namespaces|Classes|Interfaces|Type Aliases|Variables|Functions|Enumeration Members|Type Declaration|Call Signature|Index Signature|Get Signature|Set Signature|Main Options|UI Options|Other)$)/

/** Extract paragraphs with source positions; fences, signatures and component code stay intact. */
export function transformMarkdown(source, translate = text => text, { reference = false, language = 'en', route = '' } = {}) {
    const apiIdentifiers = reference && !route.endsWith('/README.md')
    const lines = source.replace(/\r\n/g, '\n').split('\n')
    let bodyStart = 0
    if (lines[0] === '---') {
        const end = lines.indexOf('---', 1)
        if (end < 0) throw new Error('Unclosed frontmatter')
        const data = yaml.load(lines.slice(1, end).join('\n')) ?? {}
        const localize = (value, field = '') => {
            if (Array.isArray(value)) return value.map(v => localize(v, field))
            if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, localize(v, k)]))
            if (field === 'link' && typeof value === 'string' && value.startsWith('/') && language !== 'en') return `/${language}${value}`
            return typeof value === 'string' && ['title', 'description', 'text', 'tagline', 'details', 'alt'].includes(field) && prose(value) ? translate(value) : value
        }
        const frontmatter = yaml.dump(localize(data), { lineWidth: -1, noRefs: true }).trimEnd()
        lines.splice(0, end + 1, '---', frontmatter, '---')
        // Treat frontmatter as one array element so offsets in the body remain simple.
        bodyStart = 3
    }
    const body = lines.slice(bodyStart).join('\n')
    const bodyLines = body.split('\n')
    let component = ''
    const parseLines = bodyLines.map(line => {
        const open = /^\s*<([A-Z][\w]*|script|style)\b/.exec(line)
        if (!component && open) component = open[1]
        if (component) {
            const masked = ''
            if (line.includes(`</${component}>`) || /\/>\s*$/.test(line)) component = ''
            return masked
        }
        return /^\s*(?::::|<<<)/.test(line) ? '' : line
    })
    const tokens = markdown.parse(parseLines.join('\n'), {})
    const changes = []
    const headingCounts = new Map()
    const occupied = new Set()
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i]
        if (token.type !== 'inline' || !token.map) continue
        const [start, end] = token.map
        if (occupied.has(start)) continue
        const heading = tokens[i - 1]?.type === 'heading_open'
        let text = token.content
        // Generated API headings name identifiers; signatures are code even without fences.
        if (apiIdentifiers && (!heading && /^\s*>/.test(bodyLines[start]) || heading && !structuralHeading.test(text))) continue
        if (!prose(text) && !heading) continue
        const first = text.split('\n')[0]
        const offset = bodyLines[start].indexOf(first)
        if (offset < 0) continue
        const prefix = bodyLines[start].slice(0, offset)
        const named = apiIdentifiers && heading ? /^((?:Abstract )?(?:Class|Interface)|Type Alias|Variable|Namespace|Enumeration|Function): (.+)$/.exec(text) : null
        let output = named ? `${translate(named[1])}: ${named[2]}` : translate(text)
        output = output.replace(/\s*\n\s*/g, ' ')
        if (heading) output = output.replace(/\s*(\{#[^}]+\})/, ' $1')
        if (heading && !/\{#[^}]+\}/.test(text)) {
            // Keep English anchors stable when changing language or following deep links.
            const plain = markdown.parseInline(text, {})[0].children?.map(t => t.type === 'html_inline' ? '' : t.content).join('') ?? text
            const base = headingId(plain)
            const ordinal = headingCounts.get(base) ?? 0
            headingCounts.set(base, ordinal + 1)
            output += ` {#${base}${ordinal ? `-${ordinal}` : ''}}`
        }
        changes.push({ start, end, text: prefix + output })
        for (let n = start; n < end; n++) occupied.add(n)
    }
    // Table inline tokens do not carry line maps. Preserve pipes, backticks and alignment.
    let fence = ''
    let rawBlock = ''
    for (const token of tokens.filter(token => token.type === 'html_block' && token.map && !/^\s*<(?:script|style)\b/.test(token.content))) {
        const [start, end] = token.map
        const original = bodyLines.slice(start, end).join('\n')
        const text = original.replace(/(<(p|h[1-6]|span|label|button|summary|kbd)\b[^>]*>)([\s\S]*?)(<\/\2>)/g, (all, open, _tag, value, close) =>
            prose(value) && !value.includes('{{') ? open + translate(value.trim()) + close : all)
        if (text !== original) changes.push({ start, end, text })
        for (let n = start; n < end; n++) occupied.add(n)
    }
    for (let n = 0; n < bodyLines.length; n++) {
        const line = bodyLines[n]
        const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1]
        if (marker) { if (!fence) fence = marker; else if (marker[0] === fence[0] && marker.length >= fence.length) fence = ''; continue }
        if (fence) continue
        if (/^\s*<(script|style)\b/.test(line)) rawBlock = /^\s*<(\w+)/.exec(line)[1]
        if (rawBlock) { if (line.includes(`</${rawBlock}>`)) rawBlock = ''; continue }
        if (occupied.has(n)) continue
        if (/^\s*\|/.test(line) && !/^\s*\|[\s:|\-]+$/.test(line)) {
            const cells = line.split(/(?<!\\)\|/)
            changes.push({ start: n, end: n + 1, text: cells.map(cell => {
                const trimmed = cell.trim()
                return prose(trimmed) ? cell.replace(trimmed, translate(trimmed)) : cell
            }).join('|') })
        } else if (/^\s*<<<\s/.test(line)) {
            changes.push({ start: n, end: n + 1, text: line.replace(/\[([^\]]+)\]\s*$/, (_, label) => `[${translate(label)}]`) })
        } else if (/^:::\s+(?:tip|warning|danger|info|details)(?:\s|$)/.test(line)) {
            changes.push({ start: n, end: n + 1, text: line.replace(/^(:::\s+\w+)(?:\s+(.*))?$/, (_, prefix, label) => `${prefix} ${translate(label || prefix.split(/\s+/)[1])}`) })
        }
    }
    for (const change of changes.sort((a, b) => b.start - a.start)) bodyLines.splice(change.start, change.end - change.start, change.text)
    fence = ''
    rawBlock = ''
    const html = bodyLines.map(line => {
        const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1]
        if (marker) { if (!fence) fence = marker; else if (marker[0] === fence[0] && marker.length >= fence.length) fence = ''; return line }
        if (fence) return line
        if (/^\s*<(script|style)\b/.test(line)) rawBlock = /^\s*<(\w+)/.exec(line)[1]
        if (rawBlock) { if (line.includes(`</${rawBlock}>`)) rawBlock = ''; return line }
        return line.replace(/(?<![:\w-])(hint|title|aria-label|alt|placeholder|text)="([^"]*)"/g, (all, name, value) =>
            prose(value) ? `${name}="${translate(value).replaceAll('"', '&quot;')}"` : all)
    })
    return [...lines.slice(0, bodyStart), ...html].join('\n')
}

async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    const files = []
    for (const entry of entries) {
        if (entry.name.startsWith('.') || ['public', 'assets', 'translations', 'node_modules', 'reference', ...languages].includes(entry.name)) continue
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) files.push(...await walk(full))
        else if (entry.name.endsWith('.md')) files.push(full)
    }
    return files
}

export async function sources() {
    const authored = await walk(docs)
    const apiRoot = path.join(docs, 'public/api/markdown')
    const api = []
    const scan = async dir => {
        for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name)
            if (entry.isDirectory()) await scan(full)
            else if (entry.name.endsWith('.md')) api.push(full)
        }
    }
    await scan(apiRoot)
    return [
        ...authored.map(file => ({ file, route: path.relative(docs, file).replaceAll(path.sep, '/'), reference: false })),
        ...api.map(file => ({ file, route: 'reference/' + path.relative(apiRoot, file).replaceAll(path.sep, '/'), reference: true })),
    ].sort((a, b) => a.route.localeCompare(b.route))
}

export function rebaseAssets(text, source, destination) {
    const rebase = (target, asset = false) => {
        if ((!asset && !target.startsWith('.')) || /^(?:\/|#|[a-z]+:)/i.test(target)) return target
        let resolved = path.resolve(path.dirname(source), target)
        // TypeDoc embeds the repository README without rebasing its images.
        if (asset && !existsSync(resolved) && existsSync(path.resolve(root, target))) resolved = path.resolve(root, target)
        const relative = path.relative(path.dirname(destination), resolved).replaceAll(path.sep, '/')
        return relative.startsWith('.') ? relative : './' + relative
    }
    const replace = content => content
        .replace(/<script\b[\s\S]*?<\/script>/g, script => script.replace(/((?:from\s+|import\s*)['"])(\.[^'"]+)(['"])/g, (_, before, target, after) => before + rebase(target) + after))
        .replace(/^(\s*<<<\s+)(\.[^\s#]+)(.*)$/gm, (_, before, target, after) => before + rebase(target) + after)
        .replace(/(!\[[^\]]*\]\()([^)]+)(\))/g, (_, before, target, after) => before + rebase(target, true) + after)
    let fence = ''
    let pending = ''
    let output = ''
    for (const line of text.match(/[^\n]*\n|[^\n]+$/g) ?? []) {
        const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1]
        if (!fence && marker) { output += replace(pending) + line; pending = ''; fence = marker }
        else if (fence) { output += line; if (marker && marker[0] === fence[0] && marker.length >= fence.length) fence = '' }
        else pending += line
    }
    return output + replace(pending)
}

export async function extract() {
    const units = {}
    const pages = await sources()
    for (const page of pages) {
        const source = await fs.readFile(page.file, 'utf8')
        transformMarkdown(source, text => {
            if (!prose(text)) return text
            const id = keyFor(text)
            units[id] ??= { source: text, pages: [] }
            if (!units[id].pages.includes(page.route)) units[id].pages.push(page.route)
            return text
        }, page)
    }
    return { pages, units }
}

export async function main(command) {
    const { pages, units } = await extract()
    if (command === 'extract') {
        await fs.writeFile(path.join(docs, 'translations/source.json'), JSON.stringify(units, null, 2) + '\n')
        console.log(`${pages.length} pages; ${Object.keys(units).length} prose segments`)
        return
    }
    if (!['build', 'check'].includes(command)) throw new Error('Usage: docs-i18n.mjs extract|build|check')
    const manifest = JSON.parse(await fs.readFile(path.join(docs, 'translations/source.json'), 'utf8'))
    const missing = Object.keys(units).filter(key => !manifest[key] || keyFor(manifest[key].source) !== keyFor(units[key].source))
    if (missing.length) throw new Error(`${missing.length} new documentation segments need translations; run npm run docs:i18n:extract`)
    const translated = {}
    for (const language of languages) {
        const catalogue = JSON.parse(await fs.readFile(path.join(docs, `translations/${language}.json`), 'utf8'))
        for (const [key, { source }] of Object.entries(units)) {
            if (typeof catalogue[key] !== 'string' || !catalogue[key].trim()) throw new Error(`${language}: missing translation ${key}`)
            try { validateTranslation(source, catalogue[key]) }
            catch (error) { throw new Error(`${language}: ${key}: ${error.message}`) }
        }
        translated[language] = catalogue
    }
    if (command === 'build') {
        for (const language of languages) await fs.rm(path.join(docs, language), { recursive: true, force: true })
        await fs.rm(path.join(docs, 'reference'), { recursive: true, force: true })
        for (const page of pages) {
            const original = await fs.readFile(page.file, 'utf8')
            for (const language of ['en', ...languages]) {
                if (language === 'en' && !page.reference) continue
                const destination = path.join(docs, language === 'en' ? page.route : `${language}/${page.route}`)
                const output = transformMarkdown(original, text => {
                    if (language === 'en' || !prose(text)) return text
                    const translation = translated[language][keyFor(text)]
                    if (translation === undefined) throw new Error(`${language}: unextracted segment ${text}`)
                    return restore(translation, protect(text).values)
                }, { ...page, language })
                await fs.mkdir(path.dirname(destination), { recursive: true })
                // Generated pages are not Git history entries. Avoid thousands of
                // per-file git-log fallbacks in VitePress's lastUpdated lookup.
                const dated = output.startsWith('---\n')
                    ? output.replace('---\n', '---\nlastUpdated: false\n')
                    : '---\nlastUpdated: false\n---\n\n' + output
                await fs.writeFile(destination, rebaseAssets(dated, page.file, destination))
            }
        }
    }
    console.log(`docs i18n ${command}: ${pages.length} pages × ${languages.length} translations`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main(process.argv[2]).catch(error => { console.error(error); process.exitCode = 1 })
}
