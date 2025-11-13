
# Getting Started

## Installation

```bash
npm install pivotick  # (Coming soon)
```

## Basic Usage

::: code-group

```js [As a module]
import { Pivotick } from './pivotick.es.js'

const container = document.getElementById('graph-container')
const data = {
    nodes: [
        { id: 1, data: { label: 'A' } },
        { id: 2, data: { label: 'B' } }
    ],
    edges: [
        { from: 1, to: 2 }
    ]
}

// Pivotick global is your main Graph class
const graph = new Pivotick(
    document.getElementById('graph-container'),
    data
)

graph.addNode({ id: 3, data: { label: 'C' } })
graph.addEdge({ from: 2, to: 3 })
```

```js [Bundled library]
const container = document.getElementById('graph-container')
const data = {
    nodes: [
        { id: 1, data: { label: 'A' } },
        { id: 2, data: { label: 'B' } }
    ],
    edges: [
        { from: 1, to: 2 }
    ]
}

// Pivotick global is your main Graph class
const graph = new Pivotick(
    document.getElementById('graph-container'),
    data
)

graph.addNode({ id: 3, data: { label: 'C' } })
graph.addEdge({ from: 2, to: 3 })
```
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

