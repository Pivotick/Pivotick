---
title: "Edge layers"
category: C
order: 4
aside: false
pageClass: gallery-wide
---

# Edge layers

This graph carries **four kinds of relation at once**: services `call` each other, a
database `replicates`, a monitoring hub `monitors` half the estate, and a pipeline
records what was `deployed-with` what. Drawn alike they would be a hairball. Drawn
apart they are still a hairball — because the call graph you came to read is buried
under two layers of context.

Layers are the three steps that fix that, and they are meant to be used together:

1. **Name the kind** — `render.edgeTypeAccessor`.
2. **Style it apart** — `render.edgeStyleMap`.
3. **Switch it off** — `UI.filter.edgeFacets`.

Try it: open **Filter Graph** and use the **Relationships** rows, or click the
*Relationship* swatches in the legend — they are the same filter seen twice. Turn
off `monitors` and `deployed-with` and the call graph is suddenly legible.

**Watch the nodes while you do it.** They don't move. Switching a layer changes
which lines are drawn and nothing else: the link force gates on a separate flag, so
an edge whose layer is off goes on pulling its endpoints together. Layout, selection
and camera come back bit-for-bit identical. If hiding a layer re-flowed the graph
you couldn't use the toggle to *read* the graph, which is the whole point.

Two behaviours worth provoking:

- **Turn off `monitors`.** *Prometheus* now has no visible edges at all — and stays
  on the canvas. Hiding it would be a *node*-filter decision, and an edge facet
  never takes one.
- **Turn off every row.** The graph keeps all ten nodes and draws no lines. For an
  edge layer an empty pick means *every layer off*; for a node multiselect an empty
  pick means *no constraint*. The control writes what stays on, so there is nothing
  else it could mean.

The legend stacks a node section and an edge section in one card: `type` drives the
node colours, `kind` drives the strokes, and the edge section's swatches are
**lines** — colour, dash and marker sampled from what the renderer actually painted.
It never assigns a style; it reports one.

<script setup>
import { shallowRef } from 'vue'
import { data, options, callsOnly, hideContext, showAllLayers, reportHidden } from './options.js'

const graph = shallowRef(null)
const onLoaded = (g) => { graph.value = g }
const onUnmounted = () => { graph.value = null }
</script>

<div class="lyr-toolbar">
    <button :disabled="!graph" @click="callsOnly(graph)">calls only</button>
    <button :disabled="!graph" @click="hideContext(graph)">hide the context layers</button>
    <button :disabled="!graph" @click="showAllLayers(graph)">show all layers</button>
    <button :disabled="!graph" @click="reportHidden(graph)">count hidden edges</button>
</div>

<Pivotick
    :data="data"
    :options="options"
    :onLoadedCallback="onLoaded"
    :onUnmountedCallback="onUnmounted"
    useInlineStyle="margin: 1em 0; height: 560px; border: 1px solid #cccccc99; border-radius: 8px"
></Pivotick>

<p class="lyr-hint">
    The buttons drive <code>queryEngine.setEdgeFilter</code> directly — the panel and
    the legend relight to match, because there is only one filter. Edge facets are
    registered whatever the UI mode, so this works in <code>viewer</code> and
    <code>static</code> too, where there is no panel to click.
</p>

<style>
.lyr-toolbar { display: flex; flex-wrap: wrap; gap: 8px; margin: 1em 0; }
.lyr-toolbar button {
    padding: 5px 12px; font-size: 13px; cursor: pointer;
    border: 1px solid var(--vp-c-divider); border-radius: 6px;
    background: var(--vp-c-bg-soft); color: var(--vp-c-text-1);
}
.lyr-toolbar button:disabled { opacity: 0.5; cursor: not-allowed; }
.lyr-hint { font-size: 13px; color: var(--vp-c-text-2); margin: 8px 0 0; }
</style>

See [Edge layers](/edge-layers) for the full option set — the facet vocabulary
beyond a plain layer, how collapsed clusters filter, and the style precedence
`edgeStyleMap` sits in.

::: code-group
<<< ./options.js#options [Options]
<<< ./options.js#control [Runtime control]
<<< ./options.js#data [Data]
:::
