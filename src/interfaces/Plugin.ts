import type { Graph } from '../Graph'
import type { UIManager } from '../ui/UIManager'
import type { UIComponent, UIPhase } from '../ui/UIComponent'
import type { Layout } from '../ui/elements/Layout'
import type { KeybindingManager } from '../ui/KeybindingManager'
import type { Keybinding } from './GraphUI'

/**
 * A Pivotick plugin: a self-contained bundle of UI elements, keybindings and
 * lifecycle hooks that installs itself into a graph without the core needing
 * to know it exists.
 *
 * Register one either declaratively via `GraphOptions.plugins`, or imperatively
 * via {@link Graph.use}:
 *
 * ```ts
 * const minimap: PivotickPlugin = {
 *     name: 'minimap',
 *     install(ctx) {
 *         ctx.addElement(new MinimapPanel(ctx.ui), ctx.layout?.canvas)
 *         ctx.addKeybinding({ key: 'm', callback: () => ... })
 *     },
 * }
 * new Graph(el, data, { plugins: [minimap] })
 * // or
 * graph.use(minimap)
 * ```
 */
export interface PivotickPlugin {
    /** Stable identifier, used for logging and de-duplication. */
    name: string
    /** Called once when the plugin is installed. */
    install(ctx: PluginContext): void
}

/**
 * The capabilities handed to a plugin's {@link PivotickPlugin.install}. Anything
 * registered here is driven by the same lifecycle as the built-in UI and torn
 * down with it.
 */
export interface PluginContext {
    graph: Graph
    ui: UIManager
    /**
     * The root DOM scaffold, read live from the UI (never a stale snapshot). It
     * exists in every mode while the UI is alive and is `undefined` only after
     * the UI is destroyed. Its *slots* are what vary by mode: `canvas` and
     * `notification` always; `mainheader` / `modal` / `slidePanel` in `full` and
     * `light`; `sidebar` in `full` only; `graphnavigation` / `graphcontrols` /
     * `graphtoolbar` in every mode except `static`.
     */
    layout: Layout | undefined
    keyManager: KeybindingManager
    /**
     * Add a UI element into the lifecycle. When `slot` is given the element is
     * mounted into it immediately; it then participates in every subsequent
     * phase (afterMount / graphReady / destroy). Safe to call after the graph
     * is already live — the element is caught up to the current phase.
     */
    addElement(element: UIComponent, slot?: HTMLElement): void
    /** Hook a lifecycle phase. Returns an unsubscribe function. */
    onPhase(phase: UIPhase, callback: () => void): () => void
    /** Register a keybinding that is automatically removed when the UI is torn down. */
    addKeybinding(binding: Keybinding): void
}
