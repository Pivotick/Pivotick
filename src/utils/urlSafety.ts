/**
 * The lowercase scheme of `url` without its colon, or `null` when it has none — i.e. a relative
 * path, which can neither navigate off-origin nor execute.
 *
 * Browsers ignore ASCII whitespace and control characters inside a scheme, so `java\tscript:` is
 * `javascript:`; they are stripped before matching.
 */
export function urlScheme(url: string): string | null {
    // eslint-disable-next-line no-control-regex -- stripping control chars is the point
    const normalized = url.replace(/[\x00-\x20]+/g, '')
    const match = /^([a-z][a-z0-9+.-]*):/i.exec(normalized)
    return match ? match[1].toLowerCase() : null
}

/** Schemes a link may point at. `data:` is absent: it navigates, unlike an image fetch. */
export const SAFE_LINK_SCHEMES: readonly string[] = ['http', 'https', 'mailto', 'ftp', 'tel']

/** Schemes an image may be fetched from. Script can't run from an image, so `data:`/`blob:` are in. */
export const SAFE_IMAGE_SCHEMES: readonly string[] = ['http', 'https', 'data', 'blob']

/** True when `url` is relative, or carries one of `allowed`. */
export function hasAllowedScheme(url: string, allowed: readonly string[]): boolean {
    const scheme = urlScheme(url)
    return scheme === null || allowed.includes(scheme)
}
