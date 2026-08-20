# `Auto` spacing for tree layouts

**Status:** done, 2026-08-20
**Branch:** `worktree-auto-physics-preset`
**Follows:** `prd/tree-layout-spacing.md`, `prd/auto-physics-preset.md`

---

## 1. Why the sliders were not enough

`prd/tree-layout-spacing.md` gave a tree layout two multipliers to turn. It left the *starting*
value at whatever the canvas happened to imply, and that starting value has a real defect: a tree
is sized from the canvas and **never looks at how big its nodes are**.

`buildTreeStatic` sizes a d3 tree to the canvas box and lets d3 normalise the tree onto it. Node
radii appear nowhere. So a tree of 10px dots and a tree of 40px avatars, same topology, get
identical coordinates — and the second one overlaps. `forceCollide` is still active under a tree and
partially rescues the free axis, but the pinned axis has no such luck, and collide fights the tree
force rather than cooperating with it.

The `separation` callback makes it worse in a way worth naming: `1.5 / siblingsCount` means a parent
with eight children packs them *tighter* than a parent with two. It is a fitting hack, not a spacing
policy.

## 2. Decisions

**D1 — Measure the tree, don't model it.** Rather than predicting spacing from node count and depth
(what `tunePhysics` does for the force layout, because a force layout has no positions until it
runs), auto lays the tree out and measures the **tightest pair of neighbours on each axis**, then
asks what that pair needs: both radii plus a margin. A tree layout is deterministic, so its geometry
is available for free — no model needed, and the `separation` hack above is accounted for
automatically rather than reverse-engineered.

**D2 — One correction pass, not a loop.** Every gap on an axis scales linearly with its multiplier,
so `needed × current / measured` is exact and the pair that is tightest stays tightest. `update()`
lays out, measures, and lays out once more — and skips the second pass entirely when the answer is
unchanged, which is the common case.

**D3 — Auto only ever opens a tree up, never packs it tighter** (`AUTO_FLOOR = 1`). The complaint it
answers is crowding; a sparse graph's fitted layout is already fine, and "just enough room" would
draw every small tree as a tight knot in the middle of an empty canvas. This is also what makes
auto safe as a default: on a graph that was never crowded it is a bit-for-bit no-op, which the four
pre-existing tree baselines confirm.

**D4 — Default on, but never a takeover.** Same rule as `Simulation.shouldAutoTune`, decided from
the *raw* partial before the merge: a tree that set `levelSpacing` or `siblingSpacing` explicitly
keeps exactly what it asked for. `layout.spacing: 'auto' | 'manual'` forces it either way, and
dragging a slider leaves auto permanently (`setSpacing` sets `spacing: 'manual'`).

**D5 — Auto speaks only in slider values.** Answers are rounded *up* onto the slider's 0.1 step and
clamped to `TREE_SPACING_RANGE`, so every value auto picks is one the user could have dragged to and
the sliders can display it honestly. A graph that needs more than the ceiling stays crowded —
visible, and preferable to auto moving a control past where the control goes.

**D6 — Radial folds sibling crowding into the ring gap.** A radial level always spans the full
circle, so the only way to give neighbours room is to push the rings out. Both measurements drive
`levelSpacing`, and `siblingSpacing` is left alone (its slider is already disabled there).

**D7 — Tile clicks hand over the *mode*, not the numbers.** `changeLayout` builds a fresh
`TreeLayout`, and under auto the flyout passes `spacing: 'auto'` rather than the current multipliers:
the new tree may be a different shape — a radial tree crowds where a vertical one does not — so it
must be free to re-derive rather than inherit.

## 3. Constants, and where they come from

- `LEVEL_MARGIN = 24` px on top of the two radii. A default arrowhead is 12px
  (`styles/defaults.ts`), and it reads as an arrow rather than a smudge only with some visible edge
  either side of it.
- `SIBLING_MARGIN = 16` px — a channel wide enough to read as a gap.

## 4. What it actually chooses

Measured through the real UI (`loadAuto` fixtures, 1280×720 canvas), vertical tree:

| graph | level | sibling |
|---|---|---|
| 8 nodes, r10 (the `tree` fixture) | 1× | 1× |
| 60 nodes, r10 | 1× | 1.4× |
| 60 nodes, r30 | 1× | 3× |
| 200 nodes, r10 | 1× | 5.4× |
| 40-node chain, r10 | **2.4×** | 1× |
| 40-node chain, r10, horizontal | **1.4×** | 1× |

Two things to read out of this. A bushy tree crowds across, never down — depth grows with log(n)
while breadth grows with n — so `levelSpacing` only moves for deep graphs, which is why the chain
case exists. And the chain's numbers are exactly the arithmetic: 720px over 39 levels is 18.5px
against the 44px two default nodes and an arrowhead need → 2.4×; horizontally the same chain gets
1280px over 39 levels → 1.4×, which is the axis fix from commit `9a54663` visible in a number.

## 5. Where the ceiling ended up

The multipliers shipped with a shared range of `[0.5, 4]`, chosen before anything measured what a
tree actually asks for. With auto in place the question is answerable, so the cap was lifted to 100
and the requirements read off directly (1280×720 canvas, vertical unless stated):

| graph | level | sibling |
|---|---|---|
| 60 nodes, r10 | 1× | 1.4× |
| 60 nodes, r30 | 1× | 3× |
| 120 nodes, r10 | 1× | **4.9×** |
| 200 nodes, r10 | 1× | **5.4×** |
| 200 nodes, r30 | 1.5× | **11.4×** |
| 400 nodes, r10 | 1× | **20.2×** |
| 100-node chain, r10 | **6.1×** | 1× |
| 200 nodes, r10, *radial* | **9.3×** | 1× |
| 200 nodes, r30, *radial* | **19.6×** | 1× |

So `4` was below what an ordinary graph needs — 120 nodes already exceeded it — and both axes reach
equally high, `levelSpacing` in the two cases where depth is the crowded axis (a deep chain, and a
radial tree where the ring gap is the only lever). A per-axis range would encode a difference that
is not there.

`TREE_SPACING_RANGE` is now `[0.5, 10]`. It stops short of the curve (400 nodes want 20×, growing
with the widest level) because past that the extra room buys nothing a reader can use: the view is
fitted, so a tree 20× wider than the canvas draws its nodes at a twentieth of their size. Beyond
this point a graph is explored by panning — which is what the minimap is for — not by spreading.

The one cost is slider feel: `1×` now sits 5% along the track rather than 14%. It matters less than
it sounds, because auto and the wider range work together — on an uncrowded graph the thumb sits at
the far left and the control is one nobody needs, and on a crowded graph, which is when somebody
reaches for it, auto has already placed the thumb mid-track.

## 6. Known gaps

- **The worker path does not tune.** `TreeLayout.registerForcesOnSimulation` is handed the options
  `changeLayout` was called with, and auto decides *inside* the main-thread layout. `Simulation`
  reads the answer back into its own options after every `update()`, so `graph.getOptions()` and any
  later worker pass are correct — but the very first worker pass of a freshly loaded tree runs at
  `1×`. `useWorker` + `tree` already had rougher edges than this.
- **Auto cannot see labels.** It reasons about circle radii only, so a tree of long-labelled nodes
  can still overlap horizontally. Node label extents are not measured anywhere the layout can reach.
- **A graph needing more than 10× stays crowded**, by D5 and §6.

## 7. What is asserted

`tests/visual/specs/layout.spec.ts`:

- **auto leaves an uncrowded tree at the fitted layout** — D3's floor, stated as `{1, 1}` on the
  sparse fixture. This is the test that fails if auto ever starts packing trees tighter.
- **auto opens up a tree whose nodes are too big for their level** — 60 nodes at r30: sibling > 1,
  level still exactly 1, so the two axes are shown to be measured independently.
- **auto opens up the levels of a deep chain** — the depth axis, on a 39-level chain, *grown after
  the layout exists* so it also pins auto's promise to re-derive as the graph changes.
- **a hand-set multiplier opts out of auto entirely** — D4, on a graph crowded enough that auto
  would certainly have moved it.
- **auto reaches past 4× on a wide tree** — 200 nodes at r10 asking for more than the multipliers
  used to be allowed to give, so the ceiling cannot quietly drop back.

`tests/visual/specs/physics-flyout.spec.ts`:

- **dragging a spacing slider leaves Auto; the Auto button takes it back** — the full handover, in
  both directions, including the sliders following auto back to what it chooses.
