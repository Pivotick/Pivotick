---
title: "Theming & styling"
category: K
order: 1
---

# Theming & styling

Every colour on the canvas is driven by a **CSS custom property** (`--pvt-*`), so
theming is just CSS. Pivotick ships **light** and **dark** themes — flip between
them by setting `data-theme` on the graph root — and you define your own the same
way: a `[data-theme]` block that sets the variables you care about. When a variable
doesn't cover something, the rendered SVG is plain, classed elements
(`.pvt-node`, `.pvt-edge-group path`) you can style directly.

Switch the theme below. **Light** and **Dark** are built in; **Brand** is a custom
theme defined entirely in CSS — a handful of variables plus one class hook that
dashes the edges.

<script setup>
import { ref } from 'vue'
import { data, options, applyTheme } from './options.js'
import './theme.css'

const theme = ref('brand')
let host = null
const onMounted = (container) => { host = container; applyTheme(host, theme.value) }
const setTheme = (t) => { theme.value = t; if (host) applyTheme(host, t) }
</script>

<div class="theme-controls">
    <button :class="{ active: theme === 'light' }" @click="setTheme('light')">Light</button>
    <button :class="{ active: theme === 'dark' }" @click="setTheme('dark')">Dark</button>
    <button :class="{ active: theme === 'brand' }" @click="setTheme('brand')">Brand</button>
</div>

<Pivotick
    :data="data"
    :options="options"
    :onMountedCallback="onMounted"
></Pivotick>

<style>
.theme-controls { display: flex; gap: 8px; margin: 1em 0 0; }
.theme-controls button {
    padding: 5px 14px; font-size: 13px; cursor: pointer;
    border: 1px solid var(--vp-c-divider); border-radius: 6px;
    background: var(--vp-c-bg-soft); color: var(--vp-c-text-1);
}
.theme-controls button.active {
    border-color: var(--vp-c-brand-1); color: var(--vp-c-brand-1); font-weight: 600;
}
</style>

::: code-group
<<< ./theme.css#variables [CSS variables]
<<< ./theme.css#hooks [Class hooks]
<<< ./options.js#theme [Switch theme]
<<< ./options.js#options [Options]
<<< ./options.js#data [Data]
:::
