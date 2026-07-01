---
title: "Sticky notes"
category: H
order: 1
---

# Sticky notes

Notes are free-floating annotations rendered above the graph — give each one a
position, a color, and some text. Set `attachedElement` and a connector line tethers
the note to a node, tracking it as the graph moves.

Drag a note to reposition it. The blue note stays pinned to **Carol** — drag Carol
and watch the connector follow.

<script setup>
import { data, options, onLoaded } from './options.js'
</script>

<Pivotick :data="data" :options="options" :onLoadedCallback="onLoaded"></Pivotick>

::: code-group
<<< ./options.js#notes [Notes]
<<< ./options.js#data [Data]
:::
