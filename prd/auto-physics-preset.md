# Feature — an "Auto" physics preset that tunes the layout on the fly

**Status:** Done — 2026-08-19, branch `worktree-auto-physics-preset`, unmerged. All of §9.1 is in
and green. §13 records what the measurements settled, including two corrections to the design
after Sami reviewed it on real data. `hybrid` won the bake-off; `fill`, `feedback`, the strategy
indirection and the whole dev rig are deleted, and the tuner is a single `tunePhysics()`.
**Owner:** Sami Mokaddem
**Requested:** 2026-08-18
**Area:** `src/AutoPhysics.ts` (new), `src/Simulation.ts` (knob vocabulary, triggers, tuner state, dead-code removal), `src/interfaces/SimulationOptions.ts` (`physics` option, gravity/settle plumbing), `src/ui/elements/PhysicsFlyout/` (preset row + two new sliders), `tests/visual/harness/` (fixtures + `physics: 'manual'` baseline), `docs/.vitepress/components/Pivotick.vue` (gallery pin), `docs/simulation.md` + `docs/configuration.md`.
**Type:** Layout capability + physics API surface. Changes default behaviour (see §10).
**Related:** [`graph-app-b3-control-layout.md`](graph-app-b3-control-layout.md) (§5.3 introduced the four-knob setter API and the preset row this extends), `physics-rail-mode` (the flyout this lands in, merged 2026-08-18).

---

## 1. What we're building

A fourth, *stateful* physics preset — **Auto** — that continuously derives the physics knobs
from what is actually on screen, instead of applying a fixed bundle of numbers.

The complaint it answers, in Sami's words: *"when there are few nodes the graph is too
concentrated while it could take more space. Same when you have large nodes."*

Auto becomes the **default** for graphs that do not configure their physics (D12), so the
library looks right out of the box rather than after a trip to the flyout.

Because "best readable layout" is a judgement, this PRD does **not** commit to one formula.
It commits to a *shape*: a pure tuner module with three candidate strategies, a dev hook to
switch between them at runtime, fixtures covering the cases that must survive, and a metrics
overlay so the live comparison is made against numbers rather than impressions (D1, D2).
The winner is chosen on the dev server; the losers are deleted before merge.

## 2. The problem, grounded

Three findings from the current code explain why small and large-node graphs look cramped.

**2.1 The shipped default link distance is the minimum of its own range.**
`DEFAULT_SIMULATION_OPTIONS.d3LinkDistance` is `40`, and `PHYSICS_KNOB_RANGES.linkDistance`
is `[40, 260]`. Reading the knobs back out of the defaults (`Simulation.knobsFromOptions`)
gives a fresh graph:

| knob | derived default | `tight` | `loose` / `default` |
|---|---|---|---|
| repulsion | 38 | 32 | 70 |
| linkDistance | **40 (range floor)** | 70 | 150 |
| collisionRadius | 23 | 16 | 26 |
| friction | 45 | 58 | 28 |

So the out-of-the-box layout is *tighter than the `tight` preset* on the knob that matters
most for spread. It also means the flyout's **"Default"** button is mislabelled: it applies
the `loose` bundle, not the library's actual defaults (`PHYSICS_PRESETS.default` is an alias
of `loose`). See D8.

**2.2 Link distance is absolute pixels; node size is not in the loop.**
`repulsion` and `collisionRadius` already scale with node size internally — the collide knob
is a *multiplier* on `getCircleRadius()`, and charge is multiplied by a sqrt-damped radius².
`linkDistance` alone is raw px. For two nodes of radius 60, the range *maximum* of 260px
leaves a 140px gap between 120px-wide discs — the graph reads as touching, and no knob
setting can fix it. This is the "large nodes" half of the complaint, and it is why the
ceiling has to move (D5).

**2.3 There is an abandoned attempt at exactly this feature in the tree.**
`Simulation.scaleSimulationOptions()` (a `nodeCount / canvasArea` density heuristic scaling
charge and collide strength) exists but is commented out at all three call sites, including
both worker paths. It is superseded here and gets deleted (D13).

**2.4 The camera is already trying to solve half of this — and hits its cap.**
`Graph.startAndRender()` calls `renderer.fitAndCenterWhenSettled()`, which scales
`min(W/w, H/h) * 0.8` **capped at 3×**. For a 4-node graph clumped into a 200px box on a
1200px canvas the ideal fit is 4.8× — clamped to 3×, so the content still covers only half
the screen *and* the nodes are blown up. Auto and the camera are therefore solving the same
problem from opposite ends, which is why the reference frame (D4) and the spread ceiling
(§7.1) have to be reasoned about **net of the camera**, not in isolation.

## 3. Decisions taken (decision log)

| # | Decision | Rationale |
|---|---|---|
| **D1** | **One `Auto` button**, one internal `AutoTuner` with swappable strategies, selectable via a dev hook (`simulation.setAutoStrategy(name)` and `?autoStrategy=` in `src/main.ts`). Winner kept, hook and losers deleted before merge. | The objective is not knowable a priori; it is decidable by eye in ten minutes on real data. Shipping every flavour as a preset would make each one a supported API surface forever. |
| **D2** | **The objective is deliberately open.** Three candidates get built and compared: `hybrid`, `fill`, `feedback` (§7). | Sami: *"I'm not sure. I think we'll explore multiple options and decide what works best live."* |
| **D3** | **Auto expresses itself only through visible knobs.** It calls the same setters a preset does, and the sliders move to what it chose. If auto needs a d3 option no knob covers, **a new knob is created** rather than a hidden adjustment. | No hidden levers: anything auto can turn, the user can turn. Keeps "auto, then nudge" working and makes auto's decisions inspectable rather than magic. |
| **D4** | **Reference frame is the canvas at zoom 1.** Auto is a pure function of (canvas px, visible node count, node radii); the zoom transform is never read. | Reading the *zoomed* viewport creates a feedback loop with `fitAndCenter`: zoom out → more apparent space → spread → re-fit → spread. Ignoring the transform makes auto deterministic and testable. |
| **D5** | **`linkDistance` ceiling 260 → 600.** The knob→d3 mapping is identity px, so `tight` (70) and `loose` (150) keep their exact current values. | Required by §2.2: large nodes need more than 260px before an edge is visible between them. |
| **D6** | **New `centering` knob** driving the gravity strengths (`d3GravityStrength` / `d3GravityStrengthConnected`). | `ForceGravity` gives connected nodes strength `0.001` — effectively nothing. A single component is bounded by its link springs, but *separate components* only repel. Raising repulsion for small graphs would blow them to the corners; auto needs a confinement dial, and per D3 it must be visible. |
| **D7** | **New `settleTime` knob**, in seconds, driving `d3AlphaDecay` **and** `cooldownTime` together. | They currently expire together by coincidence (`alphaDecay: 0.05` → alpha hits `alphaMin` in ~135 ticks ≈ 2.25s; `cooldownTime: 2000`). Moving one alone does nothing: raise `cooldownTime` and the sim is already cold; raise the decay and the wall-clock wall truncates it. |
| **D8** | **Preset row becomes `[Auto] [Tight] [Loose]`** — "Default" is dropped. | Auto *is* the default now, so the button is redundant, and today it lies (applies `loose`, not the defaults in §2.1). Three honest choices: let it decide, or pick a character. |
| **D9** | **Re-tune triggers:** visible-graph changes (via `Simulation.update()`), the initial layout (before the worker call), and node-size refresh (`refreshForcesAndReheat`). **Container resize is out of scope** (follow-up). | `Graph.onChange()` is the universal funnel — add/remove, filter, cluster expand/collapse and notes all pass through it, so one hook covers the "on the fly" promise. Resize is excluded because the canvas resizes when the sidebar opens: re-laying out the whole graph because a panel opened is worse than a slightly-off fill ratio. |
| **D10** | **Calm policy:** coalesce triggers within a frame/~150ms, skip the apply if every knob is within a deadband (~4% of its range), otherwise reheat gently at `alpha 0.3`. | Every setter re-inits a force and reheats. During pivoting that is a reheat per node without a deadband. Gentle alpha relaxes from current positions instead of restarting the layout. |
| **D11** | **Any manual slider drag (or Tight/Loose) exits Auto** — highlight clears, re-tuning stops. | Mirrors the flyout's existing "manual edit → no active preset" rule, and guarantees auto can never overwrite a deliberate choice a moment later. |
| **D12** | **On by default — but explicit config wins.** If the consumer sets *any* option auto drives, auto starts off for that graph. `simulation.physics: 'auto' \| 'manual'` forces either way. | Auto-always-wins would silently ignore the config of every existing consumer. "Auto is the default only for graphs that never spoke" is backwards-compatible and needs no migration. |
| **D13** | **`src/AutoPhysics.ts`**, strategies as pure `(AutoContext) => PhysicsKnobs` functions; `Simulation` owns only state and triggers. **Deletes** `scaleSimulationOptions` / `applyScalledSimulationOptions` and their three commented-out call sites. | Pure functions are inspectable, reusable from the worker path, and free of d3/DOM. Leaving §2.3's abandoned attempt in place would put two dead approaches to one problem side by side in a 944-line file. |
| **D14** | **Pin `physics: 'manual'` centrally** in the test harness `BASE_OPTIONS` and in the gallery's shared mount, so **0/90 baselines and 0/40 thumbnails** are regenerated. The new auto spec and one new gallery card opt in explicitly. | Sami: *"I'm scared the simulation might change for every run."* D12 makes pinning a one-liner by design. See §9.2 — the exposure turned out to be far smaller than feared anyway. |

## 4. Current-state grounding

### 4.1 Reuse as-is

- **The knob setter API** (`setRepulsion` / `setLinkDistance` / `setCollisionRadius` /
  `setFriction`, `applyPhysicsPreset`, `getPhysicsKnobs`) — auto drives exactly these.
- **`Graph.onChange()` → `Simulation.update()`** — the single funnel for every visible-graph
  change (D9). No new event plumbing needed.
- **`Simulation.reheatIfEnabled()`** — already skips the reheat when physics is disabled,
  which gives us "auto never wakes a paused sim" for free (§8.4).
- **`PhysicsFlyout.refreshSliders(knobs)`** — already re-seeds every slider from a knob
  bundle; auto reuses it to make the sliders follow (D3).
- **`tests/visual/harness/`** — fixtures + `mergeOptions` + `waitForViewSettled`.

### 4.2 Extend

- **`PhysicsKnobs`** — four fields → six (`centering`, `settleTime`).
- **`PHYSICS_KNOB_RANGES`** — `linkDistance` ceiling to 600; two new ranges.
- **`PHYSICS_PRESETS`** — `tight` / `loose` gain values for the two new knobs; `default` — see §12 Q3.
- **`SimulationOptions`** — new `physics?: 'auto' | 'manual'`.
- **`PhysicsFlyout`** — preset row (D8), two extra sliders, and it must now *listen* for
  auto-applied knob changes rather than only pushing values down.

### 4.3 Build new

- `src/AutoPhysics.ts` — `AutoContext`, `AutoStrategy`, the three candidates, the metrics
  helpers.
- Tuner state in `Simulation` — active strategy, debounce timer, last-applied knobs, the
  explicit-config detection (§5.4).
- `tests/visual/specs/auto-physics.spec.ts` + its fixtures.
- A throwaway dev metrics overlay (§8.2).

## 5. Target architecture

### 5.1 The tuner module

```ts
// src/AutoPhysics.ts
export interface AutoContext {
    canvas: { width: number; height: number }   // fresh measurement, CSS px, zoom-1 frame (D4)
    nodeCount: number                            // nodes the sim actually holds
    radii: { mean: number; max: number; totalArea: number }
    edgeCount: number
    componentCount: number                       // union-find over active edges, O(N+E)
    measured?: MeasuredLayout                    // present only for `feedback`
    current: PhysicsKnobs                        // for relative/incremental strategies
}

export interface MeasuredLayout {
    bbox: { width: number; height: number }      // node positions inflated by radii
    fill: number                                 // sqrt(bboxArea / canvasArea)
    overlaps: number                             // pairs with dist < r_i + r_j
    nearestNeighbourGap: number                  // mean, in units of mean radius
}

export type AutoStrategy = (ctx: AutoContext) => PhysicsKnobs

export const AUTO_STRATEGIES: Record<AutoStrategyName, AutoStrategy>
export function measureLayout(nodes, canvas): MeasuredLayout
```

Pure, no d3, no DOM — `Simulation` supplies the context and applies the result.

### 5.2 Integration points in `Simulation`

| Moment | What happens |
|---|---|
| constructor | Decide auto on/off (§5.4). Store the strategy name. |
| `start()` / `runSimulationWorkerRouter()` | Tune **before** the worker call so the opening layout is already right — the worker receives the tuned `options`, not the defaults. |
| `update()` | Debounced re-tune (D9/D10). |
| `refreshForcesAndReheat()` | Re-tune — radii may have only just been measured by a custom node. |
| `applyPhysicsPreset()` / any `set*` knob setter from the UI | Exit auto (D11). |

### 5.3 Applying a tune

```
tune():
  if (!autoEnabled || layoutType !== 'force' || tuning) return
  next = strategy(buildContext())
  if (every knob within deadband of current) return          // D10 — no reheat at all
  apply each changed knob via the existing setter, suppressing their individual reheats
  reheatIfEnabled(0.3)                                        // one reheat, gentle
  physicsFlyout?.refreshSliders(next)                         // D3 — sliders follow
```

The per-setter reheat suppression matters: applying six knobs through six setters would
otherwise re-init six forces and reheat six times for one logical change.

### 5.4 Explicit-config detection (D12)

`Simulation` currently does `merge({}, DEFAULT_SIMULATION_OPTIONS, options)` and discards the
raw partial, so "did the consumer set this?" is unanswerable afterwards. The constructor must
inspect the **raw partial** before the merge:

```ts
const AUTO_OWNED = ['d3LinkDistance', 'd3ManyBodyStrength', 'd3CollideRadiusMultiplier',
                    'd3VelocityDecay', 'd3GravityStrength', 'd3GravityStrengthConnected',
                    'd3AlphaDecay', 'cooldownTime'] as const

autoEnabled = options.physics === 'auto' ? true
            : options.physics === 'manual' ? false
            : !AUTO_OWNED.some(key => key in options)
```

`physics: 'auto'` with explicit d3 options is legal — the explicit values seed the opening
frame and auto takes over from there.

### 5.5 Worker path

The worker computes the *opening layout* only; the main thread then runs its own live sim at
`alpha 0.01` for interaction. So:

- **Feed-forward strategies** (`fill`, `hybrid`) tune before serialising options → the worker's
  opening layout is already correct. Nothing worker-side changes.
- **`feedback`** cannot iterate inside the worker. It measures the returned layout and applies
  **one** correction as a main-thread relaxation — not a second worker run.

## 6. The six knobs

| knob | range | maps to | notes |
|---|---|---|---|
| `repulsion` | 0–100 | `d3ManyBodyStrength` → `[0, -400]` | unchanged |
| `linkDistance` | 40–**600** | `d3LinkDistance` (identity px) | **D5**: ceiling raised from 260 |
| `collisionRadius` | 4–60 | `d3CollideRadiusMultiplier` → `[0.6, 2.4]` | unchanged |
| `friction` | 0–100 | `d3VelocityDecay` → `[0, 1]` | unchanged |
| **`centering`** | 0–100 | `d3GravityStrengthConnected` → `[0, 0.05]`; isolated-node strength stays a fixed multiple (~10×) | **D6** |
| **`settleTime`** | 0.5–8 (s) | `d3AlphaDecay = 1 - alphaMin^(1/(t·60))` **and** `cooldownTime = t·1000` | **D7**. `t = 2.25s` reproduces today's `0.05` exactly |

`tight` and `loose` keep their existing four values and gain sensible constants for the two
new knobs (starting point: `centering` at today's effective ~2, `settleTime` 2.25s — i.e. no
behaviour change for anyone who clicks them).

## 7. The three candidate strategies

Constants below are **starting points**, tuned live (§12).

### 7.1 The spread ceiling — why "fill the canvas" is not the target

The naive target is bbox = 80% of the canvas. But `fitAndCenter` runs afterwards and will
scale up to **3×** (§2.4). Final on-screen coverage is therefore
`bbox × min(3, 0.8·canvas/bbox)`. To end at ~80% coverage, a small graph only needs
`bbox ≥ 0.27 × canvas` **at zoom 1** — and stopping there is *better*, because the camera then
zooms 3× and the nodes are legible rather than being four dots joined by hairlines across a
1200px canvas.

So the fill target is not a constant: it is high when the camera cannot help (large N, where
the fit is already ≥1) and low when the camera will do the last 3× (small N). This is encoded
as the `L_ceil` clamp, and is the single most important thing to get right by eye.

### 7.2 `hybrid` — area budget with radius clamps *(expected winner)*

```
A_t   = fillTarget(N) · W · H          // fillTarget ~0.30 small N → ~0.64 large N (§7.1)
s     = sqrt(A_t / N)                  // characteristic spacing
L     = clamp(0.8·s,  2·r̄ + GAP_MIN,  min(600, C_MAX · r̄))
                                       // floor: big nodes can't touch  (GAP_MIN ~24px)
                                       // ceiling: tiny graphs can't become specks (C_MAX ~14)
charge   ∝ s², normalised out of the sqrt-damped radius² the charge force already applies
collide  → multiplier giving a clear gap of ~0.5·r̄, raised while totalArea/A_t is high
centering ∝ |charge| / (0.5·boxSide)³  // confines components at the target box (D6)
settleTime = clamp(1.2 + 0.8·log10(N), 1.0, 4.0)
```

Addresses both complaints in one formula; the clamps are the part carrying the weight.

### 7.3 `fill` — pure area budget *(the control)*

Identical, minus the radius clamps: `L = 0.8·s`, charge from `s`, nothing else. Expected to
fail visibly on 40 large nodes (per-node budget ~124px against a 120px diameter → touching).
Its job is to prove the clamps in `hybrid` are earning their keep rather than being
superstition.

### 7.4 `feedback` — measure the real box

A proportional controller over `measureLayout()`:

```
err = fillTarget / measured.fill
if |err − 1| > 0.08:
    L        *= clamp(err, 0.90, 1.10)
    charge   *= clamp(err², 0.85, 1.15)
if measured.overlaps > 0: raise collide multiplier one step
```

The only candidate that is topology-honest — a 10-node chain and a 10-node hub have very
different bounding boxes for identical knobs, which no closed-form N-based formula can know.

**Its cost is determinism.** `cooldownTime` is a wall-clock budget, so a slower machine runs
fewer ticks and measures a different box; feeding that back makes the knobs machine-dependent.
(This timing coupling already exists — it is the likeliest cause of the ~16 snapshots that
drift on Sami's machine.) Mitigation if it wins: the opening layout stays feed-forward, and
feedback only ever *corrects* afterwards, bounded to the ±10% step above.

## 8. Behaviour spec

### 8.1 Fixtures (the bake-off set)

| id | fixture | must hold |
|---|---|---|
| **A** | 4 nodes, r=12, 1200×800 | fills space without becoming specks; no hairline-across-the-canvas edges |
| **B** | 5 nodes, r=60 (image-style) | no touching; edges visibly separate the discs |
| **C** | 40 nodes, r=60 | 0 overlaps — the case a naive area budget provably fails |
| **D** | 5 nodes / 2 components + 2 isolated | everything stays in frame (the `centering` knob's reason to exist) |
| **E** | pivoting growth 5 → 60 → 300 | calm: adding one node to 60 causes no reheat; each size is sensible |
| **F** | 2000 nodes | auto *tightens*; the slow-tick watchdog (>33ms/tick) must not fire |

### 8.2 The metrics overlay (dev-only, deleted before merge)

A corner readout, refreshed on each tune:

```
┌─ auto: hybrid ────────────────┐
│ N 5   r̄ 60   canvas 1200x800  │
│ rep 74  link 288  coll 34     │
│ cent 12  settle 2.6s          │
│ fill 71%   overlaps 0         │
│ nn-gap 1.8r                   │
└───────────────────────────────┘
```

Overlap counting uses a spatial hash, not the O(N²) pair loop, so fixture F stays usable.

### 8.3 Flyout behaviour

- `[Auto]` active by default; clicking it re-enables auto and tunes immediately.
- While auto is on, sliders remain **enabled** and move as auto re-tunes.
- Dragging any slider, or clicking Tight/Loose, clears the Auto highlight and stops
  re-tuning (D11).
- Under tree / egoTree layouts the whole card greys out, as today — **auto is inert there**
  (§9.3).

### 8.4 Interaction with pause and the watchdog

Auto **never re-enables a disabled simulation**. If the user paused physics, or the slow-tick
watchdog disabled it behind their back, auto still computes and stores knobs but does not
reheat — `reheatIfEnabled` already implements exactly this.

## 9. Scope

### 9.1 Delivered

The six-knob vocabulary (D5–D7), `AutoPhysics.ts` with three candidates and the dev switch,
the tuner state and triggers in `Simulation`, the flyout changes (D8), fixtures A–F, the
`auto-physics.spec.ts` regression spec, one new gallery card, `docs/simulation.md` +
`docs/configuration.md`, and the deletion of §2.3's dead code.

### 9.2 The pinning work is smaller than feared (D14)

Two facts found while writing this:

- **Tests:** `BASE_OPTIONS` in `tests/visual/harness/harness.ts` already sets
  `simulation: { enabled: false, useWorker: false }` — physics never runs for the vast
  majority of fixtures. **Only 5 of 46 specs enable it** (the cluster / custom-node-collision
  ones). Adding `physics: 'manual'` to `BASE_OPTIONS` is one line and covers all of them.
- **Gallery:** all 40 cards mount through `docs/.vitepress/components/Pivotick.vue`, which
  *already* merges a `simulation` block (that is how `useWorker` is defaulted per-card).
  Pinning is **one line there**, with the same `??` escape hatch, so the new auto card opts
  in through its own `options.js`.

Net: **2 one-line changes, 0 baselines and 0 thumbnails regenerated.**

### 9.3 Out of scope

- **Container resize re-tuning** (D9) — deliberate; revisit if the fill ratio proves annoying
  after a sidebar toggle.
- **Tree / egoTree layouts** — auto is force-only; tree spacing is its own problem.
- **Per-knob pinning** ("auto everything except my friction") — considered and rejected as
  premature; D11's all-or-nothing is the simpler contract.
- **Camera policy** — `fitAndCenter`'s 3× cap and 0.8 padding are *reasoned about* (§7.1) but
  not changed here.
- **Flipping the gallery/tests onto auto** — they stay pinned (D14).

## 10. Backward compatibility

- **Default behaviour changes** for graphs that configure no physics: they get auto. Graphs
  that set any auto-owned option are untouched (D12), which covers every consumer who has
  tuned their layout.
- **`PhysicsKnobs` gains two fields** — a widening of a public interface; code *reading* it is
  fine, code constructing one breaks. See §12 Q3.
- **The `default` preset button disappears** (D8). The `PHYSICS_PRESETS.default` entry is
  public API — §12 Q3.
- **`linkDistance` range widens** (D5). `tight` / `loose` produce identical px values; only a
  UI that renders the slider's `max` sees a difference.
- Removed private API: `scaleSimulationOptions`, `applyScalledSimulationOptions` (both marked
  `@private`, both dead).

## 11. Acceptance criteria

1. A default `new Pivotick(el, data)` with 4 small nodes on a 1200×800 canvas settles into a
   layout that, after the camera fit, covers ~80% of the viewport with legible nodes — judged
   against fixture A with the overlay's numbers.
2. Fixtures B and C settle with **0 overlaps**.
3. Fixture D keeps every component inside the canvas box at zoom 1.
4. Fixture E: adding one node to a 60-node graph produces **no reheat** (deadband holds);
   expanding 5 → 60 produces exactly one gentle reheat.
5. Fixture F: auto tightens versus its 60-node values, and the slow-tick watchdog does not
   fire.
6. Dragging a slider while Auto is active stops all further re-tuning.
7. `simulation: { d3LinkDistance: 200 }` yields a graph auto never touches;
   `simulation: { physics: 'auto', d3LinkDistance: 200 }` yields one it does.
8. `tsc`, `eslint`, `npm run build` clean; **all 90 existing snapshots unchanged**; the new
   spec green.

## 12. Open questions (settled live)

- **Q1 — the fill-target curve (§7.1).** How aggressively should the target fall for small N,
  given the camera's 3× cap? *This is the decision that determines whether the feature feels
  right.* Decided by eye on fixture A.
- **Q2 — which strategy wins**, and whether `feedback` is worth its determinism cost (§7.4).
- **Q3 — the fate of `PHYSICS_PRESETS.default`.** Three options: (a) delete it and its type
  member (breaking, honest — auto replaces the concept); (b) keep the entry but redefine it as
  the library's *real* defaults from §2.1 (honest name, cramped result); (c) leave it as a
  `loose` alias with no button. **Recommendation: (a)**, noted in the CHANGELOG — the library
  is young and B3 already made larger breaking UI-API changes.
- **Q4 — deadband width and debounce window** (D10): 4% / 150ms are guesses; fixture E decides.
- **Q5 — `GAP_MIN` / `C_MAX`** (§7.2), and whether the collide clamp needs label width as an
  input as well as radius.

---

## 13. Build notes — what the numbers settled

Built 2026-08-19. The open questions were decided against measurements taken through
`window.__pivotick.autoState()` (fill, overlaps, nearest-neighbour gap, camera zoom) rather
than by eye, using a throwaway bake-off spec that ran all three strategies over the fixture
set. Canvas in the harness is 1280×720.

### 13.1 What changed against the spec

**`centering` needed an order of magnitude more authority than §6 assumed.** A sweep of the
raw gravity strength against settled layouts put the useful band at **0.005–0.2** — below
0.005 nothing moves, above 0.2 the graph collapses. The knob's linear `[0, 0.05]` map would
have spent almost all its travel on values that do nothing, so the map is **quadratic onto
`[0, 0.2]`**; knob 7 reproduces the historical `0.001` / `0.1` pair exactly, and the values
auto picks land mid-slider. `tight` / `loose` therefore carry `centering: 7`, not the 14 the
spec guessed. Isolated-node strength is `4×` the connected one clamped to `[0.1, 0.3]`, so a
lone node still gets at least today's `0.1` at any setting.

Without this the feature does not work at all: before it, fixture D settled at a **3457×7356**
bounding box on a 1280×720 canvas. After: **588×583**.

**Centring must balance the charge that actually runs, not the one the budget asked for.**
`repulsion` is clamped to a floor of 10, and on a 500-node graph the applied charge is ~6×
what the area budget requested. Balancing the requested value left large graphs at triple
their target size (fixture F fill 198% → **105%** once corrected).

**`fillTarget` is an area fraction; `MeasuredLayout.fill` is a linear one.** They differ by a
square root — a factor of two in the middle of the range. `linearFillTarget()` now exists for
the comparison, and `feedback` uses it.

**Two bugs found and fixed on the way.** `ForceGravity` guarded its accumulation on
`node.vx && node.x` — truthiness, so a node resting exactly on the centring axis silently got
no pull. And `measureLayout`'s spatial hash searched one ring, which is correct for overlaps
(bounded by the contact distance) but wrong for nearest-neighbour gaps (unbounded); it now
expands ring by ring.

### 13.2 The bake-off (Q2)

`hybrid` wins. The clamps are load-bearing exactly where §7.3 predicted — `fill` roughly
halves the nearest-neighbour gap on every fixture where node size binds:

| fixture | `hybrid` gap | `fill` gap | `feedback` gap |
|---|---|---|---|
| B 5×r60 | 0.68r | **0.29r** | 0.75r |
| C 40×r60 | 1.02r | **0.29r** | 1.08r |
| E 60×r18 | 0.89r | 0.74r | 0.86r |
| F 500×r10 | 1.02r | **0.55r** | 1.02r |

`feedback` tracks `hybrid` within noise everywhere except fixture D (fill 48% vs 61%, against
a 58% target), which does not buy back its machine-dependence (§7.4). **Recommendation: keep
`hybrid`, delete `fill` and `feedback`** — but this is the call D1 reserves for a human, so
all three and the `?autoStrategy=` switch are still in the tree.

### 13.3 Where the acceptance criteria landed

Nine of eleven hold as written. Two do not, for reasons that are geometry and pre-existing
library limits rather than tuner quality:

- **AC 1 (~80% viewport coverage) is unreachable by construction.** `fitAndCenter` pads to
  0.8 and fits the *tighter* axis, so a squarish layout on a 16:9 canvas tops out near 0.6.
  Fixture A measures **0.67 coverage against 0.36 with the knobs pinned** — the layout itself
  is 2.2× wider — which is the claim the criterion was reaching for. The spec asserts the
  comparison, since `cooldownTime` is a wall-clock budget and absolute coverage moves with
  machine load (0.47–0.67 across repeats).
- **AC 5 (the watchdog must not fire at 2000 nodes) does not hold, and is not auto's.**
  Measured with `physics: 'manual'` for comparison: physics is off by 1000 nodes *either
  way*. It is the cost of rendering that many SVG nodes on the main thread. What auto does
  own is covered instead: it tightens (fill **180% vs 1289%** pinned at 2000 nodes) and never
  restarts a paused simulation.

**AC 8, restated honestly:** `tsc` / `eslint` / `npm run build` / `vitepress build` are clean
and 314 of 317 baselines are untouched. The three that moved are all
`physics-flyout.spec.ts`: two snapshots that *had* to change because the flyout gained two
sliders and lost the Default button (D8), and one assertion carrying the old `centering`
constant. The `physics: 'manual'` pinning did its job — no graph drifted.

### 13.4 Settled constants (Q1, Q4, Q5)

- Fill target: linear-area fraction `0.30` at N≤4 rising to `0.64` at N≥400, log-interpolated.
- `GAP_MIN` 24px; link ceiling `10·r̄ + 140`, capped at the 600px knob maximum.
- Collide multiplier `1.15 → 1.50` with occupancy; `CENTERING_GAIN` 240 (back-solved from the
  gravity sweep); centring strength clamped to `[0.002, 0.12]`.
- Deadband 4% of range and debounce 150ms both held on fixture E unchanged: 5 → 60 costs
  exactly one reheat, 60 → 61 costs none.

### 13.5 Bake-off closed

`hybrid` kept, on Sami's call. Deleted: the `fill` and `feedback` strategies, `AUTO_STRATEGIES` /
`AUTO_STRATEGY_NAMES` / `DEFAULT_AUTO_STRATEGY` / `isAutoStrategyName`, the `AutoStrategy` and
`AutoStrategyName` types, `Simulation.setAutoStrategy` / `getAutoStrategy`, `AutoContext.measured`,
`linearFillTarget`, and `src/AutoPhysicsOverlay.dev.ts` with its `src/main.ts` call sites. What
was `hybrid` is now the module's single `tunePhysics(ctx)`.

`measureLayout` / `MeasuredLayout` stay — they are the measurement API the visual tests assert
against, and `densityVariation` (§13.7) is the metric that guards the structure regression.

CHANGELOG entry written: `Auto` as the default, `simulation.physics`, the two new knobs, and the
breaking bits (`PHYSICS_PRESETS.default` removed, `PhysicsKnobs` widened, `linkDistance` range
`[40, 600]`, the two dead `@private` methods gone) plus the `ForceGravity` fix.

### 13.6 Correction — gravity was flattening cluster structure (2026-08-19, later)

Sami tried the `ail` topology (301 nodes, 300 edges, radius 5, two components) and reported
that all three strategies concentrated the graph in the middle and showed clusters less
clearly than the old defaults. Measured, he was right, and by a wide margin:

| config | separation ↑ | density CV ↑ | fill | zoom |
|---|---|---|---|---|
| pinned (`d3LinkDistance: 90`) | 4.6 | 0.84 | 1.57 | 0.38 |
| auto, before this fix | 3.1 | **0.24** | 0.84 | 0.75 |
| auto, after | 4.3 | **0.65** | 1.26 | 0.52 |

*separation* = mean random-pair distance ÷ mean edge length (high = connected things near,
unrelated things far). *density CV* = spread of nearest-neighbour distances (high = clumps and
gaps; low = an even blob). A CV of 0.24 is the signature of exactly what he saw.

**Cause.** §7.1's objective is a bounding-box target, which is blind to internal structure —
a graph can hit it perfectly while being a uniform disc. Gravity is the bluntest way to hit
it, and the space it eats first is the space *between* clusters, because that is where the
emptiness is. Two compounding errors:

1. `centering` was sized to pull the layout onto the fill target. On `ail` it reached knob 48,
   and sweeping it shows a strictly monotonic trade: knob 0 → sep 3.74 / CV 0.62; knob 48 →
   sep 2.30 / CV 0.41. Gravity never buys structure, it only ever sells it.
2. `repulsion` sat on its floor of 10 (against the historical default's 38), because the area
   budget divides the canvas by `N`. Charge is what pushes *unrelated* subgraphs apart while
   links hold each cluster together — that difference *is* the visible structure.

**Fix.** Gravity became a fence rather than a target, aimed at 0.9 of the canvas half-extent
with a ceiling that is the larger of two independent licences to compress:

- **small-graph licence**, decaying with node count. Compression costs nothing on a four-node
  graph (no clusters to flatten) and buys the thing that matters there — a compact layout is
  one the camera can zoom *into*. Removing it entirely dropped fixture A's on-screen node
  radius from 25px to 11px.
- **looseness licence**, from the fraction of nodes in components smaller than 8. That is the
  only thing gravity is genuinely needed for (D6), and it is 0 for `ail`'s two 150-node
  components and ~1 for fixture D's scattering of pairs and singletons. The first version of
  this used `components / nodes`, which reads a 4-node connected graph as maximally loose
  purely because it is small — wrong, and it broke fixture A.

`FILL_MAX` also went from 0.64 to 1.0 (large graphs may use the whole canvas rather than
two-thirds of it), and the repulsion floor now eases from 38 down to 8 on very large graphs —
easing the floor rather than adding gravity, because repulsion scales a layout *uniformly*
(dropping it 38 → 6 on 300 nodes took the box from 4.3 to 1.9 canvases with the
nearest-neighbour gap staying proportional, 3.95r → 1.94r) whereas gravity does not.

**Consequences for the fixtures.** F's margin loosened from `fill < pinned/3` to
`< pinned × 0.8` (measured 7.5 vs 12.9 canvases). That fixture is a random recursive tree,
which measures 1.9 canvases wide at 300 nodes even with repulsion at its *minimum* — most of
its size is topology, so it cannot be tuned into one screen and should not be. Fixture A is
now stated as measured (nodes 13–20px, coverage 1.4–2.0× pinned) rather than as an aspiration.

**Still open — a product call, not a tuning one.** At the large end there is a genuine
either/or: compress and get legible node sizes but a blob, or spread and get visible clusters
but small nodes. The fix picks *clusters*, on the grounds that structure is the information
and zoom is one gesture away. Worth confirming that is the preference, because it is the axis
everything else at scale hangs off.

**Test-coverage gap.** Nothing in the suite would have caught this: `measureLayout` reports
bbox, overlaps and nearest-neighbour gap — all blind to whether clusters are distinct. The
separation and density-CV metrics above still live in a throwaway probe. They should move into
`measureLayout`, with a community-structured fixture, before this can be called guarded; the
existing fixture builder makes a single random recursive tree, which has no communities to lose.

### 13.7 Correction — the length scale is node radius, not the area budget (2026-08-19, later still)

Sami confirmed clusters were the right call at scale, then sent three screenshots: `hybrid`
and `fill` at radius 60, and a hand-tuned config of the same graph that reads beautifully.
The comparison rewrites §7.2's premise.

| knob | `hybrid` | `fill` | hand-tuned | auto now |
|---|---|---|---|---|
| repulsion | 38 | 38 | **100** | 95 |
| linkDistance | 144 | 115 | **387** | **390** |
| collisionRadius | 32 | 22 | 24 | 23 |
| centering | 23 | 23 | **7** | 10 |

**The tell.** Both the flattened layout and the good one measure `nearestNeighbourGap ≈ 0.99r`.
Identical local spacing, completely different pictures — so the metric §5.1 chose to judge
spacing by is blind to the thing that matters. What separates them is the *variation* in
nearest-neighbour gaps: 0.24 for the carpet, 1.26 for the legible one. Clusters mean dense
insides and empty gaps; an even disc has neither.

**Cause.** §7.2 derived the link distance from an area budget (canvas ÷ node count). A budget
cannot know how big the nodes are, so on a graph of 60px nodes it asked for 115–144px of
spacing — less than three node diameters — and every star packed into a hexagonal blob. The
fix is a second, independent term: `387 / 60 ≈ 6.5` from the hand-tuned graph, and
`67 / 10 ≈ 6.7` from the radius-10 version of the same graph that also reads well. Two
independent readings of the same constant.

**Changes.**

- **`LINK_PER_RADIUS = 6.5`**, taken as `max(areaBudget, 6.5 · r̄)`. The budget survives as a
  lower bound so a sparse graph on a large canvas still spreads.
- **Repulsion floor scales with node size** (`38 · (r̄/10)^0.54`), fitted to the same two
  points: r=10 wants 38, r=60 wants ~100. Bigger discs need a proportionally harder push to
  open the same gap.
- **Collide crowding is measured against `N · L²`** — the area the layout will actually
  occupy — rather than against a canvas budget it may exceed. Against the budget a large-node
  graph reads as permanently crowded, so the collide radius inflated and packed the clusters
  *tighter*. This alone took collide from 32 to 23 (hand-tuned: 24).
- **Centring's bound-graph ceiling is now the historical 0.001**, and the small-graph licence
  falls off cubically. The looseness term went from `sqrt(fraction)` to linear — sqrt let one
  loose node in 118 earn a sixth of the full ceiling, which visibly compressed a graph whose
  links were holding it perfectly well.

Auto now lands on rep 95 / link 390 / coll 23 / cent 10 against the hand-tuned 100 / 387 / 24 /
7, and the picture matches: hub-and-spoke stars, clear separation, thin edges between clusters.

**Test coverage, finally closed.** `MeasuredLayout` gains `densityVariation`, and
`buildAutoFixture` gains a `clusters` option that builds hub-and-spoke stars — the shape real
data has, and the only shape that can tell a legible layout from a blob (a random tree has no
clusters to lose). New fixture **G** asserts it at radius 60 *and* radius 6, so the rule is a
scale rather than a special case. This is the assertion that would have caught the original
regression; nothing in the suite could.

**Two test-infrastructure notes.** The spec is now `mode: 'default'` (sequential within the
file): every other spec disables the simulation, so this one starves itself of ticks when its
own cases run in parallel — F alone lays out 2000 nodes twice. And F no longer compares against
a pinned arm at all: two 2000-node layouts on a wall-clock tick budget gave ratios spanning
0.58–0.9 across runs, which measures machine load rather than tuning, so only the deterministic
knob claims and a small overlap tolerance remain.
