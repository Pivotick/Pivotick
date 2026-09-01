# Feature — pivot persistence: saving an ingested result back, and remembering rejections

**Status:** Proposed — the follow-up [`pivot-enrichment-interface.md`](pivot-enrichment-interface.md) §12 parked ("*persisting or saving an ingested pivot result back to the source system. Its own PRD, still to be written; rejection persistence (D14) belongs with it*"). Scoped with Sami on 2026-09-01, after that PRD's M1–M3 were all built. Four shaping questions are answered (§6, P1–P4); the rest of §6 is derived from them and from what the built runtime already does. **Nothing here is built yet.**
**Owner:** Sami Mokaddem
**Requested:** 2026-09-01
**Area:** `src/PivotManager.ts` (the save ledger, the rejection store, `save`), `src/interfaces/Pivot.ts` (`save` / `autoSave` on `PivotDefinition`, the save types), `src/ui/elements/Pivot/PivotPanel.ts` + `TriagePane.ts` (the unsaved count and the Save affordance), `src/ui/Notifier.ts` (the result and retry toasts — no change needed, see §4.3), `src/interfaces/GraphOptions.ts` (a storage key, and the option group for the store). Additive — no breaking changes to anything M1–M3 shipped.
**Type:** data-path capability — a second half to the pivot pipeline (`summarize` → `fetch` → triage → **ingest** → **save**), plus the library's first use of browser storage.
**Related:** [`pivot-enrichment-interface.md`](pivot-enrichment-interface.md) (D7, D8, D13, D14, D16, D23, D25 and D27 all constrain this document — it may not contradict them), `misp/write-path-lifecycle-hooks.md` and `edge-create-veto-hook.md` (the five gesture hooks, which already own persistence for everything a *user* does by hand — §4.1), `graph-workspaces-overview.md` + its unwritten PRD **C** `staging-overlay-and-promotion.md` (§10 rules on the collision — most of C has since been shipped under other names, and this document takes the rest of its save half), `view-state-serialization.md` (PRD A of that effort; the rejected alternative home for the rejection store, P4).

---

## 0. Instructions

§6's decisions were taken deliberately; if the implementation makes one look wrong, **say so and
stop** rather than quietly choosing differently. §11 is genuinely open — ask before picking.
**P4 in particular is Sami's overrule of this document's own recommendation**: it is settled, and
§6's P4 records the case against it so the cost is chosen with open eyes rather than rediscovered
halfway through S3.

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
the analyst redoes by hand, in MISP's own UI, from memory.

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
| **Source system** | Whatever the provider fetched from — MISP, AIL, a case management system. Pivotick never talks to it directly and holds no credentials. |
| **Unsaved** | An element a pivot run created that has not been confirmed written. A precise ledger, not an estimate. |
| **Not savable** | An element whose pivot declared no `save`. It is never counted as unsaved — P5, which is what keeps the count honest. |
| **Canonical id** | The id the source system assigns on save, which is usually **not** the id the provider used while it was a candidate (P8). |
| **Remembered rejection** | A `(pivotId, candidateId)` pair the analyst explicitly rejected, surviving a reload (P4). |

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
data; nothing in M1–M3 writes anywhere), and MISP is a system with its own write API and its own
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
- **Remembered rejections** in `localStorage` (P4) — namespaced, timestamped, expiring, capped,
  and degrading to memory whenever storage is unavailable — plus `clearRejections()` and the pane
  affordance that reveals and clears them.
- A docs section and a gallery-card update, both on surfaces that already exist.

Not shipped, named here so the boundary is visible from the summary: **no refresh of existing
nodes from the source** (§12), no write path for manual edits (P3), no rollback of the canvas on
a failed save (P10), and no credential, retry or transport policy of any kind (D20 stands).

## 6. Decisions taken

P1–P4 are Sami's answers to the four shaping questions (2026-09-01). P5–P13 are derived — each
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
trusted (D4, D14) — writing into a shared MISP event unasked is the least defensible default in
the document, and an analyst who ingests twelve nodes to *look* at them has not decided anything
about MISP yet. The opt-in exists because the symmetrical case is real and already has a name:
D13's `autoIngest` for MISP's expand-an-event, where the objects are already MISP's own and
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

**P4 — Remembered rejections live in `localStorage`, owned by the library.** *(Sami's ruling,
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
default is what Sami chose; the seam is what stops the choice from being permanent.

**P5 — A pivot with no `save` produces nothing unsaved.**
Savability is declared, exactly as narrowing is (`summarize` omitted ⇒ no narrowing). Elements
from a pivot with no `save` are *not savable* rather than *unsaved*: they never enter the ledger,
never appear in a count, and the Save affordance does not exist for them. Without this rule an
AIL correlation pivot that can never write anywhere would show a permanent, unfixable "210
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
Saving into MISP creates an object, and MISP assigns it a UUID that is not the provider's
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
    /** The nodes the pivot was run on — MISP's "which event does this attach to". */
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
// Saving — one run, or every unsaved savable run
await graph.pivots.save(runId?: string): Promise<PivotSaveReport>

// Reading the ledger
graph.pivots.unsaved(): PivotRun[]                       // savable runs not yet fully written
graph.pivots.unsavedCount(): { nodes: number, edges: number }
graph.pivots.isSaved(element: Node | Edge): boolean       // false for unsaved AND for not-savable
graph.pivots.isSavable(element: Node | Edge): boolean     // P5's distinction, made queryable
graph.pivots.canonicalId(element: Node | Edge): string | undefined   // P8

// Remembered rejections (P4, P11, P12)
graph.pivots.clearRejections(pivotId?: string): void

export interface PivotRejectionStore {
    load(): Record<string, Record<string, number>>        // pivotId -> candidateId -> epochMs
    save(state: Record<string, Record<string, number>>): void
    clear(): void
}
```

**Options.** `GraphUI` has no pivot *group* today — M3 shipped a single flat `UI.pivotMode`
(`src/interfaces/GraphUI.ts:100`). This document adds one, and deliberately leaves `pivotMode`
where it is: moving it under the group would be a breaking change for every consumer M3 already
has, for tidiness alone. The asymmetry is the cheaper of two bad options and should be stated in
the docs rather than quietly lived with.

```ts
UI: {
    pivots?: {
        /** Storage identity (P9). Falls back to the container's DOM id, then to memory. */
        storageKey?: string
        /** @default true */
        rememberRejections?: boolean
        /** @default 30 */
        ttlDays?: number
        /** @default 5000, per pivot, LRU by timestamp */
        maxRejections?: number
        /** Swap the localStorage default for your own (P12). */
        rejectionStore?: PivotRejectionStore
        /** Mark unsaved nodes with a `pvt-unsaved` class for styling. @default false */
        markUnsaved?: boolean
    }
}
```

**Events.** The ledger changes are announced through the existing `PivotChange` bus that M1
already emits (`graph.pivots.on(...)`), widening a union of four
(`'registry' | 'summarize' | 'candidates' | 'runs'`, `src/PivotManager.ts:14`) with two more:
`'save'` (the ledger moved) and `'rejections'` (the store was loaded, written or cleared). The
panel already re-renders on this bus, so both surfaces follow for free. No new event system, and
`dataBatchChanged` is *not* fired: saving changes no graph data. The one exception is P8's
aliases, which are pivot state, not node data, and stay off the data bus too.

## 8. What the consumer does

**MISP — objects the analyst keeps become real objects in the event.**

```ts
const objectPivot: PivotDefinition = {
    id: 'misp-objects',
    label: 'Objects & attributes',
    autoIngest: true,          // D13 — MISP's own data, no triage
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

The second run of that pivot on the same event now returns the twelve objects under their MISP
UUIDs. Because P8 recorded the aliases, dedup recognises them and the analyst sees "12 already on
canvas" instead of twelve duplicates — which is the whole reason `canonicalIds` exists.

**AIL — a correlation pivot that cannot write, and says nothing about saving.**

```ts
const correlationPivot: PivotDefinition = {
    id: 'ail-correlations',
    label: 'Correlations',
    summarize: (nodes, narrowing, ctx) => api.count(nodes, narrowing, { signal: ctx.signal }),
    fetch: (nodes, narrowing, ctx) => api.correlations(nodes, narrowing, { signal: ctx.signal }),
    maxCandidates: 2000,
    // no `save` — AIL's correlations are derived, not authored. P5: nothing is ever
    // reported as unsaved, and no Save button appears for this pivot's runs.
}
```

**A consumer who wants rejections on their server instead of the browser (P12):**

```ts
new Graph(el, data, {
    pivots: [correlationPivot],
    UI: { pivots: { rejectionStore: myServerBackedStore } },
})
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
The umbrella says it "wins until amended". **It needs amending, and that is Sami's call, not this
document's** — §11.5.

## 11. Open questions

1. **Does an edge save separately from its nodes?** This document assumes not: a candidate edge
   rides with its endpoints (D24), and `save` receives both in one payload, so a backend that
   creates a relationship in a second call does it inside one `save`. The case that would break
   it is a backend where the relationship write can succeed while the node write fails — the
   outcome type can already express that (`savedNodeIds` without `savedEdgeIds`), but no surface
   explains a saved edge between unsaved nodes. Worth deciding before S2 draws anything.
2. **Should stored rejection ids be hashed?** Storing a plaintext email address or paste id in
   `localStorage` is the sharpest edge of P4. Membership tests and "reject all remaining" work
   perfectly over hashes; what breaks is *revealing* the remembered rejections after a reload
   (the pane's "5 rejected earlier ▸" would show hashes for anything not in the current candidate
   set). Cheap to add, impossible to add later without invalidating every stored set — so decide
   in S3, not after.
3. **What is the ledger's lifetime across a reload?** P4 persists *rejections*; the save ledger is
   session-scoped like the runs it hangs off, so a reload forgets that twelve nodes were unsaved —
   along with the nodes themselves, which is why it is defensible. It stops being defensible the
   moment the graph's own data is restored from a snapshot (workspaces PRD A), because then
   unsaved nodes come back with no mark. Not this document's problem yet; it becomes one the day
   `applyViewState` lands.
4. **Should a save be cancellable?** `ctx.signal` is in the contract for symmetry, but the library
   never aborts it: cancelling a write mid-flight leaves the analyst not knowing what happened,
   which is worse than waiting. Leaving Pivot mode does not cancel a save, and `destroy()` while
   one is in flight is the only genuinely open case.
5. **Amending the workspaces umbrella** (§10). Its W4 and W5 are contradicted by shipped code and
   its document map lists two superseded PRDs. Sami's call whether to amend it now or when the
   workspaces effort next moves.
6. **Does the unsaved count belong on the rim?** `markUnsaved` ships as a class and an off-by-
   default option (§7) rather than a badge, because D12 already rations two free corners on
   exactly the container nodes MISP produces. If real use wants a visible marker, it should be
   designed against that constraint, not bolted on.

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

**Rejections**

- Reject 5, reload, re-run: the pane reads `5 rejected earlier` from storage and suppresses them.
- An entry older than `ttlDays` is pruned on load; `maxRejections` evicts oldest-first.
- `rememberRejections: false` stores nothing and the pane still works.
- Storage that throws on write (quota, disabled, private mode) degrades to memory, warns once,
  and never breaks the pane — driven by stubbing `localStorage` in the page.
- Two graphs on one page with different `storageKey`s do not see each other's rejections; with no
  key and no container id, both are memory-only and warn (P9).
- `clearRejections()` empties one pivot and leaves the other.

**Docs.** A *Saving results* section in `docs/pivots.md` (the page M3 shipped), carrying the
pipeline diagram extended by one step, the `save` contract, the honest statement that undo does
not reach the source system (P13), and a storage note naming `storageKey`, the TTL and the
opt-out. The `pivot-enrichment` gallery card gains a save-back to its fake provider so the count,
the button and the partial-failure retry are demonstrable rather than described.

## 14. Work plan

**S1 — the contract and the ledger.** `save` / `autoSave` on `PivotDefinition`, the save types
(§7), the per-element ledger, `graph.pivots.save/unsaved/isSaved/isSavable`, partial failure and
retry-only-what-failed, P8's aliases including the two dedup call sites, `PivotChange: 'save'`,
and the result/retry toast. No panel work: drivable entirely from the console, and every ledger
test above is reachable here.

**S2 — the surfaces.** The unsaved line and Save button in `PivotPanel`, the same line in a triage
pane header, `markUnsaved`, and the honest states — nothing to save, saving…, partial, and the
undo-after-save warning (P13). Depends on S1; touches no data path.

**S3 — remembered rejections.** `PivotRejectionStore`, the `localStorage` implementation, P9's key
resolution and its warning, P11's TTL / cap / opt-out, `clearRejections()`, the pane's "n rejected
earlier" reading from disk, and the docs. Independent of S1 and S2 — it could ship first, and
should if the save half stalls on §11.1.

No library-wide changes are needed, which is the point of §9: unlike M3 (which needed four
rail-mode additions) and M2 (which needed the actionable toast and `DockTabHandle.setLabel`),
every surface this document lands on was built by the milestone before it.
