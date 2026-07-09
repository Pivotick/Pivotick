---
title: "Label an edge as you draw it"
category: G
order: 4
---

# Label an edge as you draw it

Collect an edge's label from the user mid-gesture — no custom modal wiring. The
before-create hook's context carries **`ctx.promptLabel({ mode })`**: it resolves to
the typed string (or `null` if cancelled), and `mode` picks the UI per event —
`'inline'` drops a small field at the edge's midpoint, `'modal'` opens a dialog.
Feed the result into the new edge's `data` and you've enriched it before it exists.

Click **Edit Graph** (top-right) → **Add Edge**, then connect two people. A
**drag** prompts inline; a **click-click** connect opens a modal. Type a relationship
and press **Enter** (or **Add**) to create the labeled edge, or press **Esc** /
cancel to create nothing.

For the simplest case — prompt on *every* edge with no callback — set the static
option instead: `UI: { editors: { edgeEditor: { labelPrompt: 'inline' } } }`.

Need more than a label? **`ctx.promptData({ fields })`** opens a modal form (the same
field system as the node editor) and resolves the whole payload; pass `render` +
`getValues` instead for fully custom HTML.

<script setup>
import { data, options, onLoaded } from './options.js'
</script>

<Pivotick :data="data" :options="options" :onLoadedCallback="onLoaded"></Pivotick>

::: code-group
<<< ./options.js#options [Options]
<<< ./options.js#data [Data]
:::
