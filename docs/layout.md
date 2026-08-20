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
| `spacing`               | `'auto' \| 'manual'` | `'auto'` | Whether the two multipliers below tune themselves from the size of the nodes and the shape of the tree. Setting either one explicitly implies `'manual'`. |
| `levelSpacing`          | `number`  | `1`               | Multiplies the distance between consecutive levels (between rings, when `radial`). `1` fits the tree to the canvas, as before.               |
| `siblingSpacing`        | `number`  | `1`               | Multiplies the distance between nodes *within* a level. Ignored when `radial`, where a level always spans the full circle.                   |
| `flipEdgeDirection`     | `boolean` | `false`           | Flip the direction of edges in the layout.                                                                                                  |


#### Tree Root Finder
In a tree-based layout, one node must be designated as the root. You can specify the root node using the `rootId` option.

If you're unsure which node should be the root, don't worry! Pivotick will automatically select one using the algorithm defined in `rootIdAlgorithmFinder`.

Similarly, the `flipEdgeDirection` option lets you reverse the direction of edges in a directed graph (so `A -> B` becomes `B -> A`)—this only affects the layout computation, not the underlying graph data.

#### Spacing

A tree is laid out to *fit* the canvas, so its natural spacing already follows the canvas size and
how deep and wide the tree is. `levelSpacing` and `siblingSpacing` scale that fitted geometry: `2`
means "twice as far apart as the fitted layout" on the depth and breadth axis respectively. Both
default to `1`, which is the fitted layout itself.

They can also be changed at runtime — the Physics flyout offers them as sliders whenever a tree
layout is active (in place of the simulation knobs, which a tree layout ignores):

```ts
graph.simulation.setTreeSpacing({ levelSpacing: 2 })
graph.simulation.getTreeSpacing() // { levelSpacing: 2, siblingSpacing: 1 }
```

#### Auto spacing

By default the tree works its own spacing out. A tree layout is sized from the canvas and never
looks at how big the nodes are, so a tree of small dots and a tree of large labelled nodes are laid
out identically — and the second one overlaps. `spacing: 'auto'` measures the tightest pair of
neighbours on each axis, works out what they need for their radii (plus room for an arrowhead
between levels), and scales the multipliers to suit. It re-derives them whenever the graph changes.

Two things it deliberately will not do:

- **It never packs a tree tighter than the fitted layout.** Auto only ever raises a multiplier above
  `1`, so a graph that was never crowded is laid out exactly as it always was.
- **It never overrides a choice you made.** A tree that sets `levelSpacing` or `siblingSpacing` is
  taken as having made up its mind, and moving either slider by hand leaves auto for good. Hand the
  multipliers back with `simulation.enableAutoTreeSpacing()`.

In the `radial` layout, where a level always spans the full circle, crowding within a ring can only
be relieved by pushing the rings further out — so both measurements drive `levelSpacing` there.


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
