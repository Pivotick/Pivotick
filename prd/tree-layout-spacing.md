# Manual spacing for tree layouts

**Status:** done, 2026-08-19
**Branch:** `worktree-auto-physics-preset`
**Follows:** `prd/auto-physics-preset.md`, `prd/physics-preset-reheat.md`

---

## 1. The ask

> "When using another layout (like tree), the simulation knobs are disabled. However, it would be
> nice to also have the ability to increase the distance between levels/nodes manually."

Correct on both counts. Under a tree layout `TreeLayout.adjustOtherSimulationForces` zeroes link,
charge and gravity, and the flyout greys the knobs out — so a cramped hierarchy had nothing left to
turn. The distances a tree shows are the *layout's*, not the forces'.

## 2. Where a tree's distances actually come from

`buildTreeStatic` sizes a d3 tree to the canvas: `tree().size([canvasW, canvasH])` (non-radial) or
`size([2π, radialGap])` (radial). d3 normalises a `size`d tree onto the whole box, so **the box is
the spacing** — and it is fixed by the canvas and the shape of the tree. Nothing in between was
adjustable.

## 3. Decisions

**D1 — Multipliers, not pixel gaps.** `levelSpacing` / `siblingSpacing` scale the fitted geometry;
`1` is the fitted layout. A pixel gap would have to be re-chosen after every window resize and
every graph that grew a level, because the thing it competes with (the fitted spacing) moves.
`1` being the default also makes the feature a provable no-op for existing consumers — the four
pre-existing tree baselines and position assertions in `layout.spec.ts` pass untouched.

**D2 — Grow about the middle.** A `size`d tree grows from its top-left corner, so scaling the box
alone would push the tree off the bottom-right rather than expand it in place. `sizedTreeLayout`
returns an offset that re-centres the result on the box it would have filled at `1×` (zero at `1×`).

**D3 — Reframe on release, not on input.** The tree can easily outgrow the viewport, and unlike a
force layout nothing pulls it back toward the centre. `fitAndCenterWhenSettled()` runs on the
slider's `change` event: nodes move live during the drag, the view reframes once the gesture ends.

**D4 — Hide the inert knobs instead of greying them.** Keeping a dead copy of six sliders *under*
the new spacing card pushed the panel past a laptop viewport (measured: it started scrolling). They
are now hidden while a tree is active — the card head, and with it the run/pause toggle, stays,
because pausing still stops a tree's relaxation. Panel height under a tree is now *lower* than
before the change.

**D5 — `siblingSpacing` is disabled under `radial`.** A radial level always spans the full circle,
so there is no breadth budget to widen. The slider says so and is disabled.

## 4. The bug this uncovered

`forceX` / `forceY` / `forceRadial` read their per-node target **once, in `initialize`**, and tick
against the cached array. So recomputing the positions map is not enough: every force keeps pulling
nodes back to where the previous spacing put them. The symptom was lopsided and initially
misleading — `levelSpacing` appeared to work (the pinned axis moves because `fx`/`fy` outrank
forces) while `siblingSpacing` moved nodes ~5% and snapped back.

Measured on the `tree` fixture at `siblingSpacing: 2.5`, before the fix: targets read straight from
the accessor were correct (`d: -427`, `g: 1707`), `setNodePositions` wrote exactly those values, and
2.5s later the nodes sat at `192` / `1088` — i.e. back at the `1×` layout. `setSpacing` now calls
`registerForces()` after `update()`, which hands d3 fresh force instances to initialise.

`Simulation.update()` never hit this: it calls `simulation.nodes(...)` right after `layout.update()`,
which re-initialises every force as a side effect.

## 5. Known characteristics, not fixed here

- **Radial spacing is a uniform zoom.** `radialGap` is the layout's only length, so scaling it scales
  everything — after the auto-reframe the arrangement looks identical and only the node-size-to-gap
  ratio changes. That ratio *is* what fixes an overcrowded ring, so the slider earns its place, but
  it reads as "the nodes got smaller" rather than "the rings moved apart".
- **The horizontal tree's axes are sized from the opposite canvas dimension** (depth from
  `canvasBCR.height`, breadth from `width`, then swapped on assignment). Pre-existing; the
  multipliers scale the right conceptual axes regardless, so this was left alone.
- **`flipEdgeDirection` flips on every `update()`**, so any re-layout (a data change today, a spacing
  drag now) toggles it back and forth — and the constructor already flips twice, making the option a
  net no-op on load. Left alone: the docs say it must not touch graph data, but the implementation
  mutates the edges via `setFrom`/`setTo`, so fixing it means deciding what it should mean. Nothing
  in the UI or the suite sets it.
- **The radial force's ring gap (`levels × 100`) still disagrees with `radialGap / maxDepth`.** It is
  inert on the main thread (radial pins both axes), and it now scales with `levelSpacing` so the
  worker path follows the slider, but the two numbers remain unrelated.

## 6. What is asserted

`tests/visual/specs/layout.spec.ts` — geometry, via `applyLayout` (a pure function of graph +
options, no tick-count dependence):

- **level spacing scales the distance between levels, and only that** — depth extent ×2 (±5%),
  breadth extent unchanged, and the midpoint unmoved (D2).
- **sibling spacing scales the distance within a level, and only that** — the mirror image.
- **radial level spacing scales the ring radii** — root still centred, every ring doubled.

`tests/visual/specs/physics-flyout.spec.ts` — the control surface:

- **a tree layout swaps the physics knobs for spacing controls** — hidden under force, visible under
  a tree, hidden again on the way back, plus a panel screenshot.
- **the level distance slider re-lays-out the tree further apart** — the API value, the `2×` label,
  and the graph really coming out >1.9× taller. This is the test that fails if the force caches go
  stale again.
- **spacing survives a switch to another tree orientation** — `changeLayout` builds a fresh
  `TreeLayout`, so the flyout has to hand the spacing over with the orientation.
- **the radial layout offers only level distance** (D5), and **a tree layout puts the physics
  controls away** (D4, replacing the old "greys out" test).
