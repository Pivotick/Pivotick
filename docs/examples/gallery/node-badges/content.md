---
title: "Rim badges"
category: B
order: 8
---

# Rim badges

Colour, shape, size and icon are usually all spoken for by the time you want to
show one more thing. `badges` is a channel of its own: small indicators pinned to
the node's rim, returned per node, spending none of the encodings above.

Here the style map owns the node's *type* and the badges carry two independent
facts on top — how many notes a node has, and whether anyone disputes it. Click a
blue count to see a badge handle its own click; hover any badge for its tooltip.

Badges auto-place clockwise from the top-right into whichever corners are free, so
you rarely name a `position`. Four fit on a plain node and two on one with
children, since the expand affordance owns the East side; anything past that folds
into a `+n` that names what it hid.

<script setup>
import { data, options } from './options.js'
</script>

<Pivotick :data="data" :options="options"></Pivotick>

::: code-group
<<< ./options.js#options [Options]
<<< ./options.js#data [Data]
:::
