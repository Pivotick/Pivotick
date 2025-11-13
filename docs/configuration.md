
# Configuration Options

## Main Pivotick options

Pivotick supports a wide range of options to customize behavior, layout, rendering, simulation, UI, and interactions.

| Option       | Type                             | Default | Description                                                               |
| ------------ | -------------------------------- | ------- | ------------------------------------------------------------------------- |
| `isDirected` | `boolean`                        | `true ` | If true, edges are treated as directed.                                   |
| `callbacks`  | `InterractionCallbacks`          | `{}`    | Optional callbacks for user interactions (click, hover, drag, etc.).      |
| `layout`     | `LayoutOptions`                  | `{}`    | Configuration for the graph layout (forces, tree, spacing, alignment).    |
| `render`     | `GraphRendererOptions`           | `{}`    | Customize rendering options such as node/edge appearance                  |
| `simulation` | `SimulationOptions`              | `{}`    | Options to control the physics simulation (forces, iterations, etc.).     |
| `UI`         | `GraphUI`                        | `{}`    | UI-specific options such as sidebar, selection, tooltips, and controls.   |


#### Usage

```ts
const container = document.getElementById('graph-container')
const options = { // [!code focus:20]
    isDirected: true,
    callbacks: {
        onNodeClick: (e, node) => console.log(`nodeClick: ${node.id}`),
    },
    layout: {
        type: 'force',
    },
    render: {
        defaultNodeStyle: {
            shape: 'square',
        },
    },
    simulation: {
        d3ManyBodyStrength: -30
    },
    UI: {
        mode: 'full'
    },
}
const graph = Pivotick(container, options)
```

## Callbacks
Pivotick allows you to hook into user interactions and simulation events through the [`callbacks`](/docs/api/html/interfaces/InterractionCallbacks.InterractionCallbacks.html) option.
You can provide functions for various events on the canvas, nodes, and edges.

| Callback           | Parameters                                            | Description                                                   |
| ------------------ | ----------------------------------------------------- | ------------------------------------------------------------- |
| `onCanvasClick`    | `(event: PointerEvent)`                                 | Fired when the canvas is clicked.                             |
| `onNodeClick`      | `(event: PointerEvent, node: Node, element: svg)`     | Fired when a node is clicked.                                 |
| `onNodeHoverIn`    | `(event: PointerEvent, node: Node, element: svg)`     | Fired when the mouse enters a node.                           |
| `onNodeHoverOut`   | `(event: PointerEvent, node: Node, element: svg)`     | Fired when the mouse leaves a node.                           |
| `onEdgeClick`      | `(event: PointerEvent, edge: Edge, element: svg)`     | Fired when an edge is clicked.                                |
| `onSimulationTick` | `()`                                                  | Fired on every simulation tick (useful for custom rendering). |

::: info
THe `element` type is `svg` only if the option `render.type == "svg"`.
:::

#### Example

```ts
import Pivotick from './pivotick.es.js'

options = {
    callbacks: {
        onCanvasClick: (event) => {
            console.log('Canvas clicked at', event.clientX, event.clientY)
        },
        onNodeClick: (event, node) => {
            console.log('Node clicked:', node.id)
        },
        onNodeHoverIn: (event, node) => {
            console.log('Mouse entered node:', node.id)
        },
        onNodeHoverOut: (event, node) => {
            console.log('Mouse left node:', node.id)
        },
        onEdgeClick: (event, edge) => {
            console.log('Edge clicked:', edge.from, '→', edge.to)
        },
        onSimulationTick: () => {
            console.log('Simulation tick')
        }
    }
}
const graph = new Pivotick(container, data, options)
```

## Layout Options

Pivotick supports multiple layout strategies for positioning nodes. You can configure the layout through the `layout` option.

| Option | Type               | Default   | Description |
| ------ | ------------------ | --------- | ----------- |
| `type` | `'force' \| 'tree'` | `'force'` | The layout algorithm to use. `'force'` applies a physics-based force layout. `'tree'` arranges nodes in a tree structure. |

### Tree Layout Options

When `type: 'tree'` is selected, the following additional options are available:

| Option                  | Type                  | Default           | Description                                                                                                |
| ----------------------- | --------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------- |
| `rootId`                | `string`              | `undefined`       | Specify the ID of the node to use as the root. If not provided, Pivotick will automatically select a root bsaed on `rootIdAlgorithmFinder`.|
| `rootIdAlgorithmFinder` | -                     | `MaxReachability` | Algorithm used to automatically find the root node.                                                        |
| `strength`              | `number`              | `0.1`             | The force strength to maintain tree structure.                                                             |
| `horizontal`            | `boolean`             | `false`           | Arrange nodes horizontally rather than vertically.                                                         |
| `radial`                | `boolean`             | `false`           | Place nodes in a radial layout instead of vertical.                                                        |
| `radialGap`             | `number`              | `750`             | Gap between layers in radial layout.                                                                       |
| `flipEdgeDirection`     | `boolean`             | `false`           | Flip the direction of edges in the layout.                                                                 |

### Example

```ts
import Pivotick from './pivotick.es.js'

const options = {
    layout: {
        type: 'tree',
        radial: true,
        flipEdgeDirection: false,
    }
}
const graph = new Pivotick(container, data, options)
```

## Render
## Render Options

Pivotick allows you to customize how nodes, edges, and labels are rendered through the `render` option.

::: warning
All styles defined here apply only when `render.type` is set to `svg`.
:::

| Option              | Type                                                                     | Default     | Description                                                       |
| ------------------- | ------------------------------------------------------------------------ | ----------- | ----------------------------------------------------------------- |
| `type`              | `'svg' \| 'canvas'`                                                      | `'svg'`     | The rendering method. `'svg'` uses SVG elements, `'canvas'` uses the HTML canvas (experimental - not fully implemented). |
| `renderNode`        | `(node: Node) => HTMLElement \| string \| void`                          | `undefined` | Custom renderer for nodes.                                        |
| `renderLabel`       | `(edge: Edge) => HTMLElement \| string \| void`                          | `undefined` | Custom renderer for edge labels.                                  |
| `defaultNodeStyle`  | [NodeStyle](docs/api/html/interfaces/RendererOptions.NodeStyle.html)     | [defaultNodeStyle](docs/api/html/variables/defaultNodeStyleValue.html)          | Default styling applied to all nodes.                             |
| `defaultEdgeStyle`  | [EdgeStyle](docs/api/html/interfaces/RendererOptions.EdgeStyle.html)     | [defaultEdgeStyle](docs/api/html/variables/defaultEdgeStyleValue.html)          | Default styling applied to all edges.                             |
| `defaultEdgeStyle`  | [LabelStyle](docs/api/html/interfaces/RendererOptions.LabelStyle.html)   | [defaultLabelStyle](docs/api/html/variables/defaultLabelStyleValue.html)        | Default styling applied to all edge labels.                       |
| `markerStyleMap`    | `Record<string, MarkerStyle>`                                            | [defaultMarkerStyle](docs/api/html/variables/defaultMarkerStyleMap.html)        | Custom styles for edge markers (`'arrow'`, `'diamond'`, etc.). See [`MarkerStyle`](docs/api/interfaces/RendererOptions.MarkerStyle.html)           |
| `nodeTypeAccessor`  | `(node: Node) => string \| undefined`                                    | `undefined` | Function to access the type of a node, used with `nodeStyleMap`.  |
| `nodeStyleMap`      | `Record<string, NodeStyle>`                                              | `{}`        | Maps node types (from `nodeTypeAccessor`) to styles.              |
| `minZoom`           | `number`                                                                 | `0.1`       | Minimum zoom level.                                               |
| `maxZoom`           | `number`                                                                 | `10`        | Maximum zoom level.                                               |

#### Type of rendering

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
    edges: [{ from: 1, to: 2, data: { label: 'edge1' } }]
}
```

::: code-group

```ts [Default rendering]
const options = {
    render: {
        defaultNodeStyle: {
            shape: 'circle',
            color: '#007acc',
            size: 12,
            strokeColor: '#fff',
            strokeWidth: 2,
            fontFamily: 'system-ui',
            textColor: '#fff'
        },
        defaultEdgeStyle: {
            markerStart: (edge: Edge) => edge.getData().mstart,
            markerEnd: 'arrow',
            curveStyle: 'straight',
        },
    }
}
```

```ts [Map-Accessor rendering]
const options = {
    render: {
        nodeTypeAccessor: (node) => node.getData()?.type,
        nodeStyleMap: {
            'hub': { shape: 'hexagon', color: '#f90', size: 30 },
            'spoke': { shape: 'triangle', color: '#09f' }
        },
    }
}
```

```ts [Custom callback rendering]
const options = {
    render: {
        renderNode: (node: Node): HTMLElement | string | void => {
            const size = 12
            const color = '#09f'
            const style = [
                'display: block',
                `width: ${size}px`,
                `height: ${size}px`,
                `background-color: ${color}`,
                'border: 2px solid #fff',
                'border-radius: 50%',
                'opacity: 1',
            ].join(';')

            return `<span style="${style}"></span>`
        }
    }
}
```
:::


## Simulation

The Simulation options control the physics and layout behavior of nodes and edges for the graph simulation engine.

Check [D3-force official documentation](https://d3js.org/d3-force/simulation#forceSimulation) to learn more.

| Option              | Type                | Default             | Description                                                                          |
| ------------------- | ------------------- | ------------------- | ------------------------------------------------------------------------------------ |
| `userWorker`        | boolean             | `true`              | Should the initial node placement calculation done by a worker                       |
| `d3Alpha`           | number              | `1.0`               | Initial simulation alpha                                                             |
| `d3AlphaMin`        | number              | `0.001`             | Minimum alpha value before the simulation stops.                                     |
| `d3VelocityDecay`   | number              | `0.4`               | Friction applied to node velocities.                                                 |
| `d3LinkDistance`    | number              | `30`                | Default distance between connected nodes.                                            |
| `freezeNodesOnDrag` | boolean             | `true`              | Whether nodes are frozen once they are release from a drag operation.                |
| `callbacks`         | [SimulationCallbacks](docs/api/html/interfaces/SimulationOptions.SimulationCallbacks.html) | `undefined`         | Hooks for responding to simulation events. |

::: info
Other D3 force parameters like `d3AlphaDecay`, `d3ManyBodyStrength`, `d3CollideRadius` are available and [documented in the API reference](docs/api/html/interfaces/SimulationOptions.SimulationOptions.html).
:::

### Callbacks

- `onInit(sim: Simulation)`: Called when the simulation initializes.
- `onStart(sim: Simulation)`: Called when the simulation starts running.
- `onStop(sim: Simulation)`: Called when the simulation stops.
- `onTick(sim: Simulation)`: Called on each simulation tick.


## UI

Pivotick provides a flexible UI layer on top of your graph, allowing you to control how users interact with nodes, edges, and the canvas. Using `UI` options, you can:

- Configure the overall [**mode**](#ui-mode) of the UI (full, viewer, static, etc.).
- Customize [**sidebars**](./#ui-sidebar) and panels to show properties or extra information.
- Define [**tooltips**](./#ui-tooltip) for nodes and edges, with optional custom renderers.
- Configure [**context menus**](./#ui-contextmenu) and [**selection menus**](./#ui-selectionmenu).

### UI Mode {#ui-mode}
The `mode` option controls the overall behavior and interaction level of the graph UI.

- **`full`** <Badge type="warning" text="default" />: Complete UI with all panels, menus, and interactions enabled.
- **`light`**: Minimal UI with essential interactions enabled.
- **`viewer`**: Only allows navigating the graph (pan, zoom, drag) without displaying any UI panels.
- **`static`**: Static graph, no UI panels or interactions; the graph is read-only.

For a light usage of Pivotick, use the following:
```ts
const container = document.getElementById('graph-container')
const options = {
    UI: {  // [!code focus:3]
        mode: 'viewer'
    },
}
const graph = Pivotick(container, options)
```

### Sidebar Options {#ui-sidebar}
The sidebar can be collapsed by default depending on screen size or user preference.

Determines whether the sidebar is collapsed by default.  

- `'auto'` <Badge type="warning" text="default" />: Keeps the sidebar open unless there isn't enough screen space, in which case it collapses automatically.
- `true` Sidebar starts collapsed.
- `false` Sidebar starts expanded.

The sidebar displays contextual information for graph elements. It has three customizable components:
- **Main Header**
- **Properties Panel**
- **Extra Panels**

#### Main Header
Shows a concise summary of the selected node or edge, such as title and subtitle. It helps users quickly identify the current element.


#### Properties Panel
Lists key-value properties of the selected element. You can customize which properties are displayed and how they are formatted. This panel is useful for inspecting element data without modifying the graph.


#### Extra Panels
Allows adding fully custom panels with dynamic or static content. These panels can include HTML, SVG, or computed values, and are ideal for showing additional contextual information, custom controls, or interactive widgets related to the selected element.


### Tooltips {#ui-tooltip}
Configure default and custom tooltips for nodes and edges.


### Context Menu {#ui-contextmenu}
Configure right-click menus for nodes, edges, and the canvas.


### Selection Menu {#ui-selectionmenu}
Configure menus shown when elements are selected.


----
<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { Pivotick } from '../dist/pivotick.js'
import '../dist/pivotick.css'

const graphContainer = ref(null)
let graph = null
const data = {
    nodes: [
        { id: 1, data: { label: 'A', type: 'hub' } },
        { id: 2, data: { label: 'B', type: 'spoke' } }
    ],
    edges: [{ from: 1, to: 2, data: { label: 'edge1' } }]
}
const options = {
    simulation: {
        useWorker: false,
        callbacks: {
            onStop: (simulation) => {
                graph.selectElement(graph.getNodes()[0])
            }
        }
    },
    UI: {  
        mode: 'full',
        sidebar: {
            collapsed: false,
        },
        mainHeader: {
            nodeHeaderMap: {
                title: "Main Header",
            },
        },
        extraPanels: [
            {
                title: "Properties Panel",
                content: (node) => {
                    const div = document.createElement('div')
                    div.textContent = 'Content of Properties Panel'
                    return div
                },
            }
        ]
    },
}

onMounted(() => {
    if (graphContainer.value)
        graph = new Pivotick(graphContainer.value, data, options)
})

onBeforeUnmount(() => {
    if (graph?.destroy)
        graph.destroy()
})
</script>


<meta name="color-scheme" content="light">
<div ref="graphContainer" :class="$style.pivotick" data-theme="light"></div>

<style module>
.pivotick {
    border: 1px solid var(--vp-c-gray-soft);
    position: relative;
    height: 800px;
}
</style>