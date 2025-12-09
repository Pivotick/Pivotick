[**pivotick v0.0.0**](../../../../README.md)

***

[pivotick](../../../../README.md) / [GraphUI](../README.md) / PropertiesPanel

# Interface: PropertiesPanel

Defined in: [interfaces/GraphUI.ts:85](https://github.com/mokaddem/Pivotick/blob/3401bef29564a77584895fe60983b72eea9ffb59/src/interfaces/GraphUI.ts#L85)

Represents the configuration for the properties panel in the graph UI's sidebar

Defines how to compute and display properties for nodes and edges.

## Default

```ts
All key/value pairs from node.getData() or edge.getData()
```

## Properties

### edgePropertiesMap()

> **edgePropertiesMap**: (`edge`) => [`PropertyEntry`](PropertyEntry.md)[]

Defined in: [interfaces/GraphUI.ts:97](https://github.com/mokaddem/Pivotick/blob/3401bef29564a77584895fe60983b72eea9ffb59/src/interfaces/GraphUI.ts#L97)

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

Defined in: [interfaces/GraphUI.ts:91](https://github.com/mokaddem/Pivotick/blob/3401bef29564a77584895fe60983b72eea9ffb59/src/interfaces/GraphUI.ts#L91)

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

***

### render?

> `optional` **render**: `string` \| `HTMLElement` \| (`element`) => `string` \| `HTMLElement`

Defined in: [interfaces/GraphUI.ts:104](https://github.com/mokaddem/Pivotick/blob/3401bef29564a77584895fe60983b72eea9ffb59/src/interfaces/GraphUI.ts#L104)

Custom renderer for the property panel. This content will override the default sidebar property panel.

#### Default

```ts
undefined
```

#### Example

```ts
(element) => `element id: ${element.id}`
```
