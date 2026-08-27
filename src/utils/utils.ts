/* eslint-disable @typescript-eslint/no-explicit-any */

export function deepMerge<T>(target: T, source: Partial<T>): T {
    if (Array.isArray(target) && Array.isArray(source)) {
        return [...target, ...source] as T
    } else if (
        typeof target === 'object' &&
        typeof source === 'object' &&
        target &&
        source
    ) {
        const result: any = { ...target }
        for (const key in source) {
            if (Object.prototype.hasOwnProperty.call(source, key)) {
                if (key in target) {
                    result[key] = deepMerge((target as any)[key], (source as any)[key])
                } else {
                    result[key] = (source as any)[key]
                }
            }
        }
        return result
    }
    return source as T
}

export type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

/**
 * Deep copy of `value` with every function-valued entry dropped, so the result survives
 * `postMessage`'s structured clone. Style blocks are the reason this exists: a resolvable
 * channel (`color`, `size`, `styleCb`, `badges`, an edge's `markerEnd`…) may hold a function,
 * and one anywhere in the payload throws `DataCloneError` for the whole message.
 *
 * Only plain objects and arrays are walked; anything else structured-clonable (Date, RegExp,
 * typed arrays…) is passed through untouched. Cycles resolve to `undefined` rather than hanging.
 */
export function stripFunctions<T>(value: T, seen: WeakSet<object> = new WeakSet()): T {
    if (typeof value === 'function') return undefined as T
    if (value === null || typeof value !== 'object') return value

    const asObject = value as unknown as object
    if (seen.has(asObject)) return undefined as T
    seen.add(asObject)

    if (Array.isArray(value)) {
        return value.map((entry) => stripFunctions(entry, seen)) as T
    }
    if (Object.getPrototypeOf(value) !== Object.prototype) return value

    const result: any = {}
    for (const [key, entry] of Object.entries(value)) {
        if (typeof entry === 'function') continue
        result[key] = stripFunctions(entry, seen)
    }
    return result as T
}

/**
 * Escape a string for interpolation into HTML text *or* a quoted attribute value — quotes are
 * included so one helper covers both contexts and can't be misapplied.
 */
export function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

/**
 * Whether a resolved CSS paint draws nothing: `none`, or any colour at zero alpha.
 *
 * A shapeless node (`shape: 'none'`) is painted in `transparent` so it stays invisible but
 * still hit-testable, which anything borrowing a node's colour has to notice — an edge or a
 * cluster halo tinted from it would otherwise come out invisible too.
 */
export function isInvisiblePaint(paint: string | null | undefined): boolean {
    if (!paint) return true
    const value = paint.trim().toLowerCase()
    return value === 'none' || value === 'transparent' || /,\s*0(\.0+)?\s*\)$/.test(value)
}
