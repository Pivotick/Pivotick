export interface Point {
    x: number;
    y: number;
}

export interface Circle {
    cx: number;
    cy: number;
    r: number;
}

export interface ArcParams {
    rx: number;
    ry: number;
    xAxisRotation: number; // degrees
    largeArcFlag: boolean;
    sweepFlag: boolean;
    from: Point;
    to: Point;
}

export interface ArcCenterResult {
    cx: number;
    cy: number;
    startAngle: number; // radians
    deltaAngle: number; // radians
    rx: number;
    ry: number;
    xAxisRotation: number; // radians
}

/**
 * Converts degrees to radians.
 */
export function degToRad(degrees: number): number {
    return (degrees * Math.PI) / 180
}

/**
 * Normalize angle to [0, 2π)
 */
export function normalizeAngle(angle: number): number {
    while (angle < 0) angle += 2 * Math.PI
    while (angle >= 2 * Math.PI) angle -= 2 * Math.PI
    return angle
}

/**
 * Recover ellipse center and angles from SVG arc parameters.
 * Based on SVG implementation notes: https://www.w3.org/TR/SVG/implnote.html#ArcImplementationNotes
 */
export function getArcCenter(params: ArcParams): ArcCenterResult {
    let { rx, ry } = params
    const { xAxisRotation, largeArcFlag, sweepFlag, from, to } = params
    const phi = degToRad(xAxisRotation)
    const cos_phi = Math.cos(phi)
    const sin_phi = Math.sin(phi)

    // Step 1: Compute (x1', y1')
    const dx = (from.x - to.x) / 2
    const dy = (from.y - to.y) / 2

    const x1p = cos_phi * dx + sin_phi * dy
    const y1p = -sin_phi * dx + cos_phi * dy

    // Ensure radii are large enough
    let rxsq = rx * rx
    let rysq = ry * ry
    const x1psq = x1p * x1p
    const y1psq = y1p * y1p

    // Correct radii if too small
    const radicant = x1psq / rxsq + y1psq / rysq
    if (radicant > 1) {
        const scale = Math.sqrt(radicant)
        rx *= scale
        ry *= scale
        rxsq = rx * rx
        rysq = ry * ry
    }

    // Step 2: Compute (cx', cy')
    const sign = (largeArcFlag !== sweepFlag) ? 1 : -1
    const numerator = rxsq * rysq - rxsq * y1psq - rysq * x1psq
    const denominator = rxsq * y1psq + rysq * x1psq
    const coef = sign * Math.sqrt(Math.max(0, numerator / denominator))

    const cxp = coef * ((rx * y1p) / ry)
    const cyp = coef * (-(ry * x1p) / rx)

    // Step 3: Compute (cx, cy) from (cx', cy')
    const cx = cos_phi * cxp - sin_phi * cyp + (from.x + to.x) / 2
    const cy = sin_phi * cxp + cos_phi * cyp + (from.y + to.y) / 2

    // Step 4: Compute start angle and delta angle
    // Vector angle helper
    function vectorAngle(ux: number, uy: number, vx: number, vy: number): number {
        const dot = ux * vx + uy * vy
        const len = Math.sqrt(ux * ux + uy * uy) * Math.sqrt(vx * vx + vy * vy)
        let ang = Math.acos(Math.min(Math.max(dot / len, -1), 1)) // clamp due to floating errors
        if (ux * vy - uy * vx < 0) ang = -ang
        return ang
    }

    // Compute start angle
    const vx1 = (x1p - cxp) / rx
    const vy1 = (y1p - cyp) / ry
    const vx2 = (-x1p - cxp) / rx
    const vy2 = (-y1p - cyp) / ry

    let startAngle = vectorAngle(1, 0, vx1, vy1)
    let deltaAngle = vectorAngle(vx1, vy1, vx2, vy2)

    if (!sweepFlag && deltaAngle > 0) {
        deltaAngle -= 2 * Math.PI
    } else if (sweepFlag && deltaAngle < 0) {
        deltaAngle += 2 * Math.PI
    }

    startAngle = normalizeAngle(startAngle)
    deltaAngle = normalizeAngle(deltaAngle)

    return {
        cx,
        cy,
        startAngle,
        deltaAngle,
        rx,
        ry,
        xAxisRotation,
    }
}

/**
* Find intersection points between two circles:
* Circle 1: center (cx, cy), radius r
* Circle 2: center (to.x, to.y), radius rTo
* Returns 0, 1 or 2 intersection points as array of Points.
*/
export function circleCircleIntersections(
    cx_0: number,
    cy_0: number,
    r_0: number,
    cx_1: number,
    cy_1: number,
    r_1: number
): Point[] {
    const dx = cx_1 - cx_0
    const dy = cy_1 - cy_0
    const d = Math.sqrt(dx * dx + dy * dy)

    // No solution cases
    if (d > r_0 + r_1) return [] // Circles too far apart
    if (d < Math.abs(r_0 - r_1)) return [] // One circle inside the other
    if (d === 0 && r_0 === r_1) return [] // Circles coincide

    // Find intersection points
    const a = (r_0 * r_0 - r_1 * r_1 + d * d) / (2 * d)
    const h = Math.sqrt(r_0 * r_0 - a * a)

    const xm = cx_0 + (a * dx) / d
    const ym = cy_0 + (a * dy) / d

    const xs1 = xm + (h * dy) / d
    const ys1 = ym - (h * dx) / d

    const xs2 = xm - (h * dy) / d
    const ys2 = ym + (h * dx) / d

    if (h === 0) {
        return [{ x: xs1, y: ys1 }] // One intersection (tangent)
    }

    return [
        { x: xs1, y: ys1 },
        { x: xs2, y: ys2 },
    ]
}

export function isAngleOnArc(
    angle: number,
    start: number,
    delta: number
): boolean {
    angle = normalizeAngle(angle)
    start = normalizeAngle(start)
    const end = normalizeAngle(start + delta)

    if (delta >= 0) {
        if (start <= end) {
            return angle >= start && angle <= end
        } else {
            // Wrap around 2π
            return angle >= start || angle <= end
        }
    } else {
        if (end <= start) {
            return angle <= start && angle >= end
        } else {
            // Wrap around 0
            return angle <= start || angle >= end
        }
    }
}

export function pickValidArcIntersection(
    intersections: Point[],
    arc: ArcCenterResult
): Point | null {
    const { cx, cy, startAngle, deltaAngle } = arc

    for (const pt of intersections) {
        const angle = Math.atan2(pt.y - cy, pt.x - cx)
        if (isAngleOnArc(angle, startAngle, deltaAngle)) {
            return pt
        }
    }

    return null // none match (unlikely)
}

export function getArcIntersectionWithCircle(arcParams: ArcParams, circle: Circle): Point | null {
    const arcCenter = getArcCenter(arcParams)
    if (arcCenter.rx === arcCenter.ry && arcCenter.xAxisRotation === 0) {
        // Circular arc shortcut
        const intersections = circleCircleIntersections(
            arcCenter.cx,
            arcCenter.cy,
            arcCenter.rx,
            circle.cx,
            circle.cy,
            circle.r
        )

        const validIntersection = pickValidArcIntersection(intersections, arcCenter)
        if (!validIntersection)
            return null

        return validIntersection
    } else {
        console.log('Arc is elliptical or rotated, numerical methods needed for intersection.')
        return null
    }
}