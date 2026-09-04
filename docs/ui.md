---
outline: [2, 3]
---

# UI Options

Pivotick provides a flexible UI layer on top of your graph, allowing you to control how users interact with nodes, edges, and the canvas. Using `UI` options, you can:

- Configure the overall [**mode**](#ui-mode) of the UI (full, viewer, static, etc.).
- Customize [**sidebar**](./ui-sidebar) and panels to show properties or extra information.
- Define [**tooltips**](./ui-tooltip) for nodes and edges, with optional custom renderers.
- Configure [**context menus**](./ui-context-menu) for nodes, edges, and the canvas.
- Declare the [**filter**](./ui-filter) panel's facets, or let them be derived from your data.
- Dock a [**legend**](./ui-legend) on the canvas — a key for your colours that doubles as a filter, and that appears by itself when your colours are explained by a declared node type.
- Fill any of those surfaces [**asynchronously**](#async-content), from data you fetch on demand.
- [**Turn off**](#turning-features-off) any feature your integration has no use for.

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
    UI: { // [!code focus:9]
        sidebar: {},
        mainHeader: {},
        propertiesPanel: {},
        extraPanels: [],
        tooltip: {},
        contextMenu: {},
        filter: {},
    }
}
```

## The `full`-mode control surface

In `full` mode the chrome is a mode-driven layout: a left **mode rail**
(Select / Create / View / Physics), a **contextual tool panel** for the active
pointer-mode, two settings flyouts — **View** (canvas background and switches) and
**Physics** (layout + simulation) — the **top bar** (search, filter, notes, undo/redo),
the selection **sidebar** (properties, facets, neighbours, and a bulk-action row), and
a right-side **viewport rail** (fit-and-center, zoom, settings, fullscreen), and a
[**minimap**](./plugins#minimap) in the free bottom-right corner, which folds itself away
when the canvas is too small to spare the room (`UI.minimap: false` to drop it). `light`
mode drops the sidebar and the minimap; `viewer` keeps only the viewport rail; `static`
is a bare canvas.

::: warning Migrating from the corner chrome
The floating `GraphControls` and `GraphToolbar` overlays were removed. Layout and
physics moved into the Physics flyout (`UIManager.physicsFlyout`) — they shipped in the
View flyout (`UIManager.viewFlyout`) in 1.5.0, which now holds the canvas background
and the grid switches. Select/Create tools live in the tool panel (`UIManager.toolPanel`) and
mode rail (`UIManager.modeRail`). The
`UI.selectionMenu` option is gone — use `contextMenu` for per-node actions and the
sidebar bulk-action row for multi-selection actions. `UIManager.graphNaviation` was
renamed to `graphNavigation`. The `UI.modeRail` option and its disabled `Explore` /
`Enrich` slots were removed — register a real mode with
[`addRailMode`](./plugins#rail-mode) instead. See the
[CHANGELOG](https://github.com/Pivotick/Pivotick/blob/main/CHANGELOG.md).
:::

The rail's four modes are built in, but not the only ones it can hold: a plugin adds its
own with [`addRailMode`](./plugins#rail-mode), which is how an Explore or Enrich mode that
knows what *your* data means gets built.

## Turning features off {#turning-features-off}

The UI mode decides how much chrome a graph gets. Every feature inside that chrome
can also be switched off one at a time, which is how an integration drops what its
backend or its users have no use for.

A switched-off feature takes **everything** that reaches it: the button, the panel,
the context-menu entry and the keyboard shortcut all go together, so nothing is left
behind to click or press and quietly refuse.

```ts
const options = {
    UI: {
        mode: 'full',
        notes: { enabled: false },        // [!code focus:4]
        history: { enabled: false },
        inspector: { enabled: false },
        editors: { deletion: { enabled: false } },
    },
}
```

### The switches

| Option | What goes with it |
| --- | --- |
| `UI.topBar.enabled` | The top strip, the height it reserved, and the shortcuts its controls own (`Shift+J`, `Shift+K`, `Shift+N`, `Mod+Z`). Use the switches below to drop one pill and keep the rest. |
| `UI.search.enabled` | The Search pill, its node picker and `Shift+J`. |
| `UI.filter.enabled` | The Filter Graph pill, its panel and `Shift+K`. `graph.queryEngine` still filters from code. |
| `UI.notes.enabled` | The Notes pill and panel, `Shift+N`, the Add note tool, the canvas menu's Add Note, `N`, the note context menu, and `noteManager.addNote`, which refuses. |
| `UI.history.enabled` | The undo / redo buttons, their history dropdown and `Mod+Z` / `Mod+Shift+Z`. `graph.history` goes on recording. |
| `UI.inspector.enabled` | The node menu's Inspect Properties entry and `I`. |
| `UI.notifications.enabled` | Toasts. `graph.notifier.*` becomes a no-op returning `undefined`. |
| `UI.sidebar.enabled` | The whole side column, and the width it took. |
| `UI.propertiesPanel.enabled` | The sidebar's properties panel and its separator. |
| `UI.neighborsPanel.enabled` | The sidebar's neighbours panel and its separator. |
| `UI.viewFlyout.enabled` | The View rail button and its panel. |
| `UI.physicsFlyout.enabled` | The Physics rail button and its panel. |
| `UI.tooltip.enabled` | Hover tooltips, pinned ones included. |
| `UI.contextMenu.enabled` | Every context menu. |
| `UI.navigation.enabled` | The viewport rail: fit, zoom and fullscreen. |
| `UI.legend: false` | The canvas legend, including the one it would derive by itself. |
| `UI.minimap: false` | The minimap. |
| `UI.table: false` | The data dock and its `Shift+T`. |
| `UI.pivotMode: false` | The Pivot rail mode, whatever is registered. |

Write-path features have the same switch under `UI.editors`, so a read-only
integration removes the affordance rather than vetoing every click:
`nodeCreator`, `edgeCreator`, `nodeEditor`, `edgeEditor` and `deletion`.

Renderer behaviour is switched off under `render`: `zoomEnabled` (which also takes
the rail's zoom buttons, keeping fit-and-center), `dragEnabled`,
`selectionBox.enabled` (the marquee **and** the Select ▸ Lasso tool),
`enableNodeExpansion` (the chevron and its `Enter`), `enableFocusMode`, and
`interactionEnabled` for all of it at once. `simulation.enabled` stops the layout
from running.

::: info The Create mode follows its tools
The Create rail mode holds exactly four tools: Add node, Add edge, Add note and Edit
node. Switch all four off and the mode leaves the rail, along with its `C` shortcut,
rather than opening onto an empty panel. Select always stays.
:::

## Asynchronous content {#async-content}

Every consumer-supplied content hook may return a **`Promise`** instead of the
content itself. That covers the sidebar's
[`mainHeader.render`](./ui-sidebar#main-header-interface),
[`propertiesPanel.render` / `nodePropertiesMap` / `edgePropertiesMap`](./ui-sidebar#properties-panel-interface),
`neighborsPanel.render`, an [extra panel's](./ui-sidebar#extra-panels-interface)
`title` and `render`, and the [tooltip's](./ui-tooltip#async-content)
`render`, `renderNodeExtra`, `renderEdgeExtra` and property maps.

This exists for the case where a node's data is a *reference* to a record rather
than the record itself, and the interesting content is behind an HTTP call:

```ts
const options = {
    UI: {
        tooltip: {
            renderNodeExtra: async (node, { signal }) => { // [!code focus:5]
                const res = await fetch(`/enrich/${node.getData().uuid}`, { signal })
                return renderChips(await res.json())       // an HTMLElement
            },
        },
    },
}
```

Add `async`, forward the `signal`, and the library takes care of the rest:

| | |
| --- | --- |
| **Placeholder** | While the promise is pending, a themed skeleton occupies the slot. |
| **Swap** | On resolve, the content replaces the placeholder in place. |
| **Staleness** | A result that arrives after its slot has gone — you hovered another node, changed the selection, refreshed the panel — is **dropped**. Only the most recent render for a surface can commit, whatever order they resolve in. |
| **Cancellation** | `ctx.signal` is aborted when a render is superseded or the graph is torn down, so a forwarded `fetch` is cancelled rather than leaked. |
| **Failure** | A rejected promise renders a compact error line instead of leaving a spinner forever. An aborted render is not a failure and shows nothing. |

### The render context

Every content hook receives a [`RenderContext`](/api/html/interfaces/AsyncContent.RenderContext.html)
as its **last** argument. Existing synchronous hooks simply ignore it.

```ts
render: async (element, { signal, isStale }) => {
    const rows = await fetchRows(element, signal)
    if (isStale()) return ''            // cheap guard for non-abortable work
    return renderRows(rows)
}
```

### Customising the placeholder

`UI.asyncContent` overrides what is shown while pending and on failure. Both
accept a string, an `HTMLElement`, or a function of the surface:

```ts
const options = {
    UI: {
        asyncContent: { // [!code focus:4]
            placeholder: (surface) => surface === 'tooltip' ? 'Loading…' : mySkeleton(),
            error: 'Could not load',
        },
    },
}
```

`surface` is one of `'tooltip'`, `'properties'`, `'neighbors'`, `'mainHeader'`
or `'extraPanel'`.

::: info Synchronous hooks are untouched
Returning content directly behaves exactly as it always has — same call, same
frame, no placeholder and no wrapper element. Nothing about an existing
integration changes.
:::

::: warning What cannot be async
Two groups stay synchronous on purpose:

- **`HeaderMapEntry.title` / `subtitle`** feed the auto-fitting title slot *and*
  node search (`resolveNodeByName`), both of which need the text now. Use an
  async `mainHeader.render` if you need fetched detail in the header.
- **`PropertyEntry.name` / `value`** — fetch the rows instead: an async
  `nodePropertiesMap` resolves once and then hands back plain entries, rather
  than putting a spinner in every cell.

The per-frame renderer hooks (`render.renderNode`, `renderLabel`, `renderCluster`
and `NodeStyle.html`) are also sync-only: they run inside the draw path, per
node, per tick. If you need async node *decoration*, fetch into the node's data
and let the synchronous renderer read it.
:::
