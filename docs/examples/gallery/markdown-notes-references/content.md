---
title: "Markdown notes + references"
category: H
order: 2
---

# Markdown notes + references

A note's `content` is Markdown — headings, lists, bold, links all render. The
standout is `[[Name]]`: it becomes a **live node reference**. Click one to select
that node, hover to highlight it. References resolve by node id or label, so they
stay meaningful as your graph grows.

Hover the coloured references in the note to highlight their nodes; click one to
select it.

<script setup>
import { data, options, onLoaded } from './options.js'
</script>

<Pivotick :data="data" :options="options" :onLoadedCallback="onLoaded"></Pivotick>

::: code-group
<<< ./options.js#notes [Notes]
<<< ./options.js#data [Data]
:::
