import { ColorPaletteMapper } from '../../../../src/index'

// #region data
// A service graph carrying four *kinds* of relation at once. `calls` is the one
// people come for; the other three are context that buries it — which is the
// problem layers solve.
const data = {
    nodes: [
        { id: 'web-1', data: { name: 'Web app', type: 'web' } },
        { id: 'web-2', data: { name: 'Mobile web', type: 'web' } },
        { id: 'api-1', data: { name: 'Auth API', type: 'api' } },
        { id: 'api-2', data: { name: 'Orders API', type: 'api' } },
        { id: 'api-3', data: { name: 'Billing API', type: 'api' } },
        { id: 'db-1', data: { name: 'Postgres', type: 'database' } },
        { id: 'db-2', data: { name: 'Replica', type: 'database' } },
        { id: 'cache-1', data: { name: 'Redis', type: 'cache' } },
        { id: 'mon-1', data: { name: 'Metrics', type: 'ops' } },
        { id: 'ci-1', data: { name: 'Deploys', type: 'ops' } }
    ],
    edges: [
        // The call graph — the structure everything else hangs off.
        { from: 'web-1', to: 'api-1', data: { kind: 'calls' } },
        { from: 'web-1', to: 'api-2', data: { kind: 'calls' } },
        { from: 'web-2', to: 'api-1', data: { kind: 'calls' } },
        { from: 'api-2', to: 'api-3', data: { kind: 'calls' } },
        { from: 'api-1', to: 'cache-1', data: { kind: 'calls' } },
        { from: 'api-2', to: 'db-1', data: { kind: 'calls' } },
        { from: 'api-3', to: 'db-1', data: { kind: 'calls' } },
        // Data movement.
        { from: 'db-1', to: 'db-2', data: { kind: 'replicates' } },
        // Observability: one hub wired to everything, which is exactly what makes
        // the call graph hard to read while this layer is on.
        { from: 'mon-1', to: 'api-1', data: { kind: 'monitors' } },
        { from: 'mon-1', to: 'api-2', data: { kind: 'monitors' } },
        { from: 'mon-1', to: 'db-1', data: { kind: 'monitors' } },
        { from: 'mon-1', to: 'cache-1', data: { kind: 'monitors' } },
        // Co-location — inferred, not structural.
        { from: 'ci-1', to: 'api-1', data: { kind: 'deployed-with' } },
        { from: 'ci-1', to: 'api-2', data: { kind: 'deployed-with' } },
        { from: 'ci-1', to: 'api-3', data: { kind: 'deployed-with' } }
    ]
}
// #endregion data

// #region options
// import { ColorPaletteMapper } from 'pivotick'

// Node colour keys on `type`; edge style keys on `kind`. Two independent
// encodings, which is why the legend below carries a section for each.
const palette = new ColorPaletteMapper('okabe-ito')

const options = {
    render: {
        // 1. Name the kind. Mirrors `nodeTypeAccessor` exactly.
        edgeTypeAccessor: (edge) => edge.getData()?.kind,
        // 2. Style it apart. Each value is a partial EdgeStyle merged over
        //    `defaultEdgeStyle`, so a kind only states what makes it different.
        edgeStyleMap: {
            calls: { strokeColor: '#0072B2', strokeWidth: 2.5 },
            replicates: { strokeColor: '#009E73', strokeWidth: 2.5, markerEnd: 'diamond' },
            // `animateDash: false` keeps the two context layers calm. A dashed edge
            // animates its dash by default, which is a lot of motion for something
            // you are meant to read past.
            monitors: { strokeColor: '#999999', strokeWidth: 1.5, dashed: true, animateDash: false },
            'deployed-with': { strokeColor: '#E69F00', strokeWidth: 1.5, dashed: true, animateDash: false }
        },
        defaultNodeStyle: {
            size: 18,
            strokeColor: '#ffffff',
            textColor: '#334155',
            text: (node) => node.getData()?.name,
            // 1.6 addition: draw the whole label instead of middle-ellipsising it.
            textTruncate: false,
            textVerticalShift: -2.2,
            color: (node) => palette.getColor(node.getData()?.type)
        }
    },
    // Not part of the feature — just room. Ten labelled nodes with four relation
    // kinds between them need more space than `Auto` gives a graph this small,
    // and naming any of these knobs opts the graph out of auto tuning.
    simulation: {
        d3LinkDistance: 115,
        d3ManyBodyStrength: -1100,
        d3CollideRadiusMultiplier: 3
    },
    UI: {
        // Layers need the filter panel and the legend, both of which are `full`-mode
        // chrome. The facets themselves are registered whatever the mode, so
        // `queryEngine.setEdgeFilter` works in `viewer` and `static` too.
        mode: 'full',
        // Off: `full` mode also brings a minimap and the data dock, and this card is
        // about neither.
        minimap: false,
        table: false,
        filter: {
            // 3. Make the kind a layer. `{ key: 'kind' }` alone would do — the label
            //    and the options are both derived. Nothing about edge facets is ever
            //    auto-derived, though: declare none and layers don't exist.
            edgeFacets: [{ key: 'kind', label: 'Relationship' }]
        },
        legend: {
            // Top-left: a two-section card is tall enough to reach the mode rail in
            // the bottom-left corner.
            position: 'top-left',
            sections: [
                { key: 'type', title: 'Service' },
                // `scope: 'edge'` keys on edges and draws a *line* swatch — stroke
                // colour, dash and marker as the renderer resolved them. It adopts
                // the `kind` facet declared above, so this section and the panel's
                // Relationships toggles are two views of one filter.
                { key: 'kind', title: 'Relationship', scope: 'edge' }
            ]
        }
    }
}
// #endregion options

// #region control
// Layers are filters, so they are drivable from code in any mode. `value` is the
// list of kinds that stay *on*.
function callsOnly(graph) {
    graph.queryEngine.setEdgeFilter('kind', { value: ['calls'], matchMode: 'exact' })
}

// Everything except the two context layers.
function hideContext(graph) {
    graph.queryEngine.setEdgeFilter('kind', { value: ['calls', 'replicates'], matchMode: 'exact' })
}

// Removing the filter is how every layer comes back on. Writing an empty list
// would mean the opposite — every layer off.
function showAllLayers(graph) {
    graph.queryEngine.removeEdgeFilter('kind')
}

// How many edges the active layers are hiding, for a status line of your own.
function reportHidden(graph) {
    console.log(`${graph.queryEngine.getHiddenEdgeCount()} edges hidden by layer`)
}
// #endregion control

export { data, options, callsOnly, hideContext, showAllLayers, reportHidden }
