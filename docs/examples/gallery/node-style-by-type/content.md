---
title: "Style by type"
category: B
order: 2
---

# Style by type

The most common styling pattern: drive appearance from your data. A
`nodeTypeAccessor` reads a key off each node, and `nodeStyleMap` maps that key to
a style. Add a new role to your data and it's styled automatically — no
per-node code.

<script setup>
import { data, options } from './options.js'
</script>

<Pivotick :data="data" :options="options"></Pivotick>

::: code-group
<<< ./options.js#options [Options]
<<< ./options.js#data [Data]
:::
