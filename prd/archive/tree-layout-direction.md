# Tree layout and edge direction (backlog item B3)

**Status:** done 2026-08-20
**Source:** `prd/archive/tree-layout-backlog.md` → B3, which asked for `flipEdgeDirection` to be fixed.
**Outcome:** `flipEdgeDirection` is **deleted**, not fixed. The layout works out for itself when the
arrows are not a hierarchy.

## The question that started it

The demo page had been switched from the `ail` topology to `ail_reversed` — the same graph with every
edge reversed — because the tree looked bad one way round and good the other. So: *do we actually
need to flip the edges to get a nice tree?*

**No.** The flip was compensating for the spanning walk being directed, and it is the wrong lever
besides — see the mirror case below.

## What was actually wrong

The AIL graph is a three-tier funnel: 259 `message` nodes, 41 `chat`, 1 `user-account`. 258 of its
300 edges are `forwarded_from`, pointing **message → chat**; the other 42 are `forwarded_to`. So in
the as-is direction all 259 messages have in-degree 0 and everything converges on a few hubs.

`buildLevelsStatic` walked the spanning tree **directed** whenever the root came from a finder
(undirected only for a pinned `rootId`, the B2 path). Measured on the real data:

| | roots | edges kept in the hierarchy |
| --- | --- | --- |
| `ail` as-is, directed walk | **259** | **41 / 300** |
| `ail_reversed`, directed walk | 13 | 287 / 300 |
| either orientation, undirected walk | 1 | 299 / 300 |

That 41/300 is the whole story, and it is not about which way up the tree is. The best directed root
reaches 7 of 300 nodes, so 259 messages each became a root of their own hung under the synthetic
forest root — one 259-wide comb — and the 259 message→chat edges that lost the race for a parent slot
were drawn as cross edges flying the full width of the canvas.

## Why not just flip

`ail-graph2` is the exact mirror: as-is it is 299/299 edges in the hierarchy, reversed it is **3/299**.
One global `flipEdgeDirection` repairs one dataset and destroys the other, so there is no correct
value for the option — which is presumably why nothing in the UI or the test suite ever set it. It
also mutated real graph data (`setFrom`/`setTo` swap `source`/`target`, visible in the rendered arrows)
while `docs/layout.md` promised it "only affects the layout computation", and it left each node's
`registerEdgeOut`/`registerEdgeIn` registries pointing the old way.

## What ships instead

A fallback in `TreeLayout.buildLevelsStatic`. When the root it is about to walk from cannot cover half
of its own component along the arrows, it asks whether **any** node could have done better
(`findMaxReachabilityRoot`). If none can, the arrows do not describe a hierarchy at all: the walk
reads every edge both ways and re-roots at the middle of the graph
(`findUndirectedCenterRoot`, new in `plugins/analytics/DAGAlgorithms.ts`).

Plus: `flipEdgeDirection` gone from `TreeLayoutOptions`, from `Tree.ts`, from `docs/layout.md`, and
its unused `flipEdgeDirection` icon gone from `ui/icons.ts`. The demo is back on `topo = 'ail'`.

### Decisions

**1. Two-stage test, not one.** The first cut measured only the coverage of the root the finder had
picked, and it broke the existing `picking a finder re-roots the tree` spec — correctly. `MinHeight`
picks the node whose longest path down is shortest, which on any tree is a **leaf**; it reaches
nothing, and it is *meant* to. Overriding that would have made all three finders produce the same
tree on a clean 8-node arborescence, and the root menu would have been lying. So the test is about
the graph, not about the root: a root that covers little is only overruled when nothing else could
have covered more. The distinction is between *the arrows are not a hierarchy* and *this root is the
wrong end of a perfectly good one*.

**2. Coverage is measured against the root's own component,** not the whole graph. A graph of several
separate hierarchies is *supposed* to come out as a forest, and scoring against every node would read
that as a failure and throw away arrows that are perfectly good.

**3. A fallback, not the rule.** Where the arrows do form a hierarchy they are the best thing to lay
out by, and an org chart's natural root is the node at the top, not the node in the middle. This is
also why `ail` and `ail_reversed` now render *differently* — both well, but not identically: the
reversed one keeps its directed reading (96% coverage) and stays exactly as it was, which is the look
that prompted the question in the first place.

**4. Threshold at 0.5, and it is not a knob.** Across both AIL datasets in both orientations the two
regimes sit at 1–2% and 96–100%, so anything between them picks the same branch. Half is deliberately
weak: it should catch data that converges rather than branches, and leave alone a hierarchy that
merely has a few extra sources.

**5. Double sweep for the centre.** Walk to the farthest node, walk again from there, take the middle
of that path — O(V+E). On both AIL datasets it agreed with an exhaustive min-height search over every
node (O(V·E)) on the same root.

**6. Arrows may point up the tree, and that is left alone.** With direction given up, `ail` draws
message → chat → user-account as arrows pointing *toward* the root. For provenance data
("forwarded_from") that is the honest rendering, and flipping edges to force arrowheads outward is
exactly the data mutation B3 listed as a bug. If arrows must always read downward that is a layered
(Sugiyama) drawing, not a flip — and it was measured as no help here: longest-path layering on `ail`
gives a 259-wide top row, the same footprint as the tree, just funnel-shaped.

## Verified

- **Real code over the real demo data**, both datasets in both orientations, driving
  `TreeLayout.buildLevelsStatic` directly: `ail` as-is went from 259 roots / 41 tree edges to
  **1 root / 299 of 300 tree edges**; `ail_reversed` unchanged at 13 / 287; `ail2` as-is unchanged at
  1 / 299; `ail2` reversed went from 297 roots / 3 tree edges to 1 / 299.
- **Guard rails**: a clean arborescence keeps its top node as root and stays one tree; two disjoint
  hierarchies still come out as a 2-root forest rooted at the real sources; a pinned root is still
  honoured and still walked both ways.
- **The live demo** on the dev server, switched to a vertical tree and left to settle: three rows —
  1 root, 29 chats, 270 message leaves.
- `layout.spec.ts` 22/22 and `physics-flyout.spec.ts` 21/21, no baselines changed. A new
  `converging` fixture and a `layout.spec.ts` case cover the fallback.

## Left open

The root menu has no entry for the direction-blind root, so it cannot be *asked* for — only fallen
back to. Worth adding as a fifth choice ("Centre", the unused `balancedDistanced` icon fits) if
anyone wants it deliberately on data whose arrows do form a hierarchy.
