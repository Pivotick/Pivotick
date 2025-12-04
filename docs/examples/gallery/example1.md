---
title: "Basic example"
---

# Basic example

::: code-group

<<< @/examples/gallery/basic.js#options [Code]

:::


## Result

<script setup>
    import { data as data_e, options as options_e } from './basic.js'
</script>

<Pivotick
    :data="data_e"
    :options="options_e"
></Pivotick>
