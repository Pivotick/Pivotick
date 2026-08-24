---
title: "Data table"
category: I
order: 5
aside: false
pageClass: gallery-wide
---

# Data table

A force layout is bad at three things people do constantly: reading exact values,
selecting at scale, and working out where to start. `UI.table` splits a **data dock** off
the bottom of the canvas to answer all three — the graph's rows, sortable and selectable.

The loop is **table to find, canvas to understand, sidebar to read**:

- The table opens sorted by requests, so the busiest service is the first row.
- Click any heading to re-sort; click again to reverse.
- Click a row to select it, <kbd>`Ctrl`</kbd> + <kbd>`Click`</kbd> to add one, or
  <kbd>`Shift`</kbd> + <kbd>`Click`</kbd> to take a range **in the order shown** — then act
  on the lot with the sidebar's bulk actions.
- Rubber-band a group on the canvas instead and the matching rows light up.
- Narrow the rows from the headers — the control follows the column: type into
  **Service**, pick from **Kind**, set bounds on **Requests / day**. That never touches
  the canvas: the graph's own filter stays with the filter panel, so the two can't fight.
- **Nodes** / **Edges** switch what is listed. **CSV** and **JSON** write out exactly what
  is on screen — this tab, these columns, this sort, this filter.

The dock also lists nodes the graph is currently *hiding*, with a `Visibility` column
saying whether a filter or a manual hide is responsible — so "23 nodes hidden" is
something you can inspect rather than take on trust.

Drag the divider to resize it, or fold it to its header bar with the chevron. Neither
moves the graph: the simulation tunes itself against the container, not the canvas, so
chrome opening and closing can never change a layout.

See [Data table](/ui-table) for the full option set.

<script setup>
import { data, options } from './options.js'
</script>

<Pivotick :data="data" :options="options" useInlineStyle="margin: 1em 0; height: 560px; border: 1px solid #cccccc99; border-radius: 8px"></Pivotick>

::: code-group
<<< ./options.js#options [Options]
<<< ./options.js#data [Data]
:::
