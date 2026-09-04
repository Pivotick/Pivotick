# Feature — pivot persistence: saving an ingested result back, and remembering rejections

**Status:** **Built** 2026-09-04. The save half shipped whole; rejection persistence was **dropped** — P4 was reversed on 2026-09-04 (§6, P4′), taking S3 with it. §11.1 was settled the same day. What is here now describes what exists, with the two rulings and every implementation deviation recorded in §15.
**Requested:** 2026-09-01
**Area:** `src/PivotManager.ts` (the save ledger and `save`), `src/interfaces/Pivot.ts` (`save` / `autoSave` on `PivotDefinition`, the save types), `src/ui/elements/Pivot/PivotPanel.ts` + `TriagePane.ts` (the unsaved count and the Save affordance), `src/ui/Notifier.ts` (the result and retry toasts — no change needed, see §4.3), `src/GraphHistory.ts` (`markPersisted`), `src/interfaces/GraphOptions.ts` (`pivotMarkUnsaved`), `src/renderers/svg/NodeDrawer.ts` (the unsaved class). Additive — no breaking changes to anything M1–M3 shipped.
**Type:** data-path capability — a second half to the pivot pipeline (`summarize` → `fetch` → triage → **ingest** → **save**). The browser storage this document originally carried is gone (P4′).
**Related:** [`pivot-enrichment-interface.md`](pivot-enrichment-interface.md) (D7, D8, D13, D14, D16, D23, D25 and D27 all constrain this document — it may not contradict them), `write-path-lifecycle-hooks.md` and `edge-create-veto-hook.md` (the five gesture hooks, which already own persistence for everything a *user* does by hand — §4.1), `graph-workspaces-overview.md` + its unwritten PRD **C** `staging-overlay-and-promotion.md` (§10 rules on the collision — most of C has since been shipped under other names, and this document takes the rest of its save half), `view-state-serialization.md` (PRD A of that effort; the rejected alternative home for the rejection store, P4).

---

## 0. Instructions

This document is now a record of what was built rather than a brief. §6 carries the decisions
as they were taken *and* the two that moved on 2026-09-04 — P4 was reversed by its own author,
and §11.1 was settled — with both readings kept, because a reversal that erases the case it
overturned teaches nobody anything. §15 lists every place the implementation departed from what
§7 sketched, and why.

Two rules inherited from the parent PRD, neither negotiable here:

- **Ingest is purely additive; removal happens only through provenance** (D7). Saving must not
  become a second write path into the graph's own data.
- **Counts are advisory, never a contract** (D10) — but *save* counts are the exception that
  proves it. "12 unsaved" is a ledger of what this library did, not an estimate from a backend,
  and it must be exact.

## 1. Why

M1–M3 built the whole road up to the canvas and then stop there. An analyst can advertise 2,143
correlations, narrow to 210, triage down to 12, ingest them with provenance and undo the run —
and every bit of that is **local**. Close the tab and the twelve objects the analyst decided were
real are gone, along with the 1,800 they decided were noise. The work that survives is the work
the analyst redoes by hand, in the source system's own UI, from memory.

Two halves of one problem, which is why they share a document (and why §12 of the parent PRD
named them in one breath):

1. **What was accepted has nowhere to go.** The twelve ingested nodes exist only in the browser.
   The consumer has no call to implement, no notion of "written", no failure surface.
2. **What was rejected is forgotten.** D14 keeps rejections for the session, in a `Map` on the
   manager (`src/PivotManager.ts:52`). Re-running the pivot tomorrow re-offers all 1,800. "I have
   already reviewed and dismissed these" is exactly the judgement an analyst expects a tool to
   remember, and it is the judgement most expensive to reproduce.

The honest counter-argument, stated first because it decides how much of this is worth building:
**a consumer can already persist today.** `onBeforeIngest` hands them the whole candidate set
before it lands (`src/interfaces/InterractionCallbacks.ts:300`), and they can POST it and return
`false` on failure. What that costs:

- It conflates *may this land?* with *write this down*. A veto hook that performs a side effect
  fires before the data exists locally, so a backend write can succeed against a graph state that
  the very same call then vetoes.
- A partial write has nowhere to be recorded. Seven of twelve saved means the consumer must
  either lie (return `true`) or throw the five good ones away (return `false`).
- Nothing in the UI can ever say "12 unsaved", because nothing but the consumer knows.

So the library is not filling a hole in *capability*; it is filling a hole in *bookkeeping*. That
is P1's whole argument, and why a bare hook was rejected: the only thing the library uniquely
knows is which elements came from which run and whether that run has been written — and D16's
run-scoped provenance records already hold the first half.

## 2. Vocabulary

Extends the parent PRD's §2 (pivot / provider / candidates / ingest), which stands unchanged.

| Term | Meaning |
|---|---|
| **Save** | Writing an ingested result **out** of Pivotick, into the system the provider speaks to. The consumer performs it; the library asks for it and records the answer. |
| **Source system** | Whatever the provider fetched from — an event platform, a correlation engine, a case management system. Pivotick never talks to it directly and holds no credentials. |
| **Unsaved** | An element a pivot run created that has not been confirmed written. A precise ledger, not an estimate. |
| **Not savable** | An element whose pivot declared no `save`. It is never counted as unsaved — P5, which is what keeps the count honest. |
| **Canonical id** | The id the source system assigns on save, which is usually **not** the id the provider used while it was a candidate (P8). |
| **Remembered rejection** | ~~A `(pivotId, candidateId)` pair surviving a reload.~~ Dropped by P4′: a rejection is a verdict in one session's context and is held for that session only, exactly as D14 built it. |

The word **promote** is deliberately avoided, though the workspaces umbrella uses it for
something adjacent — §10 explains why this is not that.

## 3. What professional tools do

Short, because the prior art divides cleanly in two and the division is the interesting part.

**Tools whose canvas *is* the database write to it directly.** Neo4j Bloom edits the graph it is
connected to; there is no "save" gesture because there is no gap — the store is live. Linkurious
sits on the same model, with edit rights and a write-back into the underlying graph database.
When the canvas and the source are the same thing, this entire document is empty.

**Tools whose canvas is a workspace treat the graph as a document.** Maltego's transforms pull
into a local graph saved as a *file*; nothing flows back into the data sources, which are
read-only by design. i2 Analyst's Notebook is the same shape — a chart is an artefact, and
pushing findings back into a repository is a separate, deliberate act.

**Pivotick is structurally the second and wants one door to the first.** The graph is a workspace
(candidates stage, undo is local — D25), the provider is read-only by contract (`fetch` returns
data; nothing in M1–M3 writes anywhere), and a source system has its own write API and its own
permission model. So the honest design is Maltego's — the canvas is not the database — with one
explicit, analyst-triggered path back, which is what P2 chose. What Pivotick adds over Maltego is
that the path back is *tracked*: the analyst can see what has crossed it and what has not.

## 4. Gap in Pivotick today

### 4.1 What already exists, and is deliberately reused

- **Run records.** `PivotRun` (`src/interfaces/Pivot.ts:269`) already holds everything a save
  payload needs, in the right shape: `nodeIds` and `childIds` (what the run created — containers
  and union-added children), `edgeIds`, and, separately, `vouchedNodeIds` / `vouchedEdgeIds` for
  elements that were *already on canvas* and were merely vouched for. That separation is exactly
  the new-versus-existing split a save needs, and nobody has to compute it (P6).
- **Per-element provenance.** `SourceRecord { runId, at }` (`src/interfaces/Pivot.ts:331`) ties
  every node, edge and union-added child to the run that vouched for it. The save ledger is a
  second, parallel record keyed the same way.
- **The gesture hooks own everything a user does by hand.** `onBeforeNodeCreate`,
  `onBeforeEdgeCreate`, `onBeforeDelete`, `onBeforeNodeEditCommit` and `onBeforeEdgeEditCommit`
  are already documented as the persistence door — `src/interfaces/InterractionCallbacks.ts:314`
  calls one of them a "validation / **persistence** / veto hook" in as many words. This is the
  whole of P3's argument: manual edits are not unserved, they are served elsewhere, and a second
  door for them would be a competing one.
- **The actionable toast** (M2), with `update()` on its handle (`src/ui/Notifier.ts:57`), which is
  what lets one toast become its own retry without a second toast stacking up.

### 4.2 What is missing

- No notion of an element being **written**. Nothing to query, nothing to show, nothing to retry.
- No **call** for the consumer to implement. `PivotDefinition` is read-only: `summarize`, `fetch`.
- No **failure surface** for a partial write, which is the normal case at any scale.
- No **storage**, of any kind: `grep -rn "localStorage\|sessionStorage" src/` returns nothing
  today. This document introduces the library's first browser storage, which is why P4 carries
  far more argument than a two-line decision usually would.

### 4.3 Three constraints the built code imposes, found while scoping

Not opinions — what the code does, and each one closed a design option.

1. **A toast has exactly one action slot.** `Notification.action?: NotificationAction`
   (`src/ui/Notifier.ts:34`) — singular, and the post-ingest toast has already spent it on D25's
   **Undo**. So "Ingested 12 — Undo | Save" is not available without widening the notifier. P7
   declines to widen it and puts Save in the panel, which is the better home anyway.
2. **`Graph` has no stable identity.** Its only id is `app_id`, and it is
   `generateSafeDomId(8, 'pivotick-app-')` (`src/Graph.ts:116`) — **regenerated on every
   construction**. Any keyed storage therefore needs an identity that does not exist yet, and
   silently keying on `app_id` would produce a store that never matches itself after a reload
   while looking like it works. P9 resolves this; it is the sharpest edge in P4.
3. **A run's created elements are reachable by id, children included.** `undo` already resolves
   `childIds` through `graph.getMutableNode(id)` and walks `node.descendants()`
   (`src/PivotManager.ts:738`+), so a save payload can carry container children as live `Node`s
   with no new traversal.

## 5. What ships

- `save` and `autoSave` on `PivotDefinition` — two new members of an otherwise unchanged contract.
- A **save ledger** in `PivotManager`: per-element saved/unsaved state, keyed by the run that
  created the element, with partial failure and retry-only-what-failed.
- `graph.pivots.save(runId?)`, `unsaved()`, `isSaved(el)`, `canonicalId(el)`.
- **Canonical-id aliases** (P8), consulted by ingest dedup and the children union, so saving does
  not quietly arm a duplicate for the next run.
- The **Save affordance**: an unsaved count and one button in the Pivot panel, the same line in a
  triage pane, and a result toast that becomes its own **Retry** on partial failure.
- A docs section and a gallery-card update, both on surfaces that already exist.

Not shipped, named here so the boundary is visible from the summary: **remembered rejections**
in any form (P4′ — the store, its key, its expiry, its cap and its interface are all gone), **no
refresh of existing nodes from the source** (§12), no write path for manual edits (P3), no
rollback of the canvas on a failed save (P10), and no credential, retry or transport policy of
any kind (D20 stands).

## 6. Decisions taken

P1–P4 answer the four shaping questions (2026-09-01). P5–P13 are derived — each
one is a consequence of those four meeting the built runtime, and each says which.

**P1 — The library owns the ledger; the consumer owns the write.**
A pivot may declare `save`, and the library calls it, but what the library *contributes* is the
bookkeeping: which elements a run created, whether they have been written, which ones failed, and
what to retry. The alternative — a bare hook that calls out and forgets — was rejected because it
is a strictly worse version of what `onBeforeIngest` can already do today (§1), and the two
things the analyst actually needs ("is my work safe?" and "try the three that failed again") are
both bookkeeping, not transport. The rejected third option, full two-way sync, is §12.

**P2 — Save runs on an explicit gesture, with per-pivot opt-in to automatic.**
The analyst clicks **Save**; a pivot may declare `autoSave: true` and have its runs written the
moment they land. Default is explicit. Triage exists precisely because these results are not
trusted (D4, D14) — writing into a shared event unasked is the least defensible default in
the document, and an analyst who ingests twelve nodes to *look* at them has not decided anything
about any of it yet. The opt-in exists because the symmetrical case is real and already has a name:
D13's `autoIngest` for expand-an-event, where the objects are already the source system's own and
"saving" them is a no-op or an update. `autoIngest: true` + `autoSave: true` is a legitimate,
fully hands-off pivot.

**P3 — Only pivot-ingested data is savable.**
Not manual node edits, hand-drawn edges or deletions. Two reasons, and the second is the load-
bearing one. First, provenance is what makes save-back trackable at all: an element with no run
behind it has no payload, no target and no pivot whose `save` should receive it — the same
attribution-boundary argument the workspaces umbrella made as W13. Second, **manual gestures are
already served**: the five write-path hooks exist, one of them is documented as a persistence
hook in so many words (§4.1), and adding a second door would mean a consumer's node edit
persisting twice or, worse, once through each door with different payloads. `graph.pivots.save()`,
never `graph.save()`.

**P4 — Remembered rejections live in `localStorage`, owned by the library.** *(Ruled,
against this document's recommendation — recorded honestly on both sides.)*
The case for it, which won: it works with **zero consumer code**. A consumer who registers one
pivot gets rejection memory for free, and the alternative — a read/write hook — means every
consumer writes the same twenty lines of storage plumbing, or (more likely) none of them do and
the feature exists only on paper.

The case against, which this document made and lost, kept here because every line of it becomes
an implementation obligation rather than an objection:

- It picks a storage policy on the consumer's behalf, in a library that has never touched browser
  storage (§4.2) and whose sibling effort explicitly declined to ("*where they are stored is the
  consumer's decision*", workspaces overview §6).
- It needs an identity `Graph` does not have (§4.3.2) — resolved by **P9**, which is the price.
- Candidate ids are frequently **PII or sensitive**: an email address, a paste id, an IP. Writing
  them unencrypted to `localStorage` on an analyst's workstation is a real consideration, not a
  hypothetical — resolved by **P11** (opt-out, expiry) and left open as §11.2 (hashing).
- It does not follow the analyst to another browser or machine, so "I already rejected these" is
  true on one workstation and false on the next.

Both are therefore built: `localStorage` is the **default implementation**, and P12 keeps the
store swappable so a consumer with a server can supply their own without a breaking change. The
default is the one chosen; the seam is what stops the choice from being permanent.

**P4′ — reversed, 2026-09-04. Rejection persistence is dropped entirely.** *(Asked to
settle §11.2's hashing question, the answer settled the question above it instead.)*

> "I'd definitely not put rejection in the local storage. A rejection is per-graph session, it
> might not be a rejection in another graph/context."

That is an argument against persisting rejections *at all*, not merely against the storage
medium: if a verdict is scoped to one investigation's context, carrying it into the next one is
wrong wherever it is kept. Offered the seam-without-a-default middle (`PivotRejectionStore` as an
interface, nothing shipped that writes), he took the further option — **no store, no interface,
no option**. Rejections stay in the session `Map` D14 already built, and no further.

What this takes with it: **P9** (the storage key `Graph` has no identity for), **P11** (the TTL,
the cap, the opt-out), **P12** (the swappable store), the whole of **S3**, the rejection half of
§13, and §11.2 — hashing an id that never reaches disk is not a question. §4.3.2 stands as a
finding about `app_id` rather than as a constraint on anything here, and §4.2's "no storage of
any kind" is still true of the library today.

The cost, stated plainly because it was a real problem: re-running a pivot tomorrow re-offers
the 1,800 the analyst dismissed today. The counter-argument that won is that "today" and
"tomorrow" are different investigations, and a verdict is not obviously portable between them.

**P5 — A pivot with no `save` produces nothing unsaved.**
Savability is declared, exactly as narrowing is (`summarize` omitted ⇒ no narrowing). Elements
from a pivot with no `save` are *not savable* rather than *unsaved*: they never enter the ledger,
never appear in a count, and the Save affordance does not exist for them. Without this rule an
correlation pivot that can never write anywhere would show a permanent, unfixable "210
unsaved" — a nag with no remedy, which trains the analyst to ignore the number that matters.

**P6 — The unit of save is the run; the unit of record is the element.**
The gesture and the payload are run-scoped (a run has exactly one pivot, so exactly one `save` to
call, and D25's records already delimit it). The ledger is per element, because partial failure
is normal and "9 of 12" has to mean something. Consequences, all of which fall out rather than
being chosen:

- An element is saved by **the run that created it**. If run A creates node N and a later run B
  merely vouches for it (D23 dedup), N is saved when A is saved — B's payload never mentions it.
  A pivot never writes an element it did not produce.
- A run's `vouchedNodeIds` / `vouchedEdgeIds` are passed to `save` as context but are **not** the
  thing to write (§4.1) — they were already on canvas, and their own run owns them.
- Retrying sends only what is still unsaved, with `attempt` incremented.

**P7 — Save's home is the panel, not the toast.**
The post-ingest toast keeps **Undo**, because it has one action slot (§4.3.1) and because Undo is
the urgent action — it is the escape from a mistake that is already on screen, while Save is a
deliberate act that is still available five minutes later. The unsaved count and the Save button
live in the Pivot panel (and in a triage pane's header for its own run), which is where the
analyst already is. A *second* toast reports the result of a save, and that one uses its single
action for **Retry** when the save was partial. No notifier change is needed.

**P8 — A save may mint ids, and the library records them as aliases.**
Saving into the source system creates an object, and it assigns a UUID that is not the provider's
candidate id. Unhandled, this is a bug the feature itself creates: tomorrow's re-run returns the
object under its *canonical* id, D23's dedup does not recognise it, and the analyst gets a
duplicate of the node they saved yesterday. So `save` may return a `canonicalIds` map, and the
manager keeps `canonical → local` aliases that **ingest dedup and the children union consult**.

Deliberately *not* re-keying the node: an id is a `Map` key in `Graph`, and re-keying reaches
into edges, clusters, selection, the query engine, provenance records and the undo stack, for a
benefit the alias already delivers where it matters. The honest cost, which must be documented
rather than hidden: `graph.getNode(canonicalId)` still misses, because only the pivot paths know
the alias. `graph.pivots.canonicalId(node)` is the public read.

**P9 — Storage is keyed by a consumer-supplied key, falling back to the container's DOM id.**
`app_id` is unusable (§4.3.2). So: `UI.pivots.storageKey` if given; otherwise the graph
container's own `id` attribute, which is stable across reloads and is what a consumer writing
`<div id="graph">` already has; otherwise **memory only**, with a single `console.warn` naming
the option. Never a random key, never an unkeyed global bucket — the first silently forgets
everything on reload, the second makes two graphs on one page share each other's rejections.

**P10 — A failed save never touches the canvas.**
Not a rollback, not a removal, not a visual downgrade. The analyst accepted those twelve nodes;
a backend refusal is information about the backend, not a reversal of the analyst's decision. The
elements stay, stay unsaved, and stay retryable. This also keeps D7's additive invariant intact —
if a save failure could remove nodes, there would be a removal path that provenance does not own.

**P11 — Remembered rejections expire, are capped, and can be turned off.**
A rejection is a judgement about a *result*, and results go stale. So each entry carries a
timestamp (the store is `{ [candidateId]: epochMs }`, not a bare list), entries older than
`ttlDays` (default **30**) are pruned on load and on write, and each pivot keeps at most
`maxRejections` (default **5,000**, LRU by timestamp) — "reject all remaining" over 1,800 rows
makes both limits real rather than theoretical. `UI.pivots.rememberRejections: false` disables the
store entirely, which is also the answer for a consumer whose ids are sensitive (P4) and the
switch a privacy review will ask for.

**P12 — The store is an interface with a `localStorage` default.**
`PivotRejectionStore` is three methods (`load`, `save`, `clear`), the built-in implementation is
the `localStorage` one P4 chose, and `UI.pivots.rejectionStore` accepts another. This costs one
small interface and makes the server-backed case additive rather than breaking. It is *not* a
hedge against P4: the default is unconditional, needs no configuration, and is what every test in
§13 exercises.

**P13 — Undo after save is canvas-only, and says so.**
Undoing a saved run removes the nodes from the graph and **does not** remove anything from the
source system. The library will not issue compensating writes: that is a distributed transaction
wearing a ⌘Z costume, it needs partial-failure handling of its own, and the workspaces umbrella
already reached the same conclusion from the other direction (its §4, the argument that dropped
undo entirely). So the ledger drops with the run, the UI states plainly that saved data stays in
the source system, and `PivotRun` gains a `saved` count so a surface can warn before the click
rather than after it.

**This is now the library's general rule, not this document's local one** *(settled
2026-09-04; `undo-history.md` H6 was amended to match)*. The history and this document had
reached opposite answers about the same condition — the element is in a backend. One rule
replaced both, and it turns on the direction of the write: **undo always takes things off the
canvas, and never resurrects what the backend deleted.** A save is a write in the creation
direction, so it falls on the reversible side, exactly as this decision wanted.

Two things follow, and both are already built:

- **The warning surface exists.** A run's history entry is marked `persisted` when its save
  succeeds; the row is then chipped *saved* and the menu's footer counts what a span would leave
  behind (`3 items saved upstream`). `PivotRun.saved` still earns its place for the panel, but
  the history needs nothing new.
- **Partial saves stay expressible.** Sealing is per-entry, and a run that wrote 9 of 12 nodes
  could not have been sealed honestly. Because nothing about a save seals, the question never
  arises — which is a cost the alternative would have imposed on this document's own P10.

## 7. The shape of the door

Everything below is additive. No existing signature changes.

```ts
/** Added to PivotDefinition — the write half of a contract that is otherwise read-only. */
export interface PivotDefinition {
    // ... id, label, icon, origin, appliesTo, summarize, fetch, autoIngest, maxCandidates

    /**
     * Write this run's result back to the source system (P1). Omit it and the pivot's
     * results are *not savable* (P5) — no ledger entry, no count, no Save button.
     * Never called by the library on its own: an explicit Save, or `autoSave` (P2).
     */
    save?: (payload: PivotSavePayload, ctx: PivotSaveContext) => PivotSaveOutcome | Promise<PivotSaveOutcome>

    /** Save each run the moment it lands, with no gesture (P2). @default false */
    autoSave?: boolean
}

/** What the consumer is asked to write. Live graph objects, not raw fragments. */
export interface PivotSavePayload {
    runId: string
    pivotId: string
    /** The nodes the pivot was run on — the source system's "which event does this attach to". */
    origin: Node[]
    /** New nodes this run created, containers before their children (P6). */
    nodes: Node[]
    /** Union-added children (D7), flattened, each with its container reachable via `parentNode`. */
    children: Node[]
    edges: Edge[]
    /**
     * Already on canvas before this run; vouched for, not created. Context only —
     * writing these is the job of the run that produced them (P6).
     */
    vouched: { nodes: Node[], edges: Edge[] }
    /** 1 on the first attempt. A retry carries only what is still unsaved. */
    attempt: number
}

/** Mirrors PivotContext, minus the narrowing concerns. `signal` is never aborted by the library (P10 note, §11.4). */
export interface PivotSaveContext {
    graph: Graph
    pivotId: string
    signal: AbortSignal
}

/**
 * `void` or `true` means everything in the payload was written. `false` means none of it.
 * An object reports a partial write — anything not named is treated as still unsaved.
 * Throwing is equivalent to `false`, with the error surfaced in the retry toast.
 */
export type PivotSaveOutcome =
    | void
    | boolean
    | {
        savedNodeIds?: string[]
        savedEdgeIds?: string[]
        /** Ids the source system assigned, keyed by the local id (P8). */
        canonicalIds?: Record<string, string>
        /** Shown verbatim in the result toast — why the rest did not save. */
        message?: string
    }

/** What `graph.pivots.save()` resolves with. Exact, not advisory (§0). */
export interface PivotSaveReport {
    runs: number
    savedNodes: number
    savedEdges: number
    /** Still unsaved after this attempt — what a Retry would send. */
    pendingNodes: number
    pendingEdges: number
    errors: Array<{ runId: string, error: unknown }>
}
```

**The ledger and the store:**

```ts
// Saving — a run id, a pivot id, or everything (§15.2)
await graph.pivots.save(target?: string): Promise<PivotSaveReport>

// Reading the ledger
graph.pivots.unsaved(): PivotRun[]                       // savable runs not yet fully written
graph.pivots.unsavedCount(pivotId?: string): { nodes: number, edges: number }
graph.pivots.isSaved(element: Node | Edge): boolean       // false for unsaved AND for not-savable
graph.pivots.isSavable(element: Node | Edge): boolean     // P5's distinction, made queryable
graph.pivots.canonicalId(element: Node | Edge): string | undefined   // P8

// Rejections stay exactly what D14 built: a session Map, and nothing more (P4′).
graph.pivots.rejectedIds(pivotId): string[]
graph.pivots.unreject(pivotId, id): void
```

**Options.** The `UI.pivots` group this document proposed existed to hold six storage settings.
P4′ removed five of them, and a group with one member is worse than no group — so the one that
survived joins the flat root-level `pivot*` options M1 and M3 already established
(`pivotCandidateCeiling`, `pivotRimBadge`), with a manager field beside `candidateCeiling` and
`rimBadge` so it can be changed at runtime the same way:

```ts
new Pivotick(el, data, {
    pivots: [objectPivot],
    /** A `pvt-node-unsaved` class on what a run created and has not written back. @default false */
    pivotMarkUnsaved: true,
})

graph.pivots.markUnsaved = false   // and at runtime, like `rimBadge`
```

**Events.** The ledger changes are announced through the existing `PivotChange` bus that M1
already emits (`graph.pivots.on(...)`), widening a union of four
(`'registry' | 'summarize' | 'candidates' | 'runs'`, `src/PivotManager.ts:14`) with two more:
`'save'` (the ledger moved) and `'rejections'` (the store was loaded, written or cleared). The
panel already re-renders on this bus, so both surfaces follow for free. No new event system, and
`dataBatchChanged` is *not* fired: saving changes no graph data. The one exception is P8's
aliases, which are pivot state, not node data, and stay off the data bus too.

## 8. What the consumer does

**the event platform — objects the analyst keeps become real objects in the event.**

```ts
const objectPivot: PivotDefinition = {
    id: 'objects',
    label: 'Objects & attributes',
    autoIngest: true,          // D13 — the source system's own data, no triage
    autoSave: false,           // but writing back is still a decision (P2)
    fetch: (nodes, _n, ctx) => api.objects(nodes[0].id, { signal: ctx.signal }),
    save: async ({ origin, nodes, children, edges }, ctx) => {
        const created = await api.createObjects(origin[0].id, [...nodes, ...children].map(toMisp), {
            signal: ctx.signal,
        })
        return {
            savedNodeIds: created.ok.map(o => o.localId),
            savedEdgeIds: edges.map(e => e.id),          // relationships ride with their objects
            canonicalIds: Object.fromEntries(created.ok.map(o => [o.localId, o.uuid])),   // P8
            message: created.failed.length ? `${created.failed.length} refused by the server` : undefined,
        }
    },
}
```

The second run of that pivot on the same event now returns the twelve objects under their the event platform
UUIDs. Because P8 recorded the aliases, dedup recognises them and the analyst sees "12 already on
canvas" instead of twelve duplicates — which is the whole reason `canonicalIds` exists.

**the correlation engine — a correlation pivot that cannot write, and says nothing about saving.**

```ts
const correlationPivot: PivotDefinition = {
    id: 'correlations',
    label: 'Correlations',
    summarize: (nodes, narrowing, ctx) => api.count(nodes, narrowing, { signal: ctx.signal }),
    fetch: (nodes, narrowing, ctx) => api.correlations(nodes, narrowing, { signal: ctx.signal }),
    maxCandidates: 2000,
    // no `save` — these correlations are derived, not authored. P5: nothing is ever
    // reported as unsaved, and no Save button appears for this pivot's runs.
}
```

**A pivot whose data is the source's own already — hands-off end to end (P2):**

```ts
const objects: PivotDefinition = {
    id: 'objects',
    label: 'Objects & attributes',
    autoIngest: true,    // D13 — no triage
    autoSave: true,      // …and no gesture: saving these is an update, not a decision
    fetch: (nodes, _n, ctx) => api.objects(nodes[0].id, { signal: ctx.signal }),
    save: payload => api.createObjects(payload.origin[0].id, payload.nodes),
}
```

## 9. Why this is cheap — what already holds

- **The run records are the payload.** `PivotRun` already separates created from vouched, and
  already lists children (§4.1). The save payload is a projection of a record that exists.
- **The ledger is a `Map` beside an identical one.** D16's provenance records are
  `elementId → SourceRecord[]`; the ledger is `elementId → { runId, at }`. Same key space, same
  lifetime, same removal rules (undo drops both).
- **The toast is built.** M2 shipped the actionable notification with `update()`, which is exactly
  a "Saved 9 of 12 — Retry" that rewrites itself to "Saved 12" (§4.1).
- **The panel is built.** M3's `PivotPanel` already re-renders on `PivotChange`; the unsaved line
  is one more row in a slot that already exists, and `panelWidth: 300` already accommodates it.
- **Dedup is one function.** P8's aliases are consulted in exactly the two places that already
  compare candidate ids against the canvas (ingest dedup, children union).
- **Nothing here is on the render path.** No new drawer, no simulation change, no layout effect.
  The only visual is a count, a button and an optional class.

## 10. Ruling on the workspaces collision

The July 2026 workspaces umbrella (`graph-workspaces-overview.md`) mapped five PRDs, and its
**C** — `staging-overlay-and-promotion.md`, never written — was given "selection-scoped
promotion; `onBeforePromote`; the closure rule; attribute merge policy; Discard / Revert". That
is adjacent enough to this document to need an explicit ruling, and the map is now out of date in
a way that will mislead whoever reads it next.

**What the pivot PRD has already shipped, under other names:**

| C's item | Shipped as |
|---|---|
| provisional lifecycle | `PivotCandidateSet` — candidates stage, never touch the graph (M1/M2) |
| selection-scoped promotion | marking rows and ingesting the marked subset (M2) |
| the closure rule (promoting an edge promotes its endpoints) | D24, inverted and stricter — an edge lands iff both endpoints do |
| `onBeforePromote` | `onBeforeIngest` (D9), same veto idiom, already built |
| Discard / Revert | `discard()` and run undo (D25) |

**What is left of C:** the two-tier canonical/overlay store, which is only meaningful once
workspaces exist, and the **attribute merge policy**, which is still open and which §12 of this
document re-parks rather than takes.

**PRD D (`expansion-provider.md`) is fully superseded.** `PivotDefinition` *is* `ExpansionProvider`
with a better name, an explicit narrowing phase and a shipped implementation. W13's "provenance is
attributed at the provider boundary" is now attributed at the pivot boundary, and P3 leans on
exactly that argument.

**PRD E (`provenance-log.md`) is half-shipped and, by luck, not blocked.** D16's run-scoped records
are E's entry model. W12 insisted `parentEntryId` be recorded from the first version because
parentage cannot be reconstructed later — and it was not recorded. It survives anyway: a run's
*origin* nodes carry their own provenance records, so the run that produced the origin is always
derivable, and the investigation tree can still be built from what M1 stores. Worth stating
plainly, because the umbrella's warning was correct in general and is only satisfied here by
accident.

**Two umbrella decisions are already contradicted by shipped code, and this document does not
resolve them — it reports them:** W5 dropped undo/redo from the roadmap entirely, and D25 then
shipped pivot-run undo/redo (deliberately, with the general history engine still refused). W4 made
promotion async and vetoable through `onBeforePromote`; that hook now exists as `onBeforeIngest`.
The umbrella says it "wins until amended". **It needs amending, and that is the owner's call, not this
document's** — §11.5.

## 11. Open questions

1. **Does an edge save separately from its nodes?** **Settled 2026-09-04: the report is taken at
   face value.** A save that names an edge written but not the nodes it connects is recorded
   exactly as it says — the ledger does not clamp an edge to its endpoints, and the count reads
   "1 edge saved, 2 nodes pending" without apology. What the source system says it wrote is not
   the library's to overrule, and the alternative would have had the library silently contradict
   the consumer it just asked. One line in `PivotSaveOutcome`'s docs carries it; no surface was
   needed, because the count already expresses it.
2. **Should stored rejection ids be hashed?** **Moot.** P4′ dropped the store, so no id reaches
   disk. Kept as a numbered entry so §11's numbering does not shift under the references to it.
3. **What is the ledger's lifetime across a reload?** P4 persists *rejections*; the save ledger is
   session-scoped like the runs it hangs off, so a reload forgets that twelve nodes were unsaved —
   along with the nodes themselves, which is why it is defensible. It stops being defensible only
   where the *nodes* come back without the ledger. **Not `applyViewState`**, despite an earlier
   draft of this note saying so: PRD A's §5 is explicit that a snapshot references the dataset and
   never copies it, and its `overlay` — the one field that could hold staged data — is specified
   as always empty until PRD C. The case that does bite is a consumer persisting its own dataset,
   which needs no PRD at all: ingested nodes sit in the graph like any others, so they come back
   unmarked. Cheap to leave open while nothing here is built.
4. **Should a save be cancellable?** **Closed as built.** `ctx.signal` is in the contract and the
   library aborts it in exactly one place: `destroy()`, which was the only case this note left
   open. Nothing else does — not leaving Pivot mode, not a second Save (that is refused as a
   no-op rather than superseding the first). Cancelling a write mid-flight leaves nobody knowing
   what happened, and at `destroy()` there is nobody left to tell.
5. **Amending the workspaces umbrella** (§10). **Done 2026-09-04**, as instructed: W4 and
   W5 carry supersession notes, PRD D is marked superseded, and PRD C's remaining scope is
   narrowed to the two-tier store and the attribute merge policy.
6. **Does the unsaved count belong on the rim?** Still open, and unchanged by what shipped:
   `pivotMarkUnsaved` is a class and an off-by-default option rather than a badge, because D12
   already rations two free corners on exactly the container nodes such a backend produces. The default
   style is a dashed rim, which costs no corner. If real use wants a badge, it should be designed
   against that constraint rather than bolted on.
7. **Should the post-ingest toast offer Save?** New, and only askable now — see §15.9. The action
   slot P7 reasoned was spent is free.

## 12. Not in scope

- **Refreshing existing nodes from the source.** The "stale attributes" problem D7 and D23 both
  deferred *to this document* is deferred again, deliberately: it needs a conflict policy (one
  source says `country=US`, another `NL`), and per-field lineage turns `NodeData` from a flat bag
  into something with structure — a public-type change with wide blast radius. The workspaces
  umbrella independently reached the same conclusion and flagged it as needing a grilling session
  of its own (its §8.1, "attribute merge policy"). **That session is the prerequisite; this PRD is
  not it.** D23 stands unchanged in the meantime: an id-matched candidate leaves the existing node
  untouched.
- **Persisting anything a user did by hand** (P3) — the gesture hooks own it.
- **Compensating writes / undoing a save** (P13).
- **Credentials, transport, retry policy, rate limiting, conflict detection, optimistic
  concurrency.** D20 stands: the consumer owns all of it. The library's only retry is the analyst
  pressing Retry.
- **Server-side or cross-device rejection storage.** P12 leaves the seam; shipping a server store
  is the consumer's.
- **A general dirty-tracking layer over the whole dataset** — that is what P3 declined, and it is
  what `graph.save()` would have been.

## 13. Tests and docs

Visual specs under `tests/visual/`, extending the fake provider the pivot suite already uses (it
resolves, rejects, aborts and returns a deliberately large candidate set) with a `save` that can
succeed, half-succeed, throw and mint ids on demand.

**The ledger**

- A pivot with no `save`: nothing is ever counted unsaved, and no Save affordance appears (P5).
- Ingest 12, panel reads `12 unsaved`; Save; it clears and the toast says so.
- A half-succeeding save reads `Saved 9 of 12 — Retry`; the retry payload carries exactly the 3,
  with `attempt: 2`; the count then clears.
- A throwing save leaves all 12 unsaved, keeps every node on canvas (P10), and offers Retry.
- Two runs of two pivots: saving one leaves the other's count untouched; a node created by run A
  and vouched by run B saves with A (P6).
- `autoSave` writes with no gesture; a failed `autoSave` reports through the notifier and leaves
  the data unsaved rather than removing it.
- Undo after save empties the canvas and drops the ledger entry; the warning names the source
  system (P13).

**Ids**

- A save returning `canonicalIds`, then a re-run returning the canonical ids, dedups instead of
  duplicating — the case P8 exists for, and the one that fails silently without it.
- `graph.pivots.canonicalId(node)` reads back; the node's own id is unchanged.

**The surfaces** *(added — S2's states were not in the original list, and they are what an
analyst actually reads)*

- The panel's line is away at zero, reads `n unsaved` once a run lands, and goes again on a save.
- A partial save leaves the count at what is left; the retry rewrites *the same* toast rather
  than stacking a second one, and reports the whole rather than its own share.
- A triage pane carries its own provider's count and saves only that provider's runs.
- `pivotMarkUnsaved` marks what has not been written, and unmarks it once it has.

**Not tested, because it no longer exists:** everything under the original *Rejections* heading
(storage, TTL, cap, opt-out, quota failure, two graphs on one page, `clearRejections`). P4′.

**Docs.** A *Saving results* section in `docs/pivots.md` (the page M3 shipped), carrying the
pipeline diagram extended by one step, the `save` contract, the outcome table, the canonical-id
story and the honest statement that undo does not reach the source system (P13). The storage note
became its opposite: a *What this is not* bullet saying rejections are held for the session and no
further, with P4′'s reason. The `pivot-enrichment` gallery card gained a save-back — one provider
that refuses every fifth node so the partial retry is demonstrable, one `autoIngest` +
`autoSave` provider, and one with no `save` at all so the *not savable* third state is visible.

## 14. Work plan

**S1 — the contract and the ledger.** `save` / `autoSave` on `PivotDefinition`, the save types
(§7), the per-element ledger, `graph.pivots.save/unsaved/isSaved/isSavable`, partial failure and
retry-only-what-failed, P8's aliases including the two dedup call sites, `PivotChange: 'save'`,
and the result/retry toast. No panel work: drivable entirely from the console, and every ledger
test above is reachable here.

**S2 — the surfaces.** The unsaved line and Save button in `PivotPanel`, the same line in a triage
pane header, `markUnsaved`, and the honest states — nothing to save, saving…, partial, and the
undo-after-save warning (P13). Depends on S1; touches no data path.

**S3 — remembered rejections.** ~~`PivotRejectionStore`, the `localStorage` implementation, P9's
key resolution, P11's TTL / cap / opt-out, `clearRejections()`.~~ **Cancelled by P4′.** Nothing of
it was built, and nothing of it should be: the reversal is an argument against the feature, not
against one implementation of it.

No library-wide changes were needed, which is the point of §9: unlike M3 (which needed four
rail-mode additions) and M2 (which needed the actionable toast and `DockTabHandle.setLabel`),
every surface this document landed on was built by the milestone before it. The one exception is
`GraphHistory.markPersisted` (§15.4), which is four lines.

## 15. What was actually built, where it departed from §7, and why

Ten notes. Every one of them is a place a reader of §7 alone would guess wrong.

**15.1 — The ledger does not drop with the run; *pending* is computed against the canvas.**
P13 said "the ledger drops with the run", and taken literally that breaks redo: undo removes a
saved run's nodes, redo puts the same nodes back, and a dropped ledger would present them as
unsaved and invite a second write of twelve objects the source system already has. So the run
records and the saved set are kept for the session, and what a run has *pending* is its created
ids minus the written ones minus **the ones no longer on the canvas**. An undone run therefore
has nothing pending and is absent from every count without its record having to go, and a redone
one comes back exactly as saved as it was. P13's actual content — no compensating writes, undo is
canvas-only — is untouched.

**15.2 — `save` takes a run id *or* a pivot id.** §7 specified `save(runId?)`. A triage pane's
own Save means "write what this provider has ingested", and a provider may have been ingested
more than once, so `save(pivotId)` was needed and a loop of `save(runId)` calls would have
produced one toast per run. The two never collide: a run id is `<pivotId>#<n>`. `unsavedCount()`
took the same optional narrowing, which is what the pane's header reads.

**15.3 — `PivotRun` gained `origin` as well as `saved`.** §7's payload carries `origin`, and the
run record had it only inside `restage`, which is an optional field about re-staging rather than
about the run. It is now a field of its own, and the payload is the projection §9 claims it is.

**15.4 — `GraphHistory.markPersisted(entryId)` is new.** P13 wanted a run's history entry marked
`persisted` when its save succeeds; nothing could mark one after the fact. Four lines, `@private`,
beside `recordPivotRun`. **Only a run written whole is marked** — a run that wrote 9 of 12 has not
been persisted, and saying so would license an undo warning that is false for a quarter of it.
Everything downstream of the flag (the *saved* chip, the footer's canvas-only count) was already
built, exactly as P13 predicted.

**15.5 — Canonical ids are resolved at the fetch boundary, not at the two dedup sites.** P8 named
"ingest dedup and the children union" as the two call sites. Doing it there would have missed a
third: an edge whose *endpoints* are canonical ids, which `addEdge` would fail on — and that is
the normal case, since a re-run returns relationships alongside the objects. A `deAlias` pass over
the incoming `PivotResult` rewrites node ids, nested children and edge endpoints once, so nothing
downstream has to know aliases exist. Strictly more correct, and one place instead of three.

**15.6 — The unsaved marker repaints on ingest, not only on save.** A run's nodes are drawn by
the ingest batch *before* the run is enrolled in the ledger, so they are drawn as not-savable and
nothing asks again. `enrol` is now followed by a repaint. Found by a test that read zero marked
nodes where it wanted twelve.

**15.7 — The retry toast reports the whole, not its own share.** §7 pictured `Saved 9 of 12`
becoming `Saved 12`. A first pass reported each attempt separately, so a retry that finished the
job read `Saved 3` and left the analyst to add up. The running total is carried through the retry
chain instead, which also makes `Saved 10 of 27` right on a second partial attempt.

**15.8 — The toast lives in the manager.** So a save driven from the console reports itself the
same way the panel's button does — which is what makes S1 "drivable entirely from the console"
true of the reporting as well as the ledger. It follows the precedent `report()` already set for
the auto-ingest paths.

**15.9 — §4.3.1's premise went stale before this was built, and P7 survives anyway.** That
constraint reasoned from "the post-ingest toast has already spent its one action slot on D25's
Undo". It has not: the undo-history work moved undo to the top bar permanently and left the ingest
toast plain (`PivotTriage.toastIngest`), so the slot is free. P7's *conclusion* was built as
written, because its second argument is the load-bearing one — Save is a deliberate act still
available five minutes later, and the panel is where the analyst already is. **Worth revisiting
deliberately**: a Save on the post-ingest toast is now available and was not when P7 was written.
It was not added here, because adding it is a design decision this document did not take.

**15.10 — A stale line in `docs/pivots.md` was corrected in passing.** The step-6 walkthrough
still said the ingest toast "carries **Undo**", which stopped being true for the same reason
15.9 gives. One sentence, in the section the new one sits under.

### Where it lives

| | |
|---|---|
| Contract and types | `src/interfaces/Pivot.ts` — `save`, `autoSave`, `PivotSavePayload`, `PivotSaveContext`, `PivotSaveOutcome`, `PivotSaveReport`, `PivotRun.origin`, `PivotRun.saved` |
| Ledger and `save` | `src/PivotManager.ts` — the `--- saving ---` block, plus `deAlias` in `stage` and `enrol` in `ingest` |
| History | `src/GraphHistory.ts` — `markPersisted` |
| Panel | `src/ui/elements/Pivot/PivotPanel.ts` — `paintUnsaved`, `save` |
| Pane | `src/ui/elements/Pivot/TriagePane.ts` — the `headline` segment, `save` |
| Marker | `src/renderers/svg/NodeDrawer.ts`, `src/styles/_pivotick.scss`, `pivotMarkUnsaved` |
| Tests | `tests/visual/specs/pivot-save.spec.ts` (15), harness `SaveBehavior` / `serveSave` |
| Docs | `docs/pivots.md` *Saving results*, `docs/examples/gallery/pivot-enrichment/` |
| Dev page | `src/pivot-demo.ts` — the Save / Auto-save / Mark knobs and a Save button |

