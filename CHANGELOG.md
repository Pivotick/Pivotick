# Changelog

## Unreleased

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
  flyout's preset row is now `[Auto] [Tight] [Loose]`. `tight` and `loose` keep their four existing
  values and gain `centering: 7` / `settleTime: 2.25`, which reproduce the historical gravity
  (0.001 / 0.1) and alpha decay (0.05) exactly.
- **`PHYSICS_KNOB_RANGES.linkDistance` is now `[40, 600]`** (was `[40, 260]`). The knob maps to
  pixels one-for-one, so every existing value is unchanged; only a UI rendering the slider's `max`
  sees a difference. The old ceiling made it impossible to put visible space between two large
  nodes — 260px leaves 140px between a pair of 120px discs.
- **Removed private API:** `Simulation.scaleSimulationOptions` and
  `Simulation.applyScalledSimulationOptions`, both `@private` and both dead (commented out at all
  three call sites). They were an abandoned earlier attempt at this feature.

### Fixed

- **`ForceGravity` skipped nodes at rest.** It guarded its accumulation on `node.vx && node.x`
  rather than on the values being present, so a node sitting exactly on the centring axis, or
  momentarily at rest, silently received no centring pull at all.

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
