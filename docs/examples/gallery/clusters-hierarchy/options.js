// #region data
// A node becomes a cluster by giving it `children` — full nodes in their own
// right. `expanded: false` starts it collapsed (rendered as a single node); the
// members and their edges appear when it opens. Edges are always declared at the
// top level, whether they cross clusters or stay inside one.
const data = {
    nodes: [
        { id: 'core', data: { label: 'core' } },
        {
            id: 'group-a',
            data: { label: 'Group A' },
            expanded: false,
            children: [
                { id: 'a1', data: { label: 'a1' } },
                { id: 'a2', data: { label: 'a2' } },
                { id: 'a3', data: { label: 'a3' } }
            ]
        },
        {
            id: 'group-b',
            data: { label: 'Group B' },
            expanded: false,
            children: [
                { id: 'b1', data: { label: 'b1' } },
                { id: 'b2', data: { label: 'b2' } },
                { id: 'b3', data: { label: 'b3' } }
            ]
        }
    ],
    edges: [
        { from: 'core', to: 'a1' },
        { from: 'a1', to: 'a2' },
        { from: 'a2', to: 'a3' },
        { from: 'core', to: 'b1' },
        { from: 'b1', to: 'b2' },
        { from: 'b2', to: 'b3' },
        // Crosses two cluster boundaries: re-targets to whatever's on screen
        // (group-a → group-b collapsed, a3 → group-b once A opens, and so on).
        { from: 'a3', to: 'b1' }
    ]
}
// #endregion data

// #region options
// enableNodeExpansion (on by default) draws the +/- affordance on clusters and
// makes them clickable. A collapsed cluster shows one node with synthetic edges to
// it; expanding lays its members out in a bubble and reveals their real edges.
const options = {
    render: { enableNodeExpansion: true }
}
// #endregion options

// #region expand
// The same toggle programmatically: fetch the cluster node and hand it to
// toggleExpandNode. node.expanded tells you the current state.
function toggleCluster(graph, id) {
    const node = graph.getMutableNode(id)
    if (node) graph.toggleExpandNode(node)
}

function setAllExpanded(graph, expanded) {
    const clusters = ['group-a', 'group-b']
    clusters.forEach((id) => {
        const node = graph.getMutableNode(id)
        if (node && !!node.expanded !== expanded) graph.toggleExpandNode(node)
    })
}
// #endregion expand

// Demo plumbing: open one cluster on load so the collapsed/expanded contrast is
// visible right away.
async function onLoaded(graph) {
    const a = graph.getMutableNode('group-a')
    if (a) graph.toggleExpandNode(a)
    await graph.simulation.waitForSimulationStop()
    // Fit once the expanded cluster's bubble/subgraph has settled, not off the
    // transient bbox that exists for a few frames right after the sim stops.
    graph.renderer.fitAndCenterWhenSettled()
}

export { data, options, toggleCluster, setAllExpanded, onLoaded }
