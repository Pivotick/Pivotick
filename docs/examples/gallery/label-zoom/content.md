---
title: "Labels arrive as you zoom in"
category: B
order: 10
aside: false
pageClass: gallery-wide
---

# Labels arrive as you zoom in

A label rides the graph, so the further out the view is the smaller it is painted. Past a
point it is no longer text, just grey texture over the graph. `render.minLabelFontSize` is
the size, in rendered pixels, below which it is not drawn at all.

The graph below opens with none of its labels. Scroll in and the site names appear first,
then the host names and the edge labels.

<script setup>
import { data, options } from './options.js'
</script>

<Pivotick :data="data" :options="options" useInlineStyle="margin: 1em 0; height: 640px; border: 1px solid #cccccc99; border-radius: 8px"></Pivotick>

Things worth provoking:

- **Scroll in slowly.** The site names arrive before the host names. A node's label is
  derived from its size, so a site drawn at 40 has an 18-unit label and a host drawn at 10 has
  the floor of 12. One number for the whole canvas, and the difference you want falls out of
  the sizes already there.
- **Park the zoom on the point a label appears and nudge it.** A label that is showing holds
  until its rendered size falls to 85% of the threshold, so the picture settles instead of
  flickering. Every label at one size answers together.
- **Select an edge, then scroll back out.** It keeps its label while every other one goes,
  held at a constant size on screen rather than shrinking with the graph. An edge has no
  tooltip and no panel, so its label is the only thing that answers for it.
- **Scroll in on one site, then pan to another.** A label is re-picked for what is on
  screen, so a site you zoomed past gets its name when you pan back to it rather than while
  it is out of sight.

::: tip Turning it off
`minLabelFontSize: 0` draws every label at every zoom, which is what the library did before
the option existed.
:::

::: code-group
<<< ./options.js#options [Options]
<<< ./options.js#data [Data]
:::

See [Rendering → Labels at a readable size](/render#label-zoom) for the contract, and
[Detail that follows the zoom](/examples/gallery/zoom-detail-tiers/content) for the node half
of the same idea.
