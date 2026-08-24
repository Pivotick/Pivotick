---
title: "Auto-tuned layout"
category: D
order: 1
---

# Auto-tuned layout

A graph of five nodes and a graph of five hundred want very different physics, and
so does a graph of small dots versus one of big image cards. Rather than picking
one set of force settings and hoping, Pivotick derives them from what is actually
on screen — node count, node size, canvas size — and re-derives them whenever the
graph changes. This is the default.

Grow the graph below and watch the knobs move: link distance drops as the canvas
gets crowded, and the centering pull rises to hold everything in frame.

- **It only moves knobs you can see.** Auto drives the same controls as the Physics
  flyout, and the sliders follow along — nothing happens behind a hidden lever.
- **You always win.** Drag a slider, or pick **Tight** / **Loose**, and auto stops
  for good; it will never re-tune over a choice you made.
- **It stays calm.** Triggers arriving together are coalesced, and a change too
  small to see is skipped — so a pivot that adds forty nodes costs one relayout.
- **It never wakes a paused simulation.**

Auto is on unless the graph configures a force itself, so existing setups keep
theirs. See [Automatic layout tuning](/simulation#auto-physics) for the exact rule.

<script setup>
import { ref } from 'vue'
import { data, options, addBatch, reset, readKnobs } from './options.js'

const readout = ref(null)
let target = null

const show = () => {
    if (!target || !readout.value) return
    const k = readKnobs(target)
    readout.value.textContent =
        `${k.nodes} nodes — link ${k.linkDistance}px · repulsion ${k.repulsion} · centering ${k.centering}` +
        (k.auto ? '' : '  (auto off — you took over)')
}
// Auto is debounced, so read back a moment after the change lands.
const later = () => setTimeout(show, 400)

const onLoaded = (graph) => { target = graph; show() }
const onUnmounted = () => { target = null }
const grow = () => { addBatch(target); later() }
const shrink = () => { reset(target); later() }
</script>

<p class="auto-bar">
    <button class="auto-btn" @click="grow">Add 20 nodes</button>
    <button class="auto-btn" @click="shrink">Reset</button>
    <code ref="readout" class="auto-readout">—</code>
</p>

<Pivotick
    :data="data"
    :options="options"
    :onLoadedCallback="onLoaded"
    :onUnmountedCallback="onUnmounted"
></Pivotick>

<style>
.auto-bar { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; margin: 1em 0; }
.auto-btn {
    border: 1px solid var(--vp-c-divider); border-radius: 6px; padding: 4px 12px;
    font-size: 13px; background: var(--vp-c-bg-soft); color: var(--vp-c-text-1); cursor: pointer;
}
.auto-btn:hover { border-color: var(--vp-c-brand-1); color: var(--vp-c-brand-1); }
.auto-readout { font-size: 12px; color: var(--vp-c-text-2); background: none; padding: 0; }
</style>

::: code-group
<<< ./options.js#options [Options]
<<< ./options.js#grow [Growing the graph]
<<< ./options.js#knobs [Reading the knobs]
<<< ./options.js#data [Data]
:::
