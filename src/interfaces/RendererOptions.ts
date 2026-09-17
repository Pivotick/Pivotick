import type { Edge } from '../Edge'
import type { Graph } from '../Graph'
import type { Node } from '../Node'
import type { IconClass, IconUnicode, ImagePath, SVGIcon } from './GraphUI'

/**
 * @category Main Options
 */
export interface GraphRendererOptions {
    /**
     * Defines the rendering method used by the graph.
     *
     */
    type: RendererType,
    /**
     * Custom renderer for nodes.
     *
     * Allows full control over how a node is displayed
     * The function can return either:
     * - An `HTMLElement` to be used as the node,
     * - A string to render inside the node, or
     * - nothing, to leave that node to the normal styling pipeline
     *
     * A card returned here **is** the node: no shape, icon, picture or label is drawn
     * behind it, and its measured size drives the collision radius and edge anchors.
     * Returning nothing for a node instead gives it its `nodeStyleMap` entry, shape and
     * label as usual — so this can card a few nodes rather than all of them.
     *
     * For a card that composes with the rest of the styling chain, declare
     * {@link NodeStyle.html} with `shape: 'none'` instead; it resolves per type or per
     * node, where this one is global.
     *
     * @example
     * ```ts
     * renderNode: (node: Node): HTMLElement | string | void => {
     *   const size = 12;
     *   const style = [
     *     'display:block',
     *     `width:${size}px`,
     *     `height:${size}px`,
     *     'background-color:#907acc',
     *     'border: 2px solid #fff',
     *     'border-radius:50%',
     *     'opacity: 1',
     *   ].join(';');
     * 
     *   return `<span style="${style}"></span>`;
     * }
     * ```
     */
    renderNode?: (node: Node) => HTMLElement | string | void
    /**
     * Custom renderer for edge labels.
     * 
     * Allows full control over how edge labels are displayed.
     * The function can return either:
     * - An `HTMLElement` to be used as the edge's label, or
     * - A string to render inside the label
     * 
     * @example
     * ```ts
     * renderLabel: (edge: Edge): HTMLElement | string | void => {
     *   const style = [
     *     'display:inline-block',
     *     'background-color:#907acc',
     *     'border: 2px solid #fff',
     *     'border-radius:50%',
     *     'opacity: 1',
     *   ].join(';');
     * 
     *   const text = edge.getData().label;
     *   return `<span style="${style}">${text}</span>`;
     * }
     * ```
     */
    renderLabel?: (edge: Edge) => HTMLElement | string | void
    /**
     * Custom renderer for clusters.
     * 
     * Allows full control over how a cluster is displayed
     * The function can return either:
     * - An `HTMLElement` to be used as the cluster, or
     * - A string to render inside the cluster
     * 
     * @example
     * ```ts
     * renderCluster: (cluster: Node): HTMLElement | string | void => {
     *   const size = 12;
     *   const style = [
     *     'display:block',
     *     `width:${size}px`,
     *     `height:${size}px`,
     *     'background-color:#907acc',
     *     'border: 2px solid #fff',
     *     'border-radius:50%',
     *     'opacity: 1',
     *   ].join(';');
     * 
     *   return `<span style="${style}"></span>`;
     * }
     * ```
     */
    renderCluster?: (cluster: Node) => HTMLElement | string | void
    /**
     * The default node style to be applied on all nodes
     * @defaultValue {@link defaultNodeStyleValue}
     */
    defaultNodeStyle: NodeStyle
    /**
     * The default edge style to be applied on all nodes
     * @defaultValue {@link defaultEdgeStyleValue}
     */
    defaultEdgeStyle: EdgeStyle
    /**
     * The default edge's label style to be applied on all nodes
     * @defaultValue {@link defaultLabelStyleValue}
     */
    defaultLabelStyle: LabelStyle
    /**
     * Defines custom styles for marker shapes used in the graph.
     * 
     * Each key is a marker type (e.g., `'diamond'`, `'arrow'`) and maps to a `MarkerStyle` object.
     * 
     * @defaultValue {@link defaultMarkerStyleMap}
     * @example
     * ```ts
     * markerStyleMap: {
     *   'diamond': {
     *     fill: '#44c77f',
     *   },
     * }
     * ```
     */
    markerStyleMap?: MarkerStyleMap
    /**
     * Function to access the type of a node. Used in 
     * 
     * Used to style nodes based on their type.
     * @remarks
     * Used in conjuction with {@link nodeStyleMap}
     * 
     * @example
     * ```ts
     * nodeTypeAccessor: (node) => node.getData()?.type
     * ```
     */
    nodeTypeAccessor?: (node: Node) => string | undefined
    /**
     * Maps node types to their styles.
     * 
     * Each key is a node type (as returned by `nodeTypeAccessor`) and maps to a `NodeStyle` object.
     * 
     * @remarks
     * Used in conjuction with {@link nodeTypeAccessor}
     * 
     * @example
     * ```ts
     * nodeStyleMap: {
     *   'hub': { shape: 'hexagon', color: '#aaa', size: 30 },
     *   'spoke': { shape: 'triangle', color: '#f00' },
     * }
     * ```
     */
    nodeStyleMap?: Record<string, Partial<NodeStyle>>
    /**
     * Function to access the kind of an edge — the dimension {@link edgeStyleMap}
     * keys on, and the one an `edge` legend section and edge filter facets derive
     * from when they aren't given a data key of their own.
     *
     * @remarks
     * Used in conjuction with {@link edgeStyleMap}
     *
     * @example
     * ```ts
     * edgeTypeAccessor: (edge) => edge.getData()?.kind
     * ```
     */
    edgeTypeAccessor?: (edge: Edge) => string | undefined
    /**
     * Maps edge kinds to their styles.
     *
     * Each key is an edge kind (as returned by `edgeTypeAccessor`) and maps to a
     * partial `EdgeStyle`. An edge's own `styleCb` still wins over the map, exactly
     * as it does over {@link nodeStyleMap}.
     *
     * @remarks
     * Used in conjuction with {@link edgeTypeAccessor}
     *
     * @example
     * ```ts
     * edgeStyleMap: {
     *   'object-reference': { strokeColor: '#428bca' },
     *   'correlation': { strokeColor: '#888', dashed: true },
     * }
     * ```
     */
    edgeStyleMap?: Record<string, Partial<EdgeStyle>>
    /**
     * Controls whether non-connected nodes and edges are grayed out when a node is selected
     * @default true
     */
    enableFocusMode: boolean,
    /**
     * Controls whether nodes can be expanded or collapsed to show their children
     * @default true
     */
    enableNodeExpansion: boolean,
    /**
     * When a node's {@link NodeStyle.focusTier} drawing fires. The style says what the focus
     * drawing is; this says when.
     *
     * Selection only promotes a node that is selected on its own — a box-select of fifty
     * would be a wall of overlapping cards. `'off'` suppresses the behaviour without editing
     * the style, which is what an integrator embedding someone else's preset needs.
     *
     * @default 'both'
     */
    focusTierTrigger?: 'both' | 'hover' | 'selection' | 'off',
    /**
     * How long, in milliseconds, a node takes to cross-fade from one drawing to the next.
     * `0` replaces the drawing in a single frame, which is what a graph declaring no
     * transition does.
     *
     * The outgoing drawing is kept alive on a layer of its own and the two fade past each
     * other, so a node is never absent mid-swap — only briefly softer where they overlap.
     * It covers both the zoom-driven {@link NodeStyle.tiers} and the
     * {@link NodeStyle.focusTier} drawing.
     *
     * Every node on screen crosses a threshold at the same moment, so this starts as many
     * fades as there are nodes changing. `prefers-reduced-motion` turns it off.
     *
     * Measured on 210 nodes each holding a 140x44 card: the fade itself costs nothing — the
     * canvas holds 60fps for its whole length — but keeping that many outgoing cards alive
     * for an instant adds about 26ms to the one frame the crossing already spends. Set it to
     * `0` on a graph where that frame matters more than the transition.
     *
     * @default 160
     */
    tierTransition?: number,
    /**
     * Callback executed during the init phase, before the first rendering
     * @param graph The Graph instance
     */
    beforeRender: (graph: Graph) => void
    /** @default true */
    zoomEnabled: boolean
    /** @default true */
    zoomAnimation: boolean
    /** @default 300 */
    zoomAnimationDuration: number
    /** @default 0.05 */
    minZoom: number
    /** @default 10 */
    maxZoom: number
    /** @default true */
    dragEnabled: boolean
    /** @default true */
    interactionEnabled: boolean
    selectionBox: SelectionBox
}

/**
 * - `'svg'` - Uses SVG elements for rendering
 * - `'canvas'` - Reserved; not implemented (the renderer factory throws for it)
 * @default 'svg'
 */
export type RendererType = 'svg' | 'canvas'


/**
 * Represents one of the predefined, common node shapes.
 * These can be rendered using basic SVG elements like `<circle>`, `<rect>`, or `<polygon>`.
 *
 * `'none'` draws no shape at all: whatever {@link NodeStyle.html} (or an icon, a picture or
 * a label) puts on the node *is* the node, and the node's collision radius and edge anchors
 * come from that content rather than from `size`. The node stays selectable and draggable
 * over its whole extent.
 */
export type StandardShape = 'circle' | 'square' | 'triangle' | 'hexagon' | 'none'

/**
 * Represents a node with a custom SVG path.
 * The `d` property corresponds directly to the `d` attribute of an SVG `<path>` element,
 * allowing fully custom shapes.
 * 
 * @example
 * ```ts
 * {
 *   d: "M 0 -10 L 10 10 L -10 10 Z"
 * }
 * ```
 */
export interface CustomNodeShape {
    d: string  // represents the `d` attribute of `<path>`
}

export type NodeShape = StandardShape | CustomNodeShape

/**
 * How an `imagePath` picture sits on the node's shape.
 * - `'icon'` — small picture centred on the shape (~1.2× size); the legacy default look.
 * - `'cover'` — picture fills the shape's box (2× size), cropped to preserve aspect ratio.
 * - `'contain'` — whole picture fits inside the shape's box (2× size), letterboxed with the shape `color`.
 * - `'frame'` — the node becomes a rectangle sized to the picture's own aspect ratio
 *   (longest side = 2× size), so the stroke hugs it: whole picture, no crop, no letterbox
 *   bars. The requested `shape` is ignored (always a rectangle) since the picture is the node.
 */
export type ImageFit = 'icon' | 'cover' | 'contain' | 'frame'

/**
 * Which corner of the node's rim a badge sits on.
 *
 * The expand/collapse affordance owns `'ne'` when a node is collapsed and `'se'` when it is
 * expanded, so on a node with children **both** are reserved and auto-placement skips them —
 * otherwise badges would swap corners every time the cluster opened.
 */
export type NodeBadgePosition = 'ne' | 'nw' | 'se' | 'sw'

/**
 * A small indicator pinned to a node's rim — what KeyLines and ReGraph call a *glyph*.
 *
 * Badges are a decoration channel of their own, so a node can carry a fact that `color`,
 * `shape`, `size`, `iconClass` and `imagePath` are already spent on. They describe **only the
 * node they sit on**: a collapsed cluster does not aggregate its children's badges — walk
 * `node.children` yourself if you want that.
 *
 * @example
 * ```js
 * defaultNodeStyle: {
 *     badges: node => node.getData().notes
 *         ? [{ text: String(node.getData().notes), title: 'Notes', onClick: () => openNotes(node) }]
 *         : [],
 * }
 * ```
 */
export interface NodeBadge {
    /**
     * Which corner to sit on. Omit it and the badge is auto-placed in the first free corner,
     * clockwise from `'ne'`. An explicit position is honoured **verbatim**, even where that
     * overlaps another badge or the expand affordance.
     */
    position?: NodeBadgePosition
    /** Any CSS colour. @default `var(--pvt-badge-color)` */
    color?: string
    /**
     * A count, or one or two characters. Longer text grows the badge into a pill; past three
     * characters it renders as `99+`. Takes precedence over any icon on the same badge.
     */
    text?: string
    iconClass?: IconClass
    iconUnicode?: IconUnicode
    /** Inline SVG markup, sanitized before it reaches the DOM. */
    svgIcon?: SVGIcon
    /** Native tooltip, rendered as a real `<title>`. Does not suppress the graph's own tooltip. */
    title?: string
    /**
     * Called when the badge is clicked, before {@link InterractionCallbacks.onBadgeClick}.
     *
     * Declaring it makes the badge take the pointer cursor and **consume** the click, so the
     * node is not also selected. A badge without one stays transparent to the node underneath.
     * Pressing a badge still drags the node either way.
     */
    onClick?: (event: PointerEvent, node: Node, badge: NodeBadge) => void
}

/** A style layer whose channels may also be set to `null`, meaning "draw this one not at all". */
type Clearable<T> = { [K in keyof T]: T[K] | null }

/**
 * What a tier is allowed to change: the drawing, never the chain or the geometry. Omitting
 * `styleCb` and `tiers` keeps the type from recursing; omitting `layoutSize` is what makes
 * a tier swap free of any effect on the layout.
 *
 * A channel set to `null` is **taken away** rather than left to the style underneath, which
 * `undefined` cannot express — a tier that draws a card has to be able to drop the base's
 * icon, and omitting `svgIcon` only means "I am not naming it", so the base's would survive
 * and outrank the card. This is the one layer with that power: everywhere else in the chain
 * `null` still falls through, because a `styleCb` handing back a null straight out of node
 * data is an ordinary shape and has always meant "use the default".
 *
 * Clearing `shape` is not how a node is made shapeless — use `shape: 'none'`, which says the
 * content is the node.
 */
export type NodeTierStyle = Clearable<Omit<Partial<NodeStyle>, 'styleCb' | 'tiers' | 'focusTier' | 'layoutSize'>>

/** One drawing of a node, and the size at which it takes over. See {@link NodeStyle.tiers}. */
export interface NodeTier {
    /** Merged over the resolved base style while this tier is active. */
    style: NodeTierStyle
    /**
     * The box this drawing is designed to fill, in graph units. Declared rather than
     * measured: it sets the node's footprint and this tier's default threshold before
     * anything is drawn, so the layout never has to wait for a measurement.
     */
    width: number
    height: number
    /**
     * Rendered footprint in CSS pixels at which this tier takes over, i.e. `footprint x zoom`.
     *
     * Defaults to {@link width}, which reads as "engage once there is room for this drawing".
     * That is exact for the widest tier, which then appears at its design size at zoom 1; a
     * narrower tier engages earlier and is drawn proportionally smaller, so set this by hand
     * if an intermediate tier should appear at the size it was drawn at.
     */
    minRenderedSize?: number
}

export interface NodeStyle {
    /**
     * The shape of the node, either a standard shape or a custom SVG path
     * @default circle
     */
    shape: ((node: Node) => NodeShape) | NodeShape
    /**
     * The main color of the node
     * @default 'var(--pvt-node-color, #007acc)'
     */
    color: ((node: Node) => string) | string
    /** @default 10 */
    size: ((node: Node) => number) | number
    /** @default 'var(--pvt-node-stroke, #fff)' */
    strokeColor: ((node: Node) => string) | string
    /** @default 'var(--pvt-node-stroke-width, 2)' */
    strokeWidth: number | string
    /** @default 'var(--pvt-font-family)' */
    fontFamily: string
    /** @default 'var(--pvt-node-text-color, #fff)' */
    textColor: ((node: Node) => string) | string
    /** @default 'middle' */
    textAnchorPosition: 'start' | 'middle' | 'end'
    /** 
     * The horizontal shift applied to the node's label position.
     * A value of 0 means it is centered to the node, a value of 1 is east of the node, -1 is west of the node.
     * Other values are also accepted, e.g., 0.5 would be halfway between the center and the east of the node.
     * @default 0
     */
    textHorizontalShift: ((node: Node) => number) | number
    /** 
     * The vertical shift applied to the node's label position.
     * A value of 0 means it is centered to the node, a value of 1 is north of the node, -1 is south of the node.
     * Other values are also accepted, e.g., 0.5 would be halfway between the center and the north of the node.
     * @default 0
     */
    textVerticalShift: ((node: Node) => number) | number
    /**
     * Rotation degree applied to the node's label.
     * Positive values rotate clockwise, negative values rotate counter-clockwise.
     * @default 0
     */
    textRotateDegree: ((node: Node) => number) | number
    /**
     * Shorten an over-wide label with a middle ellipsis (`head…tail`); `false` draws it
     * in full, on a themed pill where it spills past the node.
     * @default true
     */
    textTruncate: ((node: Node) => boolean) | boolean
    iconClass?: IconClass,
    iconUnicode?: IconUnicode,
    /**
     * Inline SVG markup drawn inside the node. Sanitized before it reaches the DOM (scripting
     * and event handlers are stripped), but a remote `<image href>` inside it is still fetched
     * when the node renders — see the security guide.
     */
    svgIcon?: SVGIcon,
    /**
     * URL of a picture to draw on the node. Restricted to the `http:`, `https:`, `data:` and
     * `blob:` schemes; anything else is ignored. Rendering it fetches the URL.
     */
    imagePath?: ImagePath,
    /**
     * How an `imagePath` picture sits on the node's shape. Resolvable per node so
     * different nodes can mix modes (e.g. screenshots `'cover'`, other attachments `'icon'`).
     * @default 'icon'
     */
    imageFit?: ((node: Node) => ImageFit) | ImageFit,
    /**
     * The text to be used inside the node as an `SVGText` element
     */
    text?: ((node: Node) => string) | string,
    /**
     * The html to be used inside the node as an `SVGForeignObject` element.
     *
     * Resolved like every other channel, so a card can be declared at any level —
     * `nodeStyleMap[type].html` gives one kind of node a card while the rest keep their
     * shapes, and a single node's own style overrides that. Returning nothing draws no
     * card, so one callback can card some nodes and leave the others alone.
     *
     * Pair it with `shape: 'none'` for a card that **is** the node. Otherwise the shape is
     * still drawn behind it, and `size` is the smallest the node can be.
     *
     * The card is measured and the node grows to it, so it is never clipped and edges land
     * on its border. You do not have to make the returned element self-sizing — it is
     * measured inside a shrink-to-fit box, so `width: 100%` resolves against its own
     * content rather than against the placeholder.
     *
     * **Trusted HTML only.** Whatever this returns is inserted as-is, so build it with
     * `textContent` (or escape it) rather than interpolating node data into a markup string.
     */
    html?: (node: Node) => HTMLElement | string | void
    /**
     * Small indicators pinned to the node's rim, independent of every other channel —
     * see {@link NodeBadge}.
     *
     * Resolved like any other channel: the narrowest declaration wins outright rather than
     * merging, so a node's own `badges` **replaces** whatever `nodeStyleMap` or
     * `defaultNodeStyle` gave it. An empty array is the way to say "this one wears none";
     * `undefined` renders no badge group at all.
     *
     * Four fit on a plain node, two on one with children (the expand affordance reserves the
     * East corners). Anything beyond that collapses into a `+n` badge naming the rest.
     */
    badges?: ((node: Node) => NodeBadge[]) | NodeBadge[]
    /**
     * Alternative drawings of this node, chosen by how large it currently renders — a glyph
     * on an overview, a labelled chip once there is room for one, a card once there is room
     * for that. Ordered smallest first; the richest one that fits wins, and the base style is
     * the floor when none do.
     *
     * The node's footprint never changes with the drawing (see {@link layoutSize}), so
     * swapping tiers moves nothing.
     *
     * @example
     * ```ts
     * tiers: [
     *   { width: 32, height: 32, style: { shape: 'circle', size: 16 } },
     *   { width: 140, height: 44, style: { shape: 'none', html: chipFor } },
     * ]
     * ```
     */
    tiers?: NodeTier[]
    /**
     * The drawing used while this node is hovered, or selected on its own — whatever the
     * zoom. This is where a node says everything about itself.
     *
     * It merges over the resolved *base* style rather than over the active tier, so a chip
     * tier's `shape` or `html` cannot leak into it, and it holds a constant size on screen
     * however far the graph is zoomed out. It never changes the node's geometry: edges keep
     * landing on the tier underneath and nothing moves.
     *
     * When it fires is {@link GraphRendererOptions.focusTierTrigger}'s to say.
     */
    focusTier?: NodeTierStyle
    /**
     * The half-width of the box this node reserves for itself in the layout, in graph units.
     * This is the only size the simulation ever sees: set it and the drawing no longer drives
     * the collision radius, so a node can change how it is drawn without moving anything.
     *
     * Leave it unset and the drawing owns the spacing, as it always has — a shape spaces by
     * its `size`, an HTML card by what it measures.
     *
     * @default half the widest declared tier `width`, or unset when there are no tiers
     */
    layoutSize?: number
    /**
     * Callback to dynamically override style properties based on the node.
     *
     * Where it sits depends on which style block declares it. On a **node's own**
     * style it wins outright, and `nodeStyleMap` is skipped entirely. On
     * `render.defaultNodeStyle` it is the computed form of the default slot: it fills
     * only what neither the node nor `nodeStyleMap` set (and what a per-node `styleCb`
     * left out), and its result still loses to both.
     *
     * Runs once per node per render, so keep it cheap.
     */
    styleCb?: (node: Node) => Partial<NodeStyle>
}

export interface EdgeFullStyle {
    edge: EdgeStyle,
    label: LabelStyle,
}

export interface PartialEdgeFullStyle {
    edge?: Partial<EdgeStyle>
    node?: Partial<NodeStyle>
}

/**
 * - 'straight': The edge will go in a straight line from A to B
 * - 'curved': The edge will always be curved from A to B
 * - 'bidirectional': The edge will be curved only if there is a birectional relation between A and B. So, from A to B and B to A
 * @default 'bidirectional'
 */
export type CurveStyle = 'straight' | 'curved' | 'bidirectional'
export interface EdgeStyle {
    /** @default 'var(--pvt-edge-stroke, #999)' */
    strokeColor: string
    /** @default 2 */
    strokeWidth: number
    /** @default 1.0 */
    opacity: number
    /** @default bidirectional */
    curveStyle: CurveStyle
    /**
     * Whether the stroke is dashed 
     * @default false
     */
    dashed?: ((edge: Edge) => boolean) | boolean
    /**
     * Whether the dash should be animated (e.g., animation moving along the path)
     * @default: true 
     */
    animateDash?: boolean
    /**
     * Keeps labels horizontally aligned to the viewport
     * @default false
     * */
    rotateLabel: boolean
    /**
     * Which end marker should the edge use
     * @default arrow
     */
    markerEnd?: ((edge: Edge) => string) | string
    /**
     * Which start marker should the edge use
     * @default undefined
     */
    markerStart?: ((edge: Edge) => string) | string
    /**
     * Callback to dynamically override style properties based on the edge.
     *
     * Where it sits depends on which style block declares it. On an **edge's own**
     * style it wins outright, and `edgeStyleMap` is skipped entirely. On
     * `render.defaultEdgeStyle` it is the computed form of the default slot: it fills
     * only what neither the edge nor `edgeStyleMap` set (and what a per-edge `styleCb`
     * left out), and its result still loses to both.
     *
     * Runs once per edge per render, so keep it cheap.
     */
    styleCb?: (edge: Edge) => Partial<EdgeStyle>
}

export interface LabelStyle {
    /** @default #ffffff90 */
    backgroundColor: string
    /** @default 12 */
    fontSize: number
    /** @default system-ui, sans-serif */
    fontFamily: string
    /** @default #333 */
    color: string
    /**
     * Callback to dynamically override label style properties based on the edge. On an
     * edge's own label style it wins outright; on `render.defaultLabelStyle` it fills
     * only what the edge's own label style left unset.
     */
    styleCb?: (edge: Edge) => Partial<LabelStyle>
    labelAccessor?: (edge: Edge) => HTMLElement | string | void
}

/**
 * Define the styling of an Edge marker.
 */
export interface MarkerStyle {
    fill?: string
    pathD: string
    viewBox: string
    refX: number
    refY: number
    markerWidth: number
    markerHeight: number
    markerUnits?: 'userSpaceOnUse' | 'strokeWidth'
    orient?: 'auto' | 'auto-start-reverse' | number
    selected?: Partial<MarkerStyle>
}

/**
 * A map of all available edge marker styles.
 *
 * Custom markers can be added here and referenced by `markerStart` or `markerEnd`
 * in {@link EdgeStyle}.
 * 
 * @defaultValue {@link defaultMarkerStyleMap}
 */
export type MarkerStyleMap = Record<string, MarkerStyle>

/**
 * Region selection — dragging a shape across the canvas to select what it covers:
 * the marquee on the canvas, and the Select ▸ Lasso tool that draws a freehand one.
 * `enabled: false` takes both away, leaving click and shift-click selection.
 */
export interface SelectionBox {
    /** @default true */
    enabled: boolean
}