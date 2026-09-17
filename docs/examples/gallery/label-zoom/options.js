// #region data
/**
 * Seven sites — one in the middle, six around it — each with four hosts. Pinned wide enough
 * that the graph opens well under zoom 1, which is the point of the card, and dense enough in
 * the middle that scrolling in anywhere lands on something with a name.
 *
 * A site is drawn at size 40 and a host at 10, so their labels are 18 and 12 graph units: a
 * node's label is derived from its size, with a floor at 12.
 */
const SITES = [
    { id: 'core', name: 'Frankfurt', x: 0, y: 0, tone: '#2563eb' },
    { id: 'us', name: 'Ashburn', x: 1000, y: -560, tone: '#0891b2' },
    { id: 'sa', name: 'São Paulo', x: 1000, y: 560, tone: '#d97706' },
    { id: 'ap', name: 'Singapore', x: -1000, y: 560, tone: '#7c3aed' },
    { id: 'uk', name: 'London', x: -1000, y: -560, tone: '#059669' },
    { id: 'no', name: 'Oslo', x: 0, y: -900, tone: '#db2777' },
    { id: 'za', name: 'Cape Town', x: 0, y: 900, tone: '#65a30d' },
]

const HOSTS = [
    { name: 'edge', relation: 'routes to' },
    { name: 'cache', relation: 'caches for' },
    { name: 'api', relation: 'serves' },
    { name: 'db', relation: 'reads from' },
]

const nodes = []
const edges = []

for (const site of SITES) {
    nodes.push({
        id: site.id,
        fx: site.x,
        fy: site.y,
        style: { size: 40, color: site.tone, text: site.name, textVerticalShift: 1 },
    })
    HOSTS.forEach((host, index) => {
        const angle = (index / HOSTS.length) * Math.PI * 2 + Math.PI / 4
        const id = `${site.id}-${host.name}`
        nodes.push({
            id,
            fx: site.x + Math.cos(angle) * 250,
            fy: site.y + Math.sin(angle) * 230,
            style: { size: 10, color: '#94a3b8', text: `${host.name}.${site.id}`, textVerticalShift: 1 },
        })
        edges.push({ from: site.id, to: id, data: { label: host.relation } })
    })
}

// Every outer site peers with the middle one, so this is one network rather than seven.
for (const site of SITES.slice(1)) {
    edges.push({ from: 'core', to: site.id, data: { label: 'peers with' } })
}

const data = { nodes, edges }
// #endregion data

// #region options
const options = {
    render: {
        // The default. Below 9 rendered pixels a label is not drawn — and a node's label is
        // derived from its size, so the sites keep theirs to a lower zoom than the hosts.
        minLabelFontSize: 9,
        defaultNodeStyle: { shape: 'circle', textColor: '#ffffff' },
        defaultEdgeStyle: { strokeColor: '#cbd5e1', strokeWidth: 2 },
    },
    // Every node is pinned, so the layout is the one written above.
    simulation: { enabled: false },
}
// #endregion options

export { data, options }
