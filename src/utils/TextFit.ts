// A single hidden canvas reused to measure text width.
let textMeasurer: CanvasRenderingContext2D | null = null

// Redraws measure the same strings again, so widths are memoised per font + text.
const MEMO_LIMIT = 5000
const widthMemo = new Map<string, number>()

/** Width of `text` drawn in the CSS `font` shorthand, in CSS pixels. */
export function measureTextWidth(text: string, font: string): number {
    const key = `${font}\n${text}`
    const memoised = widthMemo.get(key)
    if (memoised !== undefined) return memoised

    if (!textMeasurer) textMeasurer = document.createElement('canvas').getContext('2d')
    let width: number
    if (textMeasurer) {
        textMeasurer.font = font
        width = textMeasurer.measureText(text).width
    } else {
        width = text.length * 8
    }

    if (widthMemo.size >= MEMO_LIMIT) widthMemo.clear()
    widthMemo.set(key, width)
    return width
}

/** Keep the head and tail of a too-long string, eliding the middle: `abcd…wxyz`. */
export function middleTruncate(text: string, availPx: number, font: string): string {
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
