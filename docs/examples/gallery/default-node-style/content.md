---
title: "Default node style"
category: B
order: 1
---

# Default node style

`render.defaultNodeStyle` sets the base appearance of every node — shape, size,
color, stroke, and label. Override any field per node via its `style`. Here the
four built-in shapes (`circle`, `square`, `triangle`, `hexagon`) share one
default style, so this card doubles as a shape reference.

<script setup>
import { data, options } from './options.js'
</script>

<Pivotick :data="data" :options="options"></Pivotick>

::: code-group
<<< ./options.js#options [Options]
<<< ./options.js#data [Data]
:::
