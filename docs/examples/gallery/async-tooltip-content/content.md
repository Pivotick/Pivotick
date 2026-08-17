---
title: "Async tooltip content"
category: F
order: 6
---

# Async tooltip content

When a node's data is a *reference* to a record rather than the record itself,
the interesting content is behind an HTTP call. Return a **promise** from a
content hook and the library handles the rest: it shows a placeholder, swaps in
the content when it resolves, and drops the result if the tooltip has since
moved to another node.

Hover a node and wait — the enrichment chips arrive after ~900 ms. Then hover
one node and immediately move to the next: the abandoned request is aborted via
`ctx.signal`, and its late result never lands in the tooltip you are looking at.

<script setup>
import { data, options } from './options.js'
</script>

<Pivotick :data="data" :options="options"></Pivotick>

::: code-group
<<< ./options.js#options [Options]
<<< ./options.js#endpoint [Endpoint]
<<< ./options.js#data [Data]
:::

The same applies to the sidebar's `propertiesPanel`, `neighborsPanel`,
`mainHeader` and extra panels — see
[asynchronous content](/ui#async-content) for the full contract.
