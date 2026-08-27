import type { Edge } from '../../../Edge'
import type { Node } from '../../../Node'
import type { TableColumn } from '../../../interfaces/GraphUI'

type Element = Node | Edge

/**
 * A column's row filter, in the shape its control produces.
 *
 * One per widget, rather than one string for all of them: "between 3 and 9" and "is
 * exactly `router`" are not substring matches, and pretending they are is how a Degree
 * column ends up matching 13 when you asked for 3.
 */
export type RowFilter =
    /** Substring match — `text`, `regex`, and anything untyped. */
    | { kind: 'text', needle: string }
    /** One chosen value out of the column's own — `select`, `multiselect`, `boolean`. */
    | { kind: 'value', value: string }
    /** An inclusive numeric interval, either end open — `numberRange`. */
    | { kind: 'range', min: number | null, max: number | null }

/**
 * Above this many distinct values a dropdown stops being usable, so the column falls
 * back to its text box. The scanned column types are inferred from the data, and nothing
 * stops a key with one value per element from being typed `multiselect`.
 */
const MAX_CHOICES = 50

/** Whether a filter is narrowing anything, or is just sitting there empty. */
export function isRowFilterActive(filter: RowFilter | undefined): boolean {
    if (!filter) return false
    switch (filter.kind) {
        case 'text': return filter.needle.trim() !== ''
        case 'value': return filter.value !== ''
        case 'range': return filter.min !== null || filter.max !== null
    }
}

/** Whether one cell value passes one filter. `null` / `undefined` never do. */
export function rowFilterMatches(filter: RowFilter, value: unknown): boolean {
    if (value === null || value === undefined) return false

    switch (filter.kind) {
        case 'text':
            return String(value).toLowerCase().includes(filter.needle.trim().toLowerCase())
        case 'value':
            // An array cell (a `multiselect`'s tags) matches on membership, not on equality.
            return Array.isArray(value)
                ? value.some((entry) => String(entry) === filter.value)
                : String(value) === filter.value
        case 'range': {
            const number = typeof value === 'number' ? value : Number(value)
            if (!Number.isFinite(number)) return false
            if (filter.min !== null && number < filter.min) return false
            if (filter.max !== null && number > filter.max) return false
            return true
        }
    }
}

/**
 * The choices a `select`-ish column offers: the values actually present in the column,
 * not a declared option list. A `TableColumn` carries no `options` (it borrows only
 * `key`/`label`/`type`/`order` from `FilterFacet`), and offering a value no row holds
 * would only produce empty results anyway.
 *
 * Read from **all** rows rather than the narrowed ones, or picking a value would empty
 * the very list you picked it from.
 */
export function columnChoices(values: unknown[]): string[] {
    const choices = new Set<string>()
    for (const value of values) {
        if (value === null || value === undefined) continue
        for (const entry of Array.isArray(value) ? value : [value]) {
            const text = String(entry)
            if (text !== '') choices.add(text)
        }
        if (choices.size > MAX_CHOICES) return []
    }
    return [...choices].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
}

/** Which widget a column's `type` asks for, given what its values turned out to be. */
function widgetFor(
    column: TableColumn<Element>,
    choices: string[],
    current: RowFilter | undefined,
): 'range' | 'choice' | 'text' {
    if (column.type === 'numberRange') return 'range'
    const categorical = column.type === 'select' || column.type === 'multiselect' || column.type === 'boolean'
    // No choices means either an empty column or one over `MAX_CHOICES`; the text box is
    // the honest fallback for both — unless a choice is already narrowing the rows, which
    // a text box could neither show nor clear, leaving no way back to the missing rows.
    return categorical && (choices.length > 0 || current?.kind === 'value') ? 'choice' : 'text'
}

/**
 * Build a column's header filter control, typed off its facet `type`.
 *
 * Every control narrows **rows** — hence the wording, which has to stay distinct from the
 * "Filter Graph" pill one row up. Pushing that narrowing onto the canvas is a separate and
 * explicit act (the dock's "Apply to graph" button); a control on its own never moves the
 * graph, which is why the tooltip promises nothing about it either way.
 *
 * `onChange` receives `undefined` when the control is cleared back to matching everything.
 */
export function buildRowFilterControl(
    column: TableColumn<Element>,
    current: RowFilter | undefined,
    choices: string[],
    onChange: (filter: RowFilter | undefined) => void,
): HTMLElement {
    const name = column.label ?? column.key
    const explain = `Narrow the rows by ${name}`

    switch (widgetFor(column, choices, current)) {
        case 'range': return buildRangeControl(current, explain, onChange)
        case 'choice': return buildChoiceControl(current, choices, explain, onChange)
        default: return buildTextControl(current, explain, onChange)
    }
}

function buildTextControl(
    current: RowFilter | undefined,
    explain: string,
    onChange: (filter: RowFilter | undefined) => void,
): HTMLElement {
    const input = document.createElement('input')
    input.type = 'text'
    input.className = 'pvt-table-filter'
    input.dataset.role = 'text'
    input.placeholder = 'Filter rows…'
    input.title = explain
    input.value = current?.kind === 'text' ? current.needle : ''
    input.addEventListener('input', () => {
        onChange(input.value.trim() === '' ? undefined : { kind: 'text', needle: input.value })
    })
    return input
}

function buildChoiceControl(
    current: RowFilter | undefined,
    choices: string[],
    explain: string,
    onChange: (filter: RowFilter | undefined) => void,
): HTMLElement {
    // Wrapped, because the chevron is drawn by the wrapper's `::after`: a `<select>`
    // cannot carry a pseudo-element, and the UA's own arrow is not dependable — a host
    // stylesheet that resets `appearance` leaves the control looking like a text box.
    const wrapper = document.createElement('div')
    wrapper.className = 'pvt-table-filter-choice-wrap'

    const select = document.createElement('select')
    select.className = 'pvt-table-filter pvt-table-filter-choice'
    select.dataset.role = 'value'
    select.title = explain

    const any = document.createElement('option')
    any.value = ''
    any.textContent = 'All'
    select.appendChild(any)

    for (const choice of choices) {
        const option = document.createElement('option')
        option.value = choice
        option.textContent = choice
        select.appendChild(option)
    }

    // A filter set before this value existed (a rebuild dropped it) leaves the control on
    // "All" while still narrowing, so re-offer it rather than lying about the state.
    const chosen = current?.kind === 'value' ? current.value : ''
    if (chosen !== '' && !choices.includes(chosen)) {
        const orphan = document.createElement('option')
        orphan.value = chosen
        orphan.textContent = chosen
        select.appendChild(orphan)
    }
    select.value = chosen

    select.addEventListener('change', () => {
        onChange(select.value === '' ? undefined : { kind: 'value', value: select.value })
    })
    wrapper.appendChild(select)
    return wrapper
}

function buildRangeControl(
    current: RowFilter | undefined,
    explain: string,
    onChange: (filter: RowFilter | undefined) => void,
): HTMLElement {
    const range = current?.kind === 'range' ? current : { min: null, max: null }

    const wrapper = document.createElement('div')
    wrapper.className = 'pvt-table-filter-range'
    wrapper.title = explain

    // Read both ends on every edit: a range is one filter, and half of it typed is still
    // a filter ("at least 3" is the common case, and needs no upper bound at all).
    const emit = () => {
        const min = readNumber(minInput.value)
        const max = readNumber(maxInput.value)
        onChange(min === null && max === null ? undefined : { kind: 'range', min, max })
    }

    const minInput = buildBound('min', 'Min', range.min, explain, emit)
    const maxInput = buildBound('max', 'Max', range.max, explain, emit)
    wrapper.append(minInput, maxInput)
    return wrapper
}

function buildBound(
    role: 'min' | 'max',
    placeholder: string,
    value: number | null,
    explain: string,
    onInput: () => void,
): HTMLInputElement {
    const input = document.createElement('input')
    input.type = 'number'
    input.className = 'pvt-table-filter pvt-table-filter-number'
    input.dataset.role = role
    input.placeholder = placeholder
    input.title = explain
    input.value = value === null ? '' : String(value)
    input.addEventListener('input', onInput)
    return input
}

/** A bound the user has half-typed (`''`, `'-'`, `'1e'`) is not a bound yet. */
function readNumber(raw: string): number | null {
    if (raw.trim() === '') return null
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : null
}
