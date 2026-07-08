// #region data
const data = {
    nodes: [
        { id: 'core' },
        { id: 'api' },
        { id: 'web' },
        { id: 'mobile' },
        { id: 'auth' },
        { id: 'billing' },
        { id: 'search' },
        { id: 'index' },
        { id: 'queue' },
        { id: 'worker' },
        { id: 'db' },
        { id: 'cache' },
        { id: 'cdn' },
        { id: 'logs' }
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
        // Centering pull for connected nodes (the ones with edges). Defaults to a
        // tiny 0.001 so links + repulsion find their own balance; raise it to gather
        // the graph toward the middle instead of letting it sprawl. Lower = looser
        // and airier; higher = a tighter ball.
        d3GravityStrengthConnected: 0.05,
        // The pull for isolated, edge-less nodes (default 0.1) is a separate knob —
        // d3GravityStrength — so a lone node still can't drift off on its own.
        d3GravityStrength: 0.1
    }
}
// #endregion options

export { data, options }
