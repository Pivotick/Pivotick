/** Which bus an entry came off — the axis the log's filter offers. */
export type EventLogKind = 'data' | 'filter' | 'selection'

/**
 * `eventLog()` — a pane in the bottom dock that lists what the graph is emitting, newest
 * first. A development instrument: it watches the public event buses and nothing else,
 * so what it shows is exactly what a consumer's own handlers would have seen.
 */
export interface EventLogOptions {
    /**
     * The dock tab's id, if you want to activate or remove it by name.
     * @default an auto-generated one
     */
    id?: string
    /** The tab's label, used verbatim. @default 'Events' */
    label?: string
    /**
     * How many entries to keep. The oldest fall off the end — a graph under a bulk import
     * emits thousands, and an unbounded log is a leak with a scrollbar.
     * @default 500
     */
    limit?: number
    /** Which buses to record. @default all three */
    kinds?: EventLogKind[]
    /** Start out not recording. @default false */
    paused?: boolean
    /** Display order in the dock's tab strip. @default after the built-in tabs */
    order?: number
}
