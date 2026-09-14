/**
 * The lowercase scheme of `url` without its colon, or `null` when it has none.
 *
 * A `null` scheme does not mean the URL stays on this origin: `//host/path` carries no scheme and
 * still leaves it. Ask `isProtocolRelative` about that shape rather than reading `null` as local.
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

/**
 * True when `url` is scheme-relative, or carries one of `allowed`.
 *
 * Scheme-less is not the same as same-origin — see `isProtocolRelative`, which callers that
 * navigate need on top of this.
 */
export function hasAllowedScheme(url: string, allowed: readonly string[]): boolean {
    const scheme = urlScheme(url)
    return scheme === null || allowed.includes(scheme)
}

/**
 * True when `url` names a host without naming a scheme — `//host/path`, which inherits the page's
 * scheme and leaves its origin. The backslash spellings count: the URL parser folds `\\` and `/\`
 * into `//` for http(s) pages, so all four forms navigate off-origin.
 */
export function isProtocolRelative(url: string): boolean {
    // eslint-disable-next-line no-control-regex -- same normalization as urlScheme
    const normalized = url.replace(/[\x00-\x20]+/g, '')
    return /^[/\\]{2}/.test(normalized)
}
