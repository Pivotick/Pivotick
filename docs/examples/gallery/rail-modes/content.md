---
title: "Add a rail mode"
category: F
order: 9
aside: false
pageClass: gallery-wide
---

# Add a rail mode

The left rail holds **modes**, not buttons. Select, Create, View and Physics are built in;
each reveals only its own tools, so the rail stays four slots tall no matter how much the
graph can do. `addRailMode()` is how you add a fifth — and it is the surface most worth
extending, because a mode is where a *verb your data has* belongs.

This card adds an **Explore** mode for walking a service graph: select a node, reach its
neighbours, narrow the canvas to that neighbourhood, and step back out. Press `E`, or click
the compass below the divider.

## The divider is the contract

Registered modes render **below a divider**, after the built-ins, ordered among themselves
by `order`. That line is doing real work: everything above it is what Pivotick promises in
every graph, and everything below it is this integration's own vocabulary. A plugin cannot
reorder or remove the built-in four, so a user who learns the rail once knows it
everywhere.

## Declare tools, not markup

A pointer mode's `tools` are rows in the contextual panel, and the panel draws them the way
Select's and Create's are drawn — same look, same theme, same collapse behaviour. You
supply the verbs; each row's `kind` decides how it behaves:

| `kind` | Behaviour |
|---|---|
| `'action'` | runs once, leaves the mode as it was — the three tools here |
| `'toggle'` | arms a modal tool: the panel collapses and **the rail button becomes that tool**, the way Select's slot becomes `Lasso` |
| `'default'` | the tool the mode rests on, and what a toggle reverts to |

`enabled()` is re-checked on every selection change, which is why *Select neighbours* and
*Isolate* grey out until something is selected — an affordance that refuses is worse than
one that is visibly not ready yet.

## Nothing here is privileged

Every tool above is public API a consumer could call directly: `getEdges()` to walk
relations, `selectNodes()` to select them, `setVisibleNodes()` to narrow the canvas. The
mode contributes the *place to put them* — a slot on the primary surface, with a keyboard
shortcut, an armed state and a panel — rather than any new power over the graph.

That is the whole point of the door. An Explore mode that knows what "neighbour" means for
*your* data, or an Enrich mode that calls *your* API, is something you can build and we
cannot.

::: tip Modes exclude each other
Opening Explore closes View and Physics, and vice-versa — one store, one active mode. A
mode that arms something should undo it in `onExit`, which also runs if the mode is
removed while it is the active one. The rail then falls back to Select.
:::

## When a flyout fits better

A mode that configures rather than acts wants the wide settings overlay, not the narrow
tool strip. Declare `kind: 'flyout'`, subclass the exported `Flyout`, and hand
`addRailMode` a factory — see
[Contributing a rail mode](/plugins#rail-mode) for that shape.

<script setup>
import { data, options } from './options.js'
</script>

<Pivotick :data="data" :options="options" useInlineStyle="margin: 1em 0; height: 560px; border: 1px solid #cccccc99; border-radius: 8px"></Pivotick>

::: code-group
<<< ./options.js#options [Options]
<<< ./options.js#data [Data]
:::
