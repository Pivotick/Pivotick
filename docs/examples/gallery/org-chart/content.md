---
title: "Org chart"
category: L
order: 2
---

# Org chart

The **tree layout** reads a hierarchy straight from your edges — point each edge
manager → report and set `layout.type: 'tree'` (with an optional `rootId`). Nodes
here are **custom HTML**: `defaultNodeStyle.html` returns any `HTMLElement`, so each
person becomes a little card with an avatar, name, role and a department accent —
all inline-styled, nothing extra to load.

The same combination works for a file browser, a decision tree, or any other
parent/child structure.

<script setup>
import { data, options } from './options.js'
</script>

<Pivotick :data="data" :options="options"></Pivotick>

::: code-group
<<< ./options.js#options [Options]
<<< ./options.js#data [Data]
:::
