import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const root = fileURLToPath(new URL('../', import.meta.url))
export const locales = {
    ar: { name: 'Arabic', forms: ['zero', 'one', 'two', 'few', 'many', 'other'], rule: 'nplurals=6; plural=(n == 0 ? 0 : n == 1 ? 1 : n == 2 ? 2 : n % 100 >= 3 && n % 100 <= 10 ? 3 : n % 100 >= 11 && n % 100 <= 99 ? 4 : 5);' },
    de: { name: 'German', forms: ['one', 'other'], rule: 'nplurals=2; plural=(n != 1);' },
    es: { name: 'Spanish', forms: ['one', 'other'], rule: 'nplurals=2; plural=(n != 1);' },
    fr: { name: 'French', forms: ['one', 'other'], rule: 'nplurals=2; plural=(n > 1);' },
    ja: { name: 'Japanese', forms: ['other'], rule: 'nplurals=1; plural=0;' },
    nl: { name: 'Dutch', forms: ['one', 'other'], rule: 'nplurals=2; plural=(n != 1);' },
    pt: { name: 'Portuguese', forms: ['one', 'other'], rule: 'nplurals=2; plural=(n > 1);' },
    zh: { name: 'Simplified Chinese', forms: ['other'], rule: 'nplurals=1; plural=0;' },
}

/** Read the actual English catalogue rather than maintaining a second list of keys. */
export async function readEnglish() {
    const result = await build({
        entryPoints: [path.join(root, 'src/i18n/en/index.ts')],
        bundle: true, write: false, platform: 'node', format: 'esm',
    })
    const { messagesEn } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
    return messagesEn
}

/** Parse the text-only gettext PO format, including multiline strings and translator flags. */
export function parsePo(text, filename = 'catalogue') {
    const entries = []
    let entry = { flags: [], comments: [] }
    let field
    const flush = () => {
        if (entry.msgid !== undefined) entries.push(entry)
        else if (field) throw new Error(`${filename}: entry has no msgid`)
        entry = { flags: [], comments: [] }
        field = undefined
    }
    for (const [index, raw] of text.replace(/^\uFEFF/, '').split(/\r?\n/).entries()) {
        const line = raw.trim()
        const fail = message => { throw new Error(`${filename}:${index + 1}: ${message}`) }
        if (!line) { flush(); continue }
        if (line.startsWith('#~')) continue
        if (line.startsWith('#,')) {
            entry.flags.push(...line.slice(2).split(',').map(flag => flag.trim()))
            continue
        }
        if (line === '#' || line.startsWith('# ')) { entry.comments.push(line); continue }
        if (line.startsWith('#')) continue
        const match = /^(msgctxt|msgid_plural|msgid|msgstr(?:\[\d+\])?)\s+(".*")$/.exec(line)
        let literal
        if (match) {
            if ((match[1] === 'msgctxt' || match[1] === 'msgid') && Object.keys(entry).some(k => k.startsWith('msgstr'))) flush()
            field = match[1]
            if (entry[field] !== undefined) fail(`duplicate ${field}`)
            literal = match[2]
        } else if (line.startsWith('"') && field) {
            literal = line
        } else {
            fail('expected a gettext directive or quoted continuation')
        }
        let value
        try { value = JSON.parse(literal) } catch { fail('invalid quoted PO string') }
        if (typeof value !== 'string') fail('expected a string')
        entry[field] = (entry[field] ?? '') + value
    }
    flush()
    return entries
}

const placeholders = text => [...new Set(text.match(/\{\w+\}/g) ?? [])].sort().join(', ')

function sourceEntry(key, value) {
    if (typeof value === 'string') return { msgctxt: key, msgid: value }
    if (typeof value !== 'object' || typeof value.one !== 'string' || typeof value.other !== 'string') {
        throw new Error(`${key}: English PO sources must be text or one/other plural forms`)
    }
    return { msgctxt: key, msgid: value.one, msgid_plural: value.other }
}

function header(locale) {
    return {
        msgid: '',
        msgstr: 'Project-Id-Version: Pivotick\n'
            + 'Report-Msgid-Bugs-To: https://github.com/Pivotick/Pivotick/issues\n'
            + 'MIME-Version: 1.0\nContent-Type: text/plain; charset=UTF-8\nContent-Transfer-Encoding: 8bit\n'
            + (locale ? `Language: ${locale}\nPlural-Forms: ${locales[locale].rule}\n` : ''),
    }
}

/** Write deterministic PO files accepted by gettext editors such as Poedit. */
export function serializePo(entries, references = {}) {
    return entries.map(entry => {
        const lines = [...(entry.comments ?? [])]
        if (entry.msgctxt) {
            const params = placeholders(entry.msgid + (entry.msgid_plural ?? ''))
            if (params) lines.push(`#. Preserve placeholders: ${params}`)
            if (references[entry.msgctxt]) lines.push(`#: ${references[entry.msgctxt]}`)
        }
        if (entry.flags?.length) lines.push(`#, ${entry.flags.join(', ')}`)
        for (const name of ['msgctxt', 'msgid', 'msgid_plural']) {
            if (entry[name] !== undefined) lines.push(`${name} ${JSON.stringify(entry[name])}`)
        }
        for (const name of Object.keys(entry).filter(k => k.startsWith('msgstr')).sort()) {
            lines.push(`${name} ${JSON.stringify(entry[name])}`)
        }
        return lines.join('\n')
    }).join('\n\n') + '\n'
}

/** Validate completeness, source text, plural slots and placeholders before compiling. */
export function compileCatalogue(entries, english, locale) {
    const config = locales[locale]
    if (!config) throw new Error(`Unsupported bundled locale: ${locale}`)
    const metadata = entries.find(entry => entry.msgid === '' && entry.msgctxt === undefined)
    if (!metadata || entries.filter(entry => entry.msgid === '' && entry.msgctxt === undefined).length !== 1) {
        throw new Error(`${locale}: expected one PO header`)
    }
    const headers = Object.fromEntries((metadata.msgstr ?? '').split('\n').filter(Boolean).map(line => {
        const colon = line.indexOf(':')
        return [line.slice(0, colon).toLowerCase(), line.slice(colon + 1).trim()]
    }))
    if (headers.language !== locale) throw new Error(`${locale}: wrong Language header`)
    if (!/charset=utf-8/i.test(headers['content-type'] ?? '')) throw new Error(`${locale}: expected UTF-8`)
    if (headers['plural-forms']?.replace(/\s/g, '') !== config.rule.replace(/\s/g, '')) {
        throw new Error(`${locale}: unexpected Plural-Forms header`)
    }
    const found = new Map()
    for (const entry of entries) {
        if (entry === metadata) continue
        const key = entry.msgctxt
        if (!Object.hasOwn(english, key ?? '')) throw new Error(`${locale}: unknown message ${key}`)
        if (found.has(key)) throw new Error(`${locale}: duplicate message ${key}`)
        found.set(key, entry)
    }
    const messages = {}
    for (const [key, value] of Object.entries(english)) {
        const entry = found.get(key)
        if (!entry) throw new Error(`${locale}: missing message ${key}`)
        const source = sourceEntry(key, value)
        if (entry.msgid !== source.msgid || entry.msgid_plural !== source.msgid_plural) {
            throw new Error(`${locale}: outdated source for ${key}; run npm run i18n:extract`)
        }
        if (entry.flags?.includes('fuzzy')) throw new Error(`${locale}: fuzzy translation ${key}`)
        const plural = source.msgid_plural !== undefined
        const slots = plural ? config.forms.map((_, i) => `msgstr[${i}]`) : ['msgstr']
        if (Object.keys(entry).filter(k => k.startsWith('msgstr')).sort().join() !== [...slots].sort().join()) {
            throw new Error(`${locale}: invalid plural slots for ${key}`)
        }
        const forms = {}
        for (const [index, slot] of slots.entries()) {
            const translated = entry[slot]
            if (!translated?.trim()) throw new Error(`${locale}: empty translation ${key} ${slot}`)
            const category = config.forms[index]
            const original = plural && category !== 'one' ? source.msgid_plural : source.msgid
            if (placeholders(translated) !== placeholders(original)) {
                throw new Error(`${locale}: placeholders differ for ${key} ${slot}`)
            }
            forms[category] = translated
        }
        messages[key] = plural ? forms : entry.msgstr
    }
    return messages
}

function moduleText(messages, locale) {
    return '// Generated from locales/' + locale + '.po by npm run i18n:compile. Do not edit.\n'
        + '/* eslint-disable quotes */\n'
        + "import type { Messages } from '../../interfaces/I18n'\n\n"
        + `export const messages${locale[0].toUpperCase() + locale.slice(1)}: Messages = ${JSON.stringify(messages, null, 4)}\n`
}

async function references() {
    const refs = {}
    for (const file of await fs.readdir(path.join(root, 'src/i18n/en'))) {
        if (!file.endsWith('.ts')) continue
        const text = await fs.readFile(path.join(root, 'src/i18n/en', file), 'utf8')
        text.split('\n').forEach((line, i) => {
            const key = /^\s*'([^']+)'\s*:/.exec(line)?.[1]
            if (key) refs[key] = `src/i18n/en/${file}:${i + 1}`
        })
    }
    return refs
}

async function main(command) {
    if (!['extract', 'compile', 'check'].includes(command)) throw new Error('Usage: node scripts/i18n.mjs extract|compile|check')
    const english = await readEnglish()
    const refs = await references()
    const sources = Object.entries(english).map(([key, value]) => sourceEntry(key, value))
    const template = serializePo([header(), ...sources.map(entry => ({
        ...entry, ...(entry.msgid_plural === undefined ? { msgstr: '' } : { 'msgstr[0]': '', 'msgstr[1]': '' }),
    }))], refs)
    const templatePath = path.join(root, 'locales/pivotick.pot')
    await fs.mkdir(path.dirname(templatePath), { recursive: true })
    if (command === 'extract') await fs.writeFile(templatePath, template)
    if (command === 'check' && await fs.readFile(templatePath, 'utf8') !== template) {
        throw new Error('English POT is stale; run npm run i18n:extract')
    }
    for (const [locale, config] of Object.entries(locales)) {
        const poPath = path.join(root, `locales/${locale}.po`)
        if (command === 'extract') {
            let previous = []
            try { previous = parsePo(await fs.readFile(poPath, 'utf8'), poPath) } catch (error) {
                if (error.code !== 'ENOENT') throw error
            }
            const byKey = new Map(previous.map(entry => [entry.msgctxt, entry]))
            const entries = sources.map(source => {
                const old = byKey.get(source.msgctxt)
                const entry = { ...source, flags: [...(old?.flags ?? [])], comments: old?.comments ?? [] }
                if (old && (old.msgid !== source.msgid || old.msgid_plural !== source.msgid_plural)) entry.flags.push('fuzzy')
                const slots = source.msgid_plural === undefined ? ['msgstr'] : config.forms.map((_, i) => `msgstr[${i}]`)
                for (const slot of slots) entry[slot] = old?.[slot] ?? ''
                return entry
            })
            const oldHeader = previous.find(entry => entry.msgid === '' && entry.msgctxt === undefined)
            await fs.writeFile(poPath, serializePo([oldHeader ?? header(locale), ...entries], refs))
        } else {
            const entries = parsePo(await fs.readFile(poPath, 'utf8'), poPath)
            const messages = compileCatalogue(entries, english, locale)
            const generated = moduleText(messages, locale)
            const target = path.join(root, `src/i18n/locales/${locale}.ts`)
            if (command === 'compile') {
                await fs.mkdir(path.dirname(target), { recursive: true })
                await fs.writeFile(target, generated)
            } else if (await fs.readFile(target, 'utf8') !== generated) {
                throw new Error(`${locale}: generated catalogue is stale; run npm run i18n:compile`)
            }
        }
    }
    console.log(`i18n ${command}: ${Object.keys(english).length} messages × ${Object.keys(locales).length} locales`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main(process.argv[2]).catch(error => { console.error(error.message); process.exitCode = 1 })
}
