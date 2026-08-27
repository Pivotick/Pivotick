import type { Edge } from '../../../Edge'
import type { Node } from '../../../Node'
import type { FilterValue } from '../../../interfaces/GraphQueryEngine'
import type { TableTab } from '../../../interfaces/GraphUI'
import type { UIManager } from '../../UIManager'

/**
 * The filter key the dock's push owns, on both sides of the engine — `__table` for
 * nodes, `edge:__table` for relations.
 *
 * Reserved in the same sense as the legend's `__legend`: registered additively, absent
 * from `getFacets()`, and out of reach of the filter panel's `replaceFilters` — which is
 * what lets the panel's own button and this one coexist without either clobbering the
 * other.
 */
export const TABLE_FILTER_KEY = '__table'

/**
 * The dock's push to the graph: the column filters, applied.
 *
 * The filter names **the ids to hide**, never the ids to keep. Both halves of that are
 * load-bearing:
 *
 * - `applyFiltersOnSubgraph` hands the active filters down into every open cluster's own
 *   engine. A hide-exactly-these filter is inert there, because no child's id is in the
 *   list; a show-only-these filter would blank every cluster interior.
 * - A node that arrives after the push was not part of what the user said, so it stays on
 *   the canvas. The push is a statement about a moment, not a standing query.
 *
 * The predicate is stateless for the same reason: it reads the ids out of the filter
 * value rather than closing over the table's rows, so the copy that travels into a
 * subgraph answers exactly as the one here does.
 */
export class TableGraphFilter {
    private readonly uiManager: UIManager
    private claimed = false
    /**
     * Id sets, memoised per filter-value array. The predicate runs once per element per
     * application, so building the set inside it would be quadratic; the array identity
     * is stable for the life of a push, including the copy handed to a subgraph.
     */
    private readonly sets = new WeakMap<object, Set<string>>()

    constructor(uiManager: UIManager) {
        this.uiManager = uiManager
    }

    /** Register both reserved facets. Idempotent — remounting must not double up. */
    public claim(): void {
        if (this.claimed) return
        const engine = this.uiManager.graph.queryEngine
        const shared = {
            key: TABLE_FILTER_KEY,
            label: 'From the table',
            type: 'multiselect' as const,
            matchMode: 'exact' as const,
        }
        engine.registerFacet({
            ...shared,
            predicate: (node: Node, value: FilterValue) => !this.hidden(value).has(node.id),
        })
        engine.registerEdgeFacet({
            ...shared,
            predicate: (edge: Edge, value: FilterValue) => !this.hidden(value).has(edge.id),
        })
        this.claimed = true
    }

    /**
     * Drop both facets, and with them whatever they were hiding — `unregisterFacet`
     * removes the filter that was relying on the declaration. So a UI teardown can never
     * leave behind a filter nothing is left to clear.
     */
    public release(): void {
        if (!this.claimed) return
        const engine = this.uiManager.graph.queryEngine
        engine.unregisterFacet(TABLE_FILTER_KEY)
        engine.unregisterEdgeFacet(TABLE_FILTER_KEY)
        this.claimed = false
    }

    /**
     * Hide these ids on the canvas.
     *
     * An empty list clears the push rather than writing one: `getFilters()` must carry no
     * phantom entry (the header pill counts keys), and on the edge side an empty array is
     * read by `edgeMatchesFilters` as "hide this layer outright" — which would blank every
     * relation in the graph.
     */
    public push(tab: TableTab, ids: string[]): void {
        if (ids.length === 0) {
            this.clear(tab)
            return
        }
        const engine = this.uiManager.graph.queryEngine
        const config = { value: [...ids], matchMode: 'exact' as const }
        if (tab === 'edges') engine.setEdgeFilter(TABLE_FILTER_KEY, config)
        else engine.setFilter(TABLE_FILTER_KEY, config)
    }

    /** Stop filtering the graph from this tab. */
    public clear(tab: TableTab): void {
        const engine = this.uiManager.graph.queryEngine
        if (tab === 'edges') engine.removeEdgeFilter(TABLE_FILTER_KEY)
        else engine.removeFilter(TABLE_FILTER_KEY)
    }

    /**
     * The ids this tab is currently hiding, or `undefined` when nothing is pushed.
     *
     * Read back off the engine rather than remembered here, so the button follows a
     * `resetFilters()` from anywhere — the same way the legend re-derives which of its
     * entries are lit.
     */
    public pushed(tab: TableTab): string[] | undefined {
        const engine = this.uiManager.graph.queryEngine
        const filters = tab === 'edges' ? engine.getEdgeFilters() : engine.getFilters()
        const value = filters[TABLE_FILTER_KEY]?.value
        if (value === undefined) return undefined
        return Array.isArray(value) ? value.map(String) : [String(value)]
    }

    private hidden(value: FilterValue): Set<string> {
        if (!Array.isArray(value)) {
            return new Set(value === undefined || value === null ? [] : [String(value)])
        }
        const cached = this.sets.get(value)
        if (cached) return cached

        const set = new Set(value.map(String))
        this.sets.set(value, set)
        return set
    }
}

/** Do two id lists name the same set? Order is no part of a push's meaning. */
export function sameIdSet(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false
    const set = new Set(a)
    return b.every((id) => set.has(id))
}
