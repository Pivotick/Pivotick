---
title: "Large-graph scale"
category: K
order: 2
---

# Large-graph scale

Real datasets get big. This graph is **1,500 nodes** and roughly as many edges,
generated on the fly and laid out with the default force simulation — no special
rendering path, just Pivotick's defaults with smaller nodes so a dense network
stays legible.

The expensive part of a large graph is computing the layout. Pivotick offloads
it to a **Web Worker** (`simulation.useWorker: true`): the force simulation runs
off the main thread, so the page never freezes while the graph settles, and the
final positions are rendered in a single pass. The worker ships with the library
— no build wiring needed.

<script setup>
import { data, options } from './options.js'
</script>

<Pivotick :data="data" :options="options"></Pivotick>

::: code-group
<<< ./options.js#options [Options]
<<< ./options.js#data [Data]
:::
