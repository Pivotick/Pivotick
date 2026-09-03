---
title: "Undo & history"
category: G
order: 6
aside: false
pageClass: gallery-wide
---

# Undo & history

The two buttons in the top bar are split buttons: the icon steps once, the caret opens the
whole history. It is one timeline with a **now** line through it — the rows above have been
undone, the rows below are what can still be undone — and clicking a row travels there.

Make some history, then open it:

- **Hide Node** or **Delete Node** from a node's right-click menu
- **Create ▸ Add node** on the left rail, then click the canvas
- Run a pivot, if you have one — an ingest is an entry like any other

Hover a row and it marks the span a click would reverse, lights those elements on the
canvas, and states the net effect in the footer first. <kbd>`Ctrl`</kbd> + <kbd>`Z`</kbd>
steps back without the menu.

Undo is contiguous: aiming three rows down reverses those three, as one batch.

<script setup>
import { data, options } from './options.js'
</script>

<Pivotick :data="data" :options="options" useInlineStyle="margin: 1em 0; height: 560px; border: 1px solid #cccccc99; border-radius: 8px"></Pivotick>

::: code-group
<<< ./options.js#options [Options]
<<< ./options.js#persisted [Write-through]
<<< ./options.js#data [Data]
:::

A change your integration wrote through to a backend is **sealed**: still listed, never
reversed, and a span containing one passes over it and says so (`Undoes 2 of 3 · 1 saved
item kept`).

See [Undo & history](/history) for the four kinds of entry, what is deliberately not
recorded, and how undoing an ingest puts its candidates back in the triage pane.
