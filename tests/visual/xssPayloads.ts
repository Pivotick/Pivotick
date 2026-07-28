/**
 * Script payloads shared by the `xss` fixture (browser side) and `security.spec.ts` (node side).
 *
 * Kept free of imports on purpose: the spec needs these at runtime, and importing them from
 * `harness/fixtures.ts` would drag `src/index` — stylesheet and all — through Playwright's
 * Node-side transform.
 */

/**
 * The statement a payload runs if it ever executes: appends its tag to `window.__pvtXss`, which
 * the security spec reads back. Deliberately bracket-free — the `[[node]]` tokenizer rejects
 * `[` and `]`, so a payload containing them would never reach the renderer under test.
 */
export function xssReport(tag: string): string {
    return `window.__pvtXss=(window.__pvtXss||'')+'${tag},'`
}

/** An `<img>` whose failed load fires {@link xssReport} — inert unless parsed as markup. */
export function xssPayload(tag: string): string {
    return `<img src=/pvt-xss-${tag}.png onerror="${xssReport(tag)}">`
}

/** Inline SVG whose `<image>` carries a payload handler, for a node's `style.svgIcon`. */
export function xssSvgIcon(tag: string): string {
    return `<svg xmlns="http://www.w3.org/2000/svg"><image href="/pvt-xss-${tag}.png" onerror="${xssReport(tag)}"/></svg>`
}

/** Note content whose `[[…]]` reference name tries to break out of its attribute. */
export const XSS_NOTE = `see [[x"><img src=/pvt-xss-note.png onerror="${xssReport('note-reference')}">]] here`

/** The reference name the tokenizer should capture from {@link XSS_NOTE}, verbatim. */
export const XSS_NOTE_REFERENCE_NAME = `x"><img src=/pvt-xss-note.png onerror="${xssReport('note-reference')}">`
