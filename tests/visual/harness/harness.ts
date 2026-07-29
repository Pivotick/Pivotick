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
import { Pivotick, Node } from '../../../src/index'
import { Note } from '../../../src/Note'
import { TreeLayout } from '../../../src/plugins/layout/Tree'
import { EgoTreeLayout } from '../../../src/plugins/layout/EgoTree'
import { createInspectModal } from '../../../src/ui/elements/modals/InspectNodeModal/InspectNodeModal'
import { FormFactory } from '../../../src/utils/FormFactory'
import type {
    FilterFacet, FilterFacetOption, FilterFieldConfig, GraphFilters,
} from '../../../src/interfaces/GraphQueryEngine'
import type { GraphInteractionContext } from '../../../src/interfaces/GraphInteractions'
import type {
    EdgeCreateContext,
    EdgeCreateDecision,
    InterractionCallbacks,
} from '../../../src/interfaces/InterractionCallbacks'
import { fixtures, type FixtureName, type RawNote } from './fixtures'

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

export interface ConnectConfig {
    edgeHook?: EdgeHookBehavior
    validConnection?: ValidConnBehavior
    /** Delay (ms) for the `*-async` behaviours, so a test can observe the pending window. */
    asyncDelayMs?: number
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
    simulation: { enabled: false, useWorker: false },
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

export interface HarnessApi {
    /** Build a graph from a named fixture; resolves once it has finished rendering. */
    load(name: FixtureName, overrides?: PlainObject): Promise<void>
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
    /** Clear all selection. */
    deselectAll(): void
    /** Add a node with a fixed position and stable domID (`#node-<id>`). */
    addNode(id: string, x: number, y: number, label?: string): void
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
     * Ids of the nodes currently visible. A filtered-out node is *removed* from the
     * render, so this is the exact answer to "what did that filter leave on screen".
     */
    visibleNodeIds(): string[]
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

    constructor(container: HTMLElement) {
        this.container = container
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
        this.destroy()
        const data = fixtures[name]()
        // Snapshot the fixture's positions now — the graph mutates these Node
        // instances during its initial layout pass (see `pin()`).
        this.intended = new Map(
            data.nodes
                .filter((n) => typeof n.x === 'number' && typeof n.y === 'number')
                .map((n) => [n.id, { x: n.x as number, y: n.y as number }])
        )
        const options = mergeOptions(BASE_OPTIONS, overrides)
        // `data.notes` carries raw note options; the graph normalises them to Notes.
        const graph = new Pivotick(this.container, data as never, options as never)
        this.graph = graph
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

    deselectAll(): void {
        this.g.deselectAll()
    }

    addNode(id: string, x: number, y: number, label?: string): void {
        const node = new Node(id, { label: label ?? id.toUpperCase() }, {}, id)
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

    visibleNodeIds(): string[] {
        // `childrenDepth === 0` = the nodes of *this* graph, mirroring what the query
        // engine considers visible here (a cluster's children live in its subgraph).
        return this.g.getMutableNodes()
            .filter((node) => node.childrenDepth === 0 && node.visible)
            .map((node) => node.id)
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
}

declare global {
    interface Window {
        __pivotick: HarnessApi
    }
}

const app = document.getElementById('app')
if (!app) throw new Error('#app container not found')
window.__pivotick = new Harness(app)
