---
outline: [2, 3]
---

# Filter Options

In `full` mode the header carries a **Graph Filters** panel (the funnel icon, or
**Shift+K**) whose form is built for you. By default the library derives that form
by scanning node data; `UI.filter` lets you take that over.

```ts
const options = {
    UI: {
        filter: {
            facets: [ /* … */ ],   // declare the facets — the form follows
            excludeKeys: ['uuid'], // or just prune the derived ones
        },
    },
}
```

::: tip Filtering edges, not nodes
Everything on this page selects **nodes**. To filter *edges* — hiding a whole relation
kind without moving the graph — declare `UI.filter.edgeFacets` instead; they reuse the
same facet vocabulary and are documented under [Edge layers](/edge-layers).
:::

## Auto-derivation (the default)

With no `UI.filter` at all, the panel walks every node's data keys, collects the
distinct values per key, and picks a widget from what it finds:

| What the values look like | Widget |
|---|---|
| all numbers | `numberRange` (min / max) |
| 3+ short strings | `multiselect` |
| 1–2 short strings | `select` |
| booleans | `select` (true / false) |
| anything else | `text` |

Labels are prettified from the key (`attr-type` → *Attr Type*). This is a good
zero-config default for exploratory data, but it has no way of knowing which keys
are *facets* and which are internals — a `uuid` becomes a dropdown with one option
per node, and a long free-text field degrades to a text box.

### `excludeKeys`

The cheap fix when derivation is nearly right: drop the keys that are noise.

```ts
UI: { filter: { excludeKeys: ['uuid', 'imageUrl', 'description'] } }
```

## Declared facets

Set `facets` and the form is generated from your declaration instead — exactly the
fields you list, in the order you list them, with your labels. Auto-derivation is
skipped entirely, so nothing churns as data changes.

```ts
UI: {
    filter: {
        facets: [
            { key: 'category', label: 'Category', type: 'multiselect',
              options: (graph) => distinct(graph, 'category') },
            { key: 'to_ids',   label: 'IDS flag', type: 'boolean' },
            { key: 'value',    label: 'Value',    type: 'regex' },
        ],
    },
}
```

A facet's `key` is also the key `queryEngine.setFilter(key, …)` uses, so
programmatic filtering and the panel stay on the same footing.

### Facet types

- **`text`** — substring or exact match, per `matchMode`.
- **`regex`** — a pattern, compiled **case-insensitively**. An uncompilable pattern
  is reported on the field and leaves the active filters untouched.
- **`select`** / **`multiselect`** — pick from `options`. Pass an array, or a
  function resolved against the live graph so option lists follow the data
  without the facet set itself changing.
- **`numberRange`** — a min / max pair.
- **`boolean`** — a true / false / unset dropdown.

### Labels

A declared `label` is used **verbatim**, so it can come from your translation
layer. Omit it and the key is prettified as in auto-derivation.

### Computed facets: `accessor`

By default a facet reads `node.getData()[key]`. An `accessor` reads whatever you
like — including things that aren't on the node at all:

```ts
// "this object contains an attribute of type X" — reads the node's children
{ key: 'child_type', label: 'Contains attribute of type', type: 'multiselect',
  options: () => ATTRIBUTE_TYPES,
  accessor: (node) => node.children.map((child) => child.getData()['attr-type']) }
```

Returning an array is fine — see [matching arrays](#matching-arrays) below.

### Full control: `predicate`

A `predicate` decides membership itself, and wins over `accessor` / `matchMode`.
It runs per node per filter application, so keep it cheap.

```ts
{ key: 'busy', label: 'Busy services', type: 'text',
  predicate: (node, value) => node.getData().load >= Number(value) }
```

A facet whose `accessor` or `predicate` throws stops matching (and warns once)
rather than taking the render down with it.

### Ordering

Fields follow declaration order. Set `order` on a facet to place it explicitly —
handy when facets are assembled from several places.

## Matching

`matchMode` decides how a filter value is compared:

- **`'exact'`** <Badge type="warning" text="default" /> — strict equality. For a
  multiselect (an array of picks) this is membership: any-of.
- **`'partial'`** — substring match, `String(nodeValue).includes(value)`.
- **`'all'`** — and-semantics: every selected value must be present.

### Matching arrays {#matching-arrays}

When a node's value is an **array** — `data.tags = ['tlp:amber', 'malware']` — a
filter tests **membership**, not equality:

```ts
// matches nodes tagged 'malware'; does NOT match a node tagged 'not-malware'
graph.queryEngine.setFilter('tags', { value: 'malware' })

// any-of: amber OR green
graph.queryEngine.setFilter('tags', { value: ['tlp:amber', 'tlp:green'] })

// all: amber AND green
graph.queryEngine.setFilter('tags', { value: ['tlp:amber', 'tlp:green'], matchMode: 'all' })
```

With `'partial'`, any single element may substring-match. A `numberRange` against
an array matches when any element falls inside the range.

::: warning Behaviour change
Before this was supported, an array node value fell through to
`String(nodeValue).includes(value)` — so a filter for `malware` accidentally
matched a node tagged `not-malware`, and an array filter value never matched at
all. Both now behave as described above.
:::

## Hiding unconnected nodes {#hide-disconnected}

Filtering relations away leaves nodes behind. Switch an
[edge layer](/edge-layers) off and a node whose only relation was in it stays on the
canvas with nothing attached — which is deliberate, because a layer is a lens. When you
*do* want those nodes gone, that is a node-side rule:

```ts
const options = {
    UI: {
        filter: { hideDisconnected: true },
    },
}
```

A node is hidden when it has no **visible** edge left, counted after the layers and the
node filters have had their say. A self-loop counts as a relation; a note pinned to a
node does not.

The same switch is in the **View** flyout as *Hide unconnected*, on every graph, off
unless the option turns it on — so a user can clean up the orphans a layer toggle left,
or put back the ones you hid. While it is hiding, the row says how many.

::: warning This one moves the graph
Everything else on this page, and every edge layer, leaves the layout alone. A hidden
node leaves the simulation, so the rest re-settle. That is the trade for a tidy canvas,
and it is why the rule is off by default.
:::

Two things it deliberately does not do:

- **Cluster interiors are left alone.** Clusters routinely group nodes with no relations
  between them, so applying the rule inside one would open an empty box.
- **Nothing is protected.** Switch off every layer and nothing is connected, so nothing
  is drawn. The switch is the way back.

```ts
graph.queryEngine.setHideDisconnected(true)  // same as the switch
graph.queryEngine.isHideDisconnected()
graph.queryEngine.getDisconnectedNodeCount() // what the switch row reports
```

## Re-applying after the data changes {#reapply}

Filters are applied when a filter changes — not when the graph's data does. Add the edge
a node was missing and it stays hidden until something recomputes:

```ts
graph.updateData(newNodes, newEdges)
graph.queryEngine.reapply()   // recompute now
```

Worth knowing before you call it: re-deriving visibility **undoes a manual
`graph.hideNode()`**, which nothing remembers. `queryEngine.excludeNode()` is the hide
that survives — it is what the context menu and the bulk actions use, and only *Show
node* reverses it.

## Where the panel gets its values

Filter *values* always flow through `graph.queryEngine`, whichever way the form is
built — so the header's active-filter count, the **Hidden nodes** list, and
propagation into an expanded cluster's subgraph all keep working. Declared facets
are handed down to a cluster's subgraph too, so an `accessor` / `predicate` facet
filters children exactly as it filters top-level nodes.

The canvas [legend](/ui-legend) is a third way into the same engine: clicking a
legend row hides that category. Give the legend the `key` of a declared
`select` / `multiselect` facet and the two drive **one** filter, so the panel's
control and the legend stay in step.

The [data table](/ui-table#apply-to-graph) is a fourth: its **Apply to graph** button
hides the elements its column filters leave out. That push lands under a reserved key of
its own, so it survives pressing **Filter Graph** here and is combined with whatever this
panel is filtering rather than replacing it. Because the form structurally cannot show a
reserved key, the panel grows a **From the table** row naming what the push is hiding —
and the only other place it can be cleared from, once the dock is folded away.

See the [Filter / query engine](/examples/gallery/filter-query-engine/content)
gallery card for a live example, and
[`FilterFacet`](/api/html/interfaces/GraphQueryEngine.FilterFacet.html) for the
full type.
