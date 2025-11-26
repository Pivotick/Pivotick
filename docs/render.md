---
outline: [2, 3]
---

# Render Options

Pivotick allows you to customize how nodes, edges, and labels are rendered through the `render` option.

::: warning
All styles defined here apply only when `render.type` is set to `svg`.
:::

| Option             | Type                                                                   | Default                                                                  | Description                                                                                                                              |
| ------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `type`             | `'svg' \| 'canvas'`                                                    | `'svg'`                                                                  | The rendering method. `'svg'` uses SVG elements, `'canvas'` uses the HTML canvas (experimental - not fully implemented).                 |
| `renderNode`       | `(node: Node) => HTMLElement \| string \| void`                        | `undefined`                                                              | Custom renderer for nodes.                                                                                                               |
| `renderLabel`      | `(edge: Edge) => HTMLElement \| string \| void`                        | `undefined`                                                              | Custom renderer for edge labels.                                                                                                         |
| `defaultNodeStyle` | [NodeStyle](docs/api/html/interfaces/RendererOptions.NodeStyle.html)   | [defaultNodeStyle](docs/api/html/variables/defaultNodeStyleValue.html)   | Default styling applied to all nodes.                                                                                                    |
| `defaultEdgeStyle` | [EdgeStyle](docs/api/html/interfaces/RendererOptions.EdgeStyle.html)   | [defaultEdgeStyle](docs/api/html/variables/defaultEdgeStyleValue.html)   | Default styling applied to all edges.                                                                                                    |
| `defaultLabelStyle` | [LabelStyle](docs/api/html/interfaces/RendererOptions.LabelStyle.html) | [defaultLabelStyle](docs/api/html/variables/defaultLabelStyleValue.html) | Default styling applied to all edge labels.                                                                                              |
| `markerStyleMap`   | `Record<string, MarkerStyle>`                                          | [defaultMarkerStyle](docs/api/html/variables/defaultMarkerStyleMap.html) | Custom styles for edge markers (`'arrow'`, `'diamond'`, etc.). See [`MarkerStyle`](docs/api/interfaces/RendererOptions.MarkerStyle.html) |
| `nodeTypeAccessor` | `(node: Node) => string \| undefined`                                  | `undefined`                                                              | Function to access the type of a node, used with `nodeStyleMap`.                                                                         |
| `nodeStyleMap`     | `Record<string, NodeStyle>`                                            | `{}`                                                                     | Maps node types (from `nodeTypeAccessor`) to styles.                                                                                     |
| `minZoom`          | `number`                                                               | `0.1`                                                                    | Minimum zoom level.                                                                                                                      |
| `maxZoom`          | `number`                                                               | `10`                                                                     | Maximum zoom level.                                                                                                                      |
| `zoomEnabled`      | `boolean`                                                              | `true`                                                                   | Enable zoom.                                                                                                                             |
| `selectionBox`     | [SelectionBox](docs/api/interfaces/RendererOptions.SelectionBox.html)  | `undefined`                                                              | Control SelectionBox behavior                                                                                                            |

## Type of rendering

::: tip
Pivotick gives you flexible control over rendering, from simple defaults to fully custom rendering.
Here's a quick rundown:

- **`renderNode`** and **`renderLabel`** let you fully customize how nodes and labels are drawn (you can return HTML or text).
- **`nodeTypeAccessor`** + **`nodeStyleMap`** allow dynamic styling based on each element's type.
- **`defaultNodeStyle`**, **`defaultEdgeStyle`**, and **`defaultLabelStyle`** define the base appearance for all elements.
:::

The next three rendering examples are using the following data:

```ts
const data = {
    nodes: [
        { id: 1, data: { label: 'A', type: 'hub' } },
        { id: 2, data: { label: 'B', type: 'spoke' } }
    ],
    edges: [{ from: 1, to: 2 }]
}
```

::: code-group

<<< @/examples/configuration/render-default.js [Default rendering]

<<< @/examples/configuration/render-map-accessor.js#options [Map-Accessor rendering]

<<< @/examples/configuration/render-callback.js [Custom callback rendering]

:::


## Example for Map-Accessor rendering

<script setup>
    import { data as dataR, options as optionsR } from './examples/configuration/render-map-accessor.js'
</script>


<Pivotick
    :data="dataR"
    :options="optionsR"
></Pivotick>
