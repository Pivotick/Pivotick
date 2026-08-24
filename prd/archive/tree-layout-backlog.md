# Tree layout — deferred work

**Status:** closed — recorded 2026-08-20, all three items (B1/B2/B3) delivered 2026-08-20. Archived.
**Context:** surfaced while building `prd/archive/tree-layout-spacing.md`; deliberately not done there.

Things the tree layout needs that were each too big or too semantic to fold into a spacing change.
Sami's call (2026-08-20): "we'll definitely have to revisit the other big change afterward."

**All three are done.** B1 delivered 2026-08-20, see `prd/archive/tree-layout-cycles.md`; B2 delivered
2026-08-20, see `prd/archive/tree-root-picker.md`; B3 closed 2026-08-20 by *deleting* the option rather than
fixing it, see `prd/archive/tree-layout-direction.md`. The entries are kept below for the reasoning.

---

## B1 — A single cycle disables tree layouts entirely — **DONE**

`TreeLayout`'s constructor calls `hasCycle(nodes, edges)` and, on a hit, warns
("The graph contains a cycle, so it cannot be displayed as a tree") and returns before laying
anything out. `PhysicsFlyout.onGraphReady` runs the same check and disables all three tree tiles.
So **one back-edge in an otherwise hierarchical graph costs you the whole layout** — which, for
MISP-shaped data, is most real graphs.

Nothing about the maths requires this. `TreeLayout.buildLevelsStatic` is *already* cycle-tolerant:
it BFSes from the root and assigns each node the first (shortest) level it is reached at, skipping
nodes it has already seen. Only `buildTreeStatic`, which builds a `d3.hierarchy` from
`node.children`, needs a true tree.

**Shape of the fix:** build a spanning tree (the BFS tree `buildLevelsStatic` already walks) instead
of trusting the raw parent/child links, lay that out, and let the non-tree edges render as ordinary
edges across the layout — they will cross levels, which is honest and is what every hierarchical
graph drawing tool does. Then drop the cycle guard in the constructor and the tile-disabling in the
flyout, and keep `hasCycle` only for whatever genuinely needs a DAG.

**Watch out for:** nodes unreachable from the root (today they silently get no position — decide
whether they get a synthetic root, a second component, or stay force-placed); the notifier warning
and its wording; `EgoTreeLayout`, which builds its own one-level hierarchy and is unaffected;
`tests/visual/specs/physics-flyout.spec.ts` → "tree layouts are disabled on a cyclic graph", which
asserts today's behaviour and would need to invert.

## B2 — No root picker in the UI — **DONE**

`rootId` and `rootIdAlgorithmFinder` are real options (`'FirstZeroInDegree' | 'MaxReachability' |
'MinMaxDistance' | 'MinHeight'`, implemented in `plugins/analytics/DAGAlgorithms.ts`) with no way to
reach them from the interface — the flyout always takes the default. The **icons were already drawn
for it**: `firstValidNode`, `mostConnectedNode`, `balancedDistanced` and `minHeight` in
`src/ui/icons.ts` map one-to-one onto the four algorithms and are referenced nowhere in `src/`.

**Shape of the fix:** a row in the Spacing/Layout area of the Physics flyout — four algorithm tiles
using those icons, plus "use the selected node as root" (the selection is already in
`GraphInteractions`, and `Sidebar/Neighbors.ts` shows the pattern: it switches to `egoTree` rooted at
the selected node). Re-rooting is just `changeLayout('tree', { layout: { rootId } })`, so the
plumbing exists.

## B3 — `flipEdgeDirection` is broken three ways — **DONE (removed)**

1. **Net no-op on load.** The constructor flips, then calls `update()`, which flips again.
2. **Toggles on every re-layout.** `update()` runs on any graph change (and now on a spacing drag),
   so the tree swings between the two orientations.
3. **It mutates real graph data.** The flip calls `edge.setFrom`/`setTo`, which swap the edge's
   `source`/`target` — visible in rendered arrow direction — while `docs/layout.md` promises it
   "only affects the layout computation, not the underlying graph data". It also leaves each node's
   `registerEdgeOut`/`registerEdgeIn` registries pointing the old way.

**Decision needed before coding:** should flipping change the drawing, or only the layout? If only
the layout (what the docs say), build a reversed *view* for `buildLevels` / `buildTree` / `hasCycle`
instead of mutating edges. If it should change the drawing too, fix the registries and the docs.

**Answered 2026-08-20: neither — the option is gone.** The question that reopened this was whether the
AIL demo needed its edges flipped to give a decent tree. It does not: the flip was compensating for
the spanning walk being directed, and a flip cannot be right for two datasets at once — reversing
`ail-graph` takes it from 41 to 287 of 300 edges kept in the hierarchy, and reversing `ail-graph2`
takes it from 299 to 3 of 299. `buildLevelsStatic` now gives up on direction by itself when no node
can cover its component along the arrows. See `prd/archive/tree-layout-direction.md`.
Nothing in the UI or the test suite sets the option today, so there is no user to break either way.
