---
title: "Data event bus"
category: E
order: 2
---

# Data event bus

Separate from interaction callbacks, the graph emits a typed **data event bus**
for everything that *changes* — `nodeAdd`, `nodeRemove`, `edgeAdd`, `edgeRemove`,
`nodeChange`, `dataBatchChanged`, and more. Subscribe with `graph.on(event, fn)`
and unsubscribe with `graph.off(event, fn)`. This is the seam for persistence,
undo, or syncing the graph to your backend.

The buttons mutate the graph; the log shows the events that fire in response —
including the cascade where removing a node also removes its edge.

<script setup>
import { ref, shallowRef } from 'vue'
import { data, registerEvents, addNode, removeNode } from './options.js'

const options = {}
const logRef = ref(null)
const graph = shallowRef(null)
let unsubscribe = null

const onLoaded = (g) => {
    graph.value = g
    unsubscribe = registerEvents(g, (type, detail) => logRef.value?.push(type, detail))
}
const onUnmounted = () => {
    unsubscribe?.()
    unsubscribe = null
    graph.value = null
}
</script>

<div class="evt-toolbar">
    <button :disabled="!graph" @click="addNode(graph)">Add node</button>
    <button :disabled="!graph" @click="removeNode(graph)">Remove node</button>
</div>

<Pivotick
    :data="data"
    :options="options"
    :onLoadedCallback="onLoaded"
    :onUnmountedCallback="onUnmounted"
    useInlineStyle="margin: 8px 0; height: 340px; border: 1px solid #cccccc99; border-radius: 8px"
></Pivotick>

<EventLog ref="logRef" accent="#10b981" hint="Add or remove a node to fire events…" />

<style>
.evt-toolbar { display: flex; gap: 8px; margin: 1em 0 0; }
.evt-toolbar button {
    padding: 5px 12px; font-size: 13px; cursor: pointer;
    border: 1px solid var(--vp-c-divider); border-radius: 6px;
    background: var(--vp-c-bg-soft); color: var(--vp-c-text-1);
}
.evt-toolbar button:disabled { opacity: 0.5; cursor: not-allowed; }
</style>

::: code-group
<<< ./options.js#events [Event bus]
<<< ./options.js#mutate [Mutations]
<<< ./options.js#data [Data]
:::
