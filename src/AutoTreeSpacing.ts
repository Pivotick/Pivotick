/**
 * The `Auto` tree spacing: pure functions deriving the {@link TreeSpacing}
 * multipliers from the tree that was just laid out.
 *
 * Same division of labour as {@link tunePhysics}: nothing here touches d3, the DOM or
 * the graph. {@link TreeLayout} measures its own geometry — it is the only thing that
 * knows where the levels landed — hands over an {@link AutoTreeContext}, and applies
 * the answer through the same two multipliers the flyout sliders drive. So everything
 * auto decides stays visible, and can be taken over by dragging one.
 *
 * Why a tree needs this at all: the physics knobs are inert under a tree layout, and
 * the layout itself is sized from the canvas — it never looks at how big the nodes
 * are. A tree of 10px dots and a tree of 40px avatars are laid out identically, so
 * the second one overlaps.
 */
import { TREE_SPACING_RANGE, type TreeSpacing } from './Simulation'

/** How far apart a pair of neighbours *is*, against how far apart it needs to be. */
export interface TreeGap {
    /** Distance between the pair, in the layout this measurement was taken from. */
    measured: number
    /** Distance at which the pair stops crowding: both radii, plus breathing room. */
    needed: number
}

/** Everything the tuner is allowed to know. */
export interface AutoTreeContext {
    /** The tightest consecutive-level pair — the depth axis. `null` for a single-level tree. */
    level: TreeGap | null
    /**
     * The tightest pair *within* a level — the breadth axis. `null` when no level holds
     * two nodes, i.e. a bare chain, which has no siblings to separate.
     */
    sibling: TreeGap | null
    /**
     * A radial tree spreads every level over the full circle, so sibling crowding can
     * only be relieved by pushing the rings further out. Both measurements therefore
     * drive `levelSpacing`, and `siblingSpacing` is left alone.
     */
    radial: boolean
    /** The multipliers the measurement was taken at — gaps scale linearly with them. */
    current: TreeSpacing
}

// ─── Tuning constants ───────────────────────────────────────────────────────

/**
 * Room to leave between two levels on top of the two radii: a default arrowhead is
 * 12px, and it reads as an arrow rather than a smudge only with some visible edge
 * either side of it.
 */
const LEVEL_MARGIN = 24
/** …and between two neighbours within a level: a channel wide enough to read as a gap. */
const SIBLING_MARGIN = 16

/**
 * Auto never packs a tree *tighter* than the canvas-fitted layout, only looser.
 *
 * The complaint auto answers is crowding; a sparse graph's fitted layout is already
 * fine, and "just enough room" would draw every small tree as a tight knot in the
 * middle of an empty canvas. The floor also makes auto a bit-for-bit no-op on graphs
 * that were never crowded in the first place.
 */
const AUTO_FLOOR = 1
/** The slider's step: every value auto picks is one the user could have dragged to. */
const STEP = 0.1

/** What a pair needs, as a spacing multiplier — `needed / measured`, undone from `current`. */
export function requiredSpacing(gap: TreeGap | null, current: number): number {
    if (!gap) return AUTO_FLOOR
    // Two nodes in the same place can never be talked apart by a multiplier.
    if (gap.measured <= 0) return TREE_SPACING_RANGE[1]
    return (gap.needed / gap.measured) * current
}

/**
 * Round up onto the slider's step, then hold inside auto's own range.
 *
 * Non-finite input falls back to the fitted layout rather than passing the problem on.
 * A node whose radius is not a number — a custom node that has not measured itself yet,
 * or a `setCircleRadius(undefined)` — otherwise turns one gap into `NaN`, and from there
 * the multiplier, the tree's own size, and every coordinate d3 computes from it. Losing
 * a tune is nothing; losing every position is a blank canvas.
 */
function toStep(value: number): number {
    if (!Number.isFinite(value)) return AUTO_FLOOR
    const stepped = Math.ceil(value / STEP) * STEP
    return Math.min(TREE_SPACING_RANGE[1], Math.max(AUTO_FLOOR, Math.round(stepped * 10) / 10))
}

/**
 * The spacing this tree wants. Exact rather than iterative: a gap scales linearly
 * with its multiplier, so `needed × current / measured` is the answer in one pass,
 * and the pair that is tightest stays tightest (every gap on an axis scales by the
 * same factor).
 */
export function tuneTreeSpacing(ctx: AutoTreeContext): TreeSpacing {
    const level = requiredSpacing(ctx.level, ctx.current.levelSpacing)

    if (ctx.radial) {
        // The ring gap is the only lever, so it answers for both kinds of crowding.
        const rings = requiredSpacing(ctx.sibling, ctx.current.levelSpacing)
        return { levelSpacing: toStep(Math.max(level, rings)), siblingSpacing: ctx.current.siblingSpacing }
    }

    return {
        levelSpacing: toStep(level),
        siblingSpacing: toStep(requiredSpacing(ctx.sibling, ctx.current.siblingSpacing)),
    }
}

/** The gap two nodes need between their centres, along the depth axis. */
export function neededLevelGap(radiusA: number, radiusB: number): number {
    return radiusA + radiusB + LEVEL_MARGIN
}

/** The gap two nodes need between their centres, within a level. */
export function neededSiblingGap(radiusA: number, radiusB: number): number {
    return radiusA + radiusB + SIBLING_MARGIN
}
