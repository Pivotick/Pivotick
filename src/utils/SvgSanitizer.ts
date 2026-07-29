import DOMPurify from 'dompurify'

/**
 * Parse SVG icon markup that may have come from graph data — `style.svgIcon` is part of the
 * per-node `style` bag, so it is as untrusted as `data.*`.
 *
 * The markup is sanitized as a string so DOMPurify parses it in an inert document: assigning it
 * to a live element's `innerHTML` first would already have kicked off subresource loads, and a
 * pending `<img onerror>` still fires after the element is removed.
 *
 * DOMPurify's HTML parser only namespaces SVG content under an `<svg>` root, so a bare fragment
 * (a lone `<path>`, as the SVG-namespace parse this replaces accepted) is wrapped for the round
 * trip and unwrapped again — callers get back exactly the nodes they passed in, minus scripting.
 */
export function parseSvgIconMarkup(markup: string): DocumentFragment {
    const trimmed = markup.trim()
    const isRooted = /^<svg[\s>]/i.test(trimmed)

    const clean = DOMPurify.sanitize(isRooted ? trimmed : `<svg>${trimmed}</svg>`, {
        USE_PROFILES: { svg: true, svgFilters: true },
        RETURN_DOM_FRAGMENT: true,
    })
    if (isRooted) return clean

    const wrapper = clean.firstElementChild
    const unwrapped = document.createDocumentFragment()
    while (wrapper?.firstChild) {
        unwrapped.appendChild(wrapper.firstChild)
    }
    return unwrapped
}
