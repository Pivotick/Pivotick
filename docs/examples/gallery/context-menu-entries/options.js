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
// `graph` is your Pivotick instance. A menu item's onclick receives the Node/Edge
// it was opened on; here each action pops a notification. Any SVG string works as
// an icon.
const infoIcon = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 11v4M12 7.5h.01"/></svg>'

const options = {
    UI: {
        contextMenu: {
            // Right-click a node:
            menuNode: {
                topbar: [
                    {
                        text: 'Details',
                        svgIcon: infoIcon,
                        variant: 'outline-primary',
                        onclick: (e, node) =>
                            graph.notifier.info(node.getData().label, `${node.getData().role} · ${node.getData().commits} commits`)
                    }
                ],
                menu: [
                    {
                        text: 'Copy ID',
                        variant: 'outline-secondary',
                        onclick: (e, node) => graph.notifier.success('Copied id', node.id)
                    },
                    {
                        text: 'Flag for review',
                        variant: 'danger',
                        // `visible` can be a predicate — only show for contributors:
                        visible: (node) => node.getData().role === 'Contributor',
                        onclick: (e, node) => graph.notifier.warning('Flagged', node.getData().label)
                    }
                ]
            },
            // Right-click an edge:
            menuEdge: {
                menu: [
                    {
                        text: 'Inspect edge',
                        variant: 'outline-primary',
                        onclick: (e, edge) => graph.notifier.info('Edge', edge.id)
                    }
                ]
            },
            // Right-click the background:
            menuCanvas: {
                topbar: [
                    {
                        text: 'New node here',
                        variant: 'outline-primary',
                        onclick: () => graph.notifier.info('Canvas action', 'You right-clicked the background')
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
