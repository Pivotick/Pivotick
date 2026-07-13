---
title: "Selection menu + multi-select"
category: F
order: 3
aside: false
pageClass: gallery-wide
---

# Selection menu + multi-select

When several elements are selected, Pivotick shows a **selection menu** for bulk
actions. Populate it via `selectionMenu.menuNode` — the same `{ topbar, menu }` shape
as the context menu, but each `onclick` receives the *array* of selected nodes.

Select multiple nodes — hold **Shift** and click them, or drag a box around them —
and the selection menu appears. Try its actions.

<script setup>
import { data, options, onLoaded } from './options.js'
</script>

<Pivotick :data="data" :options="options" :onLoadedCallback="onLoaded" useInlineStyle="margin: 1em 0; height: 560px; border: 1px solid #cccccc99; border-radius: 8px"></Pivotick>

::: code-group
<<< ./options.js#options [Options]
<<< ./options.js#data [Data]
:::
