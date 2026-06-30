---
title: "Icons per type"
category: B
order: 4
---

# Icons per type

Drop an icon inside any node with `svgIcon` — an inline SVG string, set straight
on the style map per type. The icon inherits the node's `strokeColor`, so it
stays legible on any fill. Combine it with `nodeTypeAccessor` and you get
typed, iconified nodes from plain data.

<script setup>
import { data, options } from './options.js'
</script>

<Pivotick :data="data" :options="options"></Pivotick>

::: code-group
<<< ./options.js#options [Options]
<<< ./options.js#data [Data]
:::
