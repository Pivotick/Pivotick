import type { PivotickPlugin } from '../../interfaces/Plugin'
import { EventLog } from './EventLog'
import type { EventLogOptions } from './options'

export { EventLog } from './EventLog'
export type { EventLogKind, EventLogOptions } from './options'

/**
 * The event log plugin: a pane in the bottom dock listing what the graph emits, newest
 * first — every data change, every filter, every selection — with a timestamp, a pause
 * and a kind filter.
 *
 * A development instrument. It watches the **public** buses (`graph.on`,
 * `graph.queryEngine.on`, the interaction bus) and nothing else, so what it shows is
 * exactly what a consumer's own handlers would have seen. It is also the dock's second
 * occupant, and therefore the proof that `addDockTab` is enough to build a pane with:
 * the log shares the region's row, height and fold with the table and asked for no
 * concessions to get there.
 *
 * Off by default — nobody wants an event log they did not ask for.
 *
 * @example
 * ```js
 * import { Pivotick, eventLog } from 'pivotick'
 *
 * new Pivotick(container, data, { UI: { mode: 'full' }, plugins: [eventLog()] })
 * // …or at any point later:
 * graph.use(eventLog({ limit: 100, kinds: ['data'] }))
 * ```
 *
 * @param options - What to record, and how much of it. See {@link EventLogOptions}.
 */
export function eventLog(options: EventLogOptions = {}): PivotickPlugin {
    return {
        name: 'eventLog',
        install(ctx) {
            // The dock is a `full`-mode grid row. Asked for explicitly, so say why nothing
            // appeared rather than failing silently.
            if (ctx.ui.getOptions().mode !== 'full') {
                console.warn('Pivotick: the event log needs the bottom dock, which is \'full\' mode only; it was not mounted.')
                return
            }
            // No slot: the log registers a dock tab from its own `onMount`, and that
            // registration is what builds the region if the table is switched off.
            ctx.addElement(new EventLog(ctx.ui, options))
        },
    }
}
