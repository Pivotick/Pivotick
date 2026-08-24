---
title: "Add a dock pane"
category: F
order: 8
aside: false
pageClass: gallery-wide
---

# Add a dock pane

The bottom dock is a **shared region**, not the data table's private property: one grid
row, one height, one fold, however many panes are in it. `addDockTab()` is how you put
something else in there — the same door the built-in table comes through, so a pane you
register is its equal rather than its guest.

This card adds a **Summary** pane that rolls the graph up by owner or by kind. The dock's
strip reads `Table │ Summary`; click across and the body *and* the header controls change
with it, because `Select all` / `CSV` / `Columns` belong to the table and mean nothing
over a roll-up.

## One tab is one pane

The Summary pane shows the graph two ways — **By owner** and **By kind** — and those are
*views of one pane*, not two panes. So it registers a **single** dock tab and draws its own
switch, calling `refresh()` to change body.

That distinction is the whole design. Registering the two views as two dock tabs would
list them in the dock's strip beside `Table`, claiming that a view of the summary and the
entire data table are the same kind of thing. The built-in table does exactly what this
pane does: `Nodes` and `Edges` are *its* tabs, drawn on its own bar.

The two levels are drawn differently so they can sit next to each other and still read as
an outer and an inner:

| | Look | Class |
|---|---|---|
| `Table │ Summary` | full-height tabs, underlined when active, closed off by a rule | `pvt-dock-tabs` / `pvt-dock-tab` |
| `Nodes │ Edges`, `By owner │ By kind` | a small pill group | `pvt-dock-views` / `pvt-dock-view` |

The inner pair is public, which is why the switch below is three class names rather than a
block of inline style: your pane gets the same control the built-in table has, and a
consumer who retints `--pvt-theme-primary` or overrides either class retints both levels
at once.

## `refresh()` is not optional politeness

The dock **keeps the element your `render` returned** and re-attaches it when your pane
comes back to the front. A pane that swapped its own DOM would leave the dock holding a
stale node to hand back later. So changing body goes through `refresh()`, which calls
`render` again.

## Knowing when nobody is looking

`onActivate` / `onDeactivate` are the only signal a pane gets that it is off screen, and
what to do with them is yours to choose:

- Content that is a **function of the graph's current state** can stop working while
  hidden and re-derive on return. That is what this pane does, and what the data table
  does.
- Content that would **miss** something has to keep working and merely stop painting.
  That is what [`eventLog()`](/plugins#event-log) does — an event is gone once it has
  fired.

Nothing about the hooks prefers either.

## It brings the dock with it

Plugins install *after* the UI is built, so a dock tab always arrives after the region's
own mode gate has run. Registering one therefore **builds** the dock — your plugin works
with `UI.table: false` and needs nothing turned on but `full` mode. With the table off and
one pane of your own, no strip is drawn at all: the dock is simply your pane.

`UI.dock` configures the region itself (`open`, `collapsed`, `height`) — reach for it
rather than `UI.table` when the table is switched off, since that is then the only door.

See [Plugins](/plugins#dock-tab) for the contract and
[Data table](/ui-table#dock-tabs) for the dock's own options.

<script setup>
import { data, options } from './options.js'
</script>

<Pivotick :data="data" :options="options" useInlineStyle="margin: 1em 0; height: 560px; border: 1px solid #cccccc99; border-radius: 8px"></Pivotick>

::: code-group
<<< ./options.js#options [Options]
<<< ./options.js#data [Data]
:::
