# Feature — a pivot/enrichment interface: advertise, run, triage, ingest

**Status:** Proposed — scoped with Sami over two passes (2026-08-31, 2026-09-01), a sanity-check review pass (2026-09-01, findings in [`pivot-enrichment-review.md`](pivot-enrichment-review.md)), and a Phase A design pass (2026-09-01, [`pivot-enrichment-ui-states.md`](pivot-enrichment-ui-states.md) and the artboards beside it). Twenty-seven decisions are taken (§6): D1–D15 in the first pass; D16–D21 plus an **amended D7** in the second; **D22–D25** in the review pass, which also amended D1, D4, D7, D8, D11, D12, D14, D16, D17 and D20; **D26** in the design pass, which chose the surface and reversed the §12 line on rail modes; and **D27**, which closed §11.4's triage concurrency when M1 landed. **M1, M1b and M2 are built** (2026-09-01) — see §10, §14, §15 and §17. Only **M3** — the Pivot rail mode, the badges and the docs — is left; §18 says where it starts.
**Owner:** Sami Mokaddem
**Requested:** 2026-08-31
**Area:** greenfield `src/PivotManager.ts` + `src/interfaces/Pivot.ts`, with touch points in `src/Graph.ts` (ingest, provenance, `dataBatchChanged`), `src/Node.ts` / `src/Edge.ts` (source tags), `src/interfaces/InterractionCallbacks.ts` (`onBeforeIngest`), `src/interfaces/Plugin.ts` (`addPivot`), `src/ui/elements/Dock/` + a new `src/ui/elements/Pivot/` (the triage pane and the Pivot rail mode), `src/interfaces/RendererOptions.ts` (declared-potential badges). Adds **public types** and a **new public option group**.
**Type:** data-path capability + plugin API — a registry and an ingest pipeline, not a rewrite of anything.
**Related:** [`plugin-rail-modes.md`](plugin-rail-modes.md) (D26 ships a **built-in, gated Pivot mode** through that machinery, reversing this PRD's earlier "the consumer ships the mode" line — a consumer with no pivots registered still sees no mode at all), [`archive/table-mode.md`](archive/table-mode.md) + [`archive/dock-tabs.md`](archive/dock-tabs.md) (the dock and the tab registry this triage pane rides on), `misp/declarative-filter-facets.md` (the facet vocabulary reused for narrowing), `misp/write-path-lifecycle-hooks.md` and `edge-create-veto-hook.md` (the before-hook / narrowing idiom mirrored by `onBeforeIngest`), `misp/edge-layers.md` (the carrier for edge provenance), [`graph-app-b3-control-layout.md`](graph-app-b3-control-layout.md) (its §7 roadmap holds the *general* undo/redo engine this PRD deliberately does not build — D25 ships pivot-run undo only, and the Mainheader's disabled undo/redo buttons stay unwired).
**Supersedes:** `misp/async-children-provider.md` and `drag-in-node-staging.md`. Both attacked subsets of this problem — lazy cluster children, and a drag-in staging tray. Both stay **deferred**, and neither should be implemented ahead of this.

---

## 0. Instructions

The decisions in §6 were taken deliberately in discussion and should be treated as settled;
if the implementation makes one of them look wrong, **say so and stop** rather than quietly
choosing differently. Everything in §11 is genuinely open — ask before picking. Relentlessly
ask questions whenever you have a doubt about the contract.

## 1. Why

A graph tool backed by a real dataset is always a **seed plus what the analyst chose to open**.
Pivotick today assumes the opposite: whatever you want on screen must already be in the model.

Two consumers need the same thing and would otherwise each build it:

- **MISP** — correlations and object references are the pivot point of the whole tool. An
  analyst lands on an event and wants to walk outwards through correlated events, then into
  their objects and attributes.
- **AIL-Framework** — extensive correlation capability, and **a single node can carry 2000+
  connections**. Ingesting them all is not merely slow, it is *useless*: an analyst cannot read
  a 2000-neighbour hairball.

So the hard part of this feature is not fetching. It is **deciding what gets ingested**. Any
design that ends at `provider() -> merge()` has solved the easy half and made the hard half
impossible. Three separable concerns have to be served:

1. **Potential** — "this node has more out there", cheaply, without a fetch.
2. **Capability** — "these enrichments can be run on this node (or this selection)".
3. **Ingest** — "1,800 came back; what actually lands on the canvas?"

## 2. Vocabulary

Fixed, because four words were being used interchangeably during scoping and the API will mix
them otherwise:

| Term | Means |
|---|---|
| **pivot** | The gesture. One runnable enrichment, from the analyst's point of view. |
| **provider** | The consumer-supplied functions behind a pivot that talk to a backend. |
| **potential** | The advertised existence of more data, before any pivot has run. |
| **candidates** | Fetched results awaiting triage. **Not** in the graph. |
| **ingest** | Committing a chosen subset of candidates into the graph. |
| **provenance** | Which source(s) vouch for a node or edge now in the graph. |

Note the collision to avoid: `parent` is already taken. `LayoutOptions.parentKey`
(`src/interfaces/LayoutOptions.ts:41`) is **tree-layout only** and unrelated to clustering. Do
not reuse the word for containment.

## 3. What professional tools do

- **Maltego** — the closest prior art by a distance. *Transforms* are declared per entity type,
  run on a node **or a selection**, and are governed by an explicit result limit precisely
  because a transform can return more than a graph can show. The registry-plus-applicability
  shape in §7 is Maltego's.
- **Neo4j Bloom** and **Linkurious** — both treat expand as "fetch this node's neighbourhood
  from the server", and both put a **filter/limit step in front of the fetch** when a node has
  many neighbours, rather than merging and hoping. That step is this PRD's narrowing gate (D4).
- **vis-network clustering** and **Cytoscape's expand-collapse** — assume the data is already in
  the model. That is exactly where Pivotick sits today, and why neither is a useful model here.

The common thread worth copying: **the limit is part of the contract, not an afterthought**, and
results are staged before they are graph.

## 4. Gap in Pivotick today

The parts exist; the pipeline does not.

1. **No way to advertise potential.** The expand affordance renders only when
   `node.hasChildren()` is already true (`renderers/svg/NodeDrawer.ts`). A node that *has* more
   data elsewhere cannot say so.
2. **`onNodeExpansion` is dead.** Declared at `interfaces/InterractionCallbacks.ts:62`, no call
   site anywhere in `src/`, and its signature takes `edge: Edge` where a node is meant. It is not
   a foundation to build on — M1 deletes it (public API, so a changelog entry; also drop the
   commented reference in `src/main.ts:303`) rather than leave a second, broken pivot-shaped
   door beside the new one.
3. **Async stops at the UI boundary.** `AsyncSurface` is `'tooltip' | 'properties' | 'neighbors'
   | 'mainHeader' | 'extraPanel'` (`interfaces/AsyncContent.ts`). The pattern is right and
   already proven — it just never reaches graph *structure*.
4. **No candidate state.** A consumer's only options are "in the graph" or "hidden in the graph"
   (`queryEngine.excludeNode`). Neither is correct for 1,800 things the analyst has not yet
   agreed to. Hiding them still costs simulation, table rows and facet counts.
5. **No provenance.** Nothing records where a node or edge came from, so "undo that enrichment"
   is unexpressible.
6. **Every consumer reimplements the same glue.** Fetch, placeholder state, abort-on-navigate,
   dedup against what is already on canvas, and a bespoke results list.

## 5. What ships

- **A pivot registry** on `Graph` — declarative via options, imperative via `graph.pivots`, and
  plugin-facing via `PluginContext.addPivot`.
- **A two-call provider contract** — `summarize` then `fetch` (§7).
- **A candidate model** that is not the graph, session-scoped, with remembered rejections.
- **A triage pane in the dock** — the candidate table (node rows, and edge-only results as
  their own rows — D24), with facets, selection and an ingest action.
- **An ingest pipeline** — dedup (D23), children union by id, origin-seeded placement (D22),
  provenance tagging, one `onBeforeIngest` gate, clean `dataBatchChanged` emission. Purely
  additive: removal happens only through provenance — `removeBySource` and run undo (D25).
- **A provenance API** — source tags on nodes and edges backed by run-scoped records (D16),
  `removeBySource`, and pivot-run undo/redo (D25).
- **Declared-potential badges** on the node rim, plus a **gated Pivot rail mode** (D26) holding
  the pivot list, the origin and its narrowing.
- **Origin-less pivots** — search, import and staging, through the same pipeline, reached from
  Pivot mode's empty origin.
- Docs + one gallery card.

## 6. Decisions taken

**D1 — Two calls, not three. `summarize` *is* the potential query.** *(amended in the review pass)*
`summarize(nodes, narrowing, ctx)` returns counts and facets; `fetch(nodes, narrowing, ctx)`
returns the data. There is no separate "list potential" call: opening the pivot menu runs
`summarize` (D11), and that is what fills it. One concept, two functions, one signature shape.
The review gave `summarize` the same `narrowing` argument as `fetch` — called with `{}` before
any narrowing exists, re-run (debounced, cancellable) as the analyst narrows — because without
it D4's gate can never see a narrowed count and a refusal could never lift. Providers may
ignore the argument. (Also renamed from `summarise`: the public surface is American-spelled —
`normalizeNode`, `ColorPaletteMapper` — and one British hold-out would be misremembered
forever.)

**D2 — Array-shaped signatures from day one.**
Both calls take `Node[]`; a single-node pivot is `[node]`. Bulk pivot on a selection is
*essential*, not a later phase, and MISP/AIL must be able to serve it as **one** backend request
rather than fifty. Array-first also means bulk is not a breaking v2.

**D3 — Narrowing replaces streaming. No streaming, no server cursor in v1.**
The constraint is **backend** capability, not client support: MISP is AJAX-only, AIL may have
websocket/event-stream. So the contract must never *require* progressive delivery. With
`summarize` in front you never fetch 2000 — the analyst narrows to ~40 and one ordinary request
serves it. Secondary reason streaming is wrong here anyway: a partially-arrived candidate set
cannot be triaged honestly (facet counts jump, "select all matching" lies).

**D4 — The cap sits at the narrowing gate, driven by `summarize`'s count.** *(amended in the review pass)*
This is the quiet win of two-phase: you know it is 300,000 *before* asking for it. Above
`maxCandidates` the UI refuses to fetch and says "narrow further" — no truncation, no silent
sampling, no set that claims to be complete and isn't. "Narrow further" only works if narrowing
can change the number the gate sees: client-side arithmetic over facet option counts covers
exactly one `multiselect` facet and nothing else (combine two facets, or narrow by `text` or
`numberRange`, and there is nothing to sum) — so the gate **re-runs `summarize` with the
current narrowing** and acts on the freshest advisory count. Because counts are advisory (D10)
the gate is advisory too, so a **defensive ceiling** on what `fetch` actually returns is still
required for a provider that ignores it.

**D5 — Filters and paging in the triage pane are client-side presentation only.**
The analyst can explore the fetched candidate set with filters, sorting and pages, but that is
the table's own behaviour over data already in hand. None of it appears in the provider
contract. Server-side cursor paging is a v2 escape hatch (§11).

**D6 — The library ships the triage table; plugins only define pivots.**
A filterable table of candidates is entirely domain-agnostic — identical for MISP and AIL — so
shipping it once is right, and it reuses the dock, `DockTab` and the facet machinery already
built. This is consistent with, not contrary to, `plugin-rail-modes.md`: the *domain* knowledge
(what a pivot is, what it returns) stays with the consumer; the generic surface does not.

**D7 — Flat fragments and no re-parenting, but children union by id.** *(amended in pass 2 and the review pass)*
A returned node **never** names an existing on-canvas parent: there is no `containedBy` field and
no arbitrary re-parenting. MISP's collapsed-event case needs no new mechanism at all — the
container arrives as a **new** node, and `RawNode.children?: RawNode[]`
(`interfaces/GraphOptions.ts:73`) already nests.

What *is* supported: when a returned node's **id matches a node already on canvas** and it
carries `children`, those children are **merged into the existing node by id** — new ones added,
matching ones **left untouched**, none removed. (The review pass changed "matching ones updated"
to align with D23: an id collision is handled the same way at every level — pivots discover
*structure*; refreshing stale attributes is the deferred persistence PRD's business.) The union
**recurses** — MISP nests event → objects → attributes — and union-added children **carry the
source tag**, so `removeBySource` and run undo reach into containers and remove a child only its
own sources vouch for. This is what makes re-pivoting a container work, and it fixes the
invariant for the whole feature: **ingest is purely additive; removal happens only through
provenance — `removeBySource` and run undo (D25).** It also keeps D8 intact, since a merge can
never delete a child another source vouches for.

The cost is real and accepted deliberately. `setChildren` (`Node.ts:444`) is the only
child-mutation entry point today — a wholesale replace, called from the constructor — so a union
API has to be added. An **expanded** container is the awkward case: it runs a separate `Graph`
subgraph (`ClusterDrawer.ts:129`) with its own re-anchored edges (`setSubgraphFromNode` /
`setSubgraphToNode`) and a radius that recurses up through `parentNode`
(`updateToNewRadiusExpanded`, `ClusterDrawer.ts:522`).

**Implement it as cheaply as possible.** Reuse the existing expand path to rebuild the subgraph
wholesale rather than writing incremental live-subgraph insertion, accept that inner positions
reset on that rebuild, and add **no new abstraction** to `ClusterDrawer`. The whole
cluster/children/subgraph area is due a heavy refactor with improvements of its own; that
refactor, not this PRD, is where the good version of this belongs. Anything more elaborate here
would be written to be thrown away.

**D8 — Provenance is a *set* of source tags, on nodes **and** edges, seed included.**
A scalar `source` breaks the moment two pivots overlap — guaranteed with AIL correlations. Node
X can arrive from pivot A, then pivot B, and have been in the seed all along. Treating the seed
as just another source (`'seed'`) makes removal one uniform rule: **drop the tag; delete only if
the set is now empty.** Edge provenance is the load-bearing half (which pivot asserted this
relationship). It *can* ride `edgeTypeAccessor` / edge layers for styling and toggling — but as
an opt-in pattern, honestly stated: the accessor maps an edge to **one** kind, provenance is a
set, and a consumer may already key layers on domain relationship types, so provenance styling
means dedicating the accessor to it and picking a primary source.

**D9 — No per-item veto hooks. One batch-shaped `onBeforeIngest`.**
1,800 `onBeforeEdgeCreate` calls is absurd, and the existing write-path hooks are semantically
about **user gestures** — exempting a programmatic merge is principled, not a shortcut. But "no
veto at all" would leave auto-ingest (D13) ungoverned, so exactly one gate exists, called
**once** with the whole candidate set, using the same narrowing idiom as `DeleteDecision`
(`InterractionCallbacks.ts:481`).

**D10 — Counts are advisory, never a contract.**
They diverge legitimately, and the first case is the common one: **dedup** (40 correlations, 12
already on canvas — the advertised and the ingestable count differ *by design*), then
permissions, staleness, and deliberate approximation ("2000+"). A shrink must never surface as an
error, and a count must never be load-bearing for layout or capacity.

**D11 — Potential is declarative; a provider is called only on user intent.** *(amended in the review pass; the trigger named again by D26)*
The library **never** speculatively calls a provider on load — that is precisely the
N-requests-per-visible-node cost `async-children-provider.md` complained about. The first pass
said *selection* counts as intent; the review moved the trigger one notch later, because
selection is also the gesture for dragging, styling and bulk edit — box-selecting fifty nodes
to *move* them must not fire every pivot's count query. So: **opening the pivot menu counts as
intent.** `summarize` runs when the menu is first opened for a selection, and — while the menu
stays open — **re-runs when the selection changes** (and when the narrowing changes, D4). Still
batched into one request for a multi-selection, debounced, cached (D20), and cancelled through
the existing `signal` / `isStale()` pattern when superseded. A closed menu costs zero backend
calls whatever the selection does; prefetch-on-selection can return later as an opt-in knob if
menu latency proves annoying — the reverse migration would be much harder.

**D26 names that trigger concretely: it is Pivot mode's `onEnter` / `onExit`.** Read "opening the
menu" here, and everywhere below, as "entering Pivot mode", and "the selection" as "the origin"
— the node set the mode's own tools built. The rule is unchanged; the mode simply gives it a
boundary the user can see, instead of one the UI has to enforce.

**D12 — Rim badges show *declared* potential only.**
Queried counts (D11) appear in the pivot menu, not on the rim. Otherwise a count materialises on
one node the moment it is selected and the canvas looks inconsistent. One honest limit: a node
with children has only **two** free rim corners (the expand affordance reserves the East side —
`RendererOptions.ts` badges doc), so several declared-potential badges collapse into `+n` early,
on exactly the container nodes MISP cares about. Acceptable — the menu is the full surface, the
rim is a hint.

**D13 — Auto-ingest is provider-declared.**
Each pivot says whether its results land directly or open triage — MISP's expand-an-event
auto-ingests 12 objects; AIL's correlations always triage. No library threshold: a magic number
would surprise someone, and the provider genuinely knows.

**D14 — Rejections are explicit, remembered for the session, keyed per pivot.** *(amended in the review pass)*
A rejection is a row the analyst **explicitly rejected** — nothing implicit. If "everything not
ingested when the pane closes" counted, ingesting today's 12 URLs would silently bury the
domains the analyst simply didn't get to; instead, un-triaged leftovers are re-offered, and the
pane ships a **"reject all remaining"** affordance so triaging 1,800 down to 12 and dismissing
the rest is still one gesture. The key is **(pivotId, candidate id)**: rejecting a candidate
offered by one pivot does not hide it from a different pivot, which offers it in a different
analytic context. Persisting rejections across reloads belongs to the deferred persistence PRD
(§12), so v1 keeps the set in memory but shapes it so a consumer read/write hook can be added
without a breaking change.

**D15 — The registry lives on `Graph`, not `UIManager`.**
Pivots produce *data*; the triage pane is a UI element that reads them. There is also a hard
ordering constraint: `Graph`'s constructor runs `new UIManager(...)`, whose constructor calls
`setup()` → `build()`, so `graph.UIManager` is still `undefined` while UI components are being
built. Anything a component needs at build time must already exist on `Graph` — the mirror image
of the lesson `write-path-lifecycle-hooks.md` learned.

---

The six below came out of the second scoping pass, which closed the first pass's open questions.

**D16 — Provenance is `string[]` publicly; timestamped, run-scoped records internally.** *(amended in the review pass)*
The tension between "a timestamp is cheap now and awkward later" and "a set of strings is
simpler" dissolves by separating storage from surface: keep internal records per node and edge —
`Map<string, Array<{ runId: string, at: number }>>`, one entry per run that vouched — and expose
`getSources(): string[]`. Two runs of the same pivot **must be distinguishable** (Sami, review
pass): with the pivot-id tag alone, "undo that enrichment" silently means "undo that enrichment
*type*", and D25's run-level undo is built on exactly these records. The timestamp exists for
the deferred persistence PRD and for "what did this pivot add, and when", without a public
commitment. Exposing records later (`getSourceRecords()`) is purely additive.

**D17 — No default cap, plus an absolute safety ceiling.**
`maxCandidates` applies only when a pivot declares it — a library default would be wrong for
somebody, exactly as D13 argues. Separately, an absolute ceiling of **10,000 candidates**
(overridable through options) **refuses** an oversized payload rather than truncating it, which
keeps D4's no-silent-sampling rule intact. The triage table is not the constraint here:
`TableGrid` already virtualises above 200 rows (`virtualizeAbove`,
`src/ui/elements/Table/TableGrid.ts:98`), so the ceiling is about memory for candidate objects,
not DOM.

**D18 — Narrowing uses every facet type except `regex`.**
So `text`, `select`, `multiselect`, `numberRange`, `boolean` — all things a backend can
realistically serve. `regex` is excluded because narrowing is **server-bound** and most backends
cannot evaluate it safely. The triage pane's own filters are client-side (D5) and keep the
**full** `FilterFacetType` vocabulary, `regex` included. Two audiences, two vocabularies, one
type to derive both from — concretely `NarrowingFacetType = Exclude<FilterFacetType, 'regex'>`
(§7), so the type system enforces this instead of a code review.

**D19 — Origin-less pivots, and no separate `offer()` door.**
A pivot may declare that it needs no selection. This was reached by rejecting a second ingestion
door: a consumer who already holds data *and* has an origin node can express it as a trivial
pivot (`fetch: () => dataIAlreadyHave`), so "the data came from somewhere else" was never the
real gap — **"there is no node to run this on"** was. Search-driven staging, pasting or importing
a list, and the superseded drag-in tray are all the *same* gap, and all three become ordinary
pivots with one registry, one triage pane, one provenance model and one gate. The cost is a
surface, not an API: an origin-less pivot cannot live in the selection-driven menu (D11) and
needs an entry point elsewhere (§11.1). `appliesTo` is meaningless for one and is not consulted.

**D20 — The consumer owns caching, auth, retry and rate limiting.**
Providers are plain functions the consumer writes, so they can wrap `fetch` however they like;
anything the library added would only be in the way. This closes the scope boundary deferred
during the first pass. One honest exception: the library *does* cache `summarize` results (D11)
— keyed by **(pivot id, the sorted id set of the nodes asked about, the narrowing)**, because a
multi-selection summary is an aggregate nothing can decompose into per-node entries. That is UI
state rather than data policy, but a cache without invalidation is a bug, so
`graph.pivots.invalidate(pivotId?, nodes?)` exists and drops every entry whose id set intersects
`nodes`. Entries are dropped automatically when a node is removed; otherwise invalidation is
explicit, because only the consumer knows when their backend changed.

**D21 — What would actually justify v2 cursor paging.**
Not "narrowing cannot get small enough" — facets are exactly what these backends index on, so
that is unlikely. The realistic failure is **a consumer with no cheap count endpoint** *and*
large result sets: with no `summarize`, narrowing is blind and D4's gate simply blocks them.
That pairing, not narrowing's inadequacy, is the signal to revisit D3 and D5.

---

The four below came out of the review pass (2026-09-01,
[`pivot-enrichment-review.md`](pivot-enrichment-review.md)), which verified every codebase claim,
amended the decisions marked above, and closed four gaps the first two passes never covered.

**D22 — Ingest seeds unpositioned nodes near their origin.**
`addNode` seeds nothing today — only caller-supplied `x/y` is honoured — so 200 ingested nodes
would materialise wherever the simulation throws them, with no visual connection to the node the
analyst pivoted on. Ingest therefore seeds candidates that carry no position **around the origin
node(s)**, jittered so the simulation can fan them out; provider-supplied `x/y` still wins;
origin-less pivots (D19) seed at the viewport centre. This is pipeline behaviour, not UI — it
lands in M1.

**D23 — Dedup skips: an id-matched candidate leaves the existing node untouched.**
Candidate data never overwrites on-canvas data — not the node's `data`, not its style, nothing.
Children union (D7) is the *only* way ingest touches an existing node, and after the review pass
even the union adds without updating. This keeps "purely additive" sharp and dedup trivially
explainable: already there means already there. Refreshing stale attributes is a data-sync
concern that belongs to the deferred persistence PRD.

**D24 — Hybrid edge triage.**
Candidate edges ride along with their endpoint nodes — an edge lands iff both its endpoints end
up on canvas, and it is not itself a triage row. **Except** edges whose endpoints are *all
already on canvas*: a pivot returning correlations *between* nodes already on screen is a core
AIL case, and with follow-the-nodes semantics alone it would produce an empty triage table and
silently auto-land its edges, violating the staging principle. Such edge-only results get their
own triage rows (M2 note: a separate section or toggle in the pane, not edge rows forced into
the node table's columns).

**D25 — Pivot-scoped undo/redo; no general history engine.**
Every run gets a `runId` (D16), and `graph.pivots.undo(runId?)` / `redo()` operate on whole
runs. Undo drops the run's vouching from everything it touched — nodes, edges, union-added
children — and deletes whatever empties, the same uniform rule as `removeBySource`; a node
another source vouches for survives, one record lighter. Redo re-lands the recorded delta
exactly: no refetch, no re-gating (it already passed once). The stack is session-scoped and
holds only pivot runs. Deliberately **not** built: the general command/history stack from
`graph-app-b3-control-layout.md` §7 — Sami's call is that undo on plain data modification will
likely never be needed, and the operations that might want operation-level undo later
(workspace switching, graph coarsening/reduction) do not exist yet. The Mainheader's disabled
undo/redo buttons stay unwired; the surfaces are the API plus a post-ingest notifier action
("Ingested 12 — Undo").

---

The one below came out of the Phase A design pass (2026-09-01,
[`pivot-enrichment-ui-states.md`](pivot-enrichment-ui-states.md) and the artboards beside it),
which chose the surface after three earlier placements were drawn and rejected.

**D26 — the library ships a Pivot rail mode, and it is absent unless a pivot exists.**
*(reverses the §12 line below, Sami's call)*
The first pass said the consumer builds their own Enrich mode. Three placements were drawn against
the real chrome before this was reversed: a section inside the Select tool panel (mode-scoped, so
switching to Create to draw one edge discards a narrowing session), a popover on the selection
(overlaps the dock by 168px at an ordinary anchor, no honest anchor for fifty nodes), and a tab in
the selection sidebar — killed by measurement, since property rows are 61px and the sidebar scrolls
as one column, putting the tab below the fold at **thirteen** properties, on exactly the
attribute-heavy nodes MISP produces.

Pivot is therefore a **`kind: 'pointer'` rail mode**, not a flyout: only a pointer mode gets
`tools` as a function re-read per render (the pivot list follows the origin), a `render()` slot for
the narrowing controls, and `onEnter`/`onExit`. That last pair is the reason this is the right
surface rather than merely an available one — **entering the mode is the intent that starts
`summarize` and leaving it is what stops every call**, so D11 becomes a property of the mode
instead of a rule to police. The mode's own tools (*Pick origin*, *Lasso origin*) make the bulk
flow first-class, and its *origin* — which may legitimately be empty — is where origin-less pivots
(D19) live, so they need no second door.

**Gating, which is what keeps §12's intent alive:** `UI.pivotMode?: boolean | 'auto'`, default
`'auto'` — the rail button exists only while at least one pivot is registered, appearing when the
first arrives and going when the last leaves. `true` forces it (for a consumer whose pivots
register asynchronously), `false` never. A consumer who registers no pivots therefore sees exactly
what §12 promised: nothing. Registration through the constructor (`new Graph(el, data, { pivots })`)
lands before `new UIManager(...)` runs, so the initial state is correct without a special case —
that is D15's ordering constraint paying for itself. In `viewer` and `static` modes the mode is
never registered at all.

---

The one below was taken when M1 landed and M2 was scoped (2026-09-01, Sami's call), closing
§11.4.

**D27 — one triage pane per pivot id.**
A re-run **replaces** that pivot's candidate set; panes for different pivots **coexist** as dock
tabs. This is the shape the review pass recommended and the Phase B prototype demonstrated, and
the runtime already enforces it: `PivotManager` holds at most one `PivotCandidateSet` per pivot
id, so "stack or replace" was never a UI choice to make later.

What it commits M2 to: a re-run while rows are marked is a visible event, not a silent swap (the
prototype announced it in the pane rather than discarding the analyst's marks unasked); closing a
pane calls `discard`, which rejects nothing; and a pivot's tab carries its own label and count,
which needs `DockTabHandle.setLabel` (§10's M3 note) or a count in the pane header instead.

## 7. The shape of the door

```ts
/** One runnable enrichment. */
export interface PivotDefinition {
    /** Stable identity: what the menu keys on, and the provenance tag written on ingest. */
    id: string
    /** Menu label, used verbatim (so it can be translated). */
    label: string
    /** SVG string, injected with innerHTML and not sanitised — it must be trusted. */
    icon?: string
    /**
     * What this pivot runs on (D19). `'selection'` pivots appear in the selection-driven
     * menu; `'none'` pivots need no nodes at all — search, import, a staging tray — and get
     * an entry point elsewhere, receiving `[]` as their nodes.
     * @default 'selection'
     */
    origin?: 'selection' | 'none'
    /**
     * Whether this pivot applies to the current selection. Re-read on every selection
     * change. Omit it and the pivot applies to everything. Not consulted at all when
     * `origin` is `'none'`.
     */
    appliesTo?: (nodes: Node[]) => boolean
    /**
     * Cheap "what's out there". Runs when the pivot menu opens, re-runs while it stays open
     * as the selection or the narrowing changes (D11, D4), and fills the menu; its facets
     * become the narrowing controls. Called with `{}` before any narrowing exists; ignoring
     * the argument is legal. Omit the whole function and the pivot offers no narrowing and
     * no advertised count — also legal, but then `fetch` must be safe to call blind.
     */
    summarize?: (nodes: Node[], narrowing: PivotNarrowing, ctx: PivotContext) => PivotSummary | Promise<PivotSummary>
    /** The real fetch, narrowed by what the analyst chose. */
    fetch: (nodes: Node[], narrowing: PivotNarrowing, ctx: PivotContext) => PivotResult | Promise<PivotResult>
    /** Land results directly instead of opening triage (D13). @default false */
    autoIngest?: boolean
    /** Refuse to fetch when the advertised count exceeds this (D4). */
    maxCandidates?: number
}

/** What `summarize` advertises. Every count here is advisory (D10). */
export interface PivotSummary {
    /** Advisory total. Render it as approximate. */
    total: number
    /** Optional breakdown; each entry becomes one narrowing control. */
    facets?: PivotFacet[]
}

/** Narrowing is server-bound, so `regex` is out (D18); triage's own client-side filters keep it. */
export type NarrowingFacetType = Exclude<FilterFacetType, 'regex'>

/** A narrowing control, reusing the query engine's facet vocabulary. */
export interface PivotFacet {
    key: string
    label: string
    type: NarrowingFacetType
    options?: Array<{ label: string, value: string, count?: number }>
}

/** The analyst's narrowing choices, keyed by facet key. */
export type PivotNarrowing = Record<string, unknown>

/**
 * A flat graph fragment (D7) — no returned node names an existing parent. Edges-only sets are
 * legal (D24). M1 makes `RawNode.expanded` optional (default `false`) so flat results carry no
 * boilerplate.
 */
export interface PivotResult {
    nodes: RawNode[]
    edges: RawEdge[]
}

/** Mirrors RenderContext, so cancellation works the way it already does elsewhere. */
export interface PivotContext extends RenderContext {
    graph: Graph
    /** Which pivot is running. */
    pivotId: string
}

/** What `graph.pivots.run` resolves with — at the hand-off, never waiting on the analyst. */
export interface PivotRunOutcome {
    /** 'ingested' auto-ingest landed; 'staged' triage opened; 'refused' the D4/D17 gates; 'vetoed' `onBeforeIngest`. */
    status: 'ingested' | 'staged' | 'refused' | 'vetoed'
    /** This run's identity in the provenance records — the handle for `undo` (D16, D25). */
    runId: string
    /** What landed. Empty unless 'ingested'; a staged run's later ingest announces itself via `dataBatchChanged` under the same runId. */
    nodes: Node[]
    edges: Edge[]
    /** Candidates dropped because they were already on canvas (D23). */
    deduped: number
}
```

**The one gate** (`InterractionCallbacks`), shaped like `DeleteDecision`:

```ts
onBeforeIngest?: (context: IngestContext) => IngestDecision | Promise<IngestDecision>

export interface IngestContext {
    pivotId: string
    /** The nodes the pivot was run on. */
    origin: Node[]
    /** What is about to land, after dedup. */
    candidates: PivotResult
    /** 'triage' when the analyst picked, 'auto' when the pivot auto-ingested (D13). */
    trigger: 'triage' | 'auto'
    /** The shared modal primitive the write-path hooks already use. */
    confirm(options: ConfirmOptions): Promise<boolean>
}

/** An omitted key means "as requested", exactly as DeleteDecision reads. */
export type IngestDecision =
    | boolean
    | {
        accept: boolean
        nodes?: RawNode[]
        edges?: RawEdge[]
    }
```

**Registry and provenance:**

```ts
// Registration — three doors, one registry (D15)
new Graph(el, data, { pivots: [correlationPivot] })
graph.pivots.register(def)                  // returns a disposer
graph.pivots.unregister(id)
graph.pivots.for(nodes)                     // what applies to this selection
ctx.addPivot(def)                           // PluginContext, mirrors addPanel / addDockTab

// Running one
await graph.pivots.run(id, nodes)           // gate -> triage or auto-ingest; resolves PivotRunOutcome
await graph.pivots.run(id)                  // an origin: 'none' pivot (D19)

// Dropping the summarize cache (D20) — all, per-pivot, or per-node
graph.pivots.invalidate(pivotId?: string, nodes?: Node[])

// Provenance (D8) — string[] publicly, run-scoped timestamped records internally (D16)
node.getSources(): string[]                 // e.g. ['seed', 'misp-correlation']
node.hasSource(source: string): boolean
edge.getSources(): string[]
graph.removeBySource(source: string)        // drop tag; delete only when the set empties

// Pivot-run undo/redo (D25) — whole runs, LIFO; default is the most recent run
graph.pivots.undo(runId?: string)
graph.pivots.redo()

// Declared potential (D11 / D12) — count 0 clears the badge
node.setPotential(pivotId: string, count: number)
node.getPotential(pivotId: string): number | undefined
```

## 8. What the consumer does

**AIL — a correlation pivot on a 2000-connection node.** Narrowing is the whole point:

```ts
const correlations: PivotDefinition = {
    id: 'ail-correlation',
    label: 'Correlations',
    appliesTo: nodes => nodes.every(n => n.getData()?.type !== 'note'),
    summarize: async (nodes, narrowing, { signal }) => {
        const res = await fetch('/api/correlation/count', {
            method: 'POST',
            // narrowing included so the count tracks it and the D4 gate can lift
            body: JSON.stringify({ ids: nodes.map(n => n.id), types: narrowing.type }),
            signal,
        })
        const { total, byType } = await res.json()
        return {
            total,
            facets: [{
                key: 'type',
                label: 'Type',
                type: 'multiselect',
                options: byType.map(t => ({ label: t.name, value: t.name, count: t.count })),
            }],
        }
    },
    fetch: async (nodes, narrowing, { signal }) => {
        const res = await fetch('/api/correlation/expand', {
            method: 'POST',
            body: JSON.stringify({ ids: nodes.map(n => n.id), types: narrowing.type }),
            signal,
        })
        return await res.json()                   // { nodes, edges }
    },
    maxCandidates: 2000,
}
```

An analyst selects the node, opens the pivot menu, sees **"~2,143 correlations — 1,800 domains,
210 URLs, 95 pastes"** without a single node being created, ticks *URLs*, fetches 210, filters
them down in the dock, and ingests 12 — which appear around the node they pivoted from (D22).
Nothing else ever enters the graph.

**MISP — expanding a correlated event, auto-ingesting because the result is small.** The
container is a new node carrying its own children (D7):

```ts
const expandEvent: PivotDefinition = {
    id: 'misp-event-objects',
    label: 'Objects & attributes',
    appliesTo: nodes => nodes.length === 1 && nodes[0].getData()?.type === 'event',
    fetch: async ([node], _narrowing, { signal }) => {
        const res = await fetch(`/graph/expand?uuid=${node.getData().uuid}`, { signal })
        const { objects, references } = await res.json()
        return {
            nodes: [{ id: node.getData().uuid, children: objects, expanded: false }],
            edges: references,
        }
    },
    autoIngest: true,
}
```

**Undoing an enrichment**, which is what provenance buys — by pivot, or by run (D25):

```ts
graph.removeBySource('ail-correlation')   // every run of that pivot; other vouchers survive
graph.pivots.undo()                       // just the last run
graph.pivots.redo()                       // changed your mind — lands identically, no refetch
```

## 9. Why this is cheap — what already holds

Most of this is assembly, not invention:

| Need | Already there |
|---|---|
| Cancellation, staleness, placeholders | `RenderContext.signal` / `isStale()`, `AsyncContentOptions` (`interfaces/AsyncContent.ts`) |
| The triage surface | the dock + `DockTab` + `DockTabHandle.refresh()`, with the table's typed filters |
| Narrowing controls | `FilterFacetType` and the declared-facet form machinery |
| Before-hook idiom, narrowing decisions, `ctx.confirm` | the write-path hooks and `editing/PromptModal.ts` |
| Edge provenance styling and toggling | `edgeTypeAccessor` + edge layers |
| Rim affordances for declared potential | `NodeBadge` + the `badges` accessor (`interfaces/RendererOptions.ts:438`) |
| Plugin registration pattern | `PluginContext.addPanel` / `addDockTab` / `addRailMode` |
| Batch change announcement | `dataBatchChanged` |
| Post-ingest undo affordance | `ui/Notifier.ts` |

Genuinely new: the registry, the candidate model, the ingest pipeline (with origin-seeded
placement), provenance tags with their run records, pivot-run undo/redo, and the triage pane.

## 10. Work plan

**M1 — contract and pipeline, no new UI. DONE (2026-09-01).** `interfaces/Pivot.ts`, `PivotManager` on `Graph`,
`summarize` / `fetch` invocation with cancellation, the summarize cache and `invalidate` (D20),
dedup (D23), origin-seeded placement (D22), the narrowing gate and safety ceiling (D4, D17),
provenance run records with `removeBySource` and run undo/redo (D8, D16, D25), `onBeforeIngest`,
`dataBatchChanged` emission, `PivotRunOutcome`. Housekeeping that belongs here: make
`RawNode.expanded` optional (defaulting `false`) and delete the dead `onNodeExpansion` callback
(§4). Drivable entirely from the console and testable without a pane — a pivot with
`autoIngest: true` is end-to-end here.

**M1b — children union by id** (D7, amended). **DONE (2026-09-01).** The new child-mutation API beside `setChildren`,
plus the collapsed and expanded merge paths. Kept as its own slice because it is the one part
that reaches into the cluster subsystem, and because it is deliberately the *cheap* version:
reuse the existing expand path, no new `ClusterDrawer` abstraction. Sequence it after M1 so the
pipeline is proven before touching clusters at all.

**M2 — the triage pane. DONE (2026-09-01).** A dock tab holding the candidate table: facets from `PivotSummary`,
client-side filter / sort / page over the full facet vocabulary (D5, D18), row selection,
edge-only rows in their own section (D24), the ingest action, explicit rejection with "reject
all remaining" (D14), the post-ingest undo affordance (D25), and honest empty and error states —
a failed `fetch` included.

**M3 — surfaces and docs. DONE (2026-09-01).** The **Pivot rail mode** (D26): a `kind: 'pointer'` mode gated on
`UI.pivotMode`, its *Pick origin* / *Lasso origin* tools, the origin display, and the pivot list
with narrowing in its `render()` slot. `onEnter` triggers `summarize`, re-run live as the origin
or the narrowing changes while the mode is active (D11), with an honest error state for a failed
`summarize`. Origin-less pivots reached from an empty origin (D19, §11.1); declared-potential
badges (D12); a context-menu entry routing into the mode; `addPivot` on `PluginContext`; a failed
`autoIngest` fetch reporting through the notifier; a docs page; and one gallery card (a fake
provider with a deliberately large candidate set, so the card demonstrates narrowing rather than
merging).

Two small library changes this milestone depends on, both flagged by the Phase A pass: a
**per-mode tool-panel width** (it is a fixed 216px today and Pivot mode wants 300px), and an
**actionable notification** — an action, a longer lifetime, hover-pause, dismiss and a returned
handle — without which the post-ingest undo of D25 has nowhere to live for `autoIngest` pivots.
The notification **was built in M2** (§17.1), along with `DockTabHandle.setLabel`; the tool-panel
width landed in M3, along with three other rail-mode changes it turned out to need (§19.2).

## 11. Open questions

The first pass's seven questions are all closed (D7 amended, D16–D21), and the review pass's
findings are folded in (D22–D25 plus the amendments marked in §6). What remains is smaller;
§19.6 records where each landed once M3 was built:

1. ~~**The entry point for origin-less pivots (D19).**~~ **Closed in M3**: an empty origin is
   where they live (C14), and once one is picked they fold into a *Without an origin (n)* group
   at the foot of the panel. No second door, exactly as D19 argued.
2. **Inner positions reset when an expanded container's subgraph is rebuilt (D7).** Accepted as
   the cost of the cheap implementation. Whether it is *tolerable in practice* is unknown until
   an analyst re-pivots an expanded event; revisit with the cluster/children/subgraph refactor
   rather than pre-emptively here.
3. **The 10,000 safety ceiling (D17) is a proposal, not a measurement.** Confirm it against a
   real AIL payload; it is a knob, so being wrong is cheap. **Still not measured** — M2 shipped
   without it, since nothing in the pane depends on where the number sits, only on the refusal
   being honest when it is hit (T5, covered).
4. ~~**Triage concurrency (from the review pass).**~~ **Closed by D27**: one pane per pivot id —
   a re-run replaces that pivot's candidate set, and panes for different pivots coexist as dock
   tabs.

## 12. Not in scope

- **Persisting or saving an ingested pivot result** back to the source system. Its own PRD, and
  **rejection persistence (D14) belongs with it**, since "reviewed and rejected" is exactly what a
  user expects to survive a reload. **Written 2026-09-01** as
  [`pivot-persistence.md`](pivot-persistence.md): `save` / `autoSave` on `PivotDefinition`, a
  per-element save ledger with partial failure and retry, canonical-id aliases so a saved node is
  not re-offered as a duplicate, and remembered rejections in `localStorage`. It also re-parks the
  stale-attribute refresh that D7 and D23 both deferred *to* it — that needs an attribute merge
  policy first — and rules on the collision with the workspaces effort's unwritten PRD C.
- **Re-parenting of any kind** — no `containedBy` field, no moving an existing node into a
  different container. Children union by id (D7) is the *only* way ingest touches an existing
  node's children.
- **A good cluster merge.** The expanded-container path is deliberately the cheap one (D7);
  incremental live-subgraph insertion, position preservation and a proper radius update belong to
  the coming cluster/children/subgraph refactor.
- **A second ingestion door.** `pivots.offer()` was considered and rejected in favour of
  origin-less pivots (D19) — one pipeline, not two.
- **Streaming or server-cursor providers** (D3, D5, D21).
- **A general undo/redo history engine.** `graph-app-b3-control-layout.md` §7 keeps that
  roadmap; D25 ships run-scoped undo for pivots only. Sami's call: undo on plain data
  modification will likely never be needed, and the operations that might justify
  operation-level undo later (workspace switching, graph coarsening/reduction) don't exist
  yet. The Mainheader's disabled undo/redo buttons stay unwired.
- ~~**Shipping an Enrich rail mode.** This PRD gives such a mode its vocabulary; the consumer ships
  the mode, per `plugin-rail-modes.md`.~~ **Reversed by D26**: the library ships a Pivot rail mode,
  gated so that it does not exist for a consumer with no pivots registered.
- **Lazy cluster children** (`misp/async-children-provider.md`) and the **drag-in staging tray**
  (`drag-in-node-staging.md`) — superseded, and not to be revived ahead of this.
- Any query language of our own.

## 13. Tests and docs

Visual specs under `tests/visual/`, driven by a **fake provider in the harness** (resolve,
reject, abort, and a deliberately large candidate set) so nothing depends on a network:

- Selection alone fires **zero** provider calls; `summarize` runs on first menu open, once,
  batched for a multi-selection; re-runs when the selection changes while the menu stays open;
  and is cancelled when superseded mid-flight (D11).
- The narrowing gate refuses to fetch above `maxCandidates`, says so, and the refusal **lifts**
  once a re-run `summarize` with the current narrowing comes back under the cap (D4).
- Candidates do **not** appear in the graph, the table, or facet counts before ingest.
- Ingest lands exactly the chosen subset; dedup against existing nodes leaves the count honest,
  a deduped node's own data is untouched (D23), and an advisory-count shrink is **not** an error.
- Ingested nodes land near their origin node; origin-less results land at the viewport centre;
  provider-supplied `x/y` wins (D22).
- `onBeforeIngest` is called **once** with the whole set; a narrowing decision lands only what it
  names; `false` lands nothing.
- Provenance: two overlapping pivots both tag a node, and `removeBySource` for one keeps it; seed
  nodes survive a `removeBySource` for any pivot.
- Explicitly rejected candidates are not re-offered on a second run of the same pivot;
  un-rejected leftovers **are**; "reject all remaining" rejects exactly the visible remainder;
  and a rejection under one pivot does not hide the candidate from another pivot (D14).
- `autoIngest: true` skips triage entirely and still passes the gate.
- Declared-potential badges render without any provider being called — assert **zero** provider
  invocations on load, which is D11's whole point.
- **Union by id (D7)**: re-pivoting a **collapsed** container adds the new children, leaves
  matching ones untouched (data included — D23) and removes none; the union recurses into
  grandchildren; the same again on an **expanded** container; and a child contributed by a
  *different* source survives the merge (the D8 guarantee). Assert the child set numerically —
  a screenshot cannot tell a merged cluster from a replaced one.
- `run()` resolves `'refused'` / `'vetoed'` / `'staged'` / `'ingested'` correctly, carrying the
  `runId` that provenance recorded (D16).
- **Undo/redo (D25)**: undo removes exactly one run's contribution — a node another source
  vouches for survives, one record lighter, and a union-added child disappears from its
  container; redo restores it identically with **zero** provider calls; two runs of the same
  pivot are independently undoable.
- An edges-only result (every endpoint already on canvas) opens triage with edge rows instead
  of silently auto-landing (D24).
- The **safety ceiling** (D17) refuses an oversized payload instead of truncating it, and says so.
- An **origin-less pivot** (D19) runs with nothing selected and lands through the same gate.
- `invalidate()` makes the next menu open re-run `summarize`; without it, reopening on the same
  selection does not (D20).
- Narrowing controls offer no `regex` widget while the triage table's own filters do (D18).

Known harness traps to respect: wait explicitly for async-drawn content rather than trusting
Playwright's stability heuristic; do not add nodes and immediately screenshot the canvas (the
re-fit races the capture); and do not assert force-simulation outcomes in the parallel suite.

Docs: a page under the callbacks / plugin area covering the two-call contract, the narrowing
gate, provenance and `onBeforeIngest`, plus the gallery card from M3.

## 14. M1 as built (2026-09-01)

The contract and the pipeline are in `src/`, driven by
[`tests/visual/specs/pivot-pipeline.spec.ts`](../tests/visual/specs/pivot-pipeline.spec.ts) (29
cases) against a fake provider in the harness. No UI: `graph.pivots` is the whole surface, and an
`autoIngest` pivot is end to end from the console.

**Files:** `src/interfaces/Pivot.ts` (the contract, §7 as written) · `src/PivotManager.ts` (the
runtime) · `src/Provenance.ts` (the ledger helpers Node and Edge share) · touch points in
`Graph.ts` (`pivots`, `removeBySource`, `batchChanges`), `Node.ts` / `Edge.ts` (`getSources`,
`hasSource`, and `setPotential` / `getPotential` on nodes), `interfaces/InterractionCallbacks.ts`
(`onBeforeIngest`, `IngestContext`, `IngestDecision`), `interfaces/GraphOptions.ts` (`pivots`,
`pivotCandidateCeiling`), `interfaces/Plugin.ts` + `ui/UIManager.ts` (`ctx.addPivot`).

### 14.1 What the implementation settled

Nothing here reverses a D-numbered decision; each one is a hole the code had to fill.

- **The candidate model landed in M1, not M2.** `'staged'` has to mean something for
  `PivotRunOutcome` to be honest, so the candidate sets, the mark/reject/ingest verbs and the
  session rejection memory (D14) are all in `PivotManager`. M2's pane is then a *reader* — which
  is what D6 and D15 were arguing for anyway.
- **Two more `PivotRunOutcome` statuses: `'failed'` and `'cancelled'`.** §7 listed four. A
  provider that throws and a run that was superseded both need somewhere to be reported, and
  making the caller catch exceptions for one and not the other would be arbitrary. A failing
  `summarize` *inside the gate* is a `'failed'` run too: the gate never saw a count, so there is
  nothing to judge and nothing is fetched.
- **A refusal carries its numbers.** `PivotRunOutcome.refusal = { kind: 'cap' | 'ceiling', count,
  limit }`, because §5's rule is that a refusal explains the number, the limit and the way
  forward — the UI cannot write that copy from a bare `'refused'`.
- **`runId` is minted per run, and re-minted per ingest.** A staged run's first ingest is recorded
  under the id `run()` returned, exactly as §7 promises. A *second*, partial ingest out of the
  same staged set gets a fresh id, so each batch is separately undoable rather than collapsing
  into one giant undo of "everything I ever took from this set".
- **Dedup records the vouching (a clarification of D23).** An id-matched candidate leaves the
  existing node's data, style and children untouched — but the run *did* assert that node exists,
  so it takes a source record. Without this, D8's "two overlapping pivots both tag a node" is
  unreachable: the second pivot's candidate always dedups. Provenance is not data, and this is
  what makes `removeBySource` for one pivot honest when another still vouches.
- **The seed's claim is written down lazily.** An element with no records reports
  `getSources() === ['seed']`, and vouching for something already on canvas writes an explicit
  `'seed'` record first. Otherwise undoing a run that merely *vouched* for seed data would empty
  the ledger and delete a node the pivot never brought.
- **The ceiling is `pivotCandidateCeiling` in the options** (and `graph.pivots.candidateCeiling`
  at runtime), defaulting to 10,000 — D17's "overridable through options", with no new nested
  group for one number.
- **`graph.batchChanges(fn)`** is the "clean `dataBatchChanged` emission" M1 asked for: one event
  and one re-render for a whole ingest, undo or redo, rather than one per element. It coalesces
  `onChange` as well, which is the half that actually costs — twelve nodes and twelve edges were
  24 events and 24 renderer passes. Used only by the pivot pipeline; `updateData`'s own
  double-fire is untouched and still its own bug.
- **Carried edges follow *this run's* landed nodes.** An edge staged alongside a candidate stays
  with that candidate until it lands, so ingesting 12 of 210 rows does not throw away the other
  198 edges. An edge whose endpoints are all already on canvas is a triage row of its own (D24),
  and an edge with an endpoint that is neither staged nor on canvas is never offered, because it
  could never land.
- **An auto-ingest leaves nothing staged**, even after an `onBeforeIngest` veto: nothing was ever
  offered for triage, so nothing is left waiting for it.

### 14.2 What M1 found in the rest of the library

- **`addNode` does not register a container's children in the graph's node map.** `_setData`
  recurses into `children`, `addNode` does not — so an ingested MISP container has its 12 children
  as `Node` objects (and expands correctly), but `getNodeCount()` does not see them. M1b touches
  this area; it is the right place to decide whether ingest should recurse.
- **Adding nodes moves the graph even with `simulation.enabled: false`.** `Simulation.update()`
  ends in `restart()`, which sets `engineRunning = true` unconditionally, and the render tick then
  settles the new nodes by a few tens of pixels. Harmless here, and the reason the placement tests
  assert a centroid rather than a per-node bound — but it means "physics off" is not quite off.
- **`Graph.getNode()` returns `structuredClone(node)`**, which does not preserve the prototype, so
  the result has no `Node` methods at all. Provenance is therefore read through
  `getMutableNode(id).getSources()`. Pre-existing, and worth its own fix.

### 14.3 §13's test list, against what is covered

Covered by the new spec: zero provider calls on load and on applicability; one aggregated
`summarize` for a multi-node origin; a superseded `summarize` dropped; the cache and
`invalidate`; the gate refusing at 2,143 against a cap of 2,000 and lifting at 210; candidates
absent from the graph until ingest; ingest landing exactly the chosen subset; origin-seeded and
viewport-centre placement (D22); dedup leaving data untouched (D23); edge-only rows (D24);
`onBeforeIngest` called once, vetoing, and narrowing — including for an `autoIngest` pivot;
provenance across two pivots plus `removeBySource`; rejection memory per pivot, "reject all
remaining", and a closed pane rejecting nothing; the 10,000 ceiling and a failing `fetch` with a
retry; run-scoped undo/redo with no refetch, and two runs of one pivot undone separately;
declared potential as data.

Still to cover: the facet-count arithmetic as rendered (M2/M3). Union by id is covered by
M1b's own spec (§15).

## 15. M1b as built (2026-09-01)

Children union by id, driven by
[`tests/visual/specs/pivot-children-union.spec.ts`](../tests/visual/specs/pivot-children-union.spec.ts)
(7 cases). `Node.unionChildren` / `Node.removeChildById` / `Node.descendants` are the new
child-mutation API beside `setChildren`; `Graph.unionChildren`, `Graph.removeChildNode` and
`Graph.dropNode` are the doors the pipeline uses.

### 15.1 What it settled

- **Union-added children ride with their container.** They are not triage rows of their own —
  there is nowhere else to put a child, and D7 forbids re-parenting — so they land when the
  analyst ingests the run that found them, exactly as a carried edge lands with its endpoints.
  For the same reason they are not itemized in `IngestContext.candidates`: a veto stops
  everything, and narrowing by node id reaches the top-level candidates only.
- **The expanded-container rebuild cost nothing.** `NodeDrawer.render` calls
  `ClusterDrawer.render` for any expanded node, and that always builds a *fresh* subgraph from
  `node.children` — so marking the container dirty is the whole implementation. No new
  `ClusterDrawer` abstraction, as D7 asked, and the position reset §11.2 accepted is precisely
  what happens.
- **A container's whole subtree is vouched for, not just the container.** `PivotRun.childIds`
  records every node a run added inside a container — a new container's own children as well as
  merged ones — and undo walks them *before* the top-level nodes, so nothing is ever left
  orphaned. This is what makes `removeBySource` reach into containers, which D7 promised.
- **A matching child keeps its own provenance.** A union that re-asserts an existing child adds
  nothing and tags nothing: the child still belongs to the run that brought it, so undoing the
  merge leaves it alone and undoing its own run takes it away. The D8 guarantee, at child level.

### 15.2 What it found

- **`Graph.addNode` did not register a container's children** in the node map, though `_setData`
  always has — and `ClusterDrawer.createSubgraph` looks each child up by id. So a container a
  pivot ingested could not be expanded at all: the very end of the MISP walkthrough. `addNode`
  now recurses, which is also why `getNodeCount()` after an auto-ingest is 1 + 12 rather than 1.
- **`Graph.removeNode` on a container leaves its children behind** in the node map, and does not
  splice a child out of its parent's array. The pivot path routes around both through
  `dropNode` / `childIds`; making `removeNode` itself symmetric with `addNode` is a wider change
  (every delete affordance would see it) and belongs to the cluster/children refactor.
- **`removeBySource` had the same hole** and was fixed here: a removed child now comes out of its
  parent as well as out of the graph.

## 16. Where M2 starts

The pane is a **reader** of `graph.pivots`. It should add no state of its own beyond what is on
screen — which view is showing, which filter is typed, where the scroll is.

**What it reads:** `pivots.staged()` (one `PivotCandidateSet` per pivot, so one dock tab each —
D27) · `pivots.candidates(pivotId)` · a set's `fetched` / `deduped` / `suppressed` / `loading` /
`error` / `refused`, which are exactly the header line's numbers and the empty, error and ceiling
states · `nodes` (rows, each `candidate` | `marked` | `rejected`, `deduped` rows not ingestable) ·
`edges` (the edge-only section, D24) · `origin` and `narrowing` for the pane's subtitle.

**What it calls:** `mark` / `markAll` (silently — they do not notify, because re-rendering the
pane on every tick loses the analyst's place; update the row and the footer in place) ·
`reject` / `unreject` / `rejectRemaining` / `rejectedIds` · `discard` (closing the pane) ·
`ingest(pivotId)` → `PivotRunOutcome` · `run(pivotId, origin, narrowing)` for **Re-run** ·
`cancelFetch` · `undo(runId)` for the post-ingest affordance.

**How it knows to repaint:** `pivots.on(change => …)`, where `change` is `'registry'` |
`'summarize'` | `'candidates'` | `'runs'`.

**The two library gaps it will hit** (both already flagged in §10): an **actionable
notification** — the post-ingest "Ingested 12 — Undo" needs an action, a longer lifetime,
hover-pause, dismiss and a returned handle — and **`DockTabHandle.setLabel`**, without which a
tab cannot carry a live count.

**Prior art to lift from, not re-derive:** the approved artboards and copy in
[`pivot-enrichment-ui-states.md`](pivot-enrichment-ui-states.md) and
[`pivot-enrichment-ui-groundwork.md`](pivot-enrichment-ui-groundwork.md), and the working pane in
[`../prototype/pivot/triage.ts`](../prototype/pivot/triage.ts) — built against the real library,
so its dock wiring and its row-lifecycle behaviour transfer directly. Its `manager.ts` is
superseded by `src/PivotManager.ts`; the API names differ slightly (`sets` → `staged()`,
`applicable` → `for`).

## 17. M2 as built (2026-09-01)

The triage pane is in `src/`, driven by
[`tests/visual/specs/pivot-triage.spec.ts`](../tests/visual/specs/pivot-triage.spec.ts) (15
cases) against the same fake providers M1 used. Unlike M1's spec it drives the **real DOM** —
which state is showing, what the header line says, which rows are ingestable — because that is
precisely the half M1 could not reach. The one M1 fact it re-asserts at every ingest is the one
the whole feature rests on: a candidate is not in the graph until someone commits it.

**Files:** `src/ui/elements/Pivot/PivotTriage.ts` (the controller: one dock tab per staged set,
and the post-ingest toast) · `src/ui/elements/Pivot/TriagePane.ts` (one pane) ·
`src/ui/elements/Pivot/pivot.scss` · the two library additions in `src/ui/Notifier.ts` /
`src/ui/UIManager.ts` (actionable toasts) and `src/interfaces/GraphUI.ts` / `Dock.ts` /
`interfaces/Plugin.ts` (`setLabel`) · a `pending` slice in `PivotManager` · one signature
relaxed in `Table/TableRowFilters.ts`.

### 17.1 The two library gaps, closed

- **The actionable notification is a handle, not a button.** `Notification` gained
  `action?: { label, onClick }` and `duration?`; `showNotification` and every `Notifier` method
  now return a `NotificationHandle` with `update()` and `dismiss()`. An action lifts the
  lifetime from 4s to 12s, the pointer pauses it, and there is always a dismiss control. That
  handle is what makes `Ingested 12 — Undo` become `Undone — Redo` **in place** rather than
  stacking a second toast on the first. Existing three-argument calls are untouched.
- **`DockTabHandle.setLabel` reverses C8.** The states doc put the count in the pane header
  *because* a tab could not be relabelled; it can now, through a `'relabel'` change the dock
  answers by redrawing only its strip. So the tab reads `Correlations (198)` and the count is
  what is still waiting for a verdict — not what was fetched, which is already the header's
  first segment and would say the same thing twice.

### 17.2 What the implementation settled

- **The pane owns its view state and nothing else.** Search text, the per-column filters, the
  sort, the page and whether the suppressed list is open live on `TriagePane`; everything else
  is read from `PivotManager` on every paint. So a pane torn down and rebuilt loses a scroll
  position and nothing more, which is what §16 asked for.
- **Paging, not windowing.** M2's brief says "filter / sort / page" and the dock is ~330px
  tall, so 100 rows a page with a `1–100 of 210` pager beats reproducing `TableGrid`'s
  virtualisation. `TableGrid` itself is not reusable here — it is typed over `Node | Edge`, and
  a candidate is deliberately neither.
- **The per-column filter controls are the data table's, unchanged.** `buildRowFilterControl`
  only ever read a column's `key` / `label` / `type`, so it now takes a `FilterableColumn`
  instead of a `TableColumn<Node | Edge>` and the triage pane calls it directly. Two tables in
  one dock offering two different-looking filters would have been the wrong kind of
  difference. Columns themselves come from `collectDataAttributes` — the same scan the dock
  uses — so a provider declares no columns and still gets a readable table.
- **The search box matches per cell, not over the joined row.** Joining the cells first makes
  `^url 1[0-9]$` match nothing, which is a silent lie about the analyst's own pattern. Regex
  lives here and only here (D5): these rows are already in hand.
- **Edge-only rows are drawn *above* the node table.** There are usually a handful of them
  against hundreds of nodes, and under a full page of rows a core AIL result would never be
  seen at all. §5.5 fixed that they get their own section; it did not fix where.
- **The pane brings itself to the front on its first appearance, and never again.** The
  analyst asked for the fetch, so its results should not wait behind the table — but a later
  update must not yank them out of whatever they are reading.
- **`kind` became `Label` in the edge section.** The states doc's `from` / `to` / `kind` has no
  referent in the library: there is no edge-kind concept, and `data.label` is the conventional
  edge name (`edgeNameGetter`). So the edge columns are `From` / `To` plus whatever the edges'
  own data holds, derived like the node columns.

### 17.3 Three things M2 changed behind it

Each of these is an M1 behaviour that made a specced pane state unreachable. None reverses a
D-number.

- **A ceiling refusal now keeps its set.** M1 deleted the candidate set on a `'ceiling'`
  refusal, which left **T5** — "the source returned 14,203 candidates, over the 10,000 limit"
  — with no pane to appear in. It is kept instead, empty of candidates and carrying its
  `refusal`, exactly as a *failed* fetch is already kept so it can offer a retry. `run()` still
  returns the `'refused'` outcome. `pivot-pipeline.spec.ts`'s ceiling case was updated to
  assert the refusal on the set rather than the set's absence. An **auto-ingest** pivot is the
  exception on both paths: it was never offering triage, so neither its refusal nor its failure
  leaves a pane behind.
- **A re-run over marked rows waits instead of replacing (C7, and D27's own commitment).**
  `PivotCandidateSet.pending` holds the new set while the analyst still has marks on the old
  one, and `showPending` / `dismissPending` are *Show new* / *Keep triaging*. A re-run with
  nothing marked replaces outright, as before — there is nothing to lose. The identity checks
  around the in-flight set were tightened while doing this: a superseded run could previously
  delete the set belonging to the run that superseded it.
- **`unreject` reaches the session memory even when the row is not staged.** It returned early
  on a candidate it could not find, so an id rejected in an earlier run could never be taken
  back — which is C5's whole purpose. Which leads to the one place M2 reads C5 differently:
  suppressed candidates are dropped at stage time (M1, tested), so there are no rows to
  reveal. The segment opens the **list of suppressed ids with a `restore` beside each**
  instead; restoring clears the rejection and the next run offers the candidate again. Same
  guarantee — the suppression is inspectable and reversible — without re-staging rows M1
  deliberately does not keep.

### 17.4 What M2 found

- **A double toast, from announcing a run twice.** The controller reports any ingest it did not
  itself trigger (an `autoIngest` pivot, or a consumer calling `pivots.ingest`) by watching the
  `'runs'` change — but `ingest()` notifies `'runs'` *before* its promise resolves, so the
  pane's own ingest was announced by both paths. The run id is now claimed from the set before
  the call rather than from the outcome after it.
- **Playwright's assertion polling is ~350ms**, which is wider than a 400ms in-flight state. The
  fake provider's latency in that one case is 1200ms so the window cannot fall between two
  polls; this is worth knowing for any future state that exists only while a call is out.
- **`[hidden]` loses to `display: flex`.** The toast's action row is a flex container, so the
  UA's `[hidden]` rule had to be restated — the same trap `.pvt-table-apply` already documents.

### 17.5 §13's test list, against what is covered

Covered by the new spec: the pane appearing with the set and the graph unchanged; the tab's live
count; the header line's three segments; T0 with a cancel, T2, T3, T4 with a retry, T5, T6 with
its tally, and T7 both ways (*Show new* / *Keep triaging*); a re-run with nothing marked
replacing outright; the row lifecycle R1–R3 including a rejection struck in place, losing its
checkbox and keeping its slot; reject-all-remaining; filter, sort and paging asserted to move no
node; a regex search; the edge-only section; ingest landing exactly the marked rows with the
toast's undo and redo; closing the pane rejecting nothing; suppression inspected and restored;
and an auto-ingest bringing no pane but the same toast.

Still open for M3: the facet-count arithmetic *as rendered* (there is no narrowing UI until the
rail mode exists), and the pane in a UI mode with no dock — `full` is the only mode with one, so
a staged set elsewhere is reachable through `graph.pivots` and simply has no pane.

## 18. Where M3 starts

Unchanged from §10's M3 paragraph, minus the two library dependencies it listed: the actionable
notification is built, and `DockTabHandle.setLabel` with it. What is left of that note is the
**per-mode tool-panel width** (216px today, Pivot mode wants 300px — C15), which is Pivot mode's
own problem rather than the pane's.

Two hand-offs from this milestone:

- The pane's **Re-run** calls `run(pivotId, set.origin, set.narrowing)` — the narrowing the set
  was fetched with. Once Pivot mode owns the narrowing controls, a re-run should take the
  *current* narrowing instead, and S9's `210 in triage ▸` link should activate the pane's tab
  (`UIManager.activateDockTab('pivot-triage:<pivotId>')`).
- The controller already reports **every** run, including ones it did not trigger, so M3's
  "a failed `autoIngest` fetch reporting through the notifier" is the only reporting still
  missing: a failure produces no run, so nothing announces it.

## 19. M3 as built (2026-09-01)

The last milestone. Pivot mode is in `src/ui/elements/Pivot/`, driven by
[`tests/visual/specs/pivot-mode.spec.ts`](../tests/visual/specs/pivot-mode.spec.ts) (23 cases).
Where M2's spec asserted *what the pane shows*, this one mostly asserts **when a provider is
called** — the D11 boundary is the half of this milestone no screenshot can see.

**Files:** `Pivot/PivotMode.ts` (the gated registration, the two tools, the origin) ·
`Pivot/PivotPanel.ts` (the panel and one `PivotEntry` per pivot — the S1–S10 machine) ·
the panel half of `Pivot/pivot.scss` · `ui/lasso.ts` (the lasso, extracted) ·
`UIManager.openPivotMode()` · a *Pivot…* entry in `ContextMenu` · potential badges in
`renderers/svg/BadgeDrawer.ts` · `docs/pivots.md` · the `pivot-enrichment` gallery card.

### 19.1 What the mode is, concretely

`UI.pivotMode` defaults to `'auto'`, so the rail button follows the registry: it appears with
the first pivot and goes with the last. The component is built in `full` and `light` and may
still put no button on the rail — which is the shape D26 asked for, since a consumer with no
pivots must see nothing rather than an empty mode.

**The origin is the selection, while the mode is active.** *Pick origin* is the resting tool
(the plain pointer) and *Lasso origin* is the same lasso Select mode has; both build a
selection, and the panel reads it. This is the cheapest honest reading of "the node set the
mode's own tools built", and it means the origin survives arriving in the mode with something
already selected. `onEnter` asks; `onExit` stops asking.

### 19.2 Four library changes it needed

- **`RailModeDefinition.panelWidth`** — C15's 300px, per mode, cleared when the mode is left.
- **`RailModeDefinition.keepPanelOpen`** — arming a tool normally collapses the panel so the
  canvas is clear, which is right for Select's Lasso and wrong for a mode whose panel *is* the
  workspace. Without it, *Lasso origin* hides the pivot list it is feeding.
- **A registered mode's rail slot keeps the mode's name while its `defaultTool` is armed.** The
  built-ins already do this — Select armed on Pointer still reads `Select` — but the registered
  path took the armed tool's face unconditionally, so any mode declaring a resting tool was
  permanently renamed by it. Fixing it is what lets Pivot declare *Pick origin* at all.
- **`pivots.cancel(pivotId?, kind?)`** — leaving the mode must stop the *questions* it was
  asking without cancelling a `fetch` that already has a candidate set and a pane (C3).

Two smaller ones: the tool panel publishes `--pvt-toolpanel-height` and the bottom-left legend
now caps against `max(rail, tool panel)` rather than the rail alone; and the cache-key separator
in `PivotManager` is written as a `\u0000` escape rather than a literal NUL byte, which had been
quietly making the whole file binary to `grep` and `rg`.

### 19.3 Where it reads differently from the states doc

- **The count line drops the noun.** S3 specs `~2,143 correlations`, but the entry's heading
  already says *Correlations*; repeating it says the same thing twice — the argument M2 used for
  the tab count. So it is `~2,143`, and C2's multi-node form is `~2,143 across 3 nodes`.
- **Facet labels are used verbatim in the breakdown**, not lower-cased: `1,800 Domains · 210
  URLs`. Lower-casing a provider's label is wrong the moment it is translated (a German noun is
  capitalised), and "used verbatim" is what every other label in the library promises.
- **C15's "the legend moves" became "the legend caps".** A tall Pivot panel does collide with the
  bottom-left legend, but every other corner is occupied, and the legend *already* shrinks
  against the mode rail's height and scrolls. Extending that same mechanism to the tool panel
  costs one CSS `max()` and moves nothing under the analyst. The panel itself is not capped,
  which is what C15 was actually protecting.
- **The pane's *Re-run* still uses the narrowing its set was fetched with**, against §18's
  hand-off. Now that the panel exists the two gestures mean different things and both are
  wanted: the pane's is *run that query again* (its neighbour is a failed fetch's **Retry**), and
  the panel's **Fetch** is *run the current one*, which replaces the set by D27 anyway. Reaching
  across from the pane into a panel the analyst may not even have open would be the surprising
  one.

### 19.4 What it found

- **A new entry both starts and is told the origin changed.** Clicking one node fires an
  unselect then a select, so the origin empties and refills; the pivot entry is destroyed and
  rebuilt in between, and the rebuilt one asked twice. Entries now remember which origin they
  last asked about, which is a guard on the question rather than on who is asking.
- **`RailModeDefinition.render()` is only re-invoked when the panel rebuilds** — confirmed; the
  Phase B prototype had already found it. The panel is therefore a persistent element that
  repaints its own parts, and the narrowing form is rebuilt only when the facets move, never
  while a field has focus.
- **A node's DOM id is randomised in a real page** (`node-id-R5o15Xfy`), so the thumbnail
  script's node lookup has to go through `.pvt-canvas .node` — and `page.mouse` needs the embed
  scrolled into view first, since a card with much prose above it sits 2,000px below the fold.
- **The library draws no node labels by default** (`defaultNodeStyle.text` is `undefined`), which
  is why the gallery card's nodes are bare circles like every other card's.

### 19.5 §13's test list, against what is covered

Covered by the new spec: the registry gate both ways plus `pivotMode: true|false`; selection
firing zero calls and the mode firing exactly one per applicable pivot; a re-entry served from
cache; the origin changing re-asking once; the empty-origin state (M3) and the origin-less group
(C14); S3's count line and breakdown; C2's multi-node line; S7's bare **Run**; a declared
potential as the only number before anything is asked; **the gate refusing and lifting through
the real multiselect widget** — the one §17.5 left open; a fetch staging without moving the
graph and linking into its pane; S6's retry; the 300px panel and its staying open when a tool is
armed; the rail slot's face; the badge's compacted text, its self-contained tooltip and the
scoped mode it opens; a potential for an unregistered pivot wearing nothing; a zero potential
clearing; the context-menu entry routing in and being absent when nothing applies; a failed
auto-ingest and an over-ceiling auto-ingest both reported through the notifier; and an
origin-less run staging into the same pane.

Not covered, and worth saying: **the panel in `light` mode**, where there is a rail but no dock,
so a staged set has nowhere to show — the same shape as §17.5's note, and the `n in triage ▸`
link simply has no tab to activate there.

### 19.6 What is left of §11

1. **The entry point for origin-less pivots** — closed. C14's empty origin is where they live,
   and the *Without an origin (n)* group is what they fold into once one is picked.
2. **Inner positions reset on an expanded container's re-merge** — still open, still deliberately
   deferred to the cluster/children/subgraph refactor.
3. **The 10,000 ceiling** — still a proposal, still not measured against a real AIL payload. M3
   changed only its reporting: an auto-ingest that hits it now says so.
4. Closed by D27 during M1.

Every milestone in §10 is built. What this PRD does not cover, and never intended to, is §12 —
persistence above all, which is its own document.
