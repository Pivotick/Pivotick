---
title: "Simplify the graph"
category: I
order: 6
aside: false
pageClass: gallery-wide
---

# Simplify the graph

Most of this graph is repetition: eight IPs on both events, six domains on one, nine files on
a host, ten sightings. `UI.simplify.rules` folds nodes that play the same role into one
**group** drawn in their place. The data is untouched: `graph.getNodes()` still returns every
node.

Two rules run here, in order. **By sensor** is the app's own: it gives each sighting its sensor
as a key, and nodes sharing a key become one group. The built-in **neighbour rule** then folds
nodes of one type linked to exactly the same nodes.

- Open the **Simplify** mode on the rail to switch a rule off or change its smallest group.
- **Double-click** a group to put its members back on the canvas; the chip above them folds
  them back.
- **Select** a group: the sidebar lists its members, each with *Pull out*.

The [Simplify](/simplify) page covers the rules, custom rules and the group's look.

<Pivotick
    :data="data"
    :options="options"
    useInlineStyle="margin: 1em 0; height: 560px; border: 1px solid #cccccc99; border-radius: 8px"
></Pivotick>

<script setup>
import { data, options } from './options.js'
</script>

::: code-group
<<< ./options.js#rules [Rules]
<<< ./options.js#options [Options]
<<< ./options.js#data [Data]
:::
