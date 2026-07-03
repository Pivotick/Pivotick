---
title: "Social network"
category: L
order: 1
---

# Social network

A worked example of the **Node styling** cards pulling together: people and the
communities they belong to, each crowd in its own colourblind-safe hue, venues
drawn as hexagons with an icon, and edges that distinguish a faint membership link
from a solid friendship whose thickness tracks how close the tie is.

Everything here is declarative — a `nodeStyleMap` for shape by kind, a palette
mapper for colour by community, and accessor functions on the edge style. Drag the
people around to feel the three crowds and the friends who bridge them.

<script setup>
import { data, options } from './options.js'
</script>

<Pivotick :data="data" :options="options"></Pivotick>

::: code-group
<<< ./options.js#options [Options]
<<< ./options.js#data [Data]
:::
