---
title: "Infra dependency map"
category: L
order: 4
---

# Infra dependency map

The clustering payoff at scale. A service architecture is grouped into **tiers**,
each a collapsible cluster — so the map opens as four boxes and their high-level
dependencies instead of a hairball. Expand a tier to drill into its services;
collapse it to zoom back out. Directed edges show which service calls which
(thickness tracks traffic, dashed amber marks async queue links), and colour
tracks the tier.

Click a cluster's **+ / −** badge to toggle it, or use the buttons.

<script setup>
import { shallowRef } from 'vue'
import { data, options, setAllExpanded, onLoaded } from './options.js'

const graph = shallowRef(null)
const onLoadedCb = (g) => { graph.value = g; onLoaded(g) }
const onUnmounted = () => { graph.value = null }
</script>

<div class="infra-toolbar">
    <button :disabled="!graph" @click="setAllExpanded(graph, true)">expand all</button>
    <button :disabled="!graph" @click="setAllExpanded(graph, false)">collapse all</button>
</div>

<Pivotick
    :data="data"
    :options="options"
    :onLoadedCallback="onLoadedCb"
    :onUnmountedCallback="onUnmounted"
></Pivotick>

<style>
.infra-toolbar { display: flex; gap: 8px; margin: 1em 0; }
.infra-toolbar button {
    padding: 5px 12px; font-size: 13px; cursor: pointer;
    border: 1px solid var(--vp-c-divider); border-radius: 6px;
    background: var(--vp-c-bg-soft); color: var(--vp-c-text-1);
}
.infra-toolbar button:disabled { opacity: 0.5; cursor: not-allowed; }
</style>

::: code-group
<<< ./options.js#options [Options]
<<< ./options.js#expand [Expand/collapse]
<<< ./options.js#data [Data]
:::
