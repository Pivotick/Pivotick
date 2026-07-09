// #region data
const data = {
    nodes: [
        { id: 'alice', data: { label: 'Alice', type: 'person' } },
        { id: 'bob', data: { label: 'Bob', type: 'person' } },
        { id: 'carol', data: { label: 'Carol', type: 'person' } },
        { id: 'atlas', data: { label: 'Project Atlas', type: 'project' } },
        { id: 'nova', data: { label: 'Project Nova', type: 'project' } },
        { id: 'orion', data: { label: 'Orion (archived)', type: 'project', archived: true } }
    ],
    edges: [
        { from: 'alice', to: 'atlas', data: { label: 'assigned-to' } }
    ]
}
// #endregion data

// Demo plumbing: capture the graph instance once it's ready (see onLoaded below),
// and a stand-in for an async backend call.
let graph = null
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// #region options
// Both hooks live under the full UI mode's Edit Graph → Add Edge tool.
const options = {
    UI: { mode: 'full' },
    callbacks: {
        // Live predicate — runs on every hover while connecting. Only cross-type
        // links (person ↔ project) are valid; anything else previews red and can't
        // be dropped. onBeforeEdgeCreate is never consulted for a rejected target.
        isValidConnection: (source, target) =>
            source.getData().type !== target.getData().type,

        // Before-create hook — fires once a valid target is picked, before the edge
        // exists. Async here: we simulate persisting the link, then either veto or
        // accept with an enriched label / style / direction.
        onBeforeEdgeCreate: async ({ source, target, origin }) => {
            // Veto after the fact: no new links onto an archived project.
            if (source.getData().archived || target.getData().archived) {
                graph.notifier.warning('Archived', 'Project Orion is archived — no new links.')
                return false
            }

            graph.notifier.info('Saving…', `${source.getData().label} → ${target.getData().label}`)
            await wait(600) // stand-in for a backend POST that could fail

            const person = source.getData().type === 'person' ? source : target
            const project = person === source ? target : source
            graph.notifier.success('Linked', `${person.getData().label} assigned to ${project.getData().label}`)

            // Accept and stamp the new edge — the consumer decides what it carries.
            return {
                accept: true,
                data: { label: 'assigned-to', via: origin },
                style: { edge: { strokeColor: '#6366f1' } },
                directed: true
            }
        }
    }
}
// #endregion options

// Demo plumbing (not part of the API you copy): pin the nodes into a compact
// layout — people on the left, projects on the right — so there's room to connect.
const layout = {
    alice: [-120, -70],
    bob: [-140, 30],
    carol: [-110, 120],
    atlas: [110, -70],
    nova: [130, 40],
    orion: [120, 140]
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
