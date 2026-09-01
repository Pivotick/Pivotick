# Review — sanity check of the pivot/enrichment PRD

**Status:** Review findings, 2026-09-01, against `pivot-enrichment-interface.md` as of `8dfa4a6`.
**How it was done:** every codebase claim in the PRD was verified against `src/`, the twenty-one
decisions were each re-examined, and four gaps the PRD does not cover were put to Sami as
questions during the review — his answers are recorded in §2 and are ready to become D22–D25.
**Verdict:** the architecture holds. Two-phase summarise/fetch, candidates-not-graph, one batch
gate, set-shaped provenance, and the additive-only invariant are all the right calls and none of
the findings below touches them. What the review found is one genuine contract hole (F1), one
internal contradiction created by an answer given during this review (F2), a handful of
underspecifications that would otherwise be discovered mid-implementation, and some small type
and naming fixes.

---

## 1. In plain words

The compact version of everything below:

- **The design is right.** Count first, fetch narrow, stage results, let the analyst pick,
  remember where things came from. That is what Maltego does and it is what MISP and AIL need.
  Nothing here says "redesign".
- **But the gate can't do its job as specified (F1).** The rule is "refuse to fetch above the
  cap, tell the analyst to narrow". Except `summarise` never hears about the narrowing — so
  once the gate refuses, nothing can ever lift the refusal. The AIL walkthrough in the PRD
  (2,143 total, tick *URLs*, fetch 210) only works by accident of having a single facet with
  per-option counts. Fix: pass the narrowing to `summarise` too, same as `fetch`.
- **The PRD never says where 200 new nodes land (answered).** They should appear around the
  node you pivoted on, not wherever the simulation throws them.
- **"Rejected" needed a definition (answered).** Only rows the analyst explicitly rejects are
  remembered; everything else is re-offered next time. A "reject all remaining" button makes
  the 1,800→12 workflow one gesture.
- **Two rules contradict each other now (F2).** Re-ingesting a node that already exists leaves
  it untouched — but D7 says matching *children* get "updated". Same situation, two behaviours.
  Children should be skip-not-update too: pivots discover structure, they don't refresh data.
- **Edges-only results had no story (answered).** A pivot that finds links between nodes
  already on canvas would have produced an empty triage table and silently landed its edges.
  Now such edges get their own triage rows.
- **Counting on every selection is paying for intent that isn't there (F3).** Box-selecting
  fifty nodes to drag them would fire every pivot's count query. Fire it when the pivot menu
  is opened instead — same UX for the pivot gesture, zero cost for everything else.
- **"Undo that enrichment" quietly means "undo that enrichment *type*" (F4).** Running the same
  pivot twice writes the same tag, so you can never undo just the second run. Cheap fix now:
  record a run id internally, next to the timestamp D16 already keeps.
- The rest is small: a facet type that accidentally re-admits `regex` into narrowing, a cache
  key that can't work as written, a required `expanded: boolean` that would make every provider
  write boilerplate, a missing way to *clear* a potential badge, an unstated return value for
  `run()`, and two wrong file paths.

## 2. Gaps not covered by the PRD — answered during this review

Four questions were put to Sami on 2026-09-01. The answers below are decisions, ready to be
absorbed into the PRD as D22–D25.

**A1 (→D22) — Ingested nodes seed near their origin.**
The PRD is silent on placement, and today `addNode` honours caller-supplied `x/y` but seeds
nothing itself — 200 ingested nodes would materialise wherever the simulation puts them, with no
visual connection to the node the analyst pivoted on. Decision: ingest seeds unpositioned
candidates around the origin node(s) (jittered, so the sim can fan them out), provider-supplied
`x/y` still wins, and origin-less pivots (D19) seed at the viewport centre. Belongs in M1 — it
is pipeline behaviour, not UI — with a test that ingested nodes land near the origin.

**A2 (→D23) — Rejection means an explicit reject, nothing implicit.**
D14 says rejections are remembered but never says what a rejection *is*. If "everything not
ingested when the pane closes" counted, ingesting the 12 URLs today would silently bury the
domains the analyst simply didn't get to. Decision: only rows the analyst explicitly rejects
are remembered, and the pane offers a **"reject all remaining"** affordance so the
1,800-down-to-12 triage is still one gesture. The rejection key is **(pivotId, candidate id)**
— rejecting a domain offered by the correlation pivot does not hide it from a different pivot,
which offers it in a different analytic context. D14's motivating sentence ("re-offered the
same 1,788 an hour later") should be reworded: those 1,788 *are* re-offered unless the analyst
rejected them, and that is the point.

**A3 (→D24) — Dedup skips: an id-matched candidate leaves the existing node untouched.**
Candidate data does not overwrite on-canvas data. Children union by id (D7) stays the *only*
way ingest touches an existing node. This keeps "ingest is purely additive" sharp — but it
creates the D7 contradiction in F2 below, which must be resolved the same way.

**A4 (→D25) — Hybrid edge triage.**
Candidate edges ride along with their endpoint nodes (an edge lands iff both endpoints end up
on canvas) — *except* edges whose endpoints are **all already on canvas**, which get their own
triage rows. Without this, a link-discovery pivot — return correlations *between* nodes already
on screen, a core AIL case — produces an empty node table and its edges silently auto-land,
which violates the staging principle. M2 note: don't force edge rows into the node table's
columns; a separate section or toggle inside the triage tab is enough.

## 3. Findings — what should change

Ordered by how much they matter.

**F1 — The narrowing gate cannot see the narrowed count. Make `summarise` narrowing-aware.**
D4: above `maxCandidates` the UI refuses to fetch and says "narrow further". But
`summarise(nodes, ctx)` takes no narrowing — so after the analyst narrows, there is no honest
way to know the new count, and the refusal can never lift. The PRD's own AIL walkthrough
(total 2,143 > cap 2,000; tick *URLs*; fetch 210) only works because a single `multiselect`
facet's option counts happen to be summable client-side; combine two facets, or narrow by
`text` or `numberRange`, and no arithmetic over facet options can estimate anything.
*Change:* give `summarise` the same shape as `fetch` — `summarise(nodes, narrowing, ctx)` —
called first with `{}`, re-invoked (debounced, cancellable, same `signal` idiom) when the
analyst changes narrowing, and let the gate act on the freshest advisory count. Providers that
ignore the argument lose nothing. This is a signature change to §7 and costs nothing now;
retrofitting it after consumers ship providers is a breaking change.

**F2 — D7's "matching ones updated" now contradicts A3. Union should add, never update.**
A top-level candidate whose id matches an existing node leaves that node untouched (A3). But
D7 (amended) says children union means "new ones added, matching ones **updated**". Same
situation — an id collision between incoming and existing — two different behaviours, one
level apart. *Change:* amend D7 to "new children added by id, matching ones left untouched,
none removed". This is also the more defensible semantics: pivots discover *structure*;
refreshing stale attributes is a data-sync concern that belongs to the deferred persistence
PRD, not to ingest. Two clarifications D7 needs while it is being amended:
- **Union recurses.** MISP nests event → objects → attributes, so the union must apply by id
  at every level of `RawNode.children`, not just the first.
- **Provenance reaches children.** Union-added children must carry the source tag, and
  `removeBySource` must remove a child only its source vouches for — the PRD's own test list
  already assumes this ("a child contributed by a different source survives the merge") but
  the mechanism is stated nowhere. Removing a child from an *expanded* container goes through
  the same cheap wholesale-rebuild path D7 already accepts.

**F3 — D11 fires `summarise` on a gesture that often carries no pivot intent.**
"Selection counts as intent" is the one settled decision worth reopening. Selection in
Pivotick is also the gesture for dragging, styling, bulk edit and delete — box-selecting fifty
nodes to *move* them would fire every registered pivot's `summarise` against the backend, and
AIL count queries are not free. Batching, debouncing and caching (all kept) reduce the waste;
they don't change that it is waste. *Change:* move the trigger one notch later — run
`summarise` when the **pivot menu is first opened** for a selection. For the actual pivot
gesture the difference is one spinner beat; for every other selection the cost drops to zero.
If menu latency proves annoying in practice, prefetch-on-selection can return later as an
opt-in knob — the reverse migration (clawing back default backend chatter) is much harder.
D12 is untouched either way: rim badges stay declared-only.

**F4 — Provenance can't distinguish two runs of the same pivot. Record a run id internally.**
The provenance tag is the pivot id (D8), so running `ail-correlation` on node A today and node
B tomorrow writes the same tag, and `removeBySource('ail-correlation')` removes both — "undo
that enrichment" (§8) is actually "undo that enrichment *type*". That may be acceptable for
v1's public surface, but D16 already keeps internal timestamped records precisely so richer
history can be exposed additively later. *Change:* extend D16's internal record to
`{ at: number, runId: string }`. Zero public commitment now; per-run undo (`removeByRun`)
becomes purely additive later instead of a data-model migration. Storage is per-source-tag,
not per-node — the cost is negligible.

**F5 — `PivotFacet.type: FilterFacetType` re-admits `regex` into narrowing, against D18.**
The §7 sketch types narrowing facets with the *full* facet vocabulary, which is exactly what
D18 forbids. *Change:* `export type NarrowingFacetType = Exclude<FilterFacetType, 'regex'>`
and use it in `PivotFacet`. One line, and the type system enforces D18 instead of a code
review having to.

**F6 — "Cached per node" (D11/D20) cannot hold for aggregate results. Key the cache by set.**
`summarise` on `[A, B]` returns one aggregate for the pair; nothing can decompose it into
per-node entries, and selecting A alone later cannot reuse it. *Change:* cache key =
`(pivotId, canonicalised sorted node-id set)` — plus the narrowing, once F1 lands.
`invalidate(pivotId?, nodes?)` drops every entry whose id set intersects `nodes`; node removal
does the same automatically, as D20 already says.

**F7 — `graph.pivots.run()` has no stated return value. Define an outcome.**
Consumers and the test suite both need to know what happened. The wrinkle is that a triage
pivot's ingest may occur much later, or never — so `run()` must not hang on the analyst.
*Change:* resolve at the hand-off with a small outcome, e.g.
`{ status: 'ingested' | 'staged' | 'refused' | 'vetoed', nodes: Node[], edges: Edge[], deduped: number }`
— `ingested` for auto-ingest (arrays carry what landed), `staged` the moment triage opens,
`refused` for the D4/D17 gates, `vetoed` for `onBeforeIngest === false`. Later triage-driven
ingests announce themselves through `dataBatchChanged`, which is already the contract.

**F8 — Triage concurrency is unstated.**
Run pivot A, don't ingest, run pivot B: stack, replace, or refuse? Also re-running the same
pivot while its pane is open. *Recommendation:* one triage pane per pivot id (a re-run replaces
that pivot's candidate set), panes for different pivots coexist as dock tabs. Whatever is
chosen, it should be §11's fourth open question rather than an M2 surprise.

**F9 — `RawNode.expanded` is required; providers will curse it.**
`RawNode` (`interfaces/GraphOptions.ts:73`) declares `expanded: boolean` with no `?`, so every
provider returning 200 flat candidates must write `expanded: false` two hundred times — the
PRD's own MISP example already has to. *Change:* make `expanded` optional, defaulting to
`false`, as part of M1. Existing callers are unaffected (they all pass it today because they
must).

**F10 — `setPotential` has no counterpart. Badges need clearing and reading.**
`node.setPotential(pivotId, count)` is write-only: nothing clears a badge after the pivot has
run and ingested, and nothing reads it back. *Change:* define `setPotential(pivotId, 0)` (or an
explicit `clearPotential`) as removing the badge, and add `getPotential(pivotId?)`. Also worth
one honest sentence in D12: a node with children has only **two** free rim corners (the expand
affordance reserves East, `RendererOptions.ts` badges doc), so declared-potential badges will
collapse into `+n` early on exactly the container nodes MISP cares about.

**F11 — Edge-layer provenance styling oversells slightly (D8/§9).**
`edgeTypeAccessor` maps an edge to **one** string kind; provenance is a *set*, and consumers
(MISP) may already key edge layers on domain relationship types. Styling-by-provenance
therefore works only when the consumer dedicates the accessor to it and only for a chosen
primary source. Fine as an opt-in pattern — but the PRD should say "can", not imply it comes
for free alongside domain-typed layers.

## 4. Nits

- **`summarise` vs the codebase's American spelling.** Public API today says `normalizeNode`,
  `ColorPaletteMapper`, `virtualizeAbove`. A British-spelled `summarise` in the same surface
  will be misremembered constantly; name it `summarize` (prose can stay British).
- **Wrong path in D17:** `TableGrid` lives at `src/ui/elements/Table/TableGrid.ts`, not
  `.../Dock/` (`virtualizeAbove = 200` confirmed, line 98).
- **`onNodeExpansion` (§4.2):** if it is dead and not a foundation, M1 should delete it (it is
  public API, so: remove from `InterractionCallbacks` and the commented reference in
  `src/main.ts:303`) rather than leave a second, broken pivot-shaped door next to the new one.
- **Error surfaces:** the triage pane has "honest empty and error states" (M2), but a failing
  `summarise` (menu shows what?) and a failing `autoIngest` fetch (notifier?) are unstated.
  One sentence each in M2/M3 is enough.

## 5. What was checked and holds

- Every file/line claim in §4 and §9 verified against `src/` (the two path nits above aside):
  `onNodeExpansion` is declared with `edge: Edge` and has zero call sites; `AsyncSurface` stops
  at the five UI surfaces; `setChildren` (`Node.ts:444`) is the only child mutation and only the
  constructor calls it; `RenderContext` is exactly `{ signal, isStale }` — extending it for
  `PivotContext` brings no baggage; `DeleteDecision`'s narrowing idiom reads exactly as
  `IngestDecision` mirrors it; `dataBatchChanged` is emitted from all mutation paths.
- D1–D6, D9, D10, D12, D13, D15, D17, D19–D21 all withstand challenge; in particular D3
  (narrowing over streaming), D9 (one batch gate — 1,800 per-item vetoes would be absurd), D15
  (the `UIManager`-is-undefined-during-build ordering constraint is real) and D19 (origin-less
  pivots instead of a second door) are the strongest calls in the document.
- The additive-only invariant (ingest adds; only `removeBySource` removes) survives every
  finding above — F2 tightens it.

## 6. Test additions implied by this review

Beyond §13 of the PRD:

- Ingested nodes land near their origin node; origin-less results land at the viewport centre;
  provider-supplied `x/y` wins (A1).
- Un-rejected leftovers **are** re-offered on the next run; explicitly rejected ones are not;
  "reject all remaining" rejects exactly the visible remainder (A2).
- Re-ingesting an existing node changes none of its data (A3); a matching *child* is likewise
  untouched, and the union recurses into grandchildren (F2).
- An edges-only result set opens triage with edge rows instead of auto-landing (A4).
- Narrowing re-runs `summarise` and an over-cap refusal lifts once the narrowed count is under
  the cap (F1).
- Box-selection with no menu interaction fires zero provider calls (F3).
- `run()` resolves `refused` / `vetoed` / `staged` / `ingested` correctly (F7).
