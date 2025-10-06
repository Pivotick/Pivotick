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
 * Resolves the input to a string. If it's a function, it is invoked with the given arguments.
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

/**
 * Returns the Font Awesome glyph character for a given icon class (e.g. "fa-solid fa-user").
 * 
 * This function reads the CSS custom property `--fa` defined by Font Awesome for the icon class.
 * 
 * @param className - The full Font Awesome class string for the icon (e.g. "fa-solid fa-user").
 * @returns The Unicode glyph character corresponding to the icon, which can be used in SVG <text>.
 * 
 * @example
 * const glyph = faGlyph("fa-solid fa-user");
 * nodeSelection.append("text").text(glyph);
 */
export function faGlyph(className: string): string {
    const el = document.createElement('i')
    el.className = className
    document.body.appendChild(el)

    const style = getComputedStyle(el)
    const propertyValue = style.getPropertyValue('--fa')
    let glyph = propertyValue.replace(/["']/g, '')
    const codePoint = parseInt(glyph.slice(1), 16)
    glyph = String.fromCharCode(codePoint)

    document.body.removeChild(el)
    return glyph
}
