import type { Node } from '../../Node'

/** Enough to keep an open group's members together, not enough to pack them. */
const STRENGTH = 0.06

/**
 * A light pull of each open group's members toward their centroid, so they read as one
 * set on the canvas. Pinned members stay put and still count toward the centroid.
 */
export function forceGroupCohesion(groups: () => Array<{ parts: Node[] }>) {
    function force(alpha: number) {
        for (const group of groups()) {
            const parts = group.parts.filter(part =>
                part.canvasRepresentative() === part && part.onCanvas && part.x != null && part.y != null)
            if (parts.length < 2) continue
            let cx = 0
            let cy = 0
            for (const part of parts) {
                cx += part.x as number
                cy += part.y as number
            }
            cx /= parts.length
            cy /= parts.length
            const k = STRENGTH * alpha
            for (const part of parts) {
                if (part.fx != null || part.fy != null) continue
                part.vx = (part.vx ?? 0) + (cx - (part.x as number)) * k
                part.vy = (part.vy ?? 0) + (cy - (part.y as number)) * k
            }
        }
    }
    force.initialize = () => {}
    return force
}
