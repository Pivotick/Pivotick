# Tree layouts for graphs that are not perfect hierarchies

**Status:** done, 2026-08-20
**Branch:** `worktree-auto-physics-preset`
**Was:** B1 in `prd/archive/tree-layout-backlog.md`

---

## 1. The problem

One back-edge disabled the whole feature. `TreeLayout`'s constructor called `hasCycle` and, on a hit,
warned *"The graph contains a cycle, so it cannot be displayed as a tree"* and returned before
laying anything out; `PhysicsFlyout` ran the same check and disabled all three tree tiles. For
MISP-shaped data — where a cycle is the norm, not the exception — the tree layouts were mostly
unavailable.

Nothing about the maths required it. `buildLevelsStatic` was **already** cycle-tolerant: it BFSes
from the root and takes the first (shortest) level at which each node is reached. Only
`buildTreeStatic` needed a true tree, because it built `node.children` by looping over every edge —
and `d3.hierarchy` walks children, so a cycle never terminates.

## 2. The fix

Build the hierarchy from the **BFS spanning tree** instead of from the raw edges.
`buildLevelsStatic` already walks it; it now also returns `parentOf` (the edge each node was first
reached by) and `roots`, and `buildTreeStatic` links children from that map. Three things fall out:

- **A cycle costs one edge its place in the hierarchy, nothing more.** The back-edge arrives at an
  already-visited node, so it is not a tree edge; it is still drawn, crossing levels, like any other.
- **A node with two parents is claimed by exactly one.** Previously a diamond `a→b, a→c, b→d, c→d`
  put `d` in the tree twice — two positions, last write wins, and a wasted slot. This was already
  wrong for perfectly legal DAGs, cycle or no cycle.
- **The guards go away**: constructor, `buildTreeStatic`, `registerForcesOnSimulation`,
  `EgoTreeLayout.buildTreeStatic`, and the flyout's tile-disabling. `hasCycle` now has no caller in
  `src/` (left in place — `plugins/analytics/` is a documented surface).

## 3. Decisions

**D1 — Every node gets a slot, so a forest is a first-class case.** The backlog left this open, and
it could not stay open: a graph the root cannot fully reach leaves nodes with no position, and the
tree forces fall back to `0` for a node they have no position for — quietly stacking them on the
origin. The BFS now restarts from each unreached component, and the components are hung under one
**synthetic root** (`FOREST_ROOT_ID`) so d3 spreads them side by side. It is not a graph node and is
filtered out of every result, so it is never drawn and never positioned.

**D1a — A node with no edges at all is parked, not given a slot.** Follow-up, after seeing it: with
every node guaranteed a place, the edgeless ones landed on the root's *own row*, and `separation`
(`1.5 / siblingCount`) packed them tight against it — six strays read as six children of the root.
They now go in the **dead space beside the shallow levels**, at the trailing edge of the layout, one
cell clear of the tree's silhouette; the radial layout gives them a ring of their own outside the
last. Three things decided this shape:

- *Not below the tree.* A tree widens as it descends, so below is where it is busiest, and a strip
  there also extends the layout's height. (Sami's observation.)
- *Inside the bounding box.* The view is fitted, so anything parked outside the box zooms the whole
  tree out to make room for a few stray dots. The wedge beside the shallow levels is free real estate
  and costs the view nothing. Radial is the exception — a disc has no wedge — and its extra ring does
  grow the box by one ring gap.
- *Trailing edge, not leading.* The mode rail runs down the left of the canvas and the flyouts open
  over it, so nodes parked there sit behind a panel.

**D1b — "No edges" means no edges in either direction.** The tempting definition was "its own
component", but the BFS follows edge *direction*: a node whose only edge points *into* the tree is
unreachable from the root while still being connected to it. Parking one of those would leave an edge
stretching from the tree to the parking area (Sami spotted this before it was built). Only nodes
nothing points at *and* which point at nothing are parked; everything else is a component, laid out
side by side.

**D2 — A component root prefers a node with no incoming edges.** A second component that *is* a
hierarchy should be drawn as one, rather than rooted at whichever node happened to come first in the
array. A component that is a pure cycle has no such node and falls back to the first one left.

**D3 — `levels` is shifted by one for a forest.** A synthetic root puts every real node one level
deeper, and `levels` feeds the radial force while the positions come from the hierarchy. Left
unshifted they would disagree by exactly one ring — the same class of bug as the `levels × 100`
mismatch fixed in `9a54663`, so the shift lives next to the BFS that causes it.

**D4 — Root finders were checked, not changed.** All four are cycle-safe: `FirstZeroInDegree` is
set-based, `MaxReachability` (the default) walks iteratively with a visited set and a traversal cap,
and the two topological-sort ones detect the cycle and fall back to the first node with a console
warning. Documented rather than papered over.

## 4. Two traps in the parking code

**`node.degree()` reports 0 for every node in a connected graph.** It counts the node's own
`edgesIn`/`edgesOut` registries, and those are empty for the node objects a graph builds from data —
so the first implementation parked the entire graph. Parked-ness is read off the edge list being laid
out instead, which is the authoritative thing anyway.

**A parked node must not also be the root.** With nothing linked at all, the root search still
returned *some* node, which then appeared both as the hierarchy's root and in the parking grid — two
positions, and the `pair` fixture (two edgeless nodes) landed one above the other instead of side by
side. Now no root is searched for when nothing is linked: every node is parked and laid out as a
grid. An explicitly passed `rootId` is exempt — naming a root is a deliberate choice, so it counts as
linked even with no edges.

## 5. Also fixed along the way

- **`EgoTreeLayout` counted a mutual pair twice.** It scanned edges for anything touching the root,
  so `a→b` *and* `b→a` pushed `b` as a child twice — two ring slots for one neighbour. Unreachable
  before, since a mutual pair is a cycle and the layout refused to run at all.
- **A node with no usable radius blanked the layout.** Found while testing forests: a non-numeric
  `getCircleRadius()` turned an auto-spacing gap into `NaN`, then the multiplier, then the box d3
  normalises the tree onto — so every coordinate came out `NaN`. See `prd/archive/auto-tree-spacing.md` §6.

## 6. What is asserted

`tests/visual/specs/layout.spec.ts`:

- **a cyclic graph is laid out as a tree, its back-edge crossing levels** — the `basic` fixture is a
  pentagon with a hub pointing into it, i.e. exactly the shape that used to be refused. The hub roots
  the tree, `a`/`c` share the row below it, and the ring is walked one level per step, with `e→a`
  left out of the hierarchy.
- **a forest is laid out side by side, not stacked on the origin** — three components: every node
  lands on a level of the hierarchy, so a dozen of them share a handful of rows rather than keeping
  the scattered positions of nodes nothing placed.
- **nodes with no edges are parked clear of the tree** — the parked ones sit past the tree's reach on
  the row they share with it, and only on the shallow rows where a tree leaves room.
- **a node with no usable radius does not blank the layout** — every coordinate finite, spacing back
  at `1×`.

`tests/visual/specs/physics-flyout.spec.ts`:

- **tree layouts are offered on a cyclic graph** — the inverse of the test that pinned the old
  behaviour; the tiles are enabled *and* the click switches the layout.
- **collision radius stays live under a tree, except a radial one** — including that it still drives
  the simulation from there, and that the knobs a tree really does ignore are gone.
