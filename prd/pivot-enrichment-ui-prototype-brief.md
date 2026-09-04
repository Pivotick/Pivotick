# Brief — prototyping the pivot/enrichment UI

**Status:** Handoff brief for a prototyping agent, written 2026-09-01 against
[`pivot-enrichment-interface.md`](pivot-enrichment-interface.md) at `76fc4ad`. The PRD is the
authority on *behaviour*; this brief is the authority on *what to show and explore*. Nothing
here re-decides a D-numbered decision.
**Deliverable shape:** two phases. **Phase A** — a Claude Design canvas
(artboards per surface, variant and state), reviewed. **Phase B** — the winning
direction built as a single-page interactive HTML prototype with a fake provider, so the whole
flow can be *felt*: menu → narrow → gate → fetch → triage → ingest → undo.

**Phase A is done (2026-09-01) and the surface is settled: a gated Pivot rail mode (D26).** Five
placements were drawn — a section in the Select tool panel, a popover on the selection, a tab in
the selection sidebar, the Pivot rail mode, and the menu in the dock. §3.2's three variants below
are therefore a record of what was asked for, not of what won; the states and copy that survived
are in [`pivot-enrichment-ui-states.md`](pivot-enrichment-ui-states.md), and the triage pane was
approved as drawn. Phase B builds the Pivot mode.

---

## 0. Instructions for the prototyping agent

- Read this brief fully, then skim the PRD's §2 (vocabulary), §6 (decisions) and §8 (the two
  consumer walkthroughs). When this brief and the PRD disagree, the PRD wins — and say so.
- Where this brief says **explore**, produce the variants and argue a winner. Where it says
  **hard rule** (§5), every variant must satisfy it.
- Ask rather than guess, in short plain questions — one decision per question, no option
  essays.
- Run `npm run dev` and look at the real chrome before drawing anything. The gallery
  (`docs/`) has screenshots of every UI element in both themes.

## 1. What this feature is, in plain words

Pivotick is getting a Maltego-style pivot pipeline. An analyst selects a node (or fifty),
opens a **pivot menu** listing the enrichments that apply, and sees a cheap advertised count
("~2,143 correlations") with **narrowing controls** built from provider-declared facets.
Fetching is refused above a cap until narrowing brings the count down — no truncation, no
silent sampling, ever. Fetched results are **candidates**: staged in a **triage pane** in the
bottom dock, *never on the canvas*, where the analyst filters, picks and **ingests** a subset.
Ingested nodes land **around the node they pivoted from**, tagged with provenance, and the
whole run can be **undone** (and redone) as a unit. Some pivots skip triage and auto-ingest
(small, trusted results); some pivots need no selection at all (search, import).

Vocabulary the UI copy must keep straight (PRD §2): **pivot** = one runnable enrichment;
**potential** = advertised existence of more data, before any call; **candidates** = fetched,
awaiting triage, not in the graph; **ingest** = committing chosen candidates; **provenance** =
which sources vouch for a node/edge.

Two personas to design for, from the PRD: **a correlation engine** (a node can have 2,000+ correlations —
narrowing *is* the product) and **an event platform** (expand an event into its 12 objects — one click,
auto-ingest, undo).

## 2. The chrome this designs into

Pivotick's "B3" chrome, all existing and to be matched, not restyled:

- **Mainheader** (top bar): Search / Filter / Notes, plus *disabled* undo/redo placeholder
  buttons — these stay unwired (PRD §12); do not co-opt them.
- **Mode rail**: Select / Create modes plus a View flyout toggle, and a divider-separated
  **registered-modes zone** (`pvt-moderail-zone`) that plugin rail modes render into.
- **Tool panel**: contextual, swaps with the active rail mode.
- **Selection sidebar** (322px): header, properties, facets, neighbours tabs, bulk-action row.
- **Bottom dock**: tabbed (`DockTab`s); the data table lives here. The triage pane is a dock
  tab.
- **Context menu**, **Tooltip**, **Notifier** (levelled toasts — note: **no action-button
  support today**; see §3.4), **Modal**, tom-select-backed pickers.
- **Node rim badges** (`NodeBadge`): auto-placed clockwise from NE, `text` renders counts as a
  pill (`99+` past three characters), `title` gives a native tooltip, per-badge `onClick`
  exists, colour defaults to `var(--pvt-badge-color)`. Four corners free on a plain node,
  **two** on a node with children (the expand affordance owns the East side).

**Design-system constraints** (bind Phase B especially):
- Theme via CSS custom properties, `--pvt-*` (`src/styles/`); everything must work in light
  **and** dark — include a toggle in the prototype.
- Elements portaled to `<body>` must opt into the themed scrollbar (recurring past bug).
- No global `box-sizing` assumptions — full-width controls declare it per control.
- Icons from `src/ui/icons.ts`; don't introduce a second icon language.
- Table look = the existing `TableGrid` (typed per-column filters, virtualised above 200 rows).

## 3. Surfaces to design

### 3.1 Declared-potential rim badges (D12)

A node whose data source *declared* "there's more here" wears a small rim badge. Queried
counts never appear on the rim — only in the menu — so the canvas stays consistent.

States: declared count (pill, `99+`), several pivots declaring on one node (collapse into `+n`
early — containers only have two free corners), cleared (count 0 → badge gone).
**Explore:** count vs. glyph-only; whether clicking the badge opens the pivot menu
(machinery exists via badge `onClick` — a natural shortcut); tooltip copy ("~2,100
correlations · correlation engine").

### 3.2 The pivot menu — the main exploration (D1, D4, D11)

The surface that lists applicable pivots for the current selection and hosts narrowing.

Behaviour to honour: `summarize` fires **when the menu opens**, not on selection — a closed
menu costs zero backend calls (make this visible in Phase B, §6). While the menu stays open it
re-runs when the selection changes and when narrowing changes. Multi-selection gets **one
aggregated count** ("on 50 nodes"). Pivots that don't apply to the selection are absent
(`appliesTo`), not greyed.

Per-pivot states to draw: idle (label + declared hint) → loading skeleton → count + facets
("~2,143 — approximate, always) → **over-cap refusal** ("2,143 exceeds this pivot's 2,000
cap — narrow further", with the narrowing controls live) → narrowed and under cap → fetch in
flight (cancellable) → handed off to triage. Also: `summarize` failed (inline error + retry),
and a pivot with no `summarize` at all (no count, no narrowing — just a run button). A
re-summarize in flight must **dim the stale count, never blank it**.

Narrowing controls: `text`, `select`, `multiselect` (options may carry counts), `numberRange`,
`boolean`. **No regex widget here** — hard rule.

**Variants — show the same correlation flow in all three, then argue a winner:**
1. **Mode-rail tool panel** *(required)*. One tension this variant must answer
   honestly: tool panels are mode-scoped (Select/Create) and the library ships **no Enrich
   mode** (PRD §12) — so either the panel appears as a selection-scoped section under Select
   mode, or the library ships the panel *content* and a consumer's own rail mode mounts it.
   Pick one and show it.
2. **Popover anchored to the selection** (Maltego-style). Address: small canvases, zoom/pan
   while open, collision with the context menu.
3. **Selection-sidebar section** (a "Pivots" block). Address: distance from the node, what the
   sidebar shows for 50 selected nodes.

Also show the **context-menu entry** ("Pivot ▸ …") as a secondary entry point that routes into
whichever surface wins.

### 3.3 The triage pane (D5, D14, D17, D18, D24)

A dock tab holding the candidate table. `TableGrid` look: client-side filters over the **full**
facet vocabulary (regex allowed *here*), sort, virtualised paging.

- **Header line, always honest:** e.g. "210 fetched · 12 already on canvas (skipped) · 3
  rejected earlier this session". A dedup shrink is *by design*, never an error. **Explore**
  how "previously rejected are suppressed" reads without becoming noise.
- **Row lifecycle:** candidate → selected-for-ingest → rejected. **Explore** how a rejected row
  reads: struck in place, or moved into a collapsed "Rejected (12)" group. Rejection is a
  deliberate act — it must not look like mere deselection.
- **Actions:** Ingest selected (n) · Reject selected · **Reject all remaining** · plus
  select-all-matching-current-filter (which must be honest about what it matched).
- **Edge-only results (D24):** their own section or toggle with from/to/kind columns — never
  forced into the node table's columns.
- **Empty and error states:** all-deduped ("everything here is already on canvas"); zero
  results; failed `fetch` (retry); the **10,000-ceiling refusal** ("provider returned 14,203 —
  refused, nothing was staged"), which is a refusal, not a truncation.
- **Concurrency proposal (PRD §11.4):** design the recommended shape — one pane per pivot id,
  a re-run *replaces* that pivot's candidate set, panes for different pivots coexist as dock
  tabs (tab = pivot label + count). Show what a replacing re-run does to an in-progress triage.

### 3.4 Ingest, placement, undo (D13, D22, D25)

- Ingested nodes appear **around the origin node**, jittered; Phase B should actually place
  them so the settling reads correctly. Origin-less results land at the viewport centre.
- **Post-ingest toast:** "Ingested 12 nodes, 14 edges — **Undo**". Library gap to flag in the
  design: today's `Notifier` has levels but **no action button**; the prototype should assume
  (and thereby spec) a minimal toast-with-one-action extension.
- **Explore lightly:** where *redo* lives, given the Mainheader buttons stay unwired — e.g.
  the toast flipping to "Undone — Redo", or an action in the triage pane. Keep it small; undo
  is the headline, redo is a courtesy.
- **Auto-ingest pivots (D13):** no triage — menu action runs, results land, toast with Undo.
  The gate still applies: show an auto-ingest pivot being *refused* over cap.

### 3.5 Origin-less pivots — entry point proposal (PRD §11.1)

Search / import / staging pivots run with no selection and can't live in a selection-driven
menu. Candidates named by the PRD: a mainheader action, a dock-pane action, or a
consumer-filled slot. **Propose one, show it**, and route its results into the same triage
pane (landing at viewport centre). Keep it quiet — this is a secondary door, not a hero
feature.

### 3.6 Async honesty, everywhere

Every in-flight call is cancellable and every stale response is dropped: selection changes
mid-`summarize`, menu closes mid-`fetch` (decide and show: does the fetch complete into a
dock tab, or cancel?), narrowing changes mid-re-summarize. Nothing ever renders a count or a
row it can't stand behind.

## 4. Flows the Phase B prototype must walk

1. **Correlation narrowing, end to end:** select one node → open menu → ~2,143 vs cap 2,000 →
   refusal → tick *URLs* → re-summarize → 210, under cap → fetch → triage → filter → select
   12 → ingest → nodes land around origin → toast → **Undo** → **Redo**.
2. **Container auto-ingest:** select an event node → run → 12 objects land as its children → toast
   → undo.
3. **Bulk:** select 50 nodes → one aggregated summarize → the same narrowing flow.
4. **Origin-less:** run the search pivot with nothing selected → triage → ingest at centre.
5. **Rejection memory:** reject 5 → re-run the pivot → they are not re-offered, and the
   header says so.
6. **Failure modes:** a failing `fetch` (retry), and the >10k ceiling refusal.

## 5. Hard rules — no variant may violate these

- Candidates never appear on the canvas, in the data table, or in facet counts before ingest.
- Counts render as approximate (`~`); a shrink between advertised and ingestable is never an
  error.
- No regex widget in narrowing; regex allowed in the triage pane's own filters.
- Refusals (cap, ceiling) explain the number, the limit, and the way forward. Nothing
  truncates silently.
- Rejection is explicit; closing the pane rejects nothing.
- Rim badges show declared potential only — nothing on the rim changes because of a selection
  or an open menu.
- Selection alone triggers zero provider calls; only being in Pivot mode does (D26).
- The library ships a **Pivot rail mode** (D26, reversing this brief's original rule), and it is
  absent unless at least one pivot is registered. The Mainheader undo/redo buttons stay disabled.
- In `viewer` and `static` UI modes, all pivot chrome is absent.

## 6. Fake provider spec (Phase B)

Ship the prototype with an in-page fake provider — no network:

- **`correlation`** (triage): total ~2,143; facets `type: multiselect` {domain 1,800,
  url 210, paste 95, ip 38} + `seen: numberRange`; `maxCandidates: 2000`; latency 400–900 ms;
  narrowed counts derived from the facet data so the gate genuinely lifts.
- **`event-objects`** (autoIngest): applies to single event nodes, returns a container
  with 12 children.
- **`oversized`**: returns 14,203 candidates, to demonstrate the ceiling refusal.
- **`search-archive`** (origin-less): a query box, returns ~30 results.
- A **failure toggle** (next call rejects) and adjustable latency.
- A visible **provider call log** panel (call name, args, cancelled/served) — it is how the
  zero-calls-on-selection rule and cancellation are *demonstrated* rather than claimed.

The canvas in the prototype can be a simplified static SVG graph (a dozen nodes, one fat correlation
node, one container event) — embedding the real library is optional, not required.

## 7. Deliverables and review checklist

**Phase A — canvas artboards:** badge close-ups (states of §3.1); the three menu variants ×
the key states of §3.2 (loading, count+facets, refusal, fetching); triage pane in its main and
empty/error/ceiling states; the concurrency tab strip; toast/undo; the origin-less entry
proposal. Annotate each variant with trade-offs and end with a recommendation.

**Phase B — one HTML page:** the winning menu variant, live dock triage, fake canvas with
placement, light/dark toggle, provider call log, all six §4 flows walkable.

**Checklist before handing back:** every §5 hard rule demonstrably holds; every state in §3
reachable, not just drawn; both themes clean (including scrollbars on portaled surfaces); Esc
closes the menu; the three PRD walkthrough numbers (2,143 / 210 / 12) appear so the flows read
like the PRD.

## 8. Out of scope — do not design

Persistence / save-back UI; a general undo/redo history (and wiring the Mainheader buttons);
streaming or progress bars for partial results; cluster-merge internals; any change to existing
chrome beyond hosting these surfaces. *(An Enrich rail mode was listed here until D26 made the
Pivot mode the chosen surface.)*

## 9. Pointers

[`pivot-enrichment-interface.md`](pivot-enrichment-interface.md) (behaviour, §6 decisions, §8
walkthroughs) · [`pivot-enrichment-review.md`](pivot-enrichment-review.md) (why the decisions
look this way) · `src/ui/elements/` (ModeRail, ToolPanel, Sidebar, Dock, Table/TableGrid,
ContextMenu, Notifier) · `src/interfaces/RendererOptions.ts` (NodeBadge) ·
`src/interfaces/GraphQueryEngine.ts` (facet types) · `src/styles/` (tokens) ·
`src/ui/icons.ts` · `npm run dev` for the living chrome.
