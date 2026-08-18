---
title: "Filterable legend"
category: I
order: 4
aside: false
pageClass: gallery-wide
---

# Filterable legend

A colour-coded graph needs a key — and once it has one, the key is the fastest
filter in the UI. `UI.legend` docks one in a canvas corner: a swatch, a label and a
node count per category, and **clicking a row hides that category**.

One line configures it: `legend: { key: 'type' }`. The library collects the distinct
values of `data.type`, reads each swatch from the colour the **renderer already
resolved**, and counts the nodes behind it. The legend is purely descriptive — the
colours here come from a `ColorPaletteMapper` in the options, exactly as in
[Color by category](/examples/gallery/color-by-category/content), and the legend
never assigns one. Change the palette and the legend follows.

Clicking a row filters through `graph.queryEngine`, so it is the *same* filtering
the header's **Graph Filters** panel does. This card declares a `type` facet under
the legend's own key, which makes the two one control: switch off `api` in the
legend, open the panel (funnel, or **Shift+K**) and its *Service type* multiselect
has already dropped it. `resetFilters()` — or the panel's **Reset** — re-lights
every row.

Nodes with no `type` at all get no row, and the legend never hides them: it can
only act on the categories it lists.

<script setup>
import { shallowRef } from 'vue'
import { data, options, watchLegend, legendByType, legendByTier, removeLegend } from './options.js'

const graph = shallowRef(null)
const onLoaded = (g) => { graph.value = g; watchLegend(g) }
const onUnmounted = () => { graph.value = null }
</script>

<div class="lgd-toolbar">
    <button :disabled="!graph" @click="legendByType(graph)">legend by type</button>
    <button :disabled="!graph" @click="legendByTier(graph)">declared entries (tiers)</button>
    <button :disabled="!graph" @click="removeLegend(graph)">remove legend</button>
</div>

<Pivotick
    :data="data"
    :options="options"
    :onLoadedCallback="onLoaded"
    :onUnmountedCallback="onUnmounted"
    useInlineStyle="margin: 1em 0; height: 560px; border: 1px solid #cccccc99; border-radius: 8px"
></Pivotick>

<p class="lgd-hint">
    In the legend header: <em>show all</em>, <em>invert</em>, and a chevron that folds
    it to its title. <strong>Alt-click</strong> a row to show only that category.
    Toggles are logged to the console through <code>legendToggle</code>.
</p>

<style>
.lgd-toolbar { display: flex; flex-wrap: wrap; gap: 8px; margin: 1em 0; }
.lgd-toolbar button {
    padding: 5px 12px; font-size: 13px; cursor: pointer;
    border: 1px solid var(--vp-c-divider); border-radius: 6px;
    background: var(--vp-c-bg-soft); color: var(--vp-c-text-1);
}
.lgd-toolbar button:disabled { opacity: 0.5; cursor: not-allowed; }
.lgd-hint { font-size: 13px; color: var(--vp-c-text-2); margin: 8px 0 0; }
</style>

::: code-group
<<< ./options.js#legend [Legend]
<<< ./options.js#options [Options]
<<< ./options.js#control [Runtime control]
<<< ./options.js#data [Data]
:::
