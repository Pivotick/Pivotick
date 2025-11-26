---
outline: [2, 3]
---

# Graph Layout

Pivotick supports multiple layout strategies for positioning nodes. You can configure the layout through the `layout` option.

| Option | Type                | Default   | Description                                                                                                               |
| ------ | ------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------- |
| `type` | `'force' \| 'tree'` | `'force'` | The layout algorithm to use. `'force'` applies a physics-based force layout. `'tree'` arranges nodes in a tree structure. |

### Tree Layout Options

When `type: 'tree'` is selected, the following additional options are available:

| Option                  | Type      | Default           | Description                                                                                                                                 |
| ----------------------- | --------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `rootId`                | `string`  | `undefined`       | Specify the ID of the node to use as the root. If not provided, Pivotick will automatically select a root based on `rootIdAlgorithmFinder`. |
| `rootIdAlgorithmFinder` | -         | `MaxReachability` | Algorithm used to automatically find the root node.                                                                                         |
| `strength`              | `number`  | `0.1`             | The force strength to maintain tree structure.                                                                                              |
| `horizontal`            | `boolean` | `false`           | Arrange nodes horizontally rather than vertically.                                                                                          |
| `radial`                | `boolean` | `false`           | Place nodes in a radial layout instead of vertical.                                                                                         |
| `radialGap`             | `number`  | `750`             | Gap between layers in radial layout.                                                                                                        |
| `flipEdgeDirection`     | `boolean` | `false`           | Flip the direction of edges in the layout.                                                                                                  |


#### Tree Root Finder
In a tree-based layout, one node must be designated as the root. You can specify the root node using the `rootId` option.

If you're unsure which node should be the root, don't worry! Pivotick will automatically select one using the algorithm defined in `rootIdAlgorithmFinder`.

Similarly, the `flipEdgeDirection` option lets you reverse the direction of edges in a directed graph (so `A -> B` becomes `B -> A`)—this only affects the layout computation, not the underlying graph data.


::: danger
Add example with the two layouts!
:::

### Vertical Tree

<<< @/examples/configuration/layout-tree-vertical.js#options


<script setup>
    import { data as dataR, options as optionsR } from './examples/configuration/layout-tree-radial.js'
    import { data as dataV, options as optionsV } from './examples/configuration/layout-tree-vertical.js'
</script>

<Pivotick
    :data="dataV"
    :options="optionsV"
></Pivotick>

### Vertical Tree

<<< @/examples/configuration/layout-tree-radial.js#options


<Pivotick
    :data="dataR"
    :options="optionsR"
></Pivotick>
