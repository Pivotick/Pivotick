---
title: "Edge labels"
category: C
order: 3
---

# Edge labels

Give an edge a `label` in its data and Pivotick renders it on the line. Style all
labels at once with `defaultLabelStyle` (font, color, background). Flip
`rotateLabel` to `true` to make each label follow its edge's angle. For full
control, `render.renderLabel(edge)` lets you return arbitrary HTML — the same
escape hatch as `renderNode`.

<script setup>
import { data, options } from './options.js'
</script>

<Pivotick :data="data" :options="options"></Pivotick>

::: code-group
<<< ./options.js#options [Options]
<<< ./options.js#data [Data]
:::
