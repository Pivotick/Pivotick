/**
 * Stress majorization: place points so that their distances match a target matrix as
 * closely as possible, nearby pairs weighing most (`w = d⁻²`). Started from classical
 * MDS and iterated with the localized SMACOF update (Gansner, Koren & North, 2004).
 *
 * Nothing here is random, so the same matrix always gives the same picture.
 */

/** Below this relative drop in stress the layout is taken as settled. */
const STRESS_EPSILON = 1e-4
const MAX_ITERATIONS = 300
const POWER_ITERATIONS = 100

export type Point = [number, number]

/**
 * Points whose distances approximate `distances`, centred on the origin.
 *
 * @param distances - Symmetric, finite, positive off the diagonal.
 */
export function stressLayout(distances: number[][]): Point[] {
    const n = distances.length
    if (n === 0) return []
    if (n === 1) return [[0, 0]]
    if (n === 2) return [[-distances[0][1] / 2, 0], [distances[0][1] / 2, 0]]

    const points = classicalMds(distances)
    let previous = stressOf(points, distances)
    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
        majorize(points, distances)
        const current = stressOf(points, distances)
        if (previous - current < STRESS_EPSILON * previous) break
        previous = current
    }
    return centred(points)
}

/** One sweep of the localized update, each point moved against the others' current places. */
function majorize(points: Point[], distances: number[][]): void {
    const n = points.length
    for (let i = 0; i < n; i++) {
        let sumX = 0, sumY = 0, sumW = 0
        for (let j = 0; j < n; j++) {
            if (i === j) continue
            const target = distances[i][j]
            const weight = 1 / (target * target)
            let dx = points[i][0] - points[j][0]
            let dy = points[i][1] - points[j][1]
            let length = Math.hypot(dx, dy)
            // Two points on the same spot have no direction between them; pick one that
            // depends only on their order, so the result stays reproducible.
            if (length < 1e-9) {
                dx = i < j ? -1 : 1
                dy = 0
                length = 1
            }
            sumX += weight * (points[j][0] + target * dx / length)
            sumY += weight * (points[j][1] + target * dy / length)
            sumW += weight
        }
        points[i][0] = sumX / sumW
        points[i][1] = sumY / sumW
    }
}

function stressOf(points: Point[], distances: number[][]): number {
    let stress = 0
    for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
            const target = distances[i][j]
            const gap = Math.hypot(points[i][0] - points[j][0], points[i][1] - points[j][1]) - target
            stress += gap * gap / (target * target)
        }
    }
    return stress
}

/**
 * The two leading axes of the double-centred squared distances, found by power iteration
 * from fixed start vectors.
 */
function classicalMds(distances: number[][]): Point[] {
    const n = distances.length
    const squared = distances.map(row => row.map(d => d * d))
    const rowMeans = squared.map(row => row.reduce((sum, d) => sum + d, 0) / n)
    const grandMean = rowMeans.reduce((sum, d) => sum + d, 0) / n
    const b = squared.map((row, i) => row.map((d, j) => -0.5 * (d - rowMeans[i] - rowMeans[j] + grandMean)))

    const first = leadingEigen(b, n, 1)
    deflate(b, first)
    const second = leadingEigen(b, n, 2)

    const points: Point[] = []
    for (let i = 0; i < n; i++) {
        points.push([first.vector[i] * Math.sqrt(first.value), second.vector[i] * Math.sqrt(second.value)])
    }

    // An axis MDS leaves flat would stay flat: the update only ever moves a point along
    // the differences it already has. A small nudge off it lets stress leave the line
    // where the graph is not one, and a path straightens back out.
    let total = 0
    for (const row of distances) for (const d of row) total += d
    const typical = total / (n * (n - 1))
    if (first.value === 0) {
        points.forEach((point, i) => {
            point[0] = typical * Math.cos(2 * Math.PI * i / n)
            point[1] = typical * Math.sin(2 * Math.PI * i / n)
        })
    } else if (second.value === 0) {
        points.forEach((point, i) => { point[1] = 0.05 * typical * Math.sin((i + 1) * 2.399) })
    }
    return points
}

interface Eigen { value: number, vector: number[] }

/**
 * The largest eigenvalue and its vector; `0` when there is no positive one. Graph distances
 * are rarely Euclidean, so the matrix has negative eigenvalues too, often the biggest in
 * size. Plain power iteration would find those, so it runs on the matrix shifted by a bound
 * on its spectrum, which makes the largest one also the biggest.
 */
function leadingEigen(matrix: number[][], n: number, seed: number): Eigen {
    const shift = Math.max(...matrix.map(row => row.reduce((sum, value) => sum + Math.abs(value), 0)))
    // Fixed but uneven, so the start is unlikely to sit orthogonal to the answer.
    let vector = normalised(Array.from({ length: n }, (_, i) => Math.sin((i + 1) * (seed + 0.618))))
    for (let iteration = 0; iteration < POWER_ITERATIONS; iteration++) {
        const next = multiply(matrix, vector).map((component, i) => component + shift * vector[i])
        const length = Math.hypot(...next)
        if (length < 1e-12) break
        vector = next.map(component => component / length)
    }
    const value = dot(vector, multiply(matrix, vector))
    return { value: value > 1e-9 ? value : 0, vector }
}

function deflate(matrix: number[][], eigen: Eigen): void {
    for (let i = 0; i < matrix.length; i++) {
        for (let j = 0; j < matrix.length; j++) {
            matrix[i][j] -= eigen.value * eigen.vector[i] * eigen.vector[j]
        }
    }
}

function multiply(matrix: number[][], vector: number[]): number[] {
    return matrix.map(row => dot(row, vector))
}

function dot(a: number[], b: number[]): number {
    let sum = 0
    for (let i = 0; i < a.length; i++) sum += a[i] * b[i]
    return sum
}

function normalised(vector: number[]): number[] {
    const length = Math.hypot(...vector)
    return length > 0 ? vector.map(component => component / length) : vector
}

function centred(points: Point[]): Point[] {
    const cx = points.reduce((sum, point) => sum + point[0], 0) / points.length
    const cy = points.reduce((sum, point) => sum + point[1], 0) / points.length
    return points.map(([x, y]) => [x - cx, y - cy])
}

/**
 * All-pairs shortest path lengths over a weighted, undirected, connected graph.
 *
 * @param links - `[i, j, length]`, indices into `0..n-1`.
 */
export function shortestPaths(n: number, links: Array<[number, number, number]>): number[][] {
    const adjacency: Array<Array<[number, number]>> = Array.from({ length: n }, () => [])
    for (const [i, j, length] of links) {
        adjacency[i].push([j, length])
        adjacency[j].push([i, length])
    }
    const distances: number[][] = []
    for (let source = 0; source < n; source++) {
        // Dense Dijkstra: these graphs are small, and a heap would cost more than it saves.
        const distance = new Array<number>(n).fill(Infinity)
        const done = new Array<boolean>(n).fill(false)
        distance[source] = 0
        for (let step = 0; step < n; step++) {
            let closest = -1
            for (let i = 0; i < n; i++) {
                if (!done[i] && (closest === -1 || distance[i] < distance[closest])) closest = i
            }
            if (closest === -1 || distance[closest] === Infinity) break
            done[closest] = true
            for (const [neighbour, length] of adjacency[closest]) {
                const through = distance[closest] + length
                if (through < distance[neighbour]) distance[neighbour] = through
            }
        }
        distances.push(distance)
    }
    return distances
}
