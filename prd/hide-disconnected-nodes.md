# Feature — hide nodes with no visible relation

**Status:** done — shipped 2026-08-26 on `worktree-worktree-hide-disconnected`, since merged into develop. Part of 1.6.0.
**Owner:** Sami Mokaddem
**Requested:** 2026-08-26
**Area:** `src/GraphQueryEngine.ts`, `src/Graph.ts`, `src/interfaces/GraphQueryEngine.ts`, `src/ui/elements/ViewFlyout/`, `src/ui/elements/Flyout/`
**Type:** filtering — one node-side rule, plus one switch in the View flyout.
**Related:** `edge-layers-shipped` (this is the answer to the orphan nodes an edge-layer toggle leaves behind), `filterable-legend-prd` (the legend writes edge filters and needs no new surface for this).

---

## 1. Why

Switching an edge layer off — from the filter panel's Relationships section or from a
`scope: 'edge'` legend section — hides lines and nothing else, on purpose. A node whose
only relation was in that layer stays on the canvas with nothing attached to it.

That is the right default: a layer is a lens, and a toggle that re-flowed the graph could
not be used to *read* it. But on a graph where one layer carries most of the relations,
switching it off leaves a field of stranded nodes, and there is currently no way to clean
them up.

The fix belongs on the **node** side, with the node filters, not in the legend or the
layer control. Those write edge filters; a node-side rule reacts to whatever they wrote.
One owner per concern, and the layer toggle stays honest for everyone who doesn't opt in.

## 2. What ships

1. **`UI.filter.hideDisconnected?: boolean`** — default `false`. When on, a node with no
   visible edge is hidden.
2. **A "Hide unconnected nodes" switch in the View flyout**, on every graph, unticked
   unless the option turns it on. While it is hiding, the row says how many nodes are
   gone. Not present in `viewer` / `static` mode, which have no flyout.
3. **`graph.queryEngine.reapply()`** — recompute filters now. Filters are only applied
   when a filter changes, so a graph whose data moved underneath it can go stale.

## 3. Decisions taken

Resolved one by one in the 2026-08-26 review. Binding.

| # | Decision | Ruling |
|---|---|---|
| D1 | Who owns the rule | The **query engine** narrows the visible set; `Graph` lends it one shared test (`edgeWouldBeVisible`). Rejected: `setVisibleNodes(nodes, hideDisconnected)` — its argument would stop meaning "the visible nodes", and the who-is-hidden-and-why decision would leave the class that owns every other such answer. |
| D2 | What counts as connected | At least one **visible** edge, counted after edge layers and endpoint hiding. A **self-loop counts** (a line is drawn). |
| D3 | Cross-cluster stand-ins | Their visibility is owned by `Graph.resolveCrossClusterEdges` (collapse state), so the shared test cannot answer for them: count one when its own `visible` is true **and** both endpoints survived the node filters. Errs toward under-hiding, which looks untidy; over-hiding would remove a node with a line still attached, which looks broken. |
| D4 | Cascade | **Single pass.** A node with no visible edge hides no visible edge when it goes, so one pass is already the fixed point. |
| D5 | Cluster interiors | The rule runs on the **main canvas only**. Clusters are often groups of things with no links between them (group by type and you get ten nodes and no edges) — applying it inside would show an empty box on expand. Accepted cost: an open cluster can still show orphans the canvas has hidden. |
| D6 | Cluster nodes themselves | **No exemption.** A cluster whose every relation is switched off goes like any other node. Its children go with it — that follows from the rule, and the switch is one click away. |
| D7 | Emptying the canvas | **No guard.** Switch off every layer and nothing is connected, so nothing is drawn. A guard would mean the rule silently stops working in some situations, which is harder to explain, and filters can already empty a graph by matching nothing. The switch is the way back. |
| D8 | Notes | A note pinned to a node **does not** count as a connection. The renderer already skips connectors to invisible targets, so the note just floats. |
| D9 | Manually hidden nodes | Untouched. Every hide a user can reach (context menu, bulk actions) goes through `excludeNode`, which the engine remembers; only "Show node" reverses it. |
| D10 | Option shape | A plain **boolean**. A three-value `false \| 'whenFiltering' \| 'always'` was drafted first and cut: `'whenFiltering'` would show the switch ticked while the orphans were still on screen, and the switch already covers the case it existed for. |
| D11 | Startup | With the option on, the rule runs in the **constructor, before the first layout** — so orphans never reach the canvas. `setVisibleNodes` gains a `notify` flag for it. Rejected: running it at `ready()`, which fires after the simulation has settled and the fit was requested (nodes would appear, vanish, and the graph would re-settle). |
| D12 | Where the count shows | **On the toggle row only.** The filter pill keeps its current meaning — "your filters hide N nodes" — and does not absorb these. |
| D13 | Table Visibility column | Left as is: these nodes read `filtered`. A fourth `disconnected` state is new dropdown copy for a distinction nobody is looking for. |
| D14 | Stale data | Not special-cased. A node created from code has no edges yet, so with the switch on it is hidden at the next recompute. `reapply()` is the honest control; hooking `dataBatchChanged` would fight the editing flow and is separate work. |

## 4. How it works

### The rule, inside one `apply()`

```
node filters  →  candidate set
applyEdgeLayers()             ← layer flags final
drop disconnected(candidates) ← the new pass
setVisibleNodes(final)        ← commits once
```

The order matters twice. It must run **after** `applyEdgeLayers()`, or it decides against
the previous application's layer flags. It must run **before** `setVisibleNodes()`, because
that is what derives edge visibility from node visibility — so at decision time `edge.visible`
is still last time's answer, and the rule has to *predict* it for the candidate set instead of
reading it.

That prediction is the test D1 extracts:

```ts
// Graph
/** @private Would this edge be drawn, given the node ids that are about to be visible? */
edgeWouldBeVisible(edge: Edge, visibleIds: Set<string>): boolean
```

`setVisibleNodes` uses the same call, so there is one copy of the answer. Cross-cluster
stand-ins are the caller's business either way: `setVisibleNodes` skips them, the rule reads
their own flag (D3).

### Re-layout

Hidden nodes leave the simulation (`Simulation.update` feeds `nodes.filter(visible)`), so
the graph re-settles. That is unavoidable and it is the one promise this feature bends:
`docs/edge-layers.md#lens` states that switching a layer off leaves layout, selection and
camera bit-for-bit unchanged. It still does — unless you opt in. Both the option and that
section get the caveat.

### API added

| Call | Meaning |
|---|---|
| `queryEngine.setHideDisconnected(on)` | Turn the rule on/off; re-applies and emits `filterChange`. |
| `queryEngine.isHideDisconnected()` | Current state — what the switch reads. |
| `queryEngine.getDisconnectedNodeCount()` | How many nodes the rule is hiding — what the switch row shows. |
| `queryEngine.reapply()` | Recompute now; emits `filterChange`. |
| `queryEngine.applyInitialVisibility()` | `@private`. The constructor's quiet first pass; a no-op unless the rule is on. |

## 5. Tests

One new spec, `tests/visual/specs/hide-disconnected.spec.ts`, asserting **drawn node counts**
rather than screenshots — the suite ignores small pixel differences and a re-fit races the
capture.

1. Option on at startup: the loner never appears; the switch shows ticked and reports it.
2. Ticking the real switch in the View flyout hides it; unticking brings it back.
3. Switching an edge layer off with the switch ticked hides the nodes it stranded — and
   switching off a layer that strands nobody hides nothing.

## 6. Out of scope

- Re-applying filters when the data changes (`reapply()` is the hook; the automatic version
  is its own effort).
- A `disconnected` state in the table's Visibility column (D13).
- Applying the rule inside clusters (D5).
