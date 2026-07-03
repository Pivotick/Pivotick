// #region data
const data = {
    nodes: [
        { id: 'alice' },
        { id: 'bob' },
        { id: 'carol' },
        { id: 'dave' },
        { id: 'erin' },
        { id: 'frank' }
    ],
    edges: [
        { from: 'alice', to: 'bob' },
        { from: 'alice', to: 'carol' },
        { from: 'bob', to: 'dave' },
        { from: 'carol', to: 'dave' },
        { from: 'dave', to: 'erin' },
        { from: 'erin', to: 'frank' }
    ]
}
// #endregion data

// #region options
// Every interaction callback receives the relevant Node/Edge (and the DOM event).
// In a real app you'd act on these directly; here each one is forwarded to the
// page's event log.
function createOptions(onEvent) {
    return {
        callbacks: {
            onNodeClick: (event, node) => onEvent('click', `node ${node.id}`),
            onNodeHoverIn: (event, node) => onEvent('hover in', `node ${node.id}`),
            onNodeHoverOut: (event, node) => onEvent('hover out', `node ${node.id}`),
            onNodeSelect: (node) => onEvent('select', `node ${node.id}`),
            onEdgeClick: (event, edge) => onEvent('click', `edge ${edge.id}`),
            onCanvasClick: () => onEvent('canvas', 'background click'),
            onCanvasZoom: () => onEvent('canvas', 'zoom / pan')
            // onSimulationTick fires on every animation frame — far too noisy to
            // log. Use the throttled onSimulationSlowTick if you need a heartbeat.
        }
    }
}
// #endregion options

export { data, createOptions }
