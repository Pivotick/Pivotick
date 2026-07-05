// #region data
const data = {
    nodes: [
        { id: 'src', data: { label: 'Source' } },
        { id: 'etl', data: { label: 'ETL' } },
        { id: 'warehouse', data: { label: 'Store' } },
        { id: 'dashboard', data: { label: 'Report' } },
        { id: 'alerts', data: { label: 'Alerts' } }
    ],
    edges: [
        { from: 'src', to: 'etl', data: { weight: 4, status: 'active' } },
        { from: 'etl', to: 'warehouse', data: { weight: 3, status: 'active' } },
        { from: 'warehouse', to: 'dashboard', data: { weight: 2, status: 'active' } },
        { from: 'warehouse', to: 'alerts', data: { weight: 1, status: 'pending' } },
        { from: 'src', to: 'alerts', data: { weight: 1, status: 'pending' } }
    ]
}
// #endregion data

// #region options
const options = {
    render: {
        defaultEdgeStyle: {
            // Any property can be an (edge) => value accessor.
            strokeColor: (edge) => edge.getData()?.status === 'active' ? '#16a34a' : '#f59e0b',
            strokeWidth: (edge) => 1 + (edge.getData()?.weight ?? 1),
            // Pending links are dashed; the dashes flow on their own.
            dashed: (edge) => edge.getData()?.status === 'pending',
            animateDash: true,
            curveStyle: 'straight',
            markerEnd: 'arrow'
        },
        defaultNodeStyle: {
            size: 13,
            color: '#475569',
            strokeColor: '#ffffff',
            textColor: '#334155',
            text: (node) => node.getData()?.label,
            textVerticalShift: -1.6
        }
    }
}
// #endregion options

export { data, options }
