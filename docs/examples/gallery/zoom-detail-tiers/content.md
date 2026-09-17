---
title: "Detail that follows the zoom"
category: B
order: 9
aside: false
pageClass: gallery-wide
---

# Detail that follows the zoom

One node, three drawings. `tiers` picks between them from how large the node currently
renders, so an overview is dots and a close-up is labelled chips, and neither has to be the
compromise the other can live with.

| Drawing | Declared as | Shows up |
|---|---|---|
| a coloured dot | `tiers[0]`, 32×32 | once the node renders 32 pixels wide |
| a labelled chip | `tiers[1]`, 140×44 | once it renders 140, which is zoom 1 here |
| a detail card | `focusTier`, 280×150 | on hover or a lone selection, at any zoom |

<script setup>
import { data, options } from './options.js'
</script>

<Pivotick :data="data" :options="options" useInlineStyle="margin: 1em 0; height: 640px; border: 1px solid #cccccc99; border-radius: 8px"></Pivotick>

Things worth provoking:

- **Scroll out, then back in.** The whole canvas changes drawing at once, because every
  node shares a footprint and therefore a threshold. Nothing moves while it happens: the
  box each node reserves in the layout is the widest tier's, and the drawing changes inside
  it.
- **Park the zoom right on the threshold and nudge it.** A tier that has engaged holds
  until the rendered size falls to 85% of what engaged it, so the picture settles instead
  of flickering.
- **Hover a dot while zoomed out.** The detail card is counter-scaled against the zoom, so
  it is the same 280×150 pixels however small the node is. Reading one node never means
  zooming to it.
- **Select a node, then shift-select a second.** One selection promotes; two do not. Twenty
  cards at once would be a wall.

::: tip The footprint is declared, not measured
`width` and `height` are numbers you give, because the layout has to know how much room to
leave before the first tick — and a measured card only reports its size after it has been
drawn.
:::

::: code-group
<<< ./options.js#options [Options]
<<< ./options.js#data [Data]
:::

See [Rendering → Detail that follows the zoom](/render#node-tiers) for the full contract:
what picks a tier, how to move a threshold, and when the focus drawing fires.
