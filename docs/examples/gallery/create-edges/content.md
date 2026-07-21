---
title: "Create edges (drag & click)"
category: G
order: 2
aside: false
pageClass: gallery-wide
---

# Create edges (drag & click)

Edge creation is built in, with two interaction styles backed by a live "shadow
edge" preview: **click-click** (click a source node, then a target) and
**drag-and-drop** (drag from one node onto another).

Click **Edit Graph** (top-right), then **Add Edge**, and connect two nodes — or just
drag from one node to another. Every new edge fires the `edgeAdd` data event, which
here pops a toast.

<script setup>
import { data, options, onLoaded } from './options.js'
</script>

<Pivotick :data="data" :options="options" :onLoadedCallback="onLoaded" useInlineStyle="margin: 1em 0; height: 560px; border: 1px solid #cccccc99; border-radius: 8px"></Pivotick>

::: code-group
<<< ./options.js#options [Options]
<<< ./options.js#data [Data]
:::
