# Enhancement — edge layers: key, style and *toggle* edges by kind

**Status:** Accepted — grilled 2026-08-25
**Owner:** Sami Mokaddem
**Requested:** 2026-08-24
**Area:** `src/interfaces/GraphUI.ts` (`UI.filter`, `LegendSection`), `src/GraphQueryEngine.ts` + `src/interfaces/GraphQueryEngine.ts`, `src/ui/elements/GraphFilter/GraphFilter.ts`, `src/interfaces/RendererOptions.ts` (`edgeTypeAccessor` / `edgeStyleMap`), `src/Edge.ts` (`visible`, `toggleVisibility`), `src/GraphRenderer.ts` + `src/renderers/*/EdgeDrawer.ts` (a public `getEdgeStyle`), `src/ui/elements/Legend/LegendSectionView.ts`
**Type:** Rendering + filtering / public options
**Related:** [`declarative-filter-facets.md`](declarative-filter-facets.md) (the facet declaration this extends to edges), [`multi-facet-legend.md`](multi-facet-legend.md) (**landed 2026-08-24**; it left `scope: 'edge'` to this PRD — see §4.5 and decisions §6.1–3, 6.6)

---

## 0. Instructions

Relentlessly ask me questions whenever you have a doubt on the implementation.

## 1. What we're trying to achieve

Let a consumer declare that its edges come in **kinds**, and get all three of: per-kind styling, a legend key, and a **visibility toggle** — so a graph carrying several relation types stays readable.

## 2. What professional tools do

- **vis-network** — edges live in a DataSet with a per-edge `hidden`; toggling a relation type is a data update, layout untouched.
- **Sigma.js** — `edgeReducer` returns per-edge display attributes, `hidden` included.
- **Cytoscape.js** — selector rules (`edge[kind="uses"]`) plus `.hide()` / `.show()` on any collection.
- **KeyLines / ReGraph** — `chart.filter()` applies to links as well as nodes, and link-type filters are a standard control.

Edge-kind layers are table stakes anywhere a graph carries more than one relation type.

## 3. Gap in Pivotick today

The **model** already supports it: `Edge.visible` (`src/Edge.ts:30`), `Edge.toggleVisibility()` (`:226`), and `Graph.getMutableVisibleEdges()` filtering on it (`src/Graph.ts:1002`).

What is missing is any declarative or UI route to that flag:

- `GraphFilter` builds facets from **node** data and selects **nodes**; it reads a node's edge count only to label the node (`GraphFilter.ts:197`).
- `GraphQueryEngine` concedes edges only as an *input* to a node facet ("computed facets (over children, edges, …)", `interfaces/GraphQueryEngine.ts:79`).
- `UI.legend` keys on node data, so a kind can't even be *named* in the legend.
- Per-kind styling is possible but undeclared: it means a hand-rolled `switch` inside `EdgeStyle.styleCb`, with no `edgeStyleMap` to mirror `nodeStyleMap`.

So a consumer with five relation kinds on one canvas can style them apart and then cannot turn any of them off.

### Consumer pain this causes (MISP integration)

The pivot explorer draws object references today. The planned graph adds correlations, analyst relationships, object/attribute containment and tag edges — five kinds at once, which is unreadable without layer control. The only workaround is rebuilding `setData` per toggle, which discards layout, selection and camera.

## 4. Proposal

1. **`render.edgeTypeAccessor?: (edge: Edge) => string | undefined`** mirroring `nodeTypeAccessor`, plus **`render.edgeStyleMap?: Record<string, Partial<EdgeStyle>>`** mirroring `nodeStyleMap`.
2. **`UI.filter` gains edge facets** — declared like node facets, keyed off edge data, driving `Edge.toggleVisibility()`.
3. **Toggling preserves layout, selection and camera.** No `setData`, no reheat.
4. **Hiding policy:** an edge whose layer is off is hidden even when both endpoints are visible; a node left with no visible edges **stays visible** — hiding it is a node-filter decision, not an edge one.
5. **A legend section naming the kinds.** `UI.legend` grew a stacked form on 2026-08-24
   ([`multi-facet-legend.md`](multi-facet-legend.md)) and deliberately left the edge
   half to this PRD, because everything it needs is declared here. A section carrying
   `scope: 'edge'` keys on edge data and — being a section like any other — filters
   through the edge facets above. Four pieces:
   - `scope?: 'node' | 'edge'` on `LegendSection`. Optional, so adding it is not a
     breaking change.
   - A **public** `renderer.getEdgeStyle(edge)`, promoted onto the `GraphRenderer`
     abstract beside `getNodeStyle`. Both renderers already resolve edge style
     privately (`renderers/svg/EdgeDrawer.ts:108`, `renderers/canvas/EdgeDrawer.ts:41`),
     so this is exposure, not new resolution logic.
   - `LegendSectionView.derive` / `sampleColor` generalised from "nodes and a node
     colour" to "a collection and a style sampler".
   - A **line** swatch — stroke colour, dash, width — instead of the node dot.

## 5. What the consumer does

```ts
new Pivotick(el, data, {
    render: {
        edgeTypeAccessor: e => e.getData()?.kind,
        edgeStyleMap: {
            'object-reference':     { strokeColor: '#428bca' },
            'correlation':          { strokeColor: '#888', dashed: true },
            'analyst-relationship': { strokeColor: '#f39a1f', dashed: true, markerEnd: 'arrow' },
        },
    },
    UI: {
        filter: { edgeFacets: [{ key: 'kind', title: 'Relationship layer' }] },
        legend: {
            sections: [
                { key: 'type', title: 'Element' },
                { key: 'kind', title: 'Relationship', scope: 'edge' },
            ],
        },
    },
})
```

## 6. Decisions

Grilled 2026-08-25. Twelve decisions; the three open questions are answered in 1, 2 and 3.

1. **Two reasons, one flag — a veto, not a reason set.** `Edge.visible` stays the
   effective rendered flag and gains a veto: `layerVisible` (default `true`), with
   `Edge.show()` reduced to `this.visible = this.layerVisible`. `edge.visible` has
   five independent writers today — `setVisibleNodes` (endpoints), `resolveCrossClusterEdges`
   (collapse), `ClusterDrawer` (six sites), `hideNode`/`showNode`, and normalisation —
   and gating the one chokepoint leaves all five untouched. Turning a layer back on
   re-runs the machinery that already knows the other reasons rather than remembering
   them itself.
2. **Cross-cluster stand-ins aggregate.** A stand-in is deduped by node *pair*, so it
   speaks for N real edges of possibly different kinds. It is hidden only once every
   relation it stands for is filtered out, and inherits the style when all of them
   share one kind. See 8 for what it holds.
3. **One `GraphFilters` record, `edge:`-prefixed keys.** `resetFilters()` restores
   every layer, the filter pill counts both scopes, `getFilters()` stays the whole
   truth, and a node facet and an edge facet may share a key name. `nodeMatchesFilters`
   gets one guard, like `manuallyHidden`.
4. **Edge facets take the full `FilterFacetType` vocabulary**, with `type` defaulting
   to `'multiselect'` and options auto-derived from the live edges — so `{ key: 'kind' }`
   suffices. `matches()` is already object-agnostic (it takes an `unknown` value), so
   regex-on-label and numberRange-on-weight cost one `edgeMatchesFilters` mirror rather
   than new matching logic.
5. **The layout is invariant across a toggle.** A layer-hidden edge stays in the link
   force, so the skeleton never moves; the toggle path skips `simulation.update()`
   entirely and only re-renders. `Simulation.getActiveEdges` gates on a companion
   `visibleIgnoringLayer` so endpoint-hidden edges and unchosen stand-ins still leave
   the force. This is what the tools in §2 do: vis-network makes `hidden` and `physics`
   two separate per-edge options, Sigma's `edgeReducer` never reaches the layout,
   Cytoscape only moves on an explicit `layout().run()`, and KeyLines re-tidies on a
   separate `chart.layout()`. Re-tidying after a toggle is the physics rail's job.
6. **`scope: 'edge'` filters standalone.** With no declared edge facet the section
   reserves an edge facet of its own and filters anyway, symmetric with node sections
   (`LegendSectionView.claimFacet`). When `edgeFacets` does declare the key, the section
   adopts it and the two views stay in sync both ways.
7. **An 18px swatch slot for every section.** The node dot stays 11px, centred in the
   slot; an edge entry draws a 13px rule plus a 5px arrowhead when `markerEnd` resolves.
   11px cannot show a dash pattern, and widening only edge sections would leave labels
   ragged down the mixed card §4.5 asks for. Costs one visual-baseline refresh.
8. **A stand-in holds `representedEdges`, not a set of kinds.** It passes the filter
   iff any represented edge does, which answers every facet type — `numberRange`,
   `regex`, `predicate` — through the identical matcher, instead of letting only
   `kind`-shaped facets reach a collapsed cluster.
9. **`getEdgeStyle` is promoted to the `GraphRenderer` abstract**; both renderers expose
   what they already resolve. Canvas keeps its four-property resolution, gains
   `edgeStyleMap`, and has its `opacity: edge.getStyle()?.color` bug fixed. It is not
   taught to draw dashes: the legend is descriptive, so a solid arrowless swatch is the
   truthful key for what canvas actually paints.
10. **`styleCb` bypasses `edgeStyleMap` wholesale**, exactly as `styleCb` bypasses
    `nodeStyleMap` today — per-property merging would be a different precedence from
    the one nodes already document.
11. **A "Relationships" section in the filter panel, toggled live.** Layers apply on
    click, like the legend, rather than behind "Filter Graph"; other edge facet types
    sit in the batch form. This required fixing `filterGraph`, which calls
    `resetFilters()` before `setFilters()` and so wipes any key the form doesn't own —
    a pre-existing bug that already cost the legend its toggles.
12. **`setEdgeFilter` / `getEdgeFilters` / `removeEdgeFilter` / `getHiddenEdgeCount`.**
    The `edge:` prefix of 3 is an internal encoding and never reaches consumer code.
    Reads stay on `getMutableVisibleEdges`, events on `legendToggle` and `filterChange`.

Smaller consequences, applied without a separate decision: edge facets and edge filters
push down to cluster subgraphs the way node facets do; an edge legend section derives
over real edges only, since synthetics carry no data and would otherwise fire the
blank-value warning once per stand-in; a section with neither `key` nor `entries` derives
from `edgeTypeAccessor`, and the "only one section may do that" rule becomes per-scope;
`getHiddenEdgeCount()` counts only layer-hidden edges, so the pill is unchanged for a
graph declaring no edge facets; and §4.4 needs no work, because a node with no visible
edges already stays visible.

## 7. Acceptance criteria

- `edgeTypeAccessor` + `edgeStyleMap` resolve per-kind edge style declaratively; a `styleCb` still wins over the map (same precedence as nodes).
- An edge facet renders in the filter panel and toggling it changes only edge visibility — node positions, selection and camera are bit-for-bit unchanged.
- A node whose every edge is hidden remains visible.
- A cross-cluster stand-in is hidden once every relation it stands for is filtered out, and stays drawn while any of them survives.
- Edge facets of every `FilterFacetType` match — a `regex` on an edge label and a `numberRange` on a weight both hide edges, and both reach stand-ins.
- A graph declaring no edge facets behaves exactly as today.
- A `UI.legend` section declaring `scope: 'edge'` lists the edge kinds with a **line** swatch reflecting the resolved edge style (stroke colour, dash, and a marker when one resolves), sitting beside node-scoped sections in the same card with labels aligned, and leaving them untouched.
- Toggling in that section hides the layer exactly as the panel's edge facet does, and the two stay in sync in both directions.
- A section declaring `scope: 'edge'` with no declared edge facet still filters, by reserving one of its own.
- Applying a node filter from the panel no longer clears filter keys the form doesn't own — the legend's toggles and the edge layers both survive it.
- Tests: toggle with a collapsed cluster present, toggle under an active node filter, restore order (layer off → node filter → layer on), layout stability across a toggle, and an edge-scoped legend section beside a node-scoped one whose swatch matches `renderer.getEdgeStyle`.
