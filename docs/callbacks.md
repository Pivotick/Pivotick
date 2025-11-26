---
outline: [2, 3]
---

# Callbacks

Pivotick allows you to hook into user interactions and simulation events through the [`callbacks`](/docs/api/html/interfaces/InterractionCallbacks.InterractionCallbacks.html) option.
You can provide functions for various events on the canvas, nodes, and edges.

## Canvas Callbacks

| Callback              | Parameters              | Description                                 |
| --------------------- | ----------------------- | ------------------------------------------- |
| `onCanvasClick`       | `(event: PointerEvent)` | Fired when the canvas is clicked.           |
| `onCanvasContextmenu` | `(event: PointerEvent)` | Fired on canvas right-click.                |
| `onCanvasMousemove`   | `(event: MouseEvent)`   | Fired when the mouse moves over the canvas. |
| `onCanvasZoom`        | `(event: unknown)`      | Fired when the canvas zoom level changes.   |


## Node Callbacks

| Callback            | Parameters                                             | Description                                       |
| ------------------- | ------------------------------------------------------ | ------------------------------------------------- |
| `onNodeClick`       | `(event: PointerEvent, node: Node, element: TElement)` | Fired when a node is clicked.                     |
| `onNodeDbclick`     | `(event: PointerEvent, node: Node, element: TElement)` | Fired when a node is double-clicked.              |
| `onNodeContextmenu` | `(event: PointerEvent, node: Node, element: TElement)` | Fired on node right-click.                        |
| `onNodeHoverIn`     | `(event: PointerEvent, node: Node, element: TElement)` | Fired when the mouse enters a node.               |
| `onNodeHoverOut`    | `(event: PointerEvent, node: Node, element: TElement)` | Fired when the mouse leaves a node.               |
| `onNodeSelect`      | `(node: Node, element: TElement)`                      | Fired when a node becomes selected.               |
| `onNodeBlur`        | `(node: Node, element: TElement)`                      | Fired when a node loses focus/selection.          |
| `onNodeDragging`    | `(event: MouseEvent, node: Node)`                      | Fired continuously while a node is being dragged. |
| `onNodeExpansion`   | `(event: PointerEvent, edge: Edge, element: TElement)` | Fired when a node is expanded or collapsed.       |


## Edge Callbacks

| Callback            | Parameters                                             | Description                               |
| ------------------- | ------------------------------------------------------ | ----------------------------------------- |
| `onEdgeClick`       | `(event: PointerEvent, edge: Edge, element: TElement)` | Fired when an edge is clicked.            |
| `onEdgeDbclick`     | `(event: PointerEvent, edge: Edge, element: TElement)` | Fired when an edge is double-clicked.     |
| `onEdgeContextmenu` | `(event: PointerEvent, edge: Edge, element: TElement)` | Fired on edge right-click.                |
| `onEdgeHoverIn`     | `(event: PointerEvent, edge: Edge, element: TElement)` | Fired when the mouse enters an edge.      |
| `onEdgeHoverOut`    | `(event: PointerEvent, edge: Edge, element: TElement)` | Fired when the mouse leaves an edge.      |
| `onEdgeSelect`      | `(edge: Edge, element: TElement)`                      | Fired when an edge becomes selected.      |
| `onEdgeBlur`        | `(edge: Edge, element: TElement)`                      | Fired when an edge loses focus/selection. |


## Simulation Callbacks

| Callback               | Parameters | Description                                                    |
| ---------------------- | ---------- | -------------------------------------------------------------- |
| `onSimulationTick`     | `()`       | Fired every simulation tick.                                   |
| `onSimulationSlowTick` | `()`       | Fired occasionally during simulation (every tenth of simulationTick). |


::: info
The `element` type is `svg` only if the option `render.type == "svg"`.
:::

#### Example

<<< @/examples/configuration/callbacks.js

