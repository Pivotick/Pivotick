---
title: "Filter / query engine"
category: I
order: 1
---

# Filter / query engine

Real datasets are too big to show all at once. `graph.queryEngine` filters the graph
by node attributes: `setFilter(key, spec)` keeps nodes whose `data[key]` matches —
an exact value, a list, or a numeric `{ min, max }` range — and multiple filters
**AND** together. `resetFilters()` clears them.

Attribute rules aside, `excludeNode(id)` hides one node by hand; `includeNode(id)`
brings it back and `clearNodeExclusions()` restores every manually hidden node.

The buttons below drive the engine directly. The same filtering is available
without code: in **full mode** the header carries a **Graph Filters** panel (the
funnel icon, or press **Shift+K**) that auto-builds a control per attribute — a
dropdown for `type`/`zone`, a slider for `load`. Code and panel stay in sync —
filter from a button, open the panel, and its controls already reflect the active
filter, while hidden nodes appear in its **Hidden nodes** list.

<script setup>
import { shallowRef } from 'vue'
import { data, options, filterByType, filterByLoad, clearFilters, excludeNode, clearExclusions } from './options.js'

const graph = shallowRef(null)
const onLoaded = (g) => { graph.value = g }
const onUnmounted = () => { graph.value = null }
</script>

<div class="flt-toolbar">
    <button :disabled="!graph" @click="filterByType(graph, 'api')">type = api</button>
    <button :disabled="!graph" @click="filterByLoad(graph, 70)">load ≥ 70</button>
    <button :disabled="!graph" @click="clearFilters(graph)">reset</button>
    <button :disabled="!graph" @click="excludeNode(graph, 'db-2')">hide db-2</button>
    <button :disabled="!graph" @click="clearExclusions(graph)">show hidden</button>
</div>

<Pivotick
    :data="data"
    :options="options"
    :onLoadedCallback="onLoaded"
    :onUnmountedCallback="onUnmounted"
></Pivotick>

<p class="flt-hint">Stack them: <em>type = api</em> then <em>load ≥ 70</em> leaves just the one busy API.</p>

<style>
.flt-toolbar { display: flex; flex-wrap: wrap; gap: 8px; margin: 1em 0; }
.flt-toolbar button {
    padding: 5px 12px; font-size: 13px; cursor: pointer;
    border: 1px solid var(--vp-c-divider); border-radius: 6px;
    background: var(--vp-c-bg-soft); color: var(--vp-c-text-1);
}
.flt-toolbar button:disabled { opacity: 0.5; cursor: not-allowed; }
.flt-hint { font-size: 13px; color: var(--vp-c-text-2); margin: 8px 0 0; }
</style>

::: code-group
<<< ./options.js#filters [Filtering]
<<< ./options.js#options [Options]
<<< ./options.js#data [Data]
:::
