# States and copy — the pivot/enrichment UI

**Status:** Step 1 of [`pivot-enrichment-ui-prototype-brief.md`](pivot-enrichment-ui-prototype-brief.md),
written 2026-09-01. Groundwork in
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

One pivot in the menu, whatever surface hosts it. `summarize` runs on **menu open**, never on
selection (D11, and the call log makes this visible).

| # | State | What the entry shows | Copy |
|---|---|---|---|
| **S1** | `idle` | Label, icon, and the declared hint if the node carries one (D12) | `Correlations` · `~2,100 declared` |
| **S2** | `summarizing` | Skeleton where the count will be. **Skipped on a cache hit** (D20) — a re-opened menu shows its number at once | — |
| **S3** | `ready` | Count, facet breakdown, narrowing controls, **Fetch** enabled | `~2,143 correlations` / `1,800 domains · 210 URLs · 95 pastes · 38 IPs` |
| **S4** | `over-cap` | Same as S3, **Fetch disabled**, refusal line under the count | `~2,143 exceeds this pivot's cap of 2,000 — narrow further to fetch` |
| **S5** | `re-summarizing` | The previous count **dimmed, never blanked**; facets stay live; Fetch disabled | last count at reduced opacity |
| **S6** | `summarize-failed` | Inline error in place of the count, **Retry** | `Couldn't reach the source. Retry` |
| **S7** | `no-summarize` | No count, no narrowing, just **Run** — a legal provider shape (PRD §7) | `Objects & attributes` · `Run` |
| **S8** | `fetching` | Indeterminate progress, **Cancel** | `Fetching ~210…` |
| **S9** | `staged` | Returns to S3/S4, plus a link to the dock tab now holding the candidates | `210 in triage ▸` |
| **S10** | `ingested` | Auto-ingest pivots only (D13): back to S1/S3, the toast carries the outcome | — |

**Transitions.** S1→S2 on menu open · S2→S3/S4/S6 on the summarize settling · S3/S4→S5 whenever
narrowing changes or the selection changes while the menu is open (D11), then S5→S3/S4/S6 ·
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

## 3. The menu itself

| # | State | Copy |
|---|---|---|
| **M1** | pivots available | the list |
| **M2** | selection has no applicable pivots | `No pivots apply to this selection` |
| **M3** | nothing selected, origin-less pivots exist | those pivots only, no selection-scoped section |
| **M4** | no pivots registered at all | the surface is absent entirely — not an empty state |

Esc closes it. Closing cancels nothing that is already fetching (see C3). In `viewer` and
`static` UI modes the whole surface is absent (brief §5).

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
| **T6** | triage finished | `Nothing left to triage` + what happened: `12 ingested · 198 rejected` |
| **T7** | replaced | a re-run of the same pivot replaced this set — see C6 |

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
table's columns. Present only when the run produced them.

### 5.6 Concurrency

One pane per pivot id; different pivots coexist as tabs (PRD §11.4).

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

**C14 — they get a section in the same menu, shown when nothing is selected (M3), plus a
mainheader entry point.** The reasoning: the brief asks for one proposal, and the cheapest honest
one reuses the surface that already exists rather than inventing a second door — D19's whole
argument was one pipeline, not two. The mainheader entry is what makes them reachable *while*
something is selected, since the selection-driven menu is then busy. Their results route into the
same triage pane and land at the viewport centre (D22). Kept deliberately quiet: no rail mode, no
hero placement.

---

## 9. What this leaves to the artboards

Only placement and layout: where the menu lives, how a pivot entry is laid out, how the narrowing
controls stack, how the pane divides between table, header and actions. Every state above must be
reachable in whichever variant wins, and every string above is the one it shows.
