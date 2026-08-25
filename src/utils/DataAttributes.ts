import type { FilterFacetType, FilterMatchMode } from '../interfaces/GraphQueryEngine'

/**
 * What a scan of the graph's data found for one key: the shape of its values, and how
 * many elements actually carry it.
 *
 * This is the zero-config substrate two features share — the filter panel derives its
 * controls from it, and the data dock derives its columns — so both agree about what the
 * data looks like without either scanning twice or disagreeing about the answer.
 */
export interface DataAttribute {
    key: string
    /** Distinct values, for categorical attributes. Absent for a purely numeric key. */
    values?: unknown[]
    /** `[min, max]`, for a purely numeric key. Absent otherwise. */
    range?: [number, number]
    /**
     * How many elements carry this key. Sparse keys are real — data imported from
     * heterogeneous sources routinely has them — and the dock orders its columns by
     * this so the well-populated ones come first.
     */
    count: number
}

/** Anything with a data bag: a `Node`, an `Edge`, or a test double. */
interface HasData {
    getData(): Record<string, unknown>
}

/**
 * Scan elements for their data keys, in **first-seen order** — a caller wanting a
 * different order (the dock sorts by `count`) re-sorts the result.
 *
 * `null` and `undefined` are skipped: they say nothing about the key's shape and are not
 * filterable values. Note that other falsy values are **kept**, so a `0` or a `false`
 * still makes its key visible — unlike `nodePropertiesGetter`, which drops every falsy
 * value and so hides a `severity: 0` entirely.
 */
export function collectDataAttributes(elements: HasData[], excludeKeys?: string[]): DataAttribute[] {
    const excluded = new Set(excludeKeys ?? [])
    const scanned = new Map<string, { numbers: Set<number>, values: Set<unknown>, count: number }>()

    for (const element of elements) {
        for (const [key, value] of Object.entries(element.getData())) {
            if (value === null || value === undefined) continue
            if (excluded.has(key)) continue

            let entry = scanned.get(key)
            if (!entry) {
                entry = { numbers: new Set(), values: new Set(), count: 0 }
                scanned.set(key, entry)
            }
            entry.count++
            if (typeof value === 'number') entry.numbers.add(value)
            else entry.values.add(value)
        }
    }

    return [...scanned].map(([key, entry]) => {
        // Purely numeric ⇒ a real min/max range. Anything mixed stays a value list.
        if (entry.values.size === 0 && entry.numbers.size > 0) {
            return { key, count: entry.count, range: [Math.min(...entry.numbers), Math.max(...entry.numbers)] as [number, number] }
        }
        return { key, count: entry.count, values: [...new Set([...entry.values, ...entry.numbers])] }
    })
}

/** How a scanned key should be presented: which widget, and how to match it. */
export interface InferredAttributeType {
    type: FilterFacetType
    matchMode: FilterMatchMode
    /** The values are booleans rendered as a `'true'`/`'false'` select. */
    valuesAreBoolean: boolean
    /** The select options, when the inferred type needs them. */
    options?: unknown[]
}

/**
 * Infer a widget from what a key's values look like. Shared so the filter panel's
 * controls and the dock's column types can never disagree.
 *
 * Short strings become a picker (a multiselect once there are more than two distinct
 * values, so partial matching is worth having); everything else falls back to text.
 */
export function inferAttributeType(attribute: DataAttribute): InferredAttributeType {
    if (attribute.range) {
        return { type: 'numberRange', matchMode: 'exact', valuesAreBoolean: false }
    }

    const values = attribute.values
    if (values && values.length > 0) {
        if (values.every((value) => typeof value === 'string' && value.length < 64)) {
            return values.length > 2
                ? { type: 'multiselect', matchMode: 'partial', valuesAreBoolean: false, options: values }
                : { type: 'select', matchMode: 'exact', valuesAreBoolean: false, options: values }
        }
        if (values.every((value) => typeof value === 'boolean')) {
            return { type: 'select', matchMode: 'exact', valuesAreBoolean: true, options: ['true', 'false'] }
        }
    }

    return { type: 'text', matchMode: 'exact', valuesAreBoolean: false }
}
