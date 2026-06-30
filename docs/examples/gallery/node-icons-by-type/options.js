// #region data
const data = {
    nodes: [
        { id: 'visitor', data: { name: 'Visitor', type: 'user' } },
        { id: 'cdn', data: { name: 'CDN', type: 'cloud' } },
        { id: 'web', data: { name: 'Web', type: 'server' } },
        { id: 'api', data: { name: 'API', type: 'server' } },
        { id: 'db', data: { name: 'Postgres', type: 'database' } }
    ],
    edges: [
        { from: 'visitor', to: 'cdn' },
        { from: 'cdn', to: 'web' },
        { from: 'web', to: 'api' },
        { from: 'api', to: 'db' }
    ]
}
// #endregion data

// #region options
// Inline SVGs use `fill="currentColor"`, which resolves to the node's strokeColor.
const icons = {
    user: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-4.4 0-8 2.2-8 5v1h16v-1c0-2.8-3.6-5-8-5z"/></svg>',
    cloud: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 18H6a4 4 0 0 1-.6-7.95A5.5 5.5 0 0 1 16.5 9 4.5 4.5 0 0 1 19 18z"/></svg>',
    server: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h16a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm0 10h16a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1zM7 6.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm0 10a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/></svg>',
    database: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c-4.4 0-8 1.3-8 3v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5c0-1.7-3.6-3-8-3zm6 17c0 .5-2.4 1.8-6 1.8S6 19.5 6 19v-2.7c1.5.9 3.8 1.4 6 1.4s4.5-.5 6-1.4V19zm0-5c0 .5-2.4 1.8-6 1.8S6 14.5 6 14v-2.7c1.5.9 3.8 1.4 6 1.4s4.5-.5 6-1.4V14zm-6-4.2C8.4 9.8 6 8.5 6 8s2.4-1.8 6-1.8S18 7.5 18 8s-2.4 1.8-6 1.8z"/></svg>'
}

const options = {
    render: {
        nodeTypeAccessor: (node) => node.getData()?.type,
        nodeStyleMap: {
            user: { color: '#64748b', svgIcon: icons.user },
            cloud: { color: '#9333ea', svgIcon: icons.cloud },
            server: { color: '#2563eb', svgIcon: icons.server },
            database: { color: '#16a34a', svgIcon: icons.database }
        },
        defaultNodeStyle: {
            size: 22,
            strokeColor: '#ffffff',
            strokeWidth: 2,
            textColor: '#334155',
            text: (node) => node.getData()?.name,
            textVerticalShift: -1.6
        }
    }
}
// #endregion options

export { data, options }
