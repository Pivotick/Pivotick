# Changelog

## Unreleased

### Pivots: fetch more graph, and choose what lands

- **`graph.pivots` runs enrichments and stages what comes back.** A pivot is two functions —
  `summarize(nodes, narrowing, ctx)` for the cheap "what's out there", `fetch(...)` for the
  real thing — declared through the `pivots` option, `graph.pivots.register()` or a plugin's
  `ctx.addPivot`. Results are **candidates**: not in the graph, not in the table, not in a
  facet count, until someone commits them. The hard part of walking a correlated dataset is
  never the fetching; it is that 1,800 neighbours are useless on a canvas, so deciding what
  lands is the feature.
- **The narrowing gate refuses rather than truncates.** A pivot's `maxCandidates` is judged
  against `summarize`'s advertised count, which re-runs as the analyst narrows — so a refusal
  says the number, the limit and the way forward, and *lifts* once the narrowing brings the
  count under the cap. An absolute `pivotCandidateCeiling` (10,000) backstops a provider that
  ignores the cap. Nothing is ever silently sampled.
- **A triage pane in the dock** — one tab per pivot that has been run, with the candidates as
  a table you can search (regex included), filter per column, sort and page. Rows are marked,
  ingested, or explicitly rejected; a rejection is remembered for the session, struck through
  in place rather than swept away, and reversible. **Reject all remaining** is the one gesture
  that turns 1,800 into 12. Closing the pane rejects nothing.
- **Ingest is purely additive.** An id already on the canvas is skipped, never overwritten;
  children merge into a container by id; edges follow their endpoints, except edges whose ends
  are *both* already on canvas, which become triage rows of their own. The whole batch goes
  through **`onBeforeIngest`** once — accept, veto, or hand back a narrowed set — and lands as
  a single `dataBatchChanged`.
- **Provenance.** Nodes and edges carry the set of sources vouching for them
  (`getSources()`, `'seed'` for everything that was already there, `'manual'` for anything
  drawn by hand), and `graph.removeBySource` drops one source's contribution and deletes only
  what nothing else vouches for. A set rather than a scalar, because two pivots overlapping on
  one node is the normal case. An ingest is reversible through `graph.history` (below); the
  post-ingest toast carries the undo.

### `graph.history`: taking back what the canvas holds

- **A bounded, session-scoped history of what the canvas holds and shows.** Four kinds of
  entry — a pivot ingest, a deletion, a durable hide or unhide (`queryEngine.excludeNode` /
  `includeNode`), and a node or edge drawn by hand — recorded automatically, thirty deep,
  oldest evicted. `entries()`, `redoable()`, `undo(throughEntryId?)`, `redo(...)`,
  `preview(...)`, `canUndo()`, `canRedo()`, `on(listener)` and `clear()`. Property edits are
  deliberately out: a node's data is backend state the library did not author.
- **Undo is contiguous, in both directions.** Aiming at an entry three rows down reverses
  those three, as one `dataBatchChanged` and one re-render. Any new action strands whatever
  had been undone. Reversing one *old* operation alone stays `graph.removeBySource(source)`,
  which is a forward operation and appears as its own entry.
- **`preview(entryId)` plays the span against a copy of the graph** rather than summing the
  entries, so it states the exact net effect: a hide cancelled by a later unhide nets to zero,
  and a node a second pivot also vouches for is not counted as leaving.
- **A consumer that wrote an operation through says so, and the entry seals.**
  `onBeforeNodeCreate`, `onBeforeEdgeCreate` and `onBeforeDelete` decisions take
  `persisted?: boolean`. A sealed entry is listed — it is part of how the canvas got this way
  — but never reversed, and a span containing one passes over it instead of stopping at it.
- **A deletion remembers each element's provenance**, so undoing it restores who vouched for
  what. Without that, undoing a deletion and then the run that landed those nodes would leave
  orphans nothing accounts for.
- **The top bar's Undo and Redo buttons do something.** They shipped as hardcoded disabled
  placeholders with the current chrome; they are now wired to `graph.history`, enable and
  disable with it, and name what they would take back (`Undo — Hid 3 nodes`). `Ctrl+Z` /
  `Ctrl+Shift+Z`, and `⌘Z` / `⌘⇧Z` on macOS, reach them without the header. `full` and
  `light` only, which is where the header lives.
- **`Mod` in a keybinding matches either `Ctrl` or `Meta`**, and `Meta` (Cmd) is now a
  modifier the key manager can express at all — it read `ctrlKey`, `shiftKey` and `altKey`
  and nothing else, so a macOS shortcut could not be declared. `'Mod+z'` is one binding for
  both platforms; `'Ctrl+z'` still means Ctrl alone.
- **The post-ingest toast is a plain report again.** It carried an Undo on a twelve-second
  fuse; with the history permanently in the top bar, a second undo affordance that expires is
  a race the analyst can lose for no reason. `Notifier`'s action API is unchanged.
- **A dropdown on each button, listing the history as one timeline.** Newest at the top with a
  *now* line through it: the rows above have been undone, the rows below are what can still be
  undone, and clicking a row drags the line past it — the same gesture in both directions.
  Because a span is always the block between the row you point at and the line, the contiguous
  rule is the shape of the list rather than a caveat about it.
  - Each row carries its kind's icon, what it touched, and **how many steps a click on it
    travels** — and that number is the *M* in the footer's `Undoes 3 of 4`, so the list and the
    footer cannot disagree.
  - The footer states the exact net effect of the hovered span before it is committed, from
    `preview()`, so it is what the click will actually do rather than a summary of the rows.
  - Hovering a row **forecasts the change on the canvas** and leaves everything else exactly
    as it reads: what the click would take out drains where it stands, what it would hide with
    it, and what it would *bring back* is outlined where it would land. The outlines are the
    half a highlight cannot do — a redo is about elements the canvas does not hold yet.
    `preview()` returns the forecast as data, and `graph.showForecast` / `graph.clearForecast`
    paint any forecast of your own.
  - **An undo notes where it took things from, and a redo puts them back there.** A pivot
    replays from raw provider data, which has no coordinates in it, so a redone ingest used to
    come back scattered somewhere new — and no forecast of one could have been honest.
  - A long span shows its two ends and lets its middle recede, so aiming twenty-five rows deep
    does not paint the whole menu one colour; when the *now* line scrolls out of reach the menu
    says which way it went and puts it back on a click.
  - Arrow keys aim, Enter travels, Escape closes.
- **Undoing an ingest puts its candidates back in the Review pane**, untriaged, with the pane
  reopening if the ingest had closed it and earlier rejections still standing — and without
  calling the provider again, which is what matters when the alternative is refetching two
  thousand correlations to fix a mistake made two seconds ago. Only while the ingest is still
  the newest entry: a pane resurrecting itself over later work would be worse than the
  refetch. `PivotRun` gains a `restage` record, and `PivotRestageRecord` is exported.

### Two things the pane needed, useful on their own

- **A notification can carry an action, and outlive four seconds.** `notifier.success(title,
  message, { action: { label, onClick }, duration })` returns a **handle** — so a toast can be
  rewritten in place (`Ingested 12 — Undo` becoming `Undone — Redo`) or dismissed. With an
  action a toast stays 12s instead of 4, pauses while the pointer is on it, and always draws a
  dismiss control. Existing calls are unchanged.
- **`DockTabHandle.setLabel(label)`** renames a tab in the strip without touching its body, its
  scroll position or whether it is on show — which re-registering the tab to change a word
  would have thrown away. Also `UIManager.setDockTabLabel(id, label)` and `ctx.setDockTabLabel`.

### Breaking

- **`graph.pivots.undo` / `redo` / `runs` / `canUndo` / `canRedo` are gone**, replaced by
  `graph.history`, which covers pivot ingests alongside deletions, hides and hand-drawn
  elements. `graph.history.undo(runId)` reaches an ingest by the same id — but contiguously,
  taking anything done since with it. Pulling one old run out of the middle is
  `graph.removeBySource(pivotId)`. `graph.removeBySource` itself is unchanged.
- **A hand-created node or edge reports `['manual']` from `getSources()`**, not `['seed']`.
  It is vouched for like anything else, so `graph.removeBySource('manual')` reaches hand-drawn
  work and undoing a creation removes the element only when nothing else still vouches for it.
- **`InterractionCallbacks.onNodeExpansion` is gone.** It was declared but never called from
  anywhere in the library, and its signature took an `Edge` where a node was meant. Pivots are
  the door it was pointing at.

### The mode rail takes your own modes

- **`addRailMode` puts a mode of your own on the left rail**, beside Select, Create, View and
  Physics — on `UIManager`, and on a plugin's `ctx`. The rail was picked as the default chrome
  because it scales: modes drop in without crowding it. Until now only we could add one. A
  pointer mode declares `tools` and the contextual panel draws them with the arming, the
  enabled states and the collapse handled for you; arming a `'toggle'` morphs the rail button
  to that tool's icon and label, the way Select's slot becomes `Lasso`. `tools` may be a
  function when the rows depend on the selection, and `render()` adds anything a row cannot
  express, below them. Registered modes render below a divider, after the built-ins.
- **A mode can open a flyout instead.** `kind: 'flyout'` plus a `flyout` factory mounts your
  own panel in the settings overlay, exclusive with View and Physics for free. **`Flyout` is
  now exported** so you can subclass it and inherit its header, section and switch-row
  helpers.
- **`onExit` is called when a mode is left, and when it is removed while active** — the rail
  then falls back to Select. It is not called on UI teardown.

### Breaking

- **`UI.modeRail` is gone**, along with the disabled `Explore` / `Enrich` "SOON" slots it
  showed. They advertised work that was never scheduled, and they occupied exactly the slot
  `addRailMode` now fills — build the mode instead. If you had `UI: { modeRail: … }`, delete
  it; nothing replaces it.
- **`RailMode` is now `string`** rather than a union of the four built-in names, since a
  registered mode's id is arbitrary. `PointerMode` and `FlyoutMode` still name the built-ins.

## 1.6.0 — 2026-08-28

Three headline additions, each of them something a force layout is bad at on its own: a **data
dock** under the canvas — the graph as a sortable, selectable table, a host for panes of your
own, and a place to narrow what the canvas shows — a **minimap** with the renderer viewport API
behind it, and a **filtering legend** in a canvas corner, which now keys several dimensions at
once. Alongside them the layout stopped needing to be configured: physics tunes itself from what
is on screen, it moved into a rail mode of its own, and tree layouts now handle cyclic,
disconnected and data-declared hierarchies. The canvas itself carries more: **edges come in
kinds** that can be styled and switched off without moving the graph, nodes carry **rim
badges**, an **HTML card can be the whole node** rather than a decoration on top of a shape, and
the background is a control rather than a constant. What it draws is measured rather than
guessed: **an edge meets a node on its real border**, and a selected node is **ringed instead of
repainted**. Filtering lost its apply button — the attribute form commits as you set it, the way
the legend and the relationship layers already did. Two contracts got real: every user-initiated
write goes through a before-hook, and every content renderer may return a promise. The breaking
changes are confined to the physics presets — see **Breaking** under *The layout tunes itself*.

### The graph as a table

- **`UI.table` splits a data dock off the bottom of the canvas** — every node and edge as a
  sortable, selectable grid. A force layout is structurally bad at three things people do
  constantly: reading exact values, selecting at scale, and working out where to start. The
  intended loop is *table to find, canvas to understand, sidebar to read*. `full` mode gets a
  dock folded to its header bar; its chevron — or `Shift+T` — shows the table, and
  `UI.table: false` removes it.
- **It lists the whole graph, not the canvas.** Hidden nodes stay listed, with a leading
  `Visibility` column saying where each one stands: `visible`, `filtered` (by the panel) or
  `excluded` (hidden by hand). "23 nodes hidden" is a claim you should be able to inspect, and
  a table that quietly drops the rows you are looking for is worse than no table — each state
  differs in weight and border as well as colour, and a hidden node's whole row recedes. A
  cluster carries a **`Children`** count of its own, and its contents get rows of their own
  too — see *Nodes inside a cluster get rows too*.
- **The Edges tab gets the same `Visibility` gutter**, because a hidden edge that read as
  present was the whole complaint. An edge reads `filtered` when its own layer is switched
  off and **`endpoint`** when an end of it has left the canvas — filtered out, or inside a
  collapsed cluster. The two reasons are independent, and `endpoint` is reported first: while
  a node it touches is gone, switching the layer back on cannot bring the edge back. An edge
  is never `excluded` — there is no hide-this-edge action. Edge columns then read as a
  sentence behind that gutter: `Visibility`, `Source`, `Label`, `Target`.
- **The selection is shared, both ways.** Click, `Ctrl`-click, `Shift`-range and **Select all**
  build the same selection the sidebar's bulk actions read; rubber-band a group on the canvas
  and the matching rows are marked and scrolled to. Double-click centres the canvas on a row,
  hovering one highlights it on the canvas, and `rowActivate` tunes that.
- **Columns derive themselves**, in three tiers: declared `columns` win, otherwise your
  `UI.filter.facets` are reused — describe your data once and the filter panel and the table
  agree about it — otherwise the data is scanned and ordered by coverage, so the well-populated
  keys come first and the sparse tail sits at the far right. Either way the graph-aware columns
  wrap the data: `Visibility` and `Label` lead, and `Degree` (plus `Children`) close the row as
  a narrow, fixed-width pair. The new **`tableColumns`** export names every built-in one for
  cloning: `label`, `degree`, `degreeIn`, `degreeOut`, `visibility`, `pinned`, `children`, and
  `source` / `target` for edges.
- **Every derived column comes with a row filter**, inferred from the column's type: a
  **Min / Max** pair for `numberRange`, a dropdown of the values the column actually holds for
  `select` / `multiselect` / `boolean` (so it never offers a choice that would come back empty,
  and steps aside for a text box past 50 distinct values), a case-insensitive substring box
  otherwise. It narrows what you are *reading* — the canvas is untouched, `Visibility` goes on
  reporting the truth beside it, and the count reads `12 of 40 nodes`. Declared columns are the
  opposite: `filterable: false` unless you say so.
- **CSV and JSON export exactly the view** — this tab, these visible columns in this order,
  this sort, this row filter — as raw values rather than a column's `format` output, so the
  file stays machine-readable. `export: false` drops the buttons, and a sandboxed iframe that
  blocks the download is reported rather than leaving a button that appears to do nothing.
- **Above `virtualizeAbove` rows (200) the rows are windowed**, with the scrollbar still
  measuring the whole dataset. Sorting reorders the underlying array rather than the DOM, and a
  rebuild keeps both your scroll position and your selection.
- The dock is **read-only** and `full` mode only. Hiding and pinning stay with the sidebar's
  bulk actions, restoring a hidden node with the filter panel; what the dock adds is a far
  better instrument for *building* the selection those act on. `graph.openTable()` /
  `closeTable()` / `toggleTable()` drive it from code, and dragging the divider resizes it —
  the canvas keeps a floor whatever you ask for.

### Nodes inside a cluster get rows too

- **A cluster's contents are listed as peers of the graph's own nodes**, with a **`Cluster`**
  column giving the path they came from, outermost first, beside the **`Children`** count of the
  cluster itself. Both appear on any graph that has clusters. A collapsed cluster used to be a
  dead end in the dock — a count of what it was hiding, and no way to read any of it without
  opening the cluster on the canvas first.
- **They are flat, not indented under their cluster.** The table exists to answer what the
  canvas cannot — which nodes are the hubs, which are over a threshold — and that only holds if
  a sort or a filter reaches every row equally. A tree can only ever sort siblings.
- **A nested node is not drawn by this graph**, and the dock says so rather than pretending
  otherwise: an open cluster renders a subgraph of its own, so `Visibility` reads **`nested`**
  while any cluster above the node is shut and `visible` once they are all open. It is never
  `filtered` — no filter put it there. `Degree` stays the node's own arithmetic, counting its
  real edges rather than the stand-in the canvas draws while its cluster is closed.
- **Clicking a row selects the node** — often the only way to reach it at all — and
  **double-clicking opens the cluster hiding it**, one level per press. An export carries the
  nested rows and their path along with everything else.
- **`UI.table.nested: false`** never offers them, and the header's **Nested nodes** switch takes
  them back out for a reader who only wants the top level, leaving `Children` as all a cluster's
  row says about its contents. The switch leaves the bar while the dock is folded, and the edges
  tab never shows it.

### The table can filter the graph

- **`Apply to graph`, in the data dock's toolbar**, hides the elements the column filters leave
  out — the bridge between narrowing what you *read* and narrowing what the canvas *shows*.
  Narrow the rows until the table lists what you care about, press it once, and the graph shows
  the same thing. Nothing happens until it is pressed, so a column filter is still reading by
  default and the `Visibility` column goes on reporting the truth beside it.
- **Three states in one button.** Unlit `Apply to graph` means nothing is pushed, and it stays
  disabled until a filter is actually narrowing something; lit `Clear` means the graph is
  filtered and agrees with your filters; lit `Apply to graph` means an earlier push is still on
  the canvas and the filters have moved past it. Staleness is decided by comparing what *would*
  be hidden rather than by whether a control moved — so two different filters that exclude the
  same rows leave the button settled, and data changing underneath re-offers the press.
- **It hides exactly what the filters left out**, never "show only these". A node that arrives
  after the push stays on the canvas, and an expanded cluster's interior is left alone: the
  engine hands active filters down into a cluster's own engine, where a show-only-these filter
  would blank the lot. The `Visibility` column is never part of a push, though it still narrows
  rows like any other — its values *are* the graph's filter state, so pushing them would hide
  whatever is on the canvas and then disagree with itself.
- **Both tabs push independently.** Nodes hides nodes; Edges hides relations through the layer
  flag, which repaints without moving the layout. Both can be live at once.
- **It composes with the filter panel instead of competing with it.** The push lands as a single
  filter under a reserved key, so nothing the panel's own form applies ever clobbers it and it
  never clears the panel's filters — a node has to survive both. The panel grows a
  **From the table** row naming what the push is hiding, and clearing it there un-lights the
  dock's button: the form structurally cannot show a reserved key, and a filter you cannot find
  once the dock is folded away is worse than none. While a push is live the dock's count reports
  both halves — `12 of 40 nodes · 28 hidden`.
- **`UI.table.filterGraph: false`** leaves the button out, for a dock whose controls can never
  touch the canvas at all.

### The dock holds more than the table

- **`UIManager.addDockTab({ label, render, toolbar })` registers a pane beside the table** and
  returns a disposer; a plugin reaches the same door as `ctx.addDockTab`. The table is not a
  special case — it comes through `addDockTab` too, so a pane you register is its equal rather
  than its guest, placed by `order`.
- **Switching swaps the body *and* the header controls**, since `Select all`, the exports and
  `Columns` belong to the table and mean nothing over another pane. One pane renders no strip at
  all — nothing should point at a switch with one setting — and registering a pane **brings the
  dock into being**, so a plugin's pane needs nothing turned on but `full` mode and works with
  `UI.table: false`.
- **A pane's own views stay inside it.** `Nodes` / `Edges` are two views of the table, not two
  panes, so they are drawn as a small segmented group rather than beside another pane's tab.
  Both levels are public — `pvt-dock-tabs` / `pvt-dock-tab` outside, `pvt-dock-views` /
  `pvt-dock-view` inside — and both take their active accent from `--pvt-theme-primary`, so a
  consumer that retints the theme retints the dock with it. `DockTabHandle.refresh()`
  re-invokes `render` to change body; the dock keeps the element it was handed, so a pane that
  swapped its own DOM behind its back would have a stale node re-attached on its next
  activation.
- **New `UI.dock`.** `open`, `collapsed` and `height` describe the *region* rather than the
  table, which makes it the only door to a dock the table is switched off in. `UI.table`'s
  copies of the three are still honoured, and `UI.dock` wins where both are set. There is one
  region, so there is one height and one fold however many panes are in it.
- `UIManager.dock`, `activateDockTab(id)`, `getDockTabs()`, `removeDockTab(id)` and
  `refreshDockTab(id)` round it out. `render` is called once, lazily, the first time a pane is
  opened — so it keeps its own scroll position — `toolbar` is rebuilt on every activation, and
  `onActivate` / `onDeactivate` are the only signal that a pane is off screen.

### A minimap, and the viewport API behind it

- **`full` mode mounts a minimap**: a cached overview of the whole graph in a canvas corner,
  with a rectangle showing what is on screen. Click it to recentre, drag the rectangle to pan,
  and a very small toggle folds it away to just that button. `UI.minimap` configures it and
  `UI.minimap: false` suppresses it; `light` and `viewer` get one by asking — `UI.minimap: true`,
  or `plugins: [minimap()]` for the plugin it is (a new export, on the browser global too).
  `static` promises no interactions, so it is not mounted there and installing it warns.
- **Navigating costs the same at any size.** The graph is kept in an offscreen bitmap that is
  re-rasterised only when the picture actually changed — a data change, a filter hiding or
  restoring nodes, a node dropped after a drag, every 10th tick while a layout settles, a
  resize — so panning and zooming redraw one image and one rectangle whether the graph has 20
  nodes or 50,000. Detail degrades on purpose: past 1500 nodes no per-node style is resolved at
  all and dense regions read as a density map.
- **The one `full` mode mounts opens `collapsed: 'auto'`.** A minimap you asked for stays where
  you put it; this one was not asked for, so it stays open while the canvas is at least four
  minimaps wide and tall and folds itself away below that — following the canvas as the sidebar
  opens over it or the window narrows. The moment anyone folds it by hand, or calls
  `setCollapsed()`, that stops: an explicit choice sticks.
- **New renderer viewport API**, which is all the minimap is built on: `getContentBounds()`
  returns the extent of everything drawn in graph coordinates, and
  `setViewport({ x, y, scale?, animate? })` puts a graph-space point in the middle of the canvas
  — leaving the scale alone unless you pass one, so it is the primitive for panning. Reading
  where the view *is* stays renderer-agnostic: invert the canvas corners with
  `screenToGraphCoordinates`.

### A legend that filters

- **`UI.legend` docks a legend in a canvas corner** — a swatch, a label and a node count per
  category — and **clicking a row hides that category**, which makes it the fastest filter in
  the UI. `Alt`-click shows only that one; the header offers show-all, invert and a fold
  chevron. Rows are real buttons — tab-reachable, `aria-pressed` carrying the state — and a
  hidden row is drawn with a hollow swatch as well as dimmed text, so colour is never the only
  signal.
- **A toggle writes to `graph.queryEngine`**, so nothing about it is a second, parallel
  mechanism: nodes added later into a hidden category arrive hidden, a hidden category stays
  hidden inside an expanded cluster's subgraph, `resetFilters()` re-lights every row, and with
  every row shown the filter is *removed*, so the header's active-filter count never reports a
  legend that is hiding nothing. Every toggle is announced as **`legendToggle`** on the data
  event bus.
- **Point `key` at a declared `select` / `multiselect` facet and the legend drives that facet's
  key** — the legend and the filter panel become two views of one filter, each following the
  other. Otherwise the legend owns a reserved `__legend` key matched through a predicate.
- **A legend can appear unasked**, but only where it is guaranteed to tell the truth:
  `render.nodeTypeAccessor` must be declared *and* explain the colours — one colour per
  category, at least two distinct colours, at most 24 categories. Fail any of that and nothing
  is rendered and nothing is logged; you didn't ask for one. `UI.legend: true` lifts the
  vetting (and the 5000-node ceiling), `false` turns it off, and `graph.setLegend(config)`
  replaces it at runtime — clearing its filter when it goes, so nothing stays hidden behind a
  legend that is no longer there.
- **The legend is descriptive, never prescriptive.** It reads the colour the renderer already
  resolved for a node and reports it, so changing a palette moves the legend with it; a
  category painted in more than one colour keeps the first and warns.
- **`sections` keys a graph on several dimensions at once.** A graph that encodes kind in the
  fill, provenance in an enclosure and sharing in the stroke needs three keys, not one:
  `UI.legend: { position, sections: [...] }` stacks a titled block per dimension in one docked
  card, in declaration order. A section takes everything a single legend takes except
  `position`, which belongs to the card, and is independent in every other way — its own
  entries, its own counts, its own fold state, its own filter. Sections fold individually and
  **alt**-clicking any chevron folds the stack; a section that resolves to no entries is
  skipped rather than drawn as an empty titled box, and the card is capped against the canvas
  height and scrolls rather than growing past it.
- **Each section drives its own filter, and they and together.** A section writes to
  `__legend:<id>` — its `id`, else its `key`, else `section-<index>` — while the single-key
  object form keeps the plain `__legend` it has always had, and a section whose `key` names a
  declared facet drives that facet exactly as a lone legend does. Switch `attribute` off in one
  section and `self` off in another and what stays on the canvas is the nodes that are neither;
  each section's `show all` clears only its own. **`legendToggle` gained a `section` field**
  naming the section that was toggled.
- **A section with neither `key` nor `entries` is the `render.nodeTypeAccessor` dimension** —
  the one way to spell a styling dimension that isn't a plain data key — and it skips the
  colour check, since inside a `sections` list you asked for it. Only one section may do this;
  a second is dropped with a warning.
- **The legend can only sample colour**, so a section keyed on a dimension the colours don't
  encode — provenance, when provenance is drawn as an enclosure — takes the first node's colour
  and warns that the category renders more than one. Declare `entries` with your own `color` on
  that section for swatches that mean something.
- One section renders byte-identically to the single-key legend, so the stacked form costs a
  graph that doesn't use it nothing. The state classes `pvt-legend-collapsed` /
  `pvt-legend-static` moved from `.pvt-legend-panel` to `.pvt-legend-section`, which is where
  the state now lives.

### Edges come in kinds

- **`render.edgeTypeAccessor` and `render.edgeStyleMap`** mirror the node pair: a function
  returning an edge's kind, and a map from kind to a partial `EdgeStyle`. Per-kind edge styling
  was possible before only as a hand-rolled `switch` inside `styleCb` — which still wins over
  the map, exactly as it does for nodes.
- **`UI.filter.edgeFacets` turns those kinds into *layers* you can switch off.** Declared like
  node facets but read off edge data, with edge-shaped defaults — a layer is a `multiselect` and
  its options are derived from the graph's real edges — so `{ key: 'kind' }` is a complete
  declaration. The full facet vocabulary applies (`text`, `regex`, `select`, `multiselect`,
  `numberRange`, `boolean`, plus `accessor` and `predicate`), and nothing is ever auto-derived:
  a graph that declares no edge facets behaves exactly as one that has never heard of layers.
- **Switching a layer does not move the graph.** Layout, selection and camera are bit-for-bit
  unchanged, because the link force gates on the new `Edge.visibleIgnoringLayer` rather than on
  `visible` — an edge whose layer is off goes on pulling its endpoints together. Which is what
  the professional tools do: vis-network carries `hidden` *and* a separate per-edge `physics`,
  Sigma's `edgeReducer` never reaches the layout, Cytoscape and KeyLines move only on an
  explicit layout call. A hidden relation is a display decision, not a layout one.
- **A node left with no visible edges stays visible.** Hiding it is a node-filter decision,
  and an edge facet never takes one — see `UI.filter.hideDisconnected` below for the opt-in
  that does, on the node side, where it can admit that it moves the graph.
- **The filter panel grew a live `Relationships` section**: one toggle per relation kind, each
  with a **line** swatch — stroke colour, dash and marker as the renderer resolved them — and
  each applying at once rather than waiting behind the panel's apply button, since the legend
  right beside it toggles instantly. A non-multiselect edge facet is a batch control, so it
  stays in the attribute form with the node facets.
- **A legend section takes `scope: 'edge'`**, listing the kinds with that same line swatch
  beside node-scoped sections in one card. Given a matching `edgeFacets` declaration it drives
  that facet, so the panel and the legend become two views of one filter; without one it
  reserves a facet of its own and still filters.
- **New on `Edge`:** `layerVisible`, `setLayerVisible()`, `visibleIgnoringLayer` and
  `representedEdges`. `visible` has five independent writers — endpoint filtering, cluster
  collapse, the cluster drawer, `hideNode` / `showNode`, and normalisation — so layer state
  could not live in it. `layerVisible` is a veto instead: `show()` is now
  `visible = layerVisible`, and none of the five writers had to change.
- **A collapsed cluster's stand-in edges filter properly.** Stand-ins are deduped by node
  *pair*, so one can speak for several real relations of several kinds; each now carries the
  real edges it represents and survives while any of them passes the filter. That is also what
  makes every facet type reach inside a collapsed cluster rather than just a list of kinds, and
  a stand-in whose edges share one kind inherits that kind's style.
- **New on the query engine:** `setEdgeFilter`, `getEdgeFilters`, `removeEdgeFilter`,
  `getHiddenEdgeCount`, `getEdgeFacetValues`, `setEdgeFacets` and
  `replaceFilters(ownedKeys, filters)`. Edge filters share the one `GraphFilters` record under an
  `edge:` prefix (`EDGE_FILTER_PREFIX`, exported from `GraphQueryEngine`) that every one of those
  methods hides — so a key name may be a node facet and an edge facet at once.
- **`renderer.getEdgeStyle(edge)` is public**, promoted onto the `GraphRenderer` abstract beside
  `getNodeStyle` — both renderers already resolved edge style privately, so this is exposure
  rather than new logic. The canvas renderer's copy gained `edgeStyleMap` and lost an
  `opacity: ...?.color` typo; it still resolves only four of the nine `EdgeStyle` properties.
- **An empty edge pick means every layer off**, unlike a node multiselect where an empty list is
  how the panel spells *unset* — there is nothing else an emptied layer list could mean.

### Nodes with nothing left attached

- **New `UI.filter.hideDisconnected`** hides a node once it has no **visible** edge — the
  orphans an edge-layer toggle strands. Counted after the layers *and* the node filters have
  had their say, so it reflects what is actually drawn rather than what the data holds. A
  self-loop counts as a relation; a note pinned to a node does not.
- **The View flyout carries the same switch — *Hide unconnected* — on every graph**, whether
  or not the option is declared, so a user can clear the orphans a layer toggle left or put
  back the ones you hid. While it is hiding, the row reports how many.
- **This is the one control in the release that moves the graph, and it says so.** A hidden
  node leaves the simulation, so the rest re-settle. That is exactly why it is a *node* rule
  and not something the layer control does for you: an edge layer stays a lens, and anyone
  who wants a tidy canvas instead opts in. Off by default.
- **Two things it deliberately does not do.** A cluster's interior is left alone — clusters
  routinely group nodes with no relations between them, so applying the rule inside one would
  open an empty box. And nothing is protected: switch every layer off and nothing is
  connected, so nothing is drawn, with the switch as the way back.
- **New on the query engine:** `setHideDisconnected()`, `isHideDisconnected()`,
  `getDisconnectedNodeCount()`, and **`reapply()`** — filters are applied when a *filter*
  changes, not when the data does, so a node that has just been given the edge it was
  missing stays hidden until something recomputes. Worth knowing before you call it:
  re-deriving visibility undoes a manual `graph.hideNode()`, which nothing remembers;
  `queryEngine.excludeNode()` is the hide that survives, and it is what the context menu and
  the bulk actions already use.
- **Filters now apply before the first layout**, not after it: a node the filters mean to
  hide never reaches the canvas and is not in the graph the opening fit frames.
  `setVisibleNodes` gained a `notify` parameter (defaulted, so nothing changes for existing
  callers) for that first silent pass, and one predicate now answers "would this edge be
  drawn" for both the commit path and the query engine's look-ahead.
- **Flyout switch rows grow instead of clipping.** They were a fixed 36px, which cut a
  wrapping label in half; they are `min-height` now, and `.pvt-flyout-toggle-note` is a new
  public hook for a row that reports on its own effect (a count, with the sentence in its
  `title`).

### Badges on a node's rim

- **`NodeStyle.badges` is a decoration channel of its own** — small indicators pinned to the
  node's rim, what KeyLines and ReGraph call *glyphs* — so a node can carry a fact that `color`,
  `shape`, `size`, `iconClass` and `imagePath` are already spent on. An array, or a function of
  the node; each badge takes `text` (a count, or a character or two), an `iconClass` /
  `iconUnicode` / `svgIcon`, a `color`, a `title` rendered as a real `<title>`, and an
  `onClick`. `text` wins over an icon on the same badge, longer text grows it into a pill, and
  past three characters it renders `99+`.
- **Four fit on a plain node, two on one with children.** Omit `position` and badges fill the
  free corners clockwise from `'ne'`; name one (`'ne' | 'nw' | 'se' | 'sw'`) and it is honoured
  verbatim, overlaps included. The expand affordance sits north-east while a node is collapsed
  and south-east while it is expanded, so on any expandable node *both* East corners are
  reserved — otherwise every badge would change corner the moment a cluster opened. Anything
  past capacity folds into a `+n` whose tooltip names the rest.
- **They sit on the shape's real rim** — the corner of a square or a framed picture, the 45°
  point of a circle — through one anchor shared with the expand icon, and they scale with the
  node between a floor and a ceiling, so they stay legible on a tiny node without swelling on a
  large one.
- **A badge is transparent until you give it a handler.** With no `onClick` its click falls
  through and selects the node underneath, so a badge is never a dead spot. Declare one — or
  `callbacks.onBadgeClick` for behaviour every badge shares — and it takes the pointer cursor
  and consumes its click, leaving the node unselected. Both fire, the badge's own first, and a
  `badgeClick` listener on the interaction bus can `cancel()` both. Pressing a badge still drags
  the node either way.
- **Badges describe only the node they sit on.** A collapsed cluster does not aggregate its
  children's — walk `node.children` in your own `badges` function if that is what you want,
  since only you know whether a fact sums, wins, or neither.
- Resolved like every other channel: the narrowest declaration wins outright rather than
  merging, so a node's own `badges` **replaces** what `nodeStyleMap` or `defaultNodeStyle` gave
  it. `[]` is how a node says it wears none; `undefined` renders no badge group at all.

### An edge meets a node on its own border

- **Every anchor is measured from the shape that was drawn**, rather than from a circle around
  it. Straight edges, curved ones, self-loops, note connectors and the edge-creation preview all
  stopped at a single scalar radius — `getCircleRadius()`, or the style's `size` — and one number
  cannot fit a box with two different half-extents: it is too long for the short axis and too
  short for the long one, so the same node showed a gap above and below while the edges on its
  sides ran in underneath it. The node drawers now report the box they actually rendered, and
  each of those five places asks for the distance to that border along its own direction.
- **A circle is untouched.** A node with no measured border falls back to its radius, which is
  what a circle, an icon and a plain sized node still are — so a graph of round nodes looks
  exactly as it did.
- **A card is measured at any zoom.** An `html` node's border comes from its own content rather
  than from the placeholder box it was first rendered into, so its edges meet the card's edge
  whatever the zoom was at the time.
- **New on `Node`:** `setBorderBox(width, height)`, `getBorderBox(outset?)` and
  `getBorderDistance(dirX, dirY, outset?)`, with the `NodeBorderBox` type. A custom drawer that
  paints its own shape can declare its border and get the anchoring for free — but
  `setCircleRadius()` **clears** any measured border, so call `setBorderBox()` *after* it, never
  before.

### HTML nodes compose

- **`shape: 'none'`** draws no shape, so an `html` card *is* the node: its measured box drives
  the collision radius and the edge anchors instead of `size`. Previously a card was always
  drawn on top of a shape, and `size` was the smallest the node could be — which left
  `render.renderNode` as the only way to a card standing on its own, and that replaces the
  styling chain for the whole graph. A card is now something you give one type of node
  (`nodeStyleMap[type].html`) or one node, beside every other style channel.
- **A card no longer has to be self-sizing.** It is measured inside a shrink-to-fit box of the
  library's own, so a root declared `width: 100%` — the natural way to write "fill the node" —
  resolves against its own content instead of collapsing onto the placeholder box and being
  squeezed into it. A card returned as a **string** is measured too; it never was.
- **Returning nothing means "not this one".** Both `renderNode` and `html` have always been
  typed to allow it, but a void return left an empty 20×20 card rather than falling through. A
  callback can now card a few nodes and leave the rest their shapes, icons and labels.
- **A card-only node has a selected and a hovered look.** Both are drawn on the node's shape
  element, so a custom node had neither; it now keeps an invisible box, sized to the card, which
  also makes it clickable and draggable over its whole extent.
- **A label with no shape under it stays readable.** It gets the themed label colour and pill
  rather than the node text colour, which is white by default — and so was drawn white on the
  canvas. A shapeless node with a `text` and no card is a bare label; with neither, it is
  invisible but still there.

### A selected node keeps its colour

- **Selection draws a ring instead of repainting the node.** A selected node used to have its
  fill replaced by the selection colour, which threw away the one thing the colour was there to
  say — a node encoding its type, its cluster or its score went uniformly lobster the moment you
  clicked it, and in a sidebar's neighbour graph the focal node was indistinguishable from a
  genuinely red one. It now keeps its own `color` and takes the selection colour on its rim, the
  way a highlighted node already did.
- **Selection outranks highlight on the rim they now share.** Both states paint the same edge, so
  a node that is selected *and* highlighted — hovering its table row, following a note's
  `[[node]]` link — keeps the selection colour rather than reading as though it had been let go
  of.
- **A card-only node rings its card.** `shape: 'none'` leaves an invisible box under the card for
  the state looks to land on; a ring is drawn centred on that box's edge, so it clears an opaque
  card where a fill behind it could not. The box stays exactly the card's size, since the badge
  rim and the pointer hit area are measured off it too, and it takes the card's `border-radius`
  so the ring is not a sharp box around a rounded card.
- **`--pvt-node-selected-stroke-opacity` now defaults to `1`.** Zeroing it was what actually hid
  the selection ring; `--pvt-node-selected-stroke-width` never applied, because the pulse
  animation sets a width of its own and an animated declaration wins. Both are still yours to
  override — set the opacity to `0` for the old fill-only look.

### Selecting an edge shows

- **A selected edge is painted again.** It had stopped entirely: the class that carries the
  selected look was only applied while an edge was being *redrawn*, and selecting one
  deliberately does not redraw it — a full redraw recreates the label and loses the listeners
  hung off it. So nothing ever added the class, and a selected edge looked exactly like an idle
  one. It is now applied on each render pass, the way a node's selected state already was.
  Deselecting takes it off again, and an edge selected as part of a multi-selection lights up
  too, which it never did.
- **A highlighted edge no longer vanishes in the dark theme.** Edges borrowed
  `--pvt-node-highlighted-stroke-width`, which is `0` there — harmless on a node, whose pulse
  animation overrides it, and fatal on an edge, which has no animation. Edges now have their own
  `--pvt-edge-highlighted-stroke`, `-stroke-width` and `-filter`.
- **A highlighted edge gets its glow.** The rule sat outside the `.pvt-edge-group` block, so it
  tied with that block's own `path` rule and lost on source order — the highlight's `filter` was
  never applied in either theme. Selection still outranks highlight on an edge, as it now does on
  a node.
- **The light theme's selected edge is the selection colour, not orange.** Its glow and its
  label outline were hard-coded `orange` while the dark theme, and every other selected thing,
  used the selection colour.
- **A state look never draws thinner than what it decorates.** The selected and highlighted
  widths were fixed, and these rules *replace* the stroke they land on — so a node with a 12px
  border got a 3px ring, and a 14px edge dropped to 3px on highlight. They are floors now: a
  stroke already past the floor grows by `--pvt-state-stroke-boost` instead. A default-width
  node or edge is unchanged, and the node pulse breathes around the resolved width rather than
  a hard-coded 3.

### The layout tunes itself

- **`Auto` is the new default physics preset.** Rather than applying one fixed bundle of force
  settings to every graph, Pivotick now derives them from what is on screen — node count, node
  size, canvas size, how fragmented the graph is — and re-derives them whenever the visible graph
  changes. Four small nodes get room to breathe; forty large ones get spread far enough apart to
  read as clusters instead of a carpet.
- **Existing configuration is never taken over.** Auto is on only for graphs that configure none of
  the options it drives (`d3LinkDistance`, `d3ManyBodyStrength`, `d3CollideRadiusMultiplier`,
  `d3VelocityDecay`, `d3GravityStrength`, `d3GravityStrengthConnected`, `d3AlphaDecay`,
  `cooldownTime`). The new **`simulation.physics: 'auto' | 'manual'`** forces it either way;
  `'auto'` alongside explicit d3 options is legal — they seed the opening frame and auto takes over.
  Turning any knob by hand (a slider, a `set*` call, a preset) also leaves auto, permanently.
- **Auto only ever moves knobs you can see**, and the flyout sliders follow it as it re-tunes. It is
  force-layout only (inert under `tree` / `egoTree`), coalesces triggers that arrive together, skips
  changes too small to see, and never restarts a simulation that is paused.

#### Breaking

- **`PhysicsKnobs` gained two fields, `centering` and `settleTime`** — a widening, so code reading a
  knob bundle is fine, but code *constructing* one must now supply six values. `centering` drives
  the gravity strengths (`d3GravityStrengthConnected`, with `d3GravityStrength` following as a
  multiple); `settleTime` drives `d3AlphaDecay` **and** `cooldownTime` together, since moving either
  alone does nothing.
- **`PHYSICS_PRESETS.default` is gone**, along with `'default'` from `PhysicsPresetName`. It was an
  alias of `loose` rather than the library's actual defaults, and `Auto` replaces the concept — the
  flyout's preset row is now `[Auto] [Tight] [Loose]`. Both remaining presets gain `centering: 7`,
  reproducing the historical gravity (0.001 / 0.1) exactly; `loose` also keeps its four original
  values and the historical alpha decay (`settleTime: 2.25` → 0.05).
- **`PHYSICS_PRESETS.tight` is re-tuned to `friction: 45`, `settleTime: 3`** (from 58 / 2.25). Its
  old numbers paired the heaviest damping in the set with the shortest settle, which is a
  contradiction — damping is what makes a layout take longer to arrive — and the result was that
  clicking `Tight` moved the graph roughly half way to where `Tight` actually settles. The settled
  look is unaffected (`friction` shapes the approach; at rest, velocity is zero either way), and
  `tight` is still clearly the calmer preset. See `prd/archive/physics-preset-reheat.md`.
- **`PHYSICS_KNOB_RANGES.linkDistance` is now `[40, 600]`** (was `[40, 260]`). The knob maps to
  pixels one-for-one, so every existing value is unchanged; only a UI rendering the slider's `max`
  sees a difference. The old ceiling made it impossible to put visible space between two large
  nodes — 260px leaves 140px between a pair of 120px discs.
- **Removed private API:** `Simulation.scaleSimulationOptions` and
  `Simulation.applyScalledSimulationOptions`, both `@private` and both dead (commented out at all
  three call sites). They were an abandoned earlier attempt at this feature.

### Physics is its own rail mode

- **Layout and simulation moved out of the View flyout into a Physics flyout**, opened by a new
  `Physics` slot on the mode rail. View keeps the grid and canvas switches (snap, highlight,
  freeze-on-drag, fit-on-expand/collapse); Physics carries the layout picker — a tile per layout,
  one click each, replacing the dropdown — and the simulation card (presets, live sliders,
  run/pause). Both are rail modes, so they exclude each other and the pointer-modes exactly as View
  always did.
- **New `UIManager.physicsFlyout` accessor** (`PhysicsFlyout`), alongside the existing
  `viewFlyout`. Both flyouts now share a base class and one DOM slot.
- `ModeStore`: `RailMode` gained `'physics'`, with a `FlyoutMode` union and an `isPointerMode`
  guard for the modes that own pointer tools. `toggleFlyout(mode)` / `isFlyoutActive(mode)`
  replace `toggleView()` / `isViewActive()`, which still work but are deprecated.
- **CSS hooks changed.** The flyout slot is `.pvt-flyout` (was `.pvt-viewflyout`) and each panel
  is `.pvt-flyout-panel.pvt-flyout-view` / `.pvt-flyout-physics`. The shared chrome — header,
  section label, icon, switch rows — is `.pvt-flyout-*` (was `.pvt-viewflyout-*`); the layout and
  simulation controls are `.pvt-physicsflyout-*`.

### The canvas background is a control

- **A `Background` card in the View flyout** picks the canvas pattern — `Grid`, `Dots`, `None`
  or `Image` — and the colours behind it: a neutral swatch row plus a custom picker, for the
  canvas and, under a pattern, for the grid lines. The first swatch is a reset that drops the
  override and hands the colour back to the theme, and the picker opens on the theme's own
  accent, so the row spends no slot reaching for it. Under `Image`, a URL or a file picked from
  the device, sized `Cover`, `Contain` or `Tile`.
- It writes nothing but classes and CSS custom properties on the canvas element —
  `pvt-bg-dots` / `pvt-bg-none` / `pvt-bg-image`, and `--pvt-bg`, `--pvt-graph-grid-color`,
  `--pvt-bg-image-url` / `-size` / `-repeat` — so every one of these looks is reachable from a
  stylesheet without the flyout. `Grid` is the stylesheet's default rather than a class of its
  own, so it is the absence of the other three.
- **Both flyouts now share their chrome.** The card box and the segmented button group hoisted
  into the `Flyout` base as `.pvt-flyout-card*` and `.pvt-flyout-btn-group*`; each flyout keeps
  a class of its own only where script or a spec reaches for the element.
- **Removed `--pvt-graph-grid-color-highlighted`.** *Highlight grid* thickens the grid lines
  rather than recolouring them, so nothing had read the variable and overriding it was a no-op.

### Tree layouts no longer need a perfect hierarchy

- **A cycle no longer costs you the tree layout.** A single back-edge used to disable all three tree
  layouts outright, with a "the graph contains a cycle" warning — which, for most real data, meant
  the feature was unavailable. The hierarchy is now built from a breadth-first **spanning tree**:
  the first edge to reach a node is its parent, an edge arriving at an already-placed node is drawn
  crossing levels like any other, and a node with two parents is claimed by exactly one instead of
  being laid out twice.
- **Disconnected graphs lay out too.** Each component the root cannot reach gets its own root
  (preferring one with no incoming edges) and the components are drawn side by side. Previously such
  nodes had no place in the hierarchy at all, and the tree forces — which fall back to `0` for a
  node they have no position for — quietly piled them onto the origin.
- **Nodes with no edges at all are parked out of the way.** Giving them a slot in the hierarchy put
  them on the root's own row, packed tight against it, reading as the root's children. They now fill
  the dead space beside the shallow levels at the trailing edge of the layout — space a tree leaves
  empty because it widens as it descends, and which is *inside* the layout's bounding box, so parking
  them there does not zoom the tree out. The radial layout gives them a ring of their own outside the
  last. Only nodes with no edges in *either* direction qualify, so no edge is left stretching from
  the tree to the parking area.
- **`Collision radius` stays live under a tree layout.** It is the one force a tree does not zero,
  and it goes on keeping neighbours apart along whichever axis the layout leaves free, so disabling
  it with the rest was wrong. Still disabled under the radial layout, which pins both axes.
- **Fixed: a node with no usable radius no longer blanks the layout.** A non-numeric
  `getCircleRadius()` — a custom node that has not measured itself yet — turned a measured gap into
  `NaN`, and from there the spacing multiplier and every coordinate derived from it.

### A tree can be re-rooted, and its shape declared

- **The Physics flyout picks the tree's root.** The `Root` row is a named menu — each finder,
  saying what it does, plus "the node I have selected", greyed out until exactly one node is
  selected — and once a node is pinned the row shows its label rather than a finder's name.
  `simulation.setTreeRoot({ rootId })` / `({ algorithm })` and `getTreeRoot()` are the runtime
  equivalent. A `rootId` naming a node that is not being laid out (filtered out, deleted, inside
  a collapsed cluster) is ignored for as long as that is true, and re-roots the tree the moment
  it comes back.
- **A named `rootId` is walked ignoring edge direction**, so any node can root a whole tree:
  pick a leaf and the graph re-hangs beneath it, with its former parent one level down.
  Following the arrows from a leaf would reach nothing and lay the rest of the graph out beside
  it as a second component. The edges are still drawn exactly as they are, so a link used the
  other way round renders as an arrow pointing up a level.
- **A layout whose arrows are not a hierarchy stops reading direction.** On data that
  *converges* — every leaf a source, all of them pointing at a few hubs, which is the shape of
  most provenance and "seen-with" data — no node reaches the graph along the arrows whichever
  finder is asked, and a directed walk leaves a comb of stubs with most edges flying across the
  layout. So when **no node at all** can cover half of its own component by following the
  arrows, the layout walks every edge both ways and re-roots at the middle of the graph. It is a
  fallback, and the test is about the graph rather than the root that was picked: where the
  arrows do form a hierarchy every finder keeps its own answer, and a graph of several separate
  hierarchies still comes out as a forest. This replaces the `flipEdgeDirection` option, which
  no single value could get right for two datasets at once.
- **New `layout.parentKey` / `layout.depthKey` let the data state the hierarchy** instead of it
  being inferred: the `node.data` key holding a node's parent id, and the key holding the row it
  sits on, counting from `0`. Both are unset by default and optional per node — a node with no
  declared parent gets one from the edges, a node with no declared row sits one below its parent
  — so a graph that declares neither is laid out exactly as it always was, and a graph that
  happens to carry a `depth` or `parent` field is unaffected until you name the key.
- A declared parent is honoured **whether or not an edge joins the pair**, which is how a node
  with several incoming edges says which one is its real parent, and how an edgeless node gets a
  place in the tree instead of the parking area — but such a branch is drawn with no line along
  it, because there is no edge there to draw. A declared row can only push a node **further
  down**: a row that is not below its parent's is clamped to `parent + 1` and a warning names
  how many were, and rows the data skips stay empty and take up real space, which is what makes
  a declared row mean anything. Declarations that name a node which is not being laid out, close
  a cycle, or hold something that is not a row number are dropped for that node — which falls
  back to the edges — with one warning tallying them. `rootId` outranks `parentKey`; `egoTree`
  ignores both.

### A tree layout works out its own spacing

- **`Auto` is the default for tree spacing.** A tree layout is sized from the canvas and never looks
  at how big its nodes are, so a tree of 10px dots and a tree of 40px avatars were laid out
  identically — and the second one overlapped. Auto now measures the tightest pair of neighbours on
  each axis, works out what their radii need (plus room for an arrowhead between levels), and scales
  `levelSpacing` / `siblingSpacing` to suit, re-deriving them whenever the graph changes. Exact
  rather than iterative: a gap scales linearly with its multiplier, so one correction pass is enough.
- **It never packs a tree tighter than the fitted layout**, only looser — so a graph that was never
  crowded is laid out exactly as before, bit for bit. And it never takes over a decision: a tree
  that sets either multiplier explicitly keeps it, and dragging either slider leaves auto for good.
  The new **`layout.spacing: 'auto' | 'manual'`** forces it either way, with
  `simulation.enableAutoTreeSpacing()` / `isAutoTreeSpacingEnabled()` to drive it at runtime.
- **In the radial layout both measurements drive the ring gap**, since a level always spans the full
  circle and pushing the rings out is the only way to relieve crowding within one.
- **The spacing ceiling is now `10×`, up from `4×`.** With auto able to report what a tree asks for,
  `4` turned out to be below what ordinary graphs need: 120 nodes want 4.9× between siblings, 200
  want 5.4×, a 100-level chain wants 6.1× between levels, and a 200-node radial tree wants 9.3×
  between rings. It stops at 10 because past that the view is fitted so far out that the extra room
  buys nothing a reader can use.

### A tree layout can be spread out by hand

- **Two spacing sliders for tree layouts.** A tree places its own nodes, so the physics knobs have
  nothing to do — they grey out, and until now that left no way to open up a cramped hierarchy. The
  Physics flyout now offers **Level distance** and **Sibling distance** in their place: multipliers
  on the canvas-fitted geometry (`0.5×`–`10×`), applied live and reframed when the drag ends. The
  inert simulation knobs are hidden rather than greyed while a tree is active; the run/pause toggle,
  which still bites, stays.
- **New tree layout options `levelSpacing` / `siblingSpacing`** (both default `1` — the fitted
  layout, unchanged), plus `simulation.setTreeSpacing()` / `getTreeSpacing()` to drive them at
  runtime. `siblingSpacing` has no meaning under `radial`, where a level always spans the full
  circle, and its slider is disabled there.
- **Fixed: a horizontal tree budgeted both its axes from the wrong canvas dimension** — depth was
  sized from the canvas *height* and breadth from its *width*, then swapped on assignment, so a
  left-to-right tree on a 1280×720 canvas got 720px for its levels and 1280px for its siblings.
- **Fixed: the radial force and the radial layout described different pictures.** The force used a
  hard-coded 100px per level while the layout divided `radialGap` across the tree's depth. It goes
  unnoticed on the main thread (radial pins both axes, so the force never gets a say), but the
  worker path is driven by the force alone — the same options drew two different layouts.
- **Fixed: a re-laid-out tree fought its own forces.** `forceX` / `forceY` / `forceRadial` cache
  their per-node target when initialised, so recomputing tree positions without re-registering them
  left every force pulling nodes back to the previous layout — visible as the pinned axis moving
  while siblings snapped back.

### The filter panel's facets can be declared

- **New `UI.filter.facets` replaces auto-derivation with a declaration** — exactly the fields
  you list, in the order you list them, with your labels used verbatim so they can come from a
  translation layer. Derivation is a good zero-config default for exploratory data but has no
  way of knowing which keys are facets and which are internals: a `uuid` becomes a dropdown with
  one option per node. Declared facets skip it entirely, so nothing churns as the data changes.
  **`UI.filter.excludeKeys`** is the cheap fix where derivation is nearly right.
- A facet's `key` is the key `queryEngine.setFilter(key, …)` uses, so the panel and programmatic
  filtering stay on the same footing. The types are `text`, `regex` (compiled
  case-insensitively, with an uncompilable pattern reported on the field), `select` /
  `multiselect` (options as an array, or a function resolved against the live graph),
  `numberRange` and `boolean`; `order` places a facet explicitly when the set is assembled from
  several places.
- **`accessor` and `predicate` cover the facets that are not a data key at all.** An `accessor`
  reads whatever you like — including a node's children, for "contains an attribute of type X" —
  and returning an array is matched by membership; a `predicate` decides membership itself and
  wins over `accessor` / `matchMode`. Either one that throws stops matching and warns once
  rather than taking the render down. Declared facets are handed down to an expanded cluster's
  subgraph, so they keep working there.

### The filter panel applies itself

- **The `Filter Graph` button is gone from the panel.** A pick or a tick commits the moment you
  make it, a text or pattern field a beat after the last keystroke, and `Enter` applies at once.
  The relationship layers and the canvas legend already worked this way; a form behind an apply
  button read wrong beside them, and it was the only place the panel could show one filter while
  the canvas had another. **Reset** still clears every attribute filter in one go, and the
  header pill that *opens* the panel keeps its name.
- **An unusable pattern is reported while you type**, rather than silently filtering nothing.
  Whatever was already applied stays applied until the pattern compiles.
- **A data change rebuilds the panel in place.** It used to append the rebuilt sections, leaving
  a second, blank copy of the form stacked under the first — the panel read one while you typed
  into the other — and the regenerated controls now come back holding the live filters.

### Every user write goes through a hook

- **Every mutation a user can perform is now proposed to your code first**, asynchronously, and
  the decision may fail: `onBeforeDelete`, `onBeforeNodeCreate`, `onBeforeEdgeCreate`,
  `onBeforeNodeEditCommit` and `onBeforeEdgeEditCommit`. `false` vetoes; a returned object
  narrows what happens. Absent a hook the behaviour is unchanged, and **programmatic** mutation
  (`graph.addNode()`, `removeNode()`, `removeEdge()`) never invokes them, so your own code
  driving the model is not gated by your own hook.
- **`onBeforeDelete` receives the whole consequence of the gesture**, resolved by the library:
  the elements the user named plus `cascadingEdges`, the edges that removing those nodes would
  destroy. The two never overlap, so each can be persisted exactly once. Narrowing is per kind —
  a supplied array replaces that kind's requested set, an omitted key leaves it as requested —
  and a veto removes nothing, fires no `nodeRemove` / `edgeRemove` / `noteRemove`, and leaves
  the selection intact. `ctx.confirm()` opens the library's own confirmation modal (resolving
  `false` on every cancel path) and `ctx.origin` says which affordance asked.
- **`isValidConnection` marks a connect target invalid live**, on every hover while connecting —
  sync and cheap — and the before-create hook is not consulted for a target it rejects.
- **An accepted edit commit announces itself on the data bus** — `nodeChange` / `edgeChange`
  with `previousData` and `nextData` — and repaints straight away; a refused one changes nothing
  at all.
- **`editors.<editor>.enabled` removes an affordance rather than vetoing it**, which is the
  right answer when an operation is *never* allowed: `deletion`, `nodeCreator`, `nodeEditor` and
  `edgeEditor` each drop their buttons and menu entries. `editors.nodeEditor.fields` /
  `edgeEditor.fields` declare the form the default modal builds; a custom body owns the draft
  and mutates `session.draft` as the user types.

### Sidebar panels: a real lifecycle

- **`UI.extraPanels` is now the declarative form of a live registry.** `graph.UIManager.addPanel(panel)`
  registers a panel at any point in the graph's life — before or after `graphReady`, or from a
  plugin's `install` via `ctx.addPanel` — and returns a disposer. Alongside it:
  `removePanel(id)`, `refreshPanel(id?)` and `getPanels()`. `ExtraPanel` gains `id` (auto-generated
  when omitted), `order` and `reactive`; `title` became optional.
- **`ExtraPanel.render` and `ExtraPanel.title` are re-invoked on every selection change**, with the
  selected `Node` / `Edge`, a `Node[]` / `Edge[]` for a multi-selection, or `null` when nothing is
  selected — the contract the interface has always documented. They used to be resolved once, at
  mount, with `null`, so a panel documented as a function of the selection could never see one.
  Each transition renders exactly once. A panel that worked around the old behaviour by caching its
  own element keeps working (a returned element that is already mounted is left in place, so focus
  and scroll position inside a panel survive a re-render); pass `reactive: false` to pin a panel to
  a single render, and refresh it explicitly when its own data changes.
- Both hooks also receive a **handle on the panel itself** (`{ id, refresh(), remove() }`) as a
  second argument, so a panel can re-render or unregister itself from its own event handlers.
- **Extra-panel titles render again.** The B3 chrome hid every sidebar panel header, which silently
  swallowed `ExtraPanel.title`; it is shown whenever it resolves to content (a panel with no title
  has no header row).

### Content renderers can be asynchronous

- **Every consumer content hook may now return a `Promise`.** That is
  `mainHeader.render`, `propertiesPanel.render` / `nodePropertiesMap` / `edgePropertiesMap`,
  `neighborsPanel.render`, `ExtraPanel.title` / `render`, and the tooltip's `render` /
  `renderNodeExtra` / `renderEdgeExtra` / `nodePropertiesMap` / `edgePropertiesMap`. The library
  owns the three parts a consumer cannot: it mounts a placeholder while the promise is pending,
  swaps the content in on resolve, and **drops a result whose slot has since gone away** — so a
  fetch started for one node can never land in a tooltip or panel describing another. Only the most
  recent render for a surface can commit, whatever order they resolve in.
- **Returning a promise used to render the literal text `{}`.** `tryResolveHTMLElement`
  stringified it. Async hooks now render their content; the hooks that remain synchronous
  (`HeaderMapEntry.title` / `subtitle`, `PropertyEntry.name` / `value`) warn on the console
  instead of painting `{}`.
- Every content hook receives a **`RenderContext`** as its last argument — `{ signal, isStale() }`.
  The signal is aborted when a render is superseded or the graph is destroyed, so a forwarded
  `fetch` is cancelled rather than leaked. Existing one-argument callbacks are unaffected.
- **New `UI.asyncContent`** (`{ placeholder, error }`) overrides the themed skeleton and the
  error line, per surface via a factory argument.
- **Synchronous hooks are byte-for-byte unchanged** — same call, same frame, no placeholder and
  no wrapper element.
- Internal: `tryResolveArray` was removed (it had no remaining callers).

### Smaller things

- **A node label can opt out of truncation.** `textTruncate: false` — as a default, per node
  type or per node — draws the whole label instead of shortening it with a middle ellipsis. A
  full label usually spills past the node's shape, so it is drawn on the same themed pill as a
  floated label; pair it with `textVerticalShift` to move it clear. Edge labels are never
  truncated.
- **Plural selection setters:** `graph.selectElements(elements)` replaces the selection,
  `addToSelection(nodes)` / `removeFromSelection(nodes)` amend it. The data table is built on
  them.
- **New exports:** `minimap` and `tableColumns` (both also attached to the browser global), plus
  the types `MinimapOptions`, `MinimapPosition`, `GraphBounds`, `ViewportTarget`, `TableOptions`,
  `TableColumn`, `TableTab`, `TableSortDirection`, `TableExportFormat`, `TableVisibility`,
  `DockTab`, `DockTabHandle` and `NodeBorderBox`.

### Fixed

- **A `styleCb` declared on a *default* style block is finally called.**
  `render.defaultNodeStyle`, `defaultEdgeStyle` and `defaultLabelStyle` each accepted one that
  no drawer ever invoked. There are now two distinct roles, documented on the options: on an
  element's **own** style a `styleCb` wins outright and the style map is skipped; on
  `render.default*Style` it is the *computed form of the default slot* — it fills only what
  nothing narrower set, and loses to both the element's style and the style map. Specificity
  ordering, not callback-beats-static. Inert for a graph that declares none.
- **A style holding a function no longer breaks the simulation worker.** A resolvable channel
  carrying a callback threw `DataCloneError` for the whole `postMessage` payload, taking the
  simulation down with it. Functions are stripped from the node and edge style DTOs — no force
  reads the style anyway.
- **`Filter Graph` no longer wipes filters the form doesn't own.** It called `resetFilters()`
  before writing its own, which cost the legend its toggles on every apply; it now calls
  `replaceFilters(ownedKeys, ...)` and replaces only its own keys.
- **A declared badge colour beats the themed default.** It was written as a `fill` *attribute*,
  which loses to any stylesheet rule, so every badge silently wore the theme's colour.
- **`icons.selectElement` has a real size.** It was a single-quoted template holding
  `${fixedPreviewSize}`, so the placeholder reached the SVG verbatim and the browser rejected
  its `width` and `height` — logged by the tooltip button and the Physics root picker.
- **A scroll-into-view no longer shifts the canvas chrome.** The canvas box clipped with
  `overflow: hidden`, which is still scrollable, so bringing an element inside a closed slide
  panel into view could slide the whole chrome across; it is `overflow: clip` now.
- **Clicking a physics preset now re-lays-out the graph instead of nudging it.** A preset or `Auto`
  click reheats the simulation at full strength, where it used to get half of a fresh layout's heat
  and stop half way — the reason the same preset had to be clicked several times before its effect
  showed. Measured, one click now covers 87-99% of the distance to the preset's own equilibrium,
  against 60% before. Dragging a slider keeps the gentler reheat it always had, and `Auto`'s
  background re-tuning is unchanged.
- **Clicking `Auto` always does something.** Auto skips re-tunes too small to see, which is right
  for a background re-tune fired by a graph change but made the *button* a no-op whenever auto's
  answer happened to sit near the current knobs. An explicit click now always applies and reheats.
- **A simulation run gets the settling time it was promised at any frame rate.** `cooldownTime` was
  compared against wall-clock while `d3AlphaDecay` is per tick, so a graph rendering below 60fps had
  its run truncated — the heavy graphs, which need settling most, got the least of it. The budget is
  now counted in ticks (identical at 60fps), with the wall-clock limit kept as a backstop so a
  hidden or throttled tab still stops.
- **`ForceGravity` skipped nodes at rest.** It guarded its accumulation on `node.vx && node.x`
  rather than on the values being present, so a node sitting exactly on the centring axis, or
  momentarily at rest, silently received no centring pull at all.
- **The physics is tuned against the container, not the canvas.** Chrome opening and closing —
  the dock, the sidebar — could change what a re-layout produced, and a zero-area container
  zeroed every force.
- **The filter pill counted a cluster's children as hidden nodes**, reading "6 hidden" on a graph
  where one node had been filtered out. Only this graph's own nodes are counted.
- **An all-numeric derived filter field renders as a min/max range again**, instead of degrading
  to a free-text box.
- **An off-screen selection no longer dims the canvas.** `Simulation.destroy()` is also wired
  into `Graph.destroy()`, so the container observer is released with the graph.
- **An overlong sidebar scrolls instead of stretching the layout past the viewport** — the grid's
  `1fr` row floored at the sidebar's content height, so `overflow-y` never engaged.
- **`PivotickDropdown` leaked its document listeners:** `destroy()` removed only the root, so
  every scroll went on measuring a detached node.
- **The table's column picker opens where it can be seen.** It anchored to the whole dock and
  landed off-screen behind an overflow clip; it now anchors to its button in viewport
  coordinates, opens upwards, and closes on outside click or `Escape`.
- **A dock pane's controls are rebuilt on `refresh()`, not just its body.** A pane's controls
  usually *are* its view switch, so a body-only refresh left the switch marking the view you had
  just left.
- **The dock's accents follow the theme.** They pointed at an undefined `--pvt-primary-color` and
  so drew a hard-coded blue; they now use `--pvt-theme-primary`.
- **Six dead CSS variables point at ones that exist.** `--pvt-label-font`, `--pvt-modal-text`,
  `--pvt-danger` and `--pvt-text-color` were never declared, so labels ignored the theme font and
  three colours silently inherited; `--pvt-sidebar-collapse-border-color` is now declared, giving
  that control the border it always asked for.
- **The bottom-left legend keeps clear of the mode rail and the sidebar's collapse toggle**,
  capping its height against the rail and cutting the list on a row boundary rather than growing
  up underneath it.
- **A note is added where the menu was opened**, not where its entry was clicked.
- **Note context-menu overrides are merged from `menuNote`**, not `menuCanvas`.
- **An edited edge's label repaints in place** instead of on the next move — a freshly rendered
  label carries no transform until a tick places it.
- **An edit modal's custom body is built once, not twice.**
- **An updated edge's `previousData` is read from the edge map**, not the node map.

## 1.5.0 — 2026-07-29

Two headline changes: a security-hardening pass over everything reachable from untrusted
graph data, and the replacement of the default `full`-mode chrome with the mode-driven
"B3" layout. Both carry breaking changes — see the migration table at the end.

## Security (breaking)

Reported by Jeroen Pinoy. The new [security guide](./docs/security.md) documents the
data → DOM boundary and the options that remain trusted-HTML sinks.

- **A `string` never renders as markup.** `tryResolveHTMLElement` — behind extra panels,
  custom context-menu entries, and the `render` hooks of the main header, properties panel
  and tooltip — parsed any string as HTML and appended it live. Strings now resolve to
  text; return an `HTMLElement` to render your own markup. (Property values already
  changed in 1.4.0; this extends the rule to every `string | HTMLElement` option.)
- `style.svgIcon` is sanitized (DOMPurify SVG profile) before insertion, for node icons
  and UI icons alike, so handlers, `<script>` and `<foreignObject>` are stripped.
- `style.imagePath` and property links are restricted to the `http:`, `https:`, `data:`
  and `blob:` schemes — one shared scheme checker — blocking `javascript:` payloads and
  render-triggered outbound requests.
- Node name and description render as text in the edit-node and inspect-node modals.
- The Markdown node-reference renderer escapes `nodeName`.
- Recursive walks over caller-supplied data are iterative and bounded: `hasCycle`,
  `findMaxReachabilityRoot` and `JsonViewer` no longer overflow the stack on a long path
  or a deep/circular data bag, reachability is capped, and the JSON tab reports cycles
  instead of throwing.
- Node-id lookups in the tree layout and cycle check are keyed by `Map`, so a node named
  `__proto__` or `constructor` is no longer dropped from the layout or resolved to an
  inherited member. Edges whose source is outside the node set are guarded.

## B3 mode-driven chrome (breaking)

The default `full`-mode chrome was replaced with the mode-driven "B3" layout: a left
**mode rail** (Select / Create / View), **contextual tool panels** that swap with the
active mode, a **View flyout** consolidating layout / physics / grid settings, a
restyled top bar and viewport rail, and a selection sidebar with a clear-selection
control and a **bulk-action row**.

### Removed (breaking)

- `GraphControls` and `GraphToolbar` components, their `UIManager.UI_ELEMENTS` rows,
  `Layout` slots, and SCSS.
- `UIManager.graphControls` and `UIManager.graphToolbar` getters.
- The `UI.selectionMenu` option. Per-node actions live in the right-click
  `contextMenu`; multi-selection actions moved to the sidebar bulk-action row.
- The `e` "Edit Graph" toggle (superseded by the Create mode).

### Renamed

- `UIManager.graphNaviation` → `UIManager.graphNavigation` (fixes a long-standing typo).

### Added

- New `UIManager` accessors: `modeRail`, `toolPanel`, `viewFlyout`.
- `Simulation` physics setters, each mapping a 0–100 knob to the real force domain and
  reheating the simulation: `setRepulsion`, `setLinkDistance`, `setCollisionRadius`,
  `setFriction`, plus `applyPhysicsPreset('tight' | 'loose' | 'default')`.
- Sidebar clear-selection control and bulk-action row (Pin / Unpin / Hide / Delete
  functional; Group / Ungroup / Isolate / Bulk-edit shown disabled, "SOON").
- `UI.modeRail` — `{ explore?, enrich? }`, both `false` by default. The not-yet-shipped
  data-zone modes stay hidden from the rail unless opted in, where they appear as
  disabled "SOON" slots.
- A reusable `Typeahead` component, wired to `[[node]]` references in note content.
- Notes snap to the grid while dragging when grid-snapping is on.
- The tool panel is collapsible, and the rail reflects the active tool.
- B3 chrome controls are keyboard-focusable and expose their toggle state.

### Changed

- The Notes and Filters slide panels are mutually exclusive.
- Modals, slide panels, context menus and tooltips are rounded and bordered to match the
  chrome; the top bar is a true transparent overlay with the graph rendering behind it.

### Fixed

- The neighbours panel no longer rebuilds the ego-graph mid-unselect (fixes a zoom crash
  and a shadowlink leak), and the tooltip no longer leaks a shadowlink-container SVG on
  every rebuild.
- The selection list is cleared before `unselect` events are emitted, and the canvas
  repaints when it is cleared.
- The View flyout resyncs its run/pause button when the slow-tick watchdog disables
  physics.
- Lasso outline styling and screen → graph mapping restored, as were the edit-tool canvas
  cursors dropped with the classic toolbar.
- The Edit-node tool is disabled without a selection and reopens after being closed.
- The picker input no longer inherits form styling; its dropdown is themed.
- Body-portaled roots (typeahead, dropdown, context menu) use the themed scrollbar.
- The decorative grid pitch matches the snap `gridSize`.
- The focus icon no longer renders as a black square.

### Performance

- Ego-graph construction is capped at 50 neighbours.
- Dimmed nodes and edges no longer apply a grayscale filter.

### Migration

| Before | After |
|---|---|
| `graph.UIManager.graphControls` | Layout/physics moved to the View flyout — `graph.UIManager.viewFlyout` |
| `graph.UIManager.graphToolbar` | Select/Create tools — `graph.UIManager.toolPanel` / `graph.UIManager.modeRail` |
| `graph.UIManager.graphNaviation` | `graph.UIManager.graphNavigation` |
| `UI.selectionMenu` (per-node) | `UI.contextMenu` |
| `UI.selectionMenu` (multi-select) | Sidebar bulk-action row |
| `render: () => '<b>hi</b>'` on any `string \| HTMLElement` option | Renders as text — return an `HTMLElement` for markup |

See the [UI docs](./docs/ui.md) for the current control surface and the
[security guide](./docs/security.md) for the data → DOM boundary.
