---
outline: [2, 4]
---

# Getting Started
Pivotick is a hackable TypeScript graph visualization library built on top of [D3 force simulations](https://d3js.org/d3-force/simulation). It renders directed or undirected graphs with interactive controls, force simulation, tree layout support, and optional UI elements such as sidebars, toolbars, context menus, and tooltips.

## Basic Usage
Pivotick can be used either as a modern JavaScript module or directly in the browser via a script tag.

<<< @/examples/getting-started/usage.js


## Installation

### 1. Use a GitHub Release (no build required)

If you don’t want to build the project yourself, download the latest release from GitHub.

Steps:

1. Go to the Releases page of the repository
1. Download the latest dist bundle
1. Extract it into your project

You should get files like:
```
pivotick.es.js
pivotick.umd.js
pivotick.iife.js
pivotick.css
```

Then use them depending on your environment:

::: code-group

<<< @/examples/getting-started/esm.js[ES Module (recommended)]
<<< @/examples/getting-started/iife.html[Browser IIFE / UMD]

:::

### 2. Build from source (recommended for development)

Use this if you want full control over the library or need to modify it.

```bash
git clone https://github.com/pivotick/pivotick.git
cd pivotick
npm install
npm run build
```

After building, the compiled files will be available in:
```
dist/
```

You can then import them directly depending on your environment:

::: code-group

<<< @/examples/getting-started/esm.js[ES Module (recommended)]
<<< @/examples/getting-started/iife.html[IIFE / UMD]

:::

## Styling
Pivotick comes with default styles included in `pivotick.css`:

You can customize the look in two ways:
- Use Pivotick's [built-in classes](/ui-styling#classes).
- Override styles using [CSS variables](/ui-styling#css-vars).

```css
:root {
  --pvt-node-color: #FDDA24;
  --pvt-node-stroke: #000000;
  --pvt-edge-stroke: #EF3340;
}

.pvt-node circle {
  fill: cyan;
}
```

<Pivotick
  :data="{
      nodes: [
          { id: 1, data: { label: 'A' } },
          { id: 2, data: { label: 'B' } }
      ],
      edges: [
          { from: 1, to: 2 }
      ]
  }"
  :options="{ UI: { mode: 'static' }}"
  :style="{
    '--pvt-node-color': '#FDDA24',
    '--pvt-node-stroke': '#000000',
    '--pvt-edge-stroke': '#EF3340',
  }"
></Pivotick>
