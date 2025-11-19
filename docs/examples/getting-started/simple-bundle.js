const container = document.getElementById('graph-container')
const data = {
    nodes: [
        { id: 1, data: { label: 'A' } },
        { id: 2, data: { label: 'B' } }
    ],
    edges: [
        { from: 1, to: 2 }
    ]
}

// Pivotick global is your main Graph class
const graph = new Pivotick(
    container,
    data
)

graph.addNode({ id: 3, data: { label: 'C' } })
graph.addEdge({ from: 2, to: 3 })