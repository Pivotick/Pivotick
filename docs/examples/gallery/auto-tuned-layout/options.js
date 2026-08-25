// #region data
// A small seed graph — small enough that fixed force settings would leave it
// huddled in the middle of the canvas.
const data = {
    nodes: [
        { id: 'core', data: { label: 'core' } },
        { id: 'api', data: { label: 'api' } },
        { id: 'web', data: { label: 'web' } },
        { id: 'db', data: { label: 'db' } },
        { id: 'queue', data: { label: 'queue' } }
    ],
    edges: [
        { from: 'web', to: 'api' },
        { from: 'api', to: 'core' },
        { from: 'core', to: 'db' },
        { from: 'core', to: 'queue' }
    ]
}
// #endregion data

// #region options
// Nothing here configures a force, so the layout tunes itself — that is the
// default. `physics: 'auto'` is spelled out only because the documentation
// gallery pins every other example to `'manual'` for stable screenshots.
//
// Setting any force option instead (d3LinkDistance, d3ManyBodyStrength,
// d3CollideRadiusMultiplier, d3VelocityDecay, d3GravityStrength,
// d3GravityStrengthConnected, d3AlphaDecay, cooldownTime) would keep your value
// and switch the tuning off for that graph.
const options = {
    simulation: { physics: 'auto' }
}
// #endregion options

// #region grow
// Auto re-tunes on every visible change to the graph, so growing it is all it
// takes to watch the knobs move. Triggers arriving together are coalesced into a
// single pass, and a change too small to matter is skipped entirely — so a pivot
// that adds forty nodes costs one relayout, not forty.
let seq = 0

function addBatch(graph, size = 20) {
    const existing = graph.getNodes()
    const nodes = []
    const edges = []
    for (let i = 0; i < size; i++) {
        const id = `n-${++seq}`
        const pool = existing.concat(nodes)
        const parent = pool[Math.floor(Math.random() * pool.length)]
        nodes.push({ id, data: { label: id } })
        edges.push({ from: parent.id, to: id })
    }
    graph.updateData(nodes, edges)
}

function reset(graph) {
    for (const node of graph.getNodes()) {
        if (!data.nodes.some((seed) => seed.id === node.id)) graph.removeNode(node.id)
    }
    seq = 0
}
// #endregion grow

// #region knobs
// Auto only ever moves the knobs the Physics flyout exposes, so whatever it
// decided can simply be read back — and overridden by dragging a slider, which
// hands control back to you for good.
function readKnobs(graph) {
    const { repulsion, linkDistance, centering } = graph.simulation.getPhysicsKnobs()
    return {
        nodes: graph.getNodes().length,
        repulsion,
        linkDistance,
        centering,
        auto: graph.simulation.isAutoPhysicsEnabled()
    }
}
// #endregion knobs

export { data, options, addBatch, reset, readKnobs }
