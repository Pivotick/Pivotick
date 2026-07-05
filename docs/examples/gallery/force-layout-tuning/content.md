---
title: "Force layout + tuning"
category: D
order: 1
---

# Force layout + tuning

The default layout is a physics simulation: nodes repel each other, links act
like springs, and a gentle gravity keeps everything centered. Three knobs shape
the result — tune them to go from a tight knot to an airy, readable map.

- **`d3ManyBodyStrength`** *(default `-150`)* — how hard nodes push apart. More
  negative spreads the graph out.
- **`d3LinkDistance`** *(default `30`)* — the resting length of each link.
- **`d3GravityStrength`** *(default `0.1`)* — the centering pull. Lower is looser.

Drag a node and the simulation re-settles around it.

<script setup>
import { data, options } from './options.js'
</script>

<Pivotick :data="data" :options="options"></Pivotick>

::: code-group
<<< ./options.js#options [Options]
<<< ./options.js#data [Data]
:::
