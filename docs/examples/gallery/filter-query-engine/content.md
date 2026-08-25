---
title: "Filter / query engine"
category: I
order: 1
aside: false
pageClass: gallery-wide
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
funnel icon, or press **Shift+K**). Code and panel stay in sync — filter from a
button, open the panel, and its controls already reflect the active filter, while
hidden nodes appear in its **Hidden nodes** list.

This card **declares** its facets (`UI.filter.facets`), so the panel contains
exactly the six controls below with the labels and widgets given — including two
that aren't node-data keys at all. Omit `facets` and the panel instead derives a
control per data key, inferring each widget from the values it finds; see
[Filter options](/ui-filter).

`tags` is **array-valued**, so filtering it tests membership: *tag = critical*
keeps every node carrying that tag. `Depends on load ≥` is **computed** — an
`accessor` reads the *dependencies'* load instead of the node's own, which is why
`web-1` (the busiest service at 82%) drops out of it while the quieter `db-1`
survives.

<script setup>
import { shallowRef } from 'vue'
import { data, options, filterByType, filterByLoad, filterByTag, filterByDependencyLoad, clearFilters, excludeNode, clearExclusions } from './options.js'

const graph = shallowRef(null)
const onLoaded = (g) => { graph.value = g }
const onUnmounted = () => { graph.value = null }
</script>

<div class="flt-toolbar">
    <button :disabled="!graph" @click="filterByType(graph, 'api')">type = api</button>
    <button :disabled="!graph" @click="filterByLoad(graph, 70)">load ≥ 70</button>
    <button :disabled="!graph" @click="filterByTag(graph, 'critical')">tag = critical</button>
    <button :disabled="!graph" @click="filterByDependencyLoad(graph, 70)">depends on load ≥ 70</button>
    <button :disabled="!graph" @click="clearFilters(graph)">reset</button>
    <button :disabled="!graph" @click="excludeNode(graph, 'db-2')">hide db-2</button>
    <button :disabled="!graph" @click="clearExclusions(graph)">show hidden</button>
</div>

<Pivotick
    :data="data"
    :options="options"
    :onLoadedCallback="onLoaded"
    :onUnmountedCallback="onUnmounted"
    useInlineStyle="margin: 1em 0; height: 560px; border: 1px solid #cccccc99; border-radius: 8px"
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
<<< ./options.js#facets [Declared facets]
<<< ./options.js#filters [Filtering]
<<< ./options.js#options [Options]
<<< ./options.js#data [Data]
:::
