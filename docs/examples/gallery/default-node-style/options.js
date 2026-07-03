// #region data
// One node per built-in shape — each overrides only `shape`, so the rest of the
// appearance comes from the shared defaultNodeStyle below.
const data = {
    nodes: [
        { id: 'circle', data: { label: 'circle' }, style: { shape: 'circle' } },
        { id: 'square', data: { label: 'square' }, style: { shape: 'square' } },
        { id: 'triangle', data: { label: 'triangle' }, style: { shape: 'triangle' } },
        { id: 'hexagon', data: { label: 'hexagon' }, style: { shape: 'hexagon' } }
    ],
    edges: [
        { from: 'circle', to: 'square' },
        { from: 'square', to: 'triangle' },
        { from: 'triangle', to: 'hexagon' }
    ]
}
// #endregion data

// #region options
const options = {
    render: {
        // Applied to every node unless its own `style` overrides a field.
        defaultNodeStyle: {
            shape: 'circle',
            size: 18,
            color: '#4f46e5',
            strokeColor: '#ffffff',
            strokeWidth: 2,
            textColor: '#334155',
            // Render each label below its shape (negative shift = below the node).
            text: (node) => node.getData()?.label,
            textVerticalShift: -1.4
        }
    }
}
// #endregion options

export { data, options }
