# States and copy — the pivot/enrichment UI

**Status:** Step 1 of [`pivot-enrichment-ui-prototype-brief.md`](pivot-enrichment-ui-prototype-brief.md),
written 2026-09-01. **§5 and §6 are built** — see §17 of the PRD, which amends **C5** (the
suppressed rows are an id list with a restore, because M1 does not stage them), **C8** (reversed:
`DockTabHandle.setLabel` exists, so the count is in the tab) and **C9** (built as specified).
**§5.6** was amended again on 2026-09-03: the panes coexist inside one **Review** tab, as
vertical tabs down its side, rather than as tabs of the dock's own (at-scale finding 8). **T6** was
amended the same day by **C16**: an ingest that empties a pane closes it.
Groundwork in
[`pivot-enrichment-ui-groundwork.md`](pivot-enrichment-ui-groundwork.md); behaviour in
[`pivot-enrichment-interface.md`](pivot-enrichment-interface.md), which wins on any disagreement.
**Owner:** Sami Mokaddem

This is the surface-independent half of the design: every state each surface can be in, what
takes it there, and the exact words. It re-decides no D-number; where it decides something the
PRD left open it says so as a **C-number**, so those can be argued separately from the layouts.

**Why it comes first.** The brief's §3.2 asks for the same AIL flow in three placements. If each
variant invents its own states and wording, they differ in a dozen incidental ways and the
comparison stops being about placement — which is the only thing actually being chosen. So: this
document fixes states and copy, the artboards vary placement, and Phase B implements this.

**The surface, settled in round 2 (Sami's call).** Pivot is **its own rail mode** — a
`kind: 'pointer'` mode with its own tools (*Pick origin*, *Lasso origin*), its own panel, and its
own options. Two consequences run through everything below:

- Wherever this document says *the menu*, read *Pivot mode's panel*, and wherever it says *opening
  the menu*, read *entering Pivot mode*. The D11 intent boundary is the mode boundary:
  `onEnter` starts `summarize`, `onExit` stops every call.
- Wherever it says *the selection*, read *the origin* — the node set Pivot mode's tools built. An
  **empty origin** is a legitimate state, not an error, and it is where origin-less pivots live
  (C14).

**The mode is gated, and that is what settles the old objection.** `UI.pivotMode?: boolean |
'auto'`, default `'auto'` — the rail button exists only while at least one pivot is registered.
So a consumer who registers none sees exactly what PRD §12 originally promised: nothing. This is
now **D26** in the PRD, which reverses the old §12 line and the brief's matching hard rule; both
have been amended. `RailModeDefinition`'s own doc comment had already imagined the door — "the
door an integrator builds their own Explore or **Enrich** mode through" — it just expected the
consumer to walk through it.

---

## 1. Copy conventions

**The tilde rule.** `~` marks a number a *provider* claims; a bare number marks something the
library counted itself. So `~2,143 correlations` (advisory, D10) but `210 fetched`, `12 selected`,
`14 edges` (in hand, exact). Never `~` on rows, selections or ingest results; never a bare
advertised total. One glance tells the analyst whose number they are reading.

**Refusals have three parts, in order: the number, the limit, the way forward.** No refusal is
ever a bare "too many results".

**Words that are fixed** (PRD §2, and the menu must not drift): *pivot* (the runnable
enrichment), *candidates* (fetched, not in the graph), *ingest* (commit chosen candidates),
*reject* (an explicit act), *source* (provenance). Notably not used in the UI: "potential" — it
is the PRD's word for the concept, and the interface just shows the number.

**Counts are localised** (`toLocaleString`), so `2143` renders `2,143` and follows the page's
locale. Zero is never phrased as a failure.

**No spinner carries a percentage.** There is no streaming and no progress (D3); in-flight states
are indeterminate and always cancellable.

---

## 2. The pivot entry — state machine

One pivot in the panel. `summarize` runs on **entering Pivot mode** (`onEnter`) and stops on
leaving it (`onExit`) — never on selection (D11, and the call log makes this visible).

| # | State | What the entry shows | Copy |
|---|---|---|---|
| **S1** | `idle` | Label, icon, and the declared hint if the node carries one (D12) | `Correlations` · `~2,100 declared` |
| **S2** | `summarizing` | Skeleton where the count will be. **Skipped on a cache hit** (D20) — a re-opened menu shows its number at once | — |
| **S3** | `ready` | Count, facet breakdown, the gate line (capped pivots only), narrowing controls, **Fetch** enabled | `~2,143 correlations` / `1,800 domains · 210 URLs · 95 pastes · 38 IPs` / `Within the cap of 2,000` |
| **S4** | `over-cap` | Same as S3, **Fetch disabled**, the gate line tinted. One line in both states, so crossing the cap mid-narrowing does not resize the entry | `Over the cap of 2,000 — narrow further to fetch` |
| **S5** | `re-summarizing` | The previous count **dimmed, never blanked**; facets stay live; Fetch disabled | last count at reduced opacity |
| **S6** | `summarize-failed` | Inline error in place of the count, **Retry** | `Couldn't reach the source. Retry` |
| **S7** | `no-summarize` | No count, no narrowing, just **Run** — a legal provider shape (PRD §7) | `Objects & attributes` · `Run` |
| **S8** | `fetching` | Indeterminate progress, **Cancel** | `Fetching ~210…` |
| **S9** | `staged` | Returns to S3/S4, plus a link to the dock tab now holding the candidates | `210 in triage ▸` |
| **S10** | `ingested` | Auto-ingest pivots only (D13): back to S1/S3, the toast carries the outcome | — |

**Transitions.** S1→S2 on entering the mode · S2→S3/S4/S6 on the summarize settling · S3/S4→S5
whenever narrowing changes or the origin changes while the mode is active (D11), then S5→S3/S4/S6 ·
S4→S3 when a narrowed re-summarize comes back under the cap — **this is the gate lifting, and it
is the single most important moment in the flow** · S3→S8 on Fetch · S8→S9 on results, S8→S3 on
Cancel · S7→S8 on Run.

**A pivot that doesn't apply is absent**, not disabled (`appliesTo`, PRD §7). The context menu
gets this for free: `MenuActionItemOptions.visible` takes a predicate.

**C1 — the tilde survives narrowing, and the refusal.** A narrowed count is still the provider's
claim, so `210` in S3 renders `~210`, and only becomes bare once the rows are in hand (`210
fetched`). It reads oddly at first and is right: the shrink from `~210` to `198 fetched` must not
look like a bug (D10). The refusal in S4 keeps it too — `~2,143 exceeds…` — which is one
character away from the brief's example wording and consistent with everything around it.

**C2 — the multi-selection count is one line, never per node.** `~2,143 correlations across 50
nodes` (D2 batches it into one request; nothing can decompose it, D20).

---

## 3. Pivot mode's panel

| # | State | Copy |
|---|---|---|
| **M1** | pivots apply to the origin | the list, under `n pivots apply` |
| **M2** | an origin is picked, nothing applies to it | `No pivots apply to this origin` |
| **M3** | **empty origin** | the mode's instruction — `Nothing picked — click a node on the canvas, or run one of the pivots below` — over the origin-less pivots (C14) |
| **M4** | no pivots registered at all | the rail button is absent — not an empty mode |

M4 is the default behaviour, not an edge case: `UI.pivotMode` defaults to `'auto'`, so the button
**appears when the first pivot registers and goes when the last unregisters**. `true` forces it
(for pivots that arrive asynchronously), `false` never shows it. Constructor-registered pivots
(`new Graph(el, data, { pivots })`) land before the UI is built, so the first paint is already
correct — D15's ordering constraint paying for itself.

Leaving the mode cancels nothing that is already fetching (see C3). In `viewer` and `static` UI
modes the mode is never registered, so the rail button does not exist (brief §5).

**Above the pivots, always:** the mode's tools (*Pick origin*, *Lasso origin*) and the current
origin with a **Clear**. The origin is the mode's subject; the pivots are what can be done to it.

**C15 — the panel is 300px in this mode, and the legend moves.** The tool panel is a fixed 216px
today (`toolpanel.scss:7`), which is too narrow for a `multiselect` with counts beside four
options plus a `numberRange` pair. Pivot mode asks for a per-mode width of 300px. Consequence,
stated rather than discovered later: a panel that runs the full canvas height collides with the
legend at the canvas's bottom-left, so in this mode the legend moves. The alternative — capping
the panel and scrolling — was rejected because the panel's height is precisely what it has over
the sidebar placement.

**C3 — the dock tab is created when `fetch` starts, not when results land.** This answers the
brief's §3.6 question ("menu closes mid-fetch — complete into a dock tab, or cancel?") with
*complete into the tab*: the tab already exists and is showing T0, so closing the menu is not a
cancellation and a slow fetch stays visible. It also gives a failed fetch somewhere to live (T4),
which is where the brief already puts it. Cancel is reachable from both the menu row (S8) and the
pane (T0).

---

## 4. Narrowing controls

Five types, `text` · `select` · `multiselect` · `numberRange` · `boolean` — verified as exactly
`Exclude<FilterFacetType, 'regex'>` (D18). **No regex widget here**; regex belongs to the triage
pane's own client-side filters (D5).

- `multiselect` options carry counts and show them: `URLs 210`. Ticking one re-runs `summarize`
  (S5) — the counts that come back are the source's, not arithmetic over the old ones (D4).
- Re-runs are debounced; a superseded run is cancelled and its answer dropped (D11).
- **Clear narrowing** returns to the unnarrowed count. Always present once anything is set.
- **C4 — no live count on the control itself.** A `numberRange` slider does not predict what it
  will yield; only the count line updates, and only after a re-summarize settles. Predicting would
  mean client-side arithmetic, which D4 explicitly rules out as unable to handle more than one
  facet.

---

## 5. The triage pane

A dock tab holding candidates. **The tab strip only appears from two panes on** (groundwork G3),
so the single-pivot case has no tab at all.

### 5.1 Pane states

| # | State | Copy |
|---|---|---|
| **T0** | fetching | `Fetching candidates…` + **Cancel** |
| **T1** | staged | the table, with the header line below |
| **T2** | all deduped | `All 210 are already on the canvas — nothing to triage` |
| **T3** | zero results | `No candidates came back` |
| **T4** | fetch failed | `Couldn't fetch candidates.` + **Retry** (re-runs `fetch` with the same narrowing) |
| **T5** | ceiling refusal | `The source returned 14,203 candidates, over the 10,000 limit. Nothing was staged — narrow and run again.` (D17 — a refusal, never a truncation) |
| **T6** | triage finished | `Nothing left to triage` + what happened: `12 ingested · 198 rejected` — but see C16 |
| **T7** | replaced | a re-run of the same pivot replaced this set — see C6 |

**C16 — an ingest that empties the pane closes it.** T6 is where triage *ends*, not where it is
reported: an emptied pane holding nothing but a **Close** is one more click between the analyst
and the canvas they have just changed, for a tally the ingest toast already carries. So the
pane goes, and the provider strip hands over to the next one waiting. T6 is still reached the
other way, by rejecting the last rows — there is no toast on that path, so the tally is the only
report of it. A re-run waiting in the pane (C6) keeps it open either way: its candidates are
reachable from that banner and nowhere else.

### 5.2 The header line

Always honest, segments only when non-zero (D10, D23, D14):

> **210 fetched** · 12 already on canvas (skipped) · 3 rejected earlier

**C5 — the rejected segment is a button, not a note.** Clicking it reveals the suppressed rows in
place, so "previously rejected are suppressed" is *inspectable* rather than a claim the analyst
has to trust — and it gives back the only escape from a mis-rejection, since rejections are
per-session and per-pivot (D14). Unclicked it is one quiet clause; the noise the brief worries
about only arrives if someone asks for it.

The dedup segment says *skipped*, never *removed* — nothing was lost, those nodes are on the
canvas already, and their data was deliberately left untouched (D23).

### 5.3 Row lifecycle

| # | Row state | Reads as |
|---|---|---|
| **R1** | candidate | ordinary row |
| **R2** | marked for ingest | checked, row tinted |
| **R3** | rejected | struck through, muted, **stays in place**, with an undo affordance on the row |

**C6 — rejected rows are struck in place, not moved into a collapsed group.** Moving them
re-orders the table under the analyst's cursor mid-triage, and the whole point of D14 is that
rejection is a *deliberate act with memory* — it should stay visible where it happened, and stay
reversible until the pane is done. The collapsed-group alternative is better only for very long
sessions, and "Reject all remaining" already covers the bulk case. Rejection also must not read as
mere deselection: a rejected row loses its checkbox entirely rather than showing an unchecked one.

### 5.4 Actions

`Ingest selected (12)` · `Reject selected` · `Reject all remaining` (D14) · a filter-scoped
select-all that names what it matched: **`Select all 47 matching`**, never a bare "select all"
when a filter is active.

**Closing the pane rejects nothing** (D14). Untriaged leftovers are re-offered on the next run;
only `Reject all remaining` disposes of them, and it is one gesture.

### 5.5 Edge-only results (D24)

Their own section in the pane with `from` / `to` / `kind` columns, never forced into the node
table's columns. Present only when the run produced them. Amended 2026-09-03: when a run
produces both, **each block is named and counted** over its own column labels — unnamed, the
node table's labels read as a stray header row among the edge rows — and the edge block's
columns are deliberately narrower so the two grids do not line up. A run of nothing *but*
edges shows that block rather than the empty state, which is what the node-row-only check
used to do.

### 5.6 Concurrency

One pane per pivot id; different pivots coexist as tabs (PRD §11.4) — vertical tabs inside the
dock's one **Review** tab, since a tray run of six providers otherwise opens six dock tabs.

**C7 — a re-run replaces its own pane, and says so instead of silently swapping.** If a re-run
lands while rows are marked, the pane shows T7 — `This pivot was run again. 210 new candidates
are ready.` with **Show new** / **Keep triaging** — rather than discarding marks under the
analyst. Anything already ingested stays ingested; the replacement is of the *candidate set*, not
of the run's effects.

**C8 — the tab label carries the pivot label only; the count lives in the pane header.** Not a
preference: `DockTabHandle` has no `setLabel` (groundwork G2), so a live count in the tab would
mean re-registering the tab and losing its state. If Sami wants `Correlations (210)` in the strip,
that is a small library addition to spec, not a free choice.

---

## 6. Ingest, toast, undo

Ingested nodes land around the origin node, jittered; origin-less runs land at the viewport
centre (D22).

| Moment | Copy |
|---|---|
| after ingest | `Ingested 12 nodes, 14 edges` — **Undo** |
| after undo | `Undone` — **Redo** |
| auto-ingest (D13) | same toast; there was no pane |
| `onBeforeIngest` returned false (D9) | `Ingest cancelled` |
| narrowed by the gate | `Ingested 9 of 12 nodes` — the hook landed fewer than asked |

**C9 — the actionable toast needs a lifetime, not just a button.** Today's toast dies on a hard
4-second timer with no hover-pause, no dismiss and no handle (groundwork G1). Four seconds is
about how long it takes to *read* "Ingested 12 nodes, 14 edges", let alone decide. The minimal
`Notifier` extension this specs is therefore: an optional action `{ label, onClick }`, a longer
lifetime when an action is present (**12s**), pause on hover, an explicit dismiss, and a returned
handle so the same toast can flip to `Undone — Redo` in place.

**C10 — redo lives only on the toast.** The Mainheader buttons stay unwired (D25, brief §5), and
a second home for redo would imply a history surface this feature is explicitly not building.
Undo is the headline; redo is the courtesy that catches a mis-click in the next few seconds.
`graph.pivots.redo()` remains available to consumers regardless.

---

## 7. Rim badges (D12)

| # | State | Shows |
|---|---|---|
| **B1** | one pivot declares | count pill, `99+` past three characters |
| **B2** | several declare | the library collapses to `+n` automatically once corners run out — 2 free corners on a container, 4 on a plain node (groundwork §1) |
| **B3** | count 0 | no badge |

**C11 — the badge shows the count, not a glyph.** The number is the entire content of "declared
potential"; a glyph says only "something", which the analyst must then open a menu to resolve.

**C12 — clicking a badge opens the pivot menu scoped to that pivot.** `NodeBadge.onClick` exists
and consumes the click, so the node is not also selected — meaning the shortcut can be made to
select the node *and* open the menu deliberately, rather than by accident.

**C13 — badge tooltip copy is one self-contained line:** `~2,100 correlations · AIL`. It has to
stand alone because the automatic `+n` badge concatenates the hidden badges' titles one per line
(`BadgeDrawer.ts`), so anything that reads as a fragment becomes gibberish when stacked.

Nothing on the rim ever changes because of a selection or an open menu (brief §5).

---

## 8. Origin-less pivots (PRD §11.1)

**C14 — an empty origin is where they live, and they need no new surface.** Pivot mode has an
*origin*; an empty one is meaningful rather than broken. So origin-less pivots are simply the ones
that apply when the origin is empty (M3), and fold into a collapsed **"Without an origin (2)"**
group at the bottom once one is picked. The first draft of this decision gave them a mainheader
entry, which handed a secondary door the most prominent chrome in the app; the mode dissolves the
problem instead, and keeps D19's argument intact — the gap was never "the data came from
elsewhere", it was "there is no node to run this on". Results route into the same triage pane and
land at the viewport centre (D22).

---

## 9. What this leaves to the artboards

Only placement and layout: where the menu lives, how a pivot entry is laid out, how the narrowing
controls stack, how the pane divides between table, header and actions. Every state above must be
reachable in whichever variant wins, and every string above is the one it shows.
