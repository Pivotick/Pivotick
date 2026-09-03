---
title: "Pivot & enrich"
category: M
order: 1
aside: false
pageClass: gallery-wide
---

# Pivot & enrich

`paste 9f21` has **2,143** correlations behind it. Fetching them all would bury the graph,
so a **pivot** negotiates instead: it advertises the count, refuses to fetch past a cap, and
lets you narrow until the number is one you can actually look at.

Press `P`, click `paste 9f21`, and read the panel.

- **Nothing is asked until you enter Pivot mode.** Selecting a node costs zero backend calls.
- **`~2,143` wears a tilde** because it is the provider's claim. `210 fetched` is the
  library's own count, so it does not.
- **The gate refuses** while the count is over `maxCandidates: 2000`, and says how to lift it.
- **Tick *URLs*** and 210 comes back under the cap, so **Fetch** turns on by itself.
- **What arrives is not the graph.** The 210 candidates open the dock's Review tab. The
  canvas does not move until you ingest, and the toast that follows carries **Undo**.

Select `Event 5f2a` for the other shape: `Objects & attributes` declares `autoIngest`, so its
twelve objects land directly with no pane.

<script setup>
import { data, options, onLoaded } from './options.js'
</script>

<Pivotick :data="data" :options="options" :onLoadedCallback="onLoaded" useInlineStyle="margin: 1em 0; height: 620px; border: 1px solid #cccccc99; border-radius: 8px"></Pivotick>

::: code-group
<<< ./options.js#options [Options]
<<< ./options.js#data [Data]
:::

Full reference: [Pivots & enrichment](/pivots).
