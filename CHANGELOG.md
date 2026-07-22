# Changelog

## Unreleased — B3 mode-driven chrome (breaking)

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

### Migration

| Before | After |
|---|---|
| `graph.UIManager.graphControls` | Layout/physics moved to the View flyout — `graph.UIManager.viewFlyout` |
| `graph.UIManager.graphToolbar` | Select/Create tools — `graph.UIManager.toolPanel` / `graph.UIManager.modeRail` |
| `graph.UIManager.graphNaviation` | `graph.UIManager.graphNavigation` |
| `UI.selectionMenu` (per-node) | `UI.contextMenu` |
| `UI.selectionMenu` (multi-select) | Sidebar bulk-action row |

See the [UI docs](./docs/ui.md) for the current control surface.
