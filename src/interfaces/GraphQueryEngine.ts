import type { Edge } from '../Edge'
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

/**
 * What the query engine needs from a facet in order to match a value: the widget
 * (only `regex` changes how matching works) and the match mode. Shared by node and
 * edge facets so one matcher serves both scopes.
 */
export interface FacetMatching {
    key: string
    type?: FilterFacetType
    matchMode?: FilterMatchMode
}

/**
 * A declared **edge** facet: one control in the filter panel's Relationships section,
 * read off edge data and driving edge visibility rather than node visibility.
 *
 * The same vocabulary as {@link FilterFacet} with edge-shaped defaults — a layer is a
 * multiselect, so `type` is optional, and `options` are derived from the graph's real
 * edges when omitted. `{ key: 'kind' }` is therefore a complete declaration.
 *
 * @example
 * ```js
 * { key: 'kind', label: 'Relationship layer' }
 * { key: 'weight', type: 'numberRange' }
 * ```
 */
export interface EdgeFacet {
    /** Filter identity. The `GraphFilters` key is namespaced; `setEdgeFilter` takes this. */
    key: string
    /**
     * Human label for the control, used verbatim (so it can be translated).
     * Defaults to a prettified `key`.
     */
    label?: string
    /** @default 'multiselect' — a layer is a set of kinds, each on or off. */
    type?: FilterFacetType
    /**
     * Options for `select` / `multiselect`. A function is resolved against the live
     * graph every time the panel rebuilds. Omitted entirely, the options are derived
     * from the distinct values this facet reads off the graph's real edges.
     */
    options?: FilterFacetOption[] | ((graph: Graph) => FilterFacetOption[])
    /** @default 'exact' */
    matchMode?: FilterMatchMode
    /**
     * How to read this facet off an edge. Defaults to `edge.getData()[key]`.
     * This is what makes computed facets possible.
     */
    accessor?: (edge: Edge) => unknown
    /**
     * Full control: decide membership yourself. Wins over `accessor` / `matchMode`.
     * Runs per edge per filter application, so keep it cheap.
     */
    predicate?: (edge: Edge, value: FilterValue) => boolean
    /** Display order in the panel. @default declaration order */
    order?: number
}

/**
 * One distinct value an edge facet reads off the graph, with how many real edges
 * carry it and the first of them — the sample a line swatch resolves its style from.
 */
export interface EdgeFacetValue {
    value: string
    count: number
    sample: Edge
}

/** `UI.filter` — how the filter panel is populated. */
export interface FilterOptions {
    /**
     * Whether the filter panel is offered at all: the header's **Filter Graph** pill,
     * the panel it opens and `Shift+K`.
     *
     * The panel only, not filtering: `graph.queryEngine` still answers to code, the
     * legend still filters, and the dock's own column filters answer to
     * `UI.table.filterGraph`.
     * @default true
     */
    enabled?: boolean
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
    /**
     * The edge dimensions the graph's relations are filterable by — the *layers*.
     * Each renders in the panel's Relationships section and drives edge visibility;
     * node positions, selection and camera are untouched by a toggle.
     *
     * Unlike {@link facets} these are never auto-derived: a graph that declares none
     * behaves exactly as one that has never heard of edge layers.
     *
     * @default undefined — no edge filtering
     */
    edgeFacets?: EdgeFacet[]
    /**
     * Hide nodes left with no visible edge — the orphans an edge-layer toggle strands.
     * Counted after the layers and the node filters have had their say; a note pinned
     * to a node is not a relation and does not keep it.
     *
     * Unlike a layer toggle this **moves the graph**: a hidden node leaves the
     * simulation, so the rest re-settle. The View flyout carries the same switch, so a
     * user can turn it off (or on) without the graph declaring anything.
     *
     * Runs on this graph's own nodes; a cluster's interior is left alone, because
     * clusters routinely group nodes that have no relations between them.
     *
     * @default false
     */
    hideDisconnected?: boolean
}
