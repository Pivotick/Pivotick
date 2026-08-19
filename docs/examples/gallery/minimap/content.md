---
title: "Minimap"
category: F
order: 7
aside: false
pageClass: gallery-wide
---

# Minimap

One line — `plugins: [minimap()]` — docks an overview of the whole graph in a canvas
corner, with a rectangle showing what's on screen. **Click** anywhere in it to bring the
view there; **drag** the rectangle to pan. The graph below is wider than its viewport, so
there is somewhere to go. The tiny arrow in the minimap's inner corner folds it away to
just that button when the canvas matters more than the overview.

The minimap is a **plugin**, not built-in chrome: it installs itself through the
`PluginContext` it is handed and uses nothing a plugin of your own couldn't — it reads
the graph's extent with `renderer.getContentBounds()`, works out the visible region by
inverting the canvas corners through `renderer.screenToGraphCoordinates()`, and moves the
view with `renderer.setViewport()`. See [Plugins](/plugins) for the whole surface.

It also stays cheap on a graph that actually needs one. The picture lives in a cached
offscreen bitmap that is only re-rasterised when the graph changes (or every 10th
simulation tick while a layout settles); panning and zooming redraw **one image and one
rectangle**, whatever the node count. Past 1500 nodes it stops drawing each node and
paints density instead, which reads better than tens of thousands of overlapping dots and
resolves no per-node styles at all.

<script setup>
import { data, options } from './options.js'
</script>

<Pivotick
    :data="data"
    :options="options"
    useInlineStyle="margin: 1em 0; height: 560px; border: 1px solid #cccccc99; border-radius: 8px"
></Pivotick>

<p class="mm-hint">
    Zoom in with the viewport controls, then drag the rectangle in the minimap — the
    content picture never redraws, only the rectangle moves.
</p>

<style>
.mm-hint { font-size: 13px; color: var(--vp-c-text-2); margin: 8px 0 0; }
</style>

::: code-group
<<< ./options.js#options [Options]
<<< ./options.js#data [Data]
:::
