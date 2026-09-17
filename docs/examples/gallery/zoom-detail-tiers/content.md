---
title: "Detail that follows the zoom"
category: B
order: 9
aside: false
pageClass: gallery-wide
---

# Detail that follows the zoom

One node, four drawings. `tiers` picks between them from how large the node currently
renders, so an overview is dots and a close-up is cards, and neither has to be the
compromise the other can live with.

| Drawing | Declared as | Shows up |
|---|---|---|
| a bare dot | the base style | when even 32 pixels is too much |
| a coloured dot | `tiers[0]`, 32×32 | once the node renders 32 pixels wide |
| a labelled chip | `tiers[1]`, 110×46 | once it renders 110, i.e. half zoom |
| a summary card | `tiers[2]`, 220×110 | once it renders 220, which is zoom 1 here |
| a detail card | `focusTier`, 280×150 | on hover or a lone selection, at any zoom |

`tiers` is an array and nothing caps its length. The widest one sets the footprint, so it is
the one that engages at zoom 1 and is drawn at exactly its design size.

<script setup>
import { data, options } from './options.js'
</script>

<Pivotick :data="data" :options="options" useInlineStyle="margin: 1em 0; height: 640px; border: 1px solid #cccccc99; border-radius: 8px"></Pivotick>

Things worth provoking:

- **Scroll out, then back in.** The whole canvas changes drawing at once, because every
  node shares a footprint and therefore a threshold. Nothing moves while it happens: the
  box each node reserves in the layout is the widest tier's, and the drawing changes inside
  it.
- **Scroll slowly through a threshold.** The drawings cross-fade rather than cutting, so
  nothing blinks: the outgoing one is held on screen while the new one comes up underneath
  it. `render.tierTransition` sets how long that takes, and `0` puts the hard cut back.
- **Park the zoom right on a threshold and nudge it.** A tier that has engaged holds
  until the rendered size falls to 85% of what engaged it, so the picture settles instead
  of flickering.
- **Watch the chip on the way in.** An intermediate tier engages at `width / footprint` of
  zoom 1, so it appears smaller than the box it was designed for and grows into it. That is
  the trade in narrowing one: a smaller drawing asks for less room and so shows up sooner,
  but it shows up smaller too. Its type is sized in graph units for the zooms it actually
  lives at; give it an explicit `minRenderedSize` if you would rather it waited for more room
  without redrawing it.
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
