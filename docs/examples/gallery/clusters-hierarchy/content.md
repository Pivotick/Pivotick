---
title: "Clusters & hierarchy"
category: I
order: 2
---

# Clusters & hierarchy

Give a node `children` and it becomes a **cluster**: collapse it to a single node
to tame a busy graph, expand it to reveal its members laid out in a bubble. Edges
that cross a collapsed boundary fold into a synthetic edge on the cluster, so the
topology always stays readable. That holds even when *both* ends are hidden: the
`a3 → b1` link between the two groups re-targets to whichever nodes are on screen —
`group-a → group-b` when both are boxes, `a3 → group-b` once Group A opens — so the
dependency never disappears just because you collapsed a box.

Click the **+ / −** badge on a cluster to toggle it, or drive it from code with
`graph.toggleExpandNode(node)`. **Group A** starts open so you can see the link
re-target across states; hit **collapse all** to fold the graph down to two boxes
joined by that cross-cluster arrow.

<script setup>
import { shallowRef } from 'vue'
import { data, options, setAllExpanded, onLoaded } from './options.js'

const graph = shallowRef(null)
const onLoadedCb = (g) => { graph.value = g; onLoaded(g) }
const onUnmounted = () => { graph.value = null }
</script>

<div class="clu-toolbar">
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
.clu-toolbar { display: flex; gap: 8px; margin: 1em 0; }
.clu-toolbar button {
    padding: 5px 12px; font-size: 13px; cursor: pointer;
    border: 1px solid var(--vp-c-divider); border-radius: 6px;
    background: var(--vp-c-bg-soft); color: var(--vp-c-text-1);
}
.clu-toolbar button:disabled { opacity: 0.5; cursor: not-allowed; }
</style>

::: code-group
<<< ./options.js#expand [Expand/collapse]
<<< ./options.js#options [Options]
<<< ./options.js#data [Data]
:::
