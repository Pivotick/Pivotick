// #region data
// A small investigation graph: what the analyst already has. Everything else in this
// card arrives through a pivot.
const data = {
    nodes: [
        { id: 'paste-9f21', data: { label: 'paste 9f21', type: 'paste' } },
        { id: 'evil.example', data: { label: 'evil.example', type: 'domain' } },
        { id: '198.51.100.7', data: { label: '198.51.100.7', type: 'ip' } },
        { id: 'event-5f2a', data: { label: 'Event 5f2a', type: 'event' } },
    ],
    edges: [
        { from: 'paste-9f21', to: 'evil.example' },
        { from: 'evil.example', to: '198.51.100.7' },
        { from: 'evil.example', to: 'event-5f2a' },
    ],
}
// #endregion data

// #region options
// A **pivot** is a runnable enrichment: two functions and some metadata. `summarize`
// says cheaply what is out there, and its facets become the narrowing controls; `fetch`
// goes and gets it. What comes back are *candidates*, staged in the dock for triage and
// never on the canvas, until someone ingests them.
//
// The whole point is the node with 2,143 correlations. Fetching all of them would ruin
// the graph, so the pivot advertises the count, declares a cap it refuses to fetch past,
// and lets the analyst narrow until the number is one they can actually look at.

/** What this fake source holds, by type. They sum to 2,143; URLs alone is 210. */
const BY_TYPE = [
    { value: 'domain', label: 'Domains', count: 1800 },
    { value: 'url', label: 'URLs', count: 210 },
    { value: 'paste', label: 'Pastes', count: 95 },
    { value: 'ip', label: 'IPs', count: 38 },
]

/** The types a narrowing chose, or all of them when it chose none. */
const chosen = (narrowing) => {
    const picked = Array.isArray(narrowing.type) ? narrowing.type.map(String) : []
    return picked.length ? BY_TYPE.filter((t) => picked.includes(t.value)) : BY_TYPE
}

const correlations = {
    id: 'correlations',
    label: 'Correlations',
    // Nothing correlates with an event, so the entry is absent for one.
    appliesTo: (nodes) => nodes.every((node) => node.getData()?.type !== 'event'),

    // Runs when Pivot mode is entered, and again whenever the origin or the narrowing
    // moves. A real one would POST the ids and the narrowing to a count endpoint.
    summarize: (nodes, narrowing) => ({
        total: chosen(narrowing).reduce((sum, t) => sum + t.count, 0),
        facets: [{
            key: 'type',
            label: 'Type',
            type: 'multiselect',
            options: BY_TYPE.map((t) => ({ label: t.label, value: t.value, count: t.count })),
        }],
    }),

    // The real call, reached only once the advertised count is under the cap.
    fetch: (nodes, narrowing) => {
        const origin = nodes[0]?.id ?? 'paste-9f21'
        const out = { nodes: [], edges: [] }
        for (const type of chosen(narrowing)) {
            // Capped at 210 for the demo's sake; a real source would return `count`.
            for (let i = 0; i < Math.min(type.count, 210); i++) {
                const id = `${type.value}-${i}`
                out.nodes.push({ id, data: { label: `${type.value} ${i}`, type: type.value } })
                out.edges.push({ from: origin, to: id })
            }
        }
        return out
    },

    // Refuse to fetch while the source claims more than this. Narrowing lifts it.
    maxCandidates: 2000,
}

// The other shape a pivot takes: a small, trusted result that needs no triage. It comes
// back as one container carrying its own children and lands straight on the canvas, with
// an Undo on the toast that follows it.
const expandEvent = {
    id: 'event-objects',
    label: 'Objects & attributes',
    appliesTo: (nodes) => nodes.length === 1 && nodes[0].getData()?.type === 'event',
    autoIngest: true,
    fetch: ([node]) => ({
        nodes: [{
            id: `${node.id}-objects`,
            data: { label: 'Objects', type: 'container' },
            children: Array.from({ length: 12 }, (_, i) => ({
                id: `${node.id}-object-${i}`,
                data: { label: `attribute ${i}`, type: 'attribute' },
            })),
        }],
        edges: [{ from: node.id, to: `${node.id}-objects` }],
    }),
}

const options = {
    // Registering here rather than later is what makes the rail button correct on the
    // very first paint: `UI.pivotMode` defaults to `'auto'`, and the constructor's
    // pivots land before the UI is built.
    pivots: [correlations, expandEvent],
    UI: {
        mode: 'full',
        sidebar: { collapsed: true },
        // Triage happens in the dock, which starts folded: a staged set unfolds it
        // by itself when it arrives.
        minimap: false,
        table: { open: false },
    },
    render: {
        defaultNodeStyle: {
            size: 8,
            color: (node) => ({
                paste: '#b48ead', domain: '#ebcb8b', ip: '#88c0d0',
                url: '#a3be8c', event: '#bf616a', container: '#5e81ac',
            }[node.getData()?.type] ?? '#8f9aa8'),
        },
    },
}
// #endregion options

// Declared potential: a hint on the rim, put there by whoever loaded the data. Never a
// queried count, because the library will not call a provider just to draw a badge.
function onLoaded(graph) {
    graph.getMutableNode('paste-9f21')?.setPotential('correlations', 2143)
    graph.renderer.update()
}

export { data, options, onLoaded }
