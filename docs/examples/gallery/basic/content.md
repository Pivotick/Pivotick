---
title: "Basic example"
---

# Basic example


<script setup>
    import { data as data_e, options as options_e } from './options.js'
</script>

<Pivotick
    :data="data_e"
    :options="options_e"
></Pivotick>


::: code-group

<<< ./options.js#options [Options]
<<< ./options.js#data [Data]

:::


