---
outline: [2, 4]
---

# Getting Started

## Installation

```bash
npm install pivotick  # (Coming soon)
```

## Basic Usage

::: code-group

<<< @/examples/getting-started/simple-bundle.js[As a module]

<<< @/examples/getting-started/simple-bundle.js[As a bundle]

:::


## Styling
Pivotick comes with default styles included in `pivotick.css`:

You can customize the look in two ways:
- Use Pivotick's [built-in classes](/ui-styling#classes).
- Override styles using [CSS variables](/ui-styling#css-vars).

```html
<style>
  :root {
    --pivotick-bg: #f0f0f0;
    --pivotick-graph-background-image: unset;
    --pivotick-node-color: #2fa1db;
    --pivotick-node-stroke: #b8babbff;
    --pivotick-edge-stroke: #4eafdfff;
  }
</style>
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
  :options="{}"
  :style="{
    '--pivotick-bg': '#f0f0f0',
    '--pivotick-graph-background-image': 'transparent',
    '--pivotick-node-color': '#2fa1db',
    '--pivotick-node-stroke': '#b8babbff',
    '--pivotick-edge-stroke': '#7c4edfff',
  }"
></Pivotick>


## API
- Add node
- Add edge
- 