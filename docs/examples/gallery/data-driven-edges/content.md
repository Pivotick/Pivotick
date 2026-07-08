---
title: "Data-driven edges"
category: C
order: 2
---

# Data-driven edges

Every edge property can be an accessor `(edge) => value`, so your data drives the
look. Here edge **weight** sets the stroke width and **status** sets the color —
and pending links are `dashed`, which animates automatically (`animateDash`).
Solid green = active, flowing amber = pending.

<script setup>
import { data, options } from './options.js'
</script>

<Pivotick :data="data" :options="options"></Pivotick>

::: code-group
<<< ./options.js#options [Options]
<<< ./options.js#data [Data]
:::
