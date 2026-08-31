---
title: "Add a rail mode"
category: F
order: 9
aside: false
pageClass: gallery-wide
---

# Add a rail mode

The left rail holds **modes**, not buttons. Select, Create, View and Physics are built in,
and each shows only its own tools — which is why the rail stays four slots tall however
much the graph can do. `addRailMode()` adds a fifth.

This card adds an **Explore** mode for walking a service graph: pick a node, select its
neighbours, narrow the canvas to them, then step back out. Press `E`, or click the compass
below the divider.

## Where your mode lands

Registered modes sit **below a divider**, after the built-ins, ordered among themselves by
`order`. A plugin can't reorder or remove the built-in four, so everything above the line
is the same in every Pivotick graph, and everything below it is yours.

## Declare tools, not markup

A mode's `tools` become rows in the contextual panel, drawn just like Select's and
Create's. You supply the verbs; each row's `kind` says how it behaves:

| `kind` | Behaviour |
|---|---|
| `'action'` | runs once and leaves the mode alone — all three tools here |
| `'toggle'` | arms a tool: the panel collapses and **the rail button becomes that tool**, the way Select's slot becomes `Lasso` |
| `'default'` | the tool the mode rests on, and what a toggle goes back to |

`enabled()` is re-checked whenever the selection changes — that's why *Select neighbours*
and *Isolate* stay greyed out until you pick a node.

## Nothing here is privileged

Every tool above calls public API you could call yourself: `getEdges()` to walk relations,
`selectNodes()` to select them, `setVisibleNodes()` to narrow the canvas. The mode just
gives them somewhere to live — a rail slot, a shortcut, an armed state and a panel.

Which is the point: an Explore mode that knows what "neighbour" means for your data is
something you can build and we can't.

::: tip Modes exclude each other
Opening Explore closes View and Physics, and vice-versa — one store, one active mode. Undo
whatever your mode armed in `onExit`; it also runs if the mode is removed while it's
active, and the rail falls back to Select.
:::

## When a flyout fits better

A mode that configures rather than acts wants the wide overlay, not the narrow tool strip.
Set `kind: 'flyout'`, subclass the exported `Flyout`, and pass `addRailMode` a factory —
see [Contributing a rail mode](/plugins#rail-mode).

<script setup>
import { data, options } from './options.js'
</script>

<Pivotick :data="data" :options="options" useInlineStyle="margin: 1em 0; height: 560px; border: 1px solid #cccccc99; border-radius: 8px"></Pivotick>

::: code-group
<<< ./options.js#options [Options]
<<< ./options.js#data [Data]
:::
