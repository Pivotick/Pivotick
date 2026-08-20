import { ColorPaletteMapper, tableColumns } from '../../../../src/index'

// #region data
const data = {
    nodes: [
        { id: 'api', data: { label: 'api-gateway', kind: 'service', owner: 'Platform', requests: 48200, tier: 'edge' } },
        { id: 'auth', data: { label: 'auth-service', kind: 'service', owner: 'Identity', requests: 31400, tier: 'core' } },
        { id: 'billing', data: { label: 'billing-service', kind: 'service', owner: 'Payments', requests: 8600, tier: 'core' } },
        { id: 'search', data: { label: 'search-service', kind: 'service', owner: 'Discovery', requests: 22750, tier: 'core' } },
        { id: 'users-db', data: { label: 'users-db', kind: 'datastore', owner: 'Identity', requests: 39900, tier: 'data' } },
        { id: 'orders-db', data: { label: 'orders-db', kind: 'datastore', owner: 'Payments', requests: 12300, tier: 'data' } },
        { id: 'index', data: { label: 'search-index', kind: 'datastore', owner: 'Discovery', requests: 20100, tier: 'data' } },
        { id: 'cache', data: { label: 'edge-cache', kind: 'datastore', owner: 'Platform', requests: 51000, tier: 'edge' } },
        { id: 'mailer', data: { label: 'mailer', kind: 'worker', owner: 'Payments', requests: 1450, tier: 'async' } },
        { id: 'reindexer', data: { label: 'reindexer', kind: 'worker', owner: 'Discovery', requests: 980, tier: 'async' } },
    ],
    edges: [
        { from: 'api', to: 'auth', data: { label: 'authenticates' } },
        { from: 'api', to: 'search', data: { label: 'queries' } },
        { from: 'api', to: 'billing', data: { label: 'charges' } },
        { from: 'api', to: 'cache', data: { label: 'reads' } },
        { from: 'auth', to: 'users-db', data: { label: 'reads' } },
        { from: 'billing', to: 'orders-db', data: { label: 'writes' } },
        { from: 'billing', to: 'mailer', data: { label: 'enqueues' } },
        { from: 'search', to: 'index', data: { label: 'reads' } },
        { from: 'reindexer', to: 'index', data: { label: 'writes' } },
        { from: 'reindexer', to: 'orders-db', data: { label: 'reads' } },
    ],
}
// #endregion data

// A colorblind-safe palette; getColor() assigns and remembers a color per value.
const palette = new ColorPaletteMapper('okabe-ito')

// #region options
// import { ColorPaletteMapper, tableColumns } from 'pivotick'
//
// The data dock comes with `mode: 'full'` — the header grows a Table pill, or press
// Shift+T. Everything here is optional; `UI: { mode: 'full' }` alone gets you a table.
//
// Columns are derived when you don't declare any: the graph-aware ones lead (Label,
// Degree, Visibility) and the data keys follow, ordered by how many nodes carry them.
// They are declared here instead, to put `requests` on the right and give two columns
// a row filter. `tableColumns` holds the graph-aware ones — clone one to relabel it.
const options = {
    UI: {
        mode: 'full',
        // Top-left, because the dock leaves a shorter canvas and the mode rail wins the
        // bottom-left corner on a short viewport (see the legend docs).
        legend: { position: 'top-left' },
        table: {
            open: true,
            height: 0.42,
            // Busiest first — the question you actually arrive with.
            sort: { key: 'requests', direction: 'desc' },
            columns: [
                { ...tableColumns.label, label: 'Service', filterable: true },
                { key: 'kind', label: 'Kind', type: 'select', filterable: true },
                { key: 'owner', label: 'Owner', type: 'select' },
                { key: 'tier', label: 'Tier', type: 'select' },
                { key: 'requests', label: 'Requests / day', type: 'numberRange', align: 'right' },
                { ...tableColumns.degree, label: 'Links' },
            ],
        },
    },
    // Colour by the same `kind` the table shows, so a row and a dot can be matched by
    // eye. Declaring `nodeTypeAccessor` is also what earns the canvas its legend.
    render: {
        nodeTypeAccessor: (node) => node.getData().kind,
        defaultNodeStyle: {
            color: (node) => palette.getColor(node.getData().kind),
        },
    },
}
// #endregion options

export { data, options }
