import { createCopyButton } from './PropertyList'

// Title auto-fit bounds: shrink a long title from MAX down to MIN px, wrapped
// over at most MAX_LINES lines, before giving up and switching to the
// type-aware fallback.
const TITLE_MAX_PX = 16
const TITLE_MIN_PX = 12
const TITLE_LINE_HEIGHT = 1.3
const TITLE_MAX_LINES = 2
// Both the sidebar main header and the tooltip use this base class for the name
// slot, so the fallback classes (.is-clamp / .is-identifier) resolve identically.
const TITLE_BASE_CLASS = 'pvt-mainheader-nodeinfo-name'

// A single hidden canvas reused to measure text width for middle-truncation.
let textMeasurer: CanvasRenderingContext2D | null = null
function measureTextWidth(text: string, font: string): number {
    if (!textMeasurer) textMeasurer = document.createElement('canvas').getContext('2d')
    if (!textMeasurer) return text.length * 8
    textMeasurer.font = font
    return textMeasurer.measureText(text).width
}

function elementFont(el: HTMLElement): string {
    const s = getComputedStyle(el)
    return `${s.fontWeight} ${s.fontSize} ${s.fontFamily}`
}

/** A title with no whitespace reads as an identifier (id, URL, hash, onion…). */
function looksLikeIdentifier(text: string): boolean {
    return !/\s/.test(text.trim())
}

/** Keep the head and tail of a too-long string, eliding the middle: `abcd…wxyz`. */
function middleTruncate(text: string, availPx: number, font: string): string {
    if (availPx <= 0 || measureTextWidth(text, font) <= availPx) return text
    const ellipsis = '…'
    // Slice by code points, not UTF-16 units, so surrogate pairs / emoji aren't cut
    // mid-character (which renders as U+FFFD).
    const chars = Array.from(text)
    let lo = 1, hi = chars.length - 1, best = ellipsis
    while (lo <= hi) {
        const keep = (lo + hi) >> 1
        const head = Math.ceil(keep / 2)
        const tail = Math.floor(keep / 2)
        const candidate = chars.slice(0, head).join('') + ellipsis + chars.slice(chars.length - tail).join('')
        if (measureTextWidth(candidate, font) <= availPx) { best = candidate; lo = keep + 1 }
        else hi = keep - 1
    }
    return best
}

/**
 * Fit a (possibly long) entity title into a fixed-width header name slot. Shared
 * by the sidebar main header and the tooltip so both read identically.
 *
 * Strategy: first **auto-fit** — shrink the font from 16px down to 12px so the
 * whole title fits across up to two lines. If it still doesn't fit at the floor
 * size, fall back to a **type-aware** treatment: prose gets a clean two-line
 * clamp with an ellipsis; identifier-like titles (ids, URLs, hashes) get a
 * monospace, middle-elided form (`abc…xyz`, both ends kept) plus a copy button,
 * since middle-elision replaces the text.
 *
 * Requires the element to be laid out (clientWidth > 0); callers should invoke
 * it once the slot has a width and re-invoke whenever that width changes.
 */
export function fitEntityTitle(nameElem: HTMLElement, actionElem: HTMLElement | null, text: string): void {
    // Reset to the auto-fit base state (normal wrap, no clamp, full text).
    nameElem.className = TITLE_BASE_CLASS
    nameElem.style.fontSize = ''
    nameElem.removeAttribute('title')
    nameElem.textContent = text
    actionElem?.replaceChildren()

    const avail = nameElem.clientWidth
    if (avail <= 0) return // collapsed / not yet laid out — caller refits later

    // 1) Auto-fit: the whole title, shrunk just enough to fit two lines.
    for (let size = TITLE_MAX_PX; size >= TITLE_MIN_PX; size--) {
        nameElem.style.fontSize = `${size}px`
        if (nameElem.scrollHeight <= Math.ceil(size * TITLE_LINE_HEIGHT * TITLE_MAX_LINES) + 1) return
    }

    // 2) Too large even at the floor size → type-aware fallback.
    nameElem.style.fontSize = ''
    nameElem.title = text
    if (looksLikeIdentifier(text)) {
        nameElem.classList.add('is-identifier')
        // Add the copy button first so it claims its cell, then middle-elide to the
        // width that's actually left — otherwise the elided text is a touch too wide
        // and the button spills past the edge.
        actionElem?.appendChild(createCopyButton(text))
        nameElem.textContent = middleTruncate(text, nameElem.clientWidth, elementFont(nameElem))
    } else {
        nameElem.classList.add('is-clamp')
    }
}
