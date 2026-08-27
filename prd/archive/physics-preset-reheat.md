# Fix — a preset click should re-lay-out the graph, not nudge it

**Status:** done, 2026-08-19
**Branch:** `worktree-auto-physics-preset`
**Follows:** `prd/archive/auto-physics-preset.md`

---

## 1. The complaint

> "I try changing from tight to loose to auto. And the graph stayed almost the same. […] to see
> the real effect, I have to click on presets multiple time (especially the tight one)."

Repeat-clicking was the workaround. It worked because each click adds another dose of heat, so the
layout crept toward the preset's equilibrium a fraction at a time.

## 2. The problem, grounded

Four limiters stacked, none of them the preset bundles being wrong about what a layout should
*look* like.

**2.1 A click got half a layout's heat.** `reheatIfEnabled()` defaulted to `alpha = 0.5`. Charge,
link and `ForceGravity` all scale their per-tick velocity contribution by alpha, so the distance a
node can travel over a reheat goes as Σalpha = α₀/alphaDecay — **10 at α₀ = 0.5 against 20 for a
fresh α₀ = 1 layout**. Auto's background `AUTO_REHEAT_ALPHA = 0.3` gives 6.

**2.2 Each preset's friction fought the transition into it.** Steady-state displacement per tick
goes as (1−velocityDecay)/velocityDecay: `tight`'s friction 58 → **0.72**, `loose`'s 28 → **2.57**.
Same heat, ~3.5× less travel under tight.

**2.3 The cooldown wall was wall-clock; the decay is per-tick.** The tick loop stopped on
`now − startSimulationTime > cooldownTime`. `alphaDecayForSettleTime` defines settleTime as
`settleTime × 60` **ticks**, so the two agreed only at exactly 60fps. At 30fps the wall cut the run
at ~68 of the intended 135 ticks: the heavier the graph, the less settling it got, which is
backwards.

**2.4 The Auto button could be a literal no-op.** `tuneNow`'s 4% deadband returned before writing
knobs *or* reheating. `loose → Auto`, on a graph where auto's answer sat near loose, did nothing.

## 3. What the measurements actually said

Measured with a temporary bake-off (deleted before merge) over a 120-node, 6-cluster fixture,
median of 3–5 runs. `shortfall` = |fill after 1 click − fill after 6| / fill after 6.

### 3.1 Heat alone fixes expansion and does nothing for contraction

| transition | α 0.5 (before) | α 1.0 |
|---|---|---|
| `loose → tight` | 25.4% | **25.5%** |
| `tight → loose` | 12.1% | **1.6%** [2 1 2] |
| `loose → auto` | 14.6% | 12.2% |
| `tight → auto` | 16.7% | 14.0% |

This is the finding that reshaped the fix. Doubling the heat transformed *expansion* (12.1% → 1.6%)
and left *contraction* untouched. The reason is `forceCollide`: it is a positional constraint
resolved at full strength every tick, and unlike charge, link and gravity it **never scales with
alpha**. Contracting a graph means pushing it past collide, and heat cannot hurry a force that
ignores heat. So α 1.0 earns its place — just not on the transition that prompted the complaint.

### 3.2 What does move contraction: damping, and time

`loose → tight` shortfall, sweeping one lever at a time:

| friction (settle 2.25) | shortfall | | settleTime (friction 58) | shortfall |
|---|---|---|---|---|
| 58 (before) | 25.5% | | 2.25 (before) | 25.5% |
| 45 | 14.9% | | 3 | 18.2% |
| 40 | 12.0% | | 4 | 19.3% |
| 35 | 19.7% | | 5 | 9.8% |
| 30 | 6.5% | | 6 | 8.1% |

Either lever alone needs to go a long way: friction down to ~30 (indistinguishable from `loose`'s
28, so no longer a distinct preset), or settleTime up to 5–6s (a graph that keeps moving for six
seconds after every click). Combined, neither has to:

| friction + settleTime | shortfall |
|---|---|
| 45 + 3 | **9.1%** [8 10 9] |
| 40 + 3 | 9.3% [9 11 5] |
| 40 + 3.5 | 7.7% [8 12 6] |
| 35 + 3 | 13.2% |

`tight`'s old numbers were the contradiction: the heaviest damping in the set paired with the
*shortest* settle. Damping is precisely what makes a layout take longer to arrive.

### 3.3 The metric that finally held still

Shortfall is a ratio of two small differences, and it measures chaos as much as convergence: the
same configuration read 9.2% and 20.0% on consecutive runs. Restating it as **the fraction of the
journey one click covers** — `(fill_from − fill_1click) / (fill_from − fill_settled)` — divides by a
large, stable quantity instead. Five runs, real presets:

| transition | journey covered in one click |
|---|---|
| `loose → tight` | **87%** [82 87 88 88 86] |
| `tight → loose` | **99%** [119 98 86 99 114] |
| `loose → auto` | 55% [55 50 57 56 50] |
| `tight → auto` | journey too small to ratio (absolute shortfall 4.1%) |

The same measurement before the fix was **60%**. That is the headline: one click now does what took
five or six.

### 3.4 Where the claim stops — graphs that never converge

Everything above is a 120-node graph, and the claim does not extend to every size. Traced at 300
nodes, `tight` has no fixed point to arrive at: repeat-clicking inflates the layout monotonically,
click after click, and 12 is not enough to settle.

```
300n r14 c12 | loose 5.55 | tight 1:5.46 2:5.58 3:5.68 4:5.77 … 12:6.15
300n r10     | loose 6.07 | tight 1:5.52 2:5.45 3:5.53 4:5.63 … 12:6.36
```

The first click contracts; from the second on the graph re-expands, past where `loose` sat. This is
not the reheat split misbehaving — it is that at this size the layout's extent is set by *topology*
rather than by the knobs, and it is nowhere near converged when the run ends, so each further dose of
heat lets the chain of clusters unfold a little more. `prd/archive/auto-physics-preset.md` §13 says the same
thing about fixture F: a random recursive tree is "about the least compressible thing a force layout
can be handed", and at 300 nodes "most of its size is topology".

Two consequences worth stating plainly:

- **The journey metric is meaningless at this size** — there is no `fill_settled` to divide by. An
  attempt to compare α 0.5 against α 1.0 here produced 3.5% vs 0.1% on one fixture and 4.7% vs 8.9%
  on the other, with `loose` itself landing anywhere between 3.93 and 6.01 across runs. Nothing can
  be concluded from that, in either direction.
- **D2 has a cost at scale.** Because every click now reheats fully, repeat-clicking a large graph
  inflates it faster than it used to. The gesture is still the right default — a click must answer —
  but on a graph this size, clicking repeatedly is no longer a way to converge, and stopping after one
  click is the better instinct.

Whether the real graph that prompted this behaves like these synthetic fixtures is not known: they
are deliberately incompressible, and real data has structure they lack. That check needs a human
looking at the actual dataset.

Two side notes worth keeping. Exact settling mattered as much as the metric — polling the bounding
box for "two samples agree" reports a slow-moving mid-run frame as settled, and the noise that
introduced was larger than the effect being measured. And >100% is a slight overshoot that comes
back, not an error.

## 4. Decisions

- **D1 — Three reheat alphas, by caller.** Preset/Auto *button* `CLICK_REHEAT_ALPHA = 1`, slider
  setter 0.5 (unchanged — a drag is continuous and must not fire a full re-layout per `input`
  event), auto's background re-tune 0.3 (unchanged — designed to relax, not restart). No
  knob-distance scaling function: the caller already carries the intent. Kept despite §3.1 showing
  it does nothing for contraction, because it is what fixes expansion.
- **D2 — A click always reheats,** even when no knob moves (`tuneNow({ force: true })`). Chosen over
  converge-and-stop: "click = re-lay-out" is predictable, and it keeps repeat-clicking as a
  deliberate nudge rather than a workaround.
- **D3 — The cooldown counts ticks, with a wall-clock backstop.** `cooldownTime / 1000 × 60` ticks,
  identical at 60fps and correct below it. The ms budget survives as a backstop at
  `COOLDOWN_WALL_GRACE = 4`, for a hidden or throttled tab where rAF drops to ~1fps and a pure tick
  budget would keep a run nominally alive for minutes — the slow-tick watchdog cannot cover that,
  since it measures compute time per tick, deliberately immune to the frame gap.
- **D4 — `tight` becomes friction 45 / settleTime 3.** Data, not machinery. Rejected: damping
  compensation on alpha (tight would need α ≈ 3.5, and d3 alpha > 1 overshoots), and a low-friction
  transition window (breaks the invariant that the sliders always show the sim's real state).
  `friction` only shapes the approach — at rest velocity is zero regardless — so this costs nothing
  in the settled look. `tight` remains clearly the calmer preset (45 against `loose`'s 28).
- **D5 — `loose` unchanged.** It converges at 99%; there was nothing to fix.
- **D6 — The worker is untouched.** `runSimulationWorkerRouter` only serves the initial/recomputed
  layout; reheat is purely main-thread. `SimulationWorker.ts` keeps ms semantics — it ticks in a
  tight loop rather than on rAF, so wall-clock is the right budget there.
- **D7 — Auto's own tuner is left alone, and the gap is documented.** See §6.

## 5. Backward compatibility

- `cooldownTime` keeps its unit and its meaning at 60fps; only sub-60fps behaviour changes, and it
  changes toward what the option already documented. The two in-tree callers still behave as before:
  `cooldownTime: 0` (`Sidebar/Neighbors.ts`) → 0 ticks, stops immediately; `cooldownTime: 50`
  (`svg/ClusterDrawer.ts`) → 3 ticks, the 3 frames 50 ms bought at 60fps.
- `PHYSICS_PRESETS.tight` changes value. `settleTime 2.25` no longer holds across both presets, so
  the note that a preset "changes nothing but the four knobs it always set" now applies to `loose`
  only — deliberately, and recorded in the type's doc comment.
- No API signatures change. `applyPhysicsPreset` and `enableAutoPhysics` keep their shapes; a
  consumer calling either programmatically now gets the full re-layout, which is what those calls
  say they do.

## 6. Known gap — the Auto button is at 55%

`loose → Auto` covers 55% of its journey in one click, consistently (50–57% over five runs). Auto is
not affected by D4: it chooses its own damping, and it chooses it high —
`frictionFor(N) = 24 + 38·clamp01(log10(N/4)/log10(125))` reaches **51 at 120 nodes and 58 at 300**,
while `settleTimeFor(N) = 1.2 + 0.8·log10(N)` only reaches 2.9 and 3.2. That is `tight`'s old
contradiction, in the tuner.

Measured, giving auto more time fixes it the same way:

| auto settleTime | journey covered |
|---|---|
| default (2.9) | 57% [68 57 56] |
| 3.5 | 74% [74 63 76] |
| 4 | **82%** [73 82 99] |
| 5 | 74% [74 69 106] |

Left out of this change on purpose. Raising `settleTimeFor` lengthens *every* auto run — including
the background re-tune that fires on every graph change — for a benefit realised on an occasional
button click, and lowering `FRICTION_MAX` risks the boiling on large graphs that band was tuned to
prevent (`prd/archive/auto-physics-preset.md` §13.6). Both are one-line data changes and both touch a
subsystem whose fixtures A–G encode a lot of tuning, so the trade belongs to whoever owns that
call. The measurement above is the evidence for it.

## 7. Acceptance criteria

1. ✅ **at 120 nodes** — one click on `tight` or `loose` covers >70% of the journey to that preset's
   own equilibrium: measured 87% and 99%, against 60% before. Measured, not asserted; see §8.
   ⚠️ Does not hold at 300 nodes, where the layout has no fixed point to reach within a run and
   repeat-clicking inflates it instead. See §3.4 — a real limit of the claim, not of the mechanism.
2. ✅ Clicking an already-active preset, or `Auto` while on Auto, always reheats. Asserted.
3. ✅ A run is budgeted in ticks rather than milliseconds, with the ms value kept as a backstop.
   Verified by construction and by §8's parallel-suite result — a starved run stops early *because*
   the backstop fires, which is the backstop doing its job. Not asserted: any test of "the run got
   its full tick budget" is a statement about the machine's frame rate, per §8.
4. ✅ Auto's background re-tune is unchanged: α 0.3, deadbanded, one reheat for a growth spurt and
   none for a `+1` node. Asserted (fixture E, unchanged and still green).
5. ✅ Dragging a slider still reheats at 0.5. Asserted, exactly.
6. ✅ No bake-off scaffolding survives the merge.
7. ⚠️ `Auto` reaches 55%, not >70%. Scoped out, evidenced, §6.

## 8. Test coverage

### 8.1 The outcome measurement is not a test, and why

The journey fraction of §3.3 was written as an assertion first — `> 0.7`, both directions. It passed
run alone and **failed at 0.572 in the full parallel suite**. Nothing regressed: eight Chromium
workers starve each other of frames, every run hits the wall-clock backstop early, and a truncated
run travels less far. The metric measures the machine as much as the fix.

That is the same conclusion fixture F reached before this change, in its own words: a layout at that
size "is a statement about the tick budget rather than about the tuning", so it asserts only the
deterministic knob claims. This change follows that precedent rather than adding a test that would be
muted the first time CI was busy. The numbers live in §3.3, reproducible with `--workers=1`.

A related trap, worth keeping: the first version of the bake-off polled the bounding box until two
samples agreed, and reported slow-moving mid-run frames as settled — noise larger than the effect.
Waiting on the engine's own run flag cut the spread on one configuration from 9–20% to 8–10%.

And the bake-off itself caused three unrelated specs (`notes`, `legend`, `delete-hook`) to fail in
the first full-suite run, purely by occupying a worker with a live 120-node simulation for 18
minutes. They pass in isolation. A spec that runs real physics is a load generator, not just a test.

### 8.2 What is asserted

`tests/visual/specs/auto-physics.spec.ts`:

- **an explicit click reheats to full strength; a slider drag does not** — alpha read inside the same
  `page.evaluate` as the call that sets it, so no tick can decay it in between: exactly 1 after
  `applyPhysicsPreset`, exactly 0.5 after `setRepulsion`. This is D1, with no timing in it, and it
  fails immediately if the two callers are collapsed back onto one alpha.
- **an explicit click always reheats, even when no knob moves** — D2, via the deadband case in its
  purest form (auto already on and already tuned), plus the same preset clicked twice.

`tests/visual/specs/physics-flyout.spec.ts`:

- **applying the Tight preset sets every slider** — pins D4's `friction: 45` / `settleTime: 3` pair,
  mirroring the `loose` test that already existed. Without it, nothing would notice the pair drifting
  back apart.

`tests/visual/harness/harness.ts` gains `simulationRunning()` and `simulationAlpha()`, following
`countReheats`'s precedent of keeping test-only observation out of the production API.

Three comments in the auto spec explained loose bounds by "`cooldownTime` is a wall-clock budget".
That reason is no longer true; the bounds stay (the backstop can still truncate a loaded run) but the
rationale is restated.
