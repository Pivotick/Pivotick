---
title: "Extend with a plugin"
category: F
order: 5
aside: false
pageClass: gallery-wide
---

# Extend with a plugin

A **plugin** is a self-contained bundle of UI elements, keybindings and
lifecycle hooks that installs itself into a graph — the core never needs to know
it exists. Register plugins declaratively through the `plugins` option, or
imperatively at any time with `graph.use(plugin)`.

On install, a plugin is handed a `PluginContext` with everything it needs:
`addElement()` to drop a UI element into a layout slot (its lifecycle is then
managed for you), `onPhase()` to hook `afterMount` / `graphReady` / `destroy`,
`addKeybinding()` for shortcuts that are cleaned up automatically, plus direct
access to `graph`, `ui` and `layout`.

The example below installs a one-element plugin: a **stats overlay** pinned to
the canvas that reads live node/edge counts once the graph is ready. It extends
`UIComponent`, so its `mount → afterMount → graphReady → destroy` lifecycle (and
any listeners it tracks) is driven by the same machinery as the built-in
sidebar, toolbar and tooltip — adding a new interface is just one `addElement`.

_Click the graph, then press **B** to toggle the overlay._

<script setup>
import { data, options } from './options.js'
</script>

<Pivotick :data="data" :options="options" useInlineStyle="margin: 1em 0; height: 560px; border: 1px solid #cccccc99; border-radius: 8px"></Pivotick>

::: code-group
<<< ./options.js#options [Options]
<<< ./options.js#data [Data]
:::
