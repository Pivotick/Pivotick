---
title: "Label an edge as you draw it"
category: G
order: 4
aside: false
pageClass: gallery-wide
---

# Label an edge as you draw it

Collect an edge's label from the user the moment it's drawn — no custom modal
wiring — and pick the UI to fit the gesture. The before-create hook's context offers
two helpers: **`ctx.promptLabel({ mode })`** drops a single free-text field (inline at
the edge's midpoint, or in a modal), and **`ctx.promptData({ fields })`** opens a
modal form built from the same field system as the node editor. Whatever is entered
becomes the new edge's `data.label`; cancelling (resolving `null`) creates nothing.

Click **Edit Graph** (top-right) → **Add Edge**, then connect two people:

- **Drag** from one node to another → a quick inline field to type any label.
- **Click** one node then another → a modal with a **dropdown of predefined
  relationship labels**; choose one and **Create edge**.

For the zero-code case, the static option
`UI: { editors: { edgeEditor: { labelPrompt: 'inline' } } }` prompts for a free-text
label on every edge with no callback at all.

<script setup>
import { data, options, onLoaded } from './options.js'
</script>

<Pivotick :data="data" :options="options" :onLoadedCallback="onLoaded" useInlineStyle="margin: 1em 0; height: 560px; border: 1px solid #cccccc99; border-radius: 8px"></Pivotick>

::: code-group
<<< ./options.js#options [Options]
<<< ./options.js#data [Data]
:::
