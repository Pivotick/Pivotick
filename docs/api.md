---
outline: [2, 4]
---

# Pivotick API

The list of methods is available [online](docs/api/html/classes/Pivotick.html).

## Getting nodes and edges
Pivotick provides multiple ways to access nodes and edges. The methods for nodes are listed below (edges work the same way):

| Method                               | Returns             | Description                                                     |
| ------------------------------------ | ------------------- | --------------------------------------------------------------- |
| `getNode(id: string \| Node)`        | `Node \| undefined` | Returns a **deep copy** of the node with the given ID.          |
| `getNodes()`                         | `Node[]`            | Returns a **deep copy** of all nodes.                           |
| `getMutableNode(id: string \| Node)` | `Node \| undefined` | Returns the **actual node object** used internally by Pivotick. |
| `getMutableNodes()`                  | `Node[]`            | Returns **all internal node objects**.                          |

::: tip
Use the standard getters (`getNode` / `getNodes`) whenever possible. They provide safe clones that can be modified without affecting the engine’s internal state.
:::

::: danger
Modifying nodes or edges directly via the mutable getters may lead to **unexpected behavior**.
Only use mutable access if you understand the internal engine mechanics; otherwise, prefer the cloned versions.
:::

## Adding nodes and edges

You can use the functions `addNode()` and `addEdge()` on the graph instance to create new nodes and edges.

::: code-group

<<< @/examples/api/add-node-edge.js#addnode [Adding nodes and edges]
<<< @/examples/api/add-node-edge.js#loaded [On Loaded Callback]

:::

<script setup>
import { loaded } from './examples/api/add-node-edge.js'
</script>

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
    :options="{
        UI: { mode: 'viewer' },
        simulation: {
            d3AlphaDecay: 0.8,
            d3VelocityDecay: 0.8,
            d3AlphaMin: 0.3,
        }
    }"
    :onMountedCallback="() => {
    }"
    :onLoadedCallback="loaded"
    style="
        border: 1px solid var(--vp-c-gray-1);
        box-shadow: rgba(0, 0, 0, 0.1) 0px 4px 6px -1px, rgba(0, 0, 0, 0.06) 0px 2px 4px -1px;
        position: relative;
        height: 400px;"
></Pivotick>