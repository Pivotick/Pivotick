import type { Edge } from '../../../Edge'
import type { Node } from '../../../Node'
import type { Graph } from '../../../Graph'
import type { TableColumn, TableTab } from '../../../interfaces/GraphUI'
import type { UIManager } from '../../UIManager'
import { collectDataAttributes, inferAttributeType } from '../../../utils/DataAttributes'
import { edgeNameGetter, nodeNameGetter } from '../../../utils/GraphGetters'
import { FormFactory } from '../../../utils/FormFactory'

/**
 * Keys of the library's own columns.
 *
 * Namespaced so they can never collide with a data key — a graph whose nodes carry their
 * own `degree` field still gets its own column, separate from the computed one. Nobody
 * types these: use the {@link tableColumns} objects.
 */
const RESERVED = {
    label: 'pvt:label',
    degree: 'pvt:degree',
    degreeIn: 'pvt:degreeIn',
    degreeOut: 'pvt:degreeOut',
    visibility: 'pvt:visibility',
    pinned: 'pvt:pinned',
    cluster: 'pvt:cluster',
    source: 'pvt:source',
    target: 'pvt:target',
} as const

/** What the `Visibility` column reports, and why. */
export type TableVisibility = 'visible' | 'filtered' | 'excluded'

/** Data keys the leading built-in columns already show, so a scan must not repeat them. */
const CLAIMED_DATA_KEYS = new Set(['label'])

/**
 * The library's graph-aware columns — the ones no generic grid could compute, because
 * they are about an element's place in the graph rather than its data.
 *
 * Compose them into `UI.table.columns`, cloning to adjust:
 *
 * ```js
 * import { Pivotick, tableColumns } from 'pivotick'
 *
 * UI: { table: { columns: [
 *     tableColumns.label,
 *     { ...tableColumns.degree, label: 'Links' },
 *     tableColumns.visibility,
 * ] } }
 * ```
 *
 * `label` and the edge `source` / `target` columns are resolved against the graph when the
 * dock builds them, so they read the same names the rest of the UI shows. Give a column
 * your own `accessor` to take that over.
 */
export const tableColumns = {
    /** The element's display name, as the rest of the UI resolves it. */
    label: { key: RESERVED.label, label: 'Label', type: 'text', sortable: true } as TableColumn,
    /** Total edges touching the node. */
    degree: { key: RESERVED.degree, label: 'Degree', type: 'numberRange', align: 'right', accessor: (node: Node) => node.degree() } as TableColumn,
    /** Edges pointing at the node. */
    degreeIn: { key: RESERVED.degreeIn, label: 'In', type: 'numberRange', align: 'right', accessor: (node: Node) => node.getEdgesIn().length } as TableColumn,
    /** Edges leaving the node. */
    degreeOut: { key: RESERVED.degreeOut, label: 'Out', type: 'numberRange', align: 'right', accessor: (node: Node) => node.getEdgesOut().length } as TableColumn,
    /**
     * Whether the node is on the canvas, and if not, why — `filtered` by the filter panel,
     * or `excluded` by hand. The dock lists hidden nodes rather than hiding them, so this
     * is how you tell them apart.
     */
    visibility: { key: RESERVED.visibility, label: 'Visibility', type: 'select', sortable: true } as TableColumn,
    /** Whether the node is pinned in place. */
    pinned: { key: RESERVED.pinned, label: 'Pinned', type: 'boolean', accessor: (node: Node) => typeof node.fx === 'number' && typeof node.fy === 'number' } as TableColumn,
    /** The cluster the node belongs to, if any. */
    cluster: { key: RESERVED.cluster, label: 'Cluster', type: 'text', accessor: (node: Node) => node.parentNode?.id ?? '' } as TableColumn,
    /** An edge's origin, by display name. */
    source: { key: RESERVED.source, label: 'Source', type: 'text' } as TableColumn<Edge>,
    /** An edge's destination, by display name. */
    target: { key: RESERVED.target, label: 'Target', type: 'text' } as TableColumn<Edge>,
}

/** Where a node stands relative to the canvas — the `visibility` column's reading. */
export function nodeVisibility(node: Node, graph: Graph): TableVisibility {
    if (graph.queryEngine.getExcludedNodes().some((excluded) => excluded.id === node.id)) return 'excluded'
    return node.visible ? 'visible' : 'filtered'
}

/**
 * Bind the accessors that need the graph or the UI's own naming options. A column that
 * brought its own `accessor` is left alone, so a consumer can always override.
 */
function bindReservedAccessors(columns: TableColumn<Node | Edge>[], uiManager: UIManager): TableColumn<Node | Edge>[] {
    const graph = uiManager.graph
    const mainHeader = uiManager.getOptions().mainHeader

    return columns.map((column) => {
        if (column.accessor) return column
        switch (column.key) {
            case RESERVED.label:
                return { ...column, accessor: (element: Node | Edge) => isEdge(element) ? edgeNameGetter(element, mainHeader) : nodeNameGetter(element, mainHeader) }
            case RESERVED.visibility:
                return { ...column, accessor: (element: Node | Edge) => isEdge(element) ? '' : nodeVisibility(element, graph) }
            case RESERVED.source:
                return { ...column, accessor: (element: Node | Edge) => isEdge(element) ? nodeNameGetter(element.from, mainHeader) : '' }
            case RESERVED.target:
                return { ...column, accessor: (element: Node | Edge) => isEdge(element) ? nodeNameGetter(element.to, mainHeader) : '' }
            default:
                return column
        }
    })
}

/** `Edge` has a `from`; `Node` does not. Cheaper and safer here than an `instanceof`. */
function isEdge(element: Node | Edge): element is Edge {
    return (element as Edge).from !== undefined
}

/**
 * Resolve the columns for one tab, in three tiers:
 *
 * 1. **Declared** — `UI.table.columns` / `edgeColumns` win outright.
 * 2. **From facets** — otherwise, if `UI.filter.facets` is declared, build columns from
 *    them, so declaring your data shape once makes the filter panel and the dock agree.
 * 3. **Scanned** — otherwise read the data, sharing `collectDataAttributes` with the
 *    filter panel's zero-config path so the inferred types match.
 *
 * Tiers 2 and 3 are prefixed with the graph-aware columns (label, degree, visibility for
 * nodes; source/label/target for edges), because a table that opens without them can't
 * answer "which are the hubs" — the question people actually arrive with.
 */
export function resolveColumns(uiManager: UIManager, tab: TableTab): TableColumn<Node | Edge>[] {
    const options = uiManager.getOptions()
    const declared = tab === 'nodes'
        ? options.table && typeof options.table === 'object' ? options.table.columns : undefined
        : options.table && typeof options.table === 'object' ? options.table.edgeColumns : undefined

    if (declared?.length) {
        return bindReservedAccessors(declared as TableColumn<Node | Edge>[], uiManager)
    }

    const leading: TableColumn<Node | Edge>[] = tab === 'nodes'
        ? [tableColumns.label, tableColumns.degree, tableColumns.visibility] as TableColumn<Node | Edge>[]
        : [tableColumns.source, tableColumns.label, tableColumns.target] as unknown as TableColumn<Node | Edge>[]

    return bindReservedAccessors([...leading, ...dataColumns(uiManager, tab)], uiManager)
}

/**
 * The data half of the derived column set: from declared facets when there are any,
 * otherwise from a scan of the elements.
 *
 * Scanned columns are ordered by **coverage** — how many elements actually carry the key —
 * so on heterogeneous data (an import from several sources) the well-populated columns come
 * first and the long tail of near-empty ones sits at the far right, reachable through the
 * column picker rather than in the way.
 */
function dataColumns(uiManager: UIManager, tab: TableTab): TableColumn<Node | Edge>[] {
    const options = uiManager.getOptions()
    const graph = uiManager.graph

    // Facets describe nodes, so they only stand in for the node tab's data columns.
    const facets = options.filter?.facets
    if (tab === 'nodes' && facets?.length) {
        return [...facets]
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
            .map((facet) => ({
                key: facet.key,
                label: facet.label ?? FormFactory.niceLabelFromKey(facet.key),
                type: facet.type,
                // A facet carrying only a `predicate` decides membership; it cannot produce
                // a cell. Fall back to the data key and let the reader see what is there.
                accessor: facet.accessor as ((element: Node | Edge) => unknown) | undefined,
            }))
    }

    const elements: Array<Node | Edge> = tab === 'nodes'
        ? graph.getMutableNodes().filter((node) => !node.isChild)
        : graph.getMutableEdges()

    return collectDataAttributes(elements, options.filter?.excludeKeys)
        // The built-in Label column *is* the display name, and `label` is the conventional
        // place it comes from — so a scanned `label` column would show the same value twice
        // under the same heading. Declare it in `columns` to get it back as its own column.
        .filter((attribute) => !CLAIMED_DATA_KEYS.has(attribute.key))
        .sort((a, b) => b.count - a.count)
        .map((attribute) => ({
            key: attribute.key,
            label: FormFactory.niceLabelFromKey(attribute.key),
            type: inferAttributeType(attribute).type,
            align: attribute.range ? 'right' as const : undefined,
        }))
}

/** Read one cell's raw value. The default accessor is the element's data key. */
export function readCell(column: TableColumn<Node | Edge>, element: Node | Edge): unknown {
    if (column.accessor) return column.accessor(element)
    return element.getData()?.[column.key]
}
