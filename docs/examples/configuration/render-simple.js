const data = {
    nodes: [
        { id: 1, data: { label: 'A', type: 'hub' } },
        { id: 2, data: { label: 'B', type: 'spoke' } }
    ],
    edges: [{ from: 1, to: 2, data: { label: 'edge1' } }]
}

// #region options
const options = {
    render: {
        defaultNodeStyle: {
            shape: 'square',
            size: 4,
            color: '#007acc',
            textColor: '#fff',
            strokeWidth: 0,
        },
        defaultEdgeStyle: {
            markerStart: 'circle',
            markerEnd: 'arrow',
        },
        defaultLabelStyle: {
            fontSize: '6px',
        },
    }
}
// #endregion options

export { data, options }