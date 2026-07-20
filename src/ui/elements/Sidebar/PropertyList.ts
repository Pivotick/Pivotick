import type { Node } from '../../../Node'
import type { Edge } from '../../../Edge'
import type { PropertyEntry } from '../../../interfaces/GraphUI'
import { createHtmlElement, createIcon } from '../../../utils/ElementCreation'
import { tryResolveHTMLElement } from '../../../utils/Getters'
import { checkmark, copy as copyIcon, externalLink } from '../../icons'
import './properties.scss'

// Keys whose value we render as a link even when the value isn't an absolute URL
// (e.g. an app-relative path like `/crawlers/showDomain?...`).
const LINK_KEYS = new Set(['url', 'uri', 'href', 'link', 'website', 'homepage'])
const ABSOLUTE_URL = /^(https?:|mailto:|ftp:|tel:)/i

function keyToText(name: PropertyEntry['name'], element: Node | Edge | null): string {
    if (typeof name === 'string') return name
    return tryResolveHTMLElement(name, element)?.textContent ?? ''
}

// True when `value` carries a URL scheme that isn't in our allowlist (e.g.
// `javascript:`, `data:`, `vbscript:`). A scheme-less value is a relative path
// and can't execute script, so it's considered safe. Browsers ignore ASCII
// whitespace/control chars inside a scheme (`java\tscript:` ≡ `javascript:`),
// so strip those before deciding.
function hasUnsafeScheme(value: string): boolean {
    // eslint-disable-next-line no-control-regex -- stripping control chars is the point
    const normalized = value.replace(/[\x00-\x20]+/g, '')
    if (!/^[a-z][a-z0-9+.-]*:/i.test(normalized)) return false
    return !ABSOLUTE_URL.test(normalized)
}

function looksLikeLink(key: string, value: string): boolean {
    if (hasUnsafeScheme(value)) return false
    if (ABSOLUTE_URL.test(value)) return true
    return LINK_KEYS.has(key.toLowerCase()) && value.length > 0
}

function escapeHtml(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function jsonPrimitiveHtml(value: unknown): string {
    if (typeof value === 'string') return `<span class="json-string">"${escapeHtml(value)}"</span>`
    if (typeof value === 'number') return `<span class="json-number">${value}</span>`
    if (typeof value === 'boolean') return `<span class="json-boolean">${value}</span>`
    return '<span class="json-null">null</span>'
}

// Guards against cyclic / pathologically deep data, which would otherwise blow
// the call stack on every hover/select of the offending node.
const MAX_JSON_DEPTH = 12

// Compact, syntax-highlighted pretty-print of a JSON-ish value. Reuses the same
// `.json-*` colour classes as the full JsonViewer so it stays theme-aware, but
// without the line numbers / toolbar chrome — it lives inside a property cell.
// `seen` tracks the current ancestor path so a self-reference renders `[Circular]`
// while a shared-but-acyclic object (a DAG) still renders in full.
function jsonToHtml(value: unknown, depth: number, seen: WeakSet<object> = new WeakSet()): string {
    if (value === null || typeof value !== 'object') return jsonPrimitiveHtml(value)

    if (seen.has(value)) return '<span class="json-null">[Circular]</span>'
    if (depth >= MAX_JSON_DEPTH) return '<span class="json-null">[…]</span>'

    const isArray = Array.isArray(value)
    const open = isArray ? '[' : '{'
    const close = isArray ? ']' : '}'
    const entries: Array<readonly [string, unknown]> = isArray
        ? (value as unknown[]).map((v, i) => [String(i), v] as const)
        : Object.entries(value as Record<string, unknown>)

    if (entries.length === 0) return `<span class="json-bracket">${open}${close}</span>`

    seen.add(value)
    const pad = '  '.repeat(depth + 1)
    const closePad = '  '.repeat(depth)
    const lines = entries.map(([k, v], i) => {
        const comma = i < entries.length - 1 ? '<span class="json-bracket">,</span>' : ''
        const keyHtml = isArray ? '' : `<span class="json-key">"${escapeHtml(k)}"</span><span class="json-bracket">: </span>`
        return `${pad}${keyHtml}${jsonToHtml(v, depth + 1, seen)}${comma}`
    })
    seen.delete(value) // leave the path so the same object in a sibling branch isn't a false cycle
    return `<span class="json-bracket">${open}</span>\n${lines.join('\n')}\n${closePad}<span class="json-bracket">${close}</span>`
}

function objectBadgeText(value: object): string {
    if (Array.isArray(value)) {
        return `[ ] ${value.length} ${value.length === 1 ? 'item' : 'items'}`
    }
    const n = Object.keys(value).length
    return `{ } ${n} ${n === 1 ? 'key' : 'keys'}`
}

export function createCopyButton(text: string): HTMLElement {
    // Stash the copy text as an attribute (not just the closure) so a cloneNode()'d
    // copy — e.g. a pinned tooltip — can be re-wired from it (see Tooltip.pinTooltip).
    const btn = createHtmlElement('span', { class: 'pvt-prop-copy', title: 'Copy', role: 'button', tabindex: '0', 'data-copy-text': text }, [
        createIcon({ svgIcon: copyIcon }),
    ])
    const doCopy = async () => {
        try {
            await navigator.clipboard.writeText(text)
        } catch {
            return
        }
        btn.classList.add('pvt-prop-copy--done')
        btn.replaceChildren(createIcon({ svgIcon: checkmark }))
        window.setTimeout(() => {
            btn.classList.remove('pvt-prop-copy--done')
            btn.replaceChildren(createIcon({ svgIcon: copyIcon }))
        }, 1200)
    }
    btn.addEventListener('click', doCopy)
    btn.addEventListener('keydown', (event: KeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            void doCopy()
        }
    })
    return btn
}

function createLinkValue(value: string): HTMLElement {
    const isAbsolute = ABSOLUTE_URL.test(value)
    return createHtmlElement(
        'a',
        {
            class: 'pvt-prop-value pvt-prop-value--link',
            href: value,
            title: value,
            ...(isAbsolute ? { target: '_blank', rel: 'noopener noreferrer' } : {}),
        },
        [
            createHtmlElement('span', { class: 'pvt-prop-link-text' }, [value]),
            createIcon({ svgIcon: externalLink }),
        ]
    )
}

function createScalarValue(text: string, mono: boolean): HTMLElement {
    return createHtmlElement('div', { class: `pvt-prop-value pvt-prop-value--text${mono ? ' pvt-prop-value--mono' : ''}` }, [text])
}

/**
 * Renders one property, dispatching on the value's runtime type:
 * - objects / arrays  → a compact syntax-highlighted JSON block + a `{ } N keys` badge
 * - link-like strings → a clickable link with an external-link glyph
 * - other scalars     → text with a copy button
 *
 * A custom `nodePropertiesMap` may hand us a pre-built `HTMLElement` (or a
 * function returning one); those are rendered verbatim, with no copy affordance.
 */
function createPropertyRow(entry: PropertyEntry, element: Node | Edge | null): HTMLElement | null {
    const key = keyToText(entry.name, element)

    // Resolve a function value to its string/HTMLElement result; leave everything
    // else (raw scalars, objects, pre-built elements) as-is for type dispatch.
    let value: unknown = entry.value
    if (typeof value === 'function') {
        value = (value as (el: Node | Edge | null) => HTMLElement | string)(element)
    }

    // Name, optional affordance (copy button / key-count badge) and value are
    // laid out by CSS grid areas — so the same DOM reads as a stacked card in the
    // narrow sidebar and as a scannable name│value table in the wider modal.
    const row = createHtmlElement('div', { class: 'pvt-prop' }, [
        createHtmlElement('span', { class: 'pvt-prop-key', title: key }, [key]),
    ])

    if (value instanceof HTMLElement) {
        value.classList.add('pvt-prop-value')
        row.appendChild(value)
        return row
    }

    if (value !== null && typeof value === 'object') {
        row.appendChild(createHtmlElement('span', { class: 'pvt-prop-affordance pvt-prop-badge' }, [objectBadgeText(value)]))
        const box = createHtmlElement('div', { class: 'pvt-prop-value pvt-prop-value--json' }, [
            createHtmlElement('pre', { class: 'pvt-prop-json' }, []),
        ])
        ;(box.firstElementChild as HTMLElement).innerHTML = jsonToHtml(value, 0)
        row.appendChild(box)
        return row
    }

    // Scalars: string / number / boolean.
    const text = String(value)
    if (typeof value === 'string' && looksLikeLink(key, value)) {
        row.appendChild(createLinkValue(value))
        return row
    }

    const copy = createCopyButton(text)
    copy.classList.add('pvt-prop-affordance')
    row.appendChild(copy)
    // `id`-like keys read best in monospace, matching the design's code aesthetic.
    row.appendChild(createScalarValue(text, key.toLowerCase() === 'id'))
    return row
}

/**
 * Builds the single-selection PROPERTIES panel: a monospace section header with
 * a live field count, followed by one type-aware row per property.
 *
 * `layout: 'columns'` lays names and values out side by side (for the roomy
 * inspect modal, where the names should scan as a column); the default
 * `'stacked'` puts the value under its name (for the narrow sidebar).
 */
export function createPropertyList(
    properties: PropertyEntry[],
    element: Node | Edge | null,
    { label = 'PROPERTIES', layout = 'stacked' }: { label?: string; layout?: 'stacked' | 'columns' } = {}
): HTMLElement {
    const container = createHtmlElement('div', {
        class: layout === 'columns' ? 'pvt-node-props pvt-node-props--columns' : 'pvt-node-props',
    })

    const header = createHtmlElement('div', { class: 'pvt-node-props-header' }, [
        createHtmlElement('span', { class: 'pvt-node-props-label' }, [
            createHtmlElement('span', { class: 'pvt-node-props-label-dot' }, ['.']),
            createHtmlElement('span', { class: 'pvt-node-props-label-name' }, [label]),
        ]),
        createHtmlElement('span', { class: 'pvt-node-props-count' }, [
            `${properties.length} ${properties.length === 1 ? 'field' : 'fields'}`,
        ]),
    ])
    container.appendChild(header)

    for (const entry of properties) {
        const row = createPropertyRow(entry, element)
        if (row) container.appendChild(row)
    }

    return container
}
