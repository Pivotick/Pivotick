---
title: "Reject & retry"
category: F
order: 11
aside: false
pageClass: gallery-wide
---

# Reject & retry

[Pivot & enrich](/examples/gallery/pivot-enrichment/content) is about getting a number
*down* before you pay for it. This card is about everything after: the count in a triage
pane moves for three different reasons, none of which is a bug, and a provider that fails
is a state you can recover from rather than a dead end.

Press `P`, click `mail.example`, and read the three entries — one of them is already
broken, which is deliberate.

## The count moves, and the header says why

Fetch **Correlations** and forty candidates open in the dock. Tick five rows, press
**Reject selected**, then **Re-run**:

```
40 fetched · 5 rejected earlier                          1 origin node
```

Forty still came back — `fetched` is what the provider returned, not what survived — and
the five are gone from the table. Rejection is **explicit and remembered for the session**,
keyed per pivot, so the next run does not waste your attention on rows you have already
ruled on. Click the `5 rejected earlier` segment and they are revealed, each restorable;
restoring one brings it back on the *next* run rather than reinserting it under your cursor.

Now ingest three of what is left and **Re-run** again:

```
40 fetched · 3 already on canvas (skipped) · 5 rejected earlier
```

Three reasons, one line, all arithmetic. This is what "counts are advisory" means in
practice — the provider's number and the number of rows you can act on are allowed to
differ, and the honest thing is to say which part went where instead of quietly showing
thirty-two.

::: tip Closing is not a verdict
**Close** drops the pane and rejects nothing: whatever you never ruled on is offered again
next time. Rejecting is a decision, and only *Reject selected* / *Reject all remaining*
make it. That asymmetry is deliberate — if closing counted as rejection, triaging forty
rows down to three would silently bury the thirty-seven you simply had not reached yet.
:::

## Failure is a state, not a dead end

The two other pivots on this card fail on their first call and work on every one after it.
They fail in the two different places a provider can, and the surfaces are different
because the failures mean different things.

**A summary that fails** takes the pivot entry down with it — *Reputation lookup* wears
`Couldn't reach the source.` and a **Retry** the moment you open the mode, because
`summarize` runs on entry. Nothing else on the panel is affected: one dead provider does
not cost you the other two.

**A fetch that fails** is a pane, because by then you have committed to the expensive call.
Run *Enrich from feed* and it opens with `Couldn't fetch candidates.` — *"Nothing was
staged. Retrying runs the same request with the narrowing you already chose."* — and a
**Retry** that recovers it. Nothing partial ever lands: a failed fetch stages nothing at
all rather than half a result set you cannot tell is half.

```js
// Both of these are ordinary providers. Throwing is the whole error protocol.
let calls = 0

fetch: (nodes) => {
    if (++calls === 1) throw new Error('feed.example timed out (504)')
    return { nodes: /* … */ [], edges: [] }
}
```

There is no error type to import and no result envelope to fill in: **throw for a failure,
return an empty result for an empty one**. The two read completely differently to an
analyst, and conflating them is the one thing a provider can do that the library cannot
fix on its behalf.

## Stable ids are load-bearing

A rejection is remembered as `(pivot id, candidate id)`. A provider that renumbers its
results between calls — an array index, a timestamp, a fresh UUID per response — can never
be usefully rejected, because the row that comes back next time has an id the memory has
never seen. Return the source system's own stable id, and the same rule pays twice: it is
also what makes `already on canvas (skipped)` correct.

<script setup>
import { data, options } from './options.js'
</script>

<Pivotick :data="data" :options="options" useInlineStyle="margin: 1em 0; height: 780px; border: 1px solid #cccccc99; border-radius: 8px"></Pivotick>

::: code-group
<<< ./options.js#options [Options]
<<< ./options.js#data [Data]
:::

Full reference: [Pivots & enrichment](/pivots).
