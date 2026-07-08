// #region data
// Each edge overrides only its markers, so the rest comes from defaultEdgeStyle.
const data = {
    nodes: [
        { id: 'a', data: { label: 'A' } },
        { id: 'b', data: { label: 'B' } },
        { id: 'c', data: { label: 'C' } },
        { id: 'd', data: { label: 'D' } }
    ],
    edges: [
        { from: 'a', to: 'b', data: { label: 'arrow' }, style: { edge: { markerEnd: 'arrow' } } },
        { from: 'b', to: 'c', data: { label: 'circle' }, style: { edge: { markerEnd: 'circle' } } },
        { from: 'c', to: 'd', data: { label: 'diamond' }, style: { edge: { markerEnd: 'diamond' } } },
        { from: 'd', to: 'a', data: { label: 'start + end' }, style: { edge: { markerStart: 'circle', markerEnd: 'arrow' } } }
    ]
}
// #endregion data

// #region options
const options = {
    render: {
        defaultEdgeStyle: {
            strokeColor: '#94a3b8',
            strokeWidth: 2,
            curveStyle: 'straight',
            markerEnd: 'arrow'
        },
        defaultLabelStyle: {
            fontSize: 11,
            color: '#475569'
        },
        defaultNodeStyle: {
            size: 13,
            color: '#cbd5e1',
            strokeColor: '#94a3b8',
            textColor: '#334155',
            text: (node) => node.getData()?.label
        }
    }
}
// #endregion options

export { data, options }
