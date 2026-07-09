---
title: "Validate & enrich new edges"
category: G
order: 3
---

# Validate & enrich new edges

Two connect-time hooks let the consumer own edge creation. **`isValidConnection`**
runs live during the gesture — an invalid target draws a red preview and can't be
dropped, and the before-create hook is never consulted for it. **`onBeforeEdgeCreate`**
runs once a valid target is chosen, just before the edge exists: return `false` to
veto, or `{ accept: true, data, style, directed }` to accept and stamp the new edge
with a label, style, and direction. It may be async — the shadow-edge preview stays
up until it settles.

Click **Edit Graph** (top-right) → **Add Edge**, then connect nodes. Here you may
only link a **person to a project** — same-type links preview red and are refused
live. A valid drop simulates a save, then creates a labeled, directed edge — except
onto the **archived** project, which the before-create hook vetoes after the fact.

<script setup>
import { data, options, onLoaded } from './options.js'
</script>

<Pivotick :data="data" :options="options" :onLoadedCallback="onLoaded"></Pivotick>

::: code-group
<<< ./options.js#options [Options]
<<< ./options.js#data [Data]
:::
