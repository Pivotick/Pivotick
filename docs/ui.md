---
outline: [2, 3]
---

# UI Options

Pivotick provides a flexible UI layer on top of your graph, allowing you to control how users interact with nodes, edges, and the canvas. Using `UI` options, you can:

- Configure the overall [**mode**](#ui-mode) of the UI (full, viewer, static, etc.).
- Customize [**sidebar**](./ui-sidebar) and panels to show properties or extra information.
- Define [**tooltips**](./ui-tooltip) for nodes and edges, with optional custom renderers.
- Configure [**context menus**](./ui-context-menu) for nodes, edges, and the canvas.

### UI Mode {#ui-mode}
The `mode` option controls the overall behavior and interaction level of the graph UI.

- **`full`** <Badge type="warning" text="default" />: Complete UI with all panels, menus, and interactions enabled.
- **`light`**: Minimal UI with essential interactions enabled.
- **`viewer`**: Only allows navigating the graph (pan, zoom, drag) without displaying any UI panels.
- **`static`**: Static graph, no UI panels or interactions; the graph is read-only.

For image-style usage of Pivotick, use the following:
```ts
const container = document.getElementById('graph-container')
const options = {
    UI: {  // [!code focus:3]
        mode: 'viewer'
    },
}
const graph = Pivotick(container, options)
```

Other UI component can be configured through their respective namespace

```ts
const options = {
    UI: { // [!code focus:8]
        sidebar: {},
        mainHeader: {},
        propertiesPanel: {},
        extraPanels: [],
        tooltip: {},
        contextMenu: {},
    }
}
```

## The `full`-mode control surface

In `full` mode the chrome is a mode-driven layout: a left **mode rail**
(Select / Create / View), a **contextual tool panel** for the active mode, a **View
flyout** with layout / physics / grid settings, the top **main header** (search,
filter, notes), the selection **sidebar** (properties, facets, neighbours, and a
bulk-action row), and a right-side **viewport rail** (fit-and-center, zoom, settings,
fullscreen). `light` mode drops the sidebar; `viewer` keeps only the viewport rail and
View flyout; `static` is a bare canvas.

::: warning Migrating from the corner chrome
The floating `GraphControls` and `GraphToolbar` overlays were removed. Layout and
physics moved into the View flyout (`UIManager.viewFlyout`); Select/Create tools live
in the tool panel (`UIManager.toolPanel`) and mode rail (`UIManager.modeRail`). The
`UI.selectionMenu` option is gone — use `contextMenu` for per-node actions and the
sidebar bulk-action row for multi-selection actions. `UIManager.graphNaviation` was
renamed to `graphNavigation`. See the [CHANGELOG](https://github.com/Pivotick/Pivotick/blob/main/CHANGELOG.md).
:::