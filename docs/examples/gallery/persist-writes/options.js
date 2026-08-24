// #region data
const data = {
    nodes: [
        { id: 'ip-8888', data: { label: '8.8.8.8', type: 'ip-src' } },
        { id: 'dom-evil', data: { label: 'evil.example.com', type: 'domain' } },
        { id: 'md5', data: { label: 'd41d8cd9…f8427e', type: 'md5' } },
        // The server refuses to delete this one — a published record.
        { id: 'file-obj', data: { label: 'invoice.doc', type: 'file', published: true } }
    ],
    edges: [
        { id: 'r1', from: 'file-obj', to: 'md5', data: { label: 'contains' } },
        { id: 'r2', from: 'dom-evil', to: 'ip-8888', data: { label: 'resolves-to' } }
    ]
}
// #endregion data

// Demo plumbing: capture the graph instance (see onLoaded), and stand-ins for a
// backend that takes a moment and can say no.
let graph = null
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const RELATIONSHIPS = ['contains', 'resolves-to', 'derived-from', 'related-to']

// #region options
const options = {
    // Label each attribute with its value, so an edit's effect is visible.
    render: {
        defaultNodeStyle: {
            size: 16,
            textColor: '#334155',
            text: (node) => node.getData()?.label,
            textVerticalShift: -1.6
        }
    },
    UI: {
        mode: 'full',
        // Off: `full` mode brings a minimap and the data dock, and this card is about
        // neither (see the Minimap and Data table cards for those).
        minimap: false,
        table: false,
        // Give the edge editor a relationship dropdown instead of a free-text field.
        editors: {
            edgeEditor: {
                fields: [{
                    key: 'label',
                    label: 'Relationship',
                    type: 'select',
                    options: RELATIONSHIPS.map((value) => ({ value, label: value }))
                }]
            }
        }
    },
    callbacks: {
        // Nothing leaves the model until the server agrees. The library resolves the
        // whole target set first — including `cascadingEdges`, the relationships that
        // removing a node would take with it — so you can persist the real consequence.
        onBeforeDelete: async ({ nodes, edges, cascadingEdges, origin, confirm }) => {
            const links = edges.length + cascadingEdges.length
            const ok = await confirm({
                title: 'Delete from event?',
                body: `${nodes.length} attribute(s) and ${links} relationship(s) will be `
                    + `deleted server-side. (asked from the ${origin})`,
                confirmLabel: 'Delete'
            })
            if (!ok) return false

            graph.notifier.info('Saving…', 'POST /events/delete')
            await wait(700) // a backend call that could fail

            // The server refused the published record: keep exactly what it deleted.
            const refused = nodes.filter((node) => node.getData().published)
            if (refused.length) {
                graph.notifier.warning('Kept', `${refused[0].getData().label} is published — not deleted.`)
            }
            return { accept: true, nodes: nodes.filter((node) => !node.getData().published) }
        },

        // Create ▸ Add node, or the canvas menu's "Add Node Here". `promptData` opens a
        // form; the id/data you return is what enters the graph.
        onBeforeNodeCreate: async ({ position, promptData }) => {
            const values = await promptData({
                title: 'New attribute',
                fields: [
                    { key: 'label', label: 'Value', type: 'text' },
                    {
                        key: 'type', label: 'Type', type: 'select', defaultValue: 'ip-src',
                        options: ['ip-src', 'domain', 'md5', 'url'].map((v) => ({ value: v, label: v }))
                    }
                ]
            })
            if (!values) return false // cancelled

            graph.notifier.info('Saving…', 'POST /attributes/add')
            await wait(500)
            graph.notifier.success('Created', `${values.label} at ${Math.round(position.x)},${Math.round(position.y)}`)
            return { accept: true, id: `attr-${values.label}`, data: values }
        },

        // Right-click an edge ▸ Edit Edge. The commit is a proposal too: refuse it and
        // the edge keeps its data, with the modal still open to correct.
        onBeforeEdgeEditCommit: async ({ previousData, nextData }) => {
            if (!RELATIONSHIPS.includes(nextData.label)) {
                graph.notifier.warning('Rejected', `"${nextData.label}" is not a known relationship.`)
                return false
            }
            graph.notifier.info('Saving…', 'PUT /object_references')
            await wait(500)
            graph.notifier.success('Updated', `${previousData.label} → ${nextData.label}`)
            return true
        }
    }
}
// #endregion options

// Demo plumbing (not part of the API you copy): pin the nodes into a readable
// arrangement so there is room to right-click and to place new attributes.
const layout = {
    'ip-8888': [-150, -90],
    'dom-evil': [-160, 60],
    'md5': [140, -80],
    'file-obj': [130, 70]
}

async function onLoaded(g) {
    graph = g
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
