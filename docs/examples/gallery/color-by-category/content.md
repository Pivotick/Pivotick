---
title: "Color by category"
category: B
order: 6
---

# Color by category

Let Pivotick assign colors for you. `ColorPaletteMapper` hands out a stable color
per category value, and `color` accepts an accessor — so one line maps every
node's group to a color. The `okabe-ito` palette shown here is colorblind-safe;
`tol-bright`, `kelly-22`, and `d3-category10` are built in too.

<script setup>
import { data, options } from './options.js'
</script>

<Pivotick :data="data" :options="options"></Pivotick>

::: code-group
<<< ./options.js#options [Options]
<<< ./options.js#data [Data]
:::
