# Tree root picker (backlog item B2)

**Status:** done 2026-08-20
**Source:** `prd/tree-layout-backlog.md` → B2. B1 (cycles) shipped in `prd/tree-layout-cycles.md`.

`rootId` and `rootIdAlgorithmFinder` are real `TreeLayoutOptions`, implemented in
`plugins/analytics/DAGAlgorithms.ts`, with no way to reach them from the interface: the Physics
flyout always builds a tree at the default root. Four icons were drawn for the picker
(`firstValidNode`, `mostConnectedNode`, `balancedDistanced`, `minHeight`) and are referenced nowhere.

## What ships

A **Root row** in the Physics flyout, shown exactly when the Spacing card is — i.e. whenever a tree
layout is active — sitting above it. One line: the label `Root`, and a picker naming what the tree
hangs from. Clicking it opens a menu of four:

| Entry | Icon | What it does |
| --- | --- | --- |
| **Selected node** | `selectElement` | Hangs the tree from the selected node. Disabled, and says "Select a node first", while nothing is selected. Once picked, the row shows the *node's* label instead of a finder name. |
| **First source** | `firstValidNode` | `FirstZeroInDegree` — the first node nothing points at. |
| **Widest reach** | `mostConnectedNode` | `MaxReachability` — reaches the most other nodes. The default, so the row starts here. |
| **Shallowest** | `minHeight` | `MinHeight` — makes the tree as shallow as it can be. |

Plus the API the row drives: `simulation.setTreeRoot()` / `getTreeRoot()`, mirroring the
`setTreeSpacing` / `getTreeSpacing` pair — a re-root is a re-layout of the same tree, not a new
layout, so it goes through `TreeLayout.setRoot()` → `relayout()` rather than `changeLayout`.

### Why a menu and not tiles

The first cut was four full-width tiles in a card of their own, and at 219&nbsp;px it was the tallest
control in the panel — for something a session sets once. Seven alternatives were drawn to scale in
the panel's real CSS and compared; the shortlist came down to a collapsing drawer (50&nbsp;px closed)
and this menu (53&nbsp;px). They tie on height, so the decision was behavioural:

- **The panel never moves.** The drawer expands *inline*, pushing Spacing and Simulation down
  166&nbsp;px and scrolling the flyout on a short window. The menu is portaled to `<body>`, so it
  floats over them and nothing reflows.
- **Every choice gets a sentence.** "First source" and "Shallowest" do not explain themselves in two
  words, and a tile can only hide the explanation in a tooltip.
- **No state to keep.** There is no open-or-closed to remember, or to decide whether it outlives
  closing the flyout.
- **No new component.** `PivotickDropdown` already portals, positions itself `fixed`, flips up near
  the bottom of the window, closes on select and on an outside click, and takes arbitrary `html` per
  option — which is what carries the two-line entries.

The drawer's one real argument was reuse: a `drawerRow()` in the `Flyout` base that Spacing and
Simulation could adopt too. That is still available if the flyout goes that way; it just is not worth
building for this row alone.

## Decisions

1. **An explicitly picked root walks the graph as undirected.** The spanning-tree BFS follows edge
   direction, so rooting at a leaf reaches nothing and the graph falls apart into components: the
   picked node alone, plus the old tree beside it. Naming a root is a deliberate choice, so it wins
   over arrow direction — which is already the rule `EgoTreeLayout` uses ("build parent-child
   relationships ignoring edge direction") and already the rule for `isLinked`, where a named root
   counts as linked even with no edges. The three *algorithm* roots keep walking directed: they are
   inferred from the arrows in the first place. Edges are still **drawn** with their own direction,
   so an edge used backwards as a hierarchy link renders as an arrow pointing up a level.
2. **Three algorithm tiles, not four.** `findMinMaxDistanceRoot` and `findMinHeightDAGRoot` are the
   same function twice over — same adjacency, same Kahn topological sort, same longest-path DP, same
   `min` — differing only in a `||` vs `??` that cannot change an answer, and in their warning text.
   Shipping both as tiles would be shipping the same tile twice. `'MinMaxDistance'` stays a valid
   option value (one now delegates to the other), so nothing outside breaks; `balancedDistanced`
   stays an unused icon.
3. **A pinned root that leaves the graph is not forgotten.** A `rootId` naming a node that is not in
   the node set — filtered out, deleted, in a collapsed cluster — is ignored for that layout pass and
   the algorithm root is used instead; the pin itself is kept, so the node coming back re-roots the
   tree. Today such an id is walked anyway: it reaches nothing, so every real component becomes its
   own root and the whole graph is laid out as a forest one level too deep.
4. **The root survives an orientation switch**, the same way the spacing does: the tile row folds
   into the options handed to `changeLayout`, or clicking `tree-h` after re-rooting would silently
   revert to the default root.

## Fixed on the way (beyond the layout)

- `PivotickDropdown` had no caller in `src/` and leaked its listeners: `attach()` registered
  anonymous handlers on `document` and `window`, and `destroy()` removed only the root element, so
  every scroll went on measuring a detached node. They are fields now, and `destroy()` takes them
  off. Its disabled items are also styled cursor-only, so an unreachable choice read as a reachable
  one — dimmed here, scoped to these rows rather than changed in the shared component.
- `Graph.getNode()` `structuredClone`s the node it returns, which throws on the DOM references a
  rendered node holds — so naming the pinned root has to go through `getMutableNode()`.

## Fixed on the way

- `TreeLayout.layoutOnce` passes `undefined` where `buildLevels` takes `passedRootId`, so `levels` —
  and with it the radial force's ring assignment — is computed from the *algorithm's* root while the
  positions come from `options.rootId`. Latent today (nothing sets `rootId`); load-bearing the
  moment the picker does.

## Side effect worth knowing

`EgoTreeLayout` always has an explicit `rootId`, so both new rules reach it: its `levels` are now
BFS distances from the ego node (they were measured from whatever `MaxReachability` picked, which is
usually a different node) and they ignore edge direction — which is what its own hierarchy already
does, and what the radial force it registers wants. `tests/visual/specs/layout.spec.ts`'s two ego
tests pass unchanged.

## Out of scope

- B3 (`flipEdgeDirection` is broken three ways) — closed 2026-08-20 by removing the option; see
  `prd/tree-layout-direction.md`.
- A `drawerRow()` for the `Flyout` base, so Spacing and Simulation can collapse — see above.
- Making the *algorithm* root finders direction-agnostic, or an "ignore edge direction" switch of
  its own.
