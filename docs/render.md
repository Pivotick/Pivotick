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
| `defaultNodeStyle` | [NodeStyle](/api/html/interfaces/RendererOptions.NodeStyle.html)   | [defaultNodeStyle](/api/html/variables/defaultNodeStyleValue.html)   | Default styling applied to all nodes.                                                                                                    |
| `defaultEdgeStyle` | [EdgeStyle](/api/html/interfaces/RendererOptions.EdgeStyle.html)   | [defaultEdgeStyle](/api/html/variables/defaultEdgeStyleValue.html)   | Default styling applied to all edges.                                                                                                    |
| `defaultLabelStyle` | [LabelStyle](/api/html/interfaces/RendererOptions.LabelStyle.html) | [defaultLabelStyle](/api/html/variables/defaultLabelStyleValue.html) | Default styling applied to all edge labels.                                                                                              |
| `markerStyleMap`   | `Record<string, MarkerStyle>`                                          | [defaultMarkerStyle](/api/html/variables/defaultMarkerStyleMap.html) | Custom styles for edge markers (`'arrow'`, `'diamond'`, etc.). See [`MarkerStyle`](/api/html/interfaces/RendererOptions.MarkerStyle.html) |
| `nodeTypeAccessor` | `(node: Node) => string \| undefined`                                  | `undefined`                                                              | Function to access the type of a node, used with `nodeStyleMap`.                                                                         |
| `nodeStyleMap`     | `Record<string, NodeStyle>`                                            | `{}`                                                                     | Maps node types (from `nodeTypeAccessor`) to styles.                                                                                     |
| `minZoom`          | `number`                                                               | `0.1`                                                                    | Minimum zoom level.                                                                                                                      |
| `maxZoom`          | `number`                                                               | `10`                                                                     | Maximum zoom level.                                                                                                                      |
| `zoomEnabled`      | `boolean`                                                              | `true`                                                                   | Enable zoom.                                                                                                                             |
| `selectionBox`     | [SelectionBox](/api/html/interfaces/RendererOptions.SelectionBox.html)  | `undefined`                                                              | Control SelectionBox behavior                                                                                                            |

## Type of rendering

::: tip
Pivotick gives you flexible control over rendering, from simple defaults to fully custom rendering.
Here's a quick rundown:

- **`renderNode`** and **`renderLabel`** let you fully customize how nodes and labels are drawn (you can return HTML or text).
- **`nodeTypeAccessor`** + **`nodeStyleMap`** allow dynamic styling based on each element's type.
- **`defaultNodeStyle`**, **`defaultEdgeStyle`**, and **`defaultLabelStyle`** define the base appearance for all elements.
:::

::: warning `renderNode` content must be self-sizing
Pivotick measures your element to size its `<foreignObject>` and to feed the
force layout's collision radius, so its root must shrink-wrap its content — use
`display: inline-flex`/`inline-block`. A block-level root has no intrinsic width
and stretches to fill the measured box (which then grows unbounded).
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


## Full node labels

A node label longer than the room it has is shortened with a middle ellipsis
(`Supe…abel`). Set `textTruncate: false` to draw it in full instead — as a default,
per node type, or per node:

```ts
const options = {
    render: {
        defaultNodeStyle: { textTruncate: false },
    },
}
```

A full label usually spills past the node's shape, so it is drawn on the same
themed pill as a floated label to stay readable over the canvas. Pair it with
`textVerticalShift: 1` (or `textHorizontalShift`) to move the whole label clear
of the node. Edge labels are never truncated.

## Node badges

By the time a graph is useful, `color`, `shape`, `size` and `iconClass` are usually
all carrying something. `badges` is a channel of its own — small indicators pinned
to the node's rim, spending none of the others:

```ts
const options = {
    render: {
        defaultNodeStyle: {
            badges: (node) => {
                const { notes, disputed } = node.getData()
                return [
                    notes && { text: String(notes), color: '#2563eb', title: `${notes} notes` },
                    disputed && { iconClass: 'fa fa-exclamation', color: '#b94a48', title: 'Disputed' },
                ].filter(Boolean)
            },
        },
    },
}
```

Give a badge `text` (a count, or a character or two), an `iconClass`,
`iconUnicode` or `svgIcon`, and a `title` for its native tooltip. `text` wins if
you supply both. Longer text grows the badge into a pill, and past three
characters it renders `99+`.

### Where they go

Omit `position` and badges fill the free corners clockwise from `'ne'`. Name one
(`'ne' | 'nw' | 'se' | 'sw'`) and it is honoured verbatim, overlaps included.

**Four fit on a plain node, two on one with children.** The expand/collapse
control sits north-east when a node is collapsed and south-east when it is
expanded, so on any expandable node *both* East corners are reserved — otherwise
every badge would change corner the moment a cluster opened. Badges beyond what
fits fold into a `+n` whose tooltip names them.

Badges scale with the node between a floor and a ceiling, so they stay legible on
a tiny node without swelling on a large one, and they sit on the shape's real
rim — the corner of a square or a framed picture, the 45° point of a circle.

### Clicks

A badge is hit-testable but transparent by default: with no handler its click
falls through and selects the node underneath, so a badge is never a dead spot.

```ts
{ text: '3', onClick: (event, node, badge) => openNotes(node) }
```

Give a badge an `onClick` — or declare `callbacks.onBadgeClick` for behaviour they
all share — and it takes the pointer cursor and consumes its click, leaving the
node unselected. Both fire, the badge's own first. Pressing a badge still drags
the node either way, and a `badgeClick` listener on the interaction bus can
`cancel()` both.

### Scope

Badges describe **only the node they sit on**. A collapsed cluster does not
aggregate its children's — walk `node.children` in your own `badges` function if
that is what you want, since only you know whether a fact sums, wins, or neither.

## API

Pivotick exposes a renderer controller that lets you interact directly with the rendering engine.
All methods are [available online](/api/html/interfaces/GraphRenderer.html)

### Fit and Zoom

::: code-group
```ts [Fit and center]
graph.renderer.fitAndCenter()
```

```ts [Zomm in / out]
graph.renderer.zoomIn()
graph.renderer.zoomOut()
```
:::

