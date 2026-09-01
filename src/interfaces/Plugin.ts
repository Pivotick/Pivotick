import type { Graph } from '../Graph'
import type { PivotDefinition } from './Pivot'
import type { UIManager } from '../ui/UIManager'
import type { UIComponent, UIPhase } from '../ui/UIComponent'
import type { Layout } from '../ui/elements/Layout'
import type { KeybindingManager } from '../ui/KeybindingManager'
import type { DockTab, ExtraPanel, Keybinding, RailModeDefinition } from './GraphUI'

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
     * `notification` always; `graphnavigation` in every mode except `static`;
     * `mainheader` / `modal` / `slidePanel` / `moderail` / `toolpanel` / `flyout` /
     * `legend` in `full` and `light`; `sidebar` in `full` only.
     *
     * `canvas` is the slot a canvas-docked element wants — see the minimap plugin.
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
    /**
     * Register a sidebar panel — the same door as `UI.extraPanels` and
     * `UIManager.addPanel`. Returns a disposer; the panel is re-rendered on every
     * selection change and torn down with the UI.
     */
    addPanel(panel: ExtraPanel): () => void
    /** Remove a sidebar panel by id (equivalent to calling its disposer). */
    removePanel(id: string): void
    /** Re-render one sidebar panel, or all of them when `id` is omitted. */
    refreshPanel(id?: string): void
    /**
     * Register a pane in the bottom dock — the same door as `UIManager.addDockTab`,
     * and the one the built-in table comes through. Returns a disposer.
     *
     * The first tab **builds the region**, so a plugin does not have to ask the
     * consumer to turn the dock on: `full` mode is the only requirement.
     */
    addDockTab(tab: DockTab): () => void
    /** Remove a dock tab by id (equivalent to calling its disposer). */
    removeDockTab(id: string): void
    /**
     * Rebuild a dock tab from its `render` and `toolbar` — for when the pane's own data
     * or chosen view changed. The same thing a `DockTabHandle`'s `refresh()` does, for
     * code that holds the id rather than the handle.
     */
    refreshDockTab(id: string): void
    /**
     * Register a mode on the mode rail — the same door as `UIManager.addRailMode`, and
     * the way a plugin ships its own Explore or Enrich mode. Returns a disposer.
     *
     * Registered modes render below a divider, after the four built-in modes. Registration
     * succeeds in every mode; the button is only drawn where there is a rail
     * (`full` and `light`).
     */
    addRailMode(mode: RailModeDefinition): () => void
    /** Remove a rail mode by id (equivalent to calling its disposer). */
    removeRailMode(id: string): void
    /**
     * Register a pivot — the same door as `graph.pivots.register` and the `pivots`
     * option, and the way a plugin ships an enrichment. Returns a disposer.
     *
     * The Pivot rail mode appears as soon as the first pivot is registered and goes
     * when the last one leaves, so a plugin does not have to ask the consumer to turn
     * anything on.
     */
    addPivot(definition: PivotDefinition): () => void
    /** Hook a lifecycle phase. Returns an unsubscribe function. */
    onPhase(phase: UIPhase, callback: () => void): () => void
    /** Register a keybinding that is automatically removed when the UI is torn down. */
    addKeybinding(binding: Keybinding): void
}
