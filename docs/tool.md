---
layout: false
---


<script setup>
    import { data as data_e, options as options_e, loadedCb } from './examples/tool/options.js'
</script>

<Pivotick
    :data="data_e"
    :options="options_e"
    :style="'margin: 0; height: 100vh; border: none'"
    :onLoadedCallback="loadedCb"
></Pivotick>