// #region data
// A seed graph the stream grows from.
const data = {
    nodes: [
        { id: 'src', data: { label: 'source' } },
        { id: 'evt-1', data: { label: 'evt-1' } },
        { id: 'evt-2', data: { label: 'evt-2' } },
        { id: 'evt-3', data: { label: 'evt-3' } },
        { id: 'evt-4', data: { label: 'evt-4' } },
        { id: 'evt-5', data: { label: 'evt-5' } }
    ],
    edges: [
        { from: 'src', to: 'evt-1' },
        { from: 'evt-1', to: 'evt-2' },
        { from: 'src', to: 'evt-3' },
        { from: 'evt-3', to: 'evt-4' },
        { from: 'evt-2', to: 'evt-5' }
    ]
}
// #endregion data

// #region stream
// updateData(nodes, edges) merges a batch into the graph — matching ids are
// updated, new ones added — in a single change event. Here a timer streams in one
// node + edge per tick, prunes the oldest to hold a window, and re-fits the camera
// so the moving graph stays framed. (Guarded by onUnmountedCallback in the page so
// it never outlives the graph.)
let timer = null
let seq = 5

function startStreaming(graph) {
    timer = setInterval(() => {
        const nodes = graph.getNodes()
        const recent = nodes.slice(-6)
        const parent = recent[Math.floor(Math.random() * recent.length)]
        const id = `evt-${++seq}`

        graph.updateData([{ id, data: { label: id } }], [{ from: parent.id, to: id }])

        // hold a rolling window: once past ~14 nodes, remove the oldest event
        const events = nodes.map((n) => n.id).filter((x) => x !== 'src')
        if (events.length > 13) graph.removeNode(events[0])

        // reheat so the newcomer and its neighbours settle into place, then re-fit
        graph.simulation.reheat(0.5)
        graph.renderer.fitAndCenter()
    }, 1400)
}

function stopStreaming() {
    if (timer) clearInterval(timer)
    timer = null
}
// #endregion stream

// #region react
// updateData (and add/removeNode) emit dataBatchChanged — the hook for keeping your
// own state, a persistence layer, or a live counter in sync. Returns an unsubscribe.
function onDataChange(graph, report) {
    const handler = () => report(graph.getNodes().length)
    graph.on('dataBatchChanged', handler)
    return () => graph.off('dataBatchChanged', handler)
}
// #endregion react

export { data, startStreaming, stopStreaming, onDataChange }
