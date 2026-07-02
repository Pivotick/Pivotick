// #region data
// Generate a large, connected network: a handful of clusters, each grown by
// attaching new nodes to an existing one (so there are hubs), plus a few
// cross-cluster links. Every node is reachable, so nothing drifts off alone.
function generateGraph(nodeCount = 1500, clusterCount = 8) {
    const nodes = []
    const edges = []
    const clusterHubs = []

    for (let i = 0; i < nodeCount; i++) {
        const cluster = i < clusterCount ? i : Math.floor(Math.random() * clusterCount)
        nodes.push({ id: `n${i}` })

        if (i < clusterCount) {
            clusterHubs.push(`n${i}`) // first node of each cluster seeds it
            continue
        }

        // attach to a random earlier node in the same cluster (falls back to the hub)
        const pool = nodes.filter((_, j) => j < i && (j % clusterCount) === cluster)
        const parent = pool.length ? pool[Math.floor(Math.random() * pool.length)].id : clusterHubs[cluster]
        edges.push({ from: parent, to: `n${i}` })
    }

    // sparse bridges between clusters so the whole thing reads as one network
    for (let k = 0; k < clusterCount * 3; k++) {
        const a = `n${Math.floor(Math.random() * nodeCount)}`
        const b = `n${Math.floor(Math.random() * nodeCount)}`
        if (a !== b) edges.push({ from: a, to: b, id: `bridge-${k}` })
    }

    return { nodes, edges }
}

const data = generateGraph(1500, 8)
// #endregion data

// #region options
const options = {
    layout: { type: 'force' },
    simulation: {
        // Offload the whole force layout to a Web Worker so the main thread — and
        // the page — stay responsive while ~1,500 nodes settle. The worker ships
        // with Pivotick; set useWorker: true and it runs the layout off-thread,
        // then hands back the final positions to render in one pass.
        useWorker: true
    },
    render: {
        // Smaller nodes and thin edges keep a dense graph legible at this scale.
        defaultNodeStyle: { size: 4, strokeWidth: 0.5 },
        defaultEdgeStyle: { strokeWidth: 0.5, opacity: 0.4 }
    }
}
// #endregion options

export { data, options, generateGraph }
