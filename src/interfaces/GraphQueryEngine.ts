import type { Node } from '../Node'
import type { Graph } from '../Graph'

export interface GraphQueryEvents {
    filterAdd: (key: string, value: FilterFieldConfig) => void
    filterRemove: (key: string) => void
    filterReset: () => void
    filterChange: (filters: GraphFilters) => void
}

export type FilterValue = string | string[] |
                          number | number[] |
                          boolean |
                          { min: number | undefined, max: number | undefined } |
                          undefined // Means the filter is inactive and should be removed

/**
 * How a filter value is compared against a node's value.
 *
 *  - `'exact'`   — strict equality. For an **array** filter value (a multiselect)
 *                  or an **array** node value, this is membership: any-of.
 *  - `'partial'` — substring match on scalars (`String(nodeValue).includes(value)`).
 *                  Against an array node value, any element may match.
 *  - `'all'`     — and-semantics: every selected value must be present in the
 *                  node's (array) value.
 */
export type FilterMatchMode = 'exact' | 'partial' | 'all'
export interface FilterFieldConfig {
    /** @default 'exact' — or the declared facet's `matchMode`, when there is one. */
    matchMode?: FilterMatchMode
    value: FilterValue
}

export type GraphFilters = Record<string, FilterFieldConfig>

/** An option in a `select` / `multiselect` facet. */
export interface FilterFacetOption {
    label: string
    value: string
}

/**
 * The widget a facet is filtered with. Mirrors `FormFactory`'s field vocabulary;
 * `regex` and `boolean` are filter-specific:
 *  - `regex`   — a text field compiled to a case-insensitive `RegExp`.
 *  - `boolean` — a true/false/unset dropdown (a checkbox could not express "unset").
 */
export type FilterFacetType = 'text' | 'regex' | 'select' | 'multiselect' | 'numberRange' | 'boolean'

/**
 * A declared facet: one control in the filter panel, plus how to read and match
 * it. Declaring facets replaces the library's data-scanning auto-derivation.
 *
 * @example
 * ```js
 * { key: 'tags', label: 'Tag', type: 'multiselect',
 *   options: graph => distinctTags(graph) }
 * ```
 */
export interface FilterFacet {
    /** Filter identity, and the `GraphFilters` key `setFilter` / `getFilters` use. */
    key: string
    /**
     * Human label for the form control, used verbatim (so it can be translated).
     * Defaults to a prettified `key`.
     */
    label?: string
    type: FilterFacetType
    /**
     * Options for `select` / `multiselect`. A function is resolved against the
     * live graph every time the panel rebuilds, so option lists can follow the
     * data without the facet set itself churning.
     */
    options?: FilterFacetOption[] | ((graph: Graph) => FilterFacetOption[])
    /** @default 'exact' */
    matchMode?: FilterMatchMode
    /**
     * How to read this facet off a node. Defaults to `node.getData()[key]`.
     * This is what makes computed facets (over children, edges, …) possible.
     */
    accessor?: (node: Node) => unknown
    /**
     * Full control: decide membership yourself. Wins over `accessor` / `matchMode`.
     * Runs per node per filter application, so keep it cheap.
     */
    predicate?: (node: Node, value: FilterValue) => boolean
    /** Display order in the panel. @default declaration order */
    order?: number
}

/** `UI.filter` — how the filter panel is populated. */
export interface FilterOptions {
    /**
     * The facets the graph is filterable by. When set, the filter form is
     * generated from this declaration and auto-derivation is skipped entirely.
     * @default undefined — derive facets by scanning node data
     */
    facets?: FilterFacet[]
    /**
     * Keys to omit when auto-deriving — the cheap escape from `uuid`-style noise
     * without declaring everything. Ignored when `facets` is set.
     */
    excludeKeys?: string[]
}
