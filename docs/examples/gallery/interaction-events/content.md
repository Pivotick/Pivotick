---
title: "Interaction events + inspector"
category: E
order: 1
---

# Interaction events + inspector

`options.callbacks` is how you react to what the user *does* — clicks, hovers,
selections, and canvas gestures. Each callback receives the Node or Edge it
concerns, so wiring up an app is a one-liner per event.

Interact with the graph and watch the panel: click a node, hover across the
edges, pan or zoom the background. (This is distinct from the **[data event
bus](../data-event-bus/content), which reports what *changed*.)

<script setup>
import { ref } from 'vue'
import { data, createOptions } from './options.js'

const log = ref([])

// The page's own display logic — repeats coalesce into one ×N row so rapid
// hover/zoom events don't flood the list.
function onEvent(type, detail) {
    const head = log.value[0]
    if (head && head.type === type && head.detail === detail) {
        head.count++
        log.value = [head, ...log.value.slice(1)]
        return
    }
    log.value = [{ type, detail, count: 1 }, ...log.value].slice(0, 12)
}

const options = createOptions(onEvent)
</script>

<div class="evt-demo">
    <div class="evt-graph">
        <Pivotick :data="data" :options="options" useInlineStyle="height: 360px; border: 1px solid #cccccc99; border-radius: 4px"></Pivotick>
    </div>
    <ul class="evt-log">
        <li v-if="!log.length" class="evt-empty">Click, hover, select or pan the graph…</li>
        <li v-for="(e, i) in log" :key="i" class="evt-row">
            <span class="evt-type">{{ e.type }}</span>
            <span class="evt-detail">{{ e.detail }}</span>
            <span v-if="e.count > 1" class="evt-count">×{{ e.count }}</span>
        </li>
    </ul>
</div>

<style>
.evt-demo { display: flex; gap: 12px; align-items: stretch; flex-wrap: wrap; margin: 1em 0; }
.evt-graph { flex: 1 1 320px; min-width: 0; }
.evt-log {
    flex: 0 0 200px; margin: 0; padding: 8px; list-style: none;
    overflow-y: auto; max-height: 360px;
    border: 1px solid #cccccc99; border-radius: 4px; font-size: 13px;
}
.evt-empty { color: #94a3b8; }
.evt-row { display: flex; align-items: baseline; gap: 6px; padding: 2px 0; }
.evt-type { flex: 0 0 auto; font-weight: 600; color: #6366f1; }
.evt-detail { flex: 1 1 auto; color: var(--vp-c-text-2); }
.evt-count { color: #94a3b8; }
</style>

::: code-group
<<< ./options.js#options [Options]
<<< ./options.js#data [Data]
:::
