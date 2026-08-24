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
resolved**, and counts the nodes behind it. Often you need no line at all — with a
`render.nodeTypeAccessor` declared, a legend appears by itself once that dimension is
shown to explain the colours (see [Legend](/ui-legend#on-by-default)); this card
declares the block to show the knobs. The legend is purely descriptive — the
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

One key is rarely the whole story. **Two keys at once** stacks a titled section per
dimension in the same docked card — press *type + zone* below: `type` keeps driving
the panel's facet, `zone` gets a section of its own, and the two filters **and**
together, so hiding `api` and `dmz` leaves what is neither. `zone` declares its own
swatch colours, because the canvas encodes `type` in its colours and a sampled swatch
for `zone` would only be a coincidence.

<script setup>
import { shallowRef } from 'vue'
import { data, options, watchLegend, legendByType, legendByTier, legendByTypeAndZone, removeLegend } from './options.js'

const graph = shallowRef(null)
const onLoaded = (g) => { graph.value = g; watchLegend(g) }
const onUnmounted = () => { graph.value = null }
</script>

<div class="lgd-toolbar">
    <button :disabled="!graph" @click="legendByType(graph)">legend by type</button>
    <button :disabled="!graph" @click="legendByTier(graph)">declared entries (tiers)</button>
    <button :disabled="!graph" @click="legendByTypeAndZone(graph)">two keys at once (type + zone)</button>
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
    In a section header: <em>show all</em>, <em>invert</em>, and a chevron that folds
    that section to its title — <strong>alt-click</strong> the chevron to fold every
    section. <strong>Alt-click</strong> a row to show only that category. Toggles are
    logged to the console through <code>legendToggle</code>, which names its section.
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
