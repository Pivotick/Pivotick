---
outline: [2, 3]
---

# Legend

`UI.legend` docks a **legend** in a canvas corner: one row per category, each with a
colour swatch, a label and the number of nodes behind it. Clicking a row hides that
category, so the legend doubles as the fastest filter in the UI.

```ts
const options = {
    UI: {
        legend: { key: 'type', title: 'Node type' },
    },
}
```

You may not need that block at all: with no `UI.legend`, a legend appears **on its
own** when your graph's colours are explained by a declared `render.nodeTypeAccessor`
— see [On by default](#on-by-default). `UI.legend: false` turns it off.

The legend is part of the chrome, so it appears in `full` and `light` modes only —
`viewer` and `static` have none.

::: tip The legend never colours anything
The legend is **descriptive**. It reads the colour the renderer already resolved for
a node (`renderer.getNodeStyle(node).color`) and reports it. Colouring stays where it
was: `render.defaultNodeStyle.color`, `render.nodeStyleMap`, or a per-node style —
typically via [`ColorPaletteMapper`](/examples/gallery/color-by-category/content).
Change the palette and the legend follows on its own.
:::

## On by default {#on-by-default}

A legend is only worth showing unasked if it is guaranteed to tell the truth, so the
automatic one starts from something you already declared rather than from a guess
about your data: **`render.nodeTypeAccessor`**, the dimension you point
[`nodeStyleMap`](/render) at.

Having a candidate isn't enough, though — a dimension can partition your data without
having anything to do with its colours. So before rendering anything, the legend
checks that this dimension **explains the colours**:

- every category resolves to exactly **one** colour;
- there are at least **two** distinct colours (otherwise the colours aren't telling
  the categories apart);
- there are at most **24** categories — an id-like dimension yields one value per
  node, each with its own colour, which would otherwise sail through the check above.

If any of that fails, no legend appears and nothing is logged: you didn't ask for one.
The automatic legend is also skipped past **5000 nodes**, where sampling every node's
colour isn't worth paying for uninvited — that one warns, so the absence is
explainable. Declaring `UI.legend` (or `true`) lifts both.

```ts
// nothing declared → a legend appears iff `type` explains the colours
render: { nodeTypeAccessor: (node) => node.getData().type, nodeStyleMap: { … } }

UI: { legend: false }   // never
UI: { legend: true }    // derive from nodeTypeAccessor, check or no check
UI: { legend: { position: 'top-right' } }   // automatic entries, your placement
```

An automatic legend keys on an accessor rather than a data key, so it can't
[share a filter](#sharing-a-filter-with-the-panel) with a declared facet — give it an
explicit `key` for that.

## Where the entries come from

### Derived from a data key

`key` is the whole configuration in the common case: the distinct values of
`node.getData()[key]` become the rows, in first-seen order, labelled with the value
itself.

```ts
UI: { legend: { key: 'type' } }
```

An **array-valued** key contributes one row per element, and a node counts under
each of them (`tags: ['public', 'critical']` appears under both).

Two things are worth knowing about derived rows:

- **Nodes with no value** for the key (`null`, `undefined`, `''`) get no row, and the
  legend can never hide them — it only acts on the categories it lists. A dev-time
  warning names the key and how many nodes are unrepresented.
- **A category painted in more than one colour** keeps the first colour found, with a
  warning: one row can only show one swatch. Declare the entries yourself if the
  grouping isn't really one colour.

### Declared entries

Pass `entries` when the categories aren't a plain data key — computed groupings,
translated labels, a fixed colour scale. Each entry carries its own `predicate`,
which is what the toggle filters on.

```ts
UI: {
    legend: {
        title: 'Tier',
        entries: [
            { id: 'edge', label: 'Edge', color: '#0072B2',
              predicate: (node) => node.getData().type === 'web' },
            { id: 'storage', label: 'Storage', color: '#009E73',
              predicate: (node) => ['database', 'cache'].includes(node.getData().type) },
        ],
    },
}
```

`entries` may also be a **function** of the graph, re-resolved whenever the data
changes — so the list follows the data without the declaration churning:

```ts
UI: {
    legend: {
        key: 'type',
        entries: (graph) => distinct(graph, 'type').map((type) => ({
            id: type,
            label: t(`type.${type}`),        // translated, used verbatim
            color: palette.getColor(type),
        })),
    },
}
```

Declaring both `entries` and `key` is the useful middle ground shown above: the
entries give the labels and colours, and `key` supplies the default predicate
(`data[key] === id`) for entries that don't carry one. An entry with neither warns
and matches nothing.

A row's toggle state survives a re-resolution; an entry that disappears from the data
loses it rather than lingering as a hidden ghost.

## Filtering

Toggling a row writes a filter to `graph.queryEngine` — the same engine the
[filter panel](/ui-filter) drives — so nothing about it is a second, parallel
mechanism:

- Nodes added **after** a toggle, in a hidden category, arrive hidden.
- A hidden category stays hidden inside an expanded cluster's subgraph.
- `resetFilters()`, or the panel's **Reset**, re-lights every row.
- With every row shown the filter is *removed*, so the header's active-filter count
  doesn't report a legend that isn't hiding anything.

By default the legend owns a reserved filter key of its own (`__legend`) matched
through a predicate.

### Sharing a filter with the panel

When `key` names a declared `select` / `multiselect`
[facet](/ui-filter#declared-facets), the legend drives **that facet's key** instead.
The legend and the panel then become two views of one filter: switch a swatch off and
the panel's multiselect drops that value; pick values in the panel and the legend
re-lights accordingly.

```ts
UI: {
    filter: { facets: [{ key: 'type', label: 'Type', type: 'multiselect', options: … }] },
    legend: { key: 'type' },   // ⇒ writes setFilter('type', …)
}
```

Two consequences of speaking the panel's language:

- An **empty** multiselect means *no constraint* to the panel, so the legend can't
  express "hide everything": the last shown row is disabled rather than writing a
  value that would bring the whole graph back. A legend on its own key has no such
  limit.
- Nodes with **no value** for the key are hidden by any selection, exactly as they are
  when you filter from the panel.

If `key` names a facet of another type (`text`, `regex`, `numberRange`, `boolean`) the
legend keeps its own key and warns — a value list has no meaning there.

## Reading the toggles

Every toggle is announced on the [data event bus](/callbacks):

```ts
graph.on('legendToggle', ({ hidden, visible }) => {
    localStorage.setItem('legend.hidden', JSON.stringify(hidden))
})
```

Restoring is the same call the legend makes:

```ts
graph.queryEngine.setFilter('__legend', { value: visible, matchMode: 'exact' })
```

## Changing the legend at runtime

`graph.setLegend(config)` replaces `UI.legend` live. A graph that started without a
legend gets one built on the spot, and `false` removes it — clearing its filter with
it, so nothing stays hidden behind a legend that is gone.

```ts
graph.setLegend({ key: 'zone', title: 'Region' })
graph.setLegend(false)        // remove it
graph.setLegend(true)         // back to the derived one
```

## Options

`UI.legend` also takes a **boolean**: `false` suppresses the legend, `true` derives one
from `render.nodeTypeAccessor` without vetting the colours first. Everything below is
the object form.

| Option | Type | Default | What it does |
|---|---|---|---|
| `enabled` | `boolean` | `true` | `false` keeps the declaration but shows nothing (same as `legend: false`). |
| `title` | `string` | prettified `key`, else `'Legend'` | Header text, used verbatim (so it can be translated). |
| `key` | `string` | — | Data key the rows are derived from, and the default predicate for declared entries. Omit both this and `entries` for the [automatic](#on-by-default) legend. |
| `entries` | `LegendEntry[] \| (graph) => LegendEntry[]` | — | Declared rows; a function is re-resolved on data change. |
| `position` | `'bottom-left' \| 'bottom-right' \| 'top-left' \| 'top-right'` | `'bottom-left'` | Which canvas corner it docks in. |
| `collapsible` | `boolean` | `true` | Show the chevron that folds it to its title. |
| `collapsed` | `boolean` | `false` | Start folded. |
| `showCounts` | `boolean` | `true` | Show the per-category node count (over the whole graph, so it doesn't flicker as you toggle). |
| `filterable` | `boolean` | `true` | `false` renders a plain, non-interactive key. |
| `maxVisibleEntries` | `number` | `12` | Rows shown before the list scrolls inside the legend. |

A `LegendEntry` is `{ id, label?, color, predicate?, order? }`. `id` is the row's
identity, the value written to the filter, and the label's fallback.

## Interaction

| Gesture | Effect |
|---|---|
| Click a row | Hide / show that category |
| **Alt**-click a row | Show only that category |
| Header **show all** | Re-light every row (clears the legend's filter) |
| Header **invert** | Swap which categories are shown |
| Header **chevron** | Fold the legend to its title |

Rows are real buttons: tab-reachable, `Enter` / `Space` toggle, and `aria-pressed`
carries the state. A hidden row is drawn with a hollow swatch **and** dimmed text, so
colour is never the only signal.

See the [Filterable legend](/examples/gallery/filterable-legend/content) gallery card
for a live example, and
[`LegendOptions`](/api/html/interfaces/GraphUI.LegendOptions.html) for the full type.
