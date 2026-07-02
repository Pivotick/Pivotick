---
title: "Large-graph scale"
category: K
order: 2
---

# Large-graph scale

The force simulation is what turns a pile of nodes into readable structure. This
graph is **~1,500 nodes** in a layered, organic network: a central **root**, **8
communities** hanging off it, each split into **2 clusters**, and each cluster a hub
with dozens of leaves — plus a couple of links that jump between communities. The
nodes carry initial positions that arrange the communities around a ring, so the
force simulation settles quickly into cleanly separated groups instead of spending
its budget untangling a random start. Each node is coloured by its community.

At this scale the layout is computed in a **Web Worker** (`simulation.useWorker:
true`) so the page never freezes while ~1,500 nodes settle, then rendered static —
a continuous physics loop on thousands of nodes isn't practical on the main thread,
so you lay the graph out once and render the result. The worker ships with the
library — no build wiring needed.

<script setup>
import { data, options } from './options.js'
</script>

<Pivotick :data="data" :options="options"></Pivotick>

::: code-group
<<< ./options.js#options [Options]
<<< ./options.js#data [Data]
:::
