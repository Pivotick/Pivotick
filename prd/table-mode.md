# Feature — Table mode: the graph's data as a sortable, selectable grid

**Status:** Implemented — 2026-08-20, branch `worktree-table-mode-prd`. Not merged.
**Owner:** Sami Mokaddem
**Requested:** 2026-08-20
**Area:** `src/ui/elements/Table/` (new), `src/ui/elements/Layout.ts` + `src/styles/_layout.scss` (dock slot + grid row), `src/ui/UIManager.ts` (`UI_ELEMENTS` row), `src/ui/elements/Mainheader/Mainheader.ts` (the toggle pill), `src/interfaces/GraphUI.ts` (`TableOptions`), `src/Graph.ts` (multi-select by identity + open/close API), `src/Simulation.ts` (container measurement), `src/renderers/svg/NodeDrawer.ts` (`applyShadow`), `src/ui/elements/GraphFilter/GraphFilter.ts` → a shared derivation util, `docs/ui-table.md` + a gallery card (new)
**Type:** Core view mode (read-only, v1)
**Related:** [`filterable-legend.md`](filterable-legend.md) (the three-tier declared/derived/off resolution this copies; its "one filter model" ruling is **narrowed** here — see §5.6); [`minimap-plugin.md`](minimap-plugin.md) (`getMutable*` over `get*`; the `collapsed: 'auto'` hysteresis + `userChose` latch this reuses); [`graph-app-b3-control-layout.md`](graph-app-b3-control-layout.md) (the rail taxonomy this deliberately stays out of); `misp/declarative-filter-facets.md` (`FilterFacet`, which is already a column spec — §5.2); `misp/runtime-sidebar-panels.md` (multi-event re-render coalescing — §5.7); `misp/selection-api-by-identity.md` (**desirable, not blocking** — see §3.5)

---

## Implementation (2026-08-20)

`tsc`, `eslint`, `npm run build` and `vitepress build docs` clean; **388 visual tests
green**, including 64 new ones across `physics-container`, `selection-hidden-nodes`,
`table-dock`, `table-grid`, `table-selection`, `table-export` and
`table-virtualization`. Everything in §9 shipped except the deferred items below.

### Verdict on the decisions

All nine held. The two that earned their keep most:

- **D-A (superset) paid for itself twice.** It dissolved the `getHiddenNodes()` API the
  first draft wanted, and it turned "why is nothing showing?" into a sortable column.
- **D-F is what makes the dock safe.** Every other decision assumed the canvas could
  shrink freely; without the container measurement it could not.

### Changed from the spec while building

- **The dock's toggle is the header pill only** (D-I), and `Shift+T` joins Shift+J/K/N.
  The `table` entry has to sit **before** `mainHeader` in `UI_ELEMENTS`, because the
  header only grows its pill when there is already a dock to toggle.
  ⚠️ **Both halves of this were undone on 2026-08-21** — the pill is gone and the ordering
  constraint with it. See "The header pill is gone" in the follow-ups.
- **`onGraphReady`, not `onAfterMount`, for the interaction subscription.** `Graph`
  constructs the `UIManager` (`:92`) *before* the renderer (`:116`), so `graph.renderer`
  is undefined during `afterMount` — there is no interaction layer to subscribe to yet.
  A trap for any element that wants selection events.
- **Built-in column keys are namespaced (`pvt:degree`, …)** so they can never collide
  with a data key. Consumers never type them: they compose the `tableColumns` objects, and
  reference a key as `tableColumns.degree.key` when `sort` needs one.
- **The scanned columns skip `label`.** The built-in Label column *is* the display name and
  `label` is the conventional source, so a scanned `label` column showed the same value
  twice under the same heading.
- **`nodePropertiesGetter` stayed unused**, as §5.2 predicted — per-node and possibly
  async is unusable across 10k rows. The facet route is the one that works.
- **Each tab gets its own grid**, so switching to Edges and back does not rearrange the
  node table's sort, columns or row filters.
- **`Simulation` gained a `destroy()`**, wired into `Graph.destroy()`. It was never torn
  down before; the new container observer made that a leak rather than a curiosity.

### Found on the way in

- **The header row could inflate the canvas grid column past its container.** A grid
  item's automatic minimum is its content width, so the row of pills was widening
  `.pvt-canvas` beyond `.pivotick` — clipped, so it looked fine while reporting a wrong
  width to anything that measured it. Adding a fourth pill made it big enough to break the
  minimap's `collapsed: 'auto'` thresholds. Fixed with `min-width: 0` on `.pvt-mainheader`.
- **`graph.hideNode()` notifies nobody.** It flips `node.visible` and calls `onChange()`,
  which only re-renders — no data event. So no observer can react to it; the minimap has
  the same blind spot. The dock tracks the query engine's events instead, which covers
  every *supported* hide path.
- **A popover inside the dock has to be `position: fixed`.** The column picker first
  shipped broken: `.pvt-table-header` is `position: static`, so an absolutely-positioned
  `top: 100%` anchored to `.pvt-table` — putting the picker *below the whole dock*, off the
  bottom of a 720px viewport and clipped by `.pvt-table-dock { overflow: hidden }`. It now
  anchors to its button in viewport coordinates and opens **upwards**, since the dock is at
  the bottom of the layout and there is no room below it.
  **The test passed anyway**, which is the more useful lesson: Playwright's visibility
  check ignores viewport position and ancestor clipping, so `uncheck()` happily drove a
  control the user could not see. Asserting the *effect* (the headings changed) was not
  enough — `toBeInViewport()` plus a rect-inside-the-container check is what catches it.
- **A real split does not fully escape corner pressure**, contrary to §3.7's claim. The
  dock never covers the legend or the minimap — but it shortens the canvas until
  bottom-left chrome and the left-edge rail converge. Measured and fixed afterwards: the
  legend now sizes itself against the rail rather than growing into it, and the gallery
  card's `top-left` workaround is gone. See the legend entry under *Follow-ups*.

### Not done

- **Row-level actions.** D-B by design. §5.9 holds the seam.
- **`getHiddenNodes()` and the reason-recording filter pass** (old §5.3 / R5) — dropped
  outright by D-A, not deferred. (The *count* it was tangled up with is now fixed; see the
  follow-ups.)

## Follow-ups (2026-08-20/21, same branch)

The two items §5.6 and §3.2 left open, both done, plus a dead column and a dead toolbar
pill found while answering questions about clusters and about where the toggle belongs.
`tsc`, `eslint`, `npm run build` and `vitepress build docs` clean; **401 visual tests
green**, 13 of them new, each checked against a reverted fix.

### The hidden-node count was over-reporting (§3.2)

`getHiddenNodeCount()` was `every node in the map − the visible top-level ones`, which
folded a cluster's collapsed descendants into the total — they are rows of their parent's
subgraph, so no filter here can hide them. On the `clustered` fixture the pill read
"6 hidden" over a single filtered-out node.

Fixed in `GraphQueryEngine.apply()` by matching and counting `childrenDepth === 0` only.
Two things fell out of it:

- `nodeMatchesFilters` no longer runs on children at all, so a consumer's facet
  accessor/predicate is no longer invoked for nodes that are not in this graph.
- `clearNodeExclusions()`'s `hiddenNodeCount +=` line was dead — `apply()` overwrites the
  field on the next statement. Removed.

`filter-hidden-count` covers it, and its last test is the pairing that exposed the bug:
the pill and the dock's `Visibility` column describe the same nodes, so they must agree.

### Header filter controls are typed off the column (§5.6)

`TableRowFilters.ts` holds the model — a `RowFilter` union of `text` / `value` / `range`
rather than one string for all three, because "between 3 and 9" is not a substring match.
`numberRange` gets a Min/Max pair (either end optional), `select`/`multiselect`/`boolean` a
dropdown, everything else the text box as before.

- **The dropdown's choices come from the column's own values**, not from a declared option
  list: `TableColumn` borrows only `key`/`label`/`type`/`order` from `FilterFacet`, so it
  has no `options` — and offering a value no row holds would only ever return nothing.
  Read from *all* rows, or picking one would empty the list you picked it from.
- **Above 50 distinct values it falls back to the text box.** The scanned column types are
  inferred from the data, and `inferAttributeType` will happily call a key with one value
  per node a `multiselect`.
- **The UA dropdown arrow is not dependable** — VitePress's own reset clears `appearance`,
  and the control shipped looking exactly like a text box. It is drawn from the wrapper's
  `::after` in `currentColor` instead. Form controls don't inherit the page font either,
  so a header row mixing a box and a select showed two typefaces; `.pvt-table-filter` now
  sets `font-family: inherit`.
- **Narrowing re-renders the rows only** (`renderRows`), leaving the header standing. It
  used to rebuild the whole grid per keystroke and then re-focus the input by selector —
  which also means `cssEscape` had no callers left, and went.

Still open, and deliberately: a dark-themed dock pops a **light** native option list,
because nothing in `_theme.scss` sets `color-scheme`. Not new — `FormFactory.buildSelect`
has the same gap in the filter panel — so it wants fixing at the theme, not here.

### Derived columns come filterable (2026-08-21)

Shipping `filterable: false` for everything meant the feature could only be seen by
hand-declaring `columns` — `src/main.ts` declares no `UI.table` at all, so the demo showed
a grid with no controls on it, and so does anyone's first look at the dock. But **the
derived set already infers everything a control needs**: `dataColumns` types each scanned
key through `inferAttributeType`, and the graph-aware columns carry theirs (`Visibility` is
a `select`, `Degree` and `Children` are `numberRange`). Only the flag was missing.

So `resolveColumns` marks the **derived** tiers filterable and leaves the declared tier
literal — one `.map` on the way out, over copies, so the exported `tableColumns` constants
a consumer may also be declaring are never mutated. The split is the honest one: a derived
column's label, type and alignment are all guesses we make, and the control is one more
guess off the same type; a `columns` array someone wrote out is a statement, and gets
exactly what it asks for.

That distinction is load-bearing rather than tidy — the `data-table` gallery card
deliberately gives 3 of its 6 declared columns a filter to show that the control follows
the `type`, and a blanket default would have flattened the point it is making.

On `main.ts` this comes out as nine columns, each with the right widget (Visibility and
Gender dropdowns, Degree and Children bounds, Label / Icon / Nested1 text), for one extra
26px row in the sticky header. Two known-harmless edges, both pre-existing: a categorical
column whose rows hold **one** distinct value still draws a dropdown that cannot narrow
anything (suppressing it would make the control flicker in and out as data changes, and
`Visibility` gains its second value at exactly the moment you want the dropdown), and a
column of long strings — the demo's `icon` holds 500-char SVG — gets a substring box that
is legal but pointless.

### `Children` replaces a column that could never render

Asked why the dock lists hidden nodes but not nested ones, the answer held — but the code
did not. `tableColumns.cluster` read `node.parentNode?.id ?? ''`, and `parentNode` is
assigned in exactly one place: `markAsChild`, which also sets `isChild = true` — the flag
`collectElements` excludes on. So `!isChild ⟹ parentNode === undefined`, and the built-in
**Cluster column could only ever render an empty string**. It was written expecting
children to be listed. Dropped rather than kept as decoration; nothing had shipped, since
the whole dock is still unmerged.

In its place, `tableColumns.children` — direct children, `0` for a leaf. It earns this on
its own: **nothing else in the library says how big a cluster is** — not the label, not
the tooltip, not the sidebar — so the only way to find out was to expand it. It joins the
derived leading set only on a graph that has clusters, because everywhere else it is a
column of zeros.

### Why nested rows stay out (and what it would take)

The distinction is the same one the count fix rests on, and it is worth stating once: a
**hidden** node is a node of this graph that isn't drawn; a **nested** node is not a node
of this graph at all. Listing them would break three of the dock's own columns —

- `Visibility` would read `filtered` for every child, because `normalizeNode` calls
  `child.hide()` at load (`Graph.ts:389-390`). Nothing filtered them.
- `Degree` counts `edgesIn`/`edgesOut`, but edges into a collapsed cluster's children are
  hidden and replaced by synthetic edges to the parent — so a child's degree is not the
  degree the canvas shows.
- Clicking the row selects a node the canvas cannot display while the cluster is collapsed.

Mechanically it is one line — `_setData` already puts every descendant in `graph.nodes`
(`Graph.ts:670-673`) and `collectElements` filters them back out. What makes it a spec
rather than a patch is the set of questions above it: a `nested` visibility state, whether
selecting a child expands its cluster, whether `Degree` reads the subgraph, whether export
and the summary count include them, and what a row filter does to a parent/child pair.
**Ruled a separate PRD, 2026-08-21.**

### The header pill is gone; the bar is the control

The dock's toggle was a fourth Mainheader pill (D-I). Removed: the other three all open
something *over* the canvas, while the dock is a split region that, collapsed, already
shows its own chevron — so the pill was a second control for something already pointing at
itself, and the worse-placed of the two. `Shift+T` moved onto the dock.

The pill only existed because the dock defaulted to **closed**, leaving nothing on screen
to point at it. So `open` became three-state — unset (present, folded to its bar), `true`
(expanded), `false` (absent, the zero-footprint opt-out). That also dissolved the
`UI_ELEMENTS` ordering constraint this PRD had to record.

Two things broke, both in the bottom-left corner, both because the sidebar **spans the
dock's grid row**:

- Its collapse toggle hangs off its own bottom-right corner, which is now the dock's
  chevron. They overlapped and the chevron ate the toggle's clicks — a click *timeout* in
  `legend.spec`, which is an obscure signal for a layout collision, so `table-dock` now
  asserts the non-overlap directly. Fixed by measuring the toggle from above the dock.
- The **legend collides with the mode rail** on a short viewport (1024×620: legend top
  412px, rail bottom 440px). Fixed, and not by the dock's doing — see below.

Also fixed while here: on the **dark** theme the sidebar and the dock resolve to the *same*
fill (`--pvt-ui-bg` and `--pvt-chrome-bg` are both `--pvt-bg-color-6`), and the sidebar's
only right-edge separator is a black box-shadow — invisible on dark, so the two surfaces
merged. The dock draws its own `border-left` now, as it already drew its top.

### The legend sizes itself against the mode rail (2026-08-21)

The collision recorded above was blamed on the dock. It wasn't. Re-measured at 1024×620
in full mode with a four-row legend, the folded dock bar costs exactly 34px, and the gap
from the legend's top to the rail's bottom is:

| rail | with dock | without dock |
|---|---|---|
| 4 buttons (library default) | **+89px** | +123px |
| 5 buttons (`enrich` — the test harness default) | **+18px** | +52px |
| 6 buttons (`explore` + `enrich`) | **−44px** | **−10px** |

The overlap predates the dock; the dock spent a ~6px margin that had already gone. The
variables that matter are the rail's button count and the legend's row count — and
`maxVisibleEntries: 12` alone makes the legend ~330px tall, which overlaps even the
four-button rail on that viewport.

So the fix is geometric, not positional. `ModeRail` publishes `--pvt-moderail-height`
(observed, not computed — it moves with the opt-in SOON modes), and the `bottom-left`
legend caps itself at the room left in its column: `100%` minus the header, the rail,
the gaps and its own bottom offset. `100%` is the canvas, which already excludes the
dock's row, so it tracks the dock opening and closing for free. The panel and list carry
`min-height: 0` so the cap reaches the list, which already scrolled. It never changes
corner and only overlaps where not even one row fits.

Three things found on the way, each worth more than the fix:

- **`top-left` is not the safe corner it looks like.** It is the contextual tool panel's
  exact anchor (`left: 84px`, `top: mainheader + 14px`) at a higher z-index — clear only
  while that panel is collapsed, which is its initial state and nothing more. Full mode
  has **no** free corner: tool panel top-left, nav pill top-right, minimap bottom-right,
  sidebar collapse toggle bottom-left (which the legend clears by 3px). The `data-table`
  gallery card keeps `top-left` anyway, and for a better-stated reason: its embed is
  560px tall with the dock taking 42%, leaving a canvas *shorter than the rail itself*.
  When the column can't seat one row, the cap floors at header-plus-a-row and the legend
  goes under the rail — correct, and still not what you want on a showcase card.
- **The "quarter row of slack" cue did nothing.** A row's first 6.5px are its swatch's
  leading space, and a quarter of 24px is 6px, so the cut landed in blank space and read
  as the end of the list. Both cap paths now leave half a row. Cheap to verify and easy
  to get wrong: dump the pixel column through the swatch gutter rather than eyeballing a
  crop, and mind that a crop of your own can fake the slice you are looking for.
- **`--update-snapshots` does not rewrite a baseline that still matches** within
  `maxDiffPixelRatio` (0.01 ≈ 4000px here). A 6px height change on a small element sails
  under that, so the run reports success and keeps the old file. Delete the baseline to
  force it. This had also been hiding a stale `legend-long-list` baseline whose rail
  predates the Physics mode — a whole missing rail button, ~3500px, which had been
  quietly eating most of the tolerance budget.

### Notes for the next person

- `TableGrid.ROW_HEIGHT` (24) and `--pvt-table-row-height` in `table.scss` must agree —
  windowed rows are positioned arithmetically from the constant. `table-virtualization`
  asserts the product (800 rows → `19200px`), so a change to one without the other fails.
- The visual harness runs with `simulation: { enabled: false }` and every fixture node
  pinned, so **the suite gives physics changes almost no coverage.** `physics-container`
  asserts the measured rect and the gravity centre directly for that reason — assert
  inputs, not settled positions.
- Every one of the new specs was checked against a deliberately reverted fix to confirm it
  actually fails without it. Worth keeping up: three of the four `physics-container` tests
  pass against the old canvas measurement if you only check the happy path.
- **Don't add nodes and then screenshot the canvas.** New nodes move the graph's bounds
  and the re-fit lands a variable number of frames later, so the baseline becomes a coin
  flip under a loaded parallel run — `waitForViewSettled` doesn't help, it can resolve
  while the fit is still polling the bbox. Either screenshot the element you actually
  care about (`expectElement`), or place the new nodes inside the existing bounds so the
  re-fit is a no-op.

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

Scope: a **generic library capability** (not driven by any one integration), a **core view
mode** (not a plugin), **read-only** in v1.

### Explicitly out of scope (v1)

- **Any action or mutation.** No cell editing, no bulk edit, no delete, no hide/unhide, no
  pinning from the table. It reflects and selects; `BulkActions` and `GraphFilter` keep
  owning everything that changes state (D-B). **Actions and data mutation are planned**, so
  the design must leave a seam for them — see §5.9.
- **Column reordering / resizing by drag, pinned columns, column groups.** Declared order
  and declared widths; visibility is togglable via the picker, nothing else.
- **Grouped or aggregated rows** (group-by-type with counts). Overlaps the legend's job.
- **`light`, `viewer` and `static` modes.** `full` only (D-E).

## 2. What professional tools do

- **Gephi** — the Data Laboratory is a first-class surface with a node table and an edge
  table, showing **every** column with a column-visibility control. The strongest precedent
  for "the table is not a report, it is a working surface", and for §5.2's show-all default.
- **Maltego** — the Entity List sits beside the graph over the same selection; selecting in
  one selects in the other. Its whole value is that it never diverges.
- **Neo4j Browser** — result grid / table / graph toggles over one result. Table is the
  default, graph the opt-in, which says something about which one people can read.
- **Linkurious** — a bottom-docked resizable results grid under the canvas, click-to-focus.
  Closest to the placement here.
- **Cytoscape (desktop)** — bottom-docked Node / Edge / Network Table panels.

Two invariants hold across all of them, and both shaped this spec:

1. **Bottom or side dock; node and edge tables; selection shared with the graph; export
   lives here.** Nobody makes it a modal.
2. **Transient chrome never changes the layout.** Opening Gephi's Data Laboratory, Maltego's
   Entity List or Cytoscape's table panels does not re-run the layout. Their layout
   parameters are graph-space throughout — ForceAtlas2 takes *scaling* / *gravity* /
   *edge weight influence*; vis-network takes `gravitationalConstant` / `springLength`. **None
   of them scales repulsion by nodes-per-pixel.** This is §3.4.

The one partial exception is **Cytoscape.js**, whose `layout({ boundingBox })` defaults to the
viewport — but that fits a layout *result* into an explicit, overridable box; it does not
derive force strengths from pixel area.

## 3. Gap in Pivotick today

### 3.1 There is no table, and no export of any kind

Nothing in `src/` renders tabular data, and nothing anywhere produces a CSV, a JSON dump, or
a download. `JsonViewer` shows one element's data; `PropertyList` shows one element's
key/values. There is no surface that shows *a set*.

### 3.2 The hidden set is barely inspectable, and its count is wrong

`GraphFilter` reports a hidden count (`GraphFilter.ts:161,196`) backed by
`queryEngine.getHiddenNodeCount()`. That count is **already wrong**:

```js
// GraphQueryEngine.apply(), :205-211
const nodes = this.graph.getMutableNodes()                          // includes cluster children
const visibleNodes = nodes.filter(node => this.nodeMatchesFilters(node))
const visibleNodesInCurrentGraph = visibleNodes
    .filter(node => node.childrenDepth === 0)                       // excludes them by design
this.hiddenNodeCount = nodes.length - visibleNodesInCurrentGraph.length
```

`getMutableNodes()` has its `isChild` filter **commented out** (`Graph.ts:917-919`), so it
returns cluster children — and they are then subtracted as though filtered out. **Every
cluster child counts as hidden whenever a cluster exists.**

For the restorable half there is already a proto-table: `GraphFilter.ts:187-208` lists
`getExcludedNodes()` with a per-row "Show node" button and a clear-all. So *manual*
exclusions are inspectable and reversible; *filtered* nodes are neither.

**This does not require a new query-engine API.** `node.visible` plus the existing
`getExcludedNodes()` already separate `filtered` from `excluded`, and both are public. The
table derives its own `Visibility` column from those two rather than trusting the count (D-A).

### 3.3 Bulk actions exist; the instrument to drive them does not

`BulkActions` runs over `getSelectedNodes()` and already has `isolate`, `group`, `ungroup`
and `bulk-edit` sitting there as disabled `SOON` slots. Its functional actions are only as
useful as the selection someone can build, and today that means a drag on the canvas.

### 3.4 The canvas pixel rect leaks into the physics

`Simulation` feeds *pixel* dimensions into forces that live in *graph* coordinates:

| Site | What it uses the rect for |
|---|---|
| `initSimulationForceGravity` (`Simulation.ts:229-231`) | gravity's centre is `width/2, height/2` |
| `scaleSimulationOptions` (`:393-394`) | `density = nodeCount / (width × height)`, scaling charge + collide |
| `computeGraph` (`:576`), `runSimulationWorker` (`:618`) | passes a **freshly read** rect into each layout pass |

`this.canvasBCR` is captured once in the constructor (`:151`) and never refreshed, while the
last two re-read it live — **so the running simulation and the next re-layout already
disagree with each other.** Anything that resizes `.pvt-canvas` (a window resize, a sidebar
collapse, and now a dock) changes what a re-layout produces.

Worse, there is no zero guard. A zero-height canvas gives `density = Infinity`, so
`scale = Math.min(2, 0.000075 / Infinity) = 0` and **`d3ManyBodyStrength` and
`d3CollideStrength` are both zeroed** — no repulsion, no collision, the graph collapses to a
point, with gravity aimed at (0, 0) for good measure.

None of this comes from d3: **d3-force contains no reference to `width` or `height`
anywhere.** `forceCenter(x, y)` defaults both to `0` — the origin — and `forceManyBody`
strength is a dimensionless `-30`. The coupling is Pivotick's, inherited from the canonical
`d3.forceCenter(width / 2, height / 2)` example line.

### 3.5 Writing the selection: narrower than it looks

`graph.selectElement(element)` (`Graph.ts:1195-1201`) is **already identity-based** — it
resolves `getGraphElement()` internally and handles `Edge` as well as `Node`, so the renderer
leak is already encapsulated inside `Graph`. Row-click needs nothing new.

What is missing is the **plural** half: there is no `selectElements(nodes)` /
`addToSelection` / `removeFromSelection`, so Ctrl-click and Shift-range — the table's actual
value proposition — have no public entry. That is ~15 lines mirroring `selectElement`, not a
dependency on `misp/selection-api-by-identity.md`. **That PRD stays desirable, not blocking.**

### 3.6 Selecting an invisible node dims the whole canvas

Hidden nodes are **removed from the DOM** — the data join filters `node.visible`
(`GraphSvgRenderer.ts:331`) — so `getGraphElement()` is null for them. Selecting one is
otherwise safe: selection is tracked by id and styled through `getGraphElement()?.classList`
(`NodeDrawer.ts:544-573`).

But `applyShadow` engages whenever *anything* is selected:

```js
// NodeDrawer.ts:544
const applyShadow = this.getSelectedNodeIDs().length !== 0
```

so a selection containing only invisible nodes dims every visible node and highlights
nothing — it reads as broken. **This is reachable today**, without any table: `SearchBox`
iterates `getMutableNodes()` (`:186`), so a hidden node can appear as a search result, and
`Mainheader` calls `selectElement` on whatever you click (`:132-137`).

### 3.7 The layout has no room below the canvas

`Layout` creates ten slots, every one of them either a grid area or absolutely positioned
*inside* `.pvt-canvas`. The grid is a single row:

```scss
grid-template-columns: auto 1fr;
grid-template-rows: minmax(0, 1fr);
grid-template-areas: "sidebar canvas";
```

A canvas-overlay dock would need no core change, but it would bury the legend
(`bottom: 44px` in `full`) and the minimap (`bottom-right`, 200px default). A real grid row
avoids that entirely: both are positioned relative to `.pvt-canvas`, so they ride up when it
shrinks.

## 4. Decisions taken (grilling session, 2026-08-20)

| # | Decision | Why |
|---|---|---|
| **D-A** | **Superset, not a mirror.** All top-level nodes, with a `Visibility` column (`visible` / `filtered` / `excluded`) that sorts and filters like any other. No Hidden tab. | A mirror would need a third tab *and* a new API to show what it structurally cannot. The superset dissolves both (§3.2) and makes the hidden set a first-class, sortable fact. |
| **D-B** | **Read-only means no actions.** The table reflects and selects. Hide/pin stay in `BulkActions`; restore stays in `GraphFilter`. | Keeps v1 genuinely small, avoids a second place to do what `BulkActions` already does, and avoids duplicating its write-path-hook plumbing. The loop still closes: select in the table, act in the sidebar. **Actions and mutation are planned** — §5.9 holds the seam. |
| **D-C** | **Column filters are table-local.** They narrow rows; the canvas is untouched. | Under D-A the table is a reading lens over the whole dataset, so narrowing your *reading* is not the same act as changing what the graph shows — and under D-B, changing canvas visibility *is* an action. Narrows the legend PRD's ruling rather than breaking it: there is still exactly one thing that decides graph visibility, and it is `GraphFilter`. |
| **D-D** | **Hidden rows are fully selectable**, and `applyShadow` only engages when the selection holds ≥1 *visible* node. | A table that lists hidden nodes but refuses to select them is a tease. The guard fixes a pre-existing bug (§3.6). |
| **D-E** | **A split dock with a draggable divider** — resizable, collapsible, `collapsed: 'auto'`, off by option, **`full` mode only**, clamped so the canvas never approaches zero height. | "The separation should be resizable" requires a real split, not an overlay or a takeover. The clamp is what keeps §3.4's collapse-to-a-point unreachable. |
| **D-F** | **Physics measures the root container (`.pivotick`)**, not `.pvt-canvas`, with a zero-area guard. | Adopts §2's invariant: *the container may tune the layout; transient chrome may not.* Keeps the canvas-adaptive auto-physics tuning (a deliberate feature for an embeddable library) while making the dock, the sidebar and the header unable to perturb a layout. Also fixes the pre-existing live-vs-relayout divergence. Full graph-space forces (Gephi's model) would delete the adaptive tuning and relayout every existing consumer — its own PRD, not this one. |
| **D-G** | **v1 = nodes + export + edges**, staged in that order. | Export is the most-asked-for thing in any grid and costs little. Edges reuse the whole machinery and are what the canvas communicates worst beyond topology — but they go last so they are droppable. |
| **D-H** | **Show every column** (Label, Degree, Visibility pinned, then derived keys by coverage), horizontally scrollable, **plus a column picker**. | Gephi's actual behaviour. Nothing is hidden or unreachable, and the picker handles property-heavy nodes without a coverage cap that silently drops data. |
| **D-I** | **A Mainheader pill** beside Search / Filter / Notes, with **Shift+T**. | Those three are all persistent data surfaces toggled from the header — the same grammar as a dock. The rail's four slots are mutually *exclusive* modes; a dock is not one, and forcing it in there would leave a fully interactive canvas with no pointer mode. |

## 5. Proposal

### 5.1 Config

```ts
interface GraphUI {
    /**
     * The bottom data dock: the graph's nodes and edges as a sortable grid.
     * `full` mode only. Omit or `false` for no dock; `true` accepts the defaults.
     */
    table?: TableOptions | boolean,
}

interface TableOptions {
    enabled?: boolean
    /** Which tabs to offer, in order. @default ['nodes', 'edges'] */
    tabs?: Array<'nodes' | 'edges'>
    /** Node columns. Omitted → resolved per §5.2. */
    columns?: TableColumn[]
    /** Edge columns. Omitted → resolved per §5.2. */
    edgeColumns?: TableColumn[]
    /** Open on boot. @default false */
    open?: boolean
    /**
     * Folded away to just its header bar. `'auto'` follows the available room,
     * until the first explicit collapse/expand. @default 'auto'
     */
    collapsed?: boolean | 'auto'
    /** Dock height: px, or a 0–1 fraction of the canvas. @default 0.35 */
    height?: number
    /** Initial sort. @default the first sortable column, ascending */
    sort?: { key: string, direction: 'asc' | 'desc' }
    /** What a single row click does. @default 'select' */
    rowActivate?: 'select' | 'selectAndCenter' | 'none'
    /** Export buttons. @default ['csv', 'json'], `false` to hide */
    export?: Array<'csv' | 'json'> | false
    /** Row count above which rows are windowed. @default 200 */
    virtualizeAbove?: number
}
```

### 5.2 Columns are facets

`FilterFacet` (`interfaces/GraphQueryEngine.ts`) is **already a column spec**: `key`,
`label`, `type`, `accessor`, `order`. `TableColumn` extends it rather than competing:

```ts
interface TableColumn extends Pick<FilterFacet, 'key' | 'label' | 'type' | 'accessor' | 'order'> {
    width?: number | string
    /** @default 'right' for numberRange, 'left' otherwise */
    align?: 'left' | 'right' | 'center'
    /** @default true */
    sortable?: boolean
    /** Give this column a table-local filter control in its header. @default false */
    filterable?: boolean
    /** Hidden by default in the picker (still listed there). @default false */
    hidden?: boolean
    /** Render the cell. @default String(value) */
    format?: (value: unknown, element: Node | Edge) => string | HTMLElement
}
```

**Three-tier resolution**, mirroring the legend's precedent:

1. **Declared** — `UI.table.columns` wins.
2. **Derived from facets** — else, if `UI.filter.facets` is declared, build columns from
   them. *Declare your data shape once and the filter panel and the table agree.*
3. **Derived from data** — else scan, reusing the extracted
   `GraphFilter.getAvailableNodeAttributes()` + the type inference in `derivedFields()`
   (`:326-365`), so the table's inferred types match the filter panel's widgets for free.

Two traps, both verified:

- **A facet with only a `predicate` has no readable value.** `predicate` decides membership
  and wins over `accessor`; it cannot produce a cell. Fall back to the default data-key
  accessor and warn **once per key**, mirroring the engine's `brokenFacets` handling.
- **Do not reuse `nodePropertiesGetter`** (`GraphGetters.ts:68-92`), tempting as it is. It
  honours `propertiesPanel.nodePropertiesMap`, which is per-node and **may be async** — fine
  for one sidebar node, impossible across 10k rows. It also drops all falsy values
  (`if (key && value)`), so a `severity: 0` silently vanishes. The scan path only skips
  `null`/`undefined`, which is what a table wants.

**Graph-aware columns** ship as library-provided facets the consumer composes — no sigils,
tree-shakeable, and cloneable (`{ ...tableColumns.degree, label: 'Links' }`):

```js
import { Pivotick, tableColumns } from 'pivotick'
// label · degree · degreeIn · degreeOut · visibility · pinned · cluster
```

`tableColumns.label` wraps `nodeNameGetter(node, mainHeader)` so labels match the rest of
the UI; the edge counterparts wrap `edgeNameGetter` / `edgeLabelGetter`.

**Default order (D-H):** `visibility`, `degree`, `label`, then derived keys **ordered by
coverage** (how many nodes carry the key), most-populated first. Everything is shown; the
grid scrolls horizontally inside its own container. The **column picker** in the dock header
toggles visibility — table view state, so it stays inside D-B.

### 5.3 Rows

| Tab | Source | Notes |
|---|---|---|
| **Nodes** | `graph.getMutableNodes()`, minus `isChild` | The superset (D-A). `getMutable*`, never `get*` — `getNodes()` clones every node. |
| **Edges** | `graph.getMutableEdges()`, minus cross-cluster stand-ins | Defaults: source, label, target, then derived keys. |

The `Visibility` cell is derived per row, not read from the broken count (§3.2):

```
excluded  if queryEngine.getExcludedNodes() contains it
filtered  else if !node.visible
visible   otherwise
```

Cluster children are excluded from the rows entirely, so they are never reported as hidden.

### 5.4 Placement, DOM, and the toggle

A `table` slot as a **second grid row spanning the canvas column only**, so the sidebar stays
full-height and keeps showing the selected row's properties and neighbours:

```scss
.pvt-layout {
    --pvt-table-height: 0px;

    grid-template-rows: minmax(0, 1fr) var(--pvt-table-height);
    grid-template-areas:
        "sidebar canvas"
        "sidebar table";
}
```

Collapsed is the header bar's height; off is `0px` — no second element, no layout shift. A
drag handle on the divider writes the variable, **clamped so the canvas keeps a floor of
200px** (§3.4). `Layout.onMount` creates the slot in `full` only, and `UI_ELEMENTS` gets one
row — "adding a new built-in element is a single row here", per the catalog's own docstring.

**`collapsed: 'auto'` reuses the minimap's machinery** (`plugins/minimap/Minimap.ts`): two
hysteresis thresholds so a canvas sitting on the boundary doesn't flap open and shut
(`:31-32`), a `userChose` latch that ends auto-management at the first explicit choice
(`:80`), and a `ResizeObserver` on the canvas (`:169`).

**The toggle** is a `pvt-action-button` pill in the Mainheader following the existing template
pattern (`Mainheader.ts:30-72`) with `createShortcutBadge('Shift+T')` — joining Shift+J
(Search), Shift+K (Filter) and Shift+N (Notes). `Shift+T` is free.

**Consequences of shrinking the canvas, all checked:**

- The SVG is `width/height: 100%` (`GraphSvgRenderer.ts:102`), so it reflows for free.
- Legend and minimap are positioned inside `.pvt-canvas` and ride up with it — no collision.
- Anything cached against canvas size must invalidate; the minimap's `ResizeObserver`
  self-heals, which is the pattern for anything new.
- **Physics does not react at all**, because of D-F.

### 5.5 The physics invariant (D-F)

`Simulation` takes its measurement from the **root container** (`ui.getRootContainer()`,
i.e. `.pivotick`) rather than `.pvt-canvas`, refreshed on genuine container resize. All four
sites in §3.4 read that one source, and a zero-area rect is rejected rather than propagated.

Consequences:

- Opening, resizing or collapsing the dock, collapsing the sidebar, and toggling header
  chrome all become invisible to the layout — §2's invariant.
- The running simulation and a subsequent re-layout stop disagreeing.
- The canvas-adaptive auto-physics tuning keeps working, and still re-tunes on a real
  window or container resize.

Deliberately **not** done here: moving to fully graph-space forces (gravity on
`getContentBounds()`, density over a graph-coordinate area). That is the architecturally
correct end state and matches Gephi/vis-network/Maltego, but it deletes the adaptive tuning
and relayouts every existing consumer's graph, so it needs its own PRD and its own
before/after visual pass.

### 5.6 Filtering: table-local (D-C)

A column with `filterable: true` gets a header control typed off its facet `type`. It narrows
**rows only** — `queryEngine` is not touched, and the canvas does not change.

This narrows rather than contradicts the legend PRD's ruling. That ruling exists so two
mechanisms can't fight over *what the graph displays*; under D-C exactly one thing still
decides that, and it is `GraphFilter`. The table's filter decides what *you are reading*,
and the `Visibility` column keeps reporting the graph's state truthfully alongside it.

Because the two inputs look similar and mean different things, the dock's controls must say
so — a "filter rows" affordance distinct from the header's "Filter Graph" pill.

Still ruled out: a table-local free-text search box. The Mainheader's Search already does
find-a-node, and a second text input meaning something subtly different is exactly the trap.

### 5.7 Re-render, coalesced

The dock rebuilds on `dataBatchChanged`, `nodeAdd/Remove/Change`, `edgeAdd/Remove/Change`,
and the query engine's `filterAdd/Remove/Change/Reset` (which move `Visibility` values). Not
on `simulationSlowTick` — no default column depends on position.

All of it **coalesced into one `requestAnimationFrame`**, per the `runtime-sidebar-panels`
lesson: one user action fires several of these, and rebuilding per event is both janky and a
good way to lose scroll position. One dirty flag, one rebuild, scroll offset and selection
preserved across it.

### 5.8 Selection sync (D-D)

| Gesture | Effect |
|---|---|
| Click row | `graph.selectElement(node)` — replaces the selection |
| Ctrl/Cmd-click | add / remove that row (needs `addToSelection` / `removeFromSelection`) |
| Shift-click | range from the last clicked row, **in current sort order** |
| Header checkbox | select every row currently listed (post-filter, post-sort) |
| Double-click | select **and** centre the canvas on it |
| Hover row | canvas hover highlight |

**Graph → table**: subscribe to `selectNode` / `selectNodes` / `unselectNode` /
`unselectNodes`, mark the matching rows, scroll the first into view. Rubber-band 40 nodes on
the canvas and the table shows you what you caught.

Rows are keyed by `node.id` / `edge.id`, so a rebuild never loses the selection. Hover sync
only fires from rendered rows, so it costs nothing at 10k.

Selecting hidden rows is allowed and does not dim the canvas (§3.6's fix).

### 5.9 API, and the seam for actions

```ts
// New, general-purpose — mirrors selectElement's internal resolution (§3.5)
graph.selectElements(elements: Array<Node | Edge>): void
graph.addToSelection(elements: Array<Node | Edge>): void
graph.removeFromSelection(elements: Array<Node | Edge>): void

// The dock
graph.openTable(tab?: 'nodes' | 'edges'): void
graph.closeTable(): void
graph.toggleTable(): void
graph.setTableColumns(columns: TableColumn[], target?: 'nodes' | 'edges'): void
```

**The seam for D-B's sequel.** When actions and mutation arrive they must not grow a parallel
write path. The shape that keeps that honest: a row-level action list resolved the way
`BulkActions` resolves its specs — declared `{ id, label, icon, run }` entries operating on
*the current selection*, with every mutating one routed through `graph.editing.requestDelete`
and the write-path `onBefore*` hooks exactly as `BulkActions.deleteSelection` already does. v1
ships no actions, but the table's selection is deliberately the same selection
`BulkActions` reads, so wiring them later adds a renderer, not a mechanism.

### 5.10 Export (D-G)

CSV and JSON of **exactly what you are looking at**: the current tab, the *visible* columns
in their current order, the current sort, the current table-local filter. Not the whole graph
— that is `graph.getNodes()` away for anyone with code.

Raw values, not `format` output, so the file is machine-readable; a `format` returning an
`HTMLElement` is ignored. CSV quoting per RFC 4180.

### 5.11 Scale

Fixed-height rows, windowed above `virtualizeAbove` (200): render the visible rows plus
overscan, absolutely positioned inside a spacer of `rowCount × rowHeight`. Fixed height means
no measurement pass, and staying on plain DOM under the threshold keeps the small case
debuggable and screenshot-testable without scroll choreography.

Sorting happens on the row array, never the DOM. Accessors run once per row per rebuild; the
facet contract already says "keep it cheap", and a throwing accessor is warned about once per
key, not once per node.

Columns are **not** virtualized: 40 columns × 40 visible rows is 1600 cells, which costs
nothing next to the row windowing.

## 6. What the integrator does

Zero config, in `full` mode — a Table pill appears in the header; press `Shift+T`:

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
                tableColumns.visibility,
                ...facets.map(f => ({ ...f, filterable: true })),
            ],
        },
    },
})
```

## 7. Open questions / risks

- **R1 — sidebar + dock together is a lot of chrome.** In `full` with a 340px sidebar and a
  40% dock, the canvas is a third of the container. The sidebar collapses and the dock is
  resizable and auto-collapsing, but the default height wants judgement on a real laptop
  screen, not a guess.
- **R2 — CSV download inside a sandboxed iframe.** The docs gallery embeds examples in
  iframes, where `<a download>` on a blob may be blocked — making a shipped feature look
  broken in the one place people try it. Check before writing the gallery card; fall back to
  copy-to-clipboard in the embed if so.
- **R3 — a table is a screenshot-test liability.** Row order under equal sort keys and
  virtualized scroll position both look non-deterministic. Every visual test needs a dataset
  with unique sort keys, and should assert under the virtualization threshold unless it is
  specifically the virtualization test.
- **R4 — D-F changes layouts for graphs whose container ≠ canvas.** Measuring `.pivotick`
  instead of `.pvt-canvas` means every graph with a sidebar gets a slightly different gravity
  centre and density than before. That is the *point*, but it will move existing visual
  baselines — expect to re-record the cluster/physics specs and check the auto-physics
  presets deliberately rather than by snapshot diff.
- **R5 — heterogeneous data still makes a wide table.** D-H shows everything, so a graph with
  40 disjoint keys gets 40 columns and the picker is the only remedy. Coverage ordering puts
  the useful ones first, but if this proves annoying the fix is a coverage *threshold* on the
  derived tier — which would benefit the filter panel too.
- **R6 — two filter inputs.** D-C is coherent but "Filter Graph" in the header and "filter
  rows" in the dock will be confused by someone. Labelling is the whole mitigation; if it
  fails, the escape hatch is the explicit table/graph switch that was considered and dropped.

## 8. Acceptance criteria

1. `full` mode shows a Table pill in the Mainheader; `Shift+T` toggles the dock; `light`,
   `viewer` and `static` are unchanged. `UI.table: false` removes it entirely.
2. The divider resizes the dock; the canvas never goes below its floor; collapse folds to the
   header bar; `collapsed: 'auto'` folds on a cramped canvas and stops managing itself after
   the first explicit toggle.
3. **Physics is inert to chrome (D-F).** With the simulation running on ~500 nodes, node
   positions are identical across a dock toggle and across a full divider drag; a physics
   preset produces the same layout with the dock open and closed, and with the sidebar
   expanded and collapsed. A real window resize *does* still re-tune.
4. Legend and minimap ride up with the canvas and stay fully visible.
5. Zero config on a heterogeneous graph shows Label, Degree, Visibility, then derived columns
   ordered by coverage; a `severity: 0` field appears; the picker hides and restores columns.
6. Declaring `UI.filter.facets` with no `UI.table.columns` produces columns matching the
   filter panel's controls.
7. The `Visibility` column agrees with reality for filtered and manually-excluded nodes, and
   cluster children are never listed.
8. Table-local filtering narrows rows and leaves the canvas untouched.
9. Click / Ctrl-click / Shift-click / header-checkbox build the same selection state canvas
   gestures do, and `BulkActions` acts on it unmodified. Canvas selection marks and scrolls to
   the rows. Neither direction loops or double-fires.
10. Selecting rows for only-hidden nodes does not throw and **does not dim the canvas**;
    a mixed selection dims normally.
11. CSV and JSON export the current tab / visible columns / sort / table filter, and
    round-trip through a spreadsheet without quoting damage.
12. 10k nodes: opening, sorting and scrolling stay interactive; a rebuild preserves scroll
    offset and selection.
13. `tsc`, `eslint`, `npm run build` and `vitepress build docs` clean; `table.spec.ts` green
    alongside `ui-chrome`, `mode-rail`, `legend`, `minimap`, `filter`,
    `sidebar-bulk-actions` and the cluster/physics specs.

## 9. Work plan

Steps 1–3 are independent bug fixes that land and ship on their own.

1. **Physics invariant (D-F)** — root-container measurement, one source for all four sites,
   zero-area guard. `src/Simulation.ts`. Lands first so the dock can never be blamed for a
   layout change. Expect visual baselines to move (R4).
2. **`applyShadow` fix (D-D)** — dim only when the selection holds ≥1 visible node.
   `src/renderers/svg/NodeDrawer.ts:544`.
3. **Multi-select by identity** — `selectElements` / `addToSelection` /
   `removeFromSelection` on `Graph`, mirroring `selectElement`.
4. **Dock scaffold (D-E, D-I)** — `Layout` slot (`full` only), grid row,
   `--pvt-table-height`, clamped divider, collapse + `collapsed: 'auto'`, `UI_ELEMENTS` row,
   Mainheader pill + `Shift+T`, `TableOptions`. Renders an empty dock — **verify AC 3 here,
   before any rows exist.**
5. **Column model (D-H)** — extract the derivation util out of `GraphFilter`; `TableColumn`;
   three-tier resolution; `tableColumns.*` built-ins exported from `src/index.ts`; coverage
   ordering; the picker.
6. **Node table (D-A, D-C)** — header, sort, `Visibility`, table-local filters, plain-DOM
   rows keyed by id.
7. **Selection sync (D-D)** — both directions, all gestures.
8. **Virtualization** — windowing above the threshold, coalesced rebuild, scroll/selection
   preservation.
9. **Export (D-G)** — CSV + JSON, visible columns only. Check the iframe case (R2).
10. **Edges tab (D-G)** — `createTabs`, edge columns. **Droppable.**
11. **Docs** — `docs/ui-table.md`, a gallery card (`aside: false` + `pageClass:
    gallery-wide`, per the full-mode card-width lesson), `tests/visual/specs/table.spec.ts`.
