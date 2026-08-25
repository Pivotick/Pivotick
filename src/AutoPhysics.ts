/**
 * The `Auto` physics preset: pure functions that derive the {@link PhysicsKnobs} from
 * what is on screen. Nothing here touches d3, the DOM or the {@link Simulation}, which
 * measures the context, calls {@link tunePhysics}, and applies the result through the
 * same public knob setters a preset uses — so what auto decides stays adjustable.
 *
 * The constants below were settled by measuring real layouts, not derived.
 */
import { PHYSICS_KNOB_RANGES, type PhysicsKnobs } from './Simulation'

/** A node as the tuner sees it — position + radius, nothing else. */
export interface AutoNode {
    x?: number
    y?: number
    radius: number
}

/** Canvas box the layout is tuned against: CSS px at zoom 1. */
export interface AutoCanvas {
    width: number
    height: number
}

/** What a settled layout actually looks like. Measurement only — nothing here feeds back into the tuner. */
export interface MeasuredLayout {
    /** Node positions inflated by their radii. */
    bbox: { width: number; height: number }
    /** `sqrt(bboxArea / canvasArea)` — a *linear* fill ratio (`fillTarget` is an area one). */
    fill: number
    /** Node pairs closer than the sum of their radii. */
    overlaps: number
    /** Mean nearest-neighbour surface gap, in units of the mean radius. */
    nearestNeighbourGap: number
    /**
     * Spread of the nearest-neighbour *gaps*, relative to their mean — the one number
     * that separates a structured layout from a blob. Clusters mean dense insides and
     * empty gaps; an even carpet scores near zero at the same mean gap.
     */
    densityVariation: number
}

/** Everything a strategy is allowed to know. */
export interface AutoContext {
    canvas: AutoCanvas
    /** Nodes the simulation actually holds (the visible ones). */
    nodeCount: number
    radii: { mean: number; max: number; totalArea: number }
    edgeCount: number
    /** Connected components over the active edges; each isolated node counts as one. */
    componentCount: number
    /**
     * Fraction of nodes sitting in a component too small to hold itself together —
     * the only thing gravity is actually needed for. Zero for a single component,
     * however small, because its own links already bound it.
     */
    looseNodeFraction: number
    /** The knobs in force right now, for relative/incremental strategies. */
    current: PhysicsKnobs
}

// ─── Tuning constants ───────────────────────────────────────────────────────
// Starting points, settled by eye and by the metrics overlay against fixtures A–F.

/** Area fill target for the smallest graphs — the camera's 3× fit does the rest. */
const FILL_MIN = 0.30
/**
 * …and for large ones. Deliberately the whole canvas: a lower target squeezes the link
 * distance, and on a sparse graph what gets squeezed out is the space *between* clusters
 * — the layout's only visible structure.
 */
const FILL_MAX = 1.0
/** `fillTarget` sits at `FILL_MIN` up to this node count… */
const FILL_REF_LO = 4
/** …and reaches `FILL_MAX` here. */
const FILL_REF_HI = 400

/** Clear space guaranteed between two mean-sized discs, whatever the area budget says. */
const GAP_MIN = 24
/**
 * Link distance as a multiple of the mean node radius — the primary length scale. An
 * area budget alone (canvas ÷ node count) cannot know how big the nodes are, and on
 * large nodes asks for a spacing smaller than the nodes themselves, packing every
 * cluster into a blob. The budget stays on as a *lower* bound so sparse graphs spread.
 */
const LINK_PER_RADIUS = 6.5
/** Link-distance ceiling, as a multiple of the mean radius plus a base: small nodes stay a graph, not a constellation. */
const C_MAX = 10
const CEIL_BASE = 140

/** Collision multiplier at zero crowding, and the extra it earns as nodes fill the budget. */
const COLLIDE_BASE = 1.15
const COLLIDE_SPAN = 0.35
/** Occupancy (node area ÷ budget area) at which the collide multiplier tops out. */
const COLLIDE_FULL = 0.35

/** Effective per-node charge wanted per unit of characteristic spacing squared. */
const CHARGE_PER_AREA = 0.0058
/**
 * Repulsion floor and ceiling. The floor matters more than it looks: the area budget
 * divides the canvas by `N`, so the charge it asks for falls away as the graph grows —
 * and charge is what pushes *unrelated* subgraphs apart while links hold each cluster
 * together. Letting it collapse turns a large sparse graph into an even blob.
 */
const REPULSION_FLOOR = 38
const REPULSION_MAX = 95
/**
 * …but the floor eases off on very large graphs: d3's many-body force sums over every
 * node, so a constant per-node charge makes the total grow without bound. Easing the
 * floor rather than adding gravity is deliberate — repulsion scales a layout uniformly
 * and keeps its relative structure, where gravity closes the gaps between clusters
 * faster than the clusters themselves and flattens them out.
 */
const REPULSION_FLOOR_REF_NODES = 300
const REPULSION_FLOOR_DECAY = 0.35
const REPULSION_FLOOR_MIN = 8
/** Node radius the floor is quoted for, and how hard it climbs above it. */
const REPULSION_FLOOR_REF_RADIUS = 10
const REPULSION_FLOOR_SIZE_GAIN = 0.54

/** Damping range: more nodes → more friction, so a big graph stops jittering instead of boiling. */
const FRICTION_MIN = 24
const FRICTION_MAX = 62

/** Upper end of the `centering` knob's d3 domain — mirrors `Simulation.CENTERING_STRENGTH_MAX`. */
const CENTERING_MAX_STRENGTH = 0.2
/** Calibration for the centring balance below — measured rather than derived. */
const CENTERING_GAIN = 240
/** Gravity is aimed at this fraction of the canvas half-extent — a fence, not a target. */
const CENTERING_FENCE = 0.9
/**
 * Ceiling on the centring strength, interpolated by how fragmented the graph is
 * (see {@link centeringKnob}). The low end is for a graph its own links already
 * hold together; the high end is for one that is mostly loose pieces.
 */
const CENTERING_CEILING_BOUND = 0.001
const CENTERING_CEILING_LOOSE = 0.06
/**
 * Ceiling for the smallest graphs, decaying to {@link CENTERING_CEILING_BOUND} as the
 * graph grows. Compression costs nothing where there is no cluster structure to flatten,
 * and buys a layout the camera can zoom *into* so the nodes read as nodes. The licence
 * to compress is exactly the licence to not have clusters yet.
 */
const CENTERING_CEILING_SMALL = 0.03
/**
 * A component with fewer nodes than this counts as a loose piece. Above it, a
 * component has enough internal links to keep its own shape and only needs the
 * fence if it would leave the frame entirely.
 */
const LOOSE_COMPONENT_SIZE = 8
/** Floor: enough to stop a slow drift, never enough to shape the layout. */
const CENTERING_STRENGTH_MIN = 0.002

// ─── Helpers ────────────────────────────────────────────────────────────────

function clamp(value: number, lo: number, hi: number): number {
    return Math.max(lo, Math.min(hi, value))
}

function clamp01(value: number): number {
    return clamp(value, 0, 1)
}

function clampKnob(value: number, key: keyof PhysicsKnobs): number {
    const [lo, hi] = PHYSICS_KNOB_RANGES[key]
    return clamp(value, lo, hi)
}

/**
 * How much of the canvas the layout should cover *at zoom 1*. Not a constant, because
 * `fitAndCenter` scales a settled layout by up to 3×: a small graph can stop early and
 * let the camera zoom in, while a large one gets no such help and so aims higher.
 */
export function fillTarget(nodeCount: number): number {
    return FILL_MIN + (FILL_MAX - FILL_MIN) * sizeFraction(nodeCount)
}

/**
 * Where a graph sits on the small-to-large scale: 0 at {@link FILL_REF_LO} nodes or fewer,
 * 1 at {@link FILL_REF_HI} or more, log-interpolated. Every "how big is this" decision
 * turns on this one number.
 */
function sizeFraction(nodeCount: number): number {
    return clamp01(
        Math.log10(Math.max(nodeCount, 1) / FILL_REF_LO) / Math.log10(FILL_REF_HI / FILL_REF_LO)
    )
}

/**
 * The charge force multiplies its base strength by a sqrt-damped radius² term
 * (see `Simulation.initSimulationForceCharge`). Strategies reason about the
 * *effective* charge, so that term is divided back out before writing the knob.
 */
function chargeDamping(meanRadius: number): number {
    const damped = 10 + Math.sqrt(Math.max(0, meanRadius - 10))
    return (damped * damped) / 100
}

/**
 * The repulsion floor for a graph of this size and node size. Eased down on very large
 * graphs (see {@link REPULSION_FLOOR_REF_NODES}) and up for large nodes, which need a
 * proportionally harder push to open the same gap than the area budget can supply.
 */
function repulsionFloor(nodeCount: number, meanRadius: number): number {
    const sizeBoost = Math.pow(Math.max(1, meanRadius) / REPULSION_FLOOR_REF_RADIUS, REPULSION_FLOOR_SIZE_GAIN)
    const eased = REPULSION_FLOOR
        * Math.pow(REPULSION_FLOOR_REF_NODES / Math.max(1, nodeCount), REPULSION_FLOOR_DECAY)
    return clamp(eased * sizeBoost, REPULSION_FLOOR_MIN, REPULSION_MAX)
}

/** Effective per-node charge magnitude → the `repulsion` knob. */
function repulsionKnob(effectiveCharge: number, meanRadius: number, nodeCount: number): number {
    const base = effectiveCharge / chargeDamping(meanRadius)
    return clamp((base / 400) * 100, repulsionFloor(nodeCount, meanRadius), REPULSION_MAX)
}

/**
 * The charge the simulation will *actually* apply for a repulsion knob, which is not what
 * was asked for whenever {@link repulsionKnob}'s clamps bite. Centring has to balance the
 * charge that runs — balancing the requested one leaves the layout well past its target.
 */
function chargeForKnob(knob: number, meanRadius: number): number {
    return (knob / 100) * 400 * chargeDamping(meanRadius)
}

/** Collision-radius multiplier (the d3 domain) → the `collisionRadius` knob. */
function collisionKnob(multiplier: number): number {
    // Inverse of Simulation.COLLIDE_MULTIPLIER_RANGE = [0.6, 2.4] over knob 4..60.
    const t = (multiplier - 0.6) / (2.4 - 0.6)
    return clampKnob(4 + t * (60 - 4), 'collisionRadius')
}

/**
 * Gravity strength: a fence that keeps loose pieces in frame, not a size dial.
 *
 * A node at radius `R` is pushed out by roughly `N · |Q| / R²` and pulled in by `R · s`;
 * equating them at the fence radius gives `s = N · |Q| / R³`, scaled by an empirical gain.
 *
 * The ceiling is the important part, and it scales with fragmentation
 * (`components / nodes`). Gravity is one inward pull applied equally to everything, so it
 * cannot create structure — it only shrinks, and what it shrinks first is the space
 * between clusters. Worth spending only where links are not already doing the job.
 */
function centeringKnob(
    effectiveCharge: number,
    canvas: AutoCanvas,
    nodeCount: number,
    looseNodeFraction: number,
): number {
    const radius = Math.max(1, CENTERING_FENCE * 0.5 * Math.min(canvas.width, canvas.height))
    const balance = CENTERING_GAIN * nodeCount * effectiveCharge / (radius * radius * radius)

    // Two independent licences to centre, whichever is larger: the graph is small enough
    // that compressing it costs no structure, or some of it is in pieces nothing else
    // holds. Cubic, so the licence is gone by the time there is structure worth keeping.
    const smallCeiling = CENTERING_CEILING_BOUND
        + (CENTERING_CEILING_SMALL - CENTERING_CEILING_BOUND) * Math.pow(1 - sizeFraction(nodeCount), 3)
    // Linear, not sqrt: one loose node in a hundred needs a hundredth of the help, where
    // sqrt would hand it a sixth and compress a graph its links were holding fine.
    const looseCeiling = CENTERING_CEILING_BOUND
        + (CENTERING_CEILING_LOOSE - CENTERING_CEILING_BOUND) * clamp01(looseNodeFraction)
    const ceiling = Math.max(smallCeiling, looseCeiling)

    const strength = clamp(balance, CENTERING_STRENGTH_MIN, Math.max(CENTERING_STRENGTH_MIN, ceiling))
    return clampKnob(100 * Math.sqrt(clamp01(strength / CENTERING_MAX_STRENGTH)), 'centering')
}

/** Bigger graphs need longer to unfold; tiny ones are done almost immediately. */
function settleTimeFor(nodeCount: number): number {
    return clampKnob(1.2 + 0.8 * Math.log10(Math.max(nodeCount, 1)), 'settleTime')
}

function frictionFor(nodeCount: number): number {
    const t = clamp01(Math.log10(Math.max(nodeCount, 1) / 4) / Math.log10(500 / 4))
    return FRICTION_MIN + (FRICTION_MAX - FRICTION_MIN) * t
}

/** Round a knob bundle down to what the sliders can actually represent. */
function quantise(knobs: PhysicsKnobs): PhysicsKnobs {
    return {
        repulsion: Math.round(knobs.repulsion),
        linkDistance: Math.round(knobs.linkDistance),
        collisionRadius: Math.round(knobs.collisionRadius),
        friction: Math.round(knobs.friction),
        centering: Math.round(knobs.centering),
        settleTime: Math.round(knobs.settleTime * 10) / 10,
    }
}

// ─── The tuner ──────────────────────────────────────────────────────────────

/**
 * The area budget: give the graph `fillTarget(N)` of the canvas and split it evenly
 * between the nodes. `spacing` is the resulting
 * characteristic distance — one node's share of the budget, expressed as a length.
 */
function areaBudget(ctx: AutoContext): { targetArea: number; spacing: number } {
    const targetArea = fillTarget(ctx.nodeCount) * ctx.canvas.width * ctx.canvas.height
    return { targetArea, spacing: Math.sqrt(targetArea / Math.max(1, ctx.nodeCount)) }
}

/**
 * Derive the physics knobs from what is on screen. Two length scales feed in and the
 * larger wins: the room each node is budgeted (canvas ÷ node count) and the room its own
 * size demands ({@link LINK_PER_RADIUS}). Everything else follows from the link distance
 * that comes out, with centring as a fence around the lot.
 */
export function tunePhysics(ctx: AutoContext): PhysicsKnobs {
    const { spacing } = areaBudget(ctx)
    const meanRadius = Math.max(1, ctx.radii.mean)

    const wanted = Math.max(0.8 * spacing, LINK_PER_RADIUS * meanRadius)
    // Floor so two discs can never touch; ceiling so a handful of small nodes cannot
    // drift into separate specks.
    const floor = 2 * meanRadius + GAP_MIN
    const ceiling = Math.min(PHYSICS_KNOB_RANGES.linkDistance[1], C_MAX * meanRadius + CEIL_BASE)
    const linkDistance = clampKnob(clamp(wanted, floor, Math.max(floor, ceiling)), 'linkDistance')

    const effectiveCharge = CHARGE_PER_AREA * spacing * spacing
    // Crowding measured against the area the layout will actually occupy (one link
    // distance squared per node), not against a canvas budget it may well exceed.
    // Against the budget, a graph of large nodes reads as permanently crowded and the
    // collide radius inflates to compensate — which packs the clusters even tighter.
    const occupancy = ctx.radii.totalArea / Math.max(1, ctx.nodeCount * linkDistance * linkDistance)
    const multiplier = COLLIDE_BASE + COLLIDE_SPAN * clamp01(occupancy / COLLIDE_FULL)
    const repulsion = repulsionKnob(effectiveCharge, meanRadius, ctx.nodeCount)

    return quantise({
        repulsion,
        linkDistance,
        collisionRadius: collisionKnob(multiplier),
        friction: frictionFor(ctx.nodeCount),
        centering: centeringKnob(chargeForKnob(repulsion, meanRadius), ctx.canvas, ctx.nodeCount, ctx.looseNodeFraction),
        settleTime: settleTimeFor(ctx.nodeCount),
    })
}

// ─── Measurement ────────────────────────────────────────────────────────────

/**
 * Connected components over the given edges, isolated nodes included (union-find,
 * O(N + E)). `centering` exists because separate components only ever repel — this
 * is how a strategy knows there is more than one.
 */
export function analyseComponents(
    nodeIds: string[],
    edges: Array<[string, string]>,
): { count: number; looseNodeFraction: number } {
    const parent = new Map<string, string>()
    for (const id of nodeIds) parent.set(id, id)

    const find = (id: string): string => {
        let root = id
        while (parent.get(root) !== root) root = parent.get(root)!
        let cursor = id // path compression, so repeated finds stay near-constant
        while (parent.get(cursor) !== root) {
            const next = parent.get(cursor)!
            parent.set(cursor, root)
            cursor = next
        }
        return root
    }

    let components = nodeIds.length
    for (const [a, b] of edges) {
        if (!parent.has(a) || !parent.has(b)) continue
        const rootA = find(a)
        const rootB = find(b)
        if (rootA === rootB) continue
        parent.set(rootA, rootB)
        components--
    }

    // How many nodes live in a piece too small to hold itself together. One component
    // is bounded by its own links however small it is, so it never counts as loose.
    let looseNodes = 0
    if (components > 1) {
        const sizes = new Map<string, number>()
        for (const id of nodeIds) {
            const root = find(id)
            sizes.set(root, (sizes.get(root) ?? 0) + 1)
        }
        for (const size of sizes.values()) {
            if (size < LOOSE_COMPONENT_SIZE) looseNodes += size
        }
    }

    return { count: components, looseNodeFraction: nodeIds.length ? looseNodes / nodeIds.length : 0 }
}

/**
 * Measure a settled layout: bounding box, canvas coverage, overlapping pairs and typical
 * clear space. Overlaps and gaps go through a uniform spatial hash keyed on the largest
 * contact distance, keeping 2000 nodes to a few thousand comparisons.
 */
export function measureLayout(nodes: AutoNode[], canvas: AutoCanvas): MeasuredLayout {
    const placed = nodes.filter(node => typeof node.x === 'number' && typeof node.y === 'number')
    if (placed.length === 0) {
        return { bbox: { width: 0, height: 0 }, fill: 0, overlaps: 0, nearestNeighbourGap: 0, densityVariation: 0 }
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    let maxRadius = 0, radiusSum = 0
    for (const node of placed) {
        const radius = node.radius
        minX = Math.min(minX, node.x! - radius)
        minY = Math.min(minY, node.y! - radius)
        maxX = Math.max(maxX, node.x! + radius)
        maxY = Math.max(maxY, node.y! + radius)
        maxRadius = Math.max(maxRadius, radius)
        radiusSum += radius
    }
    const bbox = { width: maxX - minX, height: maxY - minY }
    const canvasArea = Math.max(1, canvas.width * canvas.height)
    const fill = Math.sqrt((bbox.width * bbox.height) / canvasArea)

    // Cell size = the largest possible contact distance, so a node's neighbours can
    // only ever live in its own cell or the eight around it.
    const cell = Math.max(1, 2 * maxRadius)
    const buckets = new Map<string, AutoNode[]>()
    for (const node of placed) {
        const key = `${Math.floor(node.x! / cell)}|${Math.floor(node.y! / cell)}`
        const bucket = buckets.get(key)
        if (bucket) bucket.push(node)
        else buckets.set(key, [node])
    }

    // Overlaps live inside one ring — a pair further than `cell` apart on either axis
    // cannot touch. The *nearest neighbour* has no such bound, so the search grows
    // ring by ring until it finds one, plus one more ring to be sure it is the nearest.
    const maxRing = Math.ceil(Math.max(bbox.width, bbox.height) / cell) + 1
    let overlaps = 0
    let gapSum = 0
    let gapCount = 0
    const neighbourDistances: number[] = []
    for (const node of placed) {
        const cx = Math.floor(node.x! / cell)
        const cy = Math.floor(node.y! / cell)
        let nearest = Infinity
        let foundAtRing = -1

        for (let ring = 0; ring <= maxRing; ring++) {
            if (foundAtRing >= 0 && ring > foundAtRing + 1) break
            for (let dx = -ring; dx <= ring; dx++) {
                for (let dy = -ring; dy <= ring; dy++) {
                    // Perimeter only — the interior was covered by the previous rings.
                    if (ring > 0 && Math.abs(dx) !== ring && Math.abs(dy) !== ring) continue
                    const bucket = buckets.get(`${cx + dx}|${cy + dy}`)
                    if (!bucket) continue
                    for (const other of bucket) {
                        if (other === node) continue
                        const gap = Math.hypot(node.x! - other.x!, node.y! - other.y!) - node.radius - other.radius
                        if (gap < 0) overlaps++
                        if (gap < nearest) {
                            nearest = gap
                            if (foundAtRing < 0) foundAtRing = ring
                        }
                    }
                }
            }
        }

        if (nearest !== Infinity) {
            gapSum += nearest
            gapCount++
            // The *gap*, not the centre-to-centre distance. Adding back 2r damps the
            // signal exactly where it is needed most: on large nodes the constant
            // swamps the variation, and a flattened carpet then scores the same as a
            // legible layout. Measured both ways on the same pair of layouts — the gap
            // separated them 0.24 vs 1.26, centre-to-centre could not.
            neighbourDistances.push(nearest)
        }
    }

    const meanNeighbour = neighbourDistances.reduce((a, b) => a + b, 0) / (neighbourDistances.length || 1)
    const variance = neighbourDistances.reduce((a, d) => a + (d - meanNeighbour) ** 2, 0)
        / (neighbourDistances.length || 1)
    const densityVariation = meanNeighbour > 0 ? Math.sqrt(variance) / meanNeighbour : 0

    const meanRadius = radiusSum / placed.length || 1
    return {
        bbox,
        fill,
        overlaps: overlaps / 2, // each pair is seen from both ends
        nearestNeighbourGap: gapCount ? gapSum / gapCount / meanRadius : 0,
        densityVariation,
    }
}
