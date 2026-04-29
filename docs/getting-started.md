---
outline: [2, 4]
---

# Getting Started

## Basic Usage
Pivotick can be used either as a modern JavaScript module or directly in the browser via a script tag.

::: code-group

<<< @/examples/getting-started/simple-module.js[As a module (ESM)]

<<< @/examples/getting-started/simple-bundle.html[As a bundle]

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
