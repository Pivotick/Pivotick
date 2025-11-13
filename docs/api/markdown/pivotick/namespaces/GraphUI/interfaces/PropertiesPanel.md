[**pivotick v0.0.0**](../../../../README.md)

***

[pivotick](../../../../README.md) / [GraphUI](../README.md) / PropertiesPanel

# Interface: PropertiesPanel

Defined in: [interfaces/GraphUI.ts:120](https://github.com/mokaddem/Pivotick/blob/7b5d74b6095c72ffb15692a55e9a1e07f2f3854b/src/interfaces/GraphUI.ts#L120)

Represents the configuration for the properties panel in the graph UI's sidebar

Defines how to compute and display properties for nodes and edges.

## Default

```ts
All key/value pairs from node.getData() or edge.getData()
```

## Properties

### edgePropertiesMap()

> **edgePropertiesMap**: (`edge`) => [`PropertyEntry`](PropertyEntry.md)[]

Defined in: [interfaces/GraphUI.ts:132](https://github.com/mokaddem/Pivotick/blob/7b5d74b6095c72ffb15692a55e9a1e07f2f3854b/src/interfaces/GraphUI.ts#L132)

A function that computes the list of edge properties to display

#### Parameters

##### edge

[`Edge`](../../../../classes/Edge.md)

#### Returns

[`PropertyEntry`](PropertyEntry.md)[]

#### Default

```ts
All key/value pairs from edge.getData()
```

***

### nodePropertiesMap()

> **nodePropertiesMap**: (`node`) => [`PropertyEntry`](PropertyEntry.md)[]

Defined in: [interfaces/GraphUI.ts:126](https://github.com/mokaddem/Pivotick/blob/7b5d74b6095c72ffb15692a55e9a1e07f2f3854b/src/interfaces/GraphUI.ts#L126)

A function that computes the list of node properties to display

#### Parameters

##### node

[`Node`](../../../../classes/Node.md)

#### Returns

[`PropertyEntry`](PropertyEntry.md)[]

#### Default

```ts
All key/value pairs from node.getData()
```
