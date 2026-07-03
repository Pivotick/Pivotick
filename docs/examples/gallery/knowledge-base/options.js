// #region notes
// A markdown note doubles as the reading guide. `[[Name]]` becomes a live node
// reference — hover to highlight the article, click to select it — and resolves by
// node id or label, so it keeps working as the base grows.
const notes = [
    {
        id: 'onboarding',
        color: '#FDE68A',
        x: -370,
        y: -110,
        width: 275,
        height: 340,
        content: `# Onboarding path

**Backend:** [[Postgres]],
[[Indexing]], [[Replication]]

**Ship it:** [[Docker]],
[[Kubernetes]], [[CI/CD]]

**Frontend:** [[React]],
[[State management]]`
    }
]
// #endregion notes

// #region data
// A little knowledge base: each article has a `topic` (used for colour and for the
// filter below) and links to related articles. `label` is what `[[references]]`
// match against.
const data = {
    nodes: [
        { id: 'postgres', data: { label: 'Postgres', topic: 'Databases' } },
        { id: 'indexing', data: { label: 'Indexing', topic: 'Databases' } },
        { id: 'replication', data: { label: 'Replication', topic: 'Databases' } },
        { id: 'react', data: { label: 'React', topic: 'Frontend' } },
        { id: 'state', data: { label: 'State management', topic: 'Frontend' } },
        { id: 'css', data: { label: 'CSS layout', topic: 'Frontend' } },
        { id: 'docker', data: { label: 'Docker', topic: 'DevOps' } },
        { id: 'k8s', data: { label: 'Kubernetes', topic: 'DevOps' } },
        { id: 'cicd', data: { label: 'CI/CD', topic: 'DevOps' } }
    ],
    edges: [
        { from: 'postgres', to: 'indexing' },
        { from: 'postgres', to: 'replication' },
        { from: 'react', to: 'state' },
        { from: 'react', to: 'css' },
        { from: 'docker', to: 'k8s' },
        { from: 'k8s', to: 'cicd' },
        // Cross-topic links — the base isn't neatly siloed.
        { from: 'replication', to: 'k8s' },
        { from: 'cicd', to: 'postgres' },
        { from: 'state', to: 'cicd' }
    ],
    notes
}
// #endregion data

// #region options
// Colour each article by its topic (see the Node styling cards for the pattern).
const topicColor = { Databases: '#0072B2', Frontend: '#D55E00', DevOps: '#009E73' }

const options = {
    render: {
        nodeTypeAccessor: (node) => node.getData()?.topic,
        nodeStyleMap: {
            Databases: { color: topicColor.Databases },
            Frontend: { color: topicColor.Frontend },
            DevOps: { color: topicColor.DevOps }
        },
        defaultNodeStyle: {
            size: 14,
            strokeColor: '#ffffff',
            textColor: '#1e293b',
            text: (node) => node.getData()?.label,
            textVerticalShift: -1.8
        }
    }
}
// #endregion options

// #region filter
// Narrow the base to a single topic with the query engine. setFilter keeps nodes
// whose data[key] matches; resetFilters brings everything back. The note and its
// references stay put — filtering only hides graph nodes.
function filterByTopic(graph, topic) {
    graph.queryEngine.setFilter('topic', { value: topic, matchMode: 'exact' })
}

function clearFilters(graph) {
    graph.queryEngine.resetFilters()
}
// #endregion filter

// Demo plumbing (not part of the API you copy): pin the articles into three tidy
// topic clusters beside the note so the map reads clearly and filtering is easy to
// follow. In your app the force layout positions nodes for you.
const positions = {
    postgres: [40, -80], indexing: [150, -120], replication: [140, -30],
    docker: [30, 60], k8s: [140, 90], cicd: [250, 40],
    react: [120, 180], state: [240, 170], css: [330, 100]
}

async function onLoaded(graph) {
    Object.entries(positions).forEach(([id, [x, y]]) => {
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

export { data, options, filterByTopic, clearFilters, onLoaded }
