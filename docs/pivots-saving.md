# Saving pivot results

[Pivots & enrichment](/pivots) ends with an ingest: the chosen candidates are on the canvas,
tagged with the pivot that brought them, and nowhere else. `save` is the step back out — the
pivot writes its own results into the system they came from, and the library keeps the books
on what has crossed.

```
summarize  →  fetch  →  triage  →  ingest  →  save
  "2,143"     the 210    the 12    on canvas   in the source system
```

The library never writes anywhere itself and holds no credentials. What it contributes is
the bookkeeping — which elements a run created, whether they have been written, which ones
failed, and what a retry should carry — because that is the part only it knows.

## Declaring one

```js
const objects = {
    id: 'objects',
    label: 'Objects & attributes',
    fetch: (nodes, narrowing, ctx) => api.objects(nodes[0].id, { signal: ctx.signal }),

    save: async ({ origin, nodes, children, edges }, ctx) => {
        const written = await api.createObjects(origin[0].id, [...nodes, ...children], {
            signal: ctx.signal,
        })
        return {
            savedNodeIds: written.ok.map(o => o.localId),
            savedEdgeIds: edges.map(e => e.id),
            canonicalIds: Object.fromEntries(written.ok.map(o => [o.localId, o.uuid])),
            message: written.failed.length ? `${written.failed.length} refused` : undefined,
        }
    },
}
```

The payload is live graph objects, not raw fragments:

| Field | What it holds |
|---|---|
| `origin` | what the pivot was run on — "which event does this attach to" |
| `nodes` | the nodes this run created |
| `children` | union-added container contents, flattened; each reachable from its container through `parentNode` |
| `edges` | the edges this run created |
| `vouched` | what was already on the canvas before this run |
| `attempt` | `1` the first time, higher on a retry |

**Omit `save` and the pivot's results are *not savable*.** They never enter the ledger, are
never counted unsaved, and no Save appears for them. That is the right declaration for a
pivot over derived data — a correlation engine's output is not yours to write back — and it
is what stops a permanent "210 unsaved" with no remedy.

## What you return

| Returned | Means |
|---|---|
| `undefined` / `true` | the whole payload was written |
| `false`, or throwing | none of it was; the error reaches the retry toast |
| `{ savedNodeIds, savedEdgeIds }` | a partial write — **anything not named stays unsaved** |
| `{ canonicalIds }` | ids the source system assigned, keyed by the local id |
| `{ message }` | shown verbatim in the result toast |

`savedNodeIds` covers `nodes` and `children` together. An id naming an element this run did
not create is ignored: a pivot never writes what it did not produce, so it cannot report it
written either.

A save that reports an edge written but not the nodes it connects is taken at face value.
What the source system says it wrote is not the library's to overrule.

## Asking for one

```js
await graph.pivots.save()          // every savable run with something still unsaved
await graph.pivots.save(runId)     // one run
await graph.pivots.save(pivotId)   // every unsaved run of one pivot

graph.pivots.unsaved()             // the runs still waiting
graph.pivots.unsavedCount()        // { nodes, edges } — exact, not advisory
graph.pivots.unsavedCount(pivotId) // one pivot's share of it
graph.pivots.isSaved(node)         // false for the unsaved *and* the not-savable
graph.pivots.isSavable(node)       // which of those two it is
```

Runs go one at a time, and each is sent only what is still unsaved — so a retry is the same
call. The result arrives as a toast: `Saved 12 nodes`, or `Saved 9 of 12` with a **Retry**
that takes over that same toast rather than stacking a second one.

In the UI the count and the button live at the foot of the Pivot panel, and a Review pane
carries its own provider's share in its header. Nothing appears while the number is zero.

`autoSave: true` writes each run the moment it lands, with no gesture. It runs after the
ingest resolves rather than inside it, so a slow backend never holds up the canvas, and a
failure reports through the notifier and leaves the data where it is. Pair it with
`autoIngest: true` for a pivot that is hands-off end to end — expanding an event into
objects that are already the source's own.

## Ids the source system mints

Saving usually creates something, and the thing created usually gets an id of the source
system's choosing — not the one your provider used while it was a candidate. Left alone,
that is a bug the feature creates for itself: tomorrow's run returns the same objects under
their new ids, dedup does not recognise them, and the analyst gets twelve duplicates of
what they saved yesterday.

Return `canonicalIds` and the library keeps the alias. Ingest dedup, the children union and
edge endpoints all consult it, so the re-run says *12 already on canvas* instead.

```js
graph.pivots.canonicalId(node)   // 'a1b2…' — the id the source assigned
```

::: details Why the node keeps the id it landed under
Re-keying would reach into edges, clusters, selection, the query engine, provenance and the
history, for a benefit the alias already delivers where it matters. The honest cost:
`graph.getNode(canonicalId)` still misses, and `canonicalId()` is the read that does not.
:::

## Undo does not reach the source system

Undoing a saved run removes its nodes from the canvas. It does **not** remove anything from
the system they were written to, and the library will not issue compensating writes — that
is a distributed transaction wearing a ⌘Z costume.

The history says so rather than leaving you to find out: a run marked written-through is
chipped **saved**, and the menu's footer counts what a span would leave behind. `PivotRun`
carries a `saved` count for a surface that wants to warn before the click. See
[Undo & history](/history) for how it treats a persisted entry.

A failed save never touches the canvas either. The analyst accepted those twelve nodes; a
backend refusal is information about the backend, not a reversal of their decision. They
stay, stay unsaved, and stay retryable.

## Marking unsaved nodes

```js
new Pivotick(el, data, { pivots: [objects], pivotMarkUnsaved: true })
```

Puts a `pvt-node-unsaved` class on every node a run created and has not written back, which
a stylesheet can pick up — the default is a dashed rim. Off by default, and a class rather
than a rim badge: a node has four rim corners and only two once it has children, and a
marker that pushes a declared potential off the rim costs more than it says.
