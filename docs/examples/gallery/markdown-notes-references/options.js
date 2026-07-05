// #region notes
// `content` is Markdown. `[[Name]]` becomes a live node reference — click to select
// the node, hover to highlight it. It matches a node by id or label.
const notes = [
    {
        id: 'release-notes',
        color: '#C4B5FD',
        x: 60,
        y: -180,
        width: 270,
        height: 250,
        content: `# Release 2.0

**Owner:** [[API]]

- [[Frontend]] redesign
- Finish the [[Docs]]
- Cut the [[Release]]

See the [changelog](https://example.com).`
    }
]
// #endregion notes

// #region data
const data = {
    nodes: [
        { id: 'planning', data: { label: 'Planning' } },
        { id: 'design', data: { label: 'Design' } },
        { id: 'api', data: { label: 'API' } },
        { id: 'frontend', data: { label: 'Frontend' } },
        { id: 'docs', data: { label: 'Docs' } },
        { id: 'release', data: { label: 'Release' } }
    ],
    edges: [
        { from: 'planning', to: 'design' },
        { from: 'design', to: 'api' },
        { from: 'design', to: 'frontend' },
        { from: 'api', to: 'docs' },
        { from: 'frontend', to: 'docs' },
        { from: 'docs', to: 'release' }
    ],
    notes // markdown annotations with [[node]] references (see the Notes tab)
}
// #endregion data

const options = {}

// Demo plumbing (not part of the API you copy): pin the nodes into a stable, compact
// layout so the note sits beside the graph. In your app the force layout positions
// nodes for you.
const layout = {
    planning: [-260, 120],
    design: [-190, 40],
    api: [-120, -40],
    frontend: [-250, -40],
    docs: [-110, 60],
    release: [-180, 140]
}

async function onLoaded(graph) {
    Object.entries(layout).forEach(([id, [x, y]]) => {
        const node = graph.getMutableNode(id)
        if (node) {
            node.x = x
            node.y = y
            node.freeze()
        }
    })
    graph.simulation.reheat()
    await graph.simulation.waitForSimulationStop()
    graph.renderer.fitAndCenter()
}

export { data, options, onLoaded }
