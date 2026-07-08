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
// Tooltips ramp from easy to full control — pick the level you need.
const options = {
    UI: {
        tooltip: {
            // 1 — remap the tooltip's title & subtitle from your data:
            nodeHeaderMap: {
                title: (node) => node.getData().label,
                subtitle: (node) => `${node.getData().role} · ${node.getData().team}`
            },
            // 2 — keep the default tooltip and append your own content (shown live):
            renderNodeExtra: (node) => {
                const d = node.getData()
                return `<div style="margin-top:6px;font-size:12px;opacity:.85">⭐ ${d.commits} commits</div>`
            }
            // 3 — take over the whole tooltip (uncomment to override 1 & 2):
            // render: (node) => {
            //     const d = node.getData()
            //     return `<strong>${d.label}</strong> — ${d.role}`
            // }
        }
    }
}
// #endregion options

export { data, options }
