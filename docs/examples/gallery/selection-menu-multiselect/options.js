// #region data
const data = {
    nodes: [
        { id: 'alice', data: { label: 'Alice', role: 'Maintainer', team: 'Core', commits: 342 } },
        { id: 'bob', data: { label: 'Bob', role: 'Contributor', team: 'Core', commits: 87 } },
        { id: 'carol', data: { label: 'Carol', role: 'Reviewer', team: 'Docs', commits: 45 } },
        { id: 'dave', data: { label: 'Dave', role: 'Contributor', team: 'Docs', commits: 63 } },
        { id: 'erin', data: { label: 'Erin', role: 'Maintainer', team: 'Infra', commits: 210 } }
    ],
    edges: [
        { from: 'alice', to: 'bob', data: { label: 'mentors' } },
        { from: 'alice', to: 'carol', data: { label: 'reviews' } },
        { from: 'carol', to: 'dave', data: { label: 'pairs' } },
        { from: 'erin', to: 'alice', data: { label: 'syncs' } }
    ]
}
// #endregion data

// Demo plumbing: capture the graph instance once it's ready (see onLoaded below).
let graph = null

// #region options
// `graph` is your Pivotick instance. The selection menu appears when several nodes
// are selected; each action's onclick receives the whole array of selected nodes —
// ideal for bulk operations.
const options = {
    UI: {
        // The selection menu is part of the full UI — enable it (the default
        // 'viewer' mode ships pan/zoom only):
        mode: 'full',
        selectionMenu: {
            menuNode: {
                topbar: [
                    {
                        text: 'Summarize',
                        variant: 'outline-primary',
                        onclick: (e, nodes) => graph.notifier.info('Selection', `${nodes.length} nodes selected`)
                    }
                ],
                menu: [
                    {
                        text: 'List selected',
                        variant: 'outline-secondary',
                        onclick: (e, nodes) => graph.notifier.info('Selected', nodes.map((n) => n.getData().label).join(', '))
                    },
                    {
                        text: 'Total commits',
                        variant: 'outline-secondary',
                        onclick: (e, nodes) => graph.notifier.success('Total commits', String(nodes.reduce((sum, n) => sum + n.getData().commits, 0)))
                    }
                ]
            }
        }
    }
}
// #endregion options

function onLoaded(g) {
    graph = g
}

export { data, options, onLoaded }
