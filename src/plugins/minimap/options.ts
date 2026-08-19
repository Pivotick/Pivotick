/** Which canvas corner the minimap docks in. */
export type MinimapPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'

/**
 * `minimap(options)` — how the minimap is placed and sized. Everything else about it
 * (level of detail, when it redraws) adapts to the graph and needs no configuration.
 */
export interface MinimapOptions {
    /**
     * The corner it docks in. `'bottom-right'` is the only corner the built-in chrome
     * leaves free in `full` mode.
     * @default 'bottom-right'
     */
    position?: MinimapPosition
    /**
     * Width in CSS pixels.
     * @default 200
     */
    width?: number
    /**
     * Height in CSS pixels. Left out, it follows the canvas's aspect ratio (clamped to
     * 70–400px) so the viewport rectangle keeps the shape of the real viewport.
     * @default derived from the canvas
     */
    height?: number
}
