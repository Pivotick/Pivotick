---
title: "Tooltip customization"
category: F
order: 1
---

# Tooltip customization

Tooltips ramp from *easy* to *full control*. `nodeHeaderMap` remaps the title and
subtitle from your data; `renderNodeExtra` keeps the built-in tooltip and appends
your own content after it; and `render` hands you the whole tooltip to replace.

Hover any node — the default tooltip shows, with a custom commits line appended
via `renderNodeExtra`.

<script setup>
import { data, options } from './options.js'
</script>

<Pivotick :data="data" :options="options"></Pivotick>

::: code-group
<<< ./options.js#options [Options]
<<< ./options.js#data [Data]
:::
