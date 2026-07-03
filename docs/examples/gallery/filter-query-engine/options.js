// #region data
// A small service-dependency graph. Each node carries categorical fields (type,
// zone) and a numeric one (load) — exactly the kind of data the filter engine and
// its built-in UI slice on. Colouring by type is purely so the filtering reads
// clearly (see the Node styling cards for the technique).
const palette = { web: '#0072B2', api: '#E69F00', db: '#009E73' }

const data = {
    nodes: [
        { id: 'web-1', data: { type: 'web', zone: 'eu', load: 82 } },
        { id: 'web-2', data: { type: 'web', zone: 'us', load: 45 } },
        { id: 'api-1', data: { type: 'api', zone: 'eu', load: 68 } },
        { id: 'api-2', data: { type: 'api', zone: 'us', load: 91 } },
        { id: 'api-3', data: { type: 'api', zone: 'eu', load: 30 } },
        { id: 'db-1', data: { type: 'db', zone: 'eu', load: 55 } },
        { id: 'db-2', data: { type: 'db', zone: 'us', load: 74 } }
    ],
    edges: [
        { from: 'web-1', to: 'api-1' },
        { from: 'web-1', to: 'api-3' },
        { from: 'web-2', to: 'api-2' },
        { from: 'api-1', to: 'db-1' },
        { from: 'api-2', to: 'db-2' },
        { from: 'api-3', to: 'db-1' },
        { from: 'db-1', to: 'db-2' }
    ]
}
// #endregion data

// #region options
const options = {
    // Full mode ships the built-in Graph Filters panel (open it from the header's
    // funnel, or Shift+K): it auto-discovers your node attributes and offers a
    // dropdown per categorical field and a slider per numeric one.
    UI: { mode: 'full' },
    render: {
        nodeTypeAccessor: (node) => node.getData().type,
        nodeStyleMap: {
            web: { color: palette.web },
            api: { color: palette.api },
            db: { color: palette.db }
        }
    }
}
// #endregion options

// #region filters
// Everything the built-in panel does is available programmatically on
// graph.queryEngine. setFilter(key, spec) keys off node.getData()[key] and applies
// at once; call it for several keys and the filters AND together.
function filterByType(graph, type) {
    graph.queryEngine.setFilter('type', { value: type, matchMode: 'exact' })
}

// A numeric spec takes a { min, max } range (either bound may be omitted).
function filterByLoad(graph, min) {
    graph.queryEngine.setFilter('load', { value: { min, max: undefined } })
}

// resetFilters clears every active filter and restores the full graph.
function clearFilters(graph) {
    graph.queryEngine.resetFilters()
}
// #endregion filters

export { data, options, filterByType, filterByLoad, clearFilters }
