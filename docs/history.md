# Undo & history

`graph.history` is a record of **what the canvas holds and shows** — what was brought in,
what was taken out, what is hidden — and a way to take any of it back.

That line is deliberate: it is not a record of every mutation the library can perform. A
node's data belongs to your backend. The library did not author it and cannot speak for it,
so reverting a field locally while the record of truth disagreed would be worse than
offering no undo at all. What the library can speak for is composition, which is also what
an analyst reasons about: twelve nodes arrived, three went, five are hidden.

::: tip Vocabulary, used consistently below
- **entry**: one reversible thing that happened, as one row in the menu
- **kind**: which of the four sorts of entry it is
- **span**: the contiguous block from the newest entry down to the one you clicked
- **sealed**: an entry the consumer wrote through to a backend — listed, never reversed
:::

## The four kinds

A closed set. Everything the library records is one of these, and nothing else is recorded.

| Kind | What it is | How it is reversed |
|---|---|---|
| `pivot` | One ingest — see [Pivots & enrichment](/pivots) | The run's vouching is dropped, and whatever nothing else vouches for goes |
| `delete` | A user-initiated deletion of nodes or edges | The elements come back, provenance and all |
| `visibility` | A durable hide or unhide (`queryEngine.excludeNode` / `includeNode`) | The other one |
| `create` | A node or edge drawn by hand | The element goes, unless something else vouches for it |

Not recorded, on purpose:

- **Property edits.** Backend state, as above. `onBeforeNodeEditCommit` is where you
  implement your own.
- **Filter and legend state.** Settings with their own Clear rather than acts. The filter
  form applies live on every keystroke, so typing `domain` would push six entries.
- **Notes.** Authored text, closer to an edit than to graph composition.
- **`graph.hideNode()`.** It is wiped the next time filters re-derive, so an entry for it
  would reverse something that had already reverted itself. `excludeNode` is the hide that
  survives, and the one that is recorded.

Programmatic mutations — `graph.addNode()`, `graph.removeNode()` — are not entries either.
Only a gesture is.

## Undo is contiguous

Aiming at the row three down undoes those three, as one `dataBatchChanged` and one
re-render. There is no way to reverse one old entry on its own: a stack whose middle can be
pulled out no longer describes how the graph got this way.

For "that provider returned junk, drop it and keep the rest", use
`graph.removeBySource(source)`. It drops one source's vouching and deletes only what nothing
else vouches for, so a node a second run also found survives, one claim lighter. It is a
**forward** operation, recorded as a new entry rather than a rewind.

Redo is strictly linear and any new action empties it. A run that was undone and then
stranded by later work is gone; getting it back means running the pivot again.

## From the top bar

Each of the two buttons in the header is a split button: the icon steps once, the caret
opens the history. `Ctrl+Z` and `Ctrl+Shift+Z` (`⌘Z` and `⌘⇧Z` on macOS) reach the same two
steps without the header, and fall through to the browser's own text undo while a text field
has focus. Both buttons live in `full` and `light` mode, which is where the header is.

The dropdown is one list from either button, newest at the top, with a **now** line through
it: the rows above it have been undone, the rows below are what can still be undone. Click a
row and the line travels past it, which is the same gesture in both directions.

Each row carries its kind's icon, its label, and **how many steps a click on it travels**.
That number is the one the footer states, so the list and the footer cannot disagree.
Hovering a row marks the span and lights the elements it touched on the canvas; a row whose
elements are gone lights nothing. The footer states the exact net effect before anything is
committed. Arrow keys aim, Enter travels, Escape closes.

## Sealed entries

Only the consumer can know that an operation was written through to a backend, so only the
consumer can say so. `onBeforeNodeCreate`, `onBeforeEdgeCreate` and `onBeforeDelete` each
accept `persisted` on their decision:

```js
callbacks: {
    onBeforeNodeCreate: async (ctx) => {
        const values = await ctx.promptData({ fields: [{ key: 'value', label: 'Value', type: 'text' }] })
        if (!values) return false
        const saved = await myBackend.create(values)
        return { accept: true, id: saved.uuid, data: values, persisted: true }
    },
}
```

A sealed entry is **listed**, because it is part of how the canvas got this way, but never
reversed. A span containing one passes over it rather than stopping at it, and says so
before the click: `Undoes 2 of 3 · 1 saved item kept`.

Skipping works because every entry names the specific elements it touched, so there are no
state diffs to get out of order. That is also why the four kinds are closed and a consumer
cannot record an entry of its own: an arbitrary callback in the stack could throw halfway
through a span, and the history would have no way to know.

## Taking an ingest back

Undoing an ingest **re-stages its candidates**, so the rows go back in the Review pane where
they came from, the pane reopens if the ingest had closed it, earlier rejections still hold,
and no provider is called. That last part is the point: the alternative is refetching two
thousand correlations through a rate-limited API to fix a mistake made two seconds ago.

They come back untriaged rather than still marked. Taking the run back is for going through
it properly, not for re-landing the same twelve on one click.

This happens **only when the ingest is still the newest entry**. If anything at all has
happened since, undo removes the nodes and no pane appears: a pane resurrecting itself over
later work would be worse than the refetch.

## What it holds

Thirty entries, oldest evicted. The eviction is worth understanding, because it is not
symmetrical: it loses the ability to **restore** an old run, not to **remove** one.
Provenance lives on the elements themselves, so `graph.removeBySource(pivotId)` still reaches
a run the history has forgotten.

The history is **session-only**. It does not survive a reload. Restoring an earlier state of
a whole graph is a different feature, and not this one.

## Driving it

```js
graph.history.entries()      // what can be undone, newest first — the order the menu renders
graph.history.redoable()     // what has been undone and can be redone, newest first
graph.history.canUndo()
graph.history.canRedo()

graph.history.undo()                  // the newest entry
graph.history.undo(entryId)           // the span from the newest through that entry
graph.history.redo(entryId)           // and back again

graph.history.preview(entryId)        // what that span would do, before doing it
graph.history.on(history => …)        // every change to either direction; returns a disposer
graph.history.clear()                 // forget everything; the canvas is left as it is
```

A pivot entry's `id` **is** its `runId`, so a `PivotRunOutcome` already carries the handle to
its own row:

```js
const outcome = await graph.pivots.run('correlations', graph.getSelectedNodes())
// …later
graph.history.undo(outcome.runId)
```

`preview(entryId, direction?)` is worth a note. It does not summarise the entries — it
replays the span against a copy of the graph's state, through the same code the click
commits, and diffs the result:

```js
const { entries, skipped, nodes, edges, effect } = graph.history.preview(entryId)
// entries  the span, newest first
// skipped  the sealed ones inside it, which will be left alone
// nodes    the elements it would touch that are on the canvas now
// effect   { nodesRemoved, nodesRestored, edgesRemoved, edgesRestored, nodesHidden, nodesShown }
```

Because it is played rather than described, the awkward cases come out right for nothing: a
hide cancelled by a later unhide nets to zero and says so, and a node a second pivot also
vouches for is not counted as leaving.

## Provenance, and why deletion remembers it

Every node and edge carries the set of sources vouching for it: `'seed'` for data that was
loaded, a pivot's id for anything it brought, and `'manual'` for anything drawn by hand. A
set rather than a scalar, because two pivots overlapping on one node is the normal case.

A deletion therefore has to remember each element's vouching, not just its data. Without
that: a run adds twelve, the analyst deletes three, undoes the deletion, and the three come
back as unaccounted-for orphans; undoing the run afterwards then leaves them on the canvas
with nothing to explain them. With it, undoing the deletion and then the run leaves exactly
what was there before.

One consequence worth knowing when you upgrade: a hand-created node reports `['manual']`
from `getSources()`, not `['seed']`. That is what makes `graph.removeBySource('manual')`
reach hand-drawn work, and what lets undoing a creation remove the element only when nothing
else still vouches for it.
