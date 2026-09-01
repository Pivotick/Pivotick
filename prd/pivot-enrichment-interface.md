# Feature — a pivot/enrichment interface: advertise, run, triage, ingest

**Status:** Proposed — scoped with Sami 2026-08-31 / 2026-09-01. Fifteen decisions are already taken (§6); the remaining forks are in §11. Not started.
**Owner:** Sami Mokaddem
**Requested:** 2026-08-31
**Area:** greenfield `src/PivotManager.ts` + `src/interfaces/Pivot.ts`, with touch points in `src/Graph.ts` (ingest, provenance, `dataBatchChanged`), `src/Node.ts` / `src/Edge.ts` (source tags), `src/interfaces/InterractionCallbacks.ts` (`onBeforeIngest`), `src/interfaces/Plugin.ts` (`addPivot`), `src/ui/elements/Dock/` + a new `src/ui/elements/Pivot/` (the triage pane and the pivot menu), `src/interfaces/RendererOptions.ts` (declared-potential badges). Adds **public types** and a **new public option group**.
**Type:** data-path capability + plugin API — a registry and an ingest pipeline, not a rewrite of anything.
**Related:** [`plugin-rail-modes.md`](plugin-rail-modes.md) (this PRD defines the *vocabulary* an Enrich mode speaks; it does **not** ship an Enrich mode — built-ins stay hardcoded and the consumer ships the mode), [`archive/table-mode.md`](archive/table-mode.md) + [`archive/dock-tabs.md`](archive/dock-tabs.md) (the dock and the tab registry this triage pane rides on), `misp/declarative-filter-facets.md` (the facet vocabulary reused for narrowing), `misp/write-path-lifecycle-hooks.md` and `edge-create-veto-hook.md` (the before-hook / narrowing idiom mirrored by `onBeforeIngest`), `misp/edge-layers.md` (the carrier for edge provenance).
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
   a foundation to build on.
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
- **A two-call provider contract** — `summarise` then `fetch` (§7).
- **A candidate model** that is not the graph, session-scoped, with remembered rejections.
- **A triage pane in the dock** — the candidate table, with facets, selection and an ingest
  action.
- **An ingest pipeline** — dedup, provenance tagging, one `onBeforeIngest` gate, clean
  `dataBatchChanged` emission.
- **A provenance API** — source tags on nodes and edges, and `removeBySource`.
- **Declared-potential badges** on the node rim, plus a pivot menu on selection.
- Docs + one gallery card.

## 6. Decisions taken

**D1 — Two calls, not three. `summarise` *is* the potential query.**
`summarise(nodes, ctx)` returns counts and facets; `fetch(nodes, narrowing, ctx)` returns the
data. There is no separate "list potential" call: selecting a node runs `summarise`, and that is
what fills the pivot menu. One concept, two functions.

**D2 — Array-shaped signatures from day one.**
Both calls take `Node[]`; a single-node pivot is `[node]`. Bulk pivot on a selection is
*essential*, not a later phase, and MISP/AIL must be able to serve it as **one** backend request
rather than fifty. Array-first also means bulk is not a breaking v2.

**D3 — Narrowing replaces streaming. No streaming, no server cursor in v1.**
The constraint is **backend** capability, not client support: MISP is AJAX-only, AIL may have
websocket/event-stream. So the contract must never *require* progressive delivery. With
`summarise` in front you never fetch 2000 — the analyst narrows to ~40 and one ordinary request
serves it. Secondary reason streaming is wrong here anyway: a partially-arrived candidate set
cannot be triaged honestly (facet counts jump, "select all matching" lies).

**D4 — The cap sits at the narrowing gate, driven by `summarise`'s count.**
This is the quiet win of two-phase: you know it is 300,000 *before* asking for it. Above
`maxCandidates` the UI refuses to fetch and says "narrow further" — no truncation, no silent
sampling, no set that claims to be complete and isn't. Because counts are advisory (D10) the
gate is advisory too, so a **defensive ceiling** on what `fetch` actually returns is still
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

**D7 — Flat fragments. No containment ingest in v1.**
A returned node **never** names an existing on-canvas parent. MISP's collapsed-event case needs
no new mechanism: the container arrives as a **new** node, and `RawNode.children?: RawNode[]`
(`interfaces/GraphOptions.ts:73`) already nests. Inserting into a node already on canvas would
mean mutating a live `Node.children` (`Node.ts:444`), recomputing cluster radii and re-anchoring
crossing edges — a different code path, for a case nobody needs yet. Deeply nested clusters are
also suspected of being hard for analysts to work with, which the table-nested-nodes work
already hinted at.

**D8 — Provenance is a *set* of source tags, on nodes **and** edges, seed included.**
A scalar `source` breaks the moment two pivots overlap — guaranteed with AIL correlations. Node
X can arrive from pivot A, then pivot B, and have been in the seed all along. Treating the seed
as just another source (`'seed'`) makes removal one uniform rule: **drop the tag; delete only if
the set is now empty.** Edge provenance is the load-bearing half (which pivot asserted this
relationship) and can ride `edgeTypeAccessor` / edge layers for styling and toggling.

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

**D11 — Potential is declarative; a provider is called only on user intent.**
The library **never** speculatively calls a provider on load — that is precisely the
N-requests-per-visible-node cost `async-children-provider.md` complained about. But *selection
counts as intent*: selecting one node or fifty runs `summarise`, batched into one request,
debounced, cached per node, and cancelled through the existing `signal` / `isStale()` pattern
when the selection changes.

**D12 — Rim badges show *declared* potential only.**
Queried counts (D11) appear in the pivot menu, not on the rim. Otherwise a count materialises on
one node the moment it is selected and the canvas looks inconsistent.

**D13 — Auto-ingest is provider-declared.**
Each pivot says whether its results land directly or open triage — MISP's expand-an-event
auto-ingests 12 objects; AIL's correlations always triage. No library threshold: a magic number
would surprise someone, and the provider genuinely knows.

**D14 — Rejections are remembered for the session, with the hook shape designed in.**
Triaging 1,800 down to 12 and then being re-offered the same 1,788 an hour later is a workflow
failure, so rejections must stick. Persisting them across reloads belongs to the deferred
persistence PRD (§12), so v1 keeps the rejection set in memory but shapes it so a consumer
read/write hook can be added without a breaking change.

**D15 — The registry lives on `Graph`, not `UIManager`.**
Pivots produce *data*; the triage pane is a UI element that reads them. There is also a hard
ordering constraint: `Graph`'s constructor runs `new UIManager(...)`, whose constructor calls
`setup()` → `build()`, so `graph.UIManager` is still `undefined` while UI components are being
built. Anything a component needs at build time must already exist on `Graph` — the mirror image
of the lesson `write-path-lifecycle-hooks.md` learned.

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
     * Whether this pivot applies to the current selection. Re-read on every selection
     * change. Omit it and the pivot applies to everything.
     */
    appliesTo?: (nodes: Node[]) => boolean
    /**
     * Cheap "what's out there". Runs on selection (D11) and fills the pivot menu; its facets
     * become the narrowing controls. Omit it and the pivot offers no narrowing and no
     * advertised count — legal, but then `fetch` must be safe to call blind.
     */
    summarise?: (nodes: Node[], ctx: PivotContext) => PivotSummary | Promise<PivotSummary>
    /** The real fetch, narrowed by what the analyst chose. */
    fetch: (nodes: Node[], narrowing: PivotNarrowing, ctx: PivotContext) => PivotResult | Promise<PivotResult>
    /** Land results directly instead of opening triage (D13). @default false */
    autoIngest?: boolean
    /** Refuse to fetch when the advertised count exceeds this (D4). */
    maxCandidates?: number
}

/** What `summarise` advertises. Every count here is advisory (D10). */
export interface PivotSummary {
    /** Advisory total. Render it as approximate. */
    total: number
    /** Optional breakdown; each entry becomes one narrowing control. */
    facets?: PivotFacet[]
}

/** A narrowing control, reusing the query engine's facet vocabulary. */
export interface PivotFacet {
    key: string
    label: string
    type: FilterFacetType
    options?: Array<{ label: string, value: string, count?: number }>
}

/** The analyst's narrowing choices, keyed by facet key. */
export type PivotNarrowing = Record<string, unknown>

/** A flat graph fragment (D7) — no returned node names an existing parent. */
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
await graph.pivots.run(id, nodes)           // summarise -> gate -> triage or auto-ingest

// Provenance (D8)
node.getSources(): string[]                 // e.g. ['seed', 'misp-correlation']
node.hasSource(source: string): boolean
edge.getSources(): string[]
graph.removeBySource(source: string)        // drop tag; delete only when the set empties

// Declared potential (D11 / D12)
node.setPotential(pivotId: string, count: number)
```

## 8. What the consumer does

**AIL — a correlation pivot on a 2000-connection node.** Narrowing is the whole point:

```ts
const correlations: PivotDefinition = {
    id: 'ail-correlation',
    label: 'Correlations',
    appliesTo: nodes => nodes.every(n => n.getData()?.type !== 'note'),
    summarise: async (nodes, { signal }) => {
        const res = await fetch('/api/correlation/count', {
            method: 'POST',
            body: JSON.stringify({ ids: nodes.map(n => n.id) }),
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

An analyst selects the node, sees **"~2,143 correlations — 1,800 domains, 210 URLs, 95 pastes"**
without a single node being created, ticks *URLs*, fetches 210, filters them down in the dock,
and ingests 12. Nothing else ever enters the graph.

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

**Undoing an enrichment**, which is what provenance buys:

```ts
graph.removeBySource('ail-correlation')   // seed data, and pivots that also vouch for a node, survive
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

Genuinely new: the registry, the candidate model, the ingest pipeline, provenance tags, and the
triage pane.

## 10. Work plan

**M1 — contract and pipeline, no new UI.** `interfaces/Pivot.ts`, `PivotManager` on `Graph`,
`summarise` / `fetch` invocation with cancellation, dedup, the narrowing gate (D4), provenance
tags and `removeBySource`, `onBeforeIngest`, `dataBatchChanged` emission. Drivable entirely from
the console and testable without a pane — a pivot with `autoIngest: true` is end-to-end here.

**M2 — the triage pane.** A dock tab holding the candidate table: facets from `PivotSummary`,
client-side filter / sort / page (D5), row selection, the ingest action, rejection memory (D14),
and honest empty and error states.

**M3 — surfaces and docs.** The selection-driven pivot menu (D11), declared-potential badges
(D12), a context-menu and tool-panel entry, `addPivot` on `PluginContext`, a docs page, and one
gallery card (a fake provider with a deliberately large candidate set, so the card demonstrates
narrowing rather than merging).

## 11. Open questions

1. **Re-pivoting a container already on canvas.** MISP returns event `E` with 12 children; an
   hour later another pivot returns 8 more for that same `E`. D7 says a fragment cannot insert
   into a live node — so what happens? Candidates: ignore the extras, attach them as neighbours
   of `E`, or let a returned node carrying `children` be **authoritative** and replace the child
   set. This needs a *stated* answer, not a mechanism; leaving it undefined turns it into a bug
   report.
2. **Provenance tag shape.** A bare `string[]`, or `{ source, at }` records? A timestamp is cheap
   now and awkward to add later, but only the deferred persistence PRD really wants it.
3. **`maxCandidates` default.** A number, or unlimited-unless-declared? And is the defensive
   ceiling (D4) the same number or a separate hard stop?
4. **Do narrowing facets reuse `FilterFacet` wholesale** — `regex` and `numberRange` included —
   or a deliberately smaller vocabulary a backend is more likely to be able to serve?
5. **Server-side cursor paging** is a v2 escape hatch (D5). What is the trigger condition — a
   consumer whose narrowing genuinely cannot get below the cap?
6. **Is `graph.pivots.run()` enough**, or do consumers need to feed candidates in from outside a
   registered pivot (results they already fetched by other means)?
7. **The scope boundary** — who owns caching, auth, retry and rate limiting. Deliberately
   deferred during scoping; settle it before implementation starts.

## 12. Not in scope

- **Persisting or saving an ingested pivot result** back to the source system. Its own PRD, still
  to be written; **rejection persistence (D14) belongs with it**, since "reviewed and rejected"
  is exactly what a user expects to survive a reload.
- **Containment ingest** — inserting into a node already on canvas (D7).
- **Streaming or server-cursor providers** (D3, D5).
- **Shipping an Enrich rail mode.** This PRD gives such a mode its vocabulary; the consumer ships
  the mode, per `plugin-rail-modes.md`.
- **Lazy cluster children** (`misp/async-children-provider.md`) and the **drag-in staging tray**
  (`drag-in-node-staging.md`) — superseded, and not to be revived ahead of this.
- Any query language of our own.

## 13. Tests and docs

Visual specs under `tests/visual/`, driven by a **fake provider in the harness** (resolve,
reject, abort, and a deliberately large candidate set) so nothing depends on a network:

- `summarise` runs on selection, once, batched for a multi-selection, and is cancelled when the
  selection changes mid-flight.
- The narrowing gate refuses to fetch above `maxCandidates`, and says so.
- Candidates do **not** appear in the graph, the table, or facet counts before ingest.
- Ingest lands exactly the chosen subset; dedup against existing nodes leaves the count honest,
  and an advisory-count shrink is **not** an error.
- `onBeforeIngest` is called **once** with the whole set; a narrowing decision lands only what it
  names; `false` lands nothing.
- Provenance: two overlapping pivots both tag a node, and `removeBySource` for one keeps it; seed
  nodes survive a `removeBySource` for any pivot.
- Rejections are not re-offered on a second run of the same pivot.
- `autoIngest: true` skips triage entirely and still passes the gate.
- Declared-potential badges render without any provider being called — assert **zero** provider
  invocations on load, which is D11's whole point.

Known harness traps to respect: wait explicitly for async-drawn content rather than trusting
Playwright's stability heuristic; do not add nodes and immediately screenshot the canvas (the
re-fit races the capture); and do not assert force-simulation outcomes in the parallel suite.

Docs: a page under the callbacks / plugin area covering the two-call contract, the narrowing
gate, provenance and `onBeforeIngest`, plus the gallery card from M3.
