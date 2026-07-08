// #region data
const data = {
    nodes: [
        { id: 'ana', data: { label: 'Ana' } },
        { id: 'ben', data: { label: 'Ben' } },
        { id: 'cleo', data: { label: 'Cleo' } },
        { id: 'dan', data: { label: 'Dan' } }
    ],
    edges: [
        { from: 'ana', to: 'ben' },
        { from: 'ben', to: 'cleo' },
        { from: 'cleo', to: 'dan' },
        { from: 'ana', to: 'cleo' }
    ]
}
// #endregion data

// #region options
const options = {}
// #endregion options

export { data, options }
