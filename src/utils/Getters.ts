
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