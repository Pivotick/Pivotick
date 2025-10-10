export interface Point {
    x: number;
    y: number;
}

export interface Line {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
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

export interface BezierCurve {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    px0: number;
    py0: number;
    px1: number;
    py1: number;
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

export function getSegmentLengthAndMidpoint(path: SVGPathElement): { length: number, midpoint: Point } | null {
    if (!path) return null

    const d = path.getAttribute('d')
    if (!d) return null
    const lineParams = linePathParser(d)
    if (!lineParams) return null
    const { x0, y0, x1, y1 } = lineParams
    const dx = x1 - x0
    const dy = y1 - y0
    const midpoint = {
        x: x0 + dx / 2,
        y: y0 + dy / 2,
    }
    const length = Math.sqrt(dx * dx + dy * dy)
    return {
        length: length,
        midpoint: midpoint,
    }
}

/**
 * Approximates the total length of an SVG path numerically and its midpoint
 *
 * @param path - The SVGPathElement to approximate
 * @param samplesPerSegment - Number of sample points per path segment (default = 10)
 * @returns The approximate `{ length, midpoint }`, or `null` if invalid.
 */
export function getApproximateArcLengthAndMidpoint(
    path: SVGPathElement,
): { length: number, midpoint: Point } | null {

    if (!path) return null

    const d = path.getAttribute('d')
    if (!d) return null
    
    const arcParams = linkArcPathParser(d)
    if (!arcParams) return null

    const dx = arcParams.to.x - arcParams.from.x
    const dy = arcParams.to.y - arcParams.from.y
    const chord = Math.hypot(dx, dy)

    // Approximate central angle
    const r = arcParams.rx // We suppose rx == ry
    const theta = 2 * Math.asin(Math.min(chord / (2 * r), 1))

    // Arc length = r * θ
    const approximateLength = r * theta

    const mx = (arcParams.from.x + arcParams.to.x) / 2
    const my = (arcParams.from.y + arcParams.to.y) / 2

    // Distance from midpoint to center along perpendicular
    const h = Math.sqrt(Math.max(0, r * r - (chord / 2) ** 2))

    // Perpendicular direction (normal to chord)
    const nx = -dy / chord
    const ny = dx / chord

    const side = arcParams.sweepFlag !== arcParams.largeArcFlag ? 1 : -1

    const cx = mx + side * h * nx
    const cy = my + side * h * ny

    const angle0 = Math.atan2(arcParams.from.y - cy, arcParams.from.x - cx)
    const angle1 = Math.atan2(arcParams.to.y - cy, arcParams.to.x - cx)

    let deltaAngle = angle1 - angle0

    // Normalize to [-pi, pi] for shortest rotation
    while (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI
    while (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI

    // Now handle sweep flag
    if (arcParams.sweepFlag && deltaAngle < 0) deltaAngle += 2 * Math.PI
    if (!arcParams.sweepFlag && deltaAngle > 0) deltaAngle -= 2 * Math.PI

    // Midpoint angle
    const midAngle = angle0 + deltaAngle / 2

    const midpoint = {
        x: cx + r * Math.cos(midAngle),
        y: cy + r * Math.sin(midAngle)
    }

    return {
        length: approximateLength,
        midpoint: midpoint,
    }
}

/**
 * Approximates the length and midpoint of a cubic Bézier SVG path.
 *
 * Uses the curve’s control points to estimate its midpoint (t = 0.5) and a lightweight
 * length value for performance-sensitive use cases.
 *
 * @param path - The SVG path element to measure.
 * @returns The approximate `{ length, midpoint }`, or `null` if invalid.
 */
export function getApproximateCircleArcLengthAndMidpoint(path: SVGPathElement,
): { length: number, midpoint: Point } | null {

    if (!path) return null

    const d = path.getAttribute('d')
    if (!d) return null

    const curve = linkCircleArcPathParser(d)
    if (!curve) return null

    /** Let's keep this in case we ever need to have better estimation
    const segments = 2
    let length = 0
    let prev: Point = { x: curve.x0, y: curve.y0 }
    let midpoint: Point = prev
    let tMid = 0.5 // t parameter for midpoint

    for (let i = 1; i <= segments; i++) {
        const t = i / segments

        // Cubic Bézier formula using your interface
        const x =
            Math.pow(1 - t, 3) * curve.x0 +
            3 * Math.pow(1 - t, 2) * t * curve.px0 +
            3 * (1 - t) * t * t * curve.px1 +
            t * t * t * curve.x1

        const y =
            Math.pow(1 - t, 3) * curve.y0 +
            3 * Math.pow(1 - t, 2) * t * curve.py0 +
            3 * (1 - t) * t * t * curve.py1 +
            t * t * t * curve.y1

        const dx = x - prev.x
        const dy = y - prev.y
        length += Math.hypot(dx, dy)

        if (t >= tMid && tMid > 0) {
            midpoint = { x, y }
            tMid = -1 // midpoint captured
        }

        prev = { x, y }
    }
    */

    const t = 0.5
    const x =
        Math.pow(1 - t, 3) * curve.x0 +
        3 * Math.pow(1 - t, 2) * t * curve.px0 +
        3 * (1 - t) * t * t * curve.px1 +
        t * t * t * curve.x1

    const y =
        Math.pow(1 - t, 3) * curve.y0 +
        3 * Math.pow(1 - t, 2) * t * curve.py0 +
        3 * (1 - t) * t * t * curve.py1 +
        t * t * t * curve.y1

    const length = Math.hypot(x, y)

    const midpoint = { x, y }

    return { length, midpoint }
}

export function linkArcPathParser(d: string): ArcParams | null {
    if (!d) return null

    const parts = tokenizePath(d)
    if (parts.length !== 9 || parts[0][0] !== 'M' || parts[2][0] !== 'A') return null

    const arcParams: ArcParams = {
        from: { x: parseFloat(parts[0].slice(1)), y: parseFloat(parts[1]) },
        to: { x: parseFloat(parts[7]), y: parseFloat(parts[8]) },
        rx: parseFloat(parts[2].slice(1)),
        ry: parseFloat(parts[3]),
        xAxisRotation: 0,
        largeArcFlag: false,
        sweepFlag: true,
    }
    return arcParams
}

export function linkCircleArcPathParser(d: string): BezierCurve | null {
    if (!d) return null

    const parts = tokenizePath(d)
    if (parts.length !== 10 || parts[0][0] !== 'M' || parts[3][0] !== 'C') return null

    const bezierParams: BezierCurve = {
        x0: parseFloat(parts[1]),
        y0: parseFloat(parts[2]),
        x1: parseFloat(parts[8]),
        y1: parseFloat(parts[9]),
        px0: parseFloat(parts[4]),
        py0: parseFloat(parts[5]),
        px1: parseFloat(parts[6]),
        py1: parseFloat(parts[7]),
    }
    return bezierParams
}

export function linePathParser(d: string): Line | null {
    if (!d) return null

    const parts = tokenizePath(d)
    if (parts.length !== 6 || parts[0] !== 'M' || parts[3] !== 'L') return null

    const lineParam: Line = {
        x0: parseFloat(parts[0]),
        y0: parseFloat(parts[1]),
        x1: parseFloat(parts[4]),
        y1: parseFloat(parts[5]),
    }
    return lineParam
}

/**
 * Tokenizes an SVG path `d` string into commands and numbers.
 * Trims whitespace and splits on spaces or commas.
 *
 * @param d - The SVG path data string
 * @returns Array of tokens (strings)
 */
function tokenizePath(d: string): string[] {
    const tokens: string[] = []
    let token = ''
    let start = 0
    let end = d.length - 1

    // Trim leading whitespace
    while (start <= end && (d[start] === ' ' || d[start] === '\n' || d[start] === '\t' || d[start] === ',')) start++

    // Trim trailing whitespace
    while (end >= start && (d[end] === ' ' || d[end] === '\n' || d[end] === '\t' || d[end] === ',')) end--

    for (let i = start; i <= end; i++) {
        const c = d[i]
        if (c === ' ' || c === ',' || c === '\n' || c === '\t') {
            if (token) {
                tokens.push(token)
                token = ''
            }
        } else {
            token += c
        }
    }

    if (token) tokens.push(token)

    return tokens
}