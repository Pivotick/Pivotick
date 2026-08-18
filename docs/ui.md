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
- Dock a [**legend**](./ui-legend) on the canvas — a key for your colours that doubles as a filter.
- Fill any of those surfaces [**asynchronously**](#async-content), from data you fetch on demand.

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
