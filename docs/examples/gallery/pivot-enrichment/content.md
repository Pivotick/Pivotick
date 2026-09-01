---
title: "Pivot & enrich"
category: F
order: 10
aside: false
pageClass: gallery-wide
---

# Pivot & enrich

The node `paste 9f21` has **2,143** correlations behind it. Fetching them would destroy
the graph, and fetching none of them is why you opened the source in the first place. A
**pivot** is the shape of that negotiation: advertise the count, refuse to fetch past a
cap, and let the analyst narrow until the number is one they can look at.

Press `P` (or the ✨ slot below the divider), click `paste 9f21`, and read the panel.

## The flow this card is built to show

1. **Nothing is asked until you enter Pivot mode.** Selecting a node costs zero backend
   calls — box-selecting fifty nodes to move them must not fire fifty count queries. The
   mode boundary *is* the intent boundary: `onEnter` starts `summarize`, leaving stops it.
2. **`~2,143` — and the tilde is load-bearing.** A number the provider claims wears one;
   a number the library counted itself never does. So `~2,143 correlations` but
   `210 fetched`, and the shrink between them reads as arithmetic rather than a bug.
3. **The gate refuses, and says how to lift it.** `maxCandidates: 2000` puts *Fetch* out
   of reach with the number, the limit and the way forward — never a bare "too many
   results".
4. **Tick *URLs* and it lifts.** 210 of the 2,143, so the same question comes back under
   the cap and *Fetch* turns on. This is the moment the whole design exists for.
5. **What comes back is not the graph.** 210 candidates open a pane in the dock. Filter,
   sort and page through them; the canvas does not move. Tick twelve, ingest, and *those
   twelve* arrive around the node you pivoted from — with an **Undo** on the toast.

Select the red `Event 5f2a` instead and you get the other shape: `Objects & attributes`
declares `autoIngest`, so its twelve objects land directly. No pane, same toast, same undo.

## Two calls, and only one of them is expensive

```js
{
    id: 'correlations',
    label: 'Correlations',
    appliesTo: nodes => nodes.every(n => n.getData()?.type !== 'event'),
    summarize: (nodes, narrowing, { signal }) => /* counts + facets */,
    fetch:     (nodes, narrowing, { signal }) => /* { nodes, edges } */,
    maxCandidates: 2000,
}
```

Both take **arrays**, so a bulk pivot over fifty nodes is one backend request rather than
fifty. Both take the current **narrowing**, so the count tracks what the analyst chose —
which is the only reason the gate can ever lift. Both get a `signal`: leaving the mode
aborts every question in flight, though never a fetch already staging into a pane.

`summarize`'s facets become the narrowing controls, from the same vocabulary the filter
panel speaks — minus `regex`, which no backend can be asked to evaluate. Omit `summarize`
entirely and the pivot offers no count and no narrowing, just **Run**; that is legal, and
then `fetch` had better be safe to call blind.

## Candidates are not data

Nothing a pivot returns is in the graph, in the data table, or in any facet count until
someone ingests it. That is the invariant the pane exists to protect, and it is why the
triage table is the library's rather than yours: a candidate list is domain-agnostic, so
every provider gets the same filters, the same rejections and the same ingest action.

::: tip Rejections are remembered, closing the pane is not a verdict
Rejecting a row is a deliberate act, remembered for the session and per pivot — the next
run does not offer it again, and the header line says how many it suppressed. Closing the
pane rejects nothing: whatever you never ruled on is offered again next time.
:::

## Everything that lands is tagged

Ingest writes a **source** on every node and edge it brings in, and the seed data carries
`'seed'`. Provenance is a set, not a scalar, because two pivots overlapping on one node is
the normal case, not the edge case:

```js
node.getSources()                       // ['seed', 'correlations']
graph.removeBySource('correlations')    // drop the tag; delete only when the set empties
graph.pivots.undo()                     // or just take back the last run
```

Ingest is purely additive — an id already on canvas is skipped, never overwritten — so
`removeBySource` and `undo` are the only two things that ever remove.

<script setup>
import { data, options, onLoaded } from './options.js'
</script>

<Pivotick :data="data" :options="options" :onLoadedCallback="onLoaded" useInlineStyle="margin: 1em 0; height: 620px; border: 1px solid #cccccc99; border-radius: 8px"></Pivotick>

::: code-group
<<< ./options.js#options [Options]
<<< ./options.js#data [Data]
:::

Full reference: [Pivots & enrichment](/pivots).
