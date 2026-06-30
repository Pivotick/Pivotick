// #region data
const data = {
    nodes: [
        { id: 'alice', data: { label: 'Alice' } },
        { id: 'bob', data: { label: 'Bob' } },
        { id: 'carol', data: { label: 'Carol' } },
        { id: 'dave', data: { label: 'Dave' } },
        { id: 'erin', data: { label: 'Erin' } },
        { id: 'frank', data: { label: 'Frank' } }
    ],
    edges: [
        { id: 'e1', from: 'alice', to: 'bob' },
        { id: 'e2', from: 'alice', to: 'carol' },
        { id: 'e3', from: 'bob', to: 'dave' },
        { id: 'e4', from: 'carol', to: 'dave' },
        { id: 'e5', from: 'dave', to: 'erin' },
        { id: 'e6', from: 'erin', to: 'frank' }
    ]
}
// #endregion data

// #region options
// Every interaction callback receives the relevant Node/Edge (and the DOM event).
// In a real app you'd act on these directly; here each one is handed to `onEvent`
// so the page can list them as they fire.
function createOptions(onEvent) {
    return {
        render: {
            defaultNodeStyle: {
                size: 15,
                color: '#6366f1',
                strokeColor: '#ffffff',
                strokeWidth: 2,
                textColor: '#334155',
                text: (node) => node.getData()?.label,
                textVerticalShift: -1.6
            }
        },
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
