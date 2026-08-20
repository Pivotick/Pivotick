import type { PivotickPlugin } from '../../interfaces/Plugin'
import { Minimap } from './Minimap'
import type { MinimapOptions } from './options'

export { Minimap } from './Minimap'
export type { MinimapOptions, MinimapPosition } from './options'

/**
 * The minimap plugin: a cached overview of the whole graph docked in a canvas corner,
 * with a rectangle showing what is on screen. Click it to recentre the view; drag it to
 * pan.
 *
 * Built entirely on public API (`renderer.getContentBounds` / `setViewport` /
 * `screenToGraphCoordinates`), so it is exactly as privileged as a plugin you write
 * yourself — and it is renderer-agnostic.
 *
 * @example
 * ```js
 * import { Pivotick, minimap } from 'pivotick'
 *
 * new Pivotick(container, data, { plugins: [minimap({ width: 220 })] })
 * // …or at any point later:
 * graph.use(minimap())
 * ```
 *
 * @param options - Placement and size. See {@link MinimapOptions}.
 */
export function minimap(options: MinimapOptions = {}): PivotickPlugin {
    return {
        name: 'minimap',
        install(ctx) {
            // `static` promises no interactions and no chrome, and a minimap that pans
            // the view would contradict that. The plugin was asked for explicitly, so
            // say why nothing appeared rather than failing silently.
            if (ctx.ui.getOptions().mode === 'static') {
                console.warn('Pivotick: the minimap is not available in \'static\' mode; it was not mounted.')
                return
            }

            const canvas = ctx.layout?.canvas
            if (!canvas) return
            ctx.addElement(new Minimap(ctx.ui, options), canvas)
        },
    }
}
