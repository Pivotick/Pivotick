---
title: "Default edge style"
category: C
order: 1
---

# Default edge style

`render.defaultEdgeStyle` sets the base look of every edge — color, width, curve,
and arrow markers. Each end can carry a marker: `arrow`, `circle`, or `diamond`,
set on `markerStart` / `markerEnd`. This card labels one of each, so it doubles
as a marker reference.

<script setup>
import { data, options } from './options.js'
</script>

<Pivotick :data="data" :options="options"></Pivotick>

::: code-group
<<< ./options.js#options [Options]
<<< ./options.js#data [Data]
:::
