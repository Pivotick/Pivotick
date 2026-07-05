---
title: "Sidebar customization"
category: F
order: 4
---

# Sidebar customization

The sidebar is a batteries-included surface you can reshape at three levels:
`mainHeader` maps the title and subtitle, `propertiesPanel.nodePropertiesMap`
curates which fields show, and `extraPanels` adds panels with arbitrary HTML.

A node is selected on load so the customized sidebar is visible — click any other
node to update it.

<script setup>
import { data, options, onLoaded } from './options.js'
</script>

<Pivotick :data="data" :options="options" :onLoadedCallback="onLoaded"></Pivotick>

::: code-group
<<< ./options.js#options [Options]
<<< ./options.js#data [Data]
:::
