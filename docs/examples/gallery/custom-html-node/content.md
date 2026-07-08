---
title: "Custom HTML node"
category: B
order: 3
---

# Custom HTML node

The ultimate escape hatch: `render.renderNode(node)` returns **any** HTML element
(or string), and Pivotick measures it and centres it on the node. Build nodes out
of whatever markup you like — here each one is a self-contained team card with an
emoji, a title and a lead. Everything else (edges, dragging, the force layout)
keeps working around it.

<script setup>
import { data, options } from './options.js'
</script>

<Pivotick :data="data" :options="options"></Pivotick>

::: code-group
<<< ./options.js#options [Options]
<<< ./options.js#data [Data]
:::
