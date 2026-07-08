---
title: "Icon sources"
category: B
order: 5
---

# Icon sources

Every node draws its glyph a different way — one graph, five mechanisms, no links,
positions pinned so it reads like a legend:

- **`iconClass`** — a class-based icon font. This card ships a *generated* fake
  FontAwesome webfont (`fa-solid fa-star`); pivotick reads the glyph **and** its
  font off the computed `::before`, so any icon font works with zero config.
- **`html` + CSS mask** — a misp-iconify icon in its "class only" build, where the
  glyph is an SVG data-URI applied as a `mask` over `background-color: currentColor`.
  No webfont — just drop the `misp-icon` classes into a custom HTML node.
- **`svgIcon`** — a raw inline `<svg>`; `fill="currentColor"` picks up the node's `strokeColor`.
- **`imagePath`** — any image URL, drawn straight into the node (small by default;
  see *Image fit modes* to make it fill the shape).
- **`iconUnicode`** — a literal character (here an emoji), handy for one-off glyphs.

Mix and match freely: FontAwesome and misp-iconify nodes happily coexist in the
same graph, no per-consumer glue.

<script setup>
import { data, options } from './options.js'
// The demo's icon fonts/masks — scoped to this page by importing them here.
import './fakeawesome.css'
import './misp-mask.css'
</script>

<Pivotick :data="data" :options="options"></Pivotick>

::: code-group
<<< ./options.js#options [Options]
<<< ./options.js#data [Data]
:::
