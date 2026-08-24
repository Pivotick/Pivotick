import type { Edge } from '../Edge'
import type { EdgeEditSession } from '../editing/EdgeEditSession'
import type { NodeEditSession } from '../editing/NodeEditSession'
import type { EdgeLabelPromptMode } from './InterractionCallbacks'
import type { Graph } from '../Graph'
import type { Node } from '../Node'
import type { Note } from '../Note'
import type { UIElement } from '../ui/UIManager'
import type { FieldConfig } from '../utils/FormFactory'
import type { FilterFacet, FilterOptions } from './GraphQueryEngine'
import type { AsyncContentOptions, RenderContext, RenderResult } from './AsyncContent'
import type { MinimapOptions } from '../plugins/minimap/options'

/**
 * @category Main Options
 * 
 * Options for the UI
 */
export interface GraphUI {
    mode: GraphUIMode,
    /**
     * The classname of the theme to force the UI to ignore user's prefered color scheme.
     * Available by default: `light` and `dark`.
     * Keep it `undefined` to use user's prefered color scheme.
     * @default undefined
     */
    theme?: string,
    sidebar: SidebarOptions,
    mainHeader: MainHeader,
    propertiesPanel: PropertiesPanel,
    neighborsPanel: NeighborsPanel,
    extraPanels: ExtraPanel[],
    tooltip: Tooltip,
    contextMenu: ContextMenu,
    navigation: Navigation,
    editors: Editors,
    /**
     * The filter panel's facets. Omit to derive them by scanning node data
     * (the zero-config default); declare `facets` to generate the form from
     * your own declaration instead. See {@link FilterOptions}.
     */
    filter?: FilterOptions,
    /**
     * The canvas legend: a key for the graph's colours that doubles as a filter.
     *
     * Left out, a legend appears **by itself** when the graph's colours are
     * explained by a declared `render.nodeTypeAccessor` — see
     * {@link LegendOptions}. `false` suppresses it, `true` asks for it without the
     * check, and an object configures it. A graph that encodes several things at
     * once passes {@link LegendGroupOptions} instead: one docked card, one section
     * per encoding.
     */
    legend?: LegendOptions | LegendGroupOptions | boolean,
    /**
     * The canvas minimap: an overview of the whole graph with a rectangle showing what is
     * on screen. Click it to recentre the view, drag it to pan.
     *
     * `full` mode mounts one for you, opening in `collapsed: 'auto'` so it folds itself
     * away on a canvas with no corner to spare. `false` suppresses it; `true` or an object
     * asks for it in any mode — see {@link MinimapOptions}. Passing your own
     * `minimap()` plugin in `plugins` also wins over this.
     */
    minimap?: MinimapOptions | boolean,
    /**
     * The left mode rail's "coming soon" data-zone modes (Explore / Enrich).
     * These features aren't shipped yet, so they're **off by default**: when
     * enabled they appear as disabled slots carrying a `SOON` badge; when
     * disabled they're hidden from the rail entirely.
     */
    modeRail?: ModeRailOptions,
    /**
     * What to show while a content hook's promise is in flight, and if it
     * rejects. Only async hooks ever reach it — see {@link AsyncContentOptions}.
     */
    asyncContent?: AsyncContentOptions,
    /**
     * The data dock: the graph's nodes and edges as a sortable, selectable grid
     * split off the bottom of the canvas.
     *
     * `full` mode offers one by default — the header grows a Table pill and the dock
     * opens on demand. `false` suppresses it entirely; an object configures it. Other
     * modes never mount it. See {@link TableOptions}.
     */
    table?: TableOptions | boolean,
    /**
     * The bottom dock itself — the region the table and any registered
     * {@link DockTab} share, rather than what is in it.
     *
     * `UI.table` still carries the same three settings, and did before the region
     * had tabs; those are honoured, and anything set here wins. Declare them here
     * when the table is switched off, since that is the only way to reach the dock
     * a plugin's tab brings with it.
     */
    dock?: DockOptions,
    keybindings?: Keybinding[];
}

/**
 * `UI.dock` — the bottom dock's own settings: the region, not its occupants.
 *
 * Everything about *what is in* the dock is declared elsewhere — the table under
 * `UI.table`, anything else through `addDockTab()`. What is left here is the region
 * the occupants share, which is why there is exactly one of each setting however
 * many tabs are registered.
 *
 * @example
 * ```js
 * // A dock holding only a plugin's pane, open on load
 * UI: { mode: 'full', table: false, dock: { open: true, height: 0.3 } }
 * ```
 *
 * @category Main Options
 */
export interface DockOptions {
    /**
     * Whether the region is present, and expanded when it is. Three states, because
     * the collapsed bar is the control that opens it:
     *
     * - `true` — present and expanded.
     * - `false` — not present at all. `Shift+T` still brings it in.
     * - **unset (default)** — present, folded to its header bar.
     */
    open?: boolean,
    /**
     * Folded away to just its header bar. `'auto'` follows the room available, until
     * the first explicit collapse or expand hands control to the user for good.
     * @default 'auto'
     */
    collapsed?: boolean | 'auto',
    /** Expanded height: a pixel count, or a fraction of the canvas between 0 and 1. */
    height?: number,
}

/**
 * Visibility of the mode rail's not-yet-shipped data-zone modes. Each is a
 * disabled "SOON" affordance when shown; omit or set `false` to hide it.
 */
export interface ModeRailOptions {
    /** Show the (coming-soon) Explore mode. @default false */
    explore?: boolean,
    /** Show the (coming-soon) Enrich mode. @default false */
    enrich?: boolean,
}

/** Which canvas corner the legend is docked in. */
export type LegendPosition = 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right'

/**
 * One row in the legend: a swatch, a label, and how to tell which nodes it
 * stands for.
 *
 * @example
 * ```js
 * { id: 'hub', label: 'Hub', color: '#7EA2FB',
 *   predicate: (node) => node.getData()?.type === 'hub' }
 * ```
 */
export interface LegendEntry {
    /** Stable identity: the toggle key, and the value written to the filter. */
    id: string
    /**
     * Human label, used verbatim (so it can be translated).
     * @default a prettified `id`
     */
    label?: string
    /** The swatch colour — any CSS colour. Sampled from the renderer in derived mode. */
    color: string
    /**
     * Which nodes this entry stands for. Defaults to matching `id` against
     * `LegendOptions.key` on the node's data, when a `key` is declared.
     */
    predicate?: (node: Node) => boolean
    /** Display order, ascending. @default declaration (or first-seen) order */
    order?: number
}

/**
 * One section of the legend: a key for one dimension of the data. These are
 * {@link LegendOptions} minus `position` — a section never claims a corner of the
 * canvas, the card it is stacked in does (see {@link LegendGroupOptions}).
 */
export interface LegendSection {
    /** @default true when the block is present */
    enabled?: boolean
    /**
     * Stable identity: the section's own filter key (`__legend:<id>`) and the
     * `section` field of the `legendToggle` event.
     * @default `key`, else `section-<index>`
     */
    id?: string
    /**
     * Header text, used verbatim (so it can be translated).
     * @default a prettified `key`, else `'Legend'`
     */
    title?: string
    /**
     * Derived mode: the node-data key whose distinct values become the entries,
     * each swatch sampled from the renderer's resolved node style. Also supplies
     * the default predicate when `entries` are declared without one.
     */
    key?: string
    /**
     * Declared entries, or a function re-resolved against the live graph every
     * time the legend rebuilds (so the list can follow the data).
     */
    entries?: LegendEntry[] | ((graph: Graph) => LegendEntry[])
    /** @default true */
    collapsible?: boolean
    /** Start collapsed. @default false */
    collapsed?: boolean
    /** Show a per-entry node count. @default true */
    showCounts?: boolean
    /** Clicking an entry filters the graph. `false` renders a pure key. @default true */
    filterable?: boolean
    /** Entries shown before the list scrolls. @default 12 */
    maxVisibleEntries?: number
}

/**
 * `UI.legend` — the canvas legend. It is **descriptive**: it reports the colours
 * the renderer already resolved and never assigns one, so the consumer stays the
 * sole owner of node colouring.
 *
 * Entries come from `key` (derived from the data, swatches sampled from the
 * renderer), from `entries` (declared), or from both — `key` then supplies the
 * default predicate for entries that don't carry one.
 *
 * With **neither**, the legend keys itself on `render.nodeTypeAccessor` (the
 * dimension you already declared for `nodeStyleMap`) — but only after checking
 * that this dimension really is the colour dimension: every category must resolve
 * to exactly one colour, there must be at least two of them, and few enough of
 * them to be categories. That check is what makes a legend nobody asked for safe;
 * `UI.legend: true` skips it, `false` suppresses the legend entirely.
 *
 * To key a graph on more than one dimension at a time, pass
 * {@link LegendGroupOptions} instead.
 *
 * Shown in `full` and `light` modes only.
 *
 * @example
 * ```js
 * UI: { legend: { key: 'type', title: 'Node type' } }
 * ```
 */
export interface LegendOptions extends LegendSection {
    /** @default 'bottom-left' */
    position?: LegendPosition
}

/**
 * `UI.legend` in its **multi-section** form: one docked card keying the graph on
 * several encodings at once. Sections stack top to bottom in declaration order,
 * each with its own title, entries and collapse toggle.
 *
 * Every filterable section owns its own filter, and filters **and** together: with
 * `attribute` switched off in one section and `self` in another, what stays on the
 * canvas is the nodes that are neither.
 *
 * A section declaring neither `key` nor `entries` is the dimension already declared
 * as `render.nodeTypeAccessor` — the one spelling for a styling dimension that
 * isn't a plain data key. Only one section may do that.
 *
 * @example
 * ```js
 * UI: {
 *     legend: {
 *         position: 'bottom-left',
 *         sections: [
 *             { key: 'type',  title: 'Element' },
 *             { key: 'scope', title: 'Provenance' },
 *         ],
 *     },
 * }
 * ```
 */
export interface LegendGroupOptions {
    /** @default true when the block is present */
    enabled?: boolean
    /** Which corner the whole card docks in. @default 'bottom-left' */
    position?: LegendPosition
    /** The sections, rendered top to bottom in declaration order. */
    sections: LegendSection[]
}

/** The payload of the `legendToggle` event: which legend entries are on and off. */
export interface LegendToggleState {
    /** Which section was toggled — its {@link LegendSection.id}. */
    section: string
    /** Ids of the entries whose nodes are hidden. */
    hidden: string[]
    /** Ids of the entries whose nodes are shown. */
    visible: string[]
}

export type Key = string; // e.g. 'Ctrl+C', 'Ctrl+F', 'ArrowUp'
export interface Keybinding {
    key: Key;
    callback: (event: KeyboardEvent) => void;
    description?: string;
}

/**
 * - `"full"`: Full UI and interactions.
 * - `"light"`: Minimal UI, interactions enabled.
 * - `"viewer"`: Navigate the graph (pan, zoom, drag), no UI panels.
 * - `"static"`: Static graph, no UI, no interactions.
 * @default 'full'
 */
export type GraphUIMode = 'viewer' | 'full' | 'light' | 'static';

export interface SidebarOptions {
    /**
     * Determines whether the sidebar is collapsed by default.
     * - `'auto'` Keeps the sidebar open unless there isn't enough screen space, in which case it collapses automatically.
     * @default 'auto'
     */
    collapsed: boolean | 'auto'
}

/**
 * Define what should be displayed in the sidebar's main header slot for node or edges.
 */
export interface MainHeader {
    nodeHeaderMap: HeaderMapEntry<Node>
    edgeHeaderMap: HeaderMapEntry<Edge>
    /**
    * Custom renderer for the main header. This content will override the default sidebar main header.
    * @default undefined
    * @example
    * (element) => `element id: ${element.id}`
    * @remarks A returned `string` renders as plain text; return an `HTMLElement` to render HTML.
    * May be `async`: the slot shows a placeholder until it resolves, and a result
    * arriving after the selection moved on is dropped.
    */
    render?: ((element: Node | Edge | Node[] | Edge[] | null, ctx: RenderContext) => RenderResult) | HTMLElement | string,
}

/**
 * Mapping functions to extract a node/edge's title and subtitle.
 *
 * Example for node. Replace with edge for edge mapping.
 * @default
 * title   = node.getData().label || "Could not resolve title"
 * subtitle= node.getData().description || "Could not resolve subtitle"
 *
 * @remarks **Synchronous only.** These feed the header's auto-fitting title slot
 * and `resolveNodeByName` (node search, `[[node]]` note autocomplete), all of
 * which need the text now. To show fetched detail, use an async
 * {@link MainHeader.render} or {@link PropertiesPanel.nodePropertiesMap} instead.
 */
export interface HeaderMapEntry<T extends Node | Edge> {
    title: ((element: T) => string) | string,
    subtitle: ((element: T) => string) | string,
}

/**
 * Represents a single property entry to display in the properties panel.
 *
 * - `name` is the label or key of the property.
 * - `value` is the value associated to the key for the node or edge.
 *
 * A `string` (for either field) renders as plain text; to render HTML, pass an
 * `HTMLElement` (or a function returning one). Since 1.4.0 string values are no
 * longer parsed as markup — wrap HTML in an element instead.
 *
 * @remarks **Synchronous only.** Fetch the rows instead: an async
 * {@link PropertiesPanel.nodePropertiesMap} resolves once and then hands back
 * plain entries, rather than putting a spinner in every cell.
 */
export interface PropertyEntry {
    name: ((element: Node | Edge | null) => HTMLElement | string) | HTMLElement | string,
    value: ((element: Node | Edge | null) => HTMLElement | string) | HTMLElement | string,
}

/**
 * Represents the configuration for the properties panel in the graph UI's sidebar
 * 
 * Defines how to compute and display properties for nodes and edges.
 * @default All key/value pairs from node.getData() or edge.getData()
 */
export interface PropertiesPanel {
    /**
     * A function that computes the list of node properties to display.
     *
     * May be `async` — return a promise of the entries and the panel shows a
     * placeholder until it resolves.
     *
     * @default All key/value pairs from node.getData()
     */
    nodePropertiesMap: ((node: Node, ctx: RenderContext) => PropertyEntry[] | Promise<PropertyEntry[]>)
    /**
     * A function that computes the list of edge properties to display.
     *
     * May be `async` — return a promise of the entries and the panel shows a
     * placeholder until it resolves.
     *
     * @default All key/value pairs from edge.getData()
     */
    edgePropertiesMap: ((edge: Edge, ctx: RenderContext) => PropertyEntry[] | Promise<PropertyEntry[]>)
    /**
    * Custom renderer for the property panel. This content will override the default sidebar property panel.
    * @default undefined
    * @example
    * (element) => `element id: ${element.id}`
    * @remarks A returned `string` renders as plain text; return an `HTMLElement` to render HTML.
    * May be `async`: the slot shows a placeholder until it resolves, and a result
    * arriving after the selection moved on is dropped.
    */
    render?: ((element: Node | Edge | Node[] | Edge[] | null, ctx: RenderContext) => RenderResult) | HTMLElement | string,
}

/**
 * Represents the configuration for the neighbors panel in the graph UI's sidebar
 * 
 * Defines how to compute and display neighbors for nodes and edges.
 * @default All neighbor for the chosen entity
 */
export interface NeighborsPanel {
    /**
     * @remarks A returned `string` renders as plain text; return an `HTMLElement` to render HTML.
     * May be `async`: the slot shows a placeholder until it resolves, and a result
     * arriving after the selection moved on is dropped.
     */
    render?: ((element: Node | Edge | Node[] | Edge[] | null, ctx: RenderContext) => RenderResult) | HTMLElement | string,
}

/**
 * The current sidebar selection handed to an {@link ExtraPanel}'s `title` /
 * `render`: the selected `Node` or `Edge`, an array for a multi-selection, or
 * `null` when nothing is selected. Same shape as {@link PropertiesPanel.render}.
 */
export type ExtraPanelSelection = Node | Edge | Node[] | Edge[] | null

/**
 * A handle on a live panel, passed as the second argument to its own `title` /
 * `render`. It lets a panel drive itself — re-render when its own data changed,
 * or unregister — without capturing the graph or the disposer `addPanel`
 * returned.
 */
export interface ExtraPanelHandle {
    /** The panel's id — the declared one, or the auto-generated one. */
    readonly id: string
    /** Re-resolve this panel's `title` and `render` against the current selection. */
    refresh(): void
    /** Unregister the panel and remove its DOM. */
    remove(): void
}

/**
 * A panel's title or body: static content, or a function of the current
 * selection (and the panel's own {@link ExtraPanelHandle}).
 *
 * A `string` renders as plain **text**; return an `HTMLElement` to render your
 * own markup. May be `async`: the panel shows a placeholder until it resolves,
 * and a result arriving after the selection moved on is dropped.
 */
export type ExtraPanelContent =
    | ((element: ExtraPanelSelection, panel: ExtraPanelHandle, ctx: RenderContext) => RenderResult)
    | HTMLElement
    | string

/**
 * Additional panel in the graph UI's sidebar.
 *
 * Both `title` and `render` can be:
 * - A string or `HTMLElement` for static content, or
 * - A function of the current selection (a `Node`, an `Edge`, an array of either
 *   for a multi-selection, or `null` when nothing is selected) — re-invoked on
 *   every selection change unless {@link ExtraPanel.reactive} is `false`.
 *
 * Declare panels up front via `UI.extraPanels`, or register them at any point in
 * the graph's life with `graph.UIManager.addPanel()` (which returns a disposer).
 *
 * @example
 * ```ts
 * {
 *     id: 'description',
 *     title: 'Description',
 *     render: (element): HTMLElement => {
 *         const node = element instanceof Node ? element : null
 *         const div = document.createElement('div')
 *         div.textContent = node?.getData().description ?? 'Empty node description'
 *         return div
 *     },
 * }
 * ```
 */
export interface ExtraPanel {
    /**
     * Stable identifier, used to address the panel in `removePanel` /
     * `refreshPanel`. Auto-generated when omitted.
     */
    id?: string,
    /**
     * The panel's header row. A `string` renders as plain text; pass an
     * `HTMLElement` to render HTML. Omit it (or resolve to blank) for a panel
     * with no header at all.
     */
    title?: ExtraPanelContent,
    /** A `string` renders as plain text; pass an `HTMLElement` to render HTML. */
    render: ExtraPanelContent,
    /**
     * should the panel be always visible
     * @default false
     */
    alwaysVisible?: boolean,
    /**
     * Display order in the sidebar, ascending. Panels sharing an `order` keep
     * their registration order, so `UI.extraPanels` reads top-to-bottom and
     * runtime panels append after them.
     * @default 0
     */
    order?: number,
    /**
     * Re-resolve `title` and `render` whenever the selection changes. Set
     * `false` for a panel that is expensive to build and doesn't describe the
     * selection: it then renders once, and only an explicit `refreshPanel()`
     * rebuilds it.
     * @default true
     */
    reactive?: boolean
}

/** An {@link ExtraPanel} once registered: its `id` is always resolved. */
export interface RegisteredExtraPanel extends ExtraPanel {
    id: string
}

export interface Tooltip {
    enabled?: boolean /** @default true */
    allowPinning?: boolean /** @default true */
    /**
     * Custom renderer for node tooltips. This content is added after the default tooltip.
     *
     * May be `async` — the tooltip shows a placeholder, then swaps in the content and
     * repositions itself. Hovering another node first drops the stale result and aborts
     * `ctx.signal`.
     * @default undefined
     */
    renderNodeExtra?: (node: Node, ctx: RenderContext) => RenderResult,
    /**
    * Custom renderer for edge tooltips. This content is added after the default tooltip.
    *
    * May be `async`, on the same terms as {@link Tooltip.renderNodeExtra}.
    * @default undefined
    */
    renderEdgeExtra?: (edge: Edge, ctx: RenderContext) => RenderResult,
    nodeHeaderMap: Partial<HeaderMapEntry<Node>>,
    edgeHeaderMap: Partial<HeaderMapEntry<Edge>>,
    /** May be `async` — the property list shows a placeholder until it resolves. */
    nodePropertiesMap: ((node: Node, ctx: RenderContext) => Array<PropertyEntry> | Promise<Array<PropertyEntry>>),
    /** May be `async` — the property list shows a placeholder until it resolves. */
    edgePropertiesMap: ((edge: Edge, ctx: RenderContext) => Array<PropertyEntry> | Promise<Array<PropertyEntry>>),
    /**
    * Custom renderer for the tooltip. This content will override the default tooltip
    * @default undefined
    * @example
    * (element) => `element id: ${element.id}`
    * @remarks A returned `string` renders as plain text; return an `HTMLElement` to render HTML.
    * May be `async`, on the same terms as {@link Tooltip.renderNodeExtra}.
    */
    render?: ((element: Node | Edge, ctx: RenderContext) => RenderResult) | HTMLElement | string,
    setPosition?: (tooltip: HTMLElement, hoveredBCR: DOMRect, canvasBbox: DOMRect) => void, 
}

export interface Navigation {
    enabled?: boolean /** @default true */
}

export interface ContextMenu {
    enabled?: boolean /** @default true */
    menuNode?: {
        topbar?: MenuQuickActionItemOptions[],
        menu?: MenuActionItemOptions[],
    },
    menuEdge?: {
        topbar?: MenuQuickActionItemOptions[],
        menu?: MenuActionItemOptions[],
    },
    menuNote?: {
        topbar?: MenuQuickActionItemOptions[],
        menu?: MenuActionItemOptions[],
    },
    menuCanvas?: {
        topbar?: MenuQuickActionItemOptions[],
        menu?: MenuActionItemOptions[],
    },
}

/**
 * Options to define an action item in a menu.
 * Can be used in contextual menus or multi-select menus.
 */
export type MenuActionItemOptions<TThis extends UIElement = UIElement> = {
    /** Unicode character for the icon (optional) */
    iconUnicode?: IconUnicode,
    iconClass?: IconClass,
    svgIcon?: SVGIcon,
    imagePath?: ImagePath,
    /** Text of the option. */
    text: string,
    /** Title to be shown when hovering over the option. */
    title?: string,
    /** @default outline-primary */
    variant?: UIBaseVariant | UIOutlineVariant | UIOutlineSoftVariant,
    visible?: boolean | ((element: Node | Edge | Note | null) => boolean)
    onclick: (this: TThis, evt: PointerEvent | MouseEvent, element?: Node | Node[] | Edge | Edge[] | Note | Note[] | null) => void,
    /** The keybinding activates this function. This is just visual. The actual binding is defined in UIManager */
    shortcut?: string
}
export type MenuQuickActionItemOptions = MenuActionItemOptions & {
    /**
     * Should the quick action item be flushed to the right of the menu
     * @default false
     */
    flushRight?: boolean;
}

export interface Editors {
    nodeEditor?: {
        /**
         * Offer the node editor at all. `false` hides the Create ▸ Edit node tool —
         * a consumer whose backend forbids edits removes the affordance rather than
         * vetoing every commit.
         * @default true
         */
        enabled?: boolean

        /**
         * Optional custom field generator. Inferred if undefined
         * @default undefined
         */
        fields?: FieldConfig[]

        /**
         * Optional custom modal renderer. Leave undefined for default edition modal
         * @default undefined
         */
        render?: (session: NodeEditSession) => void
    }
    /**
     * Interactive node creation — the Create ▸ Add node tool and the canvas
     * context-menu's "Add Node Here". What the new node carries is decided by
     * {@link InterractionCallbacks.onBeforeNodeCreate}.
     */
    nodeCreator?: {
        /**
         * Offer the create-node affordances at all.
         * @default true
         */
        enabled?: boolean
    }
    /**
     * Deleting graph elements from the UI — the sidebar bulk-action Delete button and
     * the node / edge / note context-menu delete entries. Every one of them is gated
     * by {@link InterractionCallbacks.onBeforeDelete}; this switch decides whether
     * they are shown in the first place.
     */
    deletion?: {
        /**
         * Offer the delete affordances at all. `false` removes them, which is what a
         * read-only integration wants — cleaner than vetoing every click.
         * @default true
         */
        enabled?: boolean
    }
    edgeEditor?: {
        /**
         * Offer the edge editor at all. `false` hides the "Edit Edge" context-menu
         * entry.
         * @default true
         */
        enabled?: boolean

        /**
         * Optional field list for the edge edit modal. Inferred from the edge's data
         * when undefined.
         * @default undefined
         */
        fields?: FieldConfig[]

        /**
         * Optional custom body renderer for the edge edit modal — the static twin of
         * {@link InterractionCallbacks.onEdgeEdit}. A custom body owns the draft:
         * mutate `session.draft` as the user types.
         * @default undefined
         */
        render?: (session: EdgeEditSession) => HTMLDivElement

        /**
         * When set, every interactive edge create prompts the end-user for a label
         * (stored on the new edge's `data.label`) using the chosen UI — no callback
         * needed. An `onBeforeEdgeCreate` hook, if present, takes over and this is
         * ignored (the hook can prompt itself via `ctx.promptLabel`).
         * @default undefined
         */
        labelPrompt?: EdgeLabelPromptMode
    }
}

/** Variant defined in the theme */
export type UIBaseVariant = 'primary' | 'secondary' | 'info' | 'warning' | 'danger' | 'success'
export type UIOutlineVariant = 'outline-primary' | 'outline-secondary' | 'outline-info' | 'outline-warning' | 'outline-danger' | 'outline-success'
export type UIOutlineSoftVariant = 'outline-soft-primary' | 'outline-soft-secondary' | 'outline-soft-info' | 'outline-soft-warning' | 'outline-soft-danger' | 'outline-soft-success'

/**
 * Raw SVG markup as a string
 * @example `<svg>...</svg>`
 */
export type SVGIcon = string
/**
 * Raw unicode to be used in icon libraries such as fontawesome
 * @example `\uf007`
 */
export type IconUnicode = string
/**
 * Classe(s) to be added on the element, typically used in icon libraries such as fontawesome
 * @example 'fa-solid fa-user'
 */
export type IconClass = string
/**
 * An URL path to access the image content
 * @example '/icon.svg'
 */
export type ImagePath = string

/**
 * What a live dock tab gets to drive itself with — passed to its own `render`,
 * `toolbar` and activation hooks. It lets a tab bring itself to the front or
 * unregister without capturing the graph, the dock, or the disposer
 * `addDockTab` returned.
 */
export interface DockTabHandle {
    /** The tab's id — the declared one, or the auto-generated one. */
    readonly id: string
    /** Whether this is the tab currently on show. */
    readonly active: boolean
    /** Bring this tab to the front, unfolding the dock if it is folded. */
    activate(): void
    /**
     * Rebuild this tab's body: `render` is called again and what it returns replaces
     * what is there.
     *
     * This is how a pane with **its own** internal views switches between them — the
     * data table does exactly this for `Nodes` / `Edges`. Doing it by hand is not an
     * option: the dock keeps the element `render` gave it, so an occupant that swapped
     * its own DOM would leave the dock holding a stale reference to re-attach later.
     */
    refresh(): void
    /** Unregister the tab and take its DOM with it. */
    remove(): void
}

/**
 * A pane in the bottom dock — one entry in its tab strip.
 *
 * The dock owns the **region**: the grid row, its height, the resize divider and the
 * fold. A tab owns what is *in* it — a body, and optionally its own header controls,
 * which the dock swaps in and out as the active tab changes. With only one tab
 * registered no strip is drawn at all; there is nothing to switch.
 *
 * Register one at any point in the graph's life with `graph.UIManager.addDockTab()`,
 * or from a plugin's `install` via `ctx.addDockTab()`. Either returns a disposer.
 *
 * **One tab is one pane, not one view of one.** A pane with several views of its own —
 * the data table's `Nodes` and `Edges` — is a *single* dock tab that draws its own
 * switch in its `toolbar` and calls {@link DockTabHandle.refresh} to change body. So
 * the dock's strip lists panes (`Table`, `Events`) and never flattens one pane's views
 * out alongside another pane; the two levels are drawn differently for the same reason.
 *
 * The data table is itself just such a tab, so a registered tab is exactly as
 * privileged as the built-in one.
 *
 * @example
 * ```js
 * const dispose = graph.UIManager.addDockTab({
 *     label: 'Audit',
 *     render: () => myAuditPane(),
 *     toolbar: () => [clearButton],
 * })
 * ```
 */
export interface DockTab {
    /**
     * Stable identity: what `removeDockTab` / `activateDockTab` take, and the
     * `data-tab` written onto the strip's button.
     * @default an auto-generated `pvt-dock-tab-N`
     */
    id?: string
    /** The strip's label, used verbatim (so it can be translated). */
    label: string
    /**
     * Build the pane's body. Called **once**, lazily, the first time the tab comes to
     * the front — a tab nobody opens costs nothing. The element is kept and re-attached
     * on later activations, so it holds its own state (scroll position included).
     */
    render: (tab: DockTabHandle) => HTMLElement
    /**
     * Build this tab's header controls, laid out as part of the dock's header row.
     * Re-invoked on **every** activation, so the controls can reflect the tab's
     * current state.
     *
     * A pane with several views of its own draws the switch here. Two public classes
     * give it the same look the built-in table has — `pvt-dock-views` on the strip,
     * `pvt-dock-view` on each button, `active` on the current one — so it stays a pill
     * group beside the dock's own tabs and follows the theme.
     */
    toolbar?: (tab: DockTabHandle) => HTMLElement | HTMLElement[]
    /**
     * Display order in the strip, ascending. Equal orders keep registration order —
     * and since plugins install after the UI is built, a plugin's tabs land after the
     * built-in ones without having to say so.
     * @default 0
     */
    order?: number
    /**
     * Called when this tab comes to the front, and when it leaves. A tab that watches
     * live data should stop working in `onDeactivate` and catch up in `onActivate`:
     * nothing else tells it that it is off screen.
     */
    onActivate?: (tab: DockTabHandle) => void
    onDeactivate?: (tab: DockTabHandle) => void
}

/** A {@link DockTab} once registered: its `id` is resolved. */
export interface RegisteredDockTab extends DockTab {
    id: string
}

/**
 * The data dock's configuration. Everything here is read-only behaviour: the table
 * reflects and selects, and never changes the graph. Hiding, pinning and restoring stay
 * with the sidebar's bulk actions and the filter panel.
 *
 * @example
 * ```js
 * UI: { mode: 'full', table: { open: true, height: 0.4,
 *                              sort: { key: 'degree', direction: 'desc' } } }
 * ```
 *
 * @category Main Options
 */
export interface TableOptions {
    /** @default true whenever `UI.table` isn't `false` */
    enabled?: boolean,
    /** Which tabs to offer, in order. @default ['nodes', 'edges'] */
    tabs?: TableTab[],
    /**
     * The node columns. Omit to have them resolved for you: from declared
     * {@link FilterOptions.facets} if there are any, otherwise by scanning node data.
     */
    columns?: TableColumn[],
    /** The edge columns, on the same terms as {@link TableOptions.columns}. */
    edgeColumns?: TableColumn<Edge>[],
    /**
     * Whether the dock starts expanded. Three states, because the collapsed bar is the
     * control that opens it:
     *
     * - `true` — present and expanded, showing the grid.
     * - `false` — not present at all, for a canvas with no dock. `Shift+T` still brings
     *   it in.
     * - **unset (default)** — present, folded to its header bar. The bar is the
     *   affordance, which is why there is no toolbar button for the dock.
     */
    open?: boolean,
    /**
     * Folded away to just its header bar. `'auto'` follows the room available, until the
     * first explicit collapse or expand hands control to the user for good.
     * @default 'auto'
     */
    collapsed?: boolean | 'auto',
    /**
     * The dock's height: a pixel count, or a fraction of the canvas between 0 and 1.
     * Clamped so the canvas keeps a usable minimum whatever you ask for.
     * @default 0.35
     */
    height?: number,
    /** Initial sort. @default the first sortable column, ascending */
    sort?: { key: string, direction: TableSortDirection },
    /** What clicking a row does. @default 'select' */
    rowActivate?: 'select' | 'selectAndCenter' | 'none',
    /** Export buttons offered in the dock header. `false` hides them. @default ['csv', 'json'] */
    export?: TableExportFormat[] | false,
    /** Row count above which rows are windowed rather than all rendered. @default 200 */
    virtualizeAbove?: number,
}

/** Which set of rows the dock is showing. */
export type TableTab = 'nodes' | 'edges'

export type TableSortDirection = 'asc' | 'desc'

export type TableExportFormat = 'csv' | 'json'

/**
 * One column of the data dock.
 *
 * Deliberately an extension of {@link FilterFacet}: a facet already says how to read a
 * value off an element and what kind of value it is, which is exactly what a column
 * needs. So declaring `UI.filter.facets` describes your data once and the filter panel
 * and the table agree about it.
 *
 * @example
 * ```js
 * { key: 'severity', label: 'Severity', type: 'numberRange', align: 'right', filterable: true }
 * ```
 */
export interface TableColumn<T extends Node | Edge = Node> extends Pick<FilterFacet, 'key' | 'label' | 'type' | 'order'> {
    /**
     * How to read this column off an element. Defaults to `element.getData()[key]`, which
     * is what makes a {@link FilterFacet} usable as a column unchanged.
     */
    accessor?: (element: T) => unknown,
    /** Column width — a pixel count, or any CSS length. @default sized from its content */
    width?: number | string,
    /** @default 'right' for `numberRange`, `'left'` otherwise */
    align?: 'left' | 'right' | 'center',
    /** @default true */
    sortable?: boolean,
    /**
     * Give this column a filter control in its header, typed off its {@link type} — a
     * Min/Max pair for a `numberRange`, a dropdown of the values present for a `select`,
     * a substring box otherwise.
     *
     * It narrows the **rows**; the canvas is left alone — changing what the graph
     * displays stays with the filter panel, so the two can never disagree.
     *
     * @default false for a column you declare — but `true` throughout the **derived**
     * column set, which infers its filters off the types it already inferred. Declare
     * `columns` and you get exactly what you asked for.
     */
    filterable?: boolean,
    /** Start hidden (still listed in the column picker). @default false */
    hidden?: boolean,
    /**
     * Render the cell. A string is inserted as text, an `HTMLElement` as markup.
     * Ignored by export, which always writes the raw value.
     * @default `String(value)`
     */
    format?: (value: unknown, element: T) => string | HTMLElement,
}
