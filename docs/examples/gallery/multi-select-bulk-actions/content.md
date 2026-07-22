---
title: "Multi-select & bulk actions"
category: F
order: 3
aside: false
pageClass: gallery-wide
---

# Multi-select & bulk actions

Select several nodes and Pivotick surfaces a **bulk-action row** at the top of the
sidebar — **Pin**, **Unpin**, **Hide** and **Delete** act on the whole selection at
once (Isolate, Group, Ungroup and Bulk-edit are coming soon). A clear **✕** resets the
selection.

Build a selection:

- <kbd>`Shift`</kbd> + <kbd>`Click`</kbd> — add a node to the selection
- <kbd>`Alt`</kbd> + <kbd>`Click`</kbd> — start a fresh selection
- <kbd>`Ctrl`</kbd> + <kbd>`Click`</kbd> — remove a node from the selection
- or **drag a box** across empty canvas

With two or more nodes selected the bulk row appears. To react to the selection in
code, use the `onNodesSelect` callback — the notification below is driven by it.

<script setup>
import { data, options, onLoaded } from './options.js'
</script>

<Pivotick :data="data" :options="options" :onLoadedCallback="onLoaded" useInlineStyle="margin: 1em 0; height: 560px; border: 1px solid #cccccc99; border-radius: 8px"></Pivotick>

::: code-group
<<< ./options.js#options [Options]
<<< ./options.js#data [Data]
:::
