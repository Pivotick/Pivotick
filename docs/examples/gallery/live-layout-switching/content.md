---
title: "Live layout switching"
category: D
order: 2
---

# Live layout switching

Layouts aren't fixed at construction — call `simulation.changeLayout(...)` any
time and the graph morphs into the new arrangement. This demo cycles through a
vertical tree, a horizontal tree, a radial tree, and the force layout on a timer.

`changeLayout` returns a promise that resolves only once the new layout has
settled and re-centered, so chaining transitions is just `await`. The timer is
started in `onLoadedCallback` and cleared in `onUnmountedCallback` so it can
never fire after the graph is gone.

<script setup>
import { ref } from 'vue'
import { data, options, startCycling, stopCycling } from './options.js'

const current = ref('Vertical tree')
const onLoaded = (graph) => startCycling(graph, (label) => { current.value = label })
const onUnmounted = () => stopCycling()
</script>

<p>Current layout: <strong>{{ current }}</strong></p>

<Pivotick
    :data="data"
    :options="options"
    :onLoadedCallback="onLoaded"
    :onUnmountedCallback="onUnmounted"
></Pivotick>

::: code-group
<<< ./options.js#cycle [Layout cycle]
<<< ./options.js#options [Options]
<<< ./options.js#data [Data]
:::
