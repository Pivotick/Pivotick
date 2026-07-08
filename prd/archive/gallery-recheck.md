# PRD — Gallery recheck after the library-fix pass

**Status:** Ready to implement
**Owner:** Sami Mokaddem
**Depends on:** `prd/library-fixes.md` (all 8 fixes) — **merged into this branch.**

---

## 1. Why

Every fix in `prd/library-fixes.md` was originally **worked around inside the
gallery card that surfaced it**. Now that the real fixes have landed, those cards
should be rechecked — and several workarounds removed or upgraded — so the demos
show the library at its best (and don't teach the workaround). Only **6 of 32
cards** are affected; the rest are untouched.

## 2. Scope

| Card (slug) | Fix(es) | Action | Re-capture? |
|---|---|---|---|
| **infra-dependency-map** (L4) | #3, #6, #7 | **Refactor.** With cross-cluster child→child edges resolving (#6), promote the app tier to real collapsible clusters and show the "box → box" dependency view the flat-tier workaround avoided. Drop the `setTimeout(…, 800)` + manual `fitAndCenter()` (#7). Confirm expand/collapse settles (#3). | Yes |
| **custom-html-node** (B3) | #8 | **Simplify.** Remove the `simulation.d3ManyBodyStrength: -2200` / `d3LinkDistance: 260` spacing hack — measured size now feeds the collision radius, so cards space themselves. Keep only tuning that still reads well. | Yes |
| **filter-query-engine** (I1) | #1, #2 | **Upgrade.** Add the "hide / exclude node" button dropped when `excludeNode()` was broken (#1). Verify the built-in filter panel now reflects the button-driven `setFilter()` calls (#2). | If UI changes |
| **clusters-hierarchy** (I3) | #3 | **Recheck.** No code workaround; confirm expand/collapse settles cleanly and doesn't jitter on drag. Prereq validator for L4. | If layout shifts |
| **large-graph-scale** (K3) | #4, #5 | **Recheck.** Ships with node sizes 4/6/8 (< 10) that relied on `useWorker: true` to dodge the NaN-charge collapse (#4, now fixed). Confirm the layout still holds; worker is now perf-only, not correctness. Recheck spread against the #5 gravity change. | If layout shifts |
| **force-layout-tuning** (D1) | #5 | **Recheck.** This card *teaches* `d3GravityStrength` (sets `0.05`). Confirm what #5 actually changed (doc-only vs. honouring a floor for connected nodes); update the narrative/value if the demonstrated effect changed. | If layout shifts |

**Not affected:** A1 · B1/B2/B4/B5 · C1/C2/C4 · D2+D4 · E1/E4 · F1–F4 · G1/G2 · H1/H2 · I4 · J1/J4 · K1 · L1/L2/L3.

## 3. Order

1. **B3** and **I1** — smallest, self-contained.
2. **I3** — recheck (validates clustering before L4).
3. **L4** — the real refactor (depends on I3 being clean).
4. **K3**, **D1** — sim-behaviour rechecks.

## 4. Definition of done (per card)

- Workaround removed or feature added as above; card still self-contained and lint-clean.
- Live demo renders correctly; `code-group` snippets still valid.
- `pic.png` re-captured where the visual changed (`node scripts/capture-thumbnails.mjs <slug>`).
- `npm run docs:build` passes.

## 5. Follow-up (optional)

- Trim the capture-settle in `scripts/capture-thumbnails.mjs` (bumped for the L4 fit race, #7) once L4 no longer needs it.
- Simplify any remaining workaround comments in the affected `options.js` files so they don't describe a bug that's now fixed.
