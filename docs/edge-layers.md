---
outline: [2, 3]
---

# Edge layers

A graph whose relations all look alike stops being readable the moment it carries
more than one *kind* of relation. **Edge layers** are the three things you need to
fix that, and they are meant to be used together:

1. **Name the kind** — `render.edgeTypeAccessor`.
2. **Style it apart** — `render.edgeStyleMap`.
3. **Switch it off** — `UI.filter.edgeFacets`, surfaced as live toggles in the
   filter panel and, optionally, as a [legend section](#legend).

```ts
const options = {
    render: {
        edgeTypeAccessor: (edge) => edge.getData()?.kind,
        edgeStyleMap: {
            reference:   { strokeColor: '#428bca' },
            correlation: { strokeColor: '#888888', dashed: true, animateDash: false },
            sighting:    { strokeColor: '#f39a1f', dashed: true, markerEnd: 'circle' },
        },
    },
    UI: {
        filter: { edgeFacets: [{ key: 'kind', label: 'Relationship' }] },
    },
}
```

::: tip Switching a layer off never moves the graph
This is the property the whole feature is built around — see
[Toggling is a lens](#lens). Layout, selection and camera come back bit-for-bit
identical.
:::

## Naming and styling a kind

`edgeTypeAccessor` and `edgeStyleMap` mirror
[`nodeTypeAccessor` / `nodeStyleMap`](/render#type-of-rendering) exactly: the
accessor returns a string (or `undefined`), and the map turns that string into a
`Partial<EdgeStyle>` merged over the default edge style.

```ts
render: {
    edgeTypeAccessor: (edge) => edge.getData()?.kind,
    edgeStyleMap: {
        reference: { strokeColor: '#428bca', strokeWidth: 2 },
        contains:  { strokeColor: '#5cb85c', markerEnd: 'diamond' },
    },
}
```

Every `EdgeStyle` property is fair game — `strokeColor`, `strokeWidth`, `opacity`,
`curveStyle`, `dashed`, `animateDash`, `markerEnd`, `markerStart`, `rotateLabel`.
A `dashed` edge animates its dash by default; set `animateDash: false` for a kind
that should read as calm background context.

An edge with no kind, or a kind the map doesn't mention, keeps the default edge
style. Nothing warns: an unstyled kind is a legitimate choice.

### Precedence

The same order as nodes, narrowest wins:

| Priority | Where |
|---|---|
| 1 (wins) | the edge's own `style.styleCb` — **see the warning below** |
| 2 | the edge's own static `style` properties |
| 3 | `render.edgeStyleMap[kind]` |
| 4 | `render.defaultEdgeStyle.styleCb` |
| 5 | `render.defaultEdgeStyle` literals |

The two `styleCb` roles are not the same thing, and it is worth keeping them
straight. On an edge's **own** style it is an override that wins outright; on
`render.defaultEdgeStyle` it is the *computed form of the default slot*, filling
only what nothing narrower set — including what a per-edge `styleCb` left out.
Specificity ordering, not callback-beats-static.

::: warning An edge's own `styleCb` replaces its whole tier
When an edge's own style declares a `styleCb`, its return value is the **only**
source at that tier: the edge's own static properties *and* `edgeStyleMap` are both
skipped, and only `defaultEdgeStyle` fills the gaps. So a `styleCb` returning
`{ strokeWidth: 4 }` on an edge that also sets `strokeColor` loses that colour, and
loses the kind's colour too. If you want a callback *and* the kind's styling, do the
lookup inside the callback, or put the callback on `render.defaultEdgeStyle`, where
it yields to the map instead.
:::

::: warning The canvas renderer resolves less
`renderers/canvas` honours `edgeStyleMap` but reads only four of the nine
`EdgeStyle` properties. The SVG renderer — the default — resolves all of them.
:::

## Making a kind a layer

Styling kinds apart is only half of it. `UI.filter.edgeFacets` declares which edge
dimensions are *switchable*:

```ts
UI: {
    filter: {
        edgeFacets: [{ key: 'kind', label: 'Relationship' }],
    },
}
```

`{ key: 'kind' }` is a complete declaration. An edge facet has edge-shaped
defaults: a layer is a `multiselect`, and its options are derived from the
distinct values your real edges actually carry, so it can never offer a choice
that would come back empty.

**Nothing here is ever auto-derived.** Unlike [node facets](/ui-filter), which fall
back to scanning your data, a graph that declares no `edgeFacets` behaves exactly
like one that has never heard of layers. Edge visibility is too consequential to
guess at.

The filter panel grows a **`Relationships`** section: one row per kind, each with a
line swatch and a count, applying **at once** rather than waiting behind the
panel's *Filter Graph* button. A layer sitting behind an apply button reads wrong
when the legend beside it toggles instantly.

### Facets that aren't layers

`type` accepts the full [facet vocabulary](/ui-filter#facet-types) — `text`,
`regex`, `select`, `multiselect`, `numberRange`, `boolean` — plus `accessor` and
`predicate` for dimensions that aren't a plain data key:

```ts
edgeFacets: [
    { key: 'kind', label: 'Relationship' },                    // a layer
    { key: 'weight', label: 'Confidence', type: 'numberRange' }, // a batch control
    {
        key: 'recent',
        label: 'Seen this week',
        type: 'boolean',
        accessor: (edge) => Date.now() - edge.getData().seenAt < 7 * 864e5,
    },
]
```

Only the multiselect kind is a live toggle. Everything else is a batch control, so
it renders in the panel's attribute form alongside the node facets, where an apply
button is the right affordance.

### Options {#edge-facet-options}

| Option | Type | Default | What it does |
|---|---|---|---|
| `key` | `string` | — | Filter identity. `setEdgeFilter(key, …)` takes this. |
| `label` | `string` | prettified `key` | Used verbatim, so it can come from a translation layer. |
| `type` | `FilterFacetType` | `'multiselect'` | A layer is a set of kinds, each on or off. |
| `options` | `array \| (graph) => array` | derived | Resolved against the live graph on every rebuild. |
| `matchMode` | `FilterMatchMode` | `'exact'` | |
| `accessor` | `(edge) => unknown` | `edge.getData()[key]` | What makes computed facets possible. |
| `predicate` | `(edge, value) => boolean` | — | Full control; wins over `accessor` / `matchMode`. Runs per edge per application, so keep it cheap. |
| `order` | `number` | declaration order | Display order in the panel. |

## Toggling is a lens, not a layout change {#lens}

Switching a layer off changes **which lines are drawn and nothing else**. Node
positions, the selection and the camera are bit-for-bit unchanged, and no
simulation restarts.

That is deliberate, and it is what the professional tools do: vis-network carries
a per-edge `hidden` *and* a separate per-edge `physics`, Sigma's `edgeReducer`
never reaches the layout, Cytoscape and KeyLines re-layout only when asked. A
hidden relation is a display decision. If hiding a correlation layer re-flowed the
graph, you could not use the toggle to *read* the graph, which is the entire point.

Mechanically, `Edge` grew a second flag:

| Property | Meaning |
|---|---|
| `layerVisible` | Whether this edge's layer is switched on. A **veto** over `visible`. |
| `visibleIgnoringLayer` | What `visible` would be if every layer were on — endpoint, collapse and manual-hide reasons alone. |
| `setLayerVisible(on)` | Switch the layer, re-deriving `visible`. Returns whether anything changed. |
| `representedEdges` | For a cross-cluster stand-in: the real edges it speaks for. |

The link force gates on `visibleIgnoringLayer`, so an edge whose layer is off goes
on pulling its endpoints together. `visible` has five independent writers —
endpoint filtering, cluster collapse, the cluster drawer, `hideNode` / `showNode`,
and normalisation — which is why layer state could not live in it.

### A node left with no visible edges stays visible

Hiding it would be a *node*-filter decision, and an edge facet never takes one.
Use the [filter panel](/ui-filter) or `queryEngine.setFilter` if that is what you
want.

### An empty pick means every layer off

For a node multiselect an empty list is how the panel spells *unset* — no
constraint. An edge layer control writes exactly what stays on, so an emptied
layer list means every layer is off. There is nothing else it could mean, and it
is why an edge section has no "can't switch off the last one" limit.

## Keying the layers in the legend {#legend}

A [legend](/ui-legend) section declaring `scope: 'edge'` lists the kinds with a
**line** swatch — stroke colour, dash and marker as the renderer resolved them —
sitting beside node-scoped sections in the same docked card:

```ts
UI: {
    legend: {
        sections: [
            { key: 'type', title: 'Element' },                     // nodes
            { key: 'kind', title: 'Relationship', scope: 'edge' },  // edges
        ],
    },
}
```

- Given a matching `edgeFacets` declaration, the section **drives that facet** — the
  panel and the legend become two views of one filter, each following the other.
- Without one it reserves a facet of its own and still filters, so a legend is
  never merely decorative.
- A section with neither `key` nor `entries` uses `render.edgeTypeAccessor`, exactly
  as a node section falls back to `nodeTypeAccessor`.
- Counts are of **real** edges: a collapsed cluster's stand-ins are excluded, so a
  count never double-reports a relation.

Swatch colours are *sampled* from what the renderer painted, so a kind rendered in
more than one colour keeps the first and warns. Declare `entries` with your own
`color` when the kinds aren't what the strokes encode.

## Collapsed clusters

When a cluster collapses, the edges crossing its boundary are replaced by
**stand-ins**, and a stand-in is deduped by node *pair* — so one line can speak for
several real relations of several kinds.

Each stand-in therefore carries `representedEdges`, and it survives while **any**
of them passes the filter. Two consequences worth knowing:

- Hiding a layer hides a stand-in only once every relation behind it is hidden.
  A line that stands for both a `reference` and a `correlation` stays while either
  is on.
- Every facet type reaches inside a collapsed cluster — a `numberRange` or a
  `predicate`, not just a list of kinds — because the facet is matched against the
  real edges rather than the stand-in's own (empty) data.

A stand-in whose represented edges all share one kind inherits that kind's style.

## Driving it from code

Edge facets are registered in the constructor, so **programmatic filtering works in
every mode** — only the panel is `full`-mode chrome.

```ts
graph.queryEngine.setEdgeFilter('kind', { value: ['reference'], matchMode: 'exact' })
graph.queryEngine.getHiddenEdgeCount()      // 12
graph.queryEngine.removeEdgeFilter('kind')  // every layer back on
```

| Method | What it does |
|---|---|
| `setEdgeFilter(key, config)` | Write one edge filter. |
| `getEdgeFilters()` | The active edge filters, un-prefixed. |
| `removeEdgeFilter(key)` | Drop one — that layer set comes back on. |
| `getHiddenEdgeCount()` | How many edges are hidden by a layer. |
| `getEdgeFacetValues(key)` | The distinct values, each with a count and a sample edge. |
| `setEdgeFacets(facets)` | Replace the declared set. |
| `registerEdgeFacet(facet)` | Add one additively — what a legend section uses to reserve its own. |
| `replaceFilters(ownedKeys, filters)` | Replace only the keys you own, leaving others alone. |

Node and edge filters share one `GraphFilters` record, with edge keys carried under
an `edge:` prefix (`EDGE_FILTER_PREFIX`, exported from `GraphQueryEngine`) so a key
name can be a node facet and an edge facet at once. Every method above hides the
prefix; you only meet it if you read the raw record.

`renderer.getEdgeStyle(edge)` is public, returning the style the renderer actually
resolved — the same call the legend's swatches are built on, and the way to assert
in a test that what you declared is what is painted.

## See also

- [Edge layers gallery card](/examples/gallery/edge-layers/content) — all three
  surfaces on one canvas
- [Render options](/render) — the node half of the accessor/map pair
- [Filters](/ui-filter) — node facets, and the vocabulary edge facets reuse
- [Legend](/ui-legend) — sections, and what a swatch can and cannot know
