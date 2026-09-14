/**
 * Colours arriving with the graph data are written into CSS custom properties, and several
 * rules substitute those straight into `background:`. A value that is not a colour is a live
 * declaration in that position — `url(…)` fetches the moment the element renders — so the
 * string has to be checked before it reaches the CSSOM.
 */

/**
 * What disqualifies a value before `CSS.supports` is asked.
 *
 * `var()`, `env()` and `attr()` defer their resolution, and `CSS.supports('color', …)` answers
 * yes to all three however their fallback is spelled: `var(--nothing, url(…))` passes the
 * colour test and then resolves to the URL. Backslashes and comments go too, since either can
 * spell those names past a plain match.
 */
const DEFERS_OR_FETCHES = /\\|\/\*|\b(?:url|var|env|attr)\(/i

/** True when `value` is a self-contained CSS colour, safe to hand to the CSSOM. */
export function isSafeColor(value: string): boolean {
    if (DEFERS_OR_FETCHES.test(value)) return false
    return CSS.supports('color', value)
}
