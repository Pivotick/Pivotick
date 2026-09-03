---
outline: [2, 3]
---

# Legend

`UI.legend` docks a **legend** in a canvas corner: one row per category, each with a
colour swatch, a label and the number of nodes behind it. Pointing at a row lights
that category on the canvas; clicking one hides it, so the legend doubles as the
fastest filter in the UI.

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

A graph that encodes several things at once needs several keys: pass `sections`
instead of a single key — see [Several keys at once](#sections).

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

## Several keys at once {#sections}

A graph that encodes three things — kind in the fill, provenance in the enclosure,
relationship in the stroke — needs three keys, not one. Pass `sections` and each gets
its own titled block, stacked top to bottom in **declaration order** inside one docked
card:

```ts
UI: {
    legend: {
        position: 'bottom-left',        // the card docks; sections don't
        sections: [
            { key: 'type',  title: 'Element' },
            { key: 'scope', title: 'Provenance' },
            { key: 'tlp',   title: 'Sharing', filterable: false },
        ],
    },
}
```

A section takes everything a single legend takes except `position`, which belongs to
the card. Sections are independent in every other way: their own entries, their own
counts, their own fold state, their own filter.

### Filters and together

Each filterable section drives **its own filter**, and the query engine ands them:
switch `attribute` off in the first section and `self` off in the second, and what
stays on the canvas is the nodes that are **neither**. Every section's `show all`
clears only that section.

A section writes to `__legend:<id>`, where the id is the section's `id`, else its
`key`, else its place in the stack (`section-0`). A **single-key** legend — the object
form — keeps the plain `__legend` it has always used. As with a lone legend, a section
whose `key` names a declared `select` / `multiselect` facet
[drives that facet](#sharing-a-filter-with-the-panel) instead, and its siblings are
unaffected.

### Keying edges instead of nodes

A section declaring `scope: 'edge'` lists the graph's **relation kinds** with a *line*
swatch — stroke colour, dash and marker as the renderer resolved them — and its toggles
hide edge layers rather than nodes. It sits beside node-scoped sections in the same card
and leaves them untouched. See [Edge layers](/edge-layers#legend) for the whole feature.

```ts
UI: {
    legend: {
        sections: [
            { key: 'type', title: 'Element' },
            { key: 'kind', title: 'Relationship', scope: 'edge' },
        ],
    },
}
```

### Naming the dimension you style by

A section with neither `key` nor `entries` is the dimension you already declared as
`render.nodeTypeAccessor` — the one spelling for a styling dimension that isn't a
plain data key. It skips the [colour check](#on-by-default): inside a `sections` list
you asked for it. Only one section may do this; a second is dropped with a warning.

```ts
UI: { legend: { sections: [{}, { key: 'scope', title: 'Provenance' }] } }
//                         ↑ whatever nodeTypeAccessor returns, headed "Type"
```

::: warning A section keyed off the colour dimension
Swatches are **sampled from the colours the renderer resolved**, and that is the only
channel the legend can read. A section keyed on a dimension the colours don't encode
— provenance, when provenance is drawn as an enclosure — gets the colour of the first
node in each category, and warns that the category renders more than one. Declare
`entries` with your own `color` on that section to give it swatches that mean
something.
:::

### Space

Sections fold individually; **alt**-click any chevron to fold or unfold the whole
stack at once. Each section still scrolls its own list past `maxVisibleEntries`, and
the card as a whole is capped against the canvas height and scrolls rather than
growing past it — so six sections stay inside the viewport.

A section that resolves to **no entries** (a key no node carries, an empty
declaration) is skipped entirely rather than shown as an empty titled box; a card
whose sections are all empty renders nothing at all.

## Hovering a category

Point at a row and the canvas answers: the elements that category stands for keep the
look they have, everything else dims until the pointer leaves. Nothing is filtered and
nothing moves, so it is the cheap way to find where a category sits before deciding
whether to switch it off.

A row on a [`scope: 'edge'`](#keying-edges-instead-of-nodes) section lights its
**lines**, with the nodes receding along with the other layers.

Pointing at a category that is already switched off dims nothing — there is nothing
left on the canvas for it to light.

`highlightOnHover: false` turns it off for a section. A `filterable: false` key
highlights too, where it is the only thing a row does.

The same set can be lit from code, and holds until it is cleared:

```js
graph.emphasiseElements(graph.getMutableNodes().filter((node) => node.getData()?.type === 'md5'))
graph.clearEmphasis()
```

Both take the elements the renderer drew, so they read `getMutableNodes()` /
`getMutableEdges()` rather than the cloning getters.

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
through a predicate — one per section, namespaced as `__legend:<id>`, in the
[stacked form](#sections).

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
graph.on('legendToggle', ({ section, hidden, visible }) => {
    localStorage.setItem(`legend.hidden.${section}`, JSON.stringify(hidden))
})
```

`section` is the id of the section that was toggled, and `hidden` / `visible` are that
section's rows. A single-key legend reports its own derived id (its `key`, else
`section-0`).

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
graph.setLegend({ sections: [{ key: 'zone' }, { key: 'tier' }] })
graph.setLegend(false)        // remove it
graph.setLegend(true)         // back to the derived one
```

Swapping between the two forms renames the filter keys, so the filters of the form you
left are dropped: nothing stays hidden behind a section that is gone.

## Options

`UI.legend` also takes a **boolean**: `false` suppresses the legend, `true` derives one
from `render.nodeTypeAccessor` without vetting the colours first. Everything below is
the object form.

The **stacked** form is `{ enabled?, position?, sections }`: `sections` is the list
below minus `position`, and `enabled` / `position` describe the whole card.

| Option | Type | Default | What it does |
|---|---|---|---|
| `enabled` | `boolean` | `true` | `false` keeps the declaration but shows nothing (same as `legend: false`). |
| `id` | `string` | `key`, else `section-<index>` | Section identity: its filter key (`__legend:<id>`) and the `legendToggle` `section` field. |
| `title` | `string` | prettified `key`, else `'Legend'` | Header text, used verbatim (so it can be translated). |
| `key` | `string` | — | Data key the rows are derived from, and the default predicate for declared entries. Omit both this and `entries` for the [automatic](#on-by-default) legend. |
| `entries` | `LegendEntry[] \| (graph) => LegendEntry[]` | — | Declared rows; a function is re-resolved on data change. |
| `position` | `'bottom-left' \| 'bottom-right' \| 'top-left' \| 'top-right'` | `'bottom-right'` in `full` mode, else `'bottom-left'` | Which canvas corner it docks in. Belongs to the card, so it is **not** a section option. `'top-left'` shares its anchor with the contextual tool panel, which covers the legend while open. |
| `collapsible` | `boolean` | `true` | Show the chevron that folds it to its title. |
| `collapsed` | `boolean` | `false` | Start folded. |
| `showCounts` | `boolean` | `true` | Show the per-category node count (over the whole graph, so it doesn't flicker as you toggle). |
| `filterable` | `boolean` | `true` | `false` renders a plain, non-interactive key. |
| `highlightOnHover` | `boolean` | `true` | Hovering a row lights that category on the canvas and dims the rest. |
| `maxVisibleEntries` | `number` | `12` | Rows shown before the list scrolls inside the legend. |

A `LegendEntry` is `{ id, label?, color, predicate?, order? }`. `id` is the row's
identity, the value written to the filter, and the label's fallback.

`maxVisibleEntries` is one ceiling on the legend's height; the canvas is the other.

In `full` mode the legend docks bottom-right by default, stacking above the minimap
that mode also mounts: the left column belongs to the mode rail and its panels, and a
rail mode whose panel is a workspace rather than a settings sheet reaches far enough
down it to leave the legend a single row. Where a minimap shares the chosen corner the
legend sits on top of it, following it as it collapses, resizes or unmounts.

A `bottom-left` legend shares its column with the mode rail, so on a short viewport it
shrinks to the room between them and scrolls at whatever row that lands on, rather
than growing up under the rail. It never moves corner on its own.

## Interaction

| Gesture | Effect |
|---|---|
| Hover a row | Light that category on the canvas, dim everything else |
| Click a row | Hide / show that category |
| **Alt**-click a row | Show only that category |
| Header **show all** | Re-light every row (clears the legend's filter) |
| Header **invert** | Swap which categories are shown |
| Header **chevron** | Fold that section to its title |
| **Alt**-click the chevron | Fold or unfold every section at once |

Rows are real buttons: tab-reachable, `Enter` / `Space` toggle, and `aria-pressed`
carries the state. A hidden row is drawn with a hollow swatch **and** dimmed text, so
colour is never the only signal.

See the [Filterable legend](/examples/gallery/filterable-legend/content) gallery card
for a live example, and
[`LegendOptions`](/api/html/interfaces/GraphUI.LegendOptions.html) /
[`LegendGroupOptions`](/api/html/interfaces/GraphUI.LegendGroupOptions.html) for the
full types.
