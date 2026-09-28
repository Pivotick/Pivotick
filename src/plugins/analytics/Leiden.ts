/**
 * Community detection with the Leiden algorithm (Traag, Waltman & van Eck, 2019), on
 * modularity with a resolution: higher finds smaller communities. Plain code with no DOM,
 * so it runs in the compute worker and on the page alike.
 *
 * Deterministic: node order is shuffled from a fixed seed, and the refinement takes the best
 * merge rather than a random one.
 */

/** An undirected graph by index: `edges` holds pairs `[a0, b0, a1, b1, …]`. */
export interface CommunityGraph {
    nodeCount: number
    edges: ArrayLike<number>
}

interface Weighted {
    /** Neighbours and weights of each node, self-loops left out. */
    adjacency: Array<Array<[number, number]>>
    /** Each node's strength: its degree, or its members' summed degree once aggregated. */
    strength: Float64Array
    /** Twice the total edge weight. */
    total: number
}

const EPSILON = 1e-12
const MAX_ITERATIONS = 32

/** A small seeded generator (mulberry32), so a run is reproducible. */
function random(seed: number): () => number {
    let state = seed >>> 0
    return () => {
        state = (state + 0x6d2b79f5) >>> 0
        let t = state
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

function shuffled(count: number, next: () => number): number[] {
    const order = Array.from({ length: count }, (_, i) => i)
    for (let i = count - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1))
        const swap = order[i]
        order[i] = order[j]
        order[j] = swap
    }
    return order
}

function build(graph: CommunityGraph): Weighted {
    const weights = Array.from({ length: graph.nodeCount }, () => new Map<number, number>())
    for (let i = 0; i + 1 < graph.edges.length; i += 2) {
        const a = graph.edges[i]
        const b = graph.edges[i + 1]
        if (a === b) continue
        weights[a].set(b, (weights[a].get(b) ?? 0) + 1)
        weights[b].set(a, (weights[b].get(a) ?? 0) + 1)
    }
    const strength = new Float64Array(graph.nodeCount)
    let total = 0
    const adjacency = weights.map((map, node) => {
        const list = [...map].sort((x, y) => x[0] - y[0])
        for (const [, weight] of list) strength[node] += weight
        total += strength[node]
        return list
    })
    return { adjacency, strength, total }
}

/**
 * Move each node to the neighbouring community that gains the most, revisiting the
 * neighbours of any node that moved, until none moves. Returns whether anything moved.
 */
function moveNodes(graph: Weighted, community: Int32Array, resolution: number, next: () => number): boolean {
    const n = community.length
    const totals = new Float64Array(n)
    const sizes = new Int32Array(n)
    for (let node = 0; node < n; node++) {
        totals[community[node]] += graph.strength[node]
        sizes[community[node]]++
    }
    // By count, not strength: an unlinked node has none, but its community is not free.
    const empty: number[] = []
    for (let c = n - 1; c >= 0; c--) if (sizes[c] === 0) empty.push(c)

    const toward = new Float64Array(n)
    const touched: number[] = []
    const queue = shuffled(n, next)
    const queued = new Uint8Array(n).fill(1)
    let moved = false
    for (let head = 0; head < queue.length; head++) {
        const node = queue[head]
        queued[node] = 0
        const own = community[node]
        const k = graph.strength[node]
        for (const [neighbour, weight] of graph.adjacency[node]) {
            const c = community[neighbour]
            if (toward[c] === 0) touched.push(c)
            toward[c] += weight
        }
        totals[own] -= k
        sizes[own]--
        let best = own
        let bestGain = toward[own] - resolution * k * totals[own] / graph.total
        for (const c of touched) {
            const gain = toward[c] - resolution * k * totals[c] / graph.total
            if (gain > bestGain + EPSILON) {
                best = c
                bestGain = gain
            }
        }
        // Alone is worth 0: better than a community that costs more than it links.
        if (bestGain < -EPSILON && sizes[own] > 0 && empty.length > 0) {
            best = empty.pop()!
        }
        for (const c of touched) toward[c] = 0
        touched.length = 0

        totals[best] += k
        sizes[best]++
        community[node] = best
        if (sizes[own] === 0) empty.push(own)
        if (best === own) continue
        moved = true
        for (const [neighbour] of graph.adjacency[node]) {
            if (community[neighbour] !== best && !queued[neighbour]) {
                queued[neighbour] = 1
                queue.push(neighbour)
            }
        }
    }
    return moved
}

/**
 * Split each community into well-connected parts: start from single nodes and merge each
 * node that is well connected to its community into the part that gains the most, if that
 * part is well connected too. Parts are always connected, which is what Leiden adds.
 */
function refine(graph: Weighted, community: Int32Array, resolution: number, next: () => number): Int32Array {
    const n = community.length
    const part = Int32Array.from({ length: n }, (_, i) => i)
    const partStrength = Float64Array.from(graph.strength)
    const partSize = new Int32Array(n).fill(1)
    /** Weight from each part to the rest of its community. */
    const partOut = new Float64Array(n)
    const totals = new Float64Array(n)
    for (let node = 0; node < n; node++) totals[community[node]] += graph.strength[node]
    const inside = new Float64Array(n)
    for (let node = 0; node < n; node++) {
        for (const [neighbour, weight] of graph.adjacency[node]) {
            if (community[neighbour] === community[node]) inside[node] += weight
        }
        partOut[node] = inside[node]
    }

    const toward = new Float64Array(n)
    const touched: number[] = []
    for (const node of shuffled(n, next)) {
        if (partSize[part[node]] !== 1) continue
        const c = community[node]
        const k = graph.strength[node]
        if (inside[node] < resolution * k * (totals[c] - k) / graph.total) continue
        for (const [neighbour, weight] of graph.adjacency[node]) {
            if (community[neighbour] !== c) continue
            const p = part[neighbour]
            if (toward[p] === 0) touched.push(p)
            toward[p] += weight
        }
        let best = -1
        let bestGain = EPSILON
        for (const p of touched) {
            const wellConnected = partOut[p] >= resolution * partStrength[p] * (totals[c] - partStrength[p]) / graph.total
            if (!wellConnected) continue
            const gain = toward[p] - resolution * k * partStrength[p] / graph.total
            if (gain > bestGain) {
                best = p
                bestGain = gain
            }
        }
        if (best !== -1) {
            const own = part[node]
            partOut[best] = partOut[best] + inside[node] - 2 * toward[best]
            partStrength[best] += k
            partSize[best]++
            partStrength[own] = 0
            partSize[own] = 0
            part[node] = best
        }
        for (const p of touched) toward[p] = 0
        touched.length = 0
    }
    return part
}

/** Renumber ids to 0…count−1 in order of first appearance. */
function compact(ids: Int32Array): { ids: Int32Array, count: number } {
    const index = new Map<number, number>()
    const out = new Int32Array(ids.length)
    for (let i = 0; i < ids.length; i++) {
        let id = index.get(ids[i])
        if (id === undefined) {
            id = index.size
            index.set(ids[i], id)
        }
        out[i] = id
    }
    return { ids: out, count: index.size }
}

/** One node per part, weights summed; the self-loops a part's inner edges make are dropped. */
function aggregate(graph: Weighted, part: Int32Array, count: number): Weighted {
    const weights = Array.from({ length: count }, () => new Map<number, number>())
    const strength = new Float64Array(count)
    for (let node = 0; node < part.length; node++) {
        const p = part[node]
        strength[p] += graph.strength[node]
        for (const [neighbour, weight] of graph.adjacency[node]) {
            const q = part[neighbour]
            if (q !== p) weights[p].set(q, (weights[p].get(q) ?? 0) + weight)
        }
    }
    const adjacency = weights.map(map => [...map].sort((x, y) => x[0] - y[0]))
    return { adjacency, strength, total: graph.total }
}

/** Each node's community at this resolution, numbered from 0. Unlinked nodes stay alone. */
export function leiden(graph: CommunityGraph, resolution = 1, seed = 1): Int32Array {
    let current = build(graph)
    const result = Int32Array.from({ length: graph.nodeCount }, (_, i) => i)
    if (current.total === 0) return result
    const next = random(seed)
    /** Which node of the current, aggregated graph each original node sits in. */
    let at = Int32Array.from({ length: graph.nodeCount }, (_, i) => i)
    let community = Int32Array.from({ length: graph.nodeCount }, (_, i) => i)

    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
        moveNodes(current, community, resolution, next)
        const communities = compact(community)
        community = communities.ids
        if (communities.count === community.length) break

        const refined = compact(refine(current, community, resolution, next))
        if (refined.count === community.length) break
        // Each part lies inside one community, which is where it starts on the next level.
        const start = new Int32Array(refined.count)
        for (let node = 0; node < community.length; node++) start[refined.ids[node]] = community[node]
        at = at.map(node => refined.ids[node])
        current = aggregate(current, refined.ids, refined.count)
        community = start
    }

    for (let node = 0; node < graph.nodeCount; node++) result[node] = community[at[node]]
    return compact(result).ids
}

/** The resolutions the Communities rule's levels run at, fine (1) to coarse. */
export const COMMUNITY_RESOLUTIONS = [3, 2, 1.4, 1, 0.7, 0.45, 0.25]

/** One partition per resolution, in the order given. */
export function communityLadder(graph: CommunityGraph, resolutions: number[] = COMMUNITY_RESOLUTIONS, seed = 1): Int32Array[] {
    return resolutions.map(resolution => leiden(graph, resolution, seed))
}
