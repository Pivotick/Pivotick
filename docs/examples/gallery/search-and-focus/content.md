---
title: "Search & focus"
category: I
order: 3
aside: false
pageClass: gallery-wide
---

# Search & focus

In **full mode** the header carries a **search box** (the magnifier, or press
**Shift+J**): start typing and it fuzzy-matches node labels, then focuses whatever
you pick. The same camera control is available programmatically —
`graph.focusElement(node)` pans and zooms to a node and `graph.highlightElement(node)`
draws attention to it.

Use the search box above the graph, or the buttons below to jump straight to a city.

<script setup>
import { shallowRef } from 'vue'
import { data, options, focusNode, showAll } from './options.js'

const graph = shallowRef(null)
const onLoaded = (g) => { graph.value = g }
const onUnmounted = () => { graph.value = null }
</script>

<div class="fcs-toolbar">
    <button :disabled="!graph" @click="focusNode(graph, 'athens')">focus Athens</button>
    <button :disabled="!graph" @click="focusNode(graph, 'lisbon')">focus Lisbon</button>
    <button :disabled="!graph" @click="showAll(graph)">show all</button>
</div>

<Pivotick
    :data="data"
    :options="options"
    :onLoadedCallback="onLoaded"
    :onUnmountedCallback="onUnmounted"
    useInlineStyle="margin: 1em 0; height: 560px; border: 1px solid #cccccc99; border-radius: 8px"
></Pivotick>

<style>
.fcs-toolbar { display: flex; flex-wrap: wrap; gap: 8px; margin: 1em 0; }
.fcs-toolbar button {
    padding: 5px 12px; font-size: 13px; cursor: pointer;
    border: 1px solid var(--vp-c-divider); border-radius: 6px;
    background: var(--vp-c-bg-soft); color: var(--vp-c-text-1);
}
.fcs-toolbar button:disabled { opacity: 0.5; cursor: not-allowed; }
</style>

::: code-group
<<< ./options.js#focus [Focus]
<<< ./options.js#options [Options]
<<< ./options.js#data [Data]
:::
