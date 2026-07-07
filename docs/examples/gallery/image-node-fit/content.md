---
title: "Image fit modes"
category: B
order: 7
---

# Image fit modes

An `imagePath` node draws a picture, but how the picture sits on the shape is up
to you — set `imageFit` (a value, or a `(node) => …` so different nodes can differ).
Here one landscape screenshot is rendered four ways — three on identical squares,
plus a `'frame'` node below that takes the picture's own shape:

- **`'icon'`** *(default)* — a small picture (~1.2× `size`) centred on the shape,
  aspect preserved. This is the legacy look; the coloured shape shows around it, so
  a picture reads as an *icon* alongside other icon-class nodes.
- **`'cover'`** — the picture fills the shape's box (2× `size`) and is cropped to
  preserve its aspect ratio. A clean filled thumbnail whose stroke reads as a thin
  border — the fit for screenshot/attachment nodes.
- **`'contain'`** — the whole picture fits inside the box, letterboxed; the shape's
  `color` shows in the bars for non-square images.
- **`'frame'`** — the node *becomes* the picture: it's sized to the image's own aspect
  ratio (longest side = 2× `size`), so the whole screenshot shows at full resolution
  with the stroke hugging it — no crop, no letterbox bars. `shape` is ignored (the
  picture is the node). Ideal for screenshot/attachment previews.

Because it resolves per node, one graph can mix modes — screenshots `'frame'` or
`'cover'`, other attachments `'icon'` — straight off the node's data. Growing `size`
scales the picture proportionally, so the relative border stays the same — no fixed inset.

<script setup>
import { data, options } from './options.js'
</script>

<Pivotick :data="data" :options="options"></Pivotick>

::: code-group
<<< ./options.js#options [Options]
<<< ./options.js#data [Data]
:::
