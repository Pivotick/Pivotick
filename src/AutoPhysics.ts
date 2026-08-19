/**
 * The `Auto` physics preset: pure functions that derive the {@link PhysicsKnobs}
 * from what is actually on screen.
 *
 * Nothing here touches d3, the DOM or the {@link Simulation} — a strategy is a
 * plain `(AutoContext) => PhysicsKnobs`. `Simulation` measures the context, calls
 * the active strategy and applies the result through the same public knob setters
 * a preset uses, so everything auto decides stays visible and adjustable.
 *
 * Three candidates ship side by side behind {@link AUTO_STRATEGIES} while the
 * bake-off runs; the losers and the dev switch go before merge.
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

/** What a settled layout actually looks like — the input `feedback` corrects against. */
export interface MeasuredLayout {
    /** Node positions inflated by their radii. */
    bbox: { width: number; height: number }
    /** `sqrt(bboxArea / canvasArea)` — a *linear* fill ratio, comparable to {@link fillTarget}. */
    fill: number
    /** Node pairs closer than the sum of their radii. */
    overlaps: number
    /** Mean nearest-neighbour surface gap, in units of the mean radius. */
    nearestNeighbourGap: number
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
    /** Present only for `feedback` — the previous settled layout. */
    measured?: MeasuredLayout
    /** The knobs in force right now, for relative/incremental strategies. */
    current: PhysicsKnobs
}

export type AutoStrategy = (ctx: AutoContext) => PhysicsKnobs

export type AutoStrategyName = 'hybrid' | 'fill' | 'feedback'

// ─── Tuning constants ───────────────────────────────────────────────────────
// Starting points, settled by eye and by the metrics overlay against fixtures A–F.

/** Linear fill target for the smallest graphs — the camera's 3× fit does the rest. */
const FILL_MIN = 0.30
/** …and for large ones, where the camera can no longer help and a sprawl only shrinks nodes. */
const FILL_MAX = 0.64
/** `fillTarget` sits at `FILL_MIN` up to this node count… */
const FILL_REF_LO = 4
/** …and reaches `FILL_MAX` here. */
const FILL_REF_HI = 400

/** Clear space guaranteed between two mean-sized discs, whatever the area budget says. */
const GAP_MIN = 24
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
/** Repulsion is never let all the way to zero (hairballs) nor to the rail. */
const REPULSION_MIN = 10
const REPULSION_MAX = 95

/** Damping range: more nodes → more friction, so a big graph stops jittering instead of boiling. */
const FRICTION_MIN = 24
const FRICTION_MAX = 62

/** Upper end of the `centering` knob's d3 domain — mirrors `Simulation.CENTERING_STRENGTH_MAX`. */
const CENTERING_MAX_STRENGTH = 0.2
/**
 * Calibration for the centring balance below. Derived by measuring, not by theory:
 * sweeping the gravity strength against settled 60-node and 7-node layouts put the
 * strength that lands each on its fill target at 0.08 and 0.09 respectively, which
 * back-solves to ~280 and ~215 through the balance. 240 splits them.
 */
const CENTERING_GAIN = 240
/** Never centre so hard the graph collapses to a point, nor so softly it does nothing. */
const CENTERING_STRENGTH_RANGE = [0.002, 0.12] as const

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
 * How much of the canvas the layout should cover *at zoom 1*.
 *
 * Deliberately not a constant: `fitAndCenter` scales the settled layout by up to
 * 3×, so a small graph only needs ~0.27 to end at ~80% on-screen coverage — and
 * stopping there is better, because the camera then zooms in and the nodes read
 * as nodes rather than as four dots on a 1200px canvas. Large graphs get no such
 * help (their fit is already ≤ 1), so the target climbs.
 */
export function fillTarget(nodeCount: number): number {
    const t = clamp01(
        Math.log10(Math.max(nodeCount, 1) / FILL_REF_LO) / Math.log10(FILL_REF_HI / FILL_REF_LO)
    )
    return FILL_MIN + (FILL_MAX - FILL_MIN) * t
}

/**
 * {@link fillTarget} as a *linear* ratio — the same quantity {@link MeasuredLayout.fill}
 * reports, and the only form the two may be compared in. The area fraction and the
 * side-length fraction of the same box differ by a square root, which is a
 * comfortable factor of two in the middle of the range.
 */
export function linearFillTarget(nodeCount: number): number {
    return Math.sqrt(fillTarget(nodeCount))
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

/** Effective per-node charge magnitude → the `repulsion` knob. */
function repulsionKnob(effectiveCharge: number, meanRadius: number): number {
    const base = effectiveCharge / chargeDamping(meanRadius)
    return clamp((base / 400) * 100, REPULSION_MIN, REPULSION_MAX)
}

/**
 * The charge the simulation will *actually* apply for a repulsion knob — which is
 * not what was asked for whenever {@link repulsionKnob}'s clamps bite. Centring has
 * to balance the charge that runs, not the one the area budget wanted: on a
 * 500-node graph the two differ six-fold, and balancing the wrong one leaves the
 * layout at triple its target size.
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
 * Gravity strength that holds the layout at a radius of `boxSide / 2`.
 *
 * This is the knob that actually decides how big the graph ends up. Link distance
 * only sets the rest length of a spring; charge is long-range and summed over every
 * other node, so without a counter-force the layout expands well past any area
 * budget — measured at 1.5–5× the target before this knob existed.
 *
 * A node at radius `R` is pushed out by roughly `N · |Q| / R²` and pulled in by
 * `R · s`; equating them gives `s = N · |Q| / R³`, scaled by an empirical gain.
 * The knob is quadratic (see `Simulation.setCentering`), so the useful band — which
 * spans two orders of magnitude — lands mid-slider rather than pinned against zero.
 */
function centeringKnob(effectiveCharge: number, boxSide: number, nodeCount: number): number {
    const radius = Math.max(1, boxSide / 2)
    const balance = CENTERING_GAIN * nodeCount * effectiveCharge / (radius * radius * radius)
    const strength = clamp(balance, CENTERING_STRENGTH_RANGE[0], CENTERING_STRENGTH_RANGE[1])
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

// ─── Strategies ─────────────────────────────────────────────────────────────

/**
 * The area budget shared by `fill` and `hybrid`: give the graph `fillTarget(N)`
 * of the canvas and split it evenly between the nodes. `spacing` is the resulting
 * characteristic distance — one node's share of the budget, expressed as a length.
 */
function areaBudget(ctx: AutoContext): { targetArea: number; spacing: number; boxSide: number } {
    const targetArea = fillTarget(ctx.nodeCount) * ctx.canvas.width * ctx.canvas.height
    return {
        targetArea,
        spacing: Math.sqrt(targetArea / Math.max(1, ctx.nodeCount)),
        boxSide: Math.sqrt(targetArea),
    }
}

/**
 * `hybrid` — the area budget, clamped by node size.
 *
 * The budget alone answers "few nodes look cramped"; the clamps answer "large
 * nodes look cramped", by refusing a link distance that would let two discs touch
 * (the `GAP_MIN` floor) or let a handful of small nodes drift into separate specks
 * (the `C_MAX` ceiling).
 */
const hybrid: AutoStrategy = (ctx) => {
    const { targetArea, spacing, boxSide } = areaBudget(ctx)
    const meanRadius = Math.max(1, ctx.radii.mean)

    const floor = 2 * meanRadius + GAP_MIN
    const ceiling = Math.min(PHYSICS_KNOB_RANGES.linkDistance[1], C_MAX * meanRadius + CEIL_BASE)
    const linkDistance = clampKnob(clamp(0.8 * spacing, floor, Math.max(floor, ceiling)), 'linkDistance')

    const effectiveCharge = CHARGE_PER_AREA * spacing * spacing
    const occupancy = ctx.radii.totalArea / Math.max(1, targetArea)
    const multiplier = COLLIDE_BASE + COLLIDE_SPAN * clamp01(occupancy / COLLIDE_FULL)
    const repulsion = repulsionKnob(effectiveCharge, meanRadius)

    return quantise({
        repulsion,
        linkDistance,
        collisionRadius: collisionKnob(multiplier),
        friction: frictionFor(ctx.nodeCount),
        centering: centeringKnob(chargeForKnob(repulsion, meanRadius), boxSide, ctx.nodeCount),
        settleTime: settleTimeFor(ctx.nodeCount),
    })
}

/**
 * `fill` — the same area budget with the radius clamps taken out. The control:
 * it should fail visibly wherever the clamps were doing the work (40 large nodes
 * get a ~124px per-node budget against a 120px diameter, so they touch), which is
 * what proves `hybrid`'s clamps are load-bearing rather than superstition.
 */
const fill: AutoStrategy = (ctx) => {
    const { spacing, boxSide } = areaBudget(ctx)
    const meanRadius = Math.max(1, ctx.radii.mean)
    const repulsion = repulsionKnob(CHARGE_PER_AREA * spacing * spacing, meanRadius)

    return quantise({
        repulsion,
        linkDistance: clampKnob(0.8 * spacing, 'linkDistance'),
        collisionRadius: collisionKnob(COLLIDE_BASE),
        friction: frictionFor(ctx.nodeCount),
        centering: centeringKnob(chargeForKnob(repulsion, meanRadius), boxSide, ctx.nodeCount),
        settleTime: settleTimeFor(ctx.nodeCount),
    })
}

/** How far off target the measured fill must be before `feedback` corrects. */
const FEEDBACK_DEADBAND = 0.08
/** Per-pass correction limits — one bounded nudge, never a chase. */
const FEEDBACK_LINK_STEP = 0.10
const FEEDBACK_CHARGE_STEP = 0.15

/**
 * `feedback` — measure the layout that actually came out, then correct it.
 *
 * The only candidate that is topology-honest: a 10-node chain and a 10-node hub
 * have very different bounding boxes for identical knobs, which no closed-form
 * `N`-based formula can know. Its cost is determinism — `cooldownTime` is a
 * wall-clock budget, so a slower machine settles less and measures a different
 * box. It therefore never produces the *opening* layout (that stays feed-forward
 * via `hybrid`) and only ever applies bounded corrections afterwards.
 */
const feedback: AutoStrategy = (ctx) => {
    const seed = hybrid(ctx)
    if (!ctx.measured || ctx.measured.fill <= 0) return seed

    const base = ctx.current.linkDistance > 0 ? ctx.current : seed
    // Both sides linear — `measured.fill` is a side-length ratio, not an area one.
    const error = linearFillTarget(ctx.nodeCount) / ctx.measured.fill
    const next: PhysicsKnobs = { ...base }

    if (Math.abs(error - 1) > FEEDBACK_DEADBAND) {
        next.linkDistance = clampKnob(
            base.linkDistance * clamp(error, 1 - FEEDBACK_LINK_STEP, 1 + FEEDBACK_LINK_STEP),
            'linkDistance'
        )
        next.repulsion = clampKnob(
            base.repulsion * clamp(error * error, 1 - FEEDBACK_CHARGE_STEP, 1 + FEEDBACK_CHARGE_STEP),
            'repulsion'
        )
    }
    if (ctx.measured.overlaps > 0) {
        next.collisionRadius = clampKnob(base.collisionRadius + 3, 'collisionRadius')
    }
    // Centring and settle time have no measurable error signal — take the feed-forward value.
    next.centering = seed.centering
    next.settleTime = seed.settleTime
    return quantise(next)
}

export const AUTO_STRATEGIES: Record<AutoStrategyName, AutoStrategy> = { hybrid, fill, feedback }

export const AUTO_STRATEGY_NAMES = Object.keys(AUTO_STRATEGIES) as AutoStrategyName[]

export const DEFAULT_AUTO_STRATEGY: AutoStrategyName = 'hybrid'

export function isAutoStrategyName(value: unknown): value is AutoStrategyName {
    return typeof value === 'string' && value in AUTO_STRATEGIES
}

// ─── Measurement ────────────────────────────────────────────────────────────

/**
 * Connected components over the given edges, isolated nodes included (union-find,
 * O(N + E)). `centering` exists because separate components only ever repel — this
 * is how a strategy knows there is more than one.
 */
export function countComponents(nodeIds: string[], edges: Array<[string, string]>): number {
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
    return components
}

/**
 * Measure a settled layout: its bounding box, how much of the canvas that covers,
 * how many node pairs overlap and how much clear space a node typically has.
 *
 * Overlaps and gaps go through a uniform spatial hash keyed on the largest contact
 * distance, so 2000 nodes stay a few thousand comparisons rather than two million.
 */
export function measureLayout(nodes: AutoNode[], canvas: AutoCanvas): MeasuredLayout {
    const placed = nodes.filter(node => typeof node.x === 'number' && typeof node.y === 'number')
    if (placed.length === 0) {
        return { bbox: { width: 0, height: 0 }, fill: 0, overlaps: 0, nearestNeighbourGap: 0 }
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
        }
    }

    const meanRadius = radiusSum / placed.length || 1
    return {
        bbox,
        fill,
        overlaps: overlaps / 2, // each pair is seen from both ends
        nearestNeighbourGap: gapCount ? gapSum / gapCount / meanRadius : 0,
    }
}
