import { ColorPaletteMapper } from '../../../../src/index'

// #region data
// A service graph whose `type` drives both the colours and the legend. The counts
// differ per type on purpose — the legend reports them.
const data = {
    nodes: [
        { id: 'web-1', data: { name: 'Web app', type: 'web' } },
        { id: 'web-2', data: { name: 'Mobile web', type: 'web' } },
        { id: 'api-1', data: { name: 'Auth API', type: 'api' } },
        { id: 'api-2', data: { name: 'Orders API', type: 'api' } },
        { id: 'api-3', data: { name: 'Billing API', type: 'api' } },
        { id: 'db-1', data: { name: 'Postgres', type: 'database' } },
        { id: 'db-2', data: { name: 'Replica', type: 'database' } },
        { id: 'cache-1', data: { name: 'Redis', type: 'cache' } }
    ],
    edges: [
        { from: 'web-1', to: 'api-1' },
        { from: 'web-1', to: 'api-2' },
        { from: 'web-2', to: 'api-1' },
        { from: 'api-2', to: 'api-3' },
        { from: 'api-1', to: 'cache-1' },
        { from: 'api-2', to: 'db-1' },
        { from: 'api-3', to: 'db-1' },
        { from: 'db-1', to: 'db-2' }
    ]
}
// #endregion data

// #region legend
// import { ColorPaletteMapper } from 'pivotick'

// The consumer owns the colours — here a palette mapper over `type`, exactly as in
// the "Color by category" card. The legend never assigns a colour.
const palette = new ColorPaletteMapper('okabe-ito')

// `key` is all a legend needs: it collects the distinct values of `data.type`,
// reads each swatch out of the colour the renderer resolved, counts the nodes
// behind it, and makes every row a filter toggle.
//
// You can also leave `UI.legend` out entirely: with a `render.nodeTypeAccessor`
// declared, a legend appears by itself as soon as that dimension is shown to
// explain the colours. `UI.legend: false` opts out.
const legend = {
    key: 'type',
    title: 'Service type',
    // Every one of these is a default — spelled out here to show the knobs.
    position: 'bottom-left',
    showCounts: true,
    collapsible: true,
    filterable: true,
    maxVisibleEntries: 12
}
// #endregion legend

// #region options
const options = {
    UI: {
        // The legend is chrome: `full` and `light` modes have it, `viewer` and
        // `static` don't. Full mode also ships the Graph Filters panel, which the
        // legend below shares a filter with.
        mode: 'full',
        legend,
        // Declaring a facet under the *same key* the legend uses makes the two one
        // control: toggle a swatch and the panel's multiselect follows, and the
        // other way round. (The trade-off: an empty multiselect means "no
        // constraint" to the panel, so the legend won't let you switch off the last
        // remaining category.)
        filter: {
            facets: [
                {
                    key: 'type', label: 'Service type', type: 'multiselect',
                    options: (graph) => [...new Set(graph.getNodes().map((node) => node.getData().type))]
                        .sort().map((value) => ({ label: value, value }))
                }
            ]
        }
    },
    render: {
        defaultNodeStyle: {
            size: 15,
            strokeColor: '#ffffff',
            textColor: '#334155',
            text: (node) => node.getData()?.name,
            textVerticalShift: -1.8,
            color: (node) => palette.getColor(node.getData()?.type)
        }
    }
}
// #endregion options

// #region control
// The legend announces every toggle on the data bus, so the choice can be
// persisted, mirrored elsewhere, or logged.
function watchLegend(graph) {
    graph.on('legendToggle', ({ hidden, visible }) => {
        console.log(`legend: showing ${visible.join(', ') || '(none)'} — hiding ${hidden.join(', ') || '(none)'}`)
    })
}

// Swap the legend at runtime — a graph that started without one gets it built on
// the spot, and `undefined` removes it (clearing its filter with it).
function legendByType(graph) {
    graph.setLegend({ key: 'type', title: 'Service type' })
}

function removeLegend(graph) {
    graph.setLegend(false)
}

// Declared entries, for when the categories aren't a plain data key: supply the
// label, the colour and the predicate yourself. An array works too; a function is
// re-resolved whenever the data changes.
function legendByTier(graph) {
    graph.setLegend({
        title: 'Tier',
        entries: [
            {
                id: 'edge', label: 'Edge', color: '#0072B2',
                predicate: (node) => node.getData().type === 'web'
            },
            {
                id: 'service', label: 'Services', color: '#E69F00',
                predicate: (node) => node.getData().type === 'api'
            },
            {
                id: 'storage', label: 'Storage', color: '#009E73',
                predicate: (node) => ['database', 'cache'].includes(node.getData().type)
            }
        ]
    })
}
// #endregion control

export { data, options, watchLegend, legendByType, legendByTier, removeLegend }
