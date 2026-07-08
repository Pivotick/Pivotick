// #region data
// A layered, organic network: one central root; 8 communities hanging off it; each
// community split into 2 clusters; and each cluster a hub with a varying number of
// densely cross-linked leaves. A couple of links also jump between communities.
//
// The nodes carry initial x/y positions that lay the communities out around a ring
// up front. Seeding the layout like this lets the force simulation settle quickly
// into cleanly separated groups instead of spending its whole budget untangling a
// random start.
const CLUSTER_COLORS = ['#4e79a7', '#f28e2b', '#59a14f', '#e15759', '#b07aa1', '#edc948', '#76b7b2', '#ff9da7']

function generateGraph(communityCount = 8, clustersPerCommunity = 2) {
    const nodes = [{ id: 'root', data: { root: true }, x: 0, y: 0 }]
    const edges = []
    const rnd = (n) => Math.floor(Math.random() * n)
    const jitter = (r) => (Math.random() - 0.5) * 2 * r
    const leavesByCommunity = []
    let seq = 0

    const RING = 460   // radius of the community ring
    const SPREAD = 120 // distance of each cluster from its community centre

    for (let c = 0; c < communityCount; c++) {
        const theta = (2 * Math.PI * c) / communityCount
        const cos = Math.cos(theta), sin = Math.sin(theta)
        const cx = RING * cos, cy = RING * sin

        const commHub = `comm${c}`
        nodes.push({ id: commHub, data: { cluster: c, commHub: true }, x: cx, y: cy })
        edges.push({ from: 'root', to: commHub, id: `root-${c}` }) // community → root
        leavesByCommunity[c] = []

        for (let k = 0; k < clustersPerCommunity; k++) {
            // the two clusters sit either side of the community centre, tangentially
            const side = (k - (clustersPerCommunity - 1) / 2) * SPREAD
            const hx = cx + SPREAD * cos - side * sin
            const hy = cy + SPREAD * sin + side * cos

            const clusterHub = `comm${c}-cl${k}`
            nodes.push({ id: clusterHub, data: { cluster: c, hub: true }, x: hx, y: hy })
            edges.push({ from: commHub, to: clusterHub, id: `${commHub}-${k}` }) // cluster → community

            const leafCount = 80 + rnd(20) // varied (80–99) so clusters aren't uniform
            const leaves = []
            for (let i = 0; i < leafCount; i++) {
                const leaf = `n${seq++}`
                nodes.push({ id: leaf, data: { cluster: c }, x: hx + jitter(55), y: hy + jitter(55) })
                leaves.push(leaf)
                leavesByCommunity[c].push(leaf)
                edges.push({ from: clusterHub, to: leaf, id: `e${leaf}` }) // leaf → its hub
                // Mesh each leaf to a couple of earlier siblings — a densely
                // interconnected community fills out as an organic blob (rather than
                // a thin spoke-ring around the hub).
                if (i > 1) {
                    const linkCount = 1 + rnd(2) // 1–2 sibling links
                    for (let l = 0; l < linkCount; l++) {
                        const other = leaves[rnd(leaves.length - 1)]
                        if (other !== leaf) edges.push({ from: leaf, to: other, id: `x${leaf}-${l}` })
                    }
                }
            }
        }
    }

    // a couple of links between different communities
    for (let i = 0; i < 4; i++) {
        const a = rnd(communityCount)
        const b = (a + 1 + rnd(communityCount - 1)) % communityCount
        edges.push({
            from: leavesByCommunity[a][rnd(leavesByCommunity[a].length)],
            to: leavesByCommunity[b][rnd(leavesByCommunity[b].length)],
            id: `bridge-${i}`
        })
    }

    return { nodes, edges }
}

const data = generateGraph(8, 2) // ~1,500 nodes: 8 communities × 2 clusters
// #endregion data

// #region options
const options = {
    layout: { type: 'force' },
    simulation: {
        // Offload the layout to a Web Worker so the main thread never freezes while
        // ~1,500 nodes settle. The worker ships with Pivotick — no build wiring.
        useWorker: true,
        // Compute the layout once, then leave it static: a continuous physics loop
        // on this many nodes would thrash the main thread.
        enabled: false,
        // Moderate repulsion keeps clusters from overlapping; the seeded ring does
        // the separating, so nothing needs to be pushed hard.
        d3ManyBodyStrength: -55,
        // Leaves rest this far apart — long enough that each meshed community reads
        // as a full, rounded blob rather than a tight knot.
        d3LinkDistance: 75
    },
    render: {
        // Colour each node by its community; the root is neutral. Nodes stay small
        // and edges thin so a dense graph is still legible at this scale.
        defaultNodeStyle: {
            strokeWidth: 0.5,
            size: (node) => {
                const d = node.getData()
                if (d?.root) return 13
                if (d?.commHub) return 9
                if (d?.hub) return 7
                return 5
            },
            color: (node) => {
                const d = node.getData()
                if (d?.root) return '#4b5563'
                return CLUSTER_COLORS[d?.cluster % CLUSTER_COLORS.length]
            }
        },
        defaultEdgeStyle: { strokeWidth: 0.5, opacity: 0.25 }
    }
}
// #endregion options

export { data, options, generateGraph }
