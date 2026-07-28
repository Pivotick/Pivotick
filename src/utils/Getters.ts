/**
 * Resolves the input to a string. If it's a function, it is invoked with the given arguments.
 *
 * @param input - A string or a function that returns a string.
 * @param args - Arguments to pass to the function, if applicable.
 * @returns A string if resolved successfully, otherwise undefined.
 */
export function tryResolveString<T extends unknown[]>(
    input: string | ((...args: T) => string),
    ...args: T
): string | undefined {
    
    if (typeof input === 'string') {
        return input
    } else if (typeof input === 'function') {
        const result = input(...args)
        return typeof result === 'string' ? result : undefined
    }
    return undefined
}

/**
 * Resolves the input to a boolean. If it's a function, it is invoked with the given arguments.
 *
 * @param input - A boolean or a function that returns a boolean.
 * @param args - Arguments to pass to the function, if applicable.
 * @returns A boolean if resolved successfully, otherwise undefined.
 */
export function tryResolveBoolean<T extends unknown[]>(
    input: boolean | ((...args: T) => boolean),
    ...args: T
): boolean | undefined {
    if (typeof input === 'boolean') {
        return input
    } else if (typeof input === 'function') {
        const result = input(...args)
        return (typeof result === 'boolean') ? result : undefined
    }
    return undefined
}

/**
 * Resolves the input to a number. If it's a function, it is invoked with the given arguments.
 *
 * @param input - A number or a function that returns a number.
 * @param args - Arguments to pass to the function, if applicable.
 * @returns A number if resolved successfully, otherwise undefined.
 */
export function tryResolveNumber<T extends unknown[]>(
    input: number | ((...args: T) => number),
    ...args: T
): number | undefined {
    if (typeof input === 'number') {
        return input
    } else if (typeof input === 'function') {
        const result = input(...args)
        return (typeof result === 'number') ? result : undefined
    }
    return undefined
}

/**
 * Resolves the input to a string, boolean or number. If it's a function, it is invoked with the given arguments.
 *
 * @param input - A string or a function that returns a string.
 * @param args - Arguments to pass to the function, if applicable.
 * @returns A string if resolved successfully, otherwise undefined.
 */
export function tryResolveValue<T extends unknown[]>(
    input: string | boolean | number | ((...args: T) => string | boolean | number),
    ...args: T
): string | boolean | number | undefined {
    if (typeof input === 'string' || typeof input === 'boolean' || typeof input === 'number') {
        return input
    } else if (typeof input === 'function') {
        const result = input(...args)
        return (typeof result === 'string' || typeof result === 'boolean' || typeof result === 'number') ? result : undefined
    }
    return undefined
}

// /**
//  * Resolves the input to a string, boolean or number. If it's a function, it is invoked with the given arguments.
//  *
//  * @param input - A string or a function that returns a string.
//  * @param args - Arguments to pass to the function, if applicable.
//  * @returns A string if resolved successfully, otherwise undefined.
//  */
// export function tryResolveValue<T extends unknown[], R>(
//     input: R | ((...args: T) => R),
//     ...args: T
// ): R | undefined {
//     if (typeof input === 'function') {
//         const result = (input as (...a: T) => R)(...args)
//         return result === undefined ? undefined : result
//     }
//     return input === undefined ? undefined : input
// }

/**
 * Resolves the input to an Array. If it's a function, it is invoked with the given arguments.
 *
 * @param input - An Array or a function that returns a Array.
 * @param args - Arguments to pass to the function, if applicable.
 * @returns An Array if resolved successfully, otherwise undefined.
 */
export function tryResolveArray<TArgs extends unknown[], TItem>(
    input: TItem[] | ((...args: TArgs) => TItem[]),
    ...args: TArgs
): TItem[] {
    
    if (Array.isArray(input)) {
        return input
    } else if (typeof input === 'function') {
        const result = input(...args)
        return Array.isArray(result) ? result : []
    }
    return []
}

function textSpan(text: string): HTMLElement {
    const span = document.createElement('span')
    span.textContent = text
    return span
}

/**
 * Resolves the input to an html element. If it's a function, it is invoked with the given arguments.
 *
 * A string resolves to a `<span>` carrying it as **text**; it is never parsed as markup, since
 * these values routinely carry graph data. Return an element to render your own HTML.
 *
 * @param input - A string, an element, or a function returning either.
 * @param args - Arguments to pass to the function, if applicable.
 * @returns A html element if resolved successfully, otherwise undefined.
 */
export function tryResolveHTMLElement<T extends unknown[]>(
    input: string | HTMLElement | ((...args: T) => string | HTMLElement),
    ...args: T
): HTMLElement | undefined {

    const resolved: unknown = typeof input === 'function' ? input(...args) : input

    // Element, not HTMLElement: an SVG element a render callback hands back passes through too.
    if (resolved instanceof Element) {
        return resolved as HTMLElement
    } else if (typeof resolved === 'string') {
        return textSpan(resolved.trim())
    } else if (typeof resolved === 'boolean') {
        return textSpan(String(resolved))
    } else if (typeof resolved === 'object') {
        return textSpan(JSON.stringify(resolved, undefined, 2))
    }
    return undefined
}

/**
 * The pieces needed to render a class-based icon font glyph inside an SVG `<text>`:
 * the glyph character plus the font properties that make it render.
 */
export interface ResolvedIcon {
    /** The glyph character, or '' when nothing resolvable from the class. */
    glyph: string
    /** Computed font-family that renders the glyph (e.g. `"Font Awesome 7 Free"`, `"MISP Icons"`). */
    fontFamily: string
    /** Computed font-weight (FA distinguishes solid/regular by weight). */
    fontWeight: string
    /** Computed font-style. */
    fontStyle: string
}

const iconResolveCache = new Map<string, ResolvedIcon>()

/**
 * Resolves a class-based icon font (FontAwesome, misp-iconify, Fontello, icomoon, …) into
 * everything needed to render it inside an SVG `<text>` — which, unlike HTML, cannot render
 * `::before` generated content.
 *
 * It probes the computed `::before` of a throwaway element, reading both the `content` (the
 * glyph) and the inherited `font-family`/`font-weight`/`font-style`. This makes no
 * font-specific assumptions (no `--fa` / `--misp-icon`): it works for any icon font that
 * declares its glyph via `::before { content }`. Results are cached by class string to avoid
 * per-node layout thrash.
 *
 * @param className - The full icon class string, e.g. `"fa-solid fa-user"` or
 *                    `"misp-icon misp-icon-event misp-hexagone"`.
 * @returns The resolved glyph + font properties. `glyph` is '' when the class resolves to nothing.
 *
 * @example
 * const { glyph, fontFamily } = resolveIcon("fa-solid fa-user");
 * text.text(glyph).style("font-family", fontFamily);
 */
export function resolveIcon(className: string): ResolvedIcon {
    const key = className.trim()
    if (!key) return { glyph: '', fontFamily: '', fontWeight: '', fontStyle: '' }

    const cached = iconResolveCache.get(key)
    if (cached) return cached

    const el = document.createElement('i')
    el.className = key
    // The probe must be laid out (not display:none) for ::before to compute; keep it off-screen.
    el.style.position = 'absolute'
    el.style.left = '-9999px'
    el.style.top = '-9999px'
    el.style.visibility = 'hidden'
    document.body.appendChild(el)

    const before = getComputedStyle(el, '::before')
    const resolved: ResolvedIcon = {
        glyph: parseIconContent(before.content),
        fontFamily: before.fontFamily,
        fontWeight: before.fontWeight,
        fontStyle: before.fontStyle,
    }

    document.body.removeChild(el)
    iconResolveCache.set(key, resolved)
    return resolved
}

/**
 * Extracts the glyph from a computed CSS `content` value. Grabs the first quoted string —
 * which handles FontAwesome's alt-text syntax (`"\f007" / ""`) — and rejects `none`/`normal`
 * and function values (`counter()`/`attr()`/`url()`) that aren't renderable glyphs.
 */
function parseIconContent(content: string): string {
    if (!content || content === 'none' || content === 'normal') return ''
    if (/counter\(|counters\(|attr\(|url\(/.test(content)) return ''
    const match = content.match(/(['"])((?:\\.|(?!\1).)*)\1/)
    return match ? match[2] : ''
}
