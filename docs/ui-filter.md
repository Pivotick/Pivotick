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

## Where the panel gets its values

Filter *values* always flow through `graph.queryEngine`, whichever way the form is
built — so the header's active-filter count, the **Hidden nodes** list, and
propagation into an expanded cluster's subgraph all keep working. Declared facets
are handed down to a cluster's subgraph too, so an `accessor` / `predicate` facet
filters children exactly as it filters top-level nodes.

See the [Filter / query engine](/examples/gallery/filter-query-engine/content)
gallery card for a live example, and
[`FilterFacet`](/api/html/interfaces/GraphQueryEngine.FilterFacet.html) for the
full type.
