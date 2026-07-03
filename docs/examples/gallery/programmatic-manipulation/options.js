// #region data
const data = {
    nodes: [
        { id: 'core', data: { label: 'core' } },
        { id: 'alpha', data: { label: 'alpha' } },
        { id: 'beta', data: { label: 'beta' } },
        { id: 'gamma', data: { label: 'gamma' } }
    ],
    edges: [
        { from: 'core', to: 'alpha' },
        { from: 'core', to: 'beta' },
        { from: 'core', to: 'gamma' }
    ]
}
// #endregion data

// #region api
// Everything the UI and editing tools do is a public method on the graph. Pass raw
// { id, data } / { from, to } objects — the graph normalizes them for you.
let seq = 0
const added = []

// addNode + addEdge, then reheat so the force layout re-settles with the newcomer.
function addNode(graph) {
    const id = `task-${++seq}`
    graph.addNode({ id, data: { label: id } })
    graph.addEdge({ from: 'core', to: id })
    added.push(id)
    graph.simulation.reheat()
}

// removeNode also drops every edge connected to it — one call, clean teardown.
function removeNode(graph) {
    const id = added.pop()
    if (!id) return
    graph.removeNode(id)
    graph.simulation.reheat(0.3)
}

// selectElement drives the same selection the user gets by clicking. It needs the
// live node instance, so resolve it with getMutableNode first.
function selectCore(graph) {
    const core = graph.getMutableNode('core')
    if (core) graph.selectElement(core)
}
// #endregion api

export { data, addNode, removeNode, selectCore }
