# Pivots & enrichment

A **pivot** is a runnable enrichment: "show me what else the source has about this". You
declare it, the library runs it, stages the results for triage and — once the analyst
says so — commits them into the graph with provenance on every element.

The problem it exists to solve is that the interesting node usually has too many
connections. A MISP attribute can correlate with thousands of others; an AIL paste with
more. So a pivot is deliberately **two calls, not one**: a cheap one that says what is out
there, and an expensive one that only ever runs on a number the analyst agreed to.

::: tip Vocabulary, used consistently everywhere below
**pivot** — the runnable enrichment · **provider** — the two functions you supply ·
**candidates** — fetched results, not yet in the graph · **ingest** — commit chosen
candidates · **reject** — an explicit act, remembered · **source** — provenance.
:::

See it working: the [Pivot & enrich](/examples/gallery/pivot-enrichment/content) gallery
card.

## Registering one

Three doors, one registry, in the order you would reach for them:

```js
// 1. Options, at construction. Lands before the UI is built, so the rail button is
//    already right on the first paint.
const graph = new Pivotick(el, data, { pivots: [correlations] })

// 2. Imperatively, at any point. Returns a disposer.
const remove = graph.pivots.register(correlations)

// 3. From a plugin's install, beside addPanel / addDockTab / addRailMode.
ctx.addPivot(correlations)
```

`graph.pivots` is the registry and the runtime both — `for()`, `run()`, `undo()`,
`invalidate()` and the candidate model all hang off it.

## The provider contract

```ts
interface PivotDefinition {
    id: string                  // provenance tag, menu key, triage tab id
    label: string               // used verbatim, so it can be translated
    icon?: string               // trusted SVG, injected as-is
    origin?: 'selection' | 'none'
    appliesTo?: (nodes: Node[]) => boolean
    summarize?: (nodes: Node[], narrowing: PivotNarrowing, ctx: PivotContext) => PivotSummary | Promise<…>
    fetch:      (nodes: Node[], narrowing: PivotNarrowing, ctx: PivotContext) => PivotResult | Promise<…>
    autoIngest?: boolean
    maxCandidates?: number
}
```

Both calls take an **array** of nodes, from day one, so a bulk pivot over fifty of them is
one backend request rather than fifty — and adding bulk later is not a breaking change.
Both take the current **narrowing**. Both get a `PivotContext` carrying `signal` and
`isStale()`, the same cancellation pattern every async hook in the library uses.

### `summarize` — the cheap one

```js
summarize: async (nodes, narrowing, { signal }) => {
    const res = await fetch('/api/correlation/count', {
        method: 'POST',
        body: JSON.stringify({ ids: nodes.map(n => n.id), types: narrowing.type }),
        signal,
    })
    const { total, byType } = await res.json()
    return {
        total,
        facets: [{
            key: 'type', label: 'Type', type: 'multiselect',
            options: byType.map(t => ({ label: t.name, value: t.name, count: t.count })),
        }],
    }
}
```

Its `total` is the number the cap is judged against, and its `facets` **become** the
narrowing controls — you declare the shape, the library draws the widgets. Pass the
narrowing on to your backend: the count has to track what the analyst chose, or the gate
can never lift.

Omit `summarize` entirely and the pivot offers no count and no narrowing, just a **Run**
button. That is legal, and then `fetch` must be safe to call blind — nothing can gate it.

### `fetch` — the real one

Returns a flat fragment: `{ nodes: RawNode[], edges: RawEdge[] }`. No returned node names
an existing on-canvas parent; nesting travels in `RawNode.children`, so a container
arrives as a new node carrying its own subtree. An **edges-only** result is legal — edges
whose endpoints are all already on canvas become triage rows of their own.

### Facet types

Narrowing uses every facet type the query engine knows **except `regex`**, which no
backend can be asked to evaluate: `text`, `select`, `multiselect`, `numberRange`,
`boolean`. Regex lives in the triage pane's own client-side filters, where the rows are
already in hand.

## Counts are advisory. Always.

`summarize` returns a claim, not a contract. It legitimately differs from what ingest
lands — dedup is the common case, then permissions, staleness, and providers that
deliberately approximate. The UI marks the difference with a tilde: `~2,143 correlations`
is the provider's number, `210 fetched` and `12 selected` are the library's own. A shrink
is never an error, and a count is never load-bearing for layout.

## Gating: the cap, and the ceiling

```js
maxCandidates: 2000              // per pivot: refuse to fetch while the count exceeds it
new Pivotick(el, data, { pivotCandidateCeiling: 10_000 })   // absolute, all pivots
```

Both **refuse**; neither truncates or samples. A refusal always carries three things in
order — the number, the limit, and the way forward — because "too many results" with no
number is not a thing an analyst can act on.

The cap is judged on the freshest count *for the current narrowing*, which is what lets it
lift: narrow from 2,143 to 210 and **Fetch** turns on by itself. The ceiling is about
memory for candidate objects rather than about the table, which virtualises.

## Candidates are not the graph

Nothing a pivot returns is in the graph, in the data table, or in any facet count until it
is ingested. Results open a **triage pane** in the dock — one per pivot, coexisting as tabs
— with the provider's own columns, the data table's filters, sorting, paging and an ingest
action.

- **Rejection is explicit and remembered** for the session, keyed per pivot: the next run
  does not offer that candidate again, and the header line says how many it suppressed.
  A rejected row is struck through **in place** rather than moved, and stays reversible.
- **Closing the pane rejects nothing.** Untriaged leftovers come back on the next run;
  *Reject all remaining* is the one gesture that disposes of them.
- **A re-run replaces its own pane** — but if you have rows marked it says so and offers
  *Show new* / *Keep triaging*, rather than throwing your triage away unasked.

Everything the pane does is also reachable programmatically:

```js
graph.pivots.candidates('correlations')      // the staged set
graph.pivots.mark('correlations', id)        // …markAll / reject / rejectRemaining
await graph.pivots.ingest('correlations')    // commit the marked ones
graph.pivots.discard('correlations')         // close it; rejects nothing
```

### `autoIngest`

For a small, trusted result that nobody wants to pick through — expanding an event into
its twelve objects — declare `autoIngest: true` and results land directly, with an undo on
the toast. There is no library threshold for this: the provider knows, and a magic number
would surprise someone.

## Ingest, and what it is allowed to do

One gesture, one batch, one `dataBatchChanged`. In order: **dedup** (an id already on
canvas is skipped, never overwritten), **children union by id**, **placement** near the
origin node (jittered; a provider's own `x`/`y` wins; an origin-less run seeds at the
viewport centre), **provenance**, then the batch lands.

Ingest is **purely additive**. The only things that ever remove are `removeBySource` and
run undo.

One gate, called once with the whole set:

```js
callbacks: {
    onBeforeIngest: async ({ pivotId, origin, candidates, trigger, confirm }) => {
        if (candidates.nodes.length < 50) return true
        return await confirm({ title: `Add ${candidates.nodes.length} nodes?` })
    },
}
```

Return `false` to veto, or `{ accept: true, nodes, edges }` to land a subset — an omitted
key means "as requested", exactly as `onBeforeDelete` reads.

## Provenance

Every node and edge carries the **set** of sources vouching for it. A set rather than a
scalar because two pivots overlapping on one node is the normal case: with a scalar, the
second one to arrive erases the first one's claim, and removing either takes the node with
it.

```js
node.getSources()             // ['seed', 'correlations']  — 'seed' is the loaded data
node.hasSource('correlations')
edge.getSources()             // edges carry it too, which is the load-bearing half
graph.removeBySource('correlations')   // drop the tag; delete only when the set empties
```

### Undo, per run

```js
graph.pivots.undo()           // the most recent ingest
graph.pivots.undo(runId)      // a particular one — every outcome carries its runId
graph.pivots.redo()           // re-lands the recorded delta; no refetch, no re-gating
```

This is run-scoped undo, not a general history engine: it covers what pivots added and
nothing else. A partial ingest out of one staged set gets its own `runId`, so each batch
is separately undoable.

## The Pivot rail mode

Where all of this is reached: a mode on the left rail with *Pick origin* and *Lasso origin*
tools, the current **origin**, and the pivot list with its narrowing controls.

Entering the mode is the **intent** that calls a provider; leaving it stops every question
in flight. That is deliberate and it is the whole rule: the library never speculatively
calls a provider, and selection alone — the same gesture as dragging, styling and bulk
edit — costs nothing.

The mode is **gated on the registry**:

```js
UI: { pivotMode: 'auto' }   // default: the button exists only while a pivot is registered
UI: { pivotMode: true }     // force it — for pivots that arrive asynchronously
UI: { pivotMode: false }    // never
```

So a consumer who registers no pivots sees no trace of the feature. It is never mounted in
`viewer` or `static` mode.

Two other ways in, both landing in the same place: a node's context menu carries a
**Pivot…** entry (absent, not disabled, where nothing applies), and a rim badge opens the
mode scoped to its own pivot.

### Origin-less pivots

Some enrichments have no node to run on — search, import, pasting a list of indicators.
Declare `origin: 'none'` and the pivot receives `[]`, applies when the origin is empty, and
folds into a *Without an origin* group once one is picked. Results route through the same
triage pane, the same gate and the same provenance model; they land at the viewport centre.

`appliesTo` is meaningless for one and is not consulted.

## Declared potential

A hint on the node's rim: "there are 2,100 correlations here", put there by whoever loaded
the data.

```js
node.setPotential('correlations', 2100)   // 0 clears it
node.getPotential('correlations')
```

It is **declared**, never queried — the library will not call a provider to draw a badge,
or a count would materialise on one node the moment it was asked about and the canvas would
be telling two different stories. Clicking the badge opens Pivot mode scoped to that pivot.

Like every other setter on `Node`, it marks the node dirty: call `graph.renderer.update()`
if nothing else is about to render.

::: warning Two free corners on a container
The expand affordance reserves the East side of a node with children, so several declared
potentials collapse into a `+n` badge early — on exactly the container nodes MISP produces.
The rim is a hint; the panel is the full surface.
:::

## Caching

The library caches one thing: `summarize` results, keyed by (pivot, origin, narrowing) —
because a multi-selection summary is an aggregate nothing can decompose. Everything else
is yours:

```js
graph.pivots.invalidate()                       // all of it
graph.pivots.invalidate('correlations')         // one pivot's
graph.pivots.invalidate('correlations', nodes)  // only what was asked about these
```

Auth, retry, rate limiting and any cache of your own belong in your provider functions,
which are plain functions you wrote — anything the library added there would only be in
the way.

## What this is not

- **No streaming and no server cursor.** Narrowing replaces them: never fetch 2,000, ask
  what is there and let the analyst choose. The contract must never require a streaming
  backend, because MISP does not have one.
- **No re-parenting.** A returned node never names an existing parent. Children union by
  id is the only way ingest touches an existing node's children.
- **No general undo history.** `graph.pivots.undo()` covers pivot runs and nothing else.
- **No persistence.** Saving an ingested result back to the source system — and remembering
  rejections across a reload — is a separate piece of work.
