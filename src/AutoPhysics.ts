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
    /**
     * Spread of the nearest-neighbour *gaps*, relative to their mean.
     *
     * This is the one number that tells a structured layout from a blob, and it earns
     * its place: a hand-tuned layout showing clear hub-and-spoke clusters and a
     * flattened one that reads as an even carpet measured *the same*
     * {@link nearestNeighbourGap} (0.98r vs 0.99r) while differing three-fold here
     * (1.26 vs 0.24). Clusters mean dense insides and empty gaps — uneven spacing.
     * An even disc has nothing to see and scores near zero.
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
    /** Present only for `feedback` — the previous settled layout. */
    measured?: MeasuredLayout
    /** The knobs in force right now, for relative/incremental strategies. */
    current: PhysicsKnobs
}

export type AutoStrategy = (ctx: AutoContext) => PhysicsKnobs

export type AutoStrategyName = 'hybrid' | 'fill' | 'feedback'

// ─── Tuning constants ───────────────────────────────────────────────────────
// Starting points, settled by eye and by the metrics overlay against fixtures A–F.

/** Area fill target for the smallest graphs — the camera's 3× fit does the rest. */
const FILL_MIN = 0.30
/**
 * …and for large ones. Deliberately the whole canvas rather than a fraction of it:
 * a lower target squeezes the link distance, and on a sparse graph the space that
 * gets squeezed out is the space *between* clusters — the layout's only visible
 * structure. A 300-node graph that slightly overflows and gets zoomed out reads
 * better than a compact one that reads as a single blob. Measured on a 301-node
 * forest: raising this recovered nearly all the cluster separation.
 */
const FILL_MAX = 1.0
/** `fillTarget` sits at `FILL_MIN` up to this node count… */
const FILL_REF_LO = 4
/** …and reaches `FILL_MAX` here. */
const FILL_REF_HI = 400

/** Clear space guaranteed between two mean-sized discs, whatever the area budget says. */
const GAP_MIN = 24
/**
 * Link distance as a multiple of the mean node radius — the primary length scale.
 *
 * This is the correction to the original design, which derived link distance from an
 * area budget alone (canvas ÷ node count). A budget cannot know how big the nodes
 * are, so on a graph of large nodes it asks for a spacing smaller than the nodes
 * themselves and the layout comes out as a carpet of touching discs: every cluster
 * packs into a hexagonal blob and the topology between them disappears.
 *
 * Two independent readings put the right value near 6.5×: a hand-tuned 118-node
 * graph of r=60 nodes that reads well sits at link 387 (6.5r), and the r=10 version
 * of the same graph, which also reads well, sits at 67 (6.7r). The area budget stays
 * on as a *lower* bound, so a sparse graph on a big canvas still spreads out.
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
 * Repulsion floor and ceiling.
 *
 * The floor matters more than it looks. The area budget divides the canvas by `N`,
 * so the charge it asks for falls away as the graph grows — and charge is precisely
 * what pushes *unrelated* subgraphs apart while links hold each cluster together.
 * That difference is what makes clusters visible, so letting it collapse turns a
 * large sparse graph into an even blob. Measured on a 301-node forest, raising
 * repulsion from 10 to 40 moved the separation ratio from 3.7 to 4.8 and the
 * local-density variation from 0.67 to 0.75; the floor is the library's historical
 * default of 38, which is the layout this is trying not to be worse than.
 */
const REPULSION_FLOOR = 38
const REPULSION_MAX = 95
/**
 * …but the floor itself eases off on very large graphs. d3's many-body force sums
 * over every node, so holding per-node charge constant makes the total grow without
 * bound: a 2000-node tree at the 300-node floor sprawls to ten canvases.
 *
 * Easing the *floor* rather than adding gravity is deliberate, and the measurements
 * say why. Repulsion scales a layout uniformly — dropping it from 38 to 6 on a
 * 300-node graph took the bounding box from 4.3 to 1.9 canvases while the
 * nearest-neighbour gap stayed proportional (3.95r → 1.94r), so the *relative*
 * structure survived. Gravity, being one inward pull applied equally to everything,
 * shrinks the gaps between clusters faster than the clusters themselves and flattens
 * the structure out. Same containment, very different cost.
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
/**
 * Calibration for the centring balance below. Derived by measuring, not by theory:
 * sweeping the gravity strength against settled 60-node and 7-node layouts put the
 * strength that lands each on its fill target at 0.08 and 0.09 respectively, which
 * back-solves to ~280 and ~215 through the balance. 240 splits them.
 */
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
 * graph grows.
 *
 * Compression costs nothing on a four-node graph — there is no cluster structure to
 * flatten — and it buys the thing that actually matters there: a compact layout is
 * one the camera can zoom *into*, so the nodes end up large. Take this away and the
 * four nodes spread until they fill the canvas at zoom ~0.9, which is how a graph
 * with plenty of room ends up rendering its nodes at 11px instead of 25px.
 *
 * The same compression on a 300-node graph flattens the only structure it has. So
 * the licence to compress is exactly the licence to not have clusters yet.
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
 * How much of the canvas the layout should cover *at zoom 1*.
 *
 * Deliberately not a constant: `fitAndCenter` scales the settled layout by up to
 * 3×, so a small graph only needs ~0.27 to end at ~80% on-screen coverage — and
 * stopping there is better, because the camera then zooms in and the nodes read
 * as nodes rather than as four dots on a 1200px canvas. Large graphs get no such
 * help (their fit is already ≤ 1), so the target climbs.
 */
export function fillTarget(nodeCount: number): number {
    return FILL_MIN + (FILL_MAX - FILL_MIN) * sizeFraction(nodeCount)
}

/**
 * Where a graph sits on the small-to-large scale: 0 at {@link FILL_REF_LO} nodes or
 * fewer, 1 at {@link FILL_REF_HI} or more, log-interpolated between. Several
 * decisions turn on "how big is this, really", and they should all turn on the
 * same number.
 */
function sizeFraction(nodeCount: number): number {
    return clamp01(
        Math.log10(Math.max(nodeCount, 1) / FILL_REF_LO) / Math.log10(FILL_REF_HI / FILL_REF_LO)
    )
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

/**
 * The repulsion floor for a graph of this size and node size.
 *
 * Eased down on very large graphs (see {@link REPULSION_FLOOR_REF_NODES}) and up for
 * large nodes: bigger discs need a proportionally harder push to open the same gap,
 * and the area budget cannot supply it. The exponent is fitted to the same two
 * hand-tuned graphs as {@link LINK_PER_RADIUS} — r=10 wants 38, r=60 wants ~100.
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
 * Gravity strength: a fence that keeps loose pieces in frame, not a size dial.
 *
 * A node at radius `R` is pushed out by roughly `N · |Q| / R²` and pulled in by
 * `R · s`; equating them at the fence radius gives `s = N · |Q| / R³`, scaled by an
 * empirical gain. The knob is quadratic (see `Simulation.setCentering`), so the
 * useful band — which spans two orders of magnitude — lands mid-slider.
 *
 * The ceiling is the important part, and it scales with **fragmentation**
 * (`components / nodes`). Gravity is a single inward pull applied equally to
 * everything, so it cannot create structure — it can only shrink, and what it
 * shrinks first is the empty space between clusters. It is therefore only worth
 * spending where links are *not* already doing the job:
 *
 *  - A 301-node forest in two components is held together by its own 300 links.
 *    Fragmentation ~0.007, so gravity stays near the floor and the layout keeps its
 *    shape. (Driving this graph to a fill target with gravity instead cost half its
 *    cluster separation — the regression this scaling exists to prevent.)
 *  - Seven nodes in four pieces, two of them lone, have almost nothing holding them.
 *    Fragmentation ~0.57, so gravity gets real authority and they stay in frame.
 */
function centeringKnob(
    effectiveCharge: number,
    canvas: AutoCanvas,
    nodeCount: number,
    looseNodeFraction: number,
): number {
    const radius = Math.max(1, CENTERING_FENCE * 0.5 * Math.min(canvas.width, canvas.height))
    const balance = CENTERING_GAIN * nodeCount * effectiveCharge / (radius * radius * radius)

    // Two independent licences to centre, whichever is larger:
    //  - the graph is small enough that compressing it costs no structure, and
    //  - some of it is in pieces nothing else is holding.
    // Cubic: the licence to compress should be gone by the time a graph is big
    // enough to have any structure worth keeping. A hand-tuned 118-node layout that
    // reads well sits at the historical gravity of 0.001, which is what this reaches.
    const smallCeiling = CENTERING_CEILING_BOUND
        + (CENTERING_CEILING_SMALL - CENTERING_CEILING_BOUND) * Math.pow(1 - sizeFraction(nodeCount), 3)
    // Linear, not sqrt: a graph with one loose node in a hundred needs a hundredth of
    // the help, and sqrt was handing it a sixth — enough to visibly compress a graph
    // whose links were holding it perfectly well.
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

// ─── Strategies ─────────────────────────────────────────────────────────────

/**
 * The area budget shared by `fill` and `hybrid`: give the graph `fillTarget(N)`
 * of the canvas and split it evenly between the nodes. `spacing` is the resulting
 * characteristic distance — one node's share of the budget, expressed as a length.
 */
function areaBudget(ctx: AutoContext): { targetArea: number; spacing: number } {
    const targetArea = fillTarget(ctx.nodeCount) * ctx.canvas.width * ctx.canvas.height
    return { targetArea, spacing: Math.sqrt(targetArea / Math.max(1, ctx.nodeCount)) }
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
    const { spacing } = areaBudget(ctx)
    const meanRadius = Math.max(1, ctx.radii.mean)

    // The two things that set a sensible edge length, whichever is larger: the room
    // each node has been budgeted, and the room its own size demands.
    const wanted = Math.max(0.8 * spacing, LINK_PER_RADIUS * meanRadius)
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

/**
 * `fill` — the same area budget with the radius clamps taken out. The control:
 * it should fail visibly wherever the clamps were doing the work (40 large nodes
 * get a ~124px per-node budget against a 120px diameter, so they touch), which is
 * what proves `hybrid`'s clamps are load-bearing rather than superstition.
 */
const fill: AutoStrategy = (ctx) => {
    const { spacing } = areaBudget(ctx)
    const meanRadius = Math.max(1, ctx.radii.mean)
    const repulsion = repulsionKnob(CHARGE_PER_AREA * spacing * spacing, meanRadius, ctx.nodeCount)

    return quantise({
        repulsion,
        linkDistance: clampKnob(0.8 * spacing, 'linkDistance'),
        collisionRadius: collisionKnob(COLLIDE_BASE),
        friction: frictionFor(ctx.nodeCount),
        centering: centeringKnob(chargeForKnob(repulsion, meanRadius), ctx.canvas, ctx.nodeCount, ctx.looseNodeFraction),
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
 * Measure a settled layout: its bounding box, how much of the canvas that covers,
 * how many node pairs overlap and how much clear space a node typically has.
 *
 * Overlaps and gaps go through a uniform spatial hash keyed on the largest contact
 * distance, so 2000 nodes stay a few thousand comparisons rather than two million.
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
