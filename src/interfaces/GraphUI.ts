import type { Edge } from '../Edge'
import type { Node } from '../Node'
import type { UIElement } from '../ui/UIManager'

/**
 * @category Main Options
 * 
 * Options for the UI
 */
export interface GraphUI {
    mode: GraphUIMode,
    sidebar: SidebarOptions,
    mainHeader: MainHeader,
    propertiesPanel: PropertiesPanel,
    extraPanels: ExtraPanel[],
    tooltip: {
        enabled?: boolean /** @default true */
        /**
         * Custom renderer for node tooltips. This content is added after the default tooltip
         * @default undefined
         */
        renderNodeExtra?: (node: Node) => HTMLElement | string,
        /**
        * Custom renderer for edge tooltips. This content is added after the default tooltip
        * @default undefined
        */
        renderEdgeExtra?: (edge: Edge) => HTMLElement | string,
        nodeHeaderMap: Partial<HeaderMapEntry<Node>>,
        edgeHeaderMap: Partial<HeaderMapEntry<Edge>>,
        nodePropertiesMap: ((node: Node) => Array<PropertyEntry>),
        edgePropertiesMap: ((edge: Edge) => Array<PropertyEntry>),
        /**
        * Custom renderer for the tooltip. This content will override the default tooltip
        * @default undefined
        * @example
        * (element) => `element id: ${element.id}`
        */
        render?: ((element: Node | Edge) => HTMLElement | string) | HTMLElement | string,
    },
    contextMenu: {
        enabled?: boolean /** @default true */
        menuNode?: {
            topbar?: MenuQuickActionItemOptions[],
            menu?: MenuActionItemOptions[],
        },
        menuEdge?: {
            topbar?: MenuQuickActionItemOptions[],
            menu?: MenuActionItemOptions[],
        },
        menuCanvas?: {
            topbar?: MenuQuickActionItemOptions[],
            menu?: MenuActionItemOptions[],
        },
    },
    selectionMenu: {
        menuNode?: {
            topbar?: MenuQuickActionItemOptions[],
            menu?: MenuActionItemOptions[],
        }
    }
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
    */
    render?: ((element: Node | Edge | Node[] | Edge[] | null) => HTMLElement | string) | HTMLElement | string,
}

/**
 * Mapping functions to extract a node/edge's title and subtitle.
 *
 * Example for node. Replace with edge for edge mapping.
 * @default
 * title   = node.getData().label || "Could not resolve title"
 * subtitle= node.getData().description || "Could not resolve subtitle"
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
     * A function that computes the list of node properties to display
     *
     * @default All key/value pairs from node.getData()
     */
    nodePropertiesMap: ((node: Node) => PropertyEntry[])
    /**
     * A function that computes the list of edge properties to display
     *
     * @default All key/value pairs from edge.getData()
     */
    edgePropertiesMap: ((edge: Edge) => PropertyEntry[])
    /**
    * Custom renderer for the property panel. This content will override the default sidebar property panel.
    * @default undefined
    * @example
    * (element) => `element id: ${element.id}`
    */
    render?: ((element: Node | Edge | Node[] | Edge[] | null) => HTMLElement | string) | HTMLElement | string,
}

/**
 * Additional panel in the graph UI's sidebar.
 * Currently only displayed when an element is selected
 * 
 * Both `title` and `render` can be:
 * - A string or `HTMLElement` for static content, or
 * - A function returning a string or `HTMLElement` for dynamic content based on the current selected node or edge.
 * 
 * @example
 * ```ts
 * {
 *     render: (node: Node): HTMLElement => {
 *         const div = document.createElement('div')
 *         div.textContent = node?.description ?? 'Empty node description'
 *         return div
 *     },
 *     title: "My extra panel",
 * }
 * ```
 */
export interface ExtraPanel {
    title: ((element: Node | Edge | null) => HTMLElement | string) | HTMLElement | string,
    render: ((element: Node | Edge | null) => HTMLElement | string) | HTMLElement | string,
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
    text?: string,
    title: string,
    variant: UIVariant,
    visible: boolean | ((element: Node | Edge | null) => boolean)
    onclick: (this: TThis, evt: PointerEvent | MouseEvent, element?: Node | Node[] | Edge | Edge[] | null) => void
}
export type MenuQuickActionItemOptions = MenuActionItemOptions & {
    /**
     * Should the quick action item be flushed to the right of the menu
     * @default false
     */
    flushRight?: boolean;
}

/** Variant defined in the theme */
export type UIVariant = 'primary' | 'secondary' | 'info' | 'warning' | 'danger' | 'success' |
    'outline-primary' | 'outline-secondary' | 'outline-info' | 'outline-warning' | 'outline-danger' | 'outline-success'
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
