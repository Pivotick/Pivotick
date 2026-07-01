---
title: "Programmatic manipulation"
category: J
order: 1
---

# Programmatic manipulation

Drive the graph entirely from your own code: `graph.addNode(...)` and
`graph.addEdge(...)` grow it, `graph.removeNode(id)` prunes it (and takes the
attached edges with it), and `graph.selectElement(node)` selects a node exactly as
a click would. After a structural change, `graph.simulation.reheat()` lets the
force layout re-settle.

The buttons below call nothing but these public methods.

<script setup>
import { shallowRef } from 'vue'
import { data, addNode, removeNode, selectCore } from './options.js'

const graph = shallowRef(null)
const onLoaded = (g) => { graph.value = g }
const onUnmounted = () => { graph.value = null }
</script>

<div class="api-toolbar">
    <button :disabled="!graph" @click="addNode(graph)">add node</button>
    <button :disabled="!graph" @click="removeNode(graph)">remove node</button>
    <button :disabled="!graph" @click="selectCore(graph)">select “core”</button>
</div>

<Pivotick
    :data="data"
    :options="{}"
    :onLoadedCallback="onLoaded"
    :onUnmountedCallback="onUnmounted"
></Pivotick>

<style>
.api-toolbar { display: flex; flex-wrap: wrap; gap: 8px; margin: 1em 0; }
.api-toolbar button {
    padding: 5px 12px; font-size: 13px; cursor: pointer;
    border: 1px solid var(--vp-c-divider); border-radius: 6px;
    background: var(--vp-c-bg-soft); color: var(--vp-c-text-1);
}
.api-toolbar button:disabled { opacity: 0.5; cursor: not-allowed; }
</style>

::: code-group
<<< ./options.js#api [API calls]
<<< ./options.js#data [Data]
:::
