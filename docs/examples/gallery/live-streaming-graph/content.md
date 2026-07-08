---
title: "Live / streaming graph"
category: J
order: 2
---

# Live / streaming graph

Graphs are rarely static. `graph.updateData(nodes, edges)` merges a batch of
changes at once — new ids are added, existing ones updated — which makes it the
natural fit for a live feed: monitoring, activity streams, incremental loads. Pair
it with `renderer.fitAndCenter()` to keep the growing graph framed, and listen on
`dataBatchChanged` to keep your own state in step.

This demo streams in a node every 1.4s and prunes the oldest to hold a rolling
window — the counter reacts purely off `dataBatchChanged`.

<script setup>
import { ref } from 'vue'
import { data, startStreaming, stopStreaming, onDataChange } from './options.js'

// The count updates on a timer, so write it to the DOM directly rather than a
// reactive binding — a re-render would reset the selected code-group tab below.
const count = ref(null)
let off = null
const onLoaded = (graph) => {
    off = onDataChange(graph, (n) => { if (count.value) count.value.textContent = String(n) })
    startStreaming(graph)
}
const onUnmounted = () => { stopStreaming(); off?.(); off = null }
</script>

<p class="stream-status"><span class="stream-dot"></span> streaming — <strong ref="count">6</strong> nodes</p>

<Pivotick
    :data="data"
    :options="{}"
    :onLoadedCallback="onLoaded"
    :onUnmountedCallback="onUnmounted"
></Pivotick>

<style>
.stream-status { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--vp-c-text-2); margin: 1em 0; }
.stream-dot {
    width: 8px; height: 8px; border-radius: 50%; background: #10b981;
    box-shadow: 0 0 0 0 #10b98166; animation: stream-pulse 1.4s ease-out infinite;
}
@keyframes stream-pulse {
    0% { box-shadow: 0 0 0 0 #10b98166; }
    70% { box-shadow: 0 0 0 6px #10b98100; }
    100% { box-shadow: 0 0 0 0 #10b98100; }
}
</style>

::: code-group
<<< ./options.js#stream [Streaming]
<<< ./options.js#react [React to changes]
<<< ./options.js#data [Data]
:::
