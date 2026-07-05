---
title: "Knowledge base"
category: L
order: 3
---

# Knowledge base

Three of Pivotick's more distinctive features in one place: **markdown notes** with
live `[[references]]`, node styling by category, and the **query engine** for
filtering. The note on the left is an onboarding guide — hover a coloured reference
to highlight that article, click to select it. The buttons narrow the base to a
single topic; the note stays put.

<script setup>
import { shallowRef } from 'vue'
import { data, options, filterByTopic, clearFilters, onLoaded } from './options.js'

const graph = shallowRef(null)
const onLoadedCb = (g) => { graph.value = g; onLoaded(g) }
const onUnmounted = () => { graph.value = null }
</script>

<div class="kb-toolbar">
    <button :disabled="!graph" @click="filterByTopic(graph, 'Databases')">Databases</button>
    <button :disabled="!graph" @click="filterByTopic(graph, 'Frontend')">Frontend</button>
    <button :disabled="!graph" @click="filterByTopic(graph, 'DevOps')">DevOps</button>
    <button :disabled="!graph" @click="clearFilters(graph)">reset</button>
</div>

<Pivotick
    :data="data"
    :options="options"
    :onLoadedCallback="onLoadedCb"
    :onUnmountedCallback="onUnmounted"
></Pivotick>

<style>
.kb-toolbar { display: flex; flex-wrap: wrap; gap: 8px; margin: 1em 0; }
.kb-toolbar button {
    padding: 5px 12px; font-size: 13px; cursor: pointer;
    border: 1px solid var(--vp-c-divider); border-radius: 6px;
    background: var(--vp-c-bg-soft); color: var(--vp-c-text-1);
}
.kb-toolbar button:disabled { opacity: 0.5; cursor: not-allowed; }
</style>

::: code-group
<<< ./options.js#notes [Notes]
<<< ./options.js#filter [Filtering]
<<< ./options.js#options [Options]
<<< ./options.js#data [Data]
:::
