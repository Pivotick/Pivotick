---
title: "Basic example"
---

# Basic example


<script setup>
    import { data as data_e, options as options_e } from './basic.js'
</script>

<Pivotick
    :data="data_e"
    :options="options_e"
></Pivotick>


::: code-group

<<< ./basic.js#options [Options]
<<< ./basic.js#data [Data]

:::


