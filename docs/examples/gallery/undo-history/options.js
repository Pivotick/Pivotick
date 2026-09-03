// #region data
const data = {
    nodes: [
        { id: 'gw', data: { label: 'gateway-01', kind: 'Host' } },
        { id: 'db', data: { label: 'orders-db', kind: 'Database' } },
        { id: 'api', data: { label: 'orders-api', kind: 'Service' } },
        { id: 'cache', data: { label: 'session-cache', kind: 'Service' } },
        { id: 'job', data: { label: 'nightly-export', kind: 'Job' } },
        { id: 'sftp', data: { label: 'partner-sftp', kind: 'Host' } }
    ],
    edges: [
        { from: 'gw', to: 'api', data: { label: 'routes' } },
        { from: 'api', to: 'db', data: { label: 'reads' } },
        { from: 'api', to: 'cache', data: { label: 'reads' } },
        { from: 'job', to: 'db', data: { label: 'reads' } },
        { from: 'job', to: 'sftp', data: { label: 'writes' } }
    ]
}
// #endregion data

// #region options
// Nothing here switches the history on: `graph.history` records the four kinds of
// composition change on its own, and the two split buttons in the header are wired to
// it. `mode: 'full'` is what brings the header the buttons live in, and the left rail's
// Create tool.
const options = {
    UI: {
        mode: 'full',
        // Off: this card is about the top bar, and `full` mode's minimap and data dock
        // are neither (see the Minimap and Data table cards for those).
        minimap: false,
        table: false
    },
    render: { nodeTypeAccessor: (node) => node.getData().kind }
}
// #endregion options

// #region persisted
// A consumer that writes a change through to its own backend says so, and the entry
// seals: it stays listed, because it is part of how the canvas got this way, but it is
// never reversed — the canvas and the record of truth would disagree.
const writeThrough = {
    callbacks: {
        onBeforeNodeCreate: async (ctx) => {
            const values = await ctx.promptData({
                fields: [{ key: 'label', label: 'Name', type: 'text' }]
            })
            if (!values) return false
            const saved = await myBackend.create(values)
            return { accept: true, id: saved.uuid, data: values, persisted: true }
        }
    }
}
// #endregion persisted

export { data, options }
