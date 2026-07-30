# Changelog

## Unreleased

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
