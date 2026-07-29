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
// Multi-selection is built in — pick several nodes and the sidebar shows a bulk-action
// row (Pin / Unpin / Hide / Delete) that acts on the whole selection. `mode: 'full'`
// is what renders the sidebar (and therefore the bulk row).
//
// To react programmatically, use the `onNodesSelect` callback. Its argument only
// carries the nodes involved in *this* change, so read the authoritative current
// selection from the interaction layer instead:
const options = {
    UI: {
        mode: 'full',
        // Keep the sidebar open so the bulk-action row is visible (the embed is
        // short enough that 'auto' would otherwise collapse it).
        sidebar: { collapsed: false }
    },
    callbacks: {
        onNodesSelect: () => {
            const selected = graph.renderer.getGraphInteraction().getSelectedNodes()
            if (selected.length < 2) return
            const labels = selected.map((s) => s.node.getData().label).join(', ')
            graph.notifier.info(`${selected.length} nodes selected`, labels)
        }
    }
}
// #endregion options

function onLoaded(g) {
    graph = g
    // Pre-select two nodes so the sidebar's bulk-action row is on show — the
    // point of this card. Multi-selection needs ≥2 nodes, so select via the
    // interaction API (each entry pairs the node with its rendered element).
    const selection = ['alice', 'bob']
        .map((id) => g.getMutableNode(id))
        .filter(Boolean)
        .map((node) => ({ node, element: node.getGraphElement() }))
        .filter((entry) => entry.element)
    if (selection.length >= 2) {
        g.renderer.getGraphInteraction().selectNodes(selection)
    }
}

export { data, options, onLoaded }
