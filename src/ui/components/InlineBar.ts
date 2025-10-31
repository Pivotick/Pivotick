/**
 * Creates an inline horizontal bar representing a proportion of a total.
 *
 * @param value - The count
 * @param total - The total.
 * @returns HTMLSpanElement containing the bar and percentage.
 */
export function createInlineBar(
    value: number,
    total: number
): HTMLSpanElement {
    const percentage = total > 0 ? (value / total) * 100 : 0

    // Root span
    const root = document.createElement('span')
    root.style.display = 'flex'
    root.style.alignItems = 'center'
    root.style.gap = '0.5rem'
    root.style.fontFamily = 'sans-serif'
    root.style.fontSize = '0.85rem'
    root.title = `${value}`

    // Bar container
    const barContainer = document.createElement('span')
    barContainer.classList.add('pivotick-inline-bar-container')
    root.appendChild(barContainer)

    // Bar fill
    const barFill = document.createElement('span')
    barFill.classList.add('pivotick-inline-bar-fill')
    barFill.style.width = `${percentage}%`
    barContainer.appendChild(barFill)

    // Percentage text
    const percentSpan = document.createElement('span')
    percentSpan.textContent = `${percentage.toFixed(0)}%`
    percentSpan.classList.add('pivotick-inline-bar-percent')
    root.appendChild(percentSpan)

    return root
}