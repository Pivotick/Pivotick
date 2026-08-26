/**
 * The `Auto` tree spacing: pure functions deriving the {@link TreeSpacing} multipliers
 * from the tree that was just laid out. Nothing here touches d3, the DOM or the graph —
 * {@link TreeLayout} measures its own geometry and applies the answer through the same
 * two multipliers the flyout sliders drive, so what auto decides stays draggable.
 *
 * A tree needs this because the layout is sized from the canvas and never looks at how
 * big the nodes are: a tree of 40px avatars overlaps where one of 10px dots does not.
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
    /** The tightest pair *within* a level — the breadth axis. `null` for a bare chain. */
    sibling: TreeGap | null
    /**
     * A radial tree spreads every level over the full circle, so sibling crowding can only
     * be relieved by pushing the rings out — both measurements drive `levelSpacing`.
     */
    radial: boolean
    /** The multipliers the measurement was taken at — gaps scale linearly with them. */
    current: TreeSpacing
}

// ─── Tuning constants ───────────────────────────────────────────────────────

/** Room between two levels on top of the two radii — enough edge either side of a 12px arrowhead. */
const LEVEL_MARGIN = 24
/** …and between two neighbours within a level: a channel wide enough to read as a gap. */
const SIBLING_MARGIN = 16

/**
 * Auto only ever loosens a tree, never packs it tighter than the canvas-fitted layout:
 * the complaint it answers is crowding, and a small tree drawn as a knot in an empty
 * canvas is worse. Also makes auto a no-op on graphs that were never crowded.
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
 * Round up onto the slider's step, then clamp into auto's range. Non-finite input falls
 * back to the fitted layout: one unmeasured radius would otherwise turn a gap into `NaN`
 * and take every coordinate d3 derives from it with it.
 */
function toStep(value: number): number {
    if (!Number.isFinite(value)) return AUTO_FLOOR
    const stepped = Math.ceil(value / STEP) * STEP
    return Math.min(TREE_SPACING_RANGE[1], Math.max(AUTO_FLOOR, Math.round(stepped * 10) / 10))
}

/**
 * The spacing this tree wants. Exact rather than iterative: a gap scales linearly with
 * its multiplier, so `needed × current / measured` lands it in one pass.
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
