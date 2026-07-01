// #region data
const data = {
    nodes: [
        { id: 'alice', data: { label: 'Alice' } },
        { id: 'bob', data: { label: 'Bob' } },
        { id: 'carol', data: { label: 'Carol' } },
        { id: 'dave', data: { label: 'Dave' } },
        { id: 'erin', data: { label: 'Erin' } }
    ],
    edges: [
        { from: 'alice', to: 'bob' },
        { from: 'alice', to: 'carol' }
    ]
}
// #endregion data

// Demo plumbing: capture the graph instance once it's ready (see onLoaded below).
let graph = null

// #region options
// Edge creation lives in the full UI mode. Turn it on and the toolbar's
// Edit Graph → Add Edge starts a click-click (or drag) connect session — the
// shadow-edge preview and both interaction styles come for free.
const options = {
    UI: { mode: 'full' }
}
// #endregion options

// Demo plumbing (not part of the API you copy): pin the nodes into a stable, compact
// layout — with a couple already linked — so there's room to add the rest. In your
// app the force layout positions nodes for you.
const layout = {
    alice: [-30, -60],
    bob: [-120, 20],
    carol: [50, 20],
    dave: [-40, 110],
    erin: [110, -30]
}

async function onLoaded(g) {
    graph = g
    // React to edges as they're created via the data event bus (fires for any add,
    // however it originates).
    graph.on('edgeAdd', (edge) => {
        graph.notifier.success('Edge created', `${edge.from.getData().label} → ${edge.to.getData().label}`)
    })
    Object.entries(layout).forEach(([id, [x, y]]) => {
        const node = graph.getMutableNode(id)
        if (node) {
            node.x = x
            node.y = y
            node.freeze()
        }
    })
    graph.simulation.reheat()
    await graph.simulation.waitForSimulationStop()
    graph.renderer.fitAndCenter()
}

export { data, options, onLoaded }
