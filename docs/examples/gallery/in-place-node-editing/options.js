// #region data
const data = {
    nodes: [
        { id: 'alice', data: { label: 'Alice', role: 'Maintainer', team: 'Core' } },
        { id: 'bob', data: { label: 'Bob', role: 'Contributor', team: 'Core' } },
        { id: 'carol', data: { label: 'Carol', role: 'Reviewer', team: 'Docs' } },
        { id: 'dave', data: { label: 'Dave', role: 'Contributor', team: 'Docs' } },
        { id: 'erin', data: { label: 'Erin', role: 'Maintainer', team: 'Infra' } }
    ],
    edges: [
        { from: 'alice', to: 'bob' },
        { from: 'alice', to: 'carol' },
        { from: 'carol', to: 'dave' },
        { from: 'erin', to: 'alice' }
    ]
}
// #endregion data

// Demo plumbing: capture the graph instance once it's ready (see onLoaded below).
let graph = null

// #region options
// Editing needs the full UI mode — the default 'viewer' is read-only. Double-click
// opens the built-in edit modal; the two commit hooks below validate and observe it.
const options = {
    UI: { mode: 'full' },
    callbacks: {
        // Open the edit modal on double-click (the toolbar's Edit Graph → Edit does
        // the same). onNodeEdit(session) also lets you return a fully custom body.
        onNodeDbclick: (event, node) => graph.editing.openNodeSession(node),
        // Validation / veto hook — return false to reject the commit and keep the
        // modal open. Here we refuse an empty name.
        onBeforeNodeEditCommit: ({ previousData, nextData }) => {
            if (!nextData.label || !String(nextData.label).trim()) {
                graph.notifier.warning('Name required', 'A node must keep a name.')
                return false
            }
            graph.notifier.success('Node updated', `${previousData.label} → ${nextData.label}`)
            return true
        },
        // Fires when the user cancels the edit.
        onNodeEditCancel: (node) => graph.notifier.info('Edit cancelled', node.getData().label)
    }
}
// #endregion options

function onLoaded(g) {
    graph = g
}

export { data, options, onLoaded }
