# PRD — Pivotick Library Fixes (surfaced by the documentation gallery)

**Status:** Backlog for a dedicated library pass
**Owner:** Sami Mokaddem
**Target branch:** `develop`
**Origin:** Extracted from the gallery PRD (`prd/gallery.md` §9).

---

## Progress

Grouped by subsystem. Status legend: ⬜ Todo · 🟨 In progress · ✅ Done.

| Topic | # | Issue | Primary location | Status |
|-------|---|-------|------------------|--------|
| Filtering | 1 | `queryEngine.excludeNode()` doesn't hide the node | `GraphQueryEngine.ts:98-117` | ✅ Done |
| Filtering | 2 | Filter panel ignores programmatic `setFilter()` | `GraphFilter.ts:60-63` | ✅ Done |
| Rendering | 8 | `renderNode` measured size doesn't feed collision radius | `NodeDrawer.ts` renderNode branch | ⬜ Todo |
| Clustering | 6 | No synthetic cluster→cluster edge for child→child | `Graph.ts:201` `normalizeGraphData` | ✅ Done |
| Clustering | 7 | `fitAndCenter()` races the cluster render | `GraphSvgRenderer.ts:626` | ✅ Done |
| Simulation | 3 | Expanded cluster over-repels, sim never settles | `Simulation.ts:~225`, `ClusterDrawer.ts:~573` | ✅ Done |
| Simulation | 4 | Charge force is `NaN` for node radius < 10 | `Simulation.ts` `initSimulationForceCharge` | ✅ Done |
| Simulation | 5 | `d3GravityStrength` ignored for any connected node | `Simulation.ts` `initSimulationForceGravity` | ✅ Done |

---

## 1. Background

Building the documentation gallery's 32 live demos exercised subsystems that had
never been shown before (clustering, the query/filter engine, custom HTML nodes,
large-graph scale) and exposed genuine library bugs. Each was **worked around in
the affected gallery card** so the gallery could ship, but the underlying defect
remains and affects real users, not just the docs.

This PRD collects those defects for a focused fix pass, independent of the
gallery. Each entry lists the symptom, the root cause with file/line, the card
that surfaced it (repro), and a proposed fix. Once a fix lands, the corresponding
gallery workaround can be simplified or removed.

## 2. Scope & non-goals

- **In scope:** the 8 defects below, all in `src/`.
- **Non-goals:** gallery content (done). Reworking the workarounds is optional
  follow-up per card, tracked separately.

---

## 3. Issues

### 1. `queryEngine.excludeNode()` doesn't hide the node
`src/GraphQueryEngine.ts:98-117`. It resolves the node via `graph.getNode(id)` —
which returns a `structuredClone` — then calls `graph.hideNode(clone)`, so the
*real* rendered node is untouched. It also never calls `this.apply()` (unlike
`clearNodeExclusions()`), so the `excludedNodeIds` set is updated but visibility
is never recomputed.
**Fix:** resolve with `getMutableNode` and/or route through `apply()`.
**Surfaced by:** I1 (filter/query engine) — shipped without a "hide node" button.

### 2. The built-in filter panel doesn't reflect programmatic `setFilter()`
`src/ui/elements/GraphFilter/GraphFilter.ts:60-63`. On `filterChange` it only
refreshes the button summary and the hidden-node list; it never repopulates the
form controls (the form is rebuilt only on `dataBatchChanged`). So a filter set
from code applies to the graph but the panel's dropdowns/sliders stay empty.
**Fix:** sync `formOptions`/form values from the active filters on `filterChange`.
**Surfaced by:** I1 (filter/query engine).

### 3. Expanded cluster nodes over-repel and the simulation never settles
`src/Simulation.ts:~225` (charge scaling + parent weight ×), with the
expanded-cluster radius from `src/renderers/svg/ClusterDrawer.ts:~573`. Many-body
charge scales with node radius while a parent node also gets a large weight
multiplier, so an expanded cluster (large radius) exerts a disproportionately
strong repulsive force — dragging a node re-heats the sim and neighbours are
pushed away indefinitely instead of cooling.
**Fix:** cap/normalise the charge (and collision radius) for cluster nodes rather
than scaling straight off the expanded radius.
**Surfaced by:** I3 (clusters & hierarchy); also affects L4.

### 4. The charge (repulsion) force is undefined for node radius < 10
`src/Simulation.ts` `initSimulationForceCharge`. It computes
`dampedRadius = 10 + Math.sqrt(radius - 10)`, so any node smaller than the default
radius 10 yields `Math.sqrt(<negative>) = NaN` and its charge strength becomes
`NaN`. Repulsion effectively dies for small nodes, so they collapse together
instead of spreading. Verified in K3: size-4 nodes piled into the centre; size ≥
11 separated correctly. (The worker's initial layout uses the default radius 10
and looks fine; the collapse only appears once the live main-thread sim runs with
the real small radius — which is why it looks like an intermittent "regroups in
the centre" bug.)
**Fix:** `Math.max(0, radius - 10)` (or clamp radius to ≥ 10) before the sqrt.
**Surfaced by:** K3 (large-graph scale). *(One-line fix — quick win.)*

### 5. `d3GravityStrength` is ignored for any connected node
`src/Simulation.ts` `initSimulationForceGravity`. Gravity strength is
`degree === 0 ? options.d3GravityStrength : 0.001` — so the configured gravity
applies only to isolated nodes; every node with an edge gets a hardcoded `0.001`.
Tuning `d3GravityStrength` on a normal (connected) graph therefore does nothing,
and layout spread is governed entirely by charge vs. link forces. Intentional per
the code comment ("connected nodes get negligible gravity so link forces + charge
repulsion find equilibrium"), but undocumented and surprising — a connected graph
with no counter-links to charge has no centring force and drifts apart.
**Fix:** at least document it; consider honouring a small configurable floor.
**Surfaced by:** K3 (large-graph scale).

### 6. Synthetic edges are only created for top-level → collapsed-child edges, never child → child
`src/Graph.ts:201`, `normalizeGraphData`. The fold-into-parent logic is gated on
`!edge.from.isChild && edge.to.isChild` — so an edge between two nodes that each
live inside a *different* collapsed cluster produces no synthetic cluster→cluster
edge; both endpoints are hidden children, so the dependency simply disappears when
both clusters are collapsed (and the two clusters get no link force pulling them
together, so they drift apart). This blocks the obvious "collapse every group into
a box and see the high-level dependencies between boxes" view.
**Fix:** also synthesise a parent→parent edge when `edge.from.isChild &&
edge.to.isChild` and the two ancestors differ.
**Surfaced by:** L4 (clustered infra/dependency map) — worked around by keeping
the app tier as flat top-level services and making only the backend subsystems
clusters that services depend *into* (top-level → cluster folds correctly).
**Resolved:** for a child→child link across two clusters, `normalizeGraphData` now
pre-creates the whole cross-product of ancestor pairs (`from-ancestor →
to-ancestor`, deduped) and tags them — plus the real edge — as *cross-cluster*
stand-ins. `Graph.resolveCrossClusterEdges` then shows exactly the one whose
endpoints are the nodes actually on screen (each side's deepest visible ancestor),
so the dependency re-targets through every collapse state: `group-a → group-b`
(both collapsed) → `a3 → group-b` (A open) → `group-a → b1` (B open) → real
`a3 → b1` (both open). It's rerun on load and on every expand/collapse (walking to
the root graph). Because each visible stand-in is either top-level→top-level or has
one child endpoint, `Simulation.getActiveEdges` turns it into a real (or
re-anchored) link, so the clusters stay pulled together in every state.
`toggleSyntheticEdges` and `setVisibleNodes` leave cross-cluster edges to the
resolver. Regression test:
`tests/visual/specs/cluster-cross-cluster-edge.spec.ts` (asserts the shown edge in
all four states + round-trip); demoed in the *Clusters & hierarchy* gallery card.

### 7. `fitAndCenter()` right after load/expand races the cluster render
`src/renderers/svg/GraphSvgRenderer.ts:626` (`fitAndCenter` reads
`zoomLayerEl.getBBox()`). Cluster nodes lay out their bubble / draw badges / set
their radius over the next few animation frames (`NodeDrawer`/`ClusterDrawer`
`requestAnimationFrame` chains), and `waitForSimulationStop()` resolves before
those frames land. So a `fitAndCenter()` called immediately measures a transient
(much larger) bbox and sets a zoomed-out, off-centre transform that is never
corrected — the graph appears tiny in a corner until the user clicks the fit
button.
**Fix:** re-fit (or expose a render-settled signal) once cluster layout/render has
completed.
**Surfaced by:** L4 (clustered infra/dependency map) — worked around with an
~800 ms settle before the final `fitAndCenter()`.
**Resolved:** new public `GraphRenderer.fitAndCenterWhenSettled()` — when a cluster
is expanded it polls the zoom-layer `getBBox()` each frame and only fits once the
box holds steady for a few frames (hard-capped at ~3 s so it can never hang);
with nothing expanded it fits immediately, so non-cluster graphs are unchanged.
The load fit (`Graph.startAndRender`), the expand/collapse fits
(`NodeDrawer.handleChildrenExpanded` + the collapse toggle) and the layout-switch
fit (`Simulation.switchLayout`) now route through it. Measured on `linkedClusters`
with both clusters expanded: an immediate fit locks in scale k≈2.86 off a transient
370×165 bbox, whereas `fitAndCenterWhenSettled()` lands on k≈0.94 (matching a
reference fit taken after a full 1.5 s settle) once the real 520×571 layout exists.
Regression test: `tests/visual/specs/cluster-fit-settle.spec.ts`. The two gallery
cards that hit this (`clusters-hierarchy`, `infra-dependency-map`) now call
`fitAndCenterWhenSettled()`, dropping the ~800 ms `setTimeout` workaround.

### 8. A `renderNode` node's measured size never feeds its collision radius
`src/renderers/svg/NodeDrawer.ts`, renderNode branch. The measured width/height
only updates `node.setCircleRadius(...)` when `enableNodeExpansion` is on (for the
cluster-bubble radius); a normal graph leaves the node at the default radius 10,
so the force sim treats a large HTML card as a tiny circle and packs them until
they overlap. And even if the radius were set, it happens in a post-reveal `rAF`
after the sim has cooled, so it wouldn't re-space without a reheat.
**Fix:** feed the measured radius into the collision force for custom nodes (and
reheat once, or measure before the initial layout settles). Also worth codifying
the authoring contract this surfaced — `renderNode` content must be self-sizing
(`inline-flex`/`inline-block`), or a block-level element stretches to fill the
measured `foreignObject`.
**Surfaced by:** B3 (custom HTML node) — worked around by tuning
`d3ManyBodyStrength`/`d3LinkDistance` to spread the cards.
**Note:** the *measurement* half of this area (custom HTML nodes rendering at 0×0)
was already fixed during the gallery pass; only the collision-radius half remains.

---

## 4. Suggested sequencing

1. **Quick wins:** #4 (one-line `Math.max`), #5 (document, optional floor).
2. **Query / filter surface:** #1, #2 (both make the query engine usable from
   code + reflected in the UI).
3. **Simulation & clustering (heavier, related):** #3, #6, #7, #8 — these touch
   the force model, cluster edge synthesis, and post-render fit; several share the
   `Simulation.ts` charge/collision code and the cluster render lifecycle, so
   tackle them together.
