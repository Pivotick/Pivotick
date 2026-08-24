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

That is all it takes. In `full` mode the dock sits at the bottom **folded to its header
bar**; click its chevron — or press `Shift+T` — to show the table. `UI.table: false`
removes it entirely.

There is deliberately no toolbar button for it. The bar *is* the control: the pills in the
top bar all open something *over* the canvas, while the dock is a split region that already
shows you its own chevron.

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

Cluster children are the one exception, and for a different reason than hiding: they are
not nodes of this graph at all. A child lives in its cluster's own subgraph, with its own
filters and its own edges — `Visibility` and `Degree` would both be answering about the
wrong graph. So the cluster gets one row, and a **Children** column saying how many nodes
are inside it; that column appears in the derived set whenever the graph has clusters.

## Sorting and narrowing {#sorting}

Click any column heading to sort; click again to reverse. Filterable columns grow a
control in the header that **narrows the rows** — every column in the
[derived set](#columns) has one, and a column you declare yourself gets one by asking for
`filterable: true`.

Which control you get follows the column's `type`, so you can ask a column what it is
actually able to answer:

| `type` | Control | Matches |
|---|---|---|
| `numberRange` | a **Min / Max** pair | inside the interval; either end may be left empty |
| `select` · `multiselect` · `boolean` | a **dropdown** of the values the column holds | that value exactly, or membership when the cell is a list |
| `text` · `regex` · untyped | a **text box** | case-insensitive substring |

The dropdown is built from the column's own values rather than a declared option list, so
it never offers a choice that would come back empty. Above 50 distinct values it steps
aside for the text box — a dropdown that long is not a control anyone can use.

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

Either way the graph-aware columns wrap the data. For nodes, **`Visibility`** and
**`Label`** lead — a status gutter and the name, the two things you scan down to find a
row — and the counts close it: **`Degree`**, plus **`Children`** on a graph that has
clusters. The counts sit at the end because they are the graph's arithmetic rather than
the element's own data, and they are narrow, fixed-width columns so a couple of digits
never take the share of the row a name needs. Edges read as a sentence instead —
`Source` / `Label` / `Target`.

The default sort is the `Label` column, not the leading one: sorting by `Visibility` on
open tells you nothing while every row still reads `visible`.

Everything is shown by default, and the grid scrolls sideways rather than dropping
anything. On property-heavy nodes use the **Columns** picker to switch off what you don't
need — which also takes its filter control off the header with it.

**Derived columns come filterable.** Their labels, types and alignment are all inferred
already, and the [row filter](#sorting) is inferred off that same type — so a table you
never configured is one you can still narrow. Declared columns are the opposite: you get
exactly the set you wrote, `filterable: false` unless you say otherwise.

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

`label` · `degree` · `degreeIn` · `degreeOut` · `visibility` · `pinned` · `children`, plus
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
| `enabled` | `true` | `false` (or `UI.table: false`) removes the dock entirely |
| `tabs` | `['nodes', 'edges']` | The table's **own** views. One renders no inner strip |
| `columns` / `edgeColumns` | derived | See [Columns](#columns) |
| `open` | unset | Unset starts folded to the bar; `true` starts expanded; `false` leaves no dock at all (`Shift+T` still brings it in) |
| `collapsed` | folded | Folded to its header bar. With `open: true`, `'auto'` follows the room available until you choose for yourself |
| `height` | `0.35` | A pixel count, or a fraction of the canvas. Clamped so the canvas keeps a usable minimum |
| `sort` | the `Label` column | `{ key, direction }` |
| `rowActivate` | `'select'` | `'selectAndCenter'` also moves the canvas; `'none'` makes rows inert |
| `export` | `['csv', 'json']` | `false` hides the buttons |
| `virtualizeAbove` | `200` | Row count above which rows are windowed |

## The dock holds more than the table {#dock-tabs}

The table is **one pane** in the dock, and anything else you register is another:

```js
const dispose = graph.UIManager.addDockTab({
    label: 'Audit',
    render: () => myAuditPane(),        // called once, the first time the pane is opened
    toolbar: () => [clearButton],       // rebuilt on every activation
})
```

The dock's strip then reads `Table │ Audit`. Switching swaps the body **and** the header
controls, since `Select all`, the exports and `Columns` belong to the table and mean
nothing over another pane. One pane renders no strip at all — nothing should point at a
switch with one setting.

The table is not a special case: it comes through the same `addDockTab`, so a pane you
register is its equal rather than its guest. `order` places it (equal orders keep
registration order, and a pane registered later — as a plugin's always is — lands after
the built-in one). The returned disposer removes it.

There is one region, so there is one height and one fold, however many panes are in it.
Two panes cannot each stand up a resizable strip and fight over the canvas.

### Two levels of switch, and why they look different {#two-levels}

`Nodes` and `Edges` are **the table's own** tabs, not the dock's. They are two views of a
single pane, so they are not listed out beside `Audit` — that would claim a view of the
table and a separate pane are the same kind of thing.

The two levels are drawn differently so they can sit next to each other and still read as
an outer and an inner:

| | Looks like | Class |
|---|---|---|
| `Table │ Audit` | full-height tabs, underlined when active, closed off by a rule | `pvt-dock-tabs` / `pvt-dock-tab` |
| `Nodes │ Edges` | a small segmented pill group | `pvt-dock-views` / `pvt-dock-view` |

A pane with its own views does what the table does: draw the switch in its `toolbar`, and
call `refresh()` on its handle to change body. The inner classes are public, so your
switch is the built-in one rather than a restatement of it:

```js
function viewSwitch(current, pick) {
    const strip = document.createElement('div')
    strip.className = 'pvt-dock-views'
    for (const view of VIEWS) {
        const button = document.createElement('button')
        button.className = 'pvt-dock-view'
        button.textContent = view.label
        button.classList.toggle('active', view.key === current)
        button.addEventListener('click', () => pick(view.key))
        strip.appendChild(button)
    }
    return strip
}

graph.UIManager.addDockTab({
    label: 'Audit',
    toolbar: (pane) => [viewSwitch(current, (key) => { current = key; pane.refresh() })],
    render: () => renderCurrentView(),
})
```

Both levels take their active accent from `--pvt-theme-primary`, so a consumer that
retints the theme retints the dock with it; override either class to go further.

`refresh()` is not optional politeness — the dock keeps the element `render` handed it, so
a pane that swapped its own DOM would leave the dock re-attaching a stale node the next
time it came to the front.

See the [Add a dock pane](/examples/gallery/dock-panes/content) gallery card for a live
one, [`eventLog()`](/plugins#event-log) for a complete pane in the library itself, and
[Plugins](/plugins#dock-tab) for the plugin route.

### `UI.dock` — the region's own settings {#ui-dock}

`open`, `collapsed` and `height` describe the **region**, not the table, and `UI.dock` is
where they belong:

```js
// A dock holding only a plugin's pane, open on load
UI: { mode: 'full', table: false, dock: { open: true, height: 0.3 } }
```

`UI.table` still carries the same three settings and always did; those are honoured, and
`UI.dock` wins where both are set. Reach for `UI.dock` when the table is switched off —
that is the only door to a dock a plugin's tab brought with it.

## Programmatic control {#api}

```js
graph.openTable()
graph.closeTable()
graph.toggleTable()
```

Each is a no-op when there is no dock (any mode but `full`, or `UI.table: false`).
`openTable()` also brings the table's pane to the front, so a call named for the table
shows you one. To drive the region without that:

```js
graph.UIManager.dock?.setOpen(true)        // the region
graph.UIManager.activateDockTab('table')   // a pane, unfolding the dock if need be
graph.UIManager.getDockTabs()              // what is registered, in strip order
```

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
