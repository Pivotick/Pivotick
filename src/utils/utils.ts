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
