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

The buttons mutate the graph; the panel shows the events that fire in response —
including the cascade where removing a node also removes its edge.

<script setup>
import { ref, shallowRef } from 'vue'
import { data, options, registerEvents, addNode, removeNode } from './options.js'

const log = ref([])
const graph = shallowRef(null)
let unsubscribe = null

function pushEvent(type, detail) {
    log.value = [{ type, detail }, ...log.value].slice(0, 14)
}

const onLoaded = (g) => {
    graph.value = g
    unsubscribe = registerEvents(g, pushEvent)
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

<div class="evt-demo">
    <div class="evt-graph">
        <Pivotick
            :data="data"
            :options="options"
            :onLoadedCallback="onLoaded"
            :onUnmountedCallback="onUnmounted"
            useInlineStyle="height: 340px; border: 1px solid #cccccc99; border-radius: 4px"
        ></Pivotick>
    </div>
    <ul class="evt-log">
        <li v-if="!log.length" class="evt-empty">Add or remove a node to fire events…</li>
        <li v-for="(e, i) in log" :key="i" class="evt-row">
            <span class="evt-type">{{ e.type }}</span>
            <span class="evt-detail">{{ e.detail }}</span>
        </li>
    </ul>
</div>

<style>
.evt-toolbar { display: flex; gap: 8px; margin: 1em 0 0; }
.evt-toolbar button {
    padding: 5px 12px; font-size: 13px; cursor: pointer;
    border: 1px solid var(--vp-c-divider); border-radius: 6px;
    background: var(--vp-c-bg-soft); color: var(--vp-c-text-1);
}
.evt-toolbar button:disabled { opacity: 0.5; cursor: not-allowed; }
.evt-demo { display: flex; gap: 12px; align-items: stretch; flex-wrap: wrap; margin: 0.6em 0 1em; }
.evt-graph { flex: 1 1 320px; min-width: 0; }
.evt-log {
    flex: 0 0 200px; margin: 0; padding: 8px; list-style: none;
    overflow-y: auto; max-height: 380px;
    border: 1px solid #cccccc99; border-radius: 4px; font-size: 13px;
}
.evt-empty { color: #94a3b8; }
.evt-row { display: flex; align-items: baseline; gap: 6px; padding: 2px 0; }
.evt-type { flex: 0 0 auto; font-weight: 600; color: #10b981; }
.evt-detail { flex: 1 1 auto; color: var(--vp-c-text-2); }
</style>

::: code-group
<<< ./options.js#events [Event bus]
<<< ./options.js#mutate [Mutations]
<<< ./options.js#options [Options]
<<< ./options.js#data [Data]
:::
