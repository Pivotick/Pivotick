// #region data
const data = {
    nodes: [
        { id: 'cto', data: { label: 'CTO' } },
        { id: 'lead', data: { label: 'Lead' } },
        { id: 'dev1', data: { label: 'Dev' } },
        { id: 'dev2', data: { label: 'Dev' } },
        { id: 'design', data: { label: 'Design' } }
    ],
    edges: [
        // rotateLabel can be set per edge: true rotates the label to follow the
        // edge's angle, false keeps it upright. Both are shown here.
        { from: 'lead', to: 'cto', data: { label: 'rotates with edge' }, style: { edge: { rotateLabel: true } } },
        { from: 'dev1', to: 'lead', data: { label: 'reports to' } },
        { from: 'dev2', to: 'lead', data: { label: 'reports to' } },
        { from: 'design', to: 'lead', data: { label: 'stays upright' }, style: { edge: { rotateLabel: false } } }
    ]
}
// #endregion data

// #region options
const options = {
    render: {
        defaultEdgeStyle: {
            strokeColor: '#cbd5e1',
            strokeWidth: 1.5,
            rotateLabel: false, // default; overridden per edge above to show both
            markerEnd: 'arrow'
        },
        // Styling shared by every built-in edge label.
        defaultLabelStyle: {
            fontSize: 11,
            color: '#0f172a',
            backgroundColor: '#f8fafcdd'
        },
        defaultNodeStyle: {
            size: 12,
            color: '#6366f1',
            strokeColor: '#ffffff',
            textColor: '#334155',
            text: (node) => node.getData()?.label,
            textVerticalShift: -1.7
        }
    }
}
// #endregion options

export { data, options }
