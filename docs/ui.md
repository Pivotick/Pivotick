---
outline: [2, 3]
---

# UI Options

Pivotick provides a flexible UI layer on top of your graph, allowing you to control how users interact with nodes, edges, and the canvas. Using `UI` options, you can:

- Configure the overall [**mode**](#ui-mode) of the UI (full, viewer, static, etc.).
- Customize [**sidebar**](./ui-sidebar) and panels to show properties or extra information.
- Define [**tooltips**](./ui-tooltip) for nodes and edges, with optional custom renderers.
- Configure [**context menus**](./ui-context-menu) and [**selection menus**](./#ui-selection-menu).

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
    UI: { // [!code focus:10]
        sidebar: {},
        mainHeader: {},
        propertiesPanel: {},
        extraPanels: [],
        tooltip: {},
        contextMenu: {},
        selectionMenu: {},
    }
}
```