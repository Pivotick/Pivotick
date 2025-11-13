[**pivotick v0.0.0**](../README.md)

***

[pivotick](../README.md) / Pivotick

# Interface: Pivotick

Defined in: [Graph.ts:14](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/Graph.ts#L14)

## Properties

### notifier

> **notifier**: [`Notifier`](Notifier.md)

Defined in: [Graph.ts:18](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/Graph.ts#L18)

***

### renderer

> **renderer**: [`GraphRenderer`](GraphRenderer.md)

Defined in: [Graph.ts:19](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/Graph.ts#L19)

***

### simulation

> **simulation**: [`Simulation`](Simulation.md)

Defined in: [Graph.ts:20](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/Graph.ts#L20)

***

### UIManager

> **UIManager**: `UIManager`

Defined in: [Graph.ts:17](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/Graph.ts#L17)

## Methods

### addEdge()

> **addEdge**(`edge`): `void`

Defined in: [Graph.ts:245](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/Graph.ts#L245)

Adds an edge to the graph.

Both the source (`from`) and target (`to`) nodes must already exist in the graph.
Throws an error if an edge with the same ID already exists.

#### Parameters

##### edge

[`Edge`](../pivotick/namespaces/Edge/classes/Edge.md)

The edge to add.

#### Returns

`void`

#### Throws

Error if the edge ID already exists or if either node does not exist.
Triggers `onChange` after the edge is successfully added.

***

### addNode()

> **addNode**(`node`): `void`

Defined in: [Graph.ts:164](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/Graph.ts#L164)

Adds a node to the graph.

#### Parameters

##### node

[`Node`](../pivotick/namespaces/Node/classes/Node.md)

#### Returns

`void`

#### Throws

Error if a node with the same `id` already exists.
Triggers `onChange` after the node is successfully added.

***

### focusElement()

> **focusElement**(`element`): `void`

Defined in: [Graph.ts:431](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/Graph.ts#L431)

Brings the specified node or edge into focus within the graph view.

#### Parameters

##### element

The `Node` or `Edge` to focus.

[`Node`](../pivotick/namespaces/Node/classes/Node.md) | [`Edge`](../pivotick/namespaces/Edge/classes/Edge.md)

#### Returns

`void`

***

### getConnectedNodes()

> **getConnectedNodes**(`node`): [`Node`](../pivotick/namespaces/Node/classes/Node.md)[]

Defined in: [Graph.ts:403](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/Graph.ts#L403)

Retrieves all nodes directly connected from the given node.

Returns cloned nodes to prevent external modifications.

#### Parameters

##### node

The node or node ID to find connections from.

`string` | [`Node`](../pivotick/namespaces/Node/classes/Node.md)

#### Returns

[`Node`](../pivotick/namespaces/Node/classes/Node.md)[]

An array of `Node` objects directly connected from the given node.

***

### getEdge()

> **getEdge**(`id`): [`Edge`](../pivotick/namespaces/Edge/classes/Edge.md) \| `undefined`

Defined in: [Graph.ts:264](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/Graph.ts#L264)

Retrieves an edge from the graph by its ID.

Returns a deep clone of the edge to prevent external mutations.

#### Parameters

##### id

`string`

The ID of the edge.

#### Returns

[`Edge`](../pivotick/namespaces/Edge/classes/Edge.md) \| `undefined`

A cloned `Edge` if found, otherwise `undefined`.

***

### getEdgeCount()

> **getEdgeCount**(): `number`

Defined in: [Graph.ts:309](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/Graph.ts#L309)

Returns the number of edges currently in the graph.

#### Returns

`number`

The total edge count.

***

### getEdges()

> **getEdges**(): [`Edge`](../pivotick/namespaces/Edge/classes/Edge.md)[]

Defined in: [Graph.ts:345](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/Graph.ts#L345)

Retrieves all edges in the graph.

Returns clones of the edges to prevent external modifications.

#### Returns

[`Edge`](../pivotick/namespaces/Edge/classes/Edge.md)[]

An array of cloned `Edge` objects.

***

### getEdgesFromNode()

> **getEdgesFromNode**(`node`): [`Edge`](../pivotick/namespaces/Edge/classes/Edge.md)[]

Defined in: [Graph.ts:373](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/Graph.ts#L373)

Finds all edges originating from a given node.

Returns cloned edges to prevent external modifications.

#### Parameters

##### node

The node or node ID to find outgoing edges from.

`string` | [`Node`](../pivotick/namespaces/Node/classes/Node.md)

#### Returns

[`Edge`](../pivotick/namespaces/Edge/classes/Edge.md)[]

An array of `Edge` objects whose `from` node matches the query.

***

### getEdgesToNode()

> **getEdgesToNode**(`node`): [`Edge`](../pivotick/namespaces/Edge/classes/Edge.md)[]

Defined in: [Graph.ts:388](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/Graph.ts#L388)

Finds all edges pointing to a given node.

Returns cloned edges to prevent external modifications.

#### Parameters

##### node

The node or node ID to find incoming edges to.

`string` | [`Node`](../pivotick/namespaces/Node/classes/Node.md)

#### Returns

[`Edge`](../pivotick/namespaces/Edge/classes/Edge.md)[]

An array of `Edge` objects whose `to` node matches the query.

***

### getMutableEdge()

> **getMutableEdge**(`id`): [`Edge`](../pivotick/namespaces/Edge/classes/Edge.md) \| `undefined`

Defined in: [Graph.ts:280](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/Graph.ts#L280)

Retrieves an edge from the graph by its ID.

Returns the actual edge instance, allowing direct modifications.

**Warning:** Directly modifying edges using this method may lead to unexpected behavior.
It is generally safer to use `getEdge` which returns a cloned instance.

#### Parameters

##### id

`string`

The ID of the edge.

#### Returns

[`Edge`](../pivotick/namespaces/Edge/classes/Edge.md) \| `undefined`

The `Edge` if found, otherwise `undefined`.

***

### getMutableEdges()

> **getMutableEdges**(): [`Edge`](../pivotick/namespaces/Edge/classes/Edge.md)[]

Defined in: [Graph.ts:361](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/Graph.ts#L361)

Retrieves all edges in the graph.

Returns the actual edge instances, allowing direct modifications.

::: warning
Modifying edges directly may lead to unexpected behavior.
Use [getEdges](#getedges) instead to work with safe clones.
:::

#### Returns

[`Edge`](../pivotick/namespaces/Edge/classes/Edge.md)[]

An array of `Edge` objects.

***

### getMutableNode()

> **getMutableNode**(`id`): [`Node`](../pivotick/namespaces/Node/classes/Node.md) \| `undefined`

Defined in: [Graph.ts:196](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/Graph.ts#L196)

Retrieves a node from the graph by its ID.

Returns the actual node instance, allowing direct modifications.

**Warning:** Directly modifying nodes using this method may lead to unexpected behavior.
It is generally safer to use `getNode` which returns a cloned instance.

#### Parameters

##### id

The ID of the node or a Node object.

`string` | [`Node`](../pivotick/namespaces/Node/classes/Node.md)

#### Returns

[`Node`](../pivotick/namespaces/Node/classes/Node.md) \| `undefined`

The `Node` if found, otherwise `undefined`.

***

### getMutableNodes()

> **getMutableNodes**(): [`Node`](../pivotick/namespaces/Node/classes/Node.md)[]

Defined in: [Graph.ts:334](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/Graph.ts#L334)

Retrieves all nodes in the graph.

Returns the actual node instances, allowing direct modifications.

**Warning:** Modifying nodes directly may lead to unexpected behavior.
It is generally safer to use `getNodes`, which returns cloned instances.

#### Returns

[`Node`](../pivotick/namespaces/Node/classes/Node.md)[]

An array of `Node` objects.

***

### getNode()

> **getNode**(`id`): [`Node`](../pivotick/namespaces/Node/classes/Node.md) \| `undefined`

Defined in: [Graph.ts:180](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/Graph.ts#L180)

Retrieves a node from the graph by its ID.

Returns a deep clone of the node to prevent external mutations.

#### Parameters

##### id

The ID of the node or a Node object.

`string` | [`Node`](../pivotick/namespaces/Node/classes/Node.md)

#### Returns

[`Node`](../pivotick/namespaces/Node/classes/Node.md) \| `undefined`

A cloned `Node` if found, otherwise `undefined`.

***

### getNodeCount()

> **getNodeCount**(): `number`

Defined in: [Graph.ts:300](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/Graph.ts#L300)

Returns the number of nodes currently in the graph.

#### Returns

`number`

The total node count.

***

### getNodes()

> **getNodes**(): [`Node`](../pivotick/namespaces/Node/classes/Node.md)[]

Defined in: [Graph.ts:320](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/Graph.ts#L320)

Retrieves all nodes in the graph.

Returns clones of the nodes to prevent external modifications.

#### Returns

[`Node`](../pivotick/namespaces/Node/classes/Node.md)[]

An array of cloned `Node` objects.

***

### getOptions()

> **getOptions**(): [`GraphOptions`](../pivotick/namespaces/GraphOptions/interfaces/GraphOptions.md)

Defined in: [Graph.ts:68](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/Graph.ts#L68)

Returns the current configuration options of the graph.

#### Returns

[`GraphOptions`](../pivotick/namespaces/GraphOptions/interfaces/GraphOptions.md)

***

### nextTick()

> **nextTick**(): `void`

Defined in: [Graph.ts:415](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/Graph.ts#L415)

Trigger the next render update of the graph.

#### Returns

`void`

***

### removeEdge()

> **removeEdge**(`id`): `void`

Defined in: [Graph.ts:290](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/Graph.ts#L290)

Removes an edge from the graph by its ID.

#### Parameters

##### id

`string`

The ID of the edge to remove.
Triggers `onChange` after the edge is removed.

#### Returns

`void`

***

### removeNode()

> **removeNode**(`id`): `void`

Defined in: [Graph.ts:222](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/Graph.ts#L222)

Removes a node from the graph by its ID.

Also removes any edges connected to the node.

#### Parameters

##### id

`string`

The ID of the node to remove.
Triggers `onChange` after the node and its edges are removed.

#### Returns

`void`

***

### selectElement()

> **selectElement**(`element`): `void`

Defined in: [Graph.ts:440](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/Graph.ts#L440)

Selects a given node or edge in the graph.

#### Parameters

##### element

The `Node` or `Edge` to select.

[`Node`](../pivotick/namespaces/Node/classes/Node.md) | [`Edge`](../pivotick/namespaces/Edge/classes/Edge.md)

#### Returns

`void`

***

### setData()

> **setData**(`nodes`, `edges`): `void`

Defined in: [Graph.ts:132](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/Graph.ts#L132)

Replaces all current nodes and edges in the graph with the provided data.
Clears existing nodes and edges before setting the new ones.
Triggers the `onChange` callback after the update.

#### Parameters

##### nodes

[`Node`](../pivotick/namespaces/Node/classes/Node.md)[] = `[]`

Array of nodes to set. Defaults to an empty array.

##### edges

[`Edge`](../pivotick/namespaces/Edge/classes/Edge.md)[] = `[]`

Array of edges to set. Defaults to an empty array.

#### Returns

`void`

***

### updateData()

> **updateData**(`newNodes?`, `newEdges?`): `void`

Defined in: [Graph.ts:100](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/Graph.ts#L100)

Updates the graph with new nodes and/or edges.

Existing nodes or edges with matching IDs are replaced; new ones are added.
Triggers the `onChange` callback if any updates were applied.

#### Parameters

##### newNodes?

[`Node`](../pivotick/namespaces/Node/classes/Node.md)[]

Optional array of nodes to update or add.

##### newEdges?

[`Edge`](../pivotick/namespaces/Edge/classes/Edge.md)[]

Optional array of edges to update or add.
Triggers `onChange`

#### Returns

`void`
