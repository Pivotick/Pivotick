# Changelog

## 1.6.0 — 2026-08-25

Three headline additions, each of them something a force layout is bad at on its own: a **data
dock** under the canvas — the graph as a sortable, selectable table, and a host for panes of
your own — a **minimap** with the renderer viewport API behind it, and a **filtering legend**
in a canvas corner. Alongside them the layout stopped needing to be configured: physics tunes
itself from what is on screen, it moved into a rail mode of its own, and tree layouts now
handle cyclic, disconnected and data-declared hierarchies. Two contracts got real: every
user-initiated write goes through a before-hook, and every content renderer may return a
promise. The breaking changes are confined to the physics presets — see **Breaking** under
*The layout tunes itself*.

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
  cluster gets one row and a **`Children`** count instead: its children are nodes of another
  graph, so `Visibility` and `Degree` would both be answering about the wrong one.
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
  `UI.minimap: false` suppresses it; every other mode installs it as the plugin it is —
  `plugins: [minimap()]`, a new export (on the browser global too).
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
  `DockTab` and `DockTabHandle`.

### Fixed

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
