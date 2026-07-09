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
        { from: 'alice', to: 'bob', data: { label: 'mentors' } }
    ]
}
// #endregion data

// #region options
// `ctx.promptLabel(...)` (handed to the before-create hook) asks the user for a
// label while the connect gesture is still pending, then feeds it into the new
// edge's data. Pick the UI per event: `mode: 'modal'` opens a dialog, `'inline'`
// drops a small field at the edge's midpoint. A cancel resolves to `null` — return
// `false` to create nothing.
const options = {
    UI: { mode: 'full' },
    callbacks: {
        onBeforeEdgeCreate: async (ctx) => {
            // Drag-to-connect is quick and mouse-driven → inline; a deliberate
            // click-click connect → a modal. Any per-event rule works here.
            const mode = ctx.origin === 'drag' ? 'inline' : 'modal'

            const label = await ctx.promptLabel({ mode, placeholder: 'Relationship…' })
            if (label === null) return false // user cancelled — nothing is created

            return { accept: true, data: { label }, directed: true }
        }
    }
}
// #endregion options

// Or, with no callback at all, let every new edge prompt for its label:
//   UI: { editors: { edgeEditor: { labelPrompt: 'inline' } } }   // or 'modal'

// Demo plumbing (not part of the API you copy): pin the nodes into a compact layout
// so there's room to connect. In your app the force layout positions nodes for you.
let graph = null
const layout = {
    alice: [-30, -60],
    bob: [-120, 20],
    carol: [50, 20],
    dave: [-40, 110],
    erin: [110, -30]
}

async function onLoaded(g) {
    graph = g
    graph.on('edgeAdd', (edge) => {
        graph.notifier.success('Edge created', `${edge.from.getData().label} → ${edge.to.getData().label}: ${edge.getData().label ?? '(no label)'}`)
    })
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
