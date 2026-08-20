# Feature — Table mode: the graph's data as a sortable, selectable grid

**Status:** Proposed
**Owner:** Sami Mokaddem
**Requested:** 2026-08-20
**Area:** `src/ui/elements/Table/` (new), `src/ui/elements/Layout.ts` + `src/styles/_layout.scss` (new dock slot + grid row), `src/ui/UIManager.ts` (`UI_ELEMENTS` row, `UI_ELEMENTS` gating), `src/ui/ModeStore.ts` (view-toggle state), `src/ui/elements/ModeRail/ModeRail.ts` (the slot), `src/interfaces/GraphUI.ts` (`TableOptions`), `src/GraphQueryEngine.ts` (`getHiddenNodes`), `src/Graph.ts` (open/close API), `docs/ui-table.md` + a gallery card (new)
**Type:** Core view mode (read-only, v1)
**Related:** [`filterable-legend.md`](filterable-legend.md) (the "one filter model, a second would fight it" ruling in §3.3, and the three-tier declared/derived/off resolution this copies); [`minimap-plugin.md`](minimap-plugin.md) (`getMutable*` over `get*`, the cached-rebuild + `ResizeObserver` pattern); [`graph-app-b3-control-layout.md`](graph-app-b3-control-layout.md) (the rail taxonomy this has to fit into); `misp/selection-api-by-identity.md` (**hard dependency** — see §3.6); `misp/declarative-filter-facets.md` (`FilterFacet`, which is already a column spec — §5.2); `misp/runtime-sidebar-panels.md` (the multi-event re-render coalescing lesson — §5.7)

---

## 0. Instructions

Relentlessly ask me questions whenever you have a doubt on the implementation.

## 1. What we're trying to achieve

Give the graph a **second view of the same data**: a sortable, scannable, selectable grid
docked under the canvas, so that finding a node stops being a hunt through a hairball.

A force layout is structurally bad at three things, and they are all things people do
constantly:

1. **Read exact values.** Labels overlap, truncate, or disappear at low zoom. There is no
   way to answer "what is `severity` across these 300 nodes" by looking at the canvas.
2. **Select at scale.** `BulkActions` (`ui/elements/Sidebar/BulkActions.ts:63-73`) already
   ships Pin / Unpin / Hide / Delete over the live multi-selection — but the only
   instrument for *building* that selection is a rubber band or a lasso dragged across
   overlapping circles. Sorting by degree and shift-clicking 40 rows is a different league.
3. **Find the entry point.** "Where do I start?" is answered by sorting: highest degree →
   the hubs; newest first → the recent arrivals. Then one click flies the canvas there.

The intended loop is **table to find, canvas to understand, sidebar to read** — three
coordinated views over one selection.

### Explicitly out of scope (v1)

- **Any writing.** No inline cell editing, no bulk edit, no delete-from-table. Read-only.
  (`BulkActions` keeps owning mutation; the table only builds the selection it acts on.)
- **Column reordering / resizing by drag, pinned columns, column groups.** Declared order
  and declared widths only.
- **Grouped or aggregated rows** (group-by-type with counts). Tempting, and it overlaps
  the legend's job — defer until someone asks.
- **A table-local search box.** See §5.6: there is one filter model, and the Mainheader
  already owns find-a-node.
- **`viewer` and `static` modes.** Both promise no chrome; a dock is chrome.

## 2. What professional tools do

- **Gephi** — the Data Laboratory is a first-class tab beside the graph, with a node table
  and an edge table, and it is where most real work happens. The strongest precedent for
  "the table is not a report, it is a working surface".
- **Maltego** — the Entity List view sits beside the graph view over the same selection;
  selecting in one selects in the other. Its whole value is that it never diverges.
- **Neo4j Browser** — result grid / table / graph toggles over one query result. Table is
  the default, graph the opt-in, which says something about which one people can read.
- **Kibana / OpenSearch graph** — the graph is the summary, the table is the truth; the
  table is where you export from.
- **Linkurious** — a bottom-docked resizable results grid under the canvas, click-to-focus.
  Closest to the placement proposed here.
- **Cytoscape (desktop)** — Node Table / Edge Table / Network Table panels, bottom-docked,
  with per-column filters that drive the network's visibility. Also the precedent for
  column filters and graph filters being the same mechanism.

The consistent shape across all of them: **bottom or side dock, node table and edge table
as separate tabs, selection shared with the graph, export lives here.** Nobody makes it a
modal, and nobody gives the table its own private filter.

## 3. Gap in Pivotick today

### 3.1 There is no table, and no export of any kind

Nothing in `src/` renders tabular data (the only `table` hits are unrelated identifiers),
and nothing anywhere produces a CSV, a JSON dump, or a download. `JsonViewer` shows one
element's data; `PropertyList` shows one element's key/values. There is no surface that
shows *a set*.

### 3.2 The hidden set is a dead number, and there is no API to list it

`GraphFilter` reports a hidden count (`GraphFilter.ts:161,196`) and the query engine backs
it with `getHiddenNodeCount()` — but the only *listing* accessor is
`getExcludedNodes()`, which returns **manual exclusions only**. There is no
`getHiddenNodes()`.

So "23 nodes hidden" is currently a claim the user cannot inspect. A Hidden tab is the
natural place to fix that, and it needs a new accessor (§5.3).

The complement cannot be computed correctly by a consumer either:
`getMutableVisibleNodes()` is `getMutableNodes().filter(n => n.visible)` (`Graph.ts:933`),
and `getMutableNodes()` includes collapsed clusters' children — the same caveat
`filterable-legend.md` §7.2 records for counts. A naive
`getMutableNodes() − getMutableVisibleNodes()` therefore over-reports, listing
cluster children that were never filtered out at all.

### 3.3 Bulk actions exist; the instrument to drive them does not

`BulkActions` runs over `getSelectedNodes()` and already has `isolate`, `group`, `ungroup`
and `bulk-edit` sitting there as disabled `SOON` slots. Its functional actions are only as
useful as the selection someone can build, and today that means a drag on the canvas.

### 3.4 The layout has no room below the canvas

`Layout` (`ui/elements/Layout.ts`) creates ten slots — `canvas`, `sidebar`, `mainheader`,
`modal`, `slidePanel`, `graphnavigation`, `moderail`, `toolpanel`, `flyout`, `legend` — and
every one of them is either a grid area or absolutely positioned *inside* `.pvt-canvas`.
The grid itself is a single row:

```scss
grid-template-columns: auto 1fr;
grid-template-rows: minmax(0, 1fr);
grid-template-areas: "sidebar canvas";
```

There is no dock. A canvas-overlay table (the minimap's approach) would need zero core
changes, but it would also fight for the bottom corners the legend (`bottom: 44px` in full
mode) and the minimap (`bottom-right` by default) already hold — the corner-scarcity
problem `filterable-legend.md` §3.4 inventories. **A real grid row avoids that entirely:
both are positioned relative to `.pvt-canvas`, so when the canvas shrinks they ride up with
it.** That is the argument for a core dock over a plugin overlay, and it is why this is
specced as a core view mode.

### 3.5 The rail has one taxonomy, and Table does not fit it

`RailMode = PointerMode | FlyoutMode` (`ui/ModeStore.ts:6-19`), and the modes are
documented as **mutually exclusive** — `ModeStore.mode` is always exactly one of them, and
opening a flyout deactivates Select/Create.

If Table becomes a `RailMode`, then opening the table deactivates Select — and the canvas,
which is still fully visible and fully interactive in a split view, is left with no pointer
mode. That is wrong. **Table is a persistent view toggle, orthogonal to `mode`, not a
fifth mode.** §5.4 proposes how it lives in the rail's DATA zone anyway.

### 3.6 Writing the selection still needs a renderer handle — this is a blocker

Row-click → select is the feature's spine, and the write half of the selection API still
takes a renderer element first: `selectNode(element, node)`, `selectNodes(NodeSelection[])`
(`GraphInteractions.ts:476,573`), with `getGraphInteraction()` declared
`GraphInteractions<unknown>`.

`misp/selection-api-by-identity.md` is the fix, and it is still **Proposed**. The
workaround — having the table read `node.getGraphElement()` and pass that — puts an
SVG-only path inside a *core* UI element, which is exactly the leak
`renderer-abstraction-audit.md` F9 exists to kill.

**Therefore: Table mode lands after, or in the same push as, the identity selection API.**
This is the one hard sequencing constraint in this PRD.

## 4. Decisions needed (for the grilling session)

- **D1** — Rail slot, Mainheader button, or both? (§5.4 recommends the rail's DATA zone,
  modelled as a toggle.) The Mainheader is arguably more consistent: Search, Filter and
  Notes are all persistent data surfaces toggled from there.
- **D2** — On open/resize, does the canvas re-fit (`fitAndCenter`) or hold its viewport?
  (Recommendation: hold. A re-fit mid-inspection is jarring, and the navigation widget
  already has a fit button.)
- **D3** — Does zero-config derivation inject a `degree` column? (Recommendation: yes. It
  is the one column that makes the table useful on first open with no config.)
- **D4** — Do column header filters write to the shared query engine (so the canvas filters
  too), or filter the table only? (Recommendation: shared, per §5.6. But it means typing in
  the table changes what the graph shows, which will surprise some people.)
- **D5** — Default height, and does it persist across a reload? (Recommendation: 35% of the
  canvas, no persistence in v1.)
- **D6** — `light` mode as well as `full`? `light` has no sidebar, so the row→properties
  half of the loop is missing, but the table itself still works. (Recommendation: both.)
- **D7** — Edge rows in v1, or nodes only? (Recommendation: both. Edges are the thing the
  canvas communicates *worst* beyond raw topology, and the incremental cost after the node
  table exists is small.)
- **D8** — What to do about the canvas rect leaking into the physics (§5.4.1)? Accept that
  re-layouts after opening differ, refresh the snapshot and accept a lurch on toggle, or fix
  the underlying leak in a separate PRD. (Recommendation: accept, and file the fix
  separately.)

## 5. Proposal

### 5.1 Config

```ts
interface GraphUI {
    /**
     * The bottom data dock: the graph's nodes and edges as a sortable grid.
     * `full` and `light` only. Omit or `false` for no dock; `true` accepts the
     * defaults; an object configures it.
     */
    table?: TableOptions | boolean,
}

interface TableOptions {
    enabled?: boolean
    /** Which tabs to offer, in order. @default ['nodes', 'edges'] */
    tabs?: Array<'nodes' | 'edges' | 'hidden'>
    /** Node columns. Omitted → derived; see §5.2. */
    columns?: TableColumn[]
    /** Edge columns. Omitted → derived. */
    edgeColumns?: TableColumn[]
    /** Open on boot. @default false */
    open?: boolean
    /** Dock height: px, or a 0–1 fraction of the canvas. @default 0.35 */
    height?: number
    /** Initial sort. @default the first sortable column, ascending */
    sort?: { key: string, direction: 'asc' | 'desc' }
    /** What a single row click does. @default 'select' */
    rowActivate?: 'select' | 'selectAndCenter' | 'none'
    /** Export buttons in the dock header. @default ['csv', 'json'], `false` to hide */
    export?: Array<'csv' | 'json'> | false
    /** Row count above which rows are windowed. @default 200 */
    virtualizeAbove?: number
}
```

### 5.2 Columns are facets

`FilterFacet` (`interfaces/GraphQueryEngine.ts`) is **already a column spec**: `key`,
`label`, `type` (`text | regex | select | multiselect | numberRange | boolean`),
`accessor: (node) => unknown`, `order`. It even already has both a declared mode and a
scan-the-data derived mode (`GraphFilter.ts:275,326`).

So `TableColumn` extends it rather than competing with it:

```ts
interface TableColumn extends Pick<FilterFacet, 'key' | 'label' | 'type' | 'accessor' | 'order'> {
    /** Column width: px or any CSS length. @default content-driven */
    width?: number | string
    /** @default 'right' for numberRange, 'left' otherwise */
    align?: 'left' | 'right' | 'center'
    /** @default true */
    sortable?: boolean
    /** Give this column a filter control in its header (see §5.6). @default false */
    filterable?: boolean
    /** Render the cell. A string is text; an HTMLElement is inserted. @default String(value) */
    format?: (value: unknown, element: Node | Edge) => string | HTMLElement
}
```

**Three-tier resolution**, mirroring the legend's declared/derived/off precedent:

1. **Declared** — `UI.table.columns` wins.
2. **Derived from facets** — else, if `UI.filter.facets` is declared, build columns from
   them. *Declare your data shape once and the filter panel and the table agree*, which is
   the whole payoff of unifying the types.
3. **Derived from data** — else scan node data exactly as `GraphFilter.derivedFields()`
   does, so the zero-config case works on first open.

**Graph-aware columns** are the ones no generic grid can compute, and they ship as
library-provided facets the consumer composes — no sigils, tree-shakeable, discoverable:

```js
import { Pivotick, tableColumns } from 'pivotick'

UI: { table: { columns: [
    tableColumns.label,
    tableColumns.degree,       // node.degree()
    tableColumns.degreeIn,     // node.getEdgesIn().length
    tableColumns.degreeOut,
    tableColumns.pinned,       // fx/fy set
    tableColumns.cluster,      // parent / cluster membership
    { key: 'severity', type: 'select', filterable: true },
] } }
```

Each is just a `TableColumn` with a library accessor, so a consumer can clone and tweak one
(`{ ...tableColumns.degree, label: 'Links' }`) without the library needing a hook for it.

### 5.3 Rows and tabs

| Tab | Source | Default columns |
|---|---|---|
| **Nodes** | `graph.getMutableVisibleNodes()` | id, label, degree, then derived data keys |
| **Edges** | `graph.getMutableVisibleEdges()` | source, label, target, then derived data keys |
| **Hidden** | new `queryEngine.getHiddenNodes()` | label, **why**, then derived data keys |

`getMutable*`, never `get*` — `getNodes()` clones every node (the `minimap-plugin.md` §D3
lesson).

**New API, needed by the Hidden tab** (§3.2):

```ts
/**
 * Every node currently hidden, and why. Manual exclusions (`excludeNode`) plus
 * nodes a filter is suppressing — excluding collapsed clusters' children, which
 * are invisible for structural reasons rather than filtered out.
 */
getHiddenNodes(): Array<{ node: Node, reason: 'excluded' | 'filtered', filterKey?: string }>
```

`filterKey` is the payoff: "hidden by the `severity` filter" is actionable, "hidden" is not.
It means the filter application has to record *which* facet rejected each node — cheap if
captured during the existing per-node pass, and it also gives `GraphFilter` a better
tooltip for free.

### 5.4 Placement, DOM, and the toggle

A new `table` slot as a **second grid row spanning the canvas column only**, so the sidebar
stays full-height and keeps showing the selected row's properties and neighbours:

```scss
.pvt-layout {
    --pvt-table-height: 0px;

    grid-template-columns: auto 1fr;
    grid-template-rows: minmax(0, 1fr) var(--pvt-table-height);
    grid-template-areas:
        "sidebar canvas"
        "sidebar table";
}
```

Closed is `--pvt-table-height: 0px` — no second element, no layout shift, one transition.
A drag handle on the dock's top edge writes the variable (clamped to, say, 120px–80% of the
canvas). `Layout.onMount` creates the slot in `full` and `light` only, and `UI_ELEMENTS`
gets one row (`key: 'table', modes: ['full','light'], enabled: o => tableWanted(o.table)`) —
"adding a new built-in element is a single row here", per the catalog's own docstring.

**Consequences of shrinking the canvas, checked:**

- The SVG is `width/height: 100%` (`GraphSvgRenderer.ts:102`), so it reflows for free.
- Bottom-docked canvas chrome (legend, minimap) is positioned inside `.pvt-canvas` and rides
  up with it. No corner collision (§3.4).
- Anything cached against canvas size must invalidate. The minimap already has a
  `ResizeObserver` on the canvas (`Minimap.ts:169`), so it self-heals; that is the pattern
  for anything new.
- **The simulation does read the canvas size, in three places — see §5.4.1.** This is the
  one non-obvious consequence, and the dock must decide what to do about it.

#### 5.4.1 The canvas rect leaks into the physics

`Simulation` reads the canvas `getBoundingClientRect()` and feeds *pixel* dimensions into
forces that live in *graph* coordinates:

| Site | What it uses the rect for |
|---|---|
| `initSimulationForceGravity` (`Simulation.ts:229-231`) | the gravity force's centre is `width/2, height/2` |
| `scaleSimulationOptions` (`:393-394`) | `density = nodeCount / (width × height)` — the auto-physics tuning |
| `computeGraph` (`:576`) and `runSimulationWorker` (`:618`) | passes the rect into each layout pass / the worker |

The saving grace is that `this.canvasBCR` is captured **once in the constructor** (`:151`)
and never refreshed. So:

- **Opening the dock does not disturb the running simulation** — the live gravity force and
  the scaled options keep their boot-time centre. Good: the graph does not lurch when the
  dock opens.
- **But the next re-layout does pick up the new size.** `computeGraph` /
  `runSimulationWorker` re-read the rect fresh, so any re-layout after the dock is opened
  (a physics preset click, a layout switch, `reheat`) centres gravity on the *shorter*
  canvas and computes a *denser* graph. The layout will visibly differ from the same action
  taken with the dock closed.
- **This is pre-existing, not new.** Collapsing the sidebar and resizing the window already
  change the canvas rect the same way; the stale `canvasBCR` snapshot is a latent
  inconsistency the dock merely makes easy to hit and easy to see.

Decision needed (**D8**): does the dock (a) leave it alone and accept that re-layouts after
opening differ, (b) refresh `canvasBCR` on canvas resize so *live* forces and re-layouts
agree — which means the gravity centre shifts and the graph drifts when the dock opens, or
(c) fix the underlying leak, so gravity centres on the *content* rather than on a pixel
rect, and density is computed against a graph-coordinate area.

Recommendation: **(a) for this PRD, and file (c) separately.** (b) trades a rare
inconsistency for a visible lurch on every dock toggle, and (c) is a real physics change
that deserves its own spec and its own before/after screenshots — it is not something to
smuggle in under a table feature.

**The toggle** (§3.5) is state on `ModeStore`, orthogonal to `mode`:

```ts
interface ModeState {
    mode: RailMode
    armedTool: Record<PointerMode, string | null>
    panelOpen: Record<PointerMode, boolean>
    /** Whether the bottom data dock is open. Independent of `mode`. */
    tableOpen: boolean
    /** Which tab the dock is showing. */
    tableTab: 'nodes' | 'edges' | 'hidden'
}
```

with `toggleTable()` / `setTableOpen(open)` / `setTableTab(tab)`, all idempotent and
notifying like the rest of the store.

Visually it takes the rail's **DATA zone** — the divider and the slot pattern that
`UI.modeRail.explore` / `.enrich` already establish, which is exactly where a data-zone
mode was meant to go. It renders as a *pressed toggle* (`aria-pressed`), not an exclusive
mode highlight; the rail already does non-uniform slot behaviour (Select/Create are
split-buttons), so this is not a foreign grammar. Keybinding `T`, matching V/C.

### 5.5 Selection sync

The table is a selection instrument, so this is the part that has to be exactly right.

**Table → graph** (needs §3.6's identity API):

| Gesture | Effect |
|---|---|
| Click row | `selectNode(node)` — replaces the selection |
| Ctrl/Cmd-click | add / remove that row from the multi-selection |
| Shift-click | range from the last clicked row, in *current sort order* |
| Header checkbox | select every row in the current tab (post-filter, post-sort) |
| Double-click row | select **and** centre the canvas on it |
| Hover row | canvas hover highlight, as if hovering the node |

**Graph → table**: subscribe to `selectNode` / `selectNodes` / `unselectNode` /
`unselectNodes`, mark the matching rows, and scroll the first one into view. Rubber-band 40
nodes on the canvas and the table shows you what you caught — which is the same feature read
in the other direction, and worth more than it sounds.

Rows are keyed by `node.id` / `edge.id`, so re-render never loses the selection.

**Hover sync is windowed-only** — with 10k rows, only the ~40 rendered rows can emit hover,
so this costs nothing.

### 5.6 Filter coupling: one model, not two

A column with `filterable: true` gets a header control typed off its facet `type`, and it
writes `queryEngine.setFilter(key, …)`. **Consequence, stated plainly: filtering from the
table hides nodes on the canvas too.**

That is deliberate. `filterable-legend.md` §3.3 already ruled that filtering exists and a
second mechanism would fight it, and the same ruling applies with more force here — a table
with a private notion of "shown" would silently disagree with the canvas, the hidden count,
and the legend. Cytoscape's data panel works this way for the same reason.

The corollary: **no table-local search box.** The Mainheader's Search already does
find-a-node, and a second text input that means something subtly different is exactly the
trap. *Sorting*, by contrast, is table-only and affects nothing else — which is why sort is
the table's own state and filter is not.

If D4 goes the other way, the honest version is a visible "table only" badge on the header
controls, not a silent divergence.

### 5.7 Re-render, coalesced

The dock rebuilds on: `dataBatchChanged`, `nodeAdd/Remove/Change`, `edgeAdd/Remove/Change`,
the query engine's `filterAdd/Remove/Change/Reset`, and `simulationSlowTick` **only** if a
column depends on position (none do by default — so normally not at all, unlike the
minimap).

All of it **coalesced into one `requestAnimationFrame`**. This is the
`misp/runtime-sidebar-panels.md` lesson: a single user action fires several of these events,
and rebuilding per event is both visibly janky and a good way to lose scroll position. One
dirty flag, one rebuild, scroll offset and selection preserved across it.

### 5.8 Export

Two buttons in the dock header, exporting **exactly what you are looking at**: the current
tab, the current columns in their current order, the current sort, the current filter. Not
the whole graph — "export the view" is the semantic people expect from a grid, and the whole
graph is already `graph.getNodes()` away for anyone with code.

`format` is bypassed for CSV (raw values, so the file is machine-readable) but respected for
nothing else; a `format` returning an `HTMLElement` falls back to the raw value. CSV quoting
per RFC 4180.

### 5.9 API

```ts
graph.openTable(tab?: 'nodes' | 'edges' | 'hidden'): void
graph.closeTable(): void
graph.toggleTable(): void
graph.setTableColumns(columns: TableColumn[], target?: 'nodes' | 'edges'): void
graph.getTableState(): Readonly<{ open: boolean, tab: string, sort: { key: string, direction: 'asc' | 'desc' } }>
```

No new event bus. The dock's state changes are observable through `ModeStore.subscribe`, and
everything interesting it does to the graph already emits on the selection or filter buses.

### 5.10 Scale

Fixed-height rows, windowed above `virtualizeAbove` (default 200): render the visible rows
plus an overscan margin, absolutely positioned inside a spacer of
`rowCount × rowHeight`. Fixed height means no measurement pass, and staying on plain DOM
under the threshold keeps the small case debuggable — and screenshot-testable without
scroll choreography.

Sorting happens on the row array, never on the DOM. Accessors run once per row per rebuild,
and the facet contract already says "keep it cheap"; the same warn-once-per-broken-facet
handling the query engine has (`brokenFacets`) should cover a throwing column accessor.

## 6. What the integrator does

Zero config, in `full` mode — a Table slot appears in the rail; press `T`:

```js
new Pivotick(el, data, { UI: { mode: 'full' } })
```

Declared columns, sharing the facet declaration with the filter panel:

```js
import { Pivotick, tableColumns } from 'pivotick'

const facets = [
    { key: 'type', label: 'Type', type: 'select', options: TYPES },
    { key: 'severity', label: 'Severity', type: 'numberRange' },
]

new Pivotick(el, data, {
    UI: {
        mode: 'full',
        filter: { facets },
        table: {
            open: true,
            height: 0.4,
            sort: { key: 'degree', direction: 'desc' },
            columns: [
                tableColumns.label,
                tableColumns.degree,
                ...facets.map(f => ({ ...f, filterable: true })),
            ],
        },
    },
})
```

Driving it programmatically:

```js
graph.openTable('hidden')          // "why is nothing showing?"
graph.on('ready', () => graph.openTable())
```

## 7. Open questions / risks

- **R1 — the identity-selection dependency (§3.6).** The one thing that can block this.
  Either land `selection-api-by-identity.md` first, or accept a `getGraphElement()`
  workaround inside a core element and a new entry on the abstraction audit's debt list.
- **R2 — sidebar + dock together is a lot of chrome.** In `full` mode with a 340px sidebar
  and a 40% dock, the canvas is a third of the container. Mitigation: the sidebar already
  collapses, and the dock is resizable — but the default height wants real judgement on a
  laptop screen, not a guess.
- **R3 — CSV download inside a sandboxed iframe.** The docs gallery embeds examples in
  iframes, and a `<a download>` blob may be blocked there, making a shipped feature look
  broken in the one place people try it. Check before writing the gallery card; fall back to
  a copy-to-clipboard button in the embed if so.
- **R4 — a table is a screenshot-test liability.** Row order under equal sort keys, and
  virtualized scroll position, are both non-deterministic-looking. Every visual test needs a
  deterministic dataset with unique sort keys, and should assert under the threshold (plain
  DOM) unless it is specifically the virtualization test.
- **R5 — `getHiddenNodes()` needs the filter pass to record a reason.** Cheap if captured in
  the existing per-node loop, but it touches `applyFilters`, which is hot. Measure on a 10k
  graph before committing to the `filterKey` detail; degrade to `reason` alone if it costs.
- **R6 — column derivation on heterogeneous data.** A graph whose nodes have disjoint data
  keys derives a very wide table of mostly-empty columns. `GraphFilter.derivedFields()`
  already has this problem in a narrower panel; a coverage threshold ("only keys present on
  ≥N% of nodes") may be needed, and would benefit the filter panel too.
- **R7 — is the dock the right place for the edge table?** Edges outnumber nodes, and an
  edge table is mostly about pairs. Worth a look at whether it wants different default
  columns per tab, or its own sort memory.

## 8. Acceptance criteria

1. `full` and `light` modes show a Table slot in the rail's DATA zone; `T` toggles the dock;
   `viewer` and `static` are unchanged.
2. Opening the dock shrinks the canvas without moving the graph content relative to the
   viewport's top-left, and **without the running simulation reacting at all** (§5.4.1 —
   node positions must be byte-identical across a dock toggle with physics running). Legend
   and minimap ride up with the canvas and stay fully visible.
3. Zero config on a graph with mixed node data renders a usable table: id, label, degree,
   and the derived data columns.
4. Declaring `UI.filter.facets` with no `UI.table.columns` produces a table whose columns
   match the filter panel's controls.
5. Click / Ctrl-click / Shift-click / header-checkbox build the same selection state that
   canvas gestures do, and `BulkActions` acts on it unmodified.
6. Selecting on the canvas marks and scrolls to the rows; selecting rows highlights on the
   canvas. Neither direction loops or double-fires.
7. A header filter control changes the canvas's visible nodes and the hidden count — one
   filter model.
8. The Hidden tab lists every hidden node with a reason, the count agrees with
   `GraphFilter`, and collapsed clusters' children are **not** listed.
9. CSV and JSON export the current tab / columns / sort / filter, and round-trip through a
   spreadsheet without quoting damage.
10. 10k nodes: opening the dock, sorting, and scrolling stay interactive; a rebuild
    preserves scroll offset and selection.
11. `tsc`, `eslint`, `npm run build` and `vitepress build docs` clean; a
    `tests/visual/specs/table.spec.ts` suite green alongside `ui-chrome` and `mode-rail`.

## 9. Work plan

1. **Unblock** — land `selection-api-by-identity.md` (or scope the minimum of it that
   `selectNode(node)` / `selectNodes(nodes)` needs). §3.6, R1.
2. **`getHiddenNodes()`** — the reason-recording filter pass, plus a `GraphFilter` tooltip
   that uses it. Independently useful; ships first and stands alone. §5.3, R5.
3. **Dock scaffold** — `Layout` slot, the grid row, `--pvt-table-height`, drag-to-resize,
   `UI_ELEMENTS` row, `ModeStore.tableOpen/tableTab`, rail slot, `T`. Renders an empty dock.
   **Verify AC 2 here, before any rows exist** — an empty dock is the cleanest place to
   settle D8 and prove the physics does not react (§5.4.1). Toggle it with the simulation
   running on a 500-node graph and diff node positions; then click a physics preset with the
   dock open and with it closed, and record whether the layouts differ.
4. **Column model** — `TableColumn`, the three-tier resolution, `tableColumns.*` built-ins.
   §5.2.
5. **Node table** — header, sort, plain-DOM rows. AC 3, 4.
6. **Selection sync** — both directions, all four gestures. AC 5, 6.
7. **Virtualization** — windowing above the threshold, scroll/selection preservation across
   rebuilds, coalesced re-render. AC 10.
8. **Edge tab and Hidden tab.** AC 8.
9. **Export.** AC 9, R3.
10. **Docs** — `docs/ui-table.md`, a gallery card (`aside: false` + `gallery-wide`, per the
    full-mode card-width lesson), visual tests. AC 11.
