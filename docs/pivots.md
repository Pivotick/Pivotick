# Pivots & enrichment

A **pivot** is a runnable enrichment: "show me what else the source has about this". You
declare it, the library runs it, stages the results for triage, and commits them into the
graph with provenance on every element once the analyst says so.

The problem it solves is that the interesting node usually has too many connections. A
single indicator can be related to thousands of others. So a pivot is two calls rather than
one: a cheap call that says what is out there, and an expensive call that only ever runs on
a number the analyst agreed to.

::: tip Vocabulary, used consistently everywhere below
- **pivot**: the runnable enrichment
- **provider**: the two functions you supply
- **candidates**: fetched results, not yet in the graph
- **ingest**: committing the chosen candidates into the graph
- **reject**: an explicit dismissal, remembered for the session
- **source**: the provenance tag written on everything a pivot lands
:::

See it working: [Pivot & enrich](/examples/gallery/pivot-enrichment/content) for the
narrowing flow, and [Reject & retry](/examples/gallery/pivot-triage/content) for triage
and failure states.

## Using one

Everything from [Registering one](#registering-one) onwards is written for whoever wires a
pivot up. This section is the other half: what an analyst does with one, in order, and what
each step costs a backend.

**1 · Enter Pivot mode.** Press <kbd>P</kbd>, or click the **Pivot** slot on the left rail.
The slot only exists while at least one pivot is registered. Nothing has been asked of any
backend yet, and selecting nodes while the mode is closed asks nothing either. Box-selecting
fifty nodes to drag them should not fire fifty count queries.

**2 · Pick an origin.** The origin is the node set the question is about. *Pick origin* is
the resting tool, so a plain click sets it. *Lasso origin* draws around several. Whatever
was already selected when you entered the mode becomes the origin, and **Clear** empties it.
An empty origin still has uses: pivots declared `origin: 'none'` are the ones that apply
when nothing is picked.

**3 · Read what applies.** Entering the mode is the intent that runs `summarize`, once per
applicable pivot, batched into a single call for a multi-node origin. Each entry shows what
its provider claims is out there, written as `~2,143`. The tilde marks a number the provider
asserted rather than one the library counted. A pivot with no `summarize` shows a bare
**Run** instead. If nothing applies, the panel says so rather than showing an empty list.

**4 · Narrow until the gate opens.** A pivot that declares `maxCandidates` keeps **Fetch**
out of reach while the count exceeds it, and states the number, the limit and the way
forward. Ticking a narrowing control re-asks `summarize` with that choice, so 2,143 becomes
210 and **Fetch** turns on by itself. **Clear narrowing** starts over.

**5 · Triage what came back.** Results do not touch the graph. They open the **Review**
tab in the bottom dock, with every provider you have run listed down its side and the one
you are reading filling the rest, where *Search rows…* filters (with a regex toggle), the
columns sort, and marking rows is how you choose. Click anywhere on a row to mark it, and
Shift-click to carry that mark across every row between the two. *Select all n matching*
respects the current filter, so narrow-then-select-all is one gesture. **Reject selected** and **Reject
all remaining** dispose of rows explicitly, and both are remembered for the session.
The × on a provider's row closes it, and rejects nothing, so anything you never ruled on
comes back next time. **Re-run**
asks again with the same narrowing, and offers *Show new* / *Keep triaging* if you have rows
marked.

A provider that returns containers gets a **Children** column, counting what each row
carries directly, and a caret at the start of the row opens it: the row lists what is
inside, with each child's shared attributes and a note where a child is a container itself.
Opening a row is not marking it, and nothing inside can be picked on its own — ingesting the
row takes the whole container.

**6 · Ingest, and undo if it was wrong.** **Ingest selected (12)** commits exactly those
twelve, placed around the node you pivoted from and tagged with the pivot as their source.
The toast reads `Ingested 12 nodes, 14 edges` and carries **Undo**, which takes the whole
run back out, including its edges and any children it merged in.

An ingest that leaves nothing to rule on closes the pane, and the strip moves on to the next
provider waiting. Leftovers keep it open, and so does a re-run waiting in it. Once the last
pane goes, a dock the review opened folds back to where it was, so a pivot leaves the layout
it found.

Three doors lead to the same place: the rail mode, a node's context-menu **Pivot…** entry
(absent, never disabled, when nothing applies), and a rim badge, which opens the mode scoped
to its own pivot.

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

`graph.pivots` is both the registry and the runtime. `for()`, `run()`, `undo()`,
`invalidate()` and the candidate model all hang off it.

## A complete provider

Everything a working pivot needs, with nothing left out. The rest of this page is the
reference for each piece; this is the thing to copy first and cut down.

```js
// One helper, so the pivot below is about the contract rather than about HTTP.
const post = (url, body, signal) =>
    window.fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
    }).then(res => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
        return res.json()
    })

const correlations = {
    id: 'correlations',              // the provenance tag written on everything it lands
    label: 'Correlations',           // shown verbatim, so translate it yourself
    maxCandidates: 2000,             // refuse to fetch while the count is above this

    // Which origins this offers itself for. Omit it and it applies to everything.
    appliesTo: nodes => nodes.every(node => node.getData()?.type !== 'case'),

    // The cheap call: what is out there, and what you could narrow by.
    summarize: async (nodes, narrowing, { signal }) => {
        const { total, byType } = await post('/api/correlations/count', {
            ids: nodes.map(node => node.id),
            types: narrowing.type ?? [],       // pass the narrowing on so the count tracks it
        }, signal)

        return {
            total,                             // judged against maxCandidates
            facets: [{
                key: 'type',                   // the key you read back out of `narrowing`
                label: 'Type',
                type: 'multiselect',
                options: byType.map(row => ({ label: row.label, value: row.value, count: row.count })),
            }],
        }
    },

    // The expensive call: a flat fragment, run only on a number the analyst agreed to.
    fetch: async (nodes, narrowing, { signal }) => {
        const { items } = await post('/api/correlations', {
            ids: nodes.map(node => node.id),
            types: narrowing.type ?? [],
        }, signal)

        return {
            nodes: items.map(item => ({
                id: item.uuid,                 // an id already on canvas is skipped, never overwritten
                data: { label: item.value, type: item.type, seen: item.first_seen },
            })),
            edges: items.map(item => ({
                from: item.origin_uuid,        // both endpoints must land for the edge to land
                to: item.uuid,
                data: { type: 'correlation' },
            })),
        }
    },
}

new Pivotick(document.querySelector('#graph'), data, { pivots: [correlations] })
```

Four things that are easy to get wrong, all of them visible above:

- **`narrowing` is yours to honour.** It arrives as `{ [facetKey]: value }`, using the keys
  your own facets declared. Ignoring it is legal, but then the count never moves and a pivot
  over the cap can never be unblocked.
- **`signal` is not optional politeness.** Leaving Pivot mode or changing the origin aborts
  questions in flight. Pass it to every request, or you pay for answers nobody is waiting
  for. `ctx.isStale()` is the same check for transports that take no signal.
- **Throw for a failure, return empty for an empty.** A thrown error surfaces on the pivot
  entry with a **Retry**. `{ total: 0 }` is an honest "nothing out there", and the two read
  completely differently to an analyst.
- **Ids are the dedup key.** Return the source system's stable id, not a per-response one,
  or every re-run lands the same nodes again as fresh candidates.

## The provider contract

```ts
interface PivotDefinition {
    id: string                  // provenance tag, menu key, triage key
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

Both calls take an **array** of nodes, so a pivot over fifty of them is one backend request
rather than fifty. Both take the current **narrowing**. Both get a `PivotContext` carrying
`signal` and `isStale()`, the same cancellation pattern every async hook in the library uses.

### `summarize`: the cheap one

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

Its `total` is the number the cap is judged against, and its `facets` become the narrowing
controls: you declare the shape, the library draws the widgets. Pass the narrowing on to
your backend so the count tracks what the analyst chose, otherwise the gate can never lift.

Omit `summarize` entirely and the pivot offers no count and no narrowing, just a **Run**
button. That is legal, and then `fetch` must be safe to call blind, because nothing can gate
it.

### `fetch`: the real one

Returns a flat fragment: `{ nodes: RawNode[], edges: RawEdge[] }`. No returned node names an
existing on-canvas parent. Nesting travels in `RawNode.children`, so a container arrives as a
new node carrying its own subtree. An **edges-only** result is legal: edges whose endpoints
are all already on canvas become triage rows of their own.

### Facet types

Narrowing uses every facet type the query engine knows except `regex`, which no backend can
be asked to evaluate: `text`, `select`, `multiselect`, `numberRange`, `boolean`. Regex lives
in the triage pane's own client-side filters, where the rows are already in hand.

A `multiselect` is drawn as a list of checkboxes with every option and its `count` on screen,
so the numbers you are narrowing by stay visible while you narrow. A single-choice `select`
stays a dropdown and carries its counts in the option labels.

Under the total, the panel prints what it is made of, taken from the first `multiselect`
facet: those options partition the result. A single-choice facet's counts are alternatives
rather than parts, so they are not summed there.

## Counts are advisory. Always.

`summarize` returns a claim, not a contract. It legitimately differs from what ingest lands.
Dedup is the common case, then permissions, staleness, and providers that deliberately
approximate. The UI marks the difference with a tilde: `~2,143 correlations` is the
provider's number, while `210 fetched` and `12 selected` are the library's own. A shrink is
never an error, and a count is never load-bearing for layout.

## Gating: the cap, and the ceiling

```js
maxCandidates: 2000              // per pivot: refuse to fetch while the count exceeds it
new Pivotick(el, data, { pivotCandidateCeiling: 10_000 })   // absolute, all pivots
```

Both refuse, and neither truncates or samples. A refusal always carries three things in
order: the number, the limit, and the way forward. "Too many results" with no number is not
something an analyst can act on.

The cap is judged on the freshest count for the current narrowing, which is what lets it
lift. Narrow from 2,143 to 210 and **Fetch** turns on by itself. The ceiling is about memory
for candidate objects rather than about the table, which virtualises.

## Candidates are not the graph

Nothing a pivot returns is in the graph, in the data table, or in any facet count until it
is ingested. Results open the dock's **Review** tab — one pane per pivot, listed as vertical
tabs down its side, each with its own count and its own way out — with the provider's own
columns, the data table's filters, sorting, paging and an ingest action.

- **Rejection is explicit and remembered** for the session, keyed per pivot. The next run
  does not offer that candidate again, and the header line says how many it suppressed. A
  rejected row is struck through in place rather than moved, and stays reversible.
- **Nodes and edges are separate blocks**, each named and counted when a run returns both.
  An edges-only result is a table of its own, not an empty pane.
- **Closing a provider rejects nothing.** Untriaged leftovers come back on the next run.
  *Reject all remaining* is the one gesture that disposes of them.
- **A re-run replaces that provider's pane.** If you have rows marked it says so and offers
  *Show new* / *Keep triaging*, rather than throwing your triage away unasked.

Everything the pane does is also reachable programmatically:

```js
graph.pivots.candidates('correlations')      // the staged set
graph.pivots.mark('correlations', id)        // …markAll / reject / rejectRemaining
await graph.pivots.ingest('correlations')    // commit the marked ones
graph.pivots.discard('correlations')         // close it; rejects nothing
```

### `autoIngest`

For a small, trusted result that nobody wants to pick through, such as expanding a container
into its dozen children, declare `autoIngest: true`. Results land directly, with an undo on
the toast. The provider decides this, because only it knows whether its own results are
small and trusted enough to skip triage.

## Ingest, and what it is allowed to do

One gesture, one batch, one `dataBatchChanged`. In order: **dedup** (an id already on canvas
is skipped, never overwritten), **children union by id**, **placement** near the origin node
(jittered, and a provider's own `x`/`y` wins, while an origin-less run seeds at the viewport
centre), **provenance**, then the batch lands.

Ingest is purely additive. The only things that ever remove are `removeBySource` and run
undo.

One gate, called once with the whole set:

```js
callbacks: {
    onBeforeIngest: async ({ pivotId, origin, candidates, trigger, confirm }) => {
        if (candidates.nodes.length < 50) return true
        return await confirm({ title: `Add ${candidates.nodes.length} nodes?` })
    },
}
```

Return `false` to veto, or `{ accept: true, nodes, edges }` to land a subset. An omitted key
means "as requested", exactly as `onBeforeDelete` reads.

## Provenance

Every node and edge carries the **set** of sources vouching for it. A set rather than a
scalar, because two pivots overlapping on one node is the normal case. With a scalar, the
second one to arrive erases the first one's claim, and removing either takes the node with
it.

```js
node.getSources()             // ['seed', 'correlations'], where 'seed' is the loaded data
node.hasSource('correlations')
edge.getSources()             // edges carry it too, which is the load-bearing half
graph.removeBySource('correlations')   // drop the tag; delete only when the set empties
```

### Taking a run back

An ingest is one entry in `graph.history`, alongside the other things that change what the
canvas holds: deletions, durable hides, and elements drawn by hand.

```js
graph.history.entries()       // newest first; a pivot entry's `id` is its runId
graph.history.undo()          // the newest entry
graph.history.undo(runId)     // that ingest, and contiguously anything done since
graph.history.redo()          // re-lands the recorded delta; no refetch, no re-gating
```

Undo is **contiguous**: aiming at an older entry reverses every entry above it as well, as
one batch. Reversing one old run on its own is `graph.removeBySource(pivotId)`, which drops
that source's vouching and deletes only what nothing else vouches for — a forward operation,
recorded as one.

A partial ingest out of one staged set gets its own `runId`, so each batch is a separate
entry.

## The Pivot rail mode

[Using one](#using-one) walks through the surface, its tools, its origin and the pivot list.
What matters when you are configuring rather than driving it is the rule underneath.

Entering the mode is the intent that calls a provider, and leaving it stops every question
in flight. The library never speculatively calls a provider, and selection alone costs
nothing, because selection is also the gesture for dragging, styling and bulk edit.

The mode is **gated on the registry**:

```js
UI: { pivotMode: 'auto' }   // default: the button exists only while a pivot is registered
UI: { pivotMode: true }     // force it, for pivots that arrive asynchronously
UI: { pivotMode: false }    // never
```

A consumer who registers no pivots therefore sees no trace of the feature. It is never
mounted in `viewer` or `static` mode.

### Origin-less pivots

Some enrichments have no node to run on, such as search, import, or pasting a list of
indicators. Declare `origin: 'none'` and the pivot receives `[]`, applies when the origin is
empty, and folds into a *Without an origin* group once one is picked. Results route through
the same triage pane, the same gate and the same provenance model, and they land at the
viewport centre.

`appliesTo` is meaningless for one of these and is not consulted.

## Declared potential

A hint on the node's rim, saying "there are 2,100 correlations here", put there by whoever
loaded the data.

```js
node.setPotential('correlations', 2100)   // 0 clears it
node.getPotential('correlations')
```

It is **declared**, never queried. The library will not call a provider to draw a badge,
because a count that materialised on one node the moment it was asked about would leave the
canvas telling two different stories. Clicking the badge opens Pivot mode scoped to that
pivot.

Like every other setter on `Node`, it marks the node dirty: call `graph.renderer.update()`
if nothing else is about to render.

::: warning Two free corners on a container
The expand affordance reserves the East side of a node with children, so several declared
potentials collapse into a `+n` badge early, on exactly the nodes that carry children. The
rim is a hint; the panel is the full surface.
:::

## Caching

The library caches one thing: `summarize` results, keyed by (pivot, origin, narrowing),
because a multi-selection summary is an aggregate that nothing can decompose. Everything
else is yours:

```js
graph.pivots.invalidate()                       // all of it
graph.pivots.invalidate('correlations')         // one pivot's
graph.pivots.invalidate('correlations', nodes)  // only what was asked about these
```

Auth, retry, rate limiting and any cache of your own belong in your provider functions,
which are plain functions you wrote. Anything the library added there would only be in the
way.

## What this is not

- **No streaming and no server cursor.** Narrowing replaces them: rather than fetching two
  thousand rows, ask what is there and let the analyst choose. The contract never requires a
  streaming backend, because many sources do not have one.
- **No re-parenting.** A returned node never names an existing parent. Children union by id
  is the only way ingest touches an existing node's children.
- **No property-edit undo.** `graph.history` covers what the canvas holds and shows — what
  came in, what went out, what is hidden. A node's data is backend state the library did not
  author, so reverting a field locally is `onBeforeNodeEditCommit`'s job, not ours.
- **No persistence.** Saving an ingested result back to the source system, and remembering
  rejections across a reload, is a separate piece of work.
