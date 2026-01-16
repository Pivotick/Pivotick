[**pivotick v0.0.1**](../README.md)

***

[pivotick](../README.md) / Pivotick

# Class: Pivotick

Defined in: [Graph.ts:15](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/Graph.ts#L15)

## Constructors

### Constructor

> **new Pivotick**(`container`, `data?`, `options?`): `Graph`

Defined in: [Graph.ts:37](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/Graph.ts#L37)

Initializes a graph inside the specified container using the provided data and options.

#### Parameters

##### container

`HTMLElement`

The HTMLElement that will serve as the main container for the graph.

##### data?

[`RelaxedGraphData`](../pivotick/namespaces/GraphOptions/interfaces/RelaxedGraphData.md)

The graph data, including nodes and edges, to render.

##### options?

`Partial`\<[`GraphOptions`](../pivotick/namespaces/GraphOptions/interfaces/GraphOptions.md)\>

Optional configuration for the graph's behavior, UI, styling, simulation, etc.

#### Returns

`Graph`

## Methods

### addEdge()

> **addEdge**(`e`): [`Edge`](Edge.md)

Defined in: [Graph.ts:353](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/Graph.ts#L353)

Adds an edge to the graph.

Both the source (`from`) and target (`to`) nodes must already exist in the graph.
Throws an error if an edge with the same ID already exists.

#### Parameters

##### e

The edge to add.

[`Edge`](Edge.md) | [`RawEdge`](../pivotick/namespaces/GraphOptions/type-aliases/RawEdge.md)

#### Returns

[`Edge`](Edge.md)

#### Throws

Error if the edge ID already exists or if either node does not exist.
Triggers `onChange` after the edge is successfully added.

***

### addNode()

> **addNode**(`n`): [`Node`](Node.md)

Defined in: [Graph.ts:270](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/Graph.ts#L270)

Adds a node to the graph.

#### Parameters

##### n

[`Node`](Node.md) | [`RawNode`](../pivotick/namespaces/GraphOptions/type-aliases/RawNode.md)

#### Returns

[`Node`](Node.md)

#### Throws

Error if a node with the same `id` already exists.
Triggers `onChange` after the node is successfully added.

***

### destroy()

> **destroy**(): `void`

Defined in: [Graph.ts:536](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/Graph.ts#L536)

Destroy all UI components.

#### Returns

`void`

***

### focusElement()

> **focusElement**(`element`): `void`

Defined in: [Graph.ts:559](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/Graph.ts#L559)

Brings the specified node or edge into focus within the graph view.

#### Parameters

##### element

The `Node` or `Edge` to focus.

[`Node`](Node.md) | [`Edge`](Edge.md)

#### Returns

`void`

***

### getAppID()

> **getAppID**(): `string`

Defined in: [Graph.ts:543](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/Graph.ts#L543)

The ID of the app

#### Returns

`string`

***

### getConnectedNodes()

> **getConnectedNodes**(`node`): [`Node`](Node.md)[]

Defined in: [Graph.ts:517](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/Graph.ts#L517)

Retrieves all nodes directly connected from the given node.

Returns cloned nodes to prevent external modifications.

#### Parameters

##### node

The node or node ID to find connections from.

`string` | [`Node`](Node.md)

#### Returns

[`Node`](Node.md)[]

An array of `Node` objects directly connected from the given node.

***

### getEdge()

> **getEdge**(`id`): [`Edge`](Edge.md) \| `undefined`

Defined in: [Graph.ts:378](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/Graph.ts#L378)

Retrieves an edge from the graph by its ID.

Returns a deep clone of the edge to prevent external mutations.

#### Parameters

##### id

`string`

The ID of the edge.

#### Returns

[`Edge`](Edge.md) \| `undefined`

A cloned `Edge` if found, otherwise `undefined`.

***

### getEdgeCount()

> **getEdgeCount**(): `number`

Defined in: [Graph.ts:423](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/Graph.ts#L423)

Returns the number of edges currently in the graph.

#### Returns

`number`

The total edge count.

***

### getEdges()

> **getEdges**(): [`Edge`](Edge.md)[]

Defined in: [Graph.ts:460](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/Graph.ts#L460)

Retrieves all edges in the graph.

Returns clones of the edges to prevent external modifications.

#### Returns

[`Edge`](Edge.md)[]

An array of cloned `Edge` objects.

***

### getEdgesFromNode()

> **getEdgesFromNode**(`node`): [`Edge`](Edge.md)[]

Defined in: [Graph.ts:487](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/Graph.ts#L487)

Finds all edges originating from a given node.

Returns cloned edges to prevent external modifications.

#### Parameters

##### node

The node or node ID to find outgoing edges from.

`string` | [`Node`](Node.md)

#### Returns

[`Edge`](Edge.md)[]

An array of `Edge` objects whose `from` node matches the query.

***

### getEdgesToNode()

> **getEdgesToNode**(`node`): [`Edge`](Edge.md)[]

Defined in: [Graph.ts:502](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/Graph.ts#L502)

Finds all edges pointing to a given node.

Returns cloned edges to prevent external modifications.

#### Parameters

##### node

The node or node ID to find incoming edges to.

`string` | [`Node`](Node.md)

#### Returns

[`Edge`](Edge.md)[]

An array of `Edge` objects whose `to` node matches the query.

***

### getMutableEdge()

> **getMutableEdge**(`id`): [`Edge`](Edge.md) \| `undefined`

Defined in: [Graph.ts:394](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/Graph.ts#L394)

Retrieves an edge from the graph by its ID.

Returns the actual edge instance, allowing direct modifications.

**Warning:** Directly modifying edges using this method may lead to unexpected behavior.
It is generally safer to use `getEdge` which returns a cloned instance.

#### Parameters

##### id

`string`

The ID of the edge.

#### Returns

[`Edge`](Edge.md) \| `undefined`

The `Edge` if found, otherwise `undefined`.

***

### getMutableEdges()

> **getMutableEdges**(): [`Edge`](Edge.md)[]

Defined in: [Graph.ts:475](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/Graph.ts#L475)

Retrieves all edges in the graph.

Returns the actual edge instances, allowing direct modifications.

#### Returns

[`Edge`](Edge.md)[]

An array of `Edge` objects.

#### Remarks

⚠️ **Warning:** Modifying edges directly may lead to unexpected behavior.
Use [getEdges](#getedges) instead to work with safe clones.

***

### getMutableNode()

> **getMutableNode**(`id`): [`Node`](Node.md) \| `undefined`

Defined in: [Graph.ts:304](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/Graph.ts#L304)

Retrieves a node from the graph by its ID.

Returns the actual node instance, allowing direct modifications.

**Warning:** Directly modifying nodes using this method may lead to unexpected behavior.
It is generally safer to use `getNode` which returns a cloned instance.

#### Parameters

##### id

The ID of the node or a Node object.

`string` | [`Node`](Node.md)

#### Returns

[`Node`](Node.md) \| `undefined`

The `Node` if found, otherwise `undefined`.

***

### getMutableNodes()

> **getMutableNodes**(): [`Node`](Node.md)[]

Defined in: [Graph.ts:449](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/Graph.ts#L449)

Retrieves all nodes in the graph.

Returns the actual node instances, allowing direct modifications.

#### Returns

[`Node`](Node.md)[]

An array of `Node` objects.

#### Remarks

⚠️ **Warning:** Modifying nodes directly may lead to unexpected behavior.
It is generally safer to use `getNodes`, which returns cloned instances.

***

### getNode()

> **getNode**(`id`): [`Node`](Node.md) \| `undefined`

Defined in: [Graph.ts:288](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/Graph.ts#L288)

Retrieves a node from the graph by its ID.

Returns a deep clone of the node to prevent external mutations.

#### Parameters

##### id

The ID of the node or a Node object.

`string` | [`Node`](Node.md)

#### Returns

[`Node`](Node.md) \| `undefined`

A cloned `Node` if found, otherwise `undefined`.

***

### getNodeCount()

> **getNodeCount**(): `number`

Defined in: [Graph.ts:414](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/Graph.ts#L414)

Returns the number of nodes currently in the graph.

#### Returns

`number`

The total node count.

***

### getNodes()

> **getNodes**(): [`Node`](Node.md)[]

Defined in: [Graph.ts:434](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/Graph.ts#L434)

Retrieves all nodes in the graph.

Returns clones of the nodes to prevent external modifications.

#### Returns

[`Node`](Node.md)[]

An array of cloned `Node` objects.

***

### getOptions()

> **getOptions**(): [`GraphOptions`](../pivotick/namespaces/GraphOptions/interfaces/GraphOptions.md)

Defined in: [Graph.ts:172](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/Graph.ts#L172)

Returns the current configuration options of the graph.

#### Returns

[`GraphOptions`](../pivotick/namespaces/GraphOptions/interfaces/GraphOptions.md)

***

### nextTick()

> **nextTick**(): `void`

Defined in: [Graph.ts:529](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/Graph.ts#L529)

Trigger the next render update of the graph.

#### Returns

`void`

***

### removeEdge()

> **removeEdge**(`id`): `void`

Defined in: [Graph.ts:404](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/Graph.ts#L404)

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

Defined in: [Graph.ts:330](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/Graph.ts#L330)

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

Defined in: [Graph.ts:568](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/Graph.ts#L568)

Selects a given node or edge in the graph.

#### Parameters

##### element

The `Node` or `Edge` to select.

[`Node`](Node.md) | [`Edge`](Edge.md)

#### Returns

`void`

***

### setData()

> **setData**(`nodes`, `edges`): `void`

Defined in: [Graph.ts:236](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/Graph.ts#L236)

Replaces all current nodes and edges in the graph with the provided data.
Clears existing nodes and edges before setting the new ones.
Triggers the `onChange` callback after the update.

#### Parameters

##### nodes

[`Node`](Node.md)[] = `[]`

Array of nodes to set. Defaults to an empty array.

##### edges

[`Edge`](Edge.md)[] = `[]`

Array of edges to set. Defaults to an empty array.

#### Returns

`void`

***

### updateData()

> **updateData**(`newNodes?`, `newEdges?`): `void`

Defined in: [Graph.ts:204](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/Graph.ts#L204)

Updates the graph with new nodes and/or edges.

Existing nodes or edges with matching IDs are replaced; new ones are added.
Triggers the `onChange` callback if any updates were applied.

#### Parameters

##### newNodes?

[`Node`](Node.md)[]

Optional array of nodes to update or add.

##### newEdges?

[`Edge`](Edge.md)[]

Optional array of edges to update or add.
Triggers `onChange`

#### Returns

`void`

## Properties

### notifier

> **notifier**: [`Notifier`](../interfaces/Notifier.md)

Defined in: [Graph.ts:20](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/Graph.ts#L20)

***

### ready

> **ready**: `Promise`\<`void`\>

Defined in: [Graph.ts:28](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/Graph.ts#L28)

***

### renderer

> **renderer**: [`GraphRenderer`](../interfaces/GraphRenderer.md)

Defined in: [Graph.ts:21](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/Graph.ts#L21)

***

### simulation

> **simulation**: [`Simulation`](../interfaces/Simulation.md)

Defined in: [Graph.ts:22](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/Graph.ts#L22)
