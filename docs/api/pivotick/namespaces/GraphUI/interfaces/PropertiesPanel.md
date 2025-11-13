[**pivotick v0.0.0**](../../../../README.md)

***

[pivotick](../../../../README.md) / [GraphUI](../README.md) / PropertiesPanel

# Interface: PropertiesPanel

Defined in: [interfaces/GraphUI.ts:121](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/GraphUI.ts#L121)

Represents the configuration for the properties panel in the graph UI's sidebar

Defines how to compute and display properties for nodes and edges.

## Default

```ts
All key/value pairs from node.getData() or edge.getData()
```

## Properties

### edgePropertiesMap()

> **edgePropertiesMap**: (`edge`) => [`PropertyEntry`](PropertyEntry.md)[]

Defined in: [interfaces/GraphUI.ts:133](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/GraphUI.ts#L133)

A function that computes the list of edge properties to display

#### Parameters

##### edge

[`Edge`](../../Edge/classes/Edge.md)

#### Returns

[`PropertyEntry`](PropertyEntry.md)[]

#### Default

```ts
All key/value pairs from edge.getData()
```

***

### nodePropertiesMap()

> **nodePropertiesMap**: (`node`) => [`PropertyEntry`](PropertyEntry.md)[]

Defined in: [interfaces/GraphUI.ts:127](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/GraphUI.ts#L127)

A function that computes the list of node properties to display

#### Parameters

##### node

[`Node`](../../Node/classes/Node.md)

#### Returns

[`PropertyEntry`](PropertyEntry.md)[]

#### Default

```ts
All key/value pairs from node.getData()
```
