// #region data
const data = {
    nodes: [
        { id: 'incident', data: { name: 'Incident', type: 'case', notes: 12, state: 'disputed' } },
        { id: 'host', data: { name: 'web-01', type: 'host', notes: 3 } },
        { id: 'ip', data: { name: '198.51.100.7', type: 'address', notes: 1, state: 'confirmed' } },
        { id: 'hash', data: { name: 'a94f…c2', type: 'file', state: 'disputed' } },
        { id: 'domain', data: { name: 'evil.example', type: 'address' } }
    ],
    edges: [
        { from: 'incident', to: 'host' },
        { from: 'incident', to: 'hash' },
        { from: 'incident', to: 'ip' },
        { from: 'host', to: 'ip' },
        { from: 'ip', to: 'domain' },
        { from: 'hash', to: 'host' }
    ]
}
// #endregion data

// #region options
// Colour, shape and icon are already spent on the node's *type*, so the two extra facts —
// how many notes it carries and whether anyone disputes it — go on badges instead.
const badges = (node) => {
    const { notes, state } = node.getData()
    const list = []
    if (notes) {
        list.push({
            text: String(notes),
            color: '#2563eb',
            title: `${notes} notes`,
            onClick: () => window.alert(`Open the ${notes} notes on ${node.getData().name}`)
        })
    }
    if (state === 'disputed') {
        list.push({ text: '!', color: '#dc2626', title: 'Disputed' })
    }
    if (state === 'confirmed') {
        list.push({ text: '✓', color: '#16a34a', title: 'Confirmed' })
    }
    return list
}

const options = {
    render: {
        nodeTypeAccessor: (node) => node.getData()?.type,
        nodeStyleMap: {
            case: { color: '#7c3aed', size: 30 },
            host: { color: '#0891b2', shape: 'square', size: 24 },
            address: { color: '#f59e0b', size: 22 },
            file: { color: '#64748b', shape: 'hexagon', size: 22 }
        },
        defaultNodeStyle: {
            badges,
            strokeColor: '#ffffff',
            strokeWidth: 2,
            textColor: '#334155',
            text: (node) => node.getData()?.name,
            textVerticalShift: -1.7
        }
    },
    simulation: {
        // Badges add to a node's footprint, so the nodes need more room between them
        // than the defaults give — otherwise a rim badge lands on its neighbour's label.
        d3ManyBodyStrength: -420,
        d3LinkDistance: 105
    }
}
// #endregion options

export { data, options }
