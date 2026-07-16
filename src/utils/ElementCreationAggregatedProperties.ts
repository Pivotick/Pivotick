import type { PropertyEntry } from '../interfaces/GraphUI'
import { createHtmlElement } from './ElementCreation'


const UNIQUE_PROPERTY_KEY = '4dfd89de5d25fc9cc4b66c23d84b443af631c7dc' // Value to cheat to aggregate unique properties
const MERGE_UNIQUE_THRESHOLD = 6
const MAX_UNIQUE_CHIPS = 16

export type AggregatedProperties = Map<string, Map<string, number>>
export type actionButtonCallback = (key: string, value: string) => HTMLDivElement

type FacetKind = 'shared' | 'unique' | 'values'

// Distinct, theme-agnostic hues used to colour the value swatches / bar segments.
const FACET_HUES = [210, 45, 280, 350, 165, 130, 25, 300, 190, 90, 60, 320]

/** A stable, well-separated colour for the nth value within a facet. */
export function facetValueColor(index: number): string {
    const hue = FACET_HUES[index % FACET_HUES.length]
    // Darken slightly on each wrap so a long value list stays distinguishable.
    const wrap = Math.floor(index / FACET_HUES.length)
    const lightness = Math.max(38, 58 - wrap * 9)
    return `hsl(${hue} 62% ${lightness}%)`
}

function classifyFacet(valueCountMap: Map<string, number>): FacetKind {
    if (valueCountMap.size <= 1) return 'shared'
    for (const count of valueCountMap.values()) {
        if (count > 1) return 'values'
    }
    return 'unique'
}

/**
 * Renders an aggregated property map as a stack of "facet" cards — one per
 * property. Each card is classified as:
 *  - `shared`  — every node carries the same single value (a full-width bar),
 *  - `values`  — a handful of repeated values (a segmented distribution bar),
 *  - `unique`  — every value differs (a wrapped list of value chips).
 */
export function createTableForAggregatedProperties(
    aggregatedProperties: AggregatedProperties,
    selectedNodeCount: number,
    actionButtonCallback?: actionButtonCallback
): HTMLDivElement {
    const sortedAggregatedProperties = sortAggregatedProperties(aggregatedProperties, false)
    const root = createHtmlElement('div', { class: 'pvt-facets' })

    for (const [propName, valueCountMap] of sortedAggregatedProperties) {
        root.appendChild(
            createFacetCard(propName, valueCountMap, selectedNodeCount, actionButtonCallback)
        )
    }
    return root
}

function createFacetCard(
    propName: string,
    valueCountMap: Map<string, number>,
    selectedNodeCount: number,
    actionButtonCallback?: actionButtonCallback
): HTMLDivElement {
    const kind = classifyFacet(valueCountMap)
    const distinct = valueCountMap.size

    let badgeText: string
    if (kind === 'unique') {
        badgeText = `${distinct} unique`
    } else if (kind === 'values') {
        badgeText = `${distinct} values`
    } else {
        // A single value: "shared" only when every selected node carries it.
        const onlyCount = valueCountMap.values().next().value ?? 0
        badgeText = onlyCount === selectedNodeCount ? 'shared' : '1 value'
    }
    const header = createHtmlElement('div', { class: 'pvt-facet-header' }, [
        createHtmlElement('div', { class: 'pvt-facet-label' }, [
            createHtmlElement('span', { class: 'pvt-facet-label-dot' }, ['.']),
            createHtmlElement('span', { class: 'pvt-facet-label-name' }, [propName]),
        ]),
        createHtmlElement('span', { class: ['pvt-facet-badge', `pvt-facet-badge--${kind}`] }, [badgeText]),
    ])

    const body = kind === 'unique'
        ? createUniqueFacetBody(valueCountMap)
        : createDistributionFacetBody(propName, valueCountMap, selectedNodeCount, kind, actionButtonCallback)

    return createHtmlElement('div', { class: 'pvt-facet-card' }, [header, body])
}

/** `shared` (one value) and `values` (a few repeated values) share this body. */
function createDistributionFacetBody(
    propName: string,
    valueCountMap: Map<string, number>,
    selectedNodeCount: number,
    kind: FacetKind,
    actionButtonCallback?: actionButtonCallback
): HTMLElement {
    const entries = Array.from(valueCountMap.entries())

    // Segmented proportion bar — one coloured segment per value.
    const bar = createHtmlElement('div', { class: 'pvt-facet-bar' })
    entries.forEach(([value, count], i) => {
        const pct = selectedNodeCount > 0 ? (count / selectedNodeCount) * 100 : 0
        const seg = createHtmlElement('div', { class: 'pvt-facet-bar-seg' })
        seg.style.width = `${pct}%`
        seg.style.background = valueSwatchColor(value, i, kind)
        seg.title = `${displayValue(value)} — ${count} (${Math.round(pct)}%)`
        bar.appendChild(seg)
    })

    const rows = createHtmlElement('div', { class: 'pvt-facet-rows' })
    entries.forEach(([value, count], i) => {
        const pct = selectedNodeCount > 0 ? Math.round((count / selectedNodeCount) * 100) : 0
        rows.appendChild(
            createFacetRow(propName, value, count, pct, i, selectedNodeCount, kind, actionButtonCallback)
        )
    })

    return createHtmlElement('div', { class: 'pvt-facet-body' }, [bar, rows])
}

function createFacetRow(
    propName: string,
    value: string,
    count: number,
    pct: number,
    index: number,
    selectedNodeCount: number,
    kind: FacetKind,
    actionButtonCallback?: actionButtonCallback
): HTMLElement {
    const dot = createHtmlElement('span', { class: 'pvt-facet-dot' })
    dot.style.background = valueSwatchColor(value, index, kind)

    const empty = isValueEmpty(value)
    const valueEl = createHtmlElement('span', {
        class: ['pvt-facet-value', empty ? 'pvt-facet-value--empty' : 'code-container'],
    }, [empty ? '— empty —' : displayValue(value)])

    // Preserve the "Select / Exclude Similar" affordances on real repeated values.
    if (kind === 'values' && !empty && actionButtonCallback) {
        valueEl.appendChild(actionButtonCallback(propName, value))
    }

    const children: Array<HTMLElement | string> = [dot, valueEl]
    if (kind === 'shared') {
        const caption = count === selectedNodeCount ? `all ${count} nodes` : `${count} of ${selectedNodeCount}`
        children.push(createHtmlElement('span', { class: 'pvt-facet-caption' }, [caption]))
    } else {
        children.push(createHtmlElement('span', { class: 'pvt-facet-count' }, [String(count)]))
    }
    children.push(createHtmlElement('span', { class: 'pvt-facet-percent' }, [`${pct}%`]))

    return createHtmlElement('div', { class: 'pvt-facet-row' }, children)
}

function createUniqueFacetBody(valueCountMap: Map<string, number>): HTMLElement {
    const caption = createHtmlElement('div', { class: 'pvt-facet-caption pvt-facet-caption--block' }, [
        'no repeated values',
    ])
    const chipsWrap = createHtmlElement('div', { class: 'pvt-facet-chips' })

    const values = Array.from(valueCountMap.keys())
    values.slice(0, MAX_UNIQUE_CHIPS).forEach(value => {
        const empty = isValueEmpty(value)
        chipsWrap.appendChild(
            createHtmlElement('span', {
                class: ['pvt-facet-chip', empty ? 'pvt-facet-value--empty' : ''],
            }, [empty ? '— empty —' : displayValue(value)])
        )
    })
    if (values.length > MAX_UNIQUE_CHIPS) {
        chipsWrap.appendChild(
            createHtmlElement('span', { class: 'pvt-facet-chip pvt-facet-chip--more' }, [
                `+${values.length - MAX_UNIQUE_CHIPS} more`,
            ])
        )
    }

    return createHtmlElement('div', { class: 'pvt-facet-body' }, [caption, chipsWrap])
}

// Teal accent shared with the "shared" badge, so a uniform facet reads as one.
const SHARED_SWATCH = 'hsl(165 45% 52%)'

/** Empty values get a neutral grey swatch; a uniform facet the shared accent; else a palette hue. */
function valueSwatchColor(value: string, index: number, kind: FacetKind): string {
    if (isValueEmpty(value)) return 'var(--pvt-text-color-3)'
    if (kind === 'shared') return SHARED_SWATCH
    return facetValueColor(index)
}

export function displayValue(value: unknown): string {
    return typeof value === 'string' ? value : JSON.stringify(value)
}

export function getDislayableValue(value: string): string {
    return displayValue(value)
}

export function isValueEmpty(value: string): boolean {
    return value.length === 0
}

export function isValueUnique(value: string): boolean {
    return value === UNIQUE_PROPERTY_KEY
}

export function hasSpecialHighlighting(value: string): boolean {
    return isValueEmpty(value) || isValueUnique(value)
}


/**
 * Aggregates a collection of property entries into a nested map structure.
 *
 * For each property name, this function counts the occurrences of each
 * property value across all provided entries. The result is a map where:
 *
 * - Keys are property names (e.g. "label", "type").
 * - Values are maps of property values to their occurrence counts.
 *
 * Example:
 * ```ts
 * [
 *   [ { name: "type", value: "node" }, { name: "label", value: "Node 1" } ],
 *   [ { name: "type", value: "node" }, { name: "label", value: "Node 2" } ],
 *   [ { name: "type", value: "node" }, { name: "label", value: "Node 1" } ]
 * ]
 *
 * => Map {
 *   "type"  => Map { "node" => 3 },
 *   "label" => Map { "Node 1" => 2, "Node 2" => 1 }
 * }
 * ```
 *
 * @param allProperties Array of property entry arrays, where each inner array
 * represents the properties of a node.
 * @returns A nested map of property name → (property value → count).
 */
export function aggregateProperties(allProperties: Array<PropertyEntry>[]): AggregatedProperties {
    const aggregatedProperties: AggregatedProperties = new Map()

    allProperties.forEach(properties => {
        properties.forEach(prop => {
            if (
                (typeof prop.name === 'string' || typeof prop.name === 'number' || typeof prop.name === 'boolean') &&
                (typeof prop.value === 'string' || typeof prop.value === 'number' || typeof prop.value === 'boolean')
            ) {
                if (!aggregatedProperties.has(prop.name)) {
                    aggregatedProperties.set(prop.name, new Map())
                }
                const valueCountMap = aggregatedProperties.get(prop.name)
                const currentCount = valueCountMap!.get(prop.value) || 0
                valueCountMap!.set(prop.value, currentCount + 1)
            }
        })
    })

    return aggregatedProperties
}

/**
 * Sorts an aggregated properties map.
 *
 * 1. Inner maps (value -> count) are sorted by count (descending).
 * 2. Outer map (property -> Map) is sorted by inner map size (ascending).
 *
 * @param aggregated Map of property -> Map of value -> count
 * @returns A new Map with the same structure but sorted.
 */
export function sortAggregatedProperties(
    aggregated: AggregatedProperties,
    mergeUniqueProperties: boolean = true
): AggregatedProperties {
    // Step 1: sort each inner map by count (descending)
    const sortedInnerMaps = new Map<string, Map<string, number>>()
    for (const [prop, valuesMap] of aggregated.entries()) {
        const sortedEntries = Array.from(valuesMap.entries()).sort(
            (a, b) => b[1] - a[1] // high count first
        )
        sortedInnerMaps.set(prop, new Map(sortedEntries))
    }

    // Step 2: sort outer map by inner map size (ascending)
    const sortedOuterEntries = Array.from(sortedInnerMaps.entries()).sort(
        (a, b) => a[1].size - b[1].size
    )

    const sortedMap = new Map(sortedOuterEntries)
    if (!mergeUniqueProperties) {
        return sortedMap
    }

    const mergedAggregatedProperties: AggregatedProperties = new Map()
    for (const [name, innerMap] of sortedMap) {
        for (const [value, count] of innerMap) {
            if (!mergedAggregatedProperties.has(name)) {
                mergedAggregatedProperties.set(name, new Map())
            }
            const valueCountMap = mergedAggregatedProperties.get(name)
            if (innerMap.size > MERGE_UNIQUE_THRESHOLD && count === 1) {
                const currentCount = valueCountMap!.get(UNIQUE_PROPERTY_KEY) || 0
                valueCountMap!.set(UNIQUE_PROPERTY_KEY, currentCount + 1)
            } else {
                valueCountMap!.set(value, count)
            }
        }
    }
    return mergedAggregatedProperties
}
