---
title: "Interaction events + inspector"
category: E
order: 1
---

# Interaction events + inspector

`options.callbacks` is how you react to what the user *does* — clicks, hovers,
selections, and canvas gestures. Each callback receives the Node or Edge it
concerns, so wiring up an app is a one-liner per event.

Interact with the graph and watch the log below: click a node, hover across the
edges, pan or zoom the background. (This is distinct from the **[data event
bus](../data-event-bus/content)**, which reports what *changed*.)

<script setup>
import { ref } from 'vue'
import { data, createOptions } from './options.js'

const logRef = ref(null)
const options = createOptions((type, detail) => logRef.value?.push(type, detail))
</script>

<Pivotick
    :data="data"
    :options="options"
    useInlineStyle="margin: 1em 0 8px; height: 360px; border: 1px solid #cccccc99; border-radius: 8px"
></Pivotick>

<EventLog ref="logRef" accent="#6366f1" hint="Click, hover, select or pan the graph…" coalesce />

::: code-group
<<< ./options.js#options [Options]
<<< ./options.js#data [Data]
:::
