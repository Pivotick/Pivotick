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
    children: 'pvt:children',
    source: 'pvt:source',
    target: 'pvt:target',
} as const

/**
 * What the `Visibility` column reports, and why.
 *
 * `filtered` and `excluded` are a node's two reasons; an edge reads `filtered` when its
 * own layer is switched off, and `endpoint` when an end of it is not on the canvas —
 * filtered out, or inside a collapsed cluster. An edge cannot be `excluded`: there is no
 * hide-this-edge action.
 */
export type TableVisibility = 'visible' | 'filtered' | 'excluded' | 'endpoint'

/** The `Visibility` column's key — the grid checks for it to style the cell per state. */
export const VISIBILITY_COLUMN_KEY = RESERVED.visibility

/** The `Label` column's key — the default sort prefers it over whatever comes first. */
export const LABEL_COLUMN_KEY = RESERVED.label

/** Data keys the leading built-in columns already show, so a scan must not repeat them. */
const CLAIMED_DATA_KEYS = new Set(['label'])

/**
 * A count is two or three digits wide, but a column with no `width` takes
 * `minmax(120px, 1fr)` — a floor *and* an equal share of the leftover room — so `Degree`
 * came out as wide as the name beside it, and its Min/Max pair stretched to match. Fixed
 * and narrow instead: wide enough for the heading and the two bounds, and no wider.
 */
const COUNT_COLUMN_WIDTH = 96

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
    degree: { key: RESERVED.degree, label: 'Degree', type: 'numberRange', align: 'right', accessor: (node: Node) => node.degree(), width: COUNT_COLUMN_WIDTH } as TableColumn,
    /** Edges pointing at the node. */
    degreeIn: { key: RESERVED.degreeIn, label: 'In', type: 'numberRange', align: 'right', accessor: (node: Node) => node.getEdgesIn().length, width: COUNT_COLUMN_WIDTH } as TableColumn,
    /** Edges leaving the node. */
    degreeOut: { key: RESERVED.degreeOut, label: 'Out', type: 'numberRange', align: 'right', accessor: (node: Node) => node.getEdgesOut().length, width: COUNT_COLUMN_WIDTH } as TableColumn,
    /**
     * Whether the element is on the canvas, and if not, why — for a node, `filtered` by
     * the filter panel or `excluded` by hand; for an edge, `filtered` when its layer is
     * off or `endpoint` when an end of it has left. The dock lists hidden elements rather
     * than hiding them, so this is how you tell them apart.
     *
     * Narrow and fixed-width: it leads the derived column set as a status gutter, so it
     * should not eat the room the name needs.
     */
    visibility: { key: RESERVED.visibility, label: 'Visibility', type: 'select', sortable: true, width: 104 } as TableColumn,
    /** Whether the node is pinned in place. */
    pinned: { key: RESERVED.pinned, label: 'Pinned', type: 'boolean', accessor: (node: Node) => typeof node.fx === 'number' && typeof node.fy === 'number' } as TableColumn,
    /**
     * How many nodes a cluster holds directly — `0` for a leaf.
     *
     * Nothing else in the UI says how big a cluster is: not the label, not the tooltip,
     * not the sidebar. Without this the only way to find out is to expand it, which is
     * the exact "read the value instead of hunting for it" the dock exists for.
     *
     * Direct children, not the whole subtree, so it matches the structure a nested
     * cluster's own row then reports one level down.
     */
    children: { key: RESERVED.children, label: 'Children', type: 'numberRange', align: 'right', accessor: (node: Node) => node.children.length, width: COUNT_COLUMN_WIDTH } as TableColumn,
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
 * Where an edge stands relative to the canvas. Its two reasons are independent — see
 * `Edge.layerVisible` — and an end that has left the canvas is reported first: while a
 * node it touches is gone, switching its layer back on cannot bring the edge back.
 */
export function edgeVisibility(edge: Edge): TableVisibility {
    if (edge.visible) return 'visible'
    return edge.visibleIgnoringLayer ? 'filtered' : 'endpoint'
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
                return { ...column, accessor: (element: Node | Edge) => isEdge(element) ? edgeVisibility(element) : nodeVisibility(element, graph) }
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
 * Tiers 2 and 3 are wrapped in the graph-aware columns, because a table that opens
 * without them can't answer "which are the hubs" — the question people actually arrive
 * with.
 *
 * For nodes, **visibility** and **label** lead: a status gutter and the name, the two
 * things you scan down to find a row. The counts — **degree**, and **children** on a
 * graph that has clusters — close the row instead, as a fixed-width numeric tail. They
 * belong together (both are counts, both read right-aligned) and they are the graph's
 * arithmetic rather than the element's own data, so they sit past it rather than pushing
 * it right. Edges keep the same gutter and then read as a sentence: visibility, source,
 * label, target.
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
        ? [tableColumns.visibility, tableColumns.label] as TableColumn<Node | Edge>[]
        // Edges read as a sentence — source, relation, target — so they keep that order,
        // behind the same status gutter the nodes get: a hidden edge that read as present
        // was the whole complaint.
        : [tableColumns.visibility, tableColumns.source, tableColumns.label, tableColumns.target] as unknown as TableColumn<Node | Edge>[]

    const trailing: TableColumn<Node | Edge>[] = tab === 'nodes'
        ? [tableColumns.degree] as TableColumn<Node | Edge>[]
        : []

    // Children only earns a column on a graph that has clusters — everywhere else it is a
    // column of zeros, and the derived set is meant to be what this graph can answer.
    if (tab === 'nodes' && uiManager.graph.getMutableNodes().some((node) => node.isParent)) {
        trailing.push(tableColumns.children as TableColumn<Node | Edge>)
    }

    // Derived columns filter themselves. Everything about them is already inferred — the
    // label, the type, the alignment — and the control is inferred off that same type, so
    // this is one more guess of a piece with the rest. It is also the table nobody
    // configured, which is the one most likely to need narrowing before it can be read.
    // Declared columns keep the literal `filterable: false`: a column set someone wrote
    // out by hand is a statement, not a guess. Copies, so the shared `tableColumns`
    // constants a consumer may also be declaring are never touched.
    return bindReservedAccessors([...leading, ...dataColumns(uiManager, tab), ...trailing], uiManager)
        .map((column) => ({ ...column, filterable: true }))
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
