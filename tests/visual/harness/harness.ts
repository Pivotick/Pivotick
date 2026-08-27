/**
 * Visual-test harness.
 *
 * Boots a Pivotick graph into `#app` with deterministic options and exposes a
 * small, serialisable control API on `window.__pivotick`. Tests drive the app
 * either through this API (for setup / non-visual triggers) or through real
 * Playwright pointer events against the elements it makes locatable.
 *
 * This file is internal test code, so it imports internal modules directly
 * (`../../../src/...`). Importing from `index` also pulls in the stylesheet.
 */
import { Pivotick, Node, ColorPaletteMapper, minimap } from '../../../src/index'
import { Note } from '../../../src/Note'
import { TreeLayout } from '../../../src/plugins/layout/Tree'
import { EgoTreeLayout } from '../../../src/plugins/layout/EgoTree'
import { createInspectModal } from '../../../src/ui/elements/modals/InspectNodeModal/InspectNodeModal'
import { FormFactory } from '../../../src/utils/FormFactory'
import type {
    EdgeFacet, FilterFacet, FilterFacetOption, FilterFieldConfig, GraphFilters,
} from '../../../src/interfaces/GraphQueryEngine'
import type { GraphInteractionContext } from '../../../src/interfaces/GraphInteractions'
import type { GraphBounds } from '../../../src/GraphRenderer'
import type { EdgeStyle, NodeBadge } from '../../../src/interfaces/RendererOptions'
import { Minimap, type MinimapOptions } from '../../../src/plugins/minimap'
import type {
    ExtraPanel, ExtraPanelSelection, LegendEntry, LegendGroupOptions, LegendOptions, LegendPosition,
    LegendSection, LegendToggleState,
    PropertyEntry,
} from '../../../src/interfaces/GraphUI'
import type { PivotickPlugin } from '../../../src/interfaces/Plugin'
import type { RenderContext } from '../../../src/interfaces/AsyncContent'
import { Edge as EdgeInstance, type Edge } from '../../../src/Edge'
import type {
    DeleteContext,
    DeleteDecision,
    EdgeCreateContext,
    EdgeCreateDecision,
    InterractionCallbacks,
    NodeCreateContext,
    NodeCreateDecision,
} from '../../../src/interfaces/InterractionCallbacks'
import {
    buildAutoFixture, fixtures,
    type AutoFixtureSpec, type BuiltFixture, type FixtureName, type RawNote,
} from './fixtures'
import { measureLayout, type MeasuredLayout } from '../../../src/AutoPhysics'
import type { PhysicsKnobs } from '../../../src/Simulation'

/** Named `onBeforeEdgeCreate` behaviours the harness can install (functions can't cross `page.evaluate`). */
export type EdgeHookBehavior =
    | 'accept'
    | 'accept-async'
    | 'veto'
    | 'veto-async'
    | 'veto-once'
    | 'accept-data'
    | 'accept-data-async'
    // Call `ctx.promptLabel({ mode })`, then accept with the entered label as
    // `data.label` (or veto if the user cancelled) — exercises the hook-driven prompt.
    | 'prompt-inline'
    | 'prompt-modal'
    // Call `ctx.promptData(...)` and accept with the collected payload (or veto on
    // cancel) — `-fields` uses a declarative FormFactory form, `-render` custom HTML.
    | 'prompt-data-fields'
    | 'prompt-data-render'
    // Mirrors the gallery card: drag → inline free-text label, click → modal dropdown.
    | 'prompt-by-origin'

/** Named `isValidConnection` live-predicate behaviours. */
export type ValidConnBehavior = 'reject-all' | 'reject-target-b'

/**
 * A sidebar extra panel to build page-side (its `title` / `render` are functions,
 * so the panel itself can't cross `page.evaluate`).
 *
 * Every panel renders the selection it was called with plus its own render count
 * (`node a · renders=3`), so a test can read straight off the DOM whether — and
 * how often — the library re-invoked it.
 */
export interface PanelSpec {
    /** Explicit id, so tests can address the panel. Auto-generated when omitted. */
    id?: string
    alwaysVisible?: boolean
    reactive?: boolean
    order?: number
    /**
     * Where {@link HarnessApi.loadWithPanels} registers it: `'options'` (default)
     * puts it in `UI.extraPanels`; `'early'` calls `addPanel` on the fresh graph,
     * before `graphReady` fires.
     */
    register?: 'options' | 'early'
    /** Add buttons wired to the panel handle's own `refresh()` / `remove()`. */
    selfDriven?: boolean
    /** Omit `title` entirely — the panel then has no header row. */
    noTitle?: boolean
    /**
     * Make `render` return a promise, settled by hand through
     * {@link HarnessApi.settleAsync} under the key `extraPanel.render:<id>`.
     */
    async?: boolean
}

/**
 * A consumer content hook the harness can install, synchronously or as a
 * promise it hands back but does not settle — that is the test's job, via
 * {@link HarnessApi.settleAsync} / {@link HarnessApi.failAsync}. Holding a
 * render open indefinitely is what makes the pending window, the staleness
 * drop and out-of-order commits observable.
 */
export type AsyncHook =
    | 'tooltip.render'
    | 'tooltip.renderNodeExtra'
    | 'tooltip.nodePropertiesMap'
    | 'propertiesPanel.render'
    | 'propertiesPanel.nodePropertiesMap'
    | 'neighborsPanel.render'
    | 'mainHeader.render'
    | 'extraPanel.render'

export interface AsyncContentSpec {
    /** Hooks installed as promises the test settles by hand. */
    hooks?: AsyncHook[]
    /** Hooks installed as ordinary synchronous ones — the regression baseline. */
    syncHooks?: AsyncHook[]
    /** Override `UI.asyncContent.placeholder` with this text. */
    placeholder?: string
    /** Override `UI.asyncContent.error` with this text. */
    error?: string
}

/** One render the harness is holding open, and what the library gave it. */
interface HeldRender {
    resolve: (text: string) => void
    reject: (error: Error) => void
    /** Captured eagerly, the way a consumer forwarding it to `fetch` would. */
    signal: AbortSignal
    isStale: () => boolean
}

export interface ConnectConfig {
    edgeHook?: EdgeHookBehavior
    validConnection?: ValidConnBehavior
    /** Delay (ms) for the `*-async` behaviours, so a test can observe the pending window. */
    asyncDelayMs?: number
}

/** Named `onBeforeDelete` behaviours the harness can install. */
export type DeleteHookBehavior =
    | 'accept'
    | 'accept-async'
    | 'veto'
    | 'veto-async'
    /** Accept, but keep only the *first* requested node — the narrowing case. */
    | 'narrow-nodes'
    /** Accept the nodes while sparing every named edge (`edges: []`). */
    | 'spare-edges'
    /** Gate on `ctx.confirm()`, then accept — the library-provided confirm modal. */
    | 'confirm'

/** Named `onBeforeNodeCreate` behaviours. */
export type NodeCreateHookBehavior =
    | 'accept'
    | 'accept-async'
    | 'veto'
    /** Accept, supplying the new node's id / data / style. */
    | 'accept-data'
    /** Collect the payload through `ctx.promptData({ fields })`, or veto on cancel. */
    | 'prompt-data'

/** Named `onBeforeEdgeEditCommit` / `onBeforeNodeEditCommit` behaviours. */
export type EdgeEditHookBehavior = 'accept' | 'accept-async' | 'veto' | 'veto-async'

export interface WritePathConfig {
    deleteHook?: DeleteHookBehavior
    nodeCreateHook?: NodeCreateHookBehavior
    edgeEditHook?: EdgeEditHookBehavior
    /** The node twin of {@link edgeEditHook} (`onBeforeNodeEditCommit`). */
    nodeEditHook?: EdgeEditHookBehavior
    /**
     * Install `onEdgeEdit`: the session's body becomes one custom input that writes
     * straight into `session.draft` — the "a custom body owns the draft" contract.
     * Also counts `onEdgeEditCancel` calls.
     */
    edgeEditBody?: boolean
    /** Delay (ms) for the `*-async` behaviours, so a test can observe the pending window. */
    asyncDelayMs?: number
}

/** Per-hook invocation counts, reset by `configureWritePath`. */
export interface WritePathCalls {
    delete: number
    nodeCreate: number
    edgeEditCommit: number
    edgeEditBody: number
    edgeEditCancel: number
    nodeEditCommit: number
}

/** The ids a `DeleteContext` carried — what the hook was actually told about. */
export interface RecordedDeleteContext {
    nodes: string[]
    edges: string[]
    notes: string[]
    cascadingEdges: string[]
    origin: string
}

/** A `DeleteOutcome`, flattened to ids so it can cross `page.evaluate`. */
export interface RecordedDeleteOutcome {
    accepted: boolean
    nodes: string[]
    edges: string[]
    notes: string[]
}

/** A `nodeChange` / `edgeChange` event, as the data bus reported it. */
export interface RecordedDataChange {
    id: string
    previous: Record<string, unknown>
    next: Record<string, unknown>
}

/** What a delete request names, by id. */
export interface DeleteRequestSpec {
    nodes?: string[]
    edges?: string[]
    notes?: string[]
    origin?: 'bulk-action' | 'context-menu'
}

/** An edge that actually entered the model, captured from the `edgeAdd` event. */
export interface RecordedEdge {
    id: string
    data: Record<string, unknown>
    directed: boolean | null
}

/**
 * Deterministic baseline options shared by every fixture:
 *  - `mode: 'light'`  → interactions enabled, minimal chrome
 *  - `theme: 'light'` → pin colours (otherwise follows prefers-color-scheme)
 *  - simulation off   → no physics, positions come straight from the fixture
 *  - zoom animation off → no transitions to wait on / diff against
 */
const BASE_OPTIONS = {
    isDirected: true,
    UI: {
        mode: 'light',
        theme: 'light',
        sidebar: { collapsed: true },
        // The coming-soon rail modes are hidden by default (opt-in). Enrich is
        // opted in here so the shared baselines keep exercising the SOON slot;
        // the mode-rail spec additionally enables Explore.
        modeRail: { enrich: true },
    },
    // `physics: 'manual'` pins the knobs for every baseline: the `Auto` preset is the
    // library default and re-tunes as the graph changes, which would make snapshots
    // depend on node count and canvas size. The auto spec opts back in explicitly.
    simulation: { enabled: false, useWorker: false, physics: 'manual' },
    render: { zoomAnimation: false },
}

/** Distinct values of a node-data key across the graph, flattening array values. */
function distinctValues(graph: Pivotick, key: string): FilterFacetOption[] {
    const values = new Set<string>()
    for (const node of graph.getMutableNodes()) {
        const value = node.getData()[key]
        if (Array.isArray(value)) value.forEach((entry) => values.add(String(entry)))
        else if (value !== null && value !== undefined) values.add(String(value))
    }
    return [...values].sort().map((value) => ({ label: value, value }))
}

/**
 * The facet declaration {@link HarnessApi.loadWithFacets} installs — one facet per
 * shape the feature has to cover, against the `mispLike` fixture:
 *
 *  - `category` / `attr-type` — plain multiselects whose options follow the graph
 *  - `to_ids`        — a boolean (true / false / unset)
 *  - `value`         — a regex pattern
 *  - `tags`          — array-valued data, any-of membership
 *  - `tags_all`      — the same data with `matchMode: 'all'` (and-semantics)
 *  - `child_type`    — computed: reads the node's *children*, not its own data
 *  - `min_sightings` — a predicate; declared last but `order: -1` renders it first
 *
 * Note what is *absent*: `uuid`, `label`, `sightings`. A declared panel contains
 * exactly what was declared.
 */
/**
 * A legend to install page-side. `UI.legend` carries predicates (and possibly an
 * entries *function*), none of which survive `page.evaluate`, so a test describes
 * the legend it wants and the harness builds it.
 *
 * Every mode colours the graph the way an integrator would — a
 * {@link ColorPaletteMapper} over the legend's key — so the swatches the legend
 * samples are the colours actually painted.
 */
export interface LegendSpec {
    /**
     * `'derived'` (default) lets the library derive entries from `key`;
     * `'declared-array'` / `'declared-function'` hand it explicit entries as an
     * array / as a function of the live graph.
     */
    mode?: 'derived' | 'declared-array' | 'declared-function'
    /** The node-data key the legend keys on, and that drives the node colours. */
    key?: string
    /** Declare entries with neither a predicate nor a `key` — the "matches nothing" case. */
    omitKey?: boolean
    /** Declare neither `key` nor `entries`: the `render.nodeTypeAccessor` section. */
    auto?: boolean
    /** Explicit section identity, when the test needs to name a filter key. */
    id?: string
    title?: string
    position?: LegendPosition
    collapsed?: boolean
    collapsible?: boolean
    filterable?: boolean
    showCounts?: boolean
    maxVisibleEntries?: number
    /** Also declare `UI.filter.facets`, so a legend `key` naming one is adopted. */
    withFacets?: boolean
    /** Paint this node off-palette, so its category resolves to two colours. */
    conflictNodeId?: string
}

/**
 * A legend keyed on several dimensions at once — `UI.legend` in its stacked form.
 * Each section is an ordinary {@link LegendSpec}; the card carries the position.
 */
export interface LegendGroupSpec {
    sections: LegendSpec[]
    position?: LegendPosition
    /** The key the node *colours* follow. @default the first section's key */
    colorKey?: string
    /** Declare `render.nodeTypeAccessor` on this key, for an `auto` section to find. */
    accessor?: string
    /** Also declare `UI.filter.facets`, so a section key naming one is adopted. */
    withFacets?: boolean
}

/** One rendered legend section, read straight off the DOM. */
export interface LegendSectionSnapshot {
    /** The `data-section` attribute — the section's resolved id. */
    id: string
    title: string
    collapsed: boolean
    rows: LegendRow[]
}

/**
 * A graph that declares `render.nodeTypeAccessor` (or doesn't) so the *automatic*
 * legend has something — or nothing — to key on, and whose colours either do or
 * don't line up with that dimension.
 */
export interface AutoLegendSpec {
    /** Data key the declared accessor reads. `null` declares no accessor at all. */
    accessor?: string | null
    /** Paint every node the same colour, so no dimension can explain the colours. */
    constantColor?: boolean
    /** `UI.legend`: `true` forces a legend, `false` suppresses it, omitted = automatic. */
    legend?: boolean
}

/**
 * A graph whose relations come in kinds — `render.edgeTypeAccessor` +
 * `edgeStyleMap`, plus whichever of the two controls the test is about.
 *
 * Like {@link LegendSpec}, this exists because the real options carry *functions*
 * (the accessor, an entries function), none of which survive `page.evaluate` — so a
 * test describes what it wants and the harness builds it page-side.
 */
export interface EdgeLayerSpec {
    /** Declare `UI.filter.edgeFacets`, so the panel grows its Relationships section. @default true */
    facet?: boolean
    /** Declare a `scope: 'edge'` legend section. @default false */
    legend?: boolean
    /** Put a node-scoped section above the edge one — the mixed card. @default false */
    nodeSection?: boolean
    /** The edge facet's widget. @default 'multiselect' (a layer) */
    facetType?: 'multiselect' | 'numberRange' | 'regex'
    /** The edge-data key the facet and the legend section key on. @default 'kind' */
    key?: string
    /** Suppress `render.edgeStyleMap`, leaving every kind the default stroke. @default false */
    noStyleMap?: boolean
    /**
     * Give every edge its own `styleCb`, to prove it bypasses the style map — the
     * precedence nodes already document. A flag rather than an override because a
     * callback cannot cross `page.evaluate`.
     */
    styleCb?: boolean
}

/**
 * Which of the `render.default*Style.styleCb` callbacks to declare, and what else to
 * declare beside them, so a test can pin down where each one sits in the precedence
 * chain. A flag set rather than overrides because callbacks cannot cross
 * `page.evaluate`.
 */
export interface StyleCbSpec {
    /** `render.defaultNodeStyle.styleCb` — paints every node {@link DEFAULT_CB_COLOR}. */
    node?: boolean
    /**
     * `render.defaultEdgeStyle.styleCb` — sets *both* a colour and a width, so a test
     * can watch a narrower declaration take the colour while the width still lands.
     */
    edge?: boolean
    /** `render.defaultLabelStyle.styleCb` — paints every edge label {@link DEFAULT_CB_COLOR}. */
    label?: boolean
    /** Also declare `edgeTypeAccessor` + `edgeStyleMap`, which names each kind more narrowly. */
    edgeStyleMap?: boolean
    /** Give every edge its own `styleCb` too — the one that wins outright. */
    edgeOwn?: boolean
}

/** One rendered relationship-layer row in the filter panel, read off the DOM. */
export interface EdgeLayerRow {
    /** The edge-data value this row toggles. */
    value: string
    label: string
    count: string | null
    /** Whether the layer is currently switched **off**. */
    hidden: boolean
}

/** One rim badge as it is actually drawn — where it sits, how big it is, how it is wired. */
export interface NodeBadgeSnapshot {
    position: string
    /** Badge centre, in the node group's own coordinates. */
    cx: number
    cy: number
    /** The pill's box; `radius` is its corner rounding, i.e. half its height. */
    width: number
    height: number
    radius: number
    text: string
    /** The painted fill, as the browser reports it — so a themed default reads back too. */
    fill: string
    title: string | null
    interactive: boolean
    overflow: boolean
}

/** How far a node's drawn shape reaches, and whether it curves away from its corners. */
export interface NodeRimBox {
    hx: number
    hy: number
    round: boolean
}

/** What {@link HarnessApi.loadBadges} should install alongside the fixture's own badges. */
export interface BadgeHarnessSpec {
    /** Declare `callbacks.onBadgeClick`, which makes every badge interactive. */
    globalHandler?: boolean
    /** Have a `badgeClick` bus listener call `cancel()`, which should suppress both handlers. */
    cancelBus?: boolean
    /**
     * Swap the fixture for two `renderNode` HTML cards wearing badges — the path where
     * the default node render never runs and the node's box is only known once measured.
     */
    customNodes?: boolean
    /**
     * Declare badges at three levels at once so precedence is observable: `nodeStyleMap`
     * gives every node a `MAP` badge, `circle` declares its own, and `square` declares
     * an empty array.
     */
    precedence?: boolean
}

/** The stroke a line swatch draws with, and whether it is dashed / arrow-headed. */
export interface EdgeSwatchSnapshot {
    stroke: string
    dashed: boolean
    marker: boolean
}

/** One rendered legend row, read straight off the DOM. */
export interface LegendRow {
    id: string
    label: string
    /** The rendered count, or `null` when `showCounts: false`. */
    count: string | null
    /** The swatch's CSS colour (`--pvt-legend-swatch-color`). */
    color: string
    hidden: boolean
    disabled: boolean
}

/** The key a `LegendSpec` defaults to: four distinct values across `mispLike`'s top level. */
const LEGEND_KEY = 'attr-type'

/** The values a `declared-array` legend lists, in declaration order. */
const DECLARED_LEGEND_VALUES = ['ip-src', 'domain', 'md5', 'object']

/** Fixed colours for declared entries, so a screenshot can't depend on assignment order. */
const LEGEND_COLORS = ['#7EA2FB', '#85CB33', '#FFB74D', '#BA68C8', '#4DD0E1']

/** The edge-data key `EdgeLayerSpec` defaults to — the dimension the fixtures carry. */
const EDGE_LAYER_KEY = 'kind'

/**
 * Per-kind edge styling, declared the way an integrator would. The legend is
 * descriptive, so these are exactly the strokes its line swatches must report back.
 */
const EDGE_STYLE_MAP: Record<string, Partial<EdgeStyle>> = {
    'object-reference': { strokeColor: '#428bca' },
    'correlation': { strokeColor: '#888888', dashed: true },
    'analyst-relationship': { strokeColor: '#f39a1f', dashed: true, markerEnd: 'arrow' },
    'tag': { strokeColor: '#85CB33' },
}

/** What `EdgeLayerSpec.styleCb` paints, so it can't be confused with any mapped kind. */
const STYLE_CB_COLOR = '#ff00ff'

/** What a `render.default*Style.styleCb` paints — distinct from every other source. */
const DEFAULT_CB_COLOR = '#00c2a8'
/** The width a default edge `styleCb` sets; nothing else in these fixtures sets one. */
const DEFAULT_CB_WIDTH = 7

/** The off-palette colour `LegendSpec.conflictNodeId` is painted with. */
const LEGEND_CONFLICT_COLOR = '#FF0000'

const DECLARED_FACETS: FilterFacet[] = [
    {
        key: 'category', label: 'Category', type: 'multiselect',
        options: (graph) => distinctValues(graph as Pivotick, 'category'),
    },
    {
        key: 'attr-type', label: 'Type', type: 'multiselect',
        options: (graph) => distinctValues(graph as Pivotick, 'attr-type'),
    },
    { key: 'to_ids', label: 'IDS flag', type: 'boolean' },
    { key: 'value', label: 'Value', type: 'regex' },
    {
        key: 'tags', label: 'Tag', type: 'multiselect',
        options: (graph) => distinctValues(graph as Pivotick, 'tags'),
    },
    {
        key: 'tags_all', label: 'Has all tags', type: 'multiselect', matchMode: 'all',
        accessor: (node) => node.getData().tags,
        options: (graph) => distinctValues(graph as Pivotick, 'tags'),
    },
    {
        key: 'child_type', label: 'Contains attribute of type', type: 'multiselect',
        accessor: (node) => node.children.map((child) => child.getData()['attr-type']),
        options: () => [{ label: 'md5', value: 'md5' }, { label: 'filename', value: 'filename' }],
    },
    {
        key: 'min_sightings', label: 'Min sightings', type: 'text', order: -1,
        predicate: (node, value) => node.getData().to_ids === true
            && Number(node.getData().sightings) >= Number(value),
    },
]

/** What an async content hook renders once it settles — locatable, and self-describing. */
function asyncTestElement(text: string): HTMLElement {
    const element = document.createElement('div')
    element.className = 'pvt-test-async'
    element.textContent = text
    return element
}

/** The properties-map counterpart: one row carrying the same text. */
function asyncTestProperties(text: string): PropertyEntry[] {
    return [{ name: 'async', value: text }]
}

/** How a test-panel reports the selection it was rendered with. */
function describeSelection(selection: ExtraPanelSelection): string {
    if (selection === null) return 'nothing selected'
    if (Array.isArray(selection)) {
        return `${selection.length} ${selection[0] instanceof Node ? 'nodes' : 'edges'}`
    }
    return `${selection instanceof Node ? 'node' : 'edge'} ${selection.id}`
}

function panelButton(className: string, label: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button')
    button.className = className
    button.type = 'button'
    button.textContent = label
    button.addEventListener('click', onClick)
    return button
}

type PlainObject = Record<string, unknown>

function isPlainObject(value: unknown): value is PlainObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Recursively merge `override` into a deep copy of `base` (arrays are replaced). */
function mergeOptions(base: PlainObject, override: PlainObject): PlainObject {
    const out: PlainObject = { ...base }
    for (const [key, value] of Object.entries(override)) {
        const current = out[key]
        if (isPlainObject(current) && isPlainObject(value)) {
            out[key] = mergeOptions(current, value)
        } else {
            out[key] = value
        }
    }
    return out
}

/** Which node shape an anchoring subject renders as. */
export type AnchorSubject =
    | 'circle' | 'square' | 'triangle' | 'hexagon'
    | 'customPath' | 'frameImage' | 'htmlCard' | 'htmlSmallCard' | 'renderNodeCard'

/** One end of one edge, as actually drawn — everything {@link HarnessApi.probeAnchors} knows. */
export interface AnchorProbe {
    edgeId: string
    /** The subject node this end belongs to. */
    subject: AnchorSubject
    /** Which end of the edge the subject sits at. */
    end: 'from' | 'to'
    /** How the router drew it: straight / curved / self-loop. */
    kind: 'straight' | 'curved' | 'selfLoop'
    /** Where the drawn path meets the subject. */
    anchor: { x: number; y: number }
    /** The subject's centre. */
    center: { x: number; y: number }
    /** Centre of the node at the other end (the subject itself for a self-loop). */
    other: { x: number; y: number }
    /** Bounding box of the drawn `.node` shape, if it has one. */
    shapeBox: { width: number; height: number } | null
    /** Box of the HTML card's foreignObject, if it has one. */
    cardBox: { width: number; height: number } | null
    /** What collision sees — must stay untouched by the anchoring work. */
    circleRadius: number
    /** The measured rectangular border, when the node has one. */
    borderBox: { halfWidth: number; halfHeight: number } | null
}

export interface HarnessApi {
    /** Build a graph from a named fixture; resolves once it has finished rendering. */
    load(name: FixtureName, overrides?: PlainObject): Promise<void>
    /**
     * Build an unpinned graph of `spec.nodes` circles with the simulation running
     * and the `Auto` physics preset on — the one place in the suite where the layout
     * is produced by physics rather than by fixed coordinates.
     */
    loadAuto(spec: AutoFixtureSpec, overrides?: PlainObject): Promise<void>
    /**
     * Boot an auto fixture with a raw simulation config — including *no* `physics`
     * key, which is what auto's default-on rule is decided from.
     */
    loadAutoWithConfig(spec: AutoFixtureSpec, simulation?: PlainObject): Promise<void>
    /** Add `count` nodes of radius `radius`, chained onto the graph already loaded. */
    growAuto(count: number, radius: number): void
    /** What auto chose, what the layout looks like, and what the camera made of it. */
    autoState(): AutoState
    /** Reheats since the last `loadAuto` or `resetReheatCount`. */
    reheatCount(): number
    resetReheatCount(): void
    /**
     * Is the engine still ticking this run?
     *
     * Reads the flag the tick loop itself stops on. The alternative — polling the
     * bounding box until two samples agree — reports a slow-moving mid-run frame as
     * settled, and the noise that introduces is larger than the effect a convergence
     * test is trying to measure.
     */
    simulationRunning(): boolean
    /**
     * The live d3 alpha — how much heat is left in the run.
     *
     * Read in the same `page.evaluate` as the call that reheats, this is how much heat
     * that caller asked for, exactly and with no timing in the way.
     */
    simulationAlpha(): number
    /**
     * Build a graph of custom `renderNode` HTML cards (fixed-size boxes) packed
     * tightly around the origin with no edges — for exercising library-fixes #8
     * (a custom node's measured size must feed its collision radius). A
     * `renderNode` is a function, so it can't be passed through `load`'s
     * serialisable overrides; this bakes it in on the page side.
     */
    loadCustomNodes(overrides?: PlainObject): Promise<void>
    /**
     * Construct a graph with NO data so `init()` is skipped and the renderer's
     * `nodeSelection` is never assigned — the precondition for the canvas
     * visibility-observer null-deref (see
     * prd/bug-intersection-observer-nodeselection-undefined.md). Invokes the
     * exact re-measure callback the `IntersectionObserver` fires and reports
     * whether `nodeSelection` was unset and whether the callback threw. Pre-fix
     * it throws `Cannot read properties of undefined (reading 'each')`.
     */
    /**
     * Build the edge-anchoring matrix: one subject per node shape, each carrying a
     * straight edge, a reciprocal (curved) pair and a self-loop, so a test can
     * check where every kind of edge meets every kind of node.
     *
     * `render.renderNode` applies to *every* node, so the card built that way
     * needs its own graph — pass `'renderNode'` for it and `'shapes'` for the rest.
     */
    loadAnchorMatrix(mode: 'shapes' | 'renderNode'): Promise<void>
    /** Every subject end of every edge in the matrix, as actually drawn. */
    probeAnchors(): AnchorProbe[]
    /**
     * Where the connector from an attached note lands on its node — the
     * note→node counterpart of {@link probeAnchors}.
     */
    probeNoteConnector(noteId: string): { anchor: { x: number; y: number }; center: { x: number; y: number } } | null
    /**
     * Zoom the canvas to `scale`, then add a node, and report the box its card was
     * measured at. A card is measured with `getBoundingClientRect`, which reports
     * *screen* pixels — so one first laid out while the graph is zoomed has to end
     * up at its own CSS size all the same.
     */
    addCardWhileZoomed(id: string, scale: number): Promise<{ cardBox: { width: number; height: number } | null; zoom: number }>
    /**
     * Re-draw all edge positions `ticks` times and report how many node styles
     * that cost. Edge anchoring must read cached geometry, so this has to stay 0:
     * resolving a style per edge end per frame also drags user style callbacks
     * into the render loop.
     */
    countStyleResolvesPerTick(ticks: number): number
    probeUnrenderedVisibility(): { nodeSelectionUnset: boolean; remeasureThrew: boolean }
    /** Select a node by id (renders the selection visuals). */
    selectNode(id: string): void
    /** Select an edge by id. */
    selectEdge(id: string): void
    /**
     * Select several nodes at once (multi-selection). Renders every node's
     * selection highlight and — with focus mode on — dims the nodes/edges adjacent
     * to none of them. This is the deterministic stand-in for shift+clicking nodes:
     * it drives the same `selectNodes` path the pointer gesture ends up calling.
     */
    multiSelect(ids: string[]): void
    /** Ids of the currently selected nodes — for verifying box / lasso selection. */
    selectedNodeIds(): string[]
    /**
     * Load the `badges` fixture with real badges installed page-side.
     *
     * `NodeBadge.onClick` and a `badges` function are functions, so they cannot travel
     * through `load`'s serialisable overrides — each node's `data.badges` descriptors are
     * turned into badges here instead. A descriptor with `click: true` gets an `onClick`.
     */
    loadBadges(spec?: BadgeHarnessSpec, overrides?: PlainObject): Promise<void>
    /** Every badge drawn on a node, in DOM order — geometry, paint and wiring. */
    nodeBadges(id: string): NodeBadgeSnapshot[]
    /**
     * How far the node's drawn shape reaches, and whether its outline curves away from
     * the corner — what a badge's placement has to be judged against.
     */
    nodeRimBox(id: string): NodeRimBox | null
    /**
     * The shift applied to the whole badge group — zero until a cluster expands and the node
     * slides to the bubble's NW rim, taking its badges with it.
     */
    badgeGroupOffset(id: string): { x: number; y: number } | null
    /** Where the expand/collapse affordance sits, in the node group's coordinates. */
    nodeIconAnchor(id: string): { x: number; y: number } | null
    /** Badge handlers that fired, in order, since the fixture loaded. */
    badgeClickLog(): string[]
    clearBadgeClickLog(): void
    /** Clear all selection. */
    deselectAll(): void
    /** Add a node with a fixed position and stable domID (`#node-<id>`). */
    addNode(id: string, x: number, y: number, label?: string, data?: PlainObject): void
    /** Create an edge directly through the editing layer. */
    connect(fromId: string, toId: string): void
    /** Enter click-to-connect mode. */
    startClickConnect(): void
    /** Pick a node as source/target while in click-to-connect mode. */
    pickConnectNode(id: string): void
    /**
     * Enter the node→edge connection mode (the toolbar's "Add Edge"): wires the
     * node pointer-down handler so a real *drag* from a node begins a connection
     * (pending-drag → dragging → shadow-edge preview), plus the node-click handler
     * for click-to-connect. Unlike {@link startClickConnect} — which starts a bare
     * click-connect session without the pointer-down hook — this is the full mode
     * the drag-to-connect gesture needs. Escape-to-cancel is already wired by the
     * toolbar the harness mounts in light mode.
     */
    startEdgeConnect(): void
    /**
     * Expand one or more clusters and **deterministically** lay out their
     * children. Pass a single id (`'group'`) to expand a top-level cluster, or a
     * path (`['group', 'c1']`) to expand a cluster and then a nested cluster
     * inside it. Resolves once every level has settled.
     *
     * A cluster's children are normally placed by a per-cluster force pass (in a
     * throw-away subgraph) — non-deterministic and timing-dependent. This freezes
     * that pass and re-pins the children onto a fixed ring inside the cluster
     * area, so the rendered cluster is a pure function of the fixture (the same
     * trick `pin`/`applyLayout` use for the top-level layout).
     */
    expand(path: string | string[]): Promise<void>
    /** Collapse a previously-expanded cluster by id. */
    collapse(id: string): Promise<void>
    /** Open the in-place node edit session (surfaces the edit-node modal). */
    openNodeEditor(id: string): void
    /**
     * Open the inspect-node modal for a node (Properties + JSON tabs). Calls the
     * same `createInspectModal` the `i` shortcut and the context-menu "Inspect
     * Properties" item use — only reachable in light/full mode (the modal
     * container is built there).
     */
    openInspect(id: string): void
    /** Add a note; returns its domID for `#note-<id>` lookups. */
    addNote(note: RawNote): string
    /**
     * Re-pin every node to the position its fixture declared, then redraw + re-fit.
     *
     * The initial layout pass clears `fx/fy` and settles nodes from their seed
     * positions (deterministic, but sim-driven), so a fixture's coordinates are
     * only a starting point — not a fixed layout. Call this after `load()` when a
     * test needs the exact layout it designed (e.g. side-by-side styling scenes).
     */
    pin(): void
    /**
     * Re-apply the **exact** positions of the currently-loaded tree / egoTree
     * layout and pin them (no-op for `force`).
     *
     * On `load`, a tree layout's positions are produced by a *force relaxation*
     * toward the computed tree targets — converged, but timing-dependent and so
     * brittle for pixel baselines (see the README). This re-runs the layout's
     * deterministic d3-hierarchy computation, writing the exact target positions
     * onto the nodes, then pins (`fx/fy`) and re-fits. The baseline becomes a
     * pure function of (graph, layout options) — independent of tick count.
     */
    applyLayout(): void
    /** Re-fit and centre all content (including notes) into the viewport. */
    fit(scale?: number): void
    /** Current element counts — handy for non-visual assertions. */
    counts(): { nodes: number; edges: number; notes: number }
    /** Every node's current `(x, y)` (graph coordinates) — for layout assertions. */
    nodePositions(): Record<string, { x: number; y: number }>
    /**
     * Apply a single query filter on a node-data field. Non-matching nodes (and
     * their edges) are **removed** from the render, not dimmed. `value` follows the
     * library's {@link FilterFieldConfig} shape (a scalar/array + `matchMode`, or a
     * `{ min, max }` range for numeric fields).
     */
    setFilter(key: string, value: FilterFieldConfig): void
    /** Apply several filters at once (each keyed by node-data field). */
    setFilters(filters: GraphFilters): void
    /**
     * Load a fixture with the MISP-shaped `UI.filter.facets` declaration installed
     * (see {@link DECLARED_FACETS}). Facets carry `accessor`/`predicate`/`options`
     * functions, which can't cross `page.evaluate` — so they're built page-side here.
     */
    loadWithFacets(name: FixtureName, overrides?: PlainObject): Promise<void>
    /**
     * Load a fixture coloured by a palette mapper over the legend's key, with
     * `UI.legend` built from {@link LegendSpec}.
     */
    loadWithLegend(name: FixtureName, spec?: LegendSpec, overrides?: PlainObject): Promise<void>
    /**
     * Load a fixture with **no** `UI.legend` (unless the spec sets one), so the
     * automatic legend decides for itself whether to appear.
     */
    loadAutoLegend(name: FixtureName, spec?: AutoLegendSpec, overrides?: PlainObject): Promise<void>
    /** Replace the legend at runtime (`graph.setLegend`); `false` removes it. */
    setLegend(spec?: LegendSpec | boolean): void
    /**
     * Load a fixture whose `UI.legend` keys the graph on several dimensions at once
     * — the stacked form built from {@link LegendGroupSpec}.
     */
    loadWithLegendGroup(name: FixtureName, spec: LegendGroupSpec, overrides?: PlainObject): Promise<void>
    /** Replace the legend at runtime with a stacked one. */
    setLegendGroup(spec: LegendGroupSpec): void
    /** The rendered sections, top to bottom, each with its own rows. */
    legendSections(): LegendSectionSnapshot[]
    /** The rendered legend rows, in display order. */
    legendRows(): LegendRow[]
    /** The legend's header text, or `null` when there is no legend. */
    legendTitle(): string | null
    /**
     * The colour the renderer resolved for a node — what is actually painted, and
     * so what a derived legend's swatch must equal.
     */
    nodeColor(id: string): string
    /** Every `legendToggle` event since the graph was loaded, in order. */
    legendEvents(): LegendToggleState[]
    /**
     * Active filter keys, minus the always-present `manuallyHidden` — the answer to
     * "did the legend leave a phantom filter behind".
     */
    activeFilterKeys(): string[]
    /** `console.warn` messages recorded since the graph was loaded. */
    warnings(): string[]
    /** Load a fixture with the real `minimap()` plugin installed. */
    loadWithMinimap(name: FixtureName, options?: MinimapOptions, overrides?: PlainObject): Promise<void>
    /**
     * Load a fixture with a **plugin-registered** dock pane. Distinct from
     * `addTestDockTab`, which reaches `UIManager.addDockTab` directly: this goes through
     * `ctx.addDockTab` inside a plugin's `install`, which is the route that arrives after
     * the UI is already built.
     *
     * The pane records `nodeAdd` whether or not it is on screen, so it exercises the
     * activation hooks in the **opposite** direction from the table: the table stops
     * working while hidden and re-derives on return, this one cannot (an event is gone
     * once it has fired) so it keeps recording and only stops painting.
     */
    loadWithPluginPane(name: FixtureName, overrides?: PlainObject): Promise<void>
    /** Labels the plugin pane has recorded, in arrival order — painted or not. */
    pluginPaneRecorded(): string[]
    /** The dock's registered tab ids, in strip order. */
    dockTabIds(): string[]
    /** The tab the dock is currently showing. */
    activeDockTabId(): string | null
    /**
     * Register a bare dock tab through the public API, the way a consumer would.
     * Returns its id; `removeTestDockTab` disposes it.
     */
    addTestDockTab(id: string, label: string, order?: number): string
    removeTestDockTab(id: string): void
    /** Text content of the body the dock is currently showing. */
    activeDockBodyText(): string
    /** Rebuild a registered tab's body through the public API. */
    refreshDockTab(id: string): void
    /**
     * Resize the graph's own container, the way an embedding page would — for the
     * minimap's `collapsed: 'auto'`, which follows the room the canvas has.
     */
    setContainerSize(width: number, height: number): void
    /** Whether the minimap is currently folded away to its toggle. */
    minimapCollapsed(): boolean | null
    /** The region the minimap reports as visible (what its rectangle draws), in graph coords. */
    minimapViewport(): GraphBounds | null
    /** How many times the minimap has rasterised its content bitmap. */
    minimapRebuilds(): number
    /** Centre of the main view in graph coordinates — moves when the minimap drives it. */
    viewCenter(): { x: number, y: number } | null
    /**
     * Boot a graph of `count` pinned, edge-less nodes with the minimap installed — for
     * crossing its detail threshold. Adding them to an existing graph would cost one
     * full render each, so this builds the graph in one pass instead.
     */
    loadManyNodesWithMinimap(count: number, options?: MinimapOptions): Promise<void>
    /**
     * Boot a graph of `count` pinned, edge-less nodes with arbitrary overrides — for
     * crossing the data dock's row-windowing threshold. Each node carries a numeric
     * `seq` so a sort has unique keys and the order is deterministic.
     */
    loadManyNodes(count: number, overrides?: PlainObject): Promise<void>
    /**
     * Ids of the nodes currently visible. A filtered-out node is *removed* from the
     * render, so this is the exact answer to "what did that filter leave on screen".
     */
    visibleNodeIds(): string[]
    /** What the filter pill reports as hidden (`queryEngine.getHiddenNodeCount`). */
    hiddenNodeCount(): number
    /** How many nodes are hidden for having no visible relation — what the switch reports. */
    disconnectedNodeCount(): number
    /** Whether the unconnected-nodes rule is on (`queryEngine.isHideDisconnected`). */
    hideDisconnectedOn(): boolean
    /** Re-derive visibility from the current filters (`queryEngine.reapply`). */
    reapplyFilters(): void
    /**
     * Load a fixture whose relations come in kinds — `render.edgeTypeAccessor` plus
     * `edgeStyleMap`, and whichever of the edge facet / `scope: 'edge'` legend section
     * the test is about. Built from {@link EdgeLayerSpec}, page-side, because the real
     * options carry functions.
     */
    loadWithEdgeLayers(name: FixtureName, spec?: EdgeLayerSpec, overrides?: PlainObject): Promise<void>
    /**
     * Load a fixture declaring some combination of the `render.default*Style.styleCb`
     * callbacks (and optionally `edgeStyleMap` / a per-edge `styleCb` beside them), so a
     * test can pin down where each sits in the precedence chain. Built from
     * {@link StyleCbSpec} because callbacks cannot cross `page.evaluate`.
     */
    loadWithStyleCallbacks(name: FixtureName, spec?: StyleCbSpec, overrides?: PlainObject): Promise<void>
    /** The colour a `render.default*Style.styleCb` paints in that loader. */
    defaultCallbackColor(): string
    /** The stroke width a default edge `styleCb` sets in that loader. */
    defaultCallbackWidth(): number
    /** The stroke width the renderer resolved for an edge. */
    edgeStrokeWidth(id: string): number | null
    /** The inline `fill` of every rendered edge label. */
    edgeLabelFills(): string[]
    /** Ids of the edges currently drawn — a layer-hidden edge leaves the render. */
    visibleEdgeIds(): string[]
    /**
     * Ids of the edges the **link force** holds. A layer-hidden edge must still be in
     * here: that is what keeps the layout from drifting when a layer goes off.
     */
    simulationEdgeIds(): string[]
    /** What the filter pill reports as hidden by an edge layer. */
    hiddenEdgeCount(): number
    /** Set an edge filter through the public API (`queryEngine.setEdgeFilter`). */
    setEdgeFilter(key: string, value: FilterFieldConfig): void
    removeEdgeFilter(key: string): void
    /** The filter panel's Relationships rows, in display order. */
    edgeLayerRows(): EdgeLayerRow[]
    /** The stroke the renderer resolves for an edge — what a line swatch must report. */
    edgeStyleOf(id: string): EdgeSwatchSnapshot | null
    /** What the `index`-th rendered line swatch inside `container` actually draws. */
    edgeSwatchOf(container: string, index: number): EdgeSwatchSnapshot | null
    /** A CSS colour as the browser normalises it — what a swatch's stroke reads back as. */
    cssColor(value: string): string
    /**
     * The filter panel's generated fields, in display order — `key`, the rendered
     * label, and the widget type. Reads the live DOM, so it proves what the panel
     * actually built (declared vs auto-derived).
     */
    filterFields(): Array<{ key: string; label: string; type: string }>
    /** Visible node ids inside an expanded cluster's subgraph (facet propagation). */
    subgraphVisibleNodeIds(clusterId: string): string[]
    /**
     * Set a filter-panel control's raw value — the `<select>`/`<input>` the picker
     * widget drives — so a test can exercise the real read-back path without
     * fighting the custom picker UI.
     */
    setPanelValue(key: string, value: string): void
    /** The panel form read through `FormFactory` — exactly what "Filter Graph" applies. */
    panelValues(): Record<string, unknown>
    /** Clear every active query filter, restoring the full graph. */
    resetFilters(): void
    /** Manually hide a single node by id (`queryEngine.excludeNode`). */
    excludeNode(id: string): void
    /** Hide a node and its incident edges directly (`graph.hideNode`). */
    hideNode(id: string): void
    /** Re-show a previously hidden node (`graph.showNode`). */
    showNode(id: string): void
    /**
     * Open the Graph-Filters slide panel programmatically (same panel as the
     * `Shift+K` shortcut / filter button). The panel's form is generated from the
     * loaded graph's node-data fields. Returns once the panel has the `open` class.
     */
    openFilterPanel(): void
    /**
     * Turn on lasso-selection mode so a left-drag on the canvas draws a polygon
     * (`.pvt-lasso-overlay > polyline`) instead of panning. In the real app the
     * toolbar both enables the overlay *and* cancels canvas panning while it's
     * active; the harness doesn't mount the toolbar, so this does both.
     */
    enableLasso(): void
    /**
     * Install `onBeforeEdgeCreate` / `isValidConnection` callbacks by name (real
     * functions can't cross `page.evaluate`, so tests pass a serialisable config)
     * and start recording `edgeAdd` events + hook invocations. Call after `load`.
     */
    configureConnect(config?: ConnectConfig): void
    /**
     * Set (or clear with `null`) the static `editors.edgeEditor.labelPrompt` option
     * on the live graph — the hook-less path that auto-prompts for a label on every
     * interactive edge create. Read fresh at connect time, so it can be flipped here.
     */
    setEdgeLabelPrompt(mode: 'inline' | 'modal' | null): void
    /** Edges that entered the model since {@link configureConnect} (for veto / accept-with-data assertions). */
    edgeEvents(): RecordedEdge[]
    /** How many times each connect callback was invoked (proves the pending lock blocks re-entry). */
    hookCalls(): { edge: number; validConnection: number }
    /** The `{ origin, kind }` of every `onBeforeEdgeCreate` context seen (verifies note-link vs edge). */
    hookContexts(): Array<{ origin: string; kind: string }>
    /**
     * Drive a note→node link through the connect session (note-link mode, note as
     * source, node as target) so `onBeforeEdgeCreate` fires with kind `'note-link'`.
     */
    linkNote(noteId: string, nodeId: string): void
    /** The element a note is attached to, or null — for asserting a note-link was (not) made. */
    noteAttachment(noteId: string): { type: string; id: string } | null

    /* ---------- sidebar extra panels ---------- */

    /**
     * Load a fixture with sidebar panels built from {@link PanelSpec}s — declared
     * in `UI.extraPanels`, or (with `register: 'early'`) registered on the fresh
     * graph before `graphReady`.
     */
    loadWithPanels(name: FixtureName, panels: PanelSpec[], overrides?: PlainObject): Promise<void>
    /** Register a panel at runtime via `UIManager.addPanel`; returns its id. */
    addPanel(spec: PanelSpec): string
    /** Register a panel through a plugin's `install` (`ctx.addPanel`); returns its id. */
    addPanelViaPlugin(spec: PanelSpec): string
    /** Call the disposer `addPanel` returned. Safe to call twice (the no-op case). */
    disposePanel(id: string): void
    /** Remove a panel by id (`UIManager.removePanel`). */
    removePanel(id: string): void
    /** Force a re-render of one panel, or all of them (`UIManager.refreshPanel`). */
    refreshPanel(id?: string): void
    /** Registered panel ids, in display order (`UIManager.getPanels`). */
    panelIds(): string[]
    /** How many times a panel's `render` ran — proves reactive vs pinned. */
    panelRenderCount(id: string): number
    /**
     * Tear the UI down, then try to register a panel: the "refused during
     * teardown" case. Reports the panel count before, whether the late panel
     * entered the registry, and how much panel DOM survives.
     */
    probePanelAfterTeardown(spec: PanelSpec): { panelsBefore: number; registered: boolean; domPanelsAfter: number }

    /* ---------- async content hooks ---------- */

    /** Load a fixture with the content hooks {@link AsyncContentSpec} describes. */
    loadAsyncContent(name: FixtureName, spec: AsyncContentSpec, overrides?: PlainObject): Promise<void>
    /** Keys of the renders currently held open, in the order they were requested. */
    pendingAsync(): string[]
    /** Settle a held render with content. Unknown keys are a no-op. */
    settleAsync(key: string, text?: string): void
    /** Reject a held render, exercising the error affordance. */
    failAsync(key: string, message?: string): void
    /** Did the library abort the signal it handed this render? */
    asyncAborted(key: string): boolean
    /** Does the library consider this render superseded? */
    asyncStale(key: string): boolean
    /** How many times a hook has been invoked — the sync path must not add calls. */
    asyncCallCount(hook: AsyncHook): number
    /** Tear the graph down, for the "in-flight work is abandoned" case. */
    destroyGraph(): void

    /* ---------- write-path lifecycle hooks ---------- */

    /**
     * Install `onBeforeDelete` / `onBeforeNodeCreate` / `onBeforeEdgeEditCommit` by
     * name (real functions can't cross `page.evaluate`) and start recording what the
     * hooks saw plus every removal / edge change that reached the data bus. Call after
     * `load`.
     */
    configureWritePath(config?: WritePathConfig): void
    /** How many times each write-path hook was invoked (proves the pending lock, and the no-hook path). */
    writePathCalls(): WritePathCalls
    /** The ids every `DeleteContext` carried — including the library-resolved cascade. */
    deleteContexts(): RecordedDeleteContext[]
    /** Ids that actually left the model, from `nodeRemove` / `edgeRemove` / `noteRemove`. */
    removedIds(): { nodes: string[]; edges: string[]; notes: string[] }
    /** `nodeChange` events seen since {@link configureWritePath}. */
    nodeChanges(): RecordedDataChange[]
    /** `edgeChange` events seen since {@link configureWritePath}. */
    edgeChanges(): RecordedDataChange[]
    /** An edge label's text and the viewport point it is drawn at (null when unlabelled). */
    edgeLabel(id: string): { text: string; x: number; y: number } | null
    /** Drive a user-initiated delete through `graph.editing.requestDelete`, by id. */
    requestDelete(spec: DeleteRequestSpec): Promise<RecordedDeleteOutcome>
    /** Two delete requests in one page task — the second lands while the first decides. */
    raceDeleteRequests(first: DeleteRequestSpec, second: DeleteRequestSpec): Promise<RecordedDeleteOutcome[]>
    /** A viewport point that lies on an edge's rendered path, for real pointer events. */
    edgePoint(id: string): { x: number; y: number } | null
    /** Remove a node the *programmatic* way (`graph.removeNode`) — must bypass the hook. */
    graphRemoveNode(id: string): void
    /** Remove an edge the *programmatic* way (`graph.removeEdge`) — must bypass the hook. */
    graphRemoveEdge(id: string): void
    /** Open an edge edit session (`graph.editing.openEdgeSession`), as the edge menu does. */
    openEdgeSession(id: string): void
    /** An edge's current data — for asserting a commit landed (or a veto left it alone). */
    edgeData(id: string): Record<string, unknown> | null
    /** A node's current data — for asserting what a create hook stamped on it. */
    nodeData(id: string): Record<string, unknown> | null
    /** Ids of the notes still in the model. */
    noteIds(): string[]
}

class Harness implements HarnessApi {
    public graph?: Pivotick
    private readonly container: HTMLElement
    /** Fixture-declared positions, captured before the graph mutates the nodes. */
    private intended = new Map<string, { x: number; y: number }>()
    /** Connect-callback observation state (reset by {@link configureConnect}). */
    private recordedEdges: RecordedEdge[] = []
    private edgeAddHooked = false
    private edgeHookCalls = 0
    private validConnCalls = 0
    private seenHookContexts: Array<{ origin: string; kind: string }> = []
    /** Extra-panel observation state: render counts and the disposers `addPanel` returned. */
    private panelRenders = new Map<string, number>()
    private panelDisposers = new Map<string, () => void>()
    private panelSeq = 0
    /** Write-path observation state (reset by {@link configureWritePath}). */
    private writePathHookCalls = { delete: 0, nodeCreate: 0, edgeEditCommit: 0, edgeEditBody: 0, edgeEditCancel: 0, nodeEditCommit: 0 }
    private seenDeleteContexts: RecordedDeleteContext[] = []
    private removed: { nodes: string[]; edges: string[]; notes: string[] } = { nodes: [], edges: [], notes: [] }
    private recordedNodeChanges: RecordedDataChange[] = []
    private recordedEdgeChanges: RecordedDataChange[] = []
    private writePathHooked = false
    /** Async-content observation state: renders held open, and per-hook call counts. */
    private asyncSpec: AsyncContentSpec = {}
    private heldRenders = new Map<string, HeldRender>()
    private asyncCalls = new Map<AsyncHook, number>()

    /** Legend observation state, reset per boot. */
    private legendToggles: LegendToggleState[] = []
    private recordedWarnings: string[] = []
    /** Disposers from `addTestDockTab`, so a test can unregister the way a consumer does. */
    private dockTabDisposers = new Map<string, () => void>()
    /** What `loadWithPluginPane`'s pane has recorded, painted or not. */
    private pluginPaneEntries: string[] = []

    constructor(container: HTMLElement) {
        this.container = container

        // Several behaviours are only observable as a dev-time warning (a legend
        // category rendering two colours, nodes with no value for its key, …), so
        // they're recorded rather than merely printed.
        const original = console.warn.bind(console)
        console.warn = (...args: unknown[]): void => {
            this.recordedWarnings.push(args.map((arg) => typeof arg === 'string' ? arg : String(arg)).join(' '))
            original(...args)
        }
    }

    private get g(): Pivotick {
        if (!this.graph) throw new Error('No graph loaded — call load() first')
        return this.graph
    }

    private destroy(): void {
        try {
            this.graph?.destroy()
        } catch {
            /* ignore teardown errors */
        }
        this.container.innerHTML = ''
        this.graph = undefined
    }

    /** Resolves when the graph emits `ready` (layout done, zoom layer revealed). */
    private whenReady(graph: Pivotick): Promise<void> {
        return new Promise<void>((resolve) => {
            let settled = false
            const finish = () => {
                if (settled) return
                settled = true
                resolve()
            }
            graph.on('ready', finish)
        })
    }

    async load(name: FixtureName, overrides: PlainObject = {}): Promise<void> {
        return this.boot(name, overrides)
    }

    /**
     * Build a fixture graph. `beforeReady` runs on the constructed graph *before*
     * `graphReady` fires — the window where a plugin or an early `addPanel` lands.
     */
    private async boot(
        name: FixtureName,
        overrides: PlainObject = {},
        beforeReady?: (graph: Pivotick) => void
    ): Promise<void> {
        return this.bootData(fixtures[name](), mergeOptions(BASE_OPTIONS, overrides), beforeReady)
    }

    /**
     * {@link boot}, for fixtures built from a spec rather than looked up by name.
     * `options` is taken as final — callers do their own {@link BASE_OPTIONS} merge,
     * so one of them can drop a pinned key instead of only overriding it.
     */
    private async bootData(
        data: BuiltFixture,
        options: PlainObject = {},
        beforeReady?: (graph: Pivotick) => void
    ): Promise<void> {
        this.destroy()
        // Snapshot the fixture's positions now — the graph mutates these Node
        // instances during its initial layout pass (see `pin()`).
        this.intended = new Map(
            data.nodes
                .filter((n) => typeof n.x === 'number' && typeof n.y === 'number')
                .map((n) => [n.id, { x: n.x as number, y: n.y as number }])
        )
        this.legendToggles = []
        this.recordedWarnings = []
        // The previous graph's UI is gone, so its disposers refer to nothing.
        this.dockTabDisposers.clear()
        // `data.notes` carries raw note options; the graph normalises them to Notes.
        const graph = new Pivotick(this.container, data as never, options as never)
        this.graph = graph
        graph.on('legendToggle', (state) => this.legendToggles.push(state))
        beforeReady?.(graph)
        await this.whenReady(graph)
        // Wait for web fonts so text metrics (and thus layout/labels) are stable.
        if (document.fonts?.ready) await document.fonts.ready
    }

    async loadCustomNodes(overrides: PlainObject = {}): Promise<void> {
        this.destroy()
        // Fixed-size card so the measured size (and thus the radius) is
        // deterministic and font-independent: box-sizing:border-box pins the
        // outer box to exactly CARD_W×CARD_H, inline-flex shrink-wraps to it.
        const CARD_W = 140
        const CARD_H = 44
        const renderNode = (node: Node): HTMLElement => {
            const el = document.createElement('div')
            el.style.cssText = `display:inline-flex;box-sizing:border-box;width:${CARD_W}px;height:${CARD_H}px;border:1px solid #334155;background:#fff`
            el.textContent = String(node.getData().label ?? node.id)
            return el
        }
        // Five cards seeded tightly around the origin (all inside one card's
        // radius) with no edges, so only collision — driven by the measured card
        // size — can spread them apart.
        const seeds: Array<[number, number]> = [[0, 0], [10, 6], [-8, 9], [6, -10], [-12, -4]]
        const nodes = seeds.map(([x, y], i) => {
            const n = new Node(`card-${i}`, { label: `Card ${i}` }, {}, `card-${i}`)
            n.x = x
            n.y = y
            return n
        })
        const options = mergeOptions(BASE_OPTIONS, mergeOptions(overrides, { render: { renderNode } }))
        const graph = new Pivotick(this.container, { nodes, edges: [] } as never, options as never)
        this.graph = graph
        await this.whenReady(graph)
        if (document.fonts?.ready) await document.fonts.ready
    }

    /** Subjects of the anchoring matrix and the shape each one renders as. */
    private static readonly ANCHOR_SUBJECTS: Array<{ subject: AnchorSubject; style: Record<string, unknown> }> = [
        { subject: 'circle', style: { shape: 'circle', size: 20 } },
        { subject: 'square', style: { shape: 'square', size: 20 } },
        { subject: 'triangle', style: { shape: 'triangle', size: 20 } },
        { subject: 'hexagon', style: { shape: 'hexagon', size: 20 } },
        // A wide centred path: the classic "my node is not a circle" case.
        { subject: 'customPath', style: { shape: { d: 'M-60,-15 L60,-15 L60,15 L-60,15 Z' }, size: 20 } },
        // 4:1 picture, so the frame ends up markedly wider than it is tall.
        {
            subject: 'frameImage',
            style: {
                shape: 'circle', size: 30, imageFit: 'frame',
                imagePath: 'data:image/svg+xml;utf8,' + encodeURIComponent(
                    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="100"><rect width="400" height="100" fill="#c33"/></svg>'
                ),
            },
        },
        // HTML-in-SVG, the way integrations usually style a node. The card reaches
        // past the shape behind it, so the card is the border.
        { subject: 'htmlCard', style: { shape: 'square', size: 20, html: () => Harness.anchorCard(180, 60) } },
        // ...and the same thing with the shape larger than the card, which must keep
        // its circle rather than shrink onto a card sitting inside it.
        { subject: 'htmlSmallCard', style: { shape: 'circle', size: 60, html: () => Harness.anchorCard(100, 40) } },
    ]

    /** A fixed-size card: `box-sizing` pins the outer box so the measure is font-independent. */
    private static anchorCard(width: number, height: number): HTMLElement {
        const el = document.createElement('div')
        el.style.cssText = `display:inline-flex;box-sizing:border-box;width:${width}px;height:${height}px;border:1px solid #334155;background:#eef`
        return el
    }

    async loadAnchorMatrix(mode: 'shapes' | 'renderNode'): Promise<void> {
        this.destroy()
        const subjects = mode === 'renderNode'
            ? [{ subject: 'renderNodeCard' as AnchorSubject, style: {} }]
            : Harness.ANCHOR_SUBJECTS

        const nodes: Node[] = []
        const edges: Edge[] = []
        // Pinned (fx/fy) and spaced far apart, so the initial fit cannot move a
        // subject and no two subjects' probes interact.
        const pin = (id: string, style: Record<string, unknown>, x: number, y: number): Node => {
            const node = new Node(id, { label: '' }, style as never, id)
            node.x = x; node.y = y; node.fx = x; node.fy = y
            return node
        }
        subjects.forEach(({ subject, style }, index) => {
            const cx = 600, cy = 400 + index * 1200
            const node = pin(subject, style, cx, cy)
            // Probe targets are tiny circles, so their own anchoring is negligible.
            const east = pin(`${subject}-east`, { shape: 'circle', size: 2 }, cx + 400, cy)
            const diag = pin(`${subject}-diag`, { shape: 'circle', size: 2 }, cx + 400, cy - 400)
            const pair = pin(`${subject}-pair`, { shape: 'circle', size: 2 }, cx + 300, cy + 300)
            nodes.push(node, east, diag, pair)
            // No edge leaves `east`/`diag`, so the router keeps these straight.
            edges.push(new EdgeInstance(`${subject}|east`, node, east, {}))
            edges.push(new EdgeInstance(`${subject}|diag`, node, diag, {}))
            // A reciprocal pair: the router flips both of these to curved.
            edges.push(new EdgeInstance(`${subject}|curvedOut`, node, pair, {}))
            edges.push(new EdgeInstance(`${subject}|curvedIn`, pair, node, {}))
            edges.push(new EdgeInstance(`${subject}|loop`, node, node, {}))
        })

        const overrides: PlainObject = mode === 'renderNode'
            ? { render: { renderNode: () => Harness.anchorCard(180, 60) } }
            : {}
        const graph = new Pivotick(this.container, { nodes, edges } as never, mergeOptions(BASE_OPTIONS, overrides) as never)
        this.graph = graph
        await this.whenReady(graph)
        if (document.fonts?.ready) await document.fonts.ready
        // Cards and framed images are measured asynchronously, and only then does
        // the node learn its real border - wait for every subject to have settled
        // rather than trusting a fixed delay.
        await this.whenAnchorGeometrySettled(subjects.map((s) => s.subject))
        this.graph.renderer.nextTick()
    }

    /**
     * Resolve once every subject's measured geometry has stopped changing, so a
     * probe cannot read a card mid-measure. Falls through after a bounded wait -
     * a subject that legitimately never measures must not hang the suite.
     */
    private async whenAnchorGeometrySettled(subjects: string[]): Promise<void> {
        const signature = (): string => subjects
            .map((id) => {
                const node = this.graph?.getMutableNode(id)
                if (!node) return '-'
                const border = node.getBorderBox()
                return `${node.getCircleRadius()}:${border ? `${border.halfWidth}x${border.halfHeight}` : 'circle'}`
            })
            .join('|')

        let previous = signature()
        let stableFrames = 0
        for (let frame = 0; frame < 240 && stableFrames < 6; frame++) {
            await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
            const current = signature()
            stableFrames = current === previous ? stableFrames + 1 : 0
            previous = current
        }
    }

    probeAnchors(): AnchorProbe[] {
        const graph = this.graph
        if (!graph) return []

        const boxesOf = (node: Node): Pick<AnchorProbe, 'shapeBox' | 'cardBox'> => {
            const element = document.getElementById(`node-${node.domID}`)
            const shape = element?.querySelector('.node') as SVGGraphicsElement | null
            const shapeBbox = shape?.getBBox()
            const card = element?.querySelector('foreignObject') as SVGForeignObjectElement | null
            return {
                shapeBox: shapeBbox && shapeBbox.width > 0
                    ? { width: shapeBbox.width, height: shapeBbox.height }
                    : null,
                cardBox: card
                    ? { width: Number(card.getAttribute('width')), height: Number(card.getAttribute('height')) }
                    : null,
            }
        }

        /** Every coordinate pair in a path: the first is where it starts, the last where it ends. */
        const endpointsOf = (d: string): { start: { x: number; y: number }; end: { x: number; y: number } } | null => {
            const numbers = (d.match(/-?\d+(?:\.\d+)?(?:e-?\d+)?/g) ?? []).map(Number)
            if (numbers.length < 4) return null
            return {
                start: { x: numbers[0], y: numbers[1] },
                end: { x: numbers[numbers.length - 2], y: numbers[numbers.length - 1] },
            }
        }

        const subjectIds = new Set(Harness.ANCHOR_SUBJECTS.map((s) => s.subject as string).concat('renderNodeCard'))
        const probes: AnchorProbe[] = []
        const renderer = graph.renderer as unknown as {
            edgeSelection?: { each(fn: (this: SVGGElement, edge: Edge) => void): void }
        }
        renderer.edgeSelection?.each(function (this: SVGGElement, edge: Edge) {
            const d = this.querySelector('path')?.getAttribute('d')
            if (!d) return
            const endpoints = endpointsOf(d)
            if (!endpoints) return

            const isSelfLoop = edge.from === edge.to
            const kind: AnchorProbe['kind'] = isSelfLoop
                ? 'selfLoop'
                : edge.getStyle()?.edge?.curveStyle === 'curved' ? 'curved' : 'straight'

            for (const end of ['from', 'to'] as const) {
                const node = end === 'from' ? edge.from : edge.to
                if (!subjectIds.has(node.id)) continue
                const otherNode = end === 'from' ? edge.to : edge.from
                const border = node.getBorderBox()
                probes.push({
                    edgeId: edge.id,
                    subject: node.id as AnchorSubject,
                    end,
                    kind,
                    anchor: end === 'from' ? endpoints.start : endpoints.end,
                    center: { x: node.x ?? 0, y: node.y ?? 0 },
                    other: { x: otherNode.x ?? 0, y: otherNode.y ?? 0 },
                    circleRadius: node.getCircleRadius(),
                    borderBox: border ? { halfWidth: border.halfWidth, halfHeight: border.halfHeight } : null,
                    ...boxesOf(node),
                })
            }
        })
        return probes
    }

    probeNoteConnector(noteId: string): { anchor: { x: number; y: number }; center: { x: number; y: number } } | null {
        const renderer = this.graph?.renderer as unknown as {
            noteEdgeSelection?: { each(fn: (this: SVGPathElement, datum: { note: Note; target: Node }) => void): void }
        } | undefined
        let found: { anchor: { x: number; y: number }; center: { x: number; y: number } } | null = null
        renderer?.noteEdgeSelection?.each(function (this: SVGPathElement, datum) {
            if (datum.note.id !== noteId) return
            const numbers = (this.getAttribute('d')?.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number)
            if (numbers.length < 4) return
            // The connector runs note → node, so its *end* is the node's rim.
            found = {
                anchor: { x: numbers[numbers.length - 2], y: numbers[numbers.length - 1] },
                center: { x: datum.target.x ?? 0, y: datum.target.y ?? 0 },
            }
        })
        return found
    }

    async addCardWhileZoomed(id: string, scale: number): Promise<{ cardBox: { width: number; height: number } | null; zoom: number }> {
        const renderer = this.g.renderer as unknown as {
            getZoomBehavior: () => { scaleTo: (selection: unknown, k: number) => void }
            getCanvasSelection: () => unknown
            getZoomTransform: () => { k: number }
        }
        renderer.getZoomBehavior().scaleTo(renderer.getCanvasSelection(), scale)
        await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))

        this.addNode(id, 600, 400)
        await this.whenAnchorGeometrySettled([id])

        const node = this.g.getMutableNode(id)
        const card = node
            ? document.getElementById(`node-${node.domID}`)?.querySelector('foreignObject')
            : null
        return {
            cardBox: card
                ? { width: Number(card.getAttribute('width')), height: Number(card.getAttribute('height')) }
                : null,
            zoom: renderer.getZoomTransform().k,
        }
    }

    countStyleResolvesPerTick(ticks: number): number {
        const graph = this.graph
        if (!graph) return -1
        const nodeDrawer = (graph.renderer as unknown as {
            nodeDrawer: { getNodeStyle: (node: Node) => unknown }
        }).nodeDrawer
        const original = nodeDrawer.getNodeStyle.bind(nodeDrawer)
        let calls = 0
        nodeDrawer.getNodeStyle = (node: Node): unknown => {
            calls += 1
            return original(node)
        }
        try {
            for (let i = 0; i < ticks; i++) graph.renderer.nextTick()
        } finally {
            nodeDrawer.getNodeStyle = original
        }
        return calls / ticks
    }

    probeUnrenderedVisibility(): { nodeSelectionUnset: boolean; remeasureThrew: boolean } {
        this.destroy()
        // No data → the Graph constructor skips renderer.init(), so nodeSelection
        // is never assigned; the visibility observer is nonetheless already live.
        const graph = new Pivotick(this.container, undefined as never, mergeOptions(BASE_OPTIONS, {}) as never)
        this.graph = graph
        // Reach the renderer internals the observer callback touches. These are
        // `private`, but that's compile-time only — at runtime this is exactly the
        // code the IntersectionObserver would run when the canvas becomes visible.
        const renderer = graph.renderer as unknown as {
            nodeSelection: unknown
            remeasureVisibleNodes: () => void
        }
        const nodeSelectionUnset = renderer.nodeSelection === undefined
        let remeasureThrew = false
        try {
            renderer.remeasureVisibleNodes()
        } catch {
            remeasureThrew = true
        }
        return { nodeSelectionUnset, remeasureThrew }
    }

    selectNode(id: string): void {
        const node = this.g.getMutableNode(id)
        if (node) this.g.selectElement(node)
    }

    selectEdge(id: string): void {
        const edge = this.g.getMutableEdge(id)
        if (edge) this.g.selectElement(edge)
    }

    multiSelect(ids: string[]): void {
        const selection = ids
            .map((id) => this.g.getMutableNode(id))
            .filter((node): node is Node => Boolean(node))
            .map((node) => ({ node, element: node.getGraphElement() }))
            .filter((sel) => Boolean(sel.element))
        this.g.renderer.getGraphInteraction().selectNodes(selection as never)
    }

    selectedNodeIds(): string[] {
        return this.g.renderer.getGraphInteraction().getSelectedNodeIDs() ?? []
    }

    private badgeClicks: string[] = []

    async loadBadges(spec: BadgeHarnessSpec = {}, overrides: PlainObject = {}): Promise<void> {
        this.badgeClicks = []

        // Turn each node's plain `data.badges` descriptors into real badges. Done here and
        // not in the fixture because `onClick` is a function: it cannot cross page.evaluate.
        const badges = (node: Node): NodeBadge[] => {
            const declared = node.getData().badges
            if (!Array.isArray(declared)) return []
            return declared.map((entry) => {
                const descriptor = entry as PlainObject
                const badge: NodeBadge = {
                    text: descriptor.text as string,
                    title: descriptor.title as string,
                    position: descriptor.position as NodeBadge['position'],
                    color: descriptor.color as string | undefined,
                }
                if (descriptor.click) {
                    badge.onClick = () => this.badgeClicks.push(`badge:${badge.text}`)
                }
                return badge
            })
        }

        const options: PlainObject = { render: { defaultNodeStyle: { badges } } }
        if (spec.globalHandler) {
            options.callbacks = {
                onBadgeClick: (_event: PointerEvent, _node: Node, badge: NodeBadge) => {
                    this.badgeClicks.push(`global:${badge.text}`)
                },
            }
        }

        if (spec.customNodes) {
            await this.loadBadgedCustomNodes(options, overrides)
            return
        }

        if (spec.precedence) {
            // Every level declares badges, so which one is drawn says how they combine.
            const render = options.render as PlainObject
            delete (render.defaultNodeStyle as PlainObject).badges
            render.nodeTypeAccessor = () => 'plain'
            render.nodeStyleMap = { plain: { badges: [{ text: 'MAP', title: 'From the style map' }] } }
            await this.load('badges', mergeOptions(options, overrides))
            // Merged, not replaced, so each node keeps the shape and size the fixture gave it.
            this.g.getMutableNode('circle')?.updateStyle({ badges: [{ text: 'OWN', title: 'Declared on the node' }] })
            this.g.getMutableNode('square')?.updateStyle({ badges: [] })
            this.g.renderer.update(false)
            return
        }

        await this.load('badges', mergeOptions(options, overrides))

        this.g.renderer.getGraphInteraction().on('badgeClick', ((
            _event: PointerEvent,
            _node: Node,
            badge: NodeBadge,
            _element: unknown,
            context: { cancel(): void }
        ) => {
            this.badgeClicks.push(`bus:${badge.text}`)
            if (spec.cancelBus) context.cancel()
        }) as never)
    }

    /**
     * Two `renderNode` cards wearing badges. The default node render never runs here, so
     * there is no `.node` shape at all — the badge rim has to come off the measured card.
     */
    private async loadBadgedCustomNodes(options: PlainObject, overrides: PlainObject): Promise<void> {
        const CARD_W = 140
        const CARD_H = 44
        const renderNode = (node: Node): HTMLElement => {
            const el = document.createElement('div')
            el.style.cssText = `display:inline-flex;box-sizing:border-box;width:${CARD_W}px;height:${CARD_H}px;border:1px solid #334155;background:#fff`
            el.textContent = String(node.getData().label ?? node.id)
            return el
        }
        const nodes = [-200, 200].map((x, i) => {
            const node = new Node(`card-${i}`, {
                label: `Card ${i}`,
                badges: [{ text: String(i + 1), title: `Card ${i} badge` }],
            }, {}, `card-${i}`)
            node.x = x
            node.y = 0
            node.fx = x
            node.fy = 0
            return node
        })
        const render = mergeOptions(options.render as PlainObject, { renderNode })
        const merged = mergeOptions(BASE_OPTIONS, mergeOptions(overrides, { ...options, render }))
        this.destroy()
        const graph = new Pivotick(this.container, { nodes, edges: [] } as never, merged as never)
        this.graph = graph
        await this.whenReady(graph)
        if (document.fonts?.ready) await document.fonts.ready
    }

    nodeBadges(id: string): NodeBadgeSnapshot[] {
        const group = document.getElementById(`node-${id}`)
        if (!group) return []
        const badges = group.querySelectorAll<SVGGElement>(':scope > .pvt-node-badges > .pvt-node-badge')
        return Array.from(badges).map((badge) => {
            const shape = badge.querySelector<SVGRectElement>('.pvt-node-badge-shape')
            const translate = /translate\(([-\d.]+),\s*([-\d.]+)\)/.exec(badge.getAttribute('transform') ?? '')
            return {
                position: badge.getAttribute('data-pvt-badge-position') ?? '',
                cx: translate ? Number(translate[1]) : NaN,
                cy: translate ? Number(translate[2]) : NaN,
                width: Number(shape?.getAttribute('width') ?? 0),
                height: Number(shape?.getAttribute('height') ?? 0),
                radius: Number(shape?.getAttribute('rx') ?? 0),
                text: badge.querySelector('.pvt-node-badge-text')?.textContent ?? '',
                fill: shape ? getComputedStyle(shape).fill : '',
                title: badge.querySelector('title')?.textContent ?? null,
                interactive: badge.classList.contains('pvt-node-badge-interactive'),
                overflow: badge.classList.contains('pvt-node-badge-overflow'),
            }
        })
    }

    nodeRimBox(id: string): NodeRimBox | null {
        const group = document.getElementById(`node-${id}`)
        if (!group) return null

        const shape = group.querySelector(':scope > .node')
        if (shape) {
            const tag = shape.tagName.toLowerCase()
            if (tag === 'rect') {
                return {
                    hx: Number(shape.getAttribute('width')) / 2,
                    hy: Number(shape.getAttribute('height')) / 2,
                    round: false,
                }
            }
            if (tag === 'circle') {
                const r = Number(shape.getAttribute('r'))
                return { hx: r, hy: r, round: true }
            }
        }
        const card = group.querySelector(':scope > foreignObject')
        if (card) {
            return {
                hx: Number(card.getAttribute('width')) / 2,
                hy: Number(card.getAttribute('height')) / 2,
                round: false,
            }
        }
        // A path shape carries no honest box; the node's radius is what it was drawn against.
        const radius = this.g.getMutableNode(id)?.getCircleRadius() ?? 0
        return { hx: radius, hy: radius, round: true }
    }

    /**
     * The shift applied to the whole badge group — zero until a cluster expands and the node
     * slides to the bubble's NW rim, taking its badges with it.
     */
    badgeGroupOffset(id: string): { x: number; y: number } | null {
        const group = document.getElementById(`node-${id}`)?.querySelector(':scope > .pvt-node-badges')
        if (!group) return null
        const translate = /translate\(([-\d.]+),\s*([-\d.]+)\)/.exec(group.getAttribute('transform') ?? '')
        return translate ? { x: Number(translate[1]), y: Number(translate[2]) } : { x: 0, y: 0 }
    }

    nodeIconAnchor(id: string): { x: number; y: number } | null {
        const icon = document.getElementById(`node-${id}`)?.querySelector(':scope > .node-icon')
        const translate = /translate\(([-\d.]+),\s*([-\d.]+)\)/.exec(icon?.getAttribute('transform') ?? '')
        return translate ? { x: Number(translate[1]), y: Number(translate[2]) } : null
    }

    badgeClickLog(): string[] {
        return [...this.badgeClicks]
    }

    clearBadgeClickLog(): void {
        this.badgeClicks = []
    }

    deselectAll(): void {
        this.g.deselectAll()
    }

    addNode(id: string, x: number, y: number, label?: string, data: PlainObject = {}): void {
        const node = new Node(id, { label: label ?? id.toUpperCase(), ...data }, {}, id)
        node.x = x
        node.y = y
        node.fx = x
        node.fy = y
        this.g.addNode(node)
    }

    connect(fromId: string, toId: string): void {
        const from = this.g.getMutableNode(fromId)
        const to = this.g.getMutableNode(toId)
        if (from && to) this.g.editing.connectManager.createEdge(from, to)
    }

    startClickConnect(): void {
        this.g.editing.connectManager.startClickConnection()
    }

    pickConnectNode(id: string): void {
        const node = this.g.getMutableNode(id)
        if (node) this.g.editing.connectManager.selectOrConnectNode(node)
    }

    startEdgeConnect(): void {
        this.g.editing.connectManager.startNodeClickConnection()
        // The renderer disables canvas panning while a connection is in progress
        // (it gates on `connectManager.isActiveAndNotIdle()`). A real pointer-down
        // on a node flips the session out of 'idle' before the zoom filter runs, so
        // that guard already covers the drag — but registering the same
        // canvasBeforeZoom cancel `enableLasso` uses makes "no pan while connecting"
        // hold regardless of listener ordering. (Node-drag is disabled per-test via
        // `render.dragEnabled:false`, so the source node stays anchored.)
        this.g.renderer.getGraphInteraction().on('canvasBeforeZoom', this.cancelPan)
    }

    openNodeEditor(id: string): void {
        const node = this.g.getMutableNode(id)
        if (node) this.g.editing.openNodeSession(node)
    }

    openInspect(id: string): void {
        const node = this.g.getMutableNode(id)
        if (node) createInspectModal(node, this.g.UIManager)
    }

    async expand(path: string | string[]): Promise<void> {
        const ids = Array.isArray(path) ? path : [path]
        const opened: Array<{ owner: Pivotick; node: Node; subgraph: Pivotick }> = []
        let graph: Pivotick = this.g
        for (const id of ids) {
            const node = graph.getMutableNode(id)
            if (!node || !node.hasChildren()) break
            if (!node.expanded) graph.toggleExpandNode(node)
            const subgraph = await this.awaitSubgraph(node)
            if (!subgraph) break
            // Stop the subgraph's force pass so the children stay where we put them,
            // and give them provisional spots so a nested expand has stable anchors.
            subgraph.simulation.disable()
            this.placeChildren(graph, node, this.visibleChildren(subgraph), node.getCircleRadius() * 0.55)
            subgraph.renderer.nextTick()
            graph.renderer.nextTick()
            // Let the cluster-area circle (+ any parent resize) finish their 250ms d3
            // transitions before we read radii. (Playwright freezes CSS, not d3.)
            await this.sleep(350)
            opened.push({ owner: graph, node, subgraph })
            graph = subgraph // descend for the next id in the path
        }
        // The library's auto cluster radius is oversized for small children, so the
        // area circle reads as mostly empty. Tighten each cluster to snugly fit its
        // children — innermost first, so every parent then grows to contain its
        // already-tightened sub-clusters.
        for (let i = opened.length - 1; i >= 0; i--) {
            const { owner, node, subgraph } = opened[i]
            this.tightenCluster(owner, node, subgraph)
        }
        await this.frames(2)
    }

    async collapse(id: string): Promise<void> {
        const node = this.g.getMutableNode(id)
        if (node && node.expanded) this.g.toggleExpandNode(node)
        await this.frames(2)
    }

    private raf(): Promise<void> {
        return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    }

    private async frames(n: number): Promise<void> {
        for (let i = 0; i < n; i++) await this.raf()
    }

    private sleep(ms: number): Promise<void> {
        return new Promise<void>((resolve) => setTimeout(resolve, ms))
    }

    /** Wait for the subgraph a cluster creates on expand to exist and be populated. */
    private async awaitSubgraph(node: Node): Promise<Pivotick | undefined> {
        for (let i = 0; i < 120; i++) {
            const sub = node.getSubgraph() as Pivotick | undefined
            if (sub && sub.getMutableNodes().length > 0) return sub
            await this.raf()
        }
        return undefined
    }

    private visibleChildren(subgraph: Pivotick): Node[] {
        return subgraph.getMutableNodes().filter((n) => n.visible)
    }

    /**
     * Lay a cluster's children on a deterministic ring (parent-local coords) and
     * mirror each position onto the owner graph's real child (global = parent +
     * local) so edges crossing the cluster boundary track them.
     */
    private placeChildren(owner: Pivotick, node: Node, children: Node[], ring: number): void {
        const count = children.length
        children.forEach((child, i) => {
            const single = count === 1
            const angle = (i / count) * 2 * Math.PI - Math.PI / 2
            const lx = single ? 0 : Math.round(Math.cos(angle) * ring)
            const ly = single ? 0 : Math.round(Math.sin(angle) * ring)
            child.x = lx
            child.y = ly
            child.fx = lx
            child.fy = ly
            const real = owner.getMutableNode(child.id)
            if (real) {
                real.x = (node.x ?? 0) + lx
                real.y = (node.y ?? 0) + ly
                real.fx = real.x
                real.fy = real.y
            }
        })
    }

    /**
     * Shrink an expanded cluster's area circle to snugly enclose its children
     * (sized to fit the largest child, which for nested clusters is an already-
     * tightened sub-cluster), and re-seat the children + the parent's own
     * glyph/collapse-icon to the new radius.
     */
    private tightenCluster(owner: Pivotick, node: Node, subgraph: Pivotick): void {
        const children = this.visibleChildren(subgraph)
        const count = children.length
        const childR = Math.max(14, ...children.map((c) => c.getCircleRadius() || 0))
        const gap = 18
        // Spread children far enough apart that neighbours on the ring don't touch.
        const ring = count <= 1 ? 0 : Math.max((childR + gap) / Math.sin(Math.PI / count), childR * 1.6)
        const radius = (count <= 1 ? childR : ring + childR) + 16

        this.placeChildren(owner, node, children, ring)
        node.setCircleRadius(radius)

        const el = node.getGraphElement()
        if (el) {
            const area = el.querySelector(':scope > .pvt-cluster-area')
            if (area) {
                area.setAttribute('_final_r', String(radius))
                area.setAttribute('r', String(radius))
            }
            // Match the library's expanded layout: parent glyph at the NW rim, its
            // collapse icon at the SE rim (both at distance (r+2)/√2 along the 45°).
            const offset = (radius + 2) / Math.SQRT2
            el.querySelector(':scope > .node')?.setAttribute('transform', `translate(${-offset}, ${-offset})`)
            el.querySelector(':scope > .node-icon')?.setAttribute('transform', `translate(${offset}, ${offset})`)
        }
        subgraph.renderer.nextTick()
        owner.renderer.nextTick()
    }

    addNote(note: RawNote): string {
        const instance = new Note(note, note.id)
        this.g.noteManager.addNote(instance)
        return instance.domID
    }

    pin(): void {
        let changed = false
        for (const node of this.g.getMutableNodes()) {
            const p = this.intended.get(node.id)
            if (!p) continue
            node.x = p.x
            node.y = p.y
            node.fx = p.x
            node.fy = p.y
            changed = true
        }
        if (changed) {
            this.g.renderer.nextTick() // redraw edges + nodes at the pinned positions
            this.g.renderer.fitAndCenter() // reframe to the pinned layout
        }
    }

    applyLayout(): void {
        const layout = this.g.getOptions().layout
        if (!layout || layout.type === 'force') return // force has no exact target
        const d3sim = this.g.simulation.getSimulation()
        const forces = this.g.simulation.getForceSimulation()
        const LayoutClass = layout.type === 'egoTree' ? EgoTreeLayout : TreeLayout
        // Constructing the layout recomputes the d3-hierarchy positions and writes
        // them straight onto the live nodes (via getMutableNode), bypassing the
        // load-time force relaxation entirely.
        new LayoutClass(this.g as never, d3sim, forces as never, layout as never)
        for (const node of this.g.getMutableNodes()) {
            if (typeof node.x === 'number' && typeof node.y === 'number') {
                node.fx = node.x
                node.fy = node.y
            }
        }
        this.g.renderer.nextTick()
        this.g.renderer.fitAndCenter()
    }

    fit(scale?: number): void {
        this.g.renderer.fitAndCenter(scale)
    }

    counts(): { nodes: number; edges: number; notes: number } {
        return {
            nodes: this.g.getNodeCount(),
            edges: this.g.getEdgeCount(),
            notes: this.g.getNotes().length,
        }
    }

    nodePositions(): Record<string, { x: number; y: number }> {
        const out: Record<string, { x: number; y: number }> = {}
        for (const node of this.g.getMutableNodes()) {
            out[node.id] = { x: node.x ?? 0, y: node.y ?? 0 }
        }
        return out
    }

    setFilter(key: string, value: FilterFieldConfig): void {
        this.g.queryEngine.setFilter(key, value)
    }

    setFilters(filters: GraphFilters): void {
        this.g.queryEngine.setFilters(filters)
    }

    async loadWithFacets(name: FixtureName, overrides: PlainObject = {}): Promise<void> {
        await this.load(name, mergeOptions(overrides, { UI: { filter: { facets: DECLARED_FACETS } } }))
    }

    async loadWithLegend(name: FixtureName, spec: LegendSpec = {}, overrides: PlainObject = {}): Promise<void> {
        const key = spec.key ?? LEGEND_KEY
        // Colour the graph the way an integrator would — the legend only ever reads
        // these colours back out of the renderer.
        const mapper = new ColorPaletteMapper('pivotick')
        const color = (node: Node): string => node.id === spec.conflictNodeId
            ? LEGEND_CONFLICT_COLOR
            : mapper.getColor(String(node.getData()?.[key] ?? ''))

        const options: PlainObject = {
            render: { defaultNodeStyle: { color } },
            UI: {
                legend: this.buildLegend(spec),
                ...(spec.withFacets ? { filter: { facets: DECLARED_FACETS } } : {}),
            },
        }
        await this.load(name, mergeOptions(options, overrides))
    }

    async loadAutoLegend(name: FixtureName, spec: AutoLegendSpec = {}, overrides: PlainObject = {}): Promise<void> {
        const colorKey = spec.accessor ?? LEGEND_KEY
        const mapper = new ColorPaletteMapper('pivotick')
        const render: PlainObject = {
            defaultNodeStyle: {
                color: spec.constantColor
                    ? LEGEND_COLORS[0]
                    : (node: Node) => mapper.getColor(String(node.getData()?.[colorKey] ?? '')),
            },
        }
        // `null` means "declare no accessor", which is what most graphs look like.
        if (spec.accessor !== null) {
            render.nodeTypeAccessor = (node: Node) => node.getData()?.[colorKey]
        }

        const options: PlainObject = { render }
        if (spec.legend !== undefined) options.UI = { legend: spec.legend }
        await this.load(name, mergeOptions(options, overrides))
    }

    setLegend(spec?: LegendSpec | boolean): void {
        this.g.setLegend(typeof spec === 'boolean' ? spec : this.buildLegend(spec))
    }

    /** Turn a {@link LegendSpec} into the real `UI.legend` block. */
    private buildLegend(spec?: LegendSpec): LegendOptions | undefined {
        if (!spec) return undefined
        const legend: LegendOptions = this.buildLegendSection(spec)
        if (spec.position !== undefined) legend.position = spec.position
        return legend
    }

    /** One section of a legend: a {@link LegendSpec} minus the docking corner. */
    private buildLegendSection(spec: LegendSpec): LegendSection {
        const key = spec.key ?? LEGEND_KEY
        const section: LegendSection = {}

        // An `auto` section declares neither, and keys on `nodeTypeAccessor` instead.
        if (!spec.auto) {
            // `omitKey` is the only way to get declared entries that can't match anything.
            if (!spec.omitKey) section.key = key
            if (spec.mode === 'declared-array') {
                section.entries = this.legendEntriesFor(DECLARED_LEGEND_VALUES, key, spec)
            } else if (spec.mode === 'declared-function') {
                section.entries = (graph) => this.legendEntriesFor(
                    distinctValues(graph as Pivotick, key).map((option) => option.value), key, spec
                )
            }
        }

        if (spec.id !== undefined) section.id = spec.id
        if (spec.title !== undefined) section.title = spec.title
        if (spec.collapsed !== undefined) section.collapsed = spec.collapsed
        if (spec.collapsible !== undefined) section.collapsible = spec.collapsible
        if (spec.filterable !== undefined) section.filterable = spec.filterable
        if (spec.showCounts !== undefined) section.showCounts = spec.showCounts
        if (spec.maxVisibleEntries !== undefined) section.maxVisibleEntries = spec.maxVisibleEntries
        return section
    }

    /** Turn a {@link LegendGroupSpec} into the real stacked `UI.legend` block. */
    private buildLegendGroup(spec: LegendGroupSpec): LegendGroupOptions {
        const group: LegendGroupOptions = {
            sections: spec.sections.map((section) => this.buildLegendSection(section)),
        }
        if (spec.position !== undefined) group.position = spec.position
        return group
    }

    async loadWithLegendGroup(name: FixtureName, spec: LegendGroupSpec, overrides: PlainObject = {}): Promise<void> {
        // One dimension drives the colours, the way a real graph works: the other
        // sections key on dimensions the canvas encodes some other way.
        const colorKey = spec.colorKey ?? spec.sections[0]?.key ?? LEGEND_KEY
        const mapper = new ColorPaletteMapper('pivotick')
        const render: PlainObject = {
            defaultNodeStyle: {
                color: (node: Node) => mapper.getColor(String(node.getData()?.[colorKey] ?? '')),
            },
        }
        if (spec.accessor !== undefined) {
            const accessorKey = spec.accessor
            render.nodeTypeAccessor = (node: Node) => node.getData()?.[accessorKey]
        }

        const options: PlainObject = {
            render,
            UI: {
                legend: this.buildLegendGroup(spec),
                ...(spec.withFacets ? { filter: { facets: DECLARED_FACETS } } : {}),
            },
        }
        await this.load(name, mergeOptions(options, overrides))
    }

    setLegendGroup(spec: LegendGroupSpec): void {
        this.g.setLegend(this.buildLegendGroup(spec))
    }

    legendSections(): LegendSectionSnapshot[] {
        return [...document.querySelectorAll('.pvt-legend-section')].map((block) => ({
            id: (block as HTMLElement).dataset.section ?? '',
            title: block.querySelector('.pvt-legend-title')?.textContent ?? '',
            collapsed: block.classList.contains('pvt-legend-collapsed'),
            rows: [...block.querySelectorAll('.pvt-legend-entry')].map((row) => this.readLegendRow(row)),
        }))
    }

    /**
     * Declared entries for `values`: fixed colours, upper-cased labels (so a
     * declared label is visibly not the raw value) and an explicit predicate —
     * unless `omitKey`, which leaves them unmatched on purpose.
     */
    private legendEntriesFor(values: string[], key: string, spec: LegendSpec): LegendEntry[] {
        return values.map((value, index) => {
            const entry: LegendEntry = {
                id: value,
                label: value.toUpperCase(),
                color: LEGEND_COLORS[index % LEGEND_COLORS.length],
            }
            if (!spec.omitKey) {
                entry.predicate = (node) => String(node.getData()?.[key] ?? '') === value
            }
            return entry
        })
    }

    legendRows(): LegendRow[] {
        return [...document.querySelectorAll('.pvt-legend-entry')].map((row) => this.readLegendRow(row))
    }

    private readLegendRow(row: Element): LegendRow {
        return {
            id: row.getAttribute('data-id') ?? '',
            label: row.querySelector('.pvt-legend-label')?.textContent ?? '',
            count: row.querySelector('.pvt-legend-count')?.textContent ?? null,
            // A node section's dot carries its colour as a custom property; an edge
            // section draws a line instead, whose stroke the CSSOM has normalised.
            color: (row.querySelector('.pvt-legend-swatch') as HTMLElement | null)
                ?.style.getPropertyValue('--pvt-legend-swatch-color').trim()
                || (row.querySelector('.pvt-edge-swatch line') as SVGLineElement | null)?.style.stroke
                || '',
            hidden: row.classList.contains('pvt-legend-hidden'),
            disabled: (row as HTMLButtonElement).disabled === true,
        }
    }

    legendTitle(): string | null {
        return document.querySelector('.pvt-legend-title')?.textContent ?? null
    }

    nodeColor(id: string): string {
        const node = this.g.getMutableNode(id)
        if (!node) return ''
        return String(this.g.renderer.getNodeStyle(node).color)
    }

    legendEvents(): LegendToggleState[] {
        return this.legendToggles.map((state) => ({
            section: state.section,
            hidden: [...state.hidden],
            visible: [...state.visible],
        }))
    }

    activeFilterKeys(): string[] {
        return Object.keys(this.g.queryEngine.getFilters())
            .filter((key) => key !== 'manuallyHidden')
            .sort()
    }

    warnings(): string[] {
        return [...this.recordedWarnings]
    }

    async loadWithMinimap(name: FixtureName, options: MinimapOptions = {}, overrides: PlainObject = {}): Promise<void> {
        await this.load(name, mergeOptions({ plugins: [minimap(options)] }, overrides))
    }

    async loadWithPluginPane(name: FixtureName, overrides: PlainObject = {}): Promise<void> {
        this.pluginPaneEntries = []
        await this.load(name, mergeOptions({ plugins: [this.pluginPane()] }, overrides))
    }

    /**
     * A pane contributed the way a real plugin contributes one — nothing but
     * `ctx.addDockTab` and a public event bus. It records while hidden and paints only
     * when it is on screen, so `onActivate` has a backlog to show on return.
     */
    private pluginPane(): PivotickPlugin {
        return {
            name: 'testPluginPane',
            install: (ctx) => {
                let body: HTMLElement | undefined
                // Painting is gated, not the element: the dock keeps what `render`
                // returned and re-attaches it, so dropping the reference on deactivation
                // would leave nothing to paint into on return.
                let visible = false
                const paint = () => {
                    if (!body || !visible) return
                    body.innerHTML = ''
                    for (const label of this.pluginPaneEntries) {
                        const row = document.createElement('div')
                        row.className = 'pvt-plugin-pane-row'
                        row.textContent = label
                        body.appendChild(row)
                    }
                }
                ctx.addDockTab({
                    id: 'pluginPane',
                    label: 'Recorder',
                    render: () => {
                        body = document.createElement('div')
                        body.className = 'pvt-plugin-pane'
                        paint()
                        return body
                    },
                    onActivate: () => { visible = true; paint() },
                    onDeactivate: () => { visible = false },
                })
                // Recording is unconditional — that is the whole contrast with the table.
                ctx.graph.on('nodeAdd', (node) => {
                    this.pluginPaneEntries.push(String(node.getData()?.label ?? node.id))
                    paint()
                })
            },
        }
    }

    pluginPaneRecorded(): string[] {
        return [...this.pluginPaneEntries]
    }

    dockTabIds(): string[] {
        return this.g.UIManager.getDockTabs().map((tab) => tab.id)
    }

    activeDockTabId(): string | null {
        return this.g.UIManager.dock?.getActiveTabId() ?? null
    }

    addTestDockTab(id: string, label: string, order?: number): string {
        this.dockTabDisposers.set(id, this.g.UIManager.addDockTab({
            id,
            label,
            order,
            render: () => {
                const body = document.createElement('div')
                body.className = 'pvt-test-dock-body'
                body.textContent = `body of ${label}`
                return body
            },
            toolbar: () => {
                const control = document.createElement('button')
                control.type = 'button'
                control.className = 'pvt-test-dock-control'
                control.textContent = `${label} control`
                return control
            },
        }))
        return id
    }

    /**
     * Calls the *disposer*, not `removeDockTab` — and keeps it, so a second call goes
     * through the disposer's own idempotence rather than round-tripping to a registry
     * that has legitimately forgotten the tab. That distinction is the thing under test.
     */
    removeTestDockTab(id: string): void {
        this.dockTabDisposers.get(id)?.()
    }

    activeDockBodyText(): string {
        return (document.querySelector('.pvt-dock-body')?.textContent ?? '').trim()
    }

    refreshDockTab(id: string): void {
        this.g.UIManager.refreshDockTab(id)
    }

    /**
     * The live minimap instance. `UIManager.elements` is private, but plugin-added
     * elements aren't in the keyed registry — and this is the same runtime-reach the
     * unrendered-visibility probe uses.
     */
    private minimapElement(): Minimap | undefined {
        const ui = this.g.UIManager as unknown as { elements: unknown[] }
        return ui.elements.find((element) => element instanceof Minimap) as Minimap | undefined
    }

    setContainerSize(width: number, height: number): void {
        this.container.style.width = `${width}px`
        this.container.style.height = `${height}px`
    }

    minimapCollapsed(): boolean | null {
        return this.minimapElement()?.isCollapsed() ?? null
    }

    minimapViewport(): GraphBounds | null {
        return this.minimapElement()?.getViewportBounds() ?? null
    }

    minimapRebuilds(): number {
        return this.minimapElement()?.getRebuildCount() ?? -1
    }

    viewCenter(): { x: number, y: number } | null {
        const canvas = this.g.UIManager.layout?.canvas
        if (!canvas) return null
        const rect = canvas.getBoundingClientRect()
        return this.g.renderer.screenToGraphCoordinates(
            rect.left + rect.width / 2,
            rect.top + rect.height / 2,
        )
    }

    async loadManyNodes(count: number, overrides: PlainObject = {}): Promise<void> {
        this.destroy()
        const nodes: Node[] = []
        for (let index = 0; index < count; index++) {
            const node = new Node(`bulk-${index}`, { label: `Row ${index}`, seq: index }, {}, `bulk-${index}`)
            node.x = (index % 40) * 24
            node.y = Math.floor(index / 40) * 24
            node.fx = node.x
            node.fy = node.y
            nodes.push(node)
        }

        const graph = new Pivotick(
            this.container,
            { nodes, edges: [] } as never,
            mergeOptions(BASE_OPTIONS, overrides) as never,
        )
        this.graph = graph
        await this.whenReady(graph)
        if (document.fonts?.ready) await document.fonts.ready
    }

    async loadManyNodesWithMinimap(count: number, options: MinimapOptions = {}): Promise<void> {
        this.destroy()
        const nodes: Node[] = []
        for (let index = 0; index < count; index++) {
            // Concentric rings: a stable extent, and enough structure that the density
            // path has something recognisable to draw.
            const angle = (index / count) * Math.PI * 12
            const radius = 60 + (index / count) * 420
            const node = new Node(`bulk-${index}`, {}, {}, `bulk-${index}`)
            node.x = Math.cos(angle) * radius
            node.y = Math.sin(angle) * radius
            node.fx = node.x
            node.fy = node.y
            nodes.push(node)
        }

        const graph = new Pivotick(
            this.container,
            { nodes, edges: [] } as never,
            mergeOptions(BASE_OPTIONS, { plugins: [minimap(options)] }) as never,
        )
        this.graph = graph
        graph.on('legendToggle', (state) => this.legendToggles.push(state))
        await this.whenReady(graph)
        if (document.fonts?.ready) await document.fonts.ready
    }

    visibleNodeIds(): string[] {
        // `childrenDepth === 0` = the nodes of *this* graph, mirroring what the query
        // engine considers visible here (a cluster's children live in its subgraph).
        return this.g.getMutableNodes()
            .filter((node) => node.childrenDepth === 0 && node.visible)
            .map((node) => node.id)
    }

    hiddenNodeCount(): number {
        return this.g.queryEngine.getHiddenNodeCount()
    }

    disconnectedNodeCount(): number {
        return this.g.queryEngine.getDisconnectedNodeCount()
    }

    hideDisconnectedOn(): boolean {
        return this.g.queryEngine.isHideDisconnected()
    }

    reapplyFilters(): void {
        this.g.queryEngine.reapply()
    }

    /* ---------- edge layers ---------- */

    async loadWithEdgeLayers(
        name: FixtureName,
        spec: EdgeLayerSpec = {},
        overrides: PlainObject = {}
    ): Promise<void> {
        const key = spec.key ?? EDGE_LAYER_KEY
        const render: PlainObject = {
            edgeTypeAccessor: (edge: Edge) => (edge.getData() as Record<string, unknown>)?.[key] as string | undefined,
        }
        if (!spec.noStyleMap) render.edgeStyleMap = EDGE_STYLE_MAP

        // A node-scoped section beside the edge one only *shows* anything if the nodes
        // are actually coloured by that dimension — the legend reports colours, it never
        // assigns them. Coloured the way an integrator would, as loadWithLegend does.
        if (spec.nodeSection) {
            const mapper = new ColorPaletteMapper('pivotick')
            render.defaultNodeStyle = {
                color: (node: Node) => mapper.getColor(String(node.getData()?.type ?? '')),
            }
        }

        const UI: PlainObject = {}
        if (spec.facet !== false) {
            const facet: EdgeFacet = { key, label: 'Relationship layer' }
            if (spec.facetType && spec.facetType !== 'multiselect') facet.type = spec.facetType
            UI.filter = { edgeFacets: [facet] }
        }
        if (spec.legend) {
            const sections: LegendSection[] = []
            if (spec.nodeSection) sections.push({ key: 'type', title: 'Element' })
            sections.push({ key, title: 'Relationship', scope: 'edge' })
            UI.legend = { sections }
        }

        await this.load(name, mergeOptions({ render, UI }, overrides))

        // Applied after the load, on the edges themselves: only an edge's *own*
        // `style.edge.styleCb` is ever called (`render.defaultEdgeStyle.styleCb` is
        // declared but never invoked), and that is the precedence being tested.
        if (spec.styleCb) {
            for (const edge of this.g.getMutableEdges()) {
                edge.updateStyle({ edge: { styleCb: () => ({ strokeColor: STYLE_CB_COLOR }) } })
            }
            this.g.onChange()
        }
    }

    async loadWithStyleCallbacks(
        name: FixtureName,
        spec: StyleCbSpec = {},
        overrides: PlainObject = {}
    ): Promise<void> {
        const render: PlainObject = {}
        if (spec.node) render.defaultNodeStyle = { styleCb: () => ({ color: DEFAULT_CB_COLOR }) }
        if (spec.edge) {
            render.defaultEdgeStyle = {
                styleCb: () => ({ strokeColor: DEFAULT_CB_COLOR, strokeWidth: DEFAULT_CB_WIDTH }),
            }
        }
        if (spec.label) render.defaultLabelStyle = { styleCb: () => ({ color: DEFAULT_CB_COLOR }) }
        if (spec.edgeStyleMap) {
            render.edgeTypeAccessor = (edge: Edge) =>
                (edge.getData() as Record<string, unknown>)?.kind as string | undefined
            render.edgeStyleMap = EDGE_STYLE_MAP
        }

        await this.load(name, mergeOptions({ render }, overrides))

        if (spec.edgeOwn) {
            // Only a colour: what the default callback's width does next is the point.
            for (const edge of this.g.getMutableEdges()) {
                edge.updateStyle({ edge: { styleCb: () => ({ strokeColor: STYLE_CB_COLOR }) } })
            }
            this.g.onChange()
        }
    }

    /** The colour a `render.default*Style.styleCb` paints, for a test to assert against. */
    defaultCallbackColor(): string {
        return DEFAULT_CB_COLOR
    }

    /** The width a default edge `styleCb` sets. */
    defaultCallbackWidth(): number {
        return DEFAULT_CB_WIDTH
    }

    /** The stroke width the renderer resolved for an edge. */
    edgeStrokeWidth(id: string): number | null {
        const edge = this.g.getMutableEdges().find((candidate) => candidate.id === id)
        if (!edge) return null
        return Number(this.g.renderer?.getEdgeStyle(edge)?.strokeWidth)
    }

    /** The inline `fill` of every rendered edge label — where a label style lands. */
    edgeLabelFills(): string[] {
        return [...this.container.querySelectorAll('.pvt-edge-label')]
            .map((label) => (label as SVGTextElement).style.fill)
    }

    /** Ids of the edges currently drawn — a layer-hidden edge is removed from the render. */
    visibleEdgeIds(): string[] {
        return this.g.getMutableVisibleEdges().map((edge) => edge.id).sort()
    }

    /**
     * Ids of the edges the **link force** is holding. This is the layout question: an
     * edge switched off by a layer must stay in here, or the equilibrium changes and
     * the graph drifts. Endpoint-hidden edges and unchosen cluster stand-ins do leave.
     */
    simulationEdgeIds(): string[] {
        return this.g.simulation.getActiveEdges().map((edge) => edge.id).sort()
    }

    /** What the filter pill reports as hidden by an edge layer. */
    hiddenEdgeCount(): number {
        return this.g.queryEngine.getHiddenEdgeCount()
    }

    setEdgeFilter(key: string, value: FilterFieldConfig): void {
        this.g.queryEngine.setEdgeFilter(key, value)
    }

    removeEdgeFilter(key: string): void {
        this.g.queryEngine.removeEdgeFilter(key)
    }

    /** The panel's Relationships rows, in display order. */
    edgeLayerRows(): EdgeLayerRow[] {
        return [...this.container.querySelectorAll('.pvt-edge-layer')].map((row) => ({
            value: row.getAttribute('data-value') ?? '',
            label: row.querySelector('.pvt-edge-layer-label')?.textContent ?? '',
            count: row.querySelector('.pvt-edge-layer-count')?.textContent ?? null,
            hidden: row.classList.contains('pvt-edge-layer-hidden'),
        }))
    }

    /**
     * The stroke the renderer resolves for an edge — what is actually painted, and so
     * what a line swatch must report back.
     */
    edgeStyleOf(id: string): EdgeSwatchSnapshot | null {
        const edge = this.g.getMutableEdges().find((candidate) => candidate.id === id)
        if (!edge) return null
        const style = this.g.renderer?.getEdgeStyle(edge)
        return {
            stroke: String(style?.strokeColor ?? ''),
            dashed: style?.dashed === true,
            marker: typeof style?.markerEnd === 'string' && style.markerEnd !== '',
        }
    }

    /**
     * A CSS colour as the browser reports it back. A swatch's colour is written through
     * the CSSOM (so a bogus value from consumer data is dropped rather than taken
     * verbatim), which normalises `#888888` to `rgb(136, 136, 136)` — so an assertion
     * against a declared hex has to go through the same normalisation.
     */
    cssColor(value: string): string {
        const probe = document.createElement('span')
        probe.style.color = value
        return probe.style.color
    }

    /** What a rendered line swatch draws, read off the DOM inside `container`. */
    edgeSwatchOf(container: string, index: number): EdgeSwatchSnapshot | null {
        const swatches = this.container.querySelectorAll(`${container} .pvt-edge-swatch`)
        const svg = swatches[index]
        if (!svg) return null
        const line = svg.querySelector('line')
        return {
            stroke: line ? (line as SVGLineElement).style.stroke : '',
            dashed: line?.hasAttribute('stroke-dasharray') === true,
            marker: svg.querySelector('path') !== null,
        }
    }

    subgraphVisibleNodeIds(clusterId: string): string[] {
        const subgraph = this.g.getMutableNode(clusterId)?.getSubgraph() as Pivotick | undefined
        if (!subgraph) return []
        return subgraph.getMutableNodes().filter((node) => node.visible).map((node) => node.id)
    }

    private filterForm(): HTMLFormElement | null {
        return this.container.querySelector('.pvt-graph-filter-container .pvt-form')
    }

    setPanelValue(key: string, value: string): void {
        const control = this.filterForm()?.querySelector(`[data-field-key="${key}"]`)
        if (!control) return
        if (control instanceof HTMLSelectElement) {
            control.value = value
            ;(control as HTMLSelectElement & { _picker?: { sync(): void } })._picker?.sync()
        } else if (control instanceof HTMLInputElement) {
            control.value = value
        }
    }

    panelValues(): Record<string, unknown> {
        const form = this.filterForm()
        return form ? FormFactory.getValues(form) : {}
    }

    filterFields(): Array<{ key: string; label: string; type: string }> {
        const form = this.filterForm()
        if (!form) return []
        return [...form.querySelectorAll('.pvt-form-element')].map((wrapper) => {
            const control = wrapper.querySelector('[data-field-key]')
            return {
                key: control?.getAttribute('data-field-key') ?? '',
                label: wrapper.querySelector('label')?.textContent ?? '',
                type: control?.getAttribute('data-field-type') ?? '',
            }
        })
    }

    resetFilters(): void {
        this.g.queryEngine.resetFilters()
    }

    excludeNode(id: string): void {
        this.g.queryEngine.excludeNode(id)
    }

    hideNode(id: string): void {
        const node = this.g.getMutableNode(id)
        if (node) this.g.hideNode(node)
    }

    showNode(id: string): void {
        const node = this.g.getMutableNode(id)
        if (node) this.g.showNode(node)
    }

    openFilterPanel(): void {
        this.g.UIManager.mainHeader?.filteringSlidepanel?.open()
    }

    configureConnect(config: ConnectConfig = {}): void {
        const delay = config.asyncDelayMs ?? 60
        const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

        this.recordedEdges = []
        this.edgeHookCalls = 0
        this.validConnCalls = 0
        this.seenHookContexts = []

        // Record every edge that actually enters the model (post-decision). Register
        // once — the graph bus has no `off`, so re-registering per call would stack
        // listeners and double-count. The single listener always reads the latest
        // `recordedEdges` (reset above), so re-configuring still starts from empty.
        if (!this.edgeAddHooked) {
            this.edgeAddHooked = true
            this.g.on('edgeAdd', (edge) => {
                this.recordedEdges.push({
                    id: edge.id,
                    data: edge.getData() as Record<string, unknown>,
                    directed: edge.directed,
                })
            })
        }

        const opts = this.g.getOptions() as { callbacks?: InterractionCallbacks }
        const callbacks: InterractionCallbacks = opts.callbacks ?? (opts.callbacks = {})

        if (config.edgeHook) {
            const behavior = config.edgeHook
            callbacks.onBeforeEdgeCreate = async (ctx: EdgeCreateContext): Promise<EdgeCreateDecision> => {
                this.edgeHookCalls++
                this.seenHookContexts.push({ origin: ctx.origin, kind: ctx.kind })
                if (behavior.endsWith('-async')) await sleep(delay)
                // Veto the first attempt only, so a test can prove connect mode
                // stays usable and a retry succeeds.
                if (behavior === 'veto-once') return this.edgeHookCalls > 1
                if (behavior.startsWith('veto')) return false
                if (behavior.startsWith('accept-data')) {
                    return { accept: true, data: { label: 'linked-to', kind: ctx.kind }, directed: true }
                }
                if (behavior === 'prompt-inline' || behavior === 'prompt-modal') {
                    const mode = behavior === 'prompt-modal' ? 'modal' : 'inline'
                    const label = await ctx.promptLabel({ mode })
                    // Cancel (null) vetoes; otherwise accept carrying the entered label.
                    if (label === null) return false
                    return { accept: true, data: { label } }
                }
                if (behavior === 'prompt-data-fields') {
                    const values = await ctx.promptData({
                        fields: [
                            { key: 'label', label: 'Label', type: 'text' },
                            { key: 'note', label: 'Note', type: 'text' },
                        ],
                    })
                    if (values === null) return false
                    return { accept: true, data: values }
                }
                if (behavior === 'prompt-data-render') {
                    let labelEl: HTMLInputElement | null = null
                    let noteEl: HTMLInputElement | null = null
                    const data = await ctx.promptData({
                        render: (body) => {
                            body.innerHTML = '<input class="test-label"><input class="test-note">'
                            labelEl = body.querySelector('.test-label')
                            noteEl = body.querySelector('.test-note')
                        },
                        getValues: () => ({ label: labelEl?.value, note: noteEl?.value }),
                    })
                    if (data === null) return false
                    return { accept: true, data }
                }
                if (behavior === 'prompt-by-origin') {
                    // Drag → inline free-text; click-click → modal dropdown of labels.
                    if (ctx.origin === 'drag') {
                        const label = await ctx.promptLabel({ mode: 'inline' })
                        if (label === null) return false
                        return { accept: true, data: { label } }
                    }
                    const values = await ctx.promptData({
                        fields: [{
                            key: 'label',
                            label: 'Relationship',
                            type: 'select',
                            defaultValue: 'mentors',
                            options: [
                                { value: 'mentors', label: 'mentors' },
                                { value: 'reports to', label: 'reports to' },
                                { value: 'manages', label: 'manages' },
                            ],
                        }],
                    })
                    if (values === null) return false
                    return { accept: true, data: values }
                }
                return true
            }
        }

        if (config.validConnection) {
            const vc = config.validConnection
            callbacks.isValidConnection = (_source, target): boolean => {
                this.validConnCalls++
                if (vc === 'reject-all') return false
                if (vc === 'reject-target-b') return target.id !== 'b'
                return true
            }
        }
    }

    setEdgeLabelPrompt(mode: 'inline' | 'modal' | null): void {
        const ui = this.g.UIManager.getOptions() as { editors?: { edgeEditor?: { labelPrompt?: 'inline' | 'modal' } } }
        ui.editors = ui.editors ?? {}
        ui.editors.edgeEditor = mode ? { labelPrompt: mode } : {}
    }

    edgeEvents(): RecordedEdge[] {
        return this.recordedEdges
    }

    hookCalls(): { edge: number; validConnection: number } {
        return { edge: this.edgeHookCalls, validConnection: this.validConnCalls }
    }

    hookContexts(): Array<{ origin: string; kind: string }> {
        return this.seenHookContexts
    }

    linkNote(noteId: string, nodeId: string): void {
        const cm = this.g.editing.connectManager
        cm.startNoteClickConnection()
        const note = this.g.noteManager.getNote(noteId)
        const node = this.g.getMutableNode(nodeId)
        if (!note || !node) return
        // Set the note as the connection source (the note-handle click the real UI
        // fires), then pick the node as target — driving the same session path.
        const internal = cm as unknown as { activeSession: { handleNoteClick(n: Note): boolean } | null }
        internal.activeSession?.handleNoteClick(note)
        cm.selectOrConnectNode(node)
    }

    noteAttachment(noteId: string): { type: string; id: string } | null {
        const attached = this.g.noteManager.getNote(noteId)?.getAttachedElement()
        return attached ? { type: attached.type, id: attached.id } : null
    }

    /* ---------- sidebar extra panels ---------- */

    async loadWithPanels(name: FixtureName, panels: PanelSpec[], overrides: PlainObject = {}): Promise<void> {
        const built = panels.map((spec) => ({ spec, panel: this.buildPanel(spec) }))
        const declared = built.filter(({ spec }) => spec.register !== 'early').map(({ panel }) => panel)
        const early = built.filter(({ spec }) => spec.register === 'early')

        await this.boot(name, mergeOptions({ UI: { extraPanels: declared } }, overrides), (graph) => {
            for (const { panel } of early) {
                this.panelDisposers.set(panel.id, graph.UIManager.addPanel(panel))
            }
        })
    }

    addPanel(spec: PanelSpec): string {
        const panel = this.buildPanel(spec)
        this.panelDisposers.set(panel.id, this.g.UIManager.addPanel(panel))
        return panel.id
    }

    addPanelViaPlugin(spec: PanelSpec): string {
        const panel = this.buildPanel(spec)
        this.g.use({
            name: `panel-plugin-${panel.id}`,
            install: (ctx) => {
                this.panelDisposers.set(panel.id, ctx.addPanel(panel))
            },
        })
        return panel.id
    }

    disposePanel(id: string): void {
        this.panelDisposers.get(id)?.()
    }

    removePanel(id: string): void {
        this.g.UIManager.removePanel(id)
    }

    refreshPanel(id?: string): void {
        this.g.UIManager.refreshPanel(id)
    }

    panelIds(): string[] {
        return this.g.UIManager.getPanels().map((panel) => panel.id)
    }

    panelRenderCount(id: string): number {
        return this.panelRenders.get(id) ?? 0
    }

    probePanelAfterTeardown(spec: PanelSpec): { panelsBefore: number; registered: boolean; domPanelsAfter: number } {
        const ui = this.g.UIManager
        const panelsBefore = ui.getPanels().length
        this.g.destroy()

        const panel = this.buildPanel(spec)
        ui.addPanel(panel)
        return {
            panelsBefore,
            registered: ui.getPanels().some((registered) => registered.id === panel.id),
            domPanelsAfter: this.container.querySelectorAll('[data-panel-id]').length,
        }
    }

    /**
     * A panel whose title and body report the selection they were handed plus
     * their own render count, so both the re-render contract and the pinned
     * (`reactive: false`) case are readable from the DOM.
     */
    private buildPanel(spec: PanelSpec): ExtraPanel & { id: string } {
        const id = spec.id ?? `panel-${++this.panelSeq}`
        this.panelRenders.set(id, 0)

        return {
            id,
            order: spec.order,
            alwaysVisible: spec.alwaysVisible,
            reactive: spec.reactive,
            title: spec.noTitle ? undefined : (selection) => `${id} · ${describeSelection(selection)}`,
            render: (selection, handle, ctx) => {
                const renders = (this.panelRenders.get(id) ?? 0) + 1
                this.panelRenders.set(id, renders)

                const build = (suffix: string): HTMLElement => {
                    const body = document.createElement('div')
                    body.className = 'pvt-test-panel'
                    const summary = document.createElement('span')
                    summary.className = 'pvt-test-panel-summary'
                    summary.textContent = `${describeSelection(selection)} · renders=${renders}${suffix}`
                    body.append(summary)

                    if (spec.selfDriven) {
                        body.append(
                            panelButton('pvt-test-panel-refresh', 'refresh me', () => handle.refresh()),
                            panelButton('pvt-test-panel-remove', 'remove me', () => handle.remove())
                        )
                    }
                    return body
                }

                if (!spec.async) return build('')
                return this.holdRender('extraPanel.render', id, ctx).then((text) => build(` · ${text}`))
            },
        }
    }

    /* ---------- async content hooks ---------- */

    async loadAsyncContent(name: FixtureName, spec: AsyncContentSpec, overrides: PlainObject = {}): Promise<void> {
        this.heldRenders.clear()
        this.asyncCalls.clear()
        this.asyncSpec = spec

        const asyncContent: PlainObject = {}
        if (spec.placeholder !== undefined) asyncContent.placeholder = spec.placeholder
        if (spec.error !== undefined) asyncContent.error = spec.error

        const installed = [...(spec.hooks ?? []), ...(spec.syncHooks ?? [])]
        const wants = (hook: AsyncHook): boolean => installed.includes(hook)
        const tooltip: PlainObject = {}
        const propertiesPanel: PlainObject = {}
        const neighborsPanel: PlainObject = {}
        const mainHeader: PlainObject = {}

        if (wants('tooltip.render')) {
            tooltip.render = (element: Node | Edge, ctx: RenderContext) =>
                this.hookContent('tooltip.render', element.id, ctx, asyncTestElement)
        }
        if (wants('tooltip.renderNodeExtra')) {
            tooltip.renderNodeExtra = (node: Node, ctx: RenderContext) =>
                this.hookContent('tooltip.renderNodeExtra', node.id, ctx, asyncTestElement)
        }
        if (wants('tooltip.nodePropertiesMap')) {
            tooltip.nodePropertiesMap = (node: Node, ctx: RenderContext) =>
                this.hookContent('tooltip.nodePropertiesMap', node.id, ctx, asyncTestProperties)
        }
        if (wants('propertiesPanel.render')) {
            propertiesPanel.render = (selection: ExtraPanelSelection, ctx: RenderContext) =>
                this.hookContent('propertiesPanel.render', describeSelection(selection), ctx, asyncTestElement)
        }
        if (wants('propertiesPanel.nodePropertiesMap')) {
            propertiesPanel.nodePropertiesMap = (node: Node, ctx: RenderContext) =>
                this.hookContent('propertiesPanel.nodePropertiesMap', node.id, ctx, asyncTestProperties)
        }
        if (wants('neighborsPanel.render')) {
            neighborsPanel.render = (selection: ExtraPanelSelection, ctx: RenderContext) =>
                this.hookContent('neighborsPanel.render', describeSelection(selection), ctx, asyncTestElement)
        }
        if (wants('mainHeader.render')) {
            mainHeader.render = (selection: ExtraPanelSelection, ctx: RenderContext) =>
                this.hookContent('mainHeader.render', describeSelection(selection), ctx, asyncTestElement)
        }

        await this.boot(name, mergeOptions({
            UI: { asyncContent, tooltip, propertiesPanel, neighborsPanel, mainHeader },
        }, overrides))
    }

    pendingAsync(): string[] {
        return [...this.heldRenders.keys()]
    }

    settleAsync(key: string, text: string = `settled ${key}`): void {
        this.heldRenders.get(key)?.resolve(text)
        this.heldRenders.delete(key)
    }

    failAsync(key: string, message: string = `failed ${key}`): void {
        this.heldRenders.get(key)?.reject(new Error(message))
        this.heldRenders.delete(key)
    }

    asyncAborted(key: string): boolean {
        return this.heldRenders.get(key)?.signal.aborted ?? false
    }

    asyncStale(key: string): boolean {
        return this.heldRenders.get(key)?.isStale() ?? false
    }

    asyncCallCount(hook: AsyncHook): number {
        return this.asyncCalls.get(hook) ?? 0
    }

    destroyGraph(): void {
        this.g.destroy()
    }

    /* ---------- write-path lifecycle hooks ---------- */

    configureWritePath(config: WritePathConfig = {}): void {
        const delay = config.asyncDelayMs ?? 60
        const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

        this.writePathHookCalls = { delete: 0, nodeCreate: 0, edgeEditCommit: 0, edgeEditBody: 0, edgeEditCancel: 0, nodeEditCommit: 0 }
        this.seenDeleteContexts = []
        this.removed = { nodes: [], edges: [], notes: [] }
        this.recordedNodeChanges = []
        this.recordedEdgeChanges = []

        // Register the recorders once — the graph bus has no `off`, so re-registering
        // per call would stack listeners and double-count. They always read the latest
        // (reset above) arrays, so re-configuring still starts from empty.
        if (!this.writePathHooked) {
            this.writePathHooked = true
            this.g.on('nodeRemove', (node) => { this.removed.nodes.push(node.id) })
            this.g.on('edgeRemove', (edge) => { this.removed.edges.push(edge.id) })
            this.g.on('noteRemove', (note) => { this.removed.notes.push(note.id) })
            this.g.on('nodeChange', (node, previous, next) => {
                this.recordedNodeChanges.push({
                    id: node.id,
                    previous: { ...previous } as Record<string, unknown>,
                    next: { ...next } as Record<string, unknown>,
                })
            })
            this.g.on('edgeChange', (edge, previous, next) => {
                this.recordedEdgeChanges.push({
                    id: edge.id,
                    previous: { ...previous } as Record<string, unknown>,
                    next: { ...next } as Record<string, unknown>,
                })
            })
        }

        const opts = this.g.getOptions() as { callbacks?: InterractionCallbacks }
        const callbacks: InterractionCallbacks = opts.callbacks ?? (opts.callbacks = {})

        if (config.deleteHook) {
            const behavior = config.deleteHook
            callbacks.onBeforeDelete = async (ctx: DeleteContext): Promise<DeleteDecision> => {
                this.writePathHookCalls.delete++
                this.seenDeleteContexts.push({
                    nodes: ctx.nodes.map((node) => node.id),
                    edges: ctx.edges.map((edge) => edge.id),
                    notes: ctx.notes.map((note) => note.id),
                    cascadingEdges: ctx.cascadingEdges.map((edge) => edge.id),
                    origin: ctx.origin,
                })
                if (behavior.endsWith('-async')) await sleep(delay)
                if (behavior.startsWith('veto')) return false
                if (behavior === 'narrow-nodes') return { accept: true, nodes: ctx.nodes.slice(0, 1) }
                if (behavior === 'spare-edges') return { accept: true, edges: [] }
                if (behavior === 'confirm') {
                    return await ctx.confirm({ title: 'Delete?', body: `${ctx.nodes.length} node(s) will go.` })
                }
                return true
            }
        }

        if (config.nodeCreateHook) {
            const behavior = config.nodeCreateHook
            callbacks.onBeforeNodeCreate = async (ctx: NodeCreateContext): Promise<NodeCreateDecision> => {
                this.writePathHookCalls.nodeCreate++
                if (behavior.endsWith('-async')) await sleep(delay)
                if (behavior === 'veto') return false
                if (behavior === 'accept-data') {
                    return {
                        accept: true,
                        id: 'created',
                        // Echo the position back as data, so a test can prove the hook
                        // was handed the graph-space point the gesture landed on.
                        data: { label: 'Created', origin: ctx.origin, at: `${Math.round(ctx.position.x)},${Math.round(ctx.position.y)}` },
                        style: { color: '#e6194B' },
                    }
                }
                if (behavior === 'prompt-data') {
                    const values = await ctx.promptData({
                        fields: [
                            { key: 'label', label: 'Label', type: 'text' },
                            { key: 'kind', label: 'Kind', type: 'text' },
                        ],
                    })
                    if (values === null) return false
                    return { accept: true, id: 'prompted', data: values }
                }
                return true
            }
        }

        if (config.edgeEditBody) {
            callbacks.onEdgeEdit = (session): HTMLDivElement => {
                this.writePathHookCalls.edgeEditBody++
                const body = document.createElement('div')
                body.className = 'test-edge-body'
                const input = document.createElement('input')
                input.className = 'test-edge-label'
                input.value = String(session.draft.label ?? '')
                // No form for the library to read: the handler owns the draft.
                input.addEventListener('input', () => session.setDraft({ ...session.draft, label: input.value }))
                body.appendChild(input)
                return body
            }
            callbacks.onEdgeEditCancel = (): void => { this.writePathHookCalls.edgeEditCancel++ }
        }

        if (config.edgeEditHook) {
            const behavior = config.edgeEditHook
            callbacks.onBeforeEdgeEditCommit = async (): Promise<boolean> => {
                this.writePathHookCalls.edgeEditCommit++
                if (behavior.endsWith('-async')) await sleep(delay)
                return !behavior.startsWith('veto')
            }
        }

        if (config.nodeEditHook) {
            const behavior = config.nodeEditHook
            callbacks.onBeforeNodeEditCommit = async (): Promise<boolean> => {
                this.writePathHookCalls.nodeEditCommit++
                if (behavior.endsWith('-async')) await sleep(delay)
                return !behavior.startsWith('veto')
            }
        }
    }

    writePathCalls(): WritePathCalls {
        return { ...this.writePathHookCalls }
    }

    deleteContexts(): RecordedDeleteContext[] {
        return this.seenDeleteContexts
    }

    removedIds(): { nodes: string[]; edges: string[]; notes: string[] } {
        return this.removed
    }

    nodeChanges(): RecordedDataChange[] {
        return this.recordedNodeChanges
    }

    edgeChanges(): RecordedDataChange[] {
        return this.recordedEdgeChanges
    }

    edgeLabel(id: string): { text: string; x: number; y: number } | null {
        const label = this.g.getMutableEdge(id)?.getGraphElement()?.querySelector('text.pvt-edge-label')
        if (!label) return null
        // Where it is actually drawn: a label the renderer never positioned sits at the
        // group origin, not on its edge.
        const box = (label as SVGGraphicsElement).getBoundingClientRect()
        return { text: label.textContent ?? '', x: box.x + box.width / 2, y: box.y + box.height / 2 }
    }

    async requestDelete(spec: DeleteRequestSpec): Promise<RecordedDeleteOutcome> {
        const outcome = await this.g.editing.requestDelete({
            nodes: (spec.nodes ?? []).map((id) => this.g.getMutableNode(id)).filter((n): n is Node => Boolean(n)),
            edges: (spec.edges ?? []).map((id) => this.g.getMutableEdge(id)).filter((e): e is Edge => Boolean(e)),
            notes: (spec.notes ?? []).map((id) => this.g.noteManager.getNote(id)).filter((n): n is Note => Boolean(n)),
            origin: spec.origin ?? 'bulk-action',
        })
        return {
            accepted: outcome.accepted,
            nodes: outcome.nodes.map((node) => node.id),
            edges: outcome.edges.map((edge) => edge.id),
            notes: outcome.notes.map((note) => note.id),
        }
    }

    /**
     * Fire two delete requests back-to-back *within one page task*, so the second
     * genuinely lands while the first is still deciding — the pending-lock case.
     */
    async raceDeleteRequests(first: DeleteRequestSpec, second: DeleteRequestSpec): Promise<RecordedDeleteOutcome[]> {
        const a = this.requestDelete(first)
        const b = this.requestDelete(second)
        return [await a, await b]
    }

    edgePoint(id: string): { x: number; y: number } | null {
        const path = this.g.getMutableEdge(id)?.getGraphElement()?.querySelector('path')
        if (!path) return null
        // Sample the *rendered* path, so the point is on the line whether it's drawn
        // straight or curved, then map it into viewport space for a real pointer event.
        const line = path as SVGPathElement
        const point = line.getPointAtLength(line.getTotalLength() / 2)
        const ctm = line.getScreenCTM()
        if (!ctm) return null
        return { x: point.x * ctm.a + point.y * ctm.c + ctm.e, y: point.x * ctm.b + point.y * ctm.d + ctm.f }
    }

    graphRemoveNode(id: string): void {
        this.g.removeNode(id)
    }

    graphRemoveEdge(id: string): void {
        this.g.removeEdge(id)
    }

    openEdgeSession(id: string): void {
        const edge = this.g.getMutableEdge(id)
        if (edge) this.g.editing.openEdgeSession(edge)
    }

    edgeData(id: string): Record<string, unknown> | null {
        const edge = this.g.getMutableEdge(id)
        return edge ? ({ ...edge.getData() } as Record<string, unknown>) : null
    }

    nodeData(id: string): Record<string, unknown> | null {
        const node = this.g.getMutableNode(id)
        return node ? ({ ...node.getData() } as Record<string, unknown>) : null
    }

    noteIds(): string[] {
        return this.g.noteManager.getNotes().map((note) => note.id)
    }

    /**
     * Run a content hook: count the call, then either answer straight away or —
     * for a hook the spec listed as async — hand back a promise this holds open
     * until the test settles it.
     */
    private hookContent<T>(
        hook: AsyncHook,
        elementKey: string,
        ctx: RenderContext,
        build: (text: string) => T,
    ): T | Promise<T> {
        this.asyncCalls.set(hook, (this.asyncCalls.get(hook) ?? 0) + 1)

        if (!this.asyncSpec.hooks?.includes(hook)) return build(`sync ${hook} · ${elementKey}`)
        return this.holdRender(hook, elementKey, ctx).then(build)
    }

    /** Park a render under `<hook>:<element>` until the test settles or fails it. */
    private holdRender(hook: AsyncHook, elementKey: string, ctx: RenderContext): Promise<string> {
        const key = `${hook}:${elementKey}`
        return new Promise<string>((resolve, reject) => {
            // `signal` is read now, as a consumer forwarding it to `fetch` would —
            // so a later abort is observable even for a render nobody polls.
            this.heldRenders.set(key, { resolve, reject, signal: ctx.signal, isStale: () => ctx.isStale() })
        })
    }

    enableLasso(): void {
        this.g.renderer.toggleLassoMode(true)
        // Mirror the toolbar's two guards while the lasso is active:
        //  - cancel canvas panning, so a plain left-drag draws the polygon, and
        //  - cancel the canvas click that fires on release (it would otherwise
        //    `unselectAll`, wiping the nodes the lasso just selected — the selection
        //    box escapes this because it `preventDefault()`s its mousedown).
        const interaction = this.g.renderer.getGraphInteraction()
        interaction.on('canvasBeforeZoom', this.cancelPan)
        interaction.on('canvasClick', this.cancelClick)
    }

    /** Cancels canvas pan/zoom for drag gestures (kept for wheel + middle-button). */
    private cancelPan = (event: unknown, context: GraphInteractionContext): void => {
        const e = event as { type?: string; button?: number }
        if (e.type === 'wheel' || e.button === 1) return
        context.cancel()
    }

    /** Cancels the canvas click (so a lasso/box release doesn't deselect). */
    private cancelClick = (_event: unknown, context: GraphInteractionContext): void => {
        context.cancel()
    }

    /* ---------- auto physics ---------- */

    /** Reheats since the last `loadAuto` — the calm policy is a claim about this number. */
    private reheats = 0

    async loadAuto(spec: AutoFixtureSpec, overrides: PlainObject = {}): Promise<void> {
        // Auto only means anything with the simulation actually running, so these
        // fixtures override the suite-wide `enabled: false` / `physics: 'manual'` pin.
        // The worker stays off: it would compute the opening layout on a second thread
        // and the test could not observe the tune that produced it.
        await this.bootData(buildAutoFixture(spec), mergeOptions(BASE_OPTIONS, mergeOptions(
            { simulation: { enabled: true, useWorker: false, physics: 'auto' } },
            overrides,
        )))
        this.countReheats()
    }

    /**
     * Boot an auto fixture with a *raw* simulation config — including the absence of
     * `physics`, which is the whole point: auto's default-on rule is decided from
     * which keys the consumer set, so the suite-wide `physics: 'manual'` pin has to
     * be removed rather than overridden for that rule to be observable at all.
     */
    async loadAutoWithConfig(spec: AutoFixtureSpec, simulation: PlainObject = {}): Promise<void> {
        const options = mergeOptions(BASE_OPTIONS, {
            simulation: { enabled: true, useWorker: false, ...simulation },
        }) as { simulation: PlainObject }
        if (!('physics' in simulation)) delete options.simulation.physics
        await this.bootData(buildAutoFixture(spec), options)
        this.countReheats()
    }

    /**
     * Count every reheat from here on. The simulation has no reheat event, and
     * adding one just for a test would be a production API nobody asked for — so
     * the test wraps the public method instead.
     */
    private countReheats(): void {
        this.reheats = 0
        const sim = this.g.simulation as unknown as { reheat: (alpha?: number) => void }
        const original = sim.reheat.bind(sim)
        sim.reheat = (alpha?: number) => {
            this.reheats++
            original(alpha)
        }
    }

    resetReheatCount(): void {
        this.reheats = 0
    }

    simulationRunning(): boolean {
        return (this.g.simulation as unknown as { engineRunning: boolean }).engineRunning
    }

    simulationAlpha(): number {
        return (this.g.simulation as unknown as { simulation: { alpha(): number } }).simulation.alpha()
    }

    reheatCount(): number {
        return this.reheats
    }

    /**
     * Add `count` nodes to an auto graph, chained onto the last node already there —
     * growth by insertion, as a pivot would produce, rather than a reload.
     */
    growAuto(count: number, radius: number): void {
        const existing = this.g.getNodeCount()
        const prefix = `g${existing}_`
        const { nodes: added } = buildAutoFixture({ nodes: count, radius, prefix })

        const anchor = this.g.getMutableNodes().filter((node) => node.visible).pop()
        const addedEdges: EdgeInstance[] = []
        added.forEach((node, index) => {
            const previous = index === 0 ? anchor : added[index - 1]
            if (previous) addedEdges.push(new EdgeInstance(`${prefix}e${index}`, previous, node))
        })
        this.g.updateData(added, addedEdges)
    }

    /**
     * Everything the auto acceptance criteria are stated in terms of, measured off
     * the live graph: what auto chose, what the layout actually looks like at zoom 1,
     * and what the camera then made of it.
     */
    autoState(): AutoState {
        const sim = this.g.simulation
        const run = sim.getAutoRun()
        const canvasEl = this.g.renderer.getCanvas()
        const box = canvasEl?.getBoundingClientRect()
        const canvas = { width: box?.width ?? 0, height: box?.height ?? 0 }
        const nodes = this.g.getMutableNodes()
            .filter((node) => node.visible)
            .map((node) => ({ x: node.x, y: node.y, radius: node.getCircleRadius() }))
        const measured = measureLayout(nodes, canvas)
        // getZoomTransform lives on the SVG renderer, not the abstract interface.
        const renderer = this.g.renderer as unknown as { getZoomTransform?: () => { k: number } }
        const zoom = renderer.getZoomTransform?.().k ?? 1

        return {
            auto: sim.isAutoPhysicsEnabled(),
            skipped: run?.skipped ?? false,
            tunedNodeCount: run?.context.nodeCount ?? -1,
            knobs: sim.getPhysicsKnobs(),
            enabled: sim.isEnabled(),
            nodeCount: nodes.length,
            canvas,
            measured,
            zoom,
            // What the viewer ends up seeing: the layout's linear fill, scaled by the
            // camera fit. This — not the raw fill — is what "covers ~80%" means.
            coverage: measured.fill * zoom,
        }
    }
}

/** {@link HarnessApi.autoState}'s return shape. */
export interface AutoState {
    auto: boolean
    skipped: boolean
    /** Node count the last tune actually saw — tells "auto has not looked yet" from "auto looked and left it alone". */
    tunedNodeCount: number
    knobs: PhysicsKnobs
    enabled: boolean
    nodeCount: number
    canvas: { width: number; height: number }
    measured: MeasuredLayout
    zoom: number
    coverage: number
}

declare global {
    interface Window {
        __pivotick: HarnessApi
    }
}

const app = document.getElementById('app')
if (!app) throw new Error('#app container not found')
window.__pivotick = new Harness(app)
