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
- Use Pivotick's built-in classes.
- Override styles using [CSS variables](/css-variables).

```html
<style>
  :root {
    --pivotick-bg: #f0f0f0;
  }
</style>
```


-------------

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
:options="{}"></Pivotick>



----------
