// #region data
// A small service-dependency graph. Each node carries categorical fields (type,
// zone), a numeric one (load) and an array-valued one (tags) — exactly the kind of
// data the filter engine and its built-in UI slice on. Colouring by type is purely
// so the filtering reads clearly (see the Node styling cards for the technique).
const palette = { web: '#0072B2', api: '#E69F00', db: '#009E73' }

const data = {
    nodes: [
        { id: 'web-1', data: { type: 'web', zone: 'eu', load: 82, tags: ['public', 'critical'] } },
        { id: 'web-2', data: { type: 'web', zone: 'us', load: 45, tags: ['public'] } },
        { id: 'api-1', data: { type: 'api', zone: 'eu', load: 68, tags: ['internal'] } },
        { id: 'api-2', data: { type: 'api', zone: 'us', load: 91, tags: ['internal', 'critical'] } },
        { id: 'api-3', data: { type: 'api', zone: 'eu', load: 30, tags: [] } },
        { id: 'db-1', data: { type: 'db', zone: 'eu', load: 55, tags: ['critical'] } },
        { id: 'db-2', data: { type: 'db', zone: 'us', load: 74, tags: ['critical'] } }
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

// #region facets
// Distinct values of a key across the graph, flattening array-valued data — so a
// select's options follow the data without the facet set itself churning.
function distinct(graph, key) {
    const values = new Set()
    for (const node of graph.getNodes()) {
        const value = node.getData()[key]
        if (Array.isArray(value)) value.forEach((entry) => values.add(entry))
        else if (value !== null && value !== undefined) values.add(String(value))
    }
    return [...values].sort().map((value) => ({ label: value, value }))
}

// Declaring facets replaces the panel's data-scanning: exactly these fields, in
// this order, with these labels and widgets. Omit `UI.filter.facets` entirely and
// the panel derives a control per data key instead (the zero-config default).
const facets = [
    { key: 'type', label: 'Service type', type: 'multiselect', options: (g) => distinct(g, 'type') },
    { key: 'zone', label: 'Region', type: 'select', options: (g) => distinct(g, 'zone') },
    { key: 'load', label: 'Load (%)', type: 'numberRange' },

    // Array-valued data: a filter tests membership, so picking `critical` matches
    // every node carrying that tag — one control, no flattened shadow data key.
    { key: 'tags', label: 'Tag', type: 'multiselect', options: (g) => distinct(g, 'tags') },

    // Computed: `accessor` reads whatever you like, here the *dependencies'* load
    // rather than the node's own data — "which services depend on a busy one?".
    {
        key: 'dep_load', label: 'Depends on load ≥', type: 'numberRange',
        accessor: (node) => node.getEdgesOut().map((edge) => edge.to.getData().load)
    },

    // Full control: decide membership yourself.
    {
        key: 'name', label: 'Name matches', type: 'regex',
        predicate: (node, value) => new RegExp(value, 'i').test(node.id)
    }
]
// #endregion facets

// #region options
const options = {
    // Full mode ships the built-in Graph Filters panel (open it from the header's
    // funnel, or Shift+K). Its form is generated from the facets declared below;
    // without `filter.facets` it auto-discovers your node attributes instead.
    UI: {
        mode: 'full',
        filter: { facets }
    },
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
// graph.queryEngine. setFilter(key, spec) keys off the facet's key and applies at
// once; call it for several keys and the filters AND together.
function filterByType(graph, type) {
    graph.queryEngine.setFilter('type', { value: type, matchMode: 'exact' })
}

// A numeric spec takes a { min, max } range (either bound may be omitted).
function filterByLoad(graph, min) {
    graph.queryEngine.setFilter('load', { value: { min, max: undefined } })
}

// Array-valued data matches by membership: this keeps every node tagged 'critical'.
// Pass an array for any-of, or add matchMode: 'all' to require every tag.
function filterByTag(graph, tag) {
    graph.queryEngine.setFilter('tags', { value: tag })
}

// The computed facet: the node's own load is irrelevant, its dependencies' isn't.
function filterByDependencyLoad(graph, min) {
    graph.queryEngine.setFilter('dep_load', { value: { min, max: undefined } })
}

// resetFilters clears every active filter and restores the full graph.
function clearFilters(graph) {
    graph.queryEngine.resetFilters()
}

// Attribute rules aside, excludeNode(id) hides a single node by hand. It's tracked
// separately from setFilter rules and listed in the panel's "Hidden nodes" section;
// includeNode(id) restores one, clearNodeExclusions() restores them all.
function excludeNode(graph, id) {
    graph.queryEngine.excludeNode(id)
}

function clearExclusions(graph) {
    graph.queryEngine.clearNodeExclusions()
}
// #endregion filters

export {
    data, options, facets,
    filterByType, filterByLoad, filterByTag, filterByDependencyLoad,
    clearFilters, excludeNode, clearExclusions
}
