// #region data
const data = {
    nodes: [
        { id: 'core', data: { label: 'Core' } },
        { id: 'api', data: { label: 'API' } },
        { id: 'web', data: { label: 'Web' } },
        { id: 'mobile', data: { label: 'Mobile' } },
        { id: 'auth', data: { label: 'Auth' } },
        { id: 'billing', data: { label: 'Billing' } },
        { id: 'search', data: { label: 'Search' } },
        { id: 'index', data: { label: 'Index' } },
        { id: 'queue', data: { label: 'Queue' } },
        { id: 'worker', data: { label: 'Worker' } },
        { id: 'db', data: { label: 'Database' } },
        { id: 'cache', data: { label: 'Cache' } },
        { id: 'cdn', data: { label: 'CDN' } },
        { id: 'logs', data: { label: 'Logs' } }
    ],
    edges: [
        { from: 'web', to: 'api' },
        { from: 'mobile', to: 'api' },
        { from: 'api', to: 'core' },
        { from: 'api', to: 'auth' },
        { from: 'api', to: 'billing' },
        { from: 'api', to: 'search' },
        { from: 'search', to: 'index' },
        { from: 'core', to: 'queue' },
        { from: 'queue', to: 'worker' },
        { from: 'worker', to: 'db' },
        { from: 'core', to: 'db' },
        { from: 'api', to: 'cache' },
        { from: 'web', to: 'cdn' },
        { from: 'worker', to: 'logs' },
        { from: 'auth', to: 'db' },
        { from: 'billing', to: 'db' }
    ]
}
// #endregion data

// #region options
const options = {
    layout: { type: 'force' },
    simulation: {
        // Repulsion between every pair of nodes (negative = push apart).
        // Default -150. A stronger push spreads the graph out and untangles
        // dense clusters — raise it when nodes overlap.
        d3ManyBodyStrength: -360,
        // Resting length of each link. Default 30. Longer links give connected
        // nodes more breathing room.
        d3LinkDistance: 70,
        // Centering pull that stops disconnected parts from drifting off-screen.
        // Default 0.1. Lower = looser and airier; higher = a tighter ball.
        d3GravityStrength: 0.05
    },
    render: {
        defaultNodeStyle: {
            size: 14,
            color: '#6366f1',
            strokeColor: '#ffffff',
            strokeWidth: 2,
            textColor: '#334155',
            text: (node) => node.getData()?.label,
            textVerticalShift: -1.6
        }
    }
}
// #endregion options

export { data, options }
