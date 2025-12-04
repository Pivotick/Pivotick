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
    --pvt-node-color: #FDDA24;
    --pvt-node-stroke: #000000;
    --pvt-edge-stroke: #EF3340;
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
  :options="{ UI: { mode: 'static' }}"
  :style="{
    '--pvt-node-color': '#FDDA24',
    '--pvt-node-stroke': '#000000',
    '--pvt-edge-stroke': '#EF3340',
  }"
></Pivotick>


## API
- Add node
- Add edge
- 