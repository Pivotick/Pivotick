---
title: "Context-menu entries"
category: F
order: 2
---

# Context-menu entries

Add your own right-click actions to nodes, edges, or the canvas. Each menu takes a
`topbar` (quick icon buttons) and a `menu` (a labelled list); every item gets an
`onclick` receiving the element it was opened on. `variant` themes the item and
`visible` can be a predicate.

Right-click a **node**, an **edge**, or the **background** and pick an action — each
pops a notification. Your entries appear alongside Pivotick's built-in ones.

<script setup>
import { data, options, onLoaded } from './options.js'
</script>

<Pivotick :data="data" :options="options" :onLoadedCallback="onLoaded"></Pivotick>

::: code-group
<<< ./options.js#options [Options]
<<< ./options.js#data [Data]
:::
