---
outline: [2, 3]
---

# Data table

`UI.table` splits a **data dock** off the bottom of the canvas: the graph's nodes and
edges as a sortable, selectable grid. It exists because a force layout is structurally
bad at three things people do constantly — reading exact values, selecting at scale, and
working out where to start.

The intended loop is **table to find, canvas to understand, sidebar to read**: sort by
degree to spot the hubs, shift-click the top twenty, and act on them with the sidebar's
bulk actions.

```ts
const options = {
    UI: { mode: 'full' },
}
```

That is all it takes. In `full` mode the header grows a **Table** pill (or press
`Shift+T`) and the dock opens on demand. `UI.table: false` removes it entirely.

The dock is `full` mode only — it is a grid row beside the sidebar, and the other modes
promise a canvas without that much chrome.

::: tip The table never changes what the graph shows
The dock is **read-only**. It reflects the graph and drives the selection, and that is
all. Hiding and pinning stay with the sidebar's [bulk actions](/ui-sidebar); restoring a
hidden node stays with the [filter panel](/ui-filter). What the dock adds is a far better
instrument for *building* the selection those act on.
:::

## It lists the whole graph {#superset}

The table does **not** mirror the canvas. It lists every top-level node, including the
ones currently hidden, and the leading `Visibility` column says where each one stands:

| Value | Styling | Meaning |
|---|---|---|
| `visible` | quiet, untinted | On the canvas now |
| `filtered` | amber chip | Hidden by the filter panel — change the filter to get it back |
| `excluded` | red chip | Hidden by hand; restore it from the filter panel's hidden-node list |

Each state differs in weight and border as well as colour, so the column reads without
relying on hue. A hidden node's whole row also recedes, keeping the eye on what is
actually drawn.

That is deliberate. "23 nodes hidden" is a claim you should be able to inspect, and a
table that quietly drops the rows you are looking for is worse than no table. Sort by
`Visibility` to see exactly what a filter took away.

Cluster children are the one exception: they belong to their cluster's own graph, so they
are not listed here.

## Sorting and narrowing {#sorting}

Click any column heading to sort; click again to reverse. Give a column
`filterable: true` and its header grows a box that **narrows the rows**.

That row filter is *not* the graph's filter. It changes what you are reading; the canvas
is untouched, and the `Visibility` column goes on reporting the truth beside it. Deciding
what the graph displays stays with the filter panel, so the two can never end up fighting
over it.

The dock's count reflects both: `40 nodes` becomes `12 of 40 nodes` once you narrow.

## Selecting {#selecting}

| Gesture | Effect |
|---|---|
| Click a row | Select that element |
| Ctrl / Cmd-click | Add or remove one row |
| Shift-click | Take a range, in the order currently listed |
| **Select all** | Every row currently listed — post-sort, post-filter |
| Double-click | Select **and** centre the canvas on it |
| Hover | Highlight the element on the canvas |

It works in both directions: rubber-band a group on the canvas and the matching rows are
marked and scrolled to. The selection is the same one the sidebar's bulk actions read, so
the loop closes without any extra wiring.

Hidden rows select like any other — that is the point of listing them.

## Columns {#columns}

With no `columns` declared, the dock works it out for you, in three tiers:

1. **Declared** — `UI.table.columns` wins outright.
2. **From your facets** — otherwise, if you declared
   [`UI.filter.facets`](/ui-filter#facets), columns are built from them. Describe your
   data once and the filter panel and the table agree about it.
3. **Scanned** — otherwise the data is read, ordered by **coverage** so the
   well-populated keys come first and the sparse tail sits at the far right.

Either way the graph-aware columns lead. For nodes that is **`Visibility`, `Degree`, then
`Label`**: the first two are narrow, scannable facts you read straight down a column, so
they sit at the left edge as a status gutter rather than being pushed right by a wide name.
Edges read as a sentence instead — `Source` / `Label` / `Target`.

The default sort is the `Label` column, not the leading one: sorting by `Visibility` on
open tells you nothing while every row still reads `visible`.

Everything is shown by default, and the grid scrolls sideways rather than dropping
anything. On property-heavy nodes use the **Columns** picker to switch off what you don't
need.

### The built-in columns {#built-ins}

`tableColumns` holds the columns no generic grid could compute, because they are about an
element's place in the graph rather than its data:

```js
import { Pivotick, tableColumns } from 'pivotick'

new Pivotick(el, data, {
    UI: {
        mode: 'full',
        table: {
            open: true,
            // Reference a built-in's key through the object rather than typing it —
            // the key itself is namespaced so it can never clash with a data key.
            sort: { key: tableColumns.degree.key, direction: 'desc' },
            columns: [
                tableColumns.visibility,
                { ...tableColumns.degree, label: 'Links' },
                tableColumns.label,
                { key: 'severity', label: 'Severity', type: 'numberRange', filterable: true },
            ],
        },
    },
})
```

`label` · `degree` · `degreeIn` · `degreeOut` · `visibility` · `pinned` · `cluster`, plus
`source` and `target` for edges. Clone one to adjust it, as above.

A `TableColumn` is a [`FilterFacet`](/ui-filter#facets) with a few presentation extras
(`width`, `align`, `sortable`, `filterable`, `hidden`, `format`), which is why a facet can
be used as a column unchanged.

## Exporting {#exporting}

The **CSV** and **JSON** buttons write out exactly what you are looking at: this tab,
these visible columns in this order, this sort, this row filter. Raw values, never a
column's `format` output, so the file stays machine-readable.

Not the whole graph — that is `graph.getNodes()` away for anyone with code. Pass
`export: false` to leave the buttons out.

::: warning Downloads in an embedded page
A sandboxed iframe can block a download outright. When that happens the dock says so
rather than leaving a button that appears to do nothing.
:::

## Scale {#scale}

Above `virtualizeAbove` rows (200 by default) the rows are **windowed**: only what fits
the viewport plus a margin is in the DOM, while the scrollbar still measures the whole
dataset. Sorting reorders the underlying array, never the DOM, and a rebuild keeps both
your scroll position and your selection.

Below the threshold every row is rendered, which keeps the ordinary case simple to
inspect.

## Options {#options}

| Option | Default | What it does |
|---|---|---|
| `enabled` | `true` | `false` (or `UI.table: false`) removes the dock and its pill |
| `tabs` | `['nodes', 'edges']` | Which tabs to offer. One tab renders no strip |
| `columns` / `edgeColumns` | derived | See [Columns](#columns) |
| `open` | `false` | Open the dock on boot |
| `collapsed` | `'auto'` | Folded to its header bar. `'auto'` follows the room available until you choose for yourself |
| `height` | `0.35` | A pixel count, or a fraction of the canvas. Clamped so the canvas keeps a usable minimum |
| `sort` | the `Label` column | `{ key, direction }` |
| `rowActivate` | `'select'` | `'selectAndCenter'` also moves the canvas; `'none'` makes rows inert |
| `export` | `['csv', 'json']` | `false` hides the buttons |
| `virtualizeAbove` | `200` | Row count above which rows are windowed |

## Programmatic control {#api}

```js
graph.openTable()
graph.closeTable()
graph.toggleTable()
```

Each is a no-op when there is no dock (any mode but `full`, or `UI.table: false`).

The dock drives the ordinary selection API, so anything that reads a selection sees what
the table built:

```js
graph.selectElements([nodeA, nodeB])   // replaces the selection
graph.addToSelection([nodeC])          // nodes only
graph.removeFromSelection([nodeA])
```

## Resizing and folding {#resizing}

Drag the divider along the dock's top edge to resize it. The canvas keeps a floor
whatever you ask for — a canvas with no height is not a graph.

The collapse chevron folds the dock to its header bar. Left alone, `collapsed: 'auto'`
makes that decision for you and folds the dock away on a layout too short for both it and
a usable canvas; the first time you collapse or expand it by hand, or drag the divider,
it stops deciding and leaves it to you.

::: tip Opening the dock never moves the graph
The simulation tunes itself against the **container**, not the canvas, so chrome opening
and closing cannot change a layout. Resize the dock as much as you like: the graph stays
put, and a re-layout gives the same result with the dock open or shut.
:::
