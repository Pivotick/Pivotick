// #region data
const data = {
    nodes: [
        { id: 'maya', data: { name: 'Maya', role: 'lead' } },
        { id: 'raj', data: { name: 'Raj', role: 'engineer' } },
        { id: 'omar', data: { name: 'Omar', role: 'engineer' } },
        { id: 'lena', data: { name: 'Lena', role: 'designer' } },
        { id: 'theo', data: { name: 'Theo', role: 'designer' } }
    ],
    edges: [
        { from: 'maya', to: 'raj' },
        { from: 'maya', to: 'omar' },
        { from: 'maya', to: 'lena' },
        { from: 'lena', to: 'theo' },
        { from: 'raj', to: 'omar' }
    ]
}
// #endregion data

// #region options
const options = {
    render: {
        // Pick a style-map key from each node…
        nodeTypeAccessor: (node) => node.getData()?.role,
        // …then style every node of that type identically.
        nodeStyleMap: {
            lead: { shape: 'hexagon', color: '#e11d48', size: 22 },
            engineer: { shape: 'circle', color: '#2563eb', size: 16 },
            designer: { shape: 'square', color: '#16a34a', size: 16 }
        },
        // Labels are shared, so they live on the default style.
        defaultNodeStyle: {
            textColor: '#334155',
            text: (node) => node.getData()?.name,
            textVerticalShift: -1.5
        }
    }
}
// #endregion options

export { data, options }
