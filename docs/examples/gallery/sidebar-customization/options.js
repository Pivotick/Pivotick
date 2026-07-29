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

// #region options
// Reshape the sidebar at three levels: map the header, curate the properties, and
// add your own panels with arbitrary HTML.
const options = {
    UI: {
        // The sidebar is part of the full UI (the default 'viewer' mode ships
        // pan/zoom only); enable it and keep it open so it's visible right away:
        mode: 'full',
        sidebar: { collapsed: false },
        // 1 — map the header's title & subtitle from your data:
        mainHeader: {
            nodeHeaderMap: {
                title: (node) => node.getData().label,
                subtitle: (node) => `${node.getData().role} · ${node.getData().team}`
            }
        },
        // 2 — curate which properties show (instead of every data key):
        propertiesPanel: {
            nodePropertiesMap: (node) => {
                const d = node.getData()
                return [
                    { name: 'Role', value: d.role },
                    { name: 'Team', value: d.team },
                    { name: 'Commits', value: String(d.commits) }
                ]
            }
        },
        // 3 — add your own panel (great for persistent, graph-level context that
        //     sits alongside the per-node panels above). A returned string renders
        //     as text, so build an element when you want your own markup:
        extraPanels: [
            {
                title: 'Team summary',
                render: () => {
                    const people = data.nodes.length
                    const commits = data.nodes.reduce((sum, n) => sum + n.data.commits, 0)
                    const panel = document.createElement('div')
                    panel.style.cssText = 'font-size:12px;line-height:1.7'
                    for (const line of [`${people} people`, `${commits} commits total`]) {
                        const row = document.createElement('div')
                        row.textContent = line
                        panel.append(row)
                    }
                    return panel
                }
            }
        ]
    }
}
// #endregion options

// Demo plumbing: open the sidebar on a node so the customization shows on load.
function onLoaded(graph) {
    const node = graph.getMutableNode('alice')
    if (node) graph.selectElement(node)
}

export { data, options, onLoaded }
