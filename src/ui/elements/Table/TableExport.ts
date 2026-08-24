import type { Edge } from '../../../Edge'
import type { Node } from '../../../Node'
import type { TableColumn } from '../../../interfaces/GraphUI'

type Element = Node | Edge

/** A row as the grid holds it: the element, plus its raw values by column key. */
export interface ExportRow {
    element: Element
    values: Map<string, unknown>
}

/**
 * Serialise what is on screen — the current tab, the *visible* columns in their current
 * order, the current sort, and the current row filter. Not the whole graph: "export the
 * view" is what a grid is expected to mean, and the whole graph is `graph.getNodes()` away
 * for anyone with code.
 *
 * Raw values throughout, never a column's `format` output, so the file stays
 * machine-readable — a formatter that returns an element could not be written to a cell
 * anyway.
 */
export function toCsv(columns: TableColumn<Element>[], rows: ExportRow[]): string {
    const header = columns.map((column) => csvField(column.label ?? column.key))
    const body = rows.map((row) => columns.map((column) => csvField(scalar(row.values.get(column.key)))))
    // CRLF per RFC 4180 — it is what spreadsheets expect, and readers accept LF anyway.
    return [header, ...body].map((cells) => cells.join(',')).join('\r\n')
}

/** One object per row, keyed by column label — readable without the header to hand. */
export function toJson(columns: TableColumn<Element>[], rows: ExportRow[]): string {
    const objects = rows.map((row) => {
        const object: Record<string, unknown> = {}
        for (const column of columns) object[column.label ?? column.key] = row.values.get(column.key) ?? null
        return object
    })
    return JSON.stringify(objects, null, 2)
}

/**
 * RFC 4180: double quotes are doubled, and a field is quoted when it contains a comma, a
 * quote, or a line break. Also quoted when it has leading or trailing spaces, which a
 * spreadsheet would otherwise eat.
 */
function csvField(value: string): string {
    const needsQuoting = /[",\r\n]/.test(value) || value !== value.trim()
    return needsQuoting ? `"${value.replace(/"/g, '""')}"` : value
}

/** Flatten a cell to one string. Arrays and objects would otherwise stringify uselessly. */
function scalar(value: unknown): string {
    if (value === null || value === undefined) return ''
    if (Array.isArray(value)) return value.map((entry) => String(entry)).join('; ')
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
}

/**
 * Hand the file to the browser.
 *
 * Returns `false` when the download could not be started — a sandboxed iframe (which is
 * how the docs gallery embeds examples) can block `<a download>` outright, and a button
 * that silently does nothing is worse than one that says so.
 */
export function downloadText(filename: string, mime: string, text: string): boolean {
    try {
        const blob = new Blob([text], { type: `${mime};charset=utf-8` })
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = filename
        anchor.style.display = 'none'
        document.body.appendChild(anchor)
        anchor.click()
        anchor.remove()
        // Revoked on a later task so the navigation has taken the URL first.
        setTimeout(() => URL.revokeObjectURL(url), 0)
        return true
    } catch (error) {
        console.warn('Pivotick: the table export could not start a download.', error)
        return false
    }
}
