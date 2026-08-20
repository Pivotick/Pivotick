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


#### Cycles and disconnected graphs

The hierarchy is built from a breadth-first **spanning tree** rooted at `rootId`, not from the raw
edges, so neither of these stops a tree layout:

- **Cycles.** The first edge to reach a node makes it that node's parent; an edge that arrives at an
  already-placed node is simply not part of the hierarchy and is drawn crossing levels like any
  other edge. A node with two parents is likewise claimed by one of them.
- **Several components.** Each component the root cannot reach gets its own root — preferring a node
  with no incoming edges, so a component that *is* a hierarchy is drawn as one — and the components
  are laid out side by side.
- **Nodes with no edges at all.** These have no place in a hierarchy, so they are *parked* rather
  than given one: they fill the dead space beside the shallow levels, at the trailing edge of the
  layout, which a tree leaves empty because it widens as it descends. In the radial layout they take
  a ring of their own outside the last. Only nodes nothing points at *and* which point at nothing are
  parked, so no edge is ever left stretching from the tree to the parking area.

Note that `rootIdAlgorithmFinder: 'MinMaxDistance'` and `'MinHeight'` are the same search — the node
whose longest path down is shortest — and both are topological-sort based, so on a graph with a cycle
they warn and fall back to the first node. The default `'MaxReachability'` has no such limitation.

#### Tree Root Finder
In a tree-based layout, one node must be designated as the root. You can specify the root node using the `rootId` option.

If you're unsure which node should be the root, don't worry! Pivotick will automatically select one using the algorithm defined in `rootIdAlgorithmFinder`.

A named `rootId` is walked **ignoring edge direction**, so any node can root a whole tree — pick a
leaf and the graph re-hangs beneath it, with its former parent one level down. (Following the arrows
from a leaf would reach nothing, and the rest of the graph would be laid out beside it as a second
component.) The edges themselves are still drawn as they are, so a link used the other way round
renders as an arrow pointing up a level. A root the `rootIdAlgorithmFinder` chose keeps walking along
the arrows: it was read off them in the first place.

**Unless the arrows are not a hierarchy.** On data that *converges* — every leaf a source, all of them
pointing at a few hubs, which is the shape of most provenance and "seen-with" data — no node reaches
the graph along the arrows, whichever finder is asked. A directed walk then leaves nearly every node
as a root of its own, and the tree comes out as a comb of stubs with most edges flying across the
layout. So when **no node at all** can cover half of its own component by following the arrows, the
layout stops reading direction: it walks every edge both ways and re-roots at the middle of the graph.
The edges are still *drawn* exactly as they are, which means their arrows point up the tree toward the
root — the honest rendering of data that points that way.

This is a fallback, not the rule, and the test is about the graph rather than about the root that was
picked:

- Where the arrows do form a hierarchy they are the best thing to lay out by, and every finder keeps
  its own answer — including `'MinHeight'`, whose answer on a tree is always a *leaf*, reaching
  nothing on purpose. A root that covers little of the graph is only overruled when nothing else
  could have covered more.
- A graph of several separate hierarchies still comes out as a forest: coverage is measured against
  the root's own component, so a perfectly good multi-component hierarchy is not mistaken for a
  failure.
- A pinned `rootId` skips the test entirely — it is already walked ignoring direction.

A `rootId` naming a node that is not in the graph — filtered out, deleted, inside a collapsed cluster
— is ignored for as long as that is true, and the finder picks the root instead. The option is kept,
so the node coming back re-roots the tree.

The root can also be changed at runtime — the Physics flyout offers it as a menu on the `Root` row
whenever a tree layout is active. The menu names each finder and says what it does; its first entry
is "the node I have selected", which is greyed out until exactly one node is selected. Once a node is
pinned, the row shows that node's label rather than a finder's name:

```ts
graph.simulation.setTreeRoot({ rootId: 'node-42' })          // pin the tree to a node
graph.simulation.setTreeRoot({ algorithm: 'MinHeight' })     // drop the pin, let the finder choose
graph.simulation.getTreeRoot() // { rootId: undefined, algorithm: 'MinHeight' }
```

#### Spacing

A tree is laid out to *fit* the canvas, so its natural spacing already follows the canvas size and
how deep and wide the tree is. `levelSpacing` and `siblingSpacing` scale that fitted geometry: `2`
means "twice as far apart as the fitted layout" on the depth and breadth axis respectively. Both
default to `1`, which is the fitted layout itself, and both accept `0.5` to `10`.

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
