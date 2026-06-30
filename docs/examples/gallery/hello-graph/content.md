---
title: "Hello graph"
category: A
order: 1
---

# Hello graph

The absolute minimum. Hand `Pivotick` a `data` object of nodes and edges and you
get an interactive, force-directed graph — pan, zoom, and drag work out of the
box. No options required. Hover a node to see its label.

<script setup>
import { data, options } from './options.js'
</script>

<Pivotick :data="data" :options="options"></Pivotick>

::: code-group
<<< ./options.js#options [Options]
<<< ./options.js#data [Data]
:::
