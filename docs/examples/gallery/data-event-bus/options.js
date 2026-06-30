// #region data
const data = {
    nodes: [
        { id: 'hub' },
        { id: 'a' },
        { id: 'b' },
        { id: 'c' }
    ],
    edges: [
        { from: 'hub', to: 'a' },
        { from: 'hub', to: 'b' },
        { from: 'hub', to: 'c' }
    ]
}
// #endregion data

// #region events
// The data event bus fires whenever the graph's data changes — whether the
// change came from your code, the built-in UI, or the editing tools. Subscribe
// with graph.on(...); the returned function tears the listeners back down with
// graph.off(...).
function registerEvents(graph, onEvent) {
    const onNodeAdd = (node) => onEvent('nodeAdd', node.id)
    const onNodeRemove = (node) => onEvent('nodeRemove', node.id)
    const onEdgeAdd = (edge) => onEvent('edgeAdd', edge.id)
    const onEdgeRemove = (edge) => onEvent('edgeRemove', edge.id)
    const onBatch = (changes) => onEvent('dataBatchChanged', `${changes.length} change(s)`)

    graph.on('nodeAdd', onNodeAdd)
    graph.on('nodeRemove', onNodeRemove)
    graph.on('edgeAdd', onEdgeAdd)
    graph.on('edgeRemove', onEdgeRemove)
    graph.on('dataBatchChanged', onBatch)

    return () => {
        graph.off('nodeAdd', onNodeAdd)
        graph.off('nodeRemove', onNodeRemove)
        graph.off('edgeAdd', onEdgeAdd)
        graph.off('edgeRemove', onEdgeRemove)
        graph.off('dataBatchChanged', onBatch)
    }
}
// #endregion events

// #region mutate
let seq = 0
const added = []

// Adding a node + its edge fires nodeAdd, edgeAdd and dataBatchChanged.
function addNode(graph) {
    const id = `node-${++seq}`
    graph.addNode({ id })
    graph.addEdge({ from: 'hub', to: id })
    added.push(id)
    graph.simulation.reheat(0.6)
}

// Removing a node also removes its connected edge — so a single call fires
// nodeRemove *and* edgeRemove.
function removeNode(graph) {
    const id = added.pop()
    if (id) {
        graph.removeNode(id)
        graph.simulation.reheat(0.4)
    }
}
// #endregion mutate

export { data, registerEvents, addNode, removeNode }
