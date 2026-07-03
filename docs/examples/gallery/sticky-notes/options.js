// #region notes
// Free-floating annotations placed in graph coordinates. `attachedElement` ties a
// note to a node so a connector line tracks it as the graph moves.
const notes = [
    {
        id: 'welcome',
        content: 'Drag me around — I float above the graph.',
        color: '#FDE68A',
        x: -70,
        y: -220,
        width: 240,
        height: 120
    },
    {
        id: 'callout',
        content: 'Pinned to Carol — drag her and I follow.',
        color: '#93C5FD',
        x: 80,
        y: 40,
        width: 210,
        height: 150,
        attachedElement: { type: 'node', id: 'carol' }
    }
]
// #endregion notes

// #region data
const data = {
    nodes: [
        { id: 'alice', data: { label: 'Alice' } },
        { id: 'bob', data: { label: 'Bob' } },
        { id: 'carol', data: { label: 'Carol' } },
        { id: 'dave', data: { label: 'Dave' } },
        { id: 'erin', data: { label: 'Erin' } }
    ],
    edges: [
        { from: 'alice', to: 'bob' },
        { from: 'alice', to: 'carol' },
        { from: 'carol', to: 'dave' },
        { from: 'erin', to: 'alice' }
    ],
    notes // free-floating annotations (see the Notes tab)
}
// #endregion data

// Instant fit (no zoom animation) so the attached-note connector settles at its
// final on-screen position in one pass.
const options = { render: { zoomAnimation: false } }

// Demo plumbing (not part of the API you copy): pin the nodes into a stable, compact
// layout so the notes sit beside them and the attached connector lands cleanly. In
// your app the force layout positions nodes for you.
const layout = {
    alice: [-150, 20],
    bob: [-70, -60],
    carol: [-30, 70],
    dave: [-120, 120],
    erin: [-200, -70]
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
    // A second settle after the fit lets the tick-driven redraw place the
    // attached-note connector at its final on-screen position.
    graph.simulation.reheat()
    await graph.simulation.waitForSimulationStop()
}

export { data, options, onLoaded }
