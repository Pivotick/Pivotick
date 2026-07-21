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
// The before-create hook picks the UI per gesture. A quick **drag** gets a free-text
// field inline at the edge midpoint (`ctx.promptLabel`); a deliberate **click-click**
// connect gets a modal with a dropdown of predefined labels (`ctx.promptData`). Both
// feed the chosen text into the new edge's `data.label`; a cancel (`null`) creates
// nothing.
const RELATIONSHIP_LABELS = [
    { value: 'mentors', label: 'mentors' },
    { value: 'reports to', label: 'reports to' },
    { value: 'collaborates with', label: 'collaborates with' },
    { value: 'manages', label: 'manages' }
]

const options = {
    UI: { mode: 'full' },
    callbacks: {
        onBeforeEdgeCreate: async (ctx) => {
            if (ctx.origin === 'drag') {
                // Drag → quick inline free-text field.
                const label = await ctx.promptLabel({ mode: 'inline', placeholder: 'Relationship…' })
                if (label === null) return false
                return { accept: true, data: { label }, directed: true }
            }

            // Click-click → modal with a dropdown of predefined labels.
            const values = await ctx.promptData({
                title: 'Label the connection',
                submitLabel: 'Create edge',
                fields: [
                    {
                        key: 'label',
                        label: 'Relationship',
                        type: 'select',
                        defaultValue: 'mentors',
                        options: RELATIONSHIP_LABELS
                    }
                ]
            })
            if (values === null) return false
            return { accept: true, data: { label: values.label }, directed: true }
        }
    }
}
// #endregion options

// With no callback at all, the static option prompts for a free-text label on every
// edge:  UI: { editors: { edgeEditor: { labelPrompt: 'inline' } } }   // or 'modal'

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
