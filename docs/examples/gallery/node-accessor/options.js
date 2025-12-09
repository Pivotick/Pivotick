// #region data
const data = {
    nodes: [
        { id: 1, data: { label: 'A', type: 'hub' } },
        { id: 2, data: { label: 'B', type: 'spoke' } }
    ],
    edges: [{ from: 1, to: 2, data: { label: 'edge1' } }]
}
// #endregion data

// #region options
const options = {
    render: {
        nodeTypeAccessor: (node) => node.getData()?.type,
        nodeStyleMap: {
            'hub': { shape: 'hexagon', color: '#f90', size: 25 },
            'spoke': { shape: 'triangle', color: '#09f' }
        },
    },
}
// #endregion options

export { data, options }