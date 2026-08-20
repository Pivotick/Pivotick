# Tree layouts for graphs that are not perfect hierarchies

**Status:** done, 2026-08-20
**Branch:** `worktree-auto-physics-preset`
**Was:** B1 in `prd/tree-layout-backlog.md`

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

## 4. Also fixed along the way

- **`EgoTreeLayout` counted a mutual pair twice.** It scanned edges for anything touching the root,
  so `a→b` *and* `b→a` pushed `b` as a child twice — two ring slots for one neighbour. Unreachable
  before, since a mutual pair is a cycle and the layout refused to run at all.
- **A node with no usable radius blanked the layout.** Found while testing forests: a non-numeric
  `getCircleRadius()` turned an auto-spacing gap into `NaN`, then the multiplier, then the box d3
  normalises the tree onto — so every coordinate came out `NaN`. See `prd/auto-tree-spacing.md` §6.

## 5. What is asserted

`tests/visual/specs/layout.spec.ts`:

- **a cyclic graph is laid out as a tree, its back-edge crossing levels** — the `basic` fixture is a
  pentagon with a hub pointing into it, i.e. exactly the shape that used to be refused. The hub roots
  the tree, `a`/`c` share the row below it, and the ring is walked one level per step, with `e→a`
  left out of the hierarchy.
- **a forest is laid out side by side, not stacked on the origin** — two edgeless nodes, so two
  roots: same row, different columns.
- **a node with no usable radius does not blank the layout** — every coordinate finite, spacing back
  at `1×`.

`tests/visual/specs/physics-flyout.spec.ts`:

- **tree layouts are offered on a cyclic graph** — the inverse of the test that pinned the old
  behaviour; the tiles are enabled *and* the click switches the layout.
- **collision radius stays live under a tree, except a radial one** — including that it still drives
  the simulation from there, and that the knobs a tree really does ignore are gone.
