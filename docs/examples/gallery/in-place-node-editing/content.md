---
title: "In-place node editing"
category: G
order: 1
aside: false
pageClass: gallery-wide
---

# In-place node editing

Pivotick ships an editing layer, not just a viewer. Double-click a node to open its
edit modal; `onBeforeNodeEditCommit` is your validation / veto hook (return `false`
to reject a bad edit and keep the modal open), and `onNodeEditCancel` fires when the
user backs out.

Double-click **Alice** and change a field. Clear the name and try to save — the
commit is refused. The toolbar's **Edit Graph → Edit** opens the same modal.

<script setup>
import { data, options, onLoaded } from './options.js'
</script>

<Pivotick :data="data" :options="options" :onLoadedCallback="onLoaded" useInlineStyle="margin: 1em 0; height: 560px; border: 1px solid #cccccc99; border-radius: 8px"></Pivotick>

::: code-group
<<< ./options.js#options [Options]
<<< ./options.js#data [Data]
:::
