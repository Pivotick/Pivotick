[**pivotick v0.0.0**](../../../../README.md)

***

[pivotick](../../../../README.md) / [GraphUI](../README.md) / PropertiesPanel

# Interface: PropertiesPanel

Defined in: [interfaces/GraphUI.ts:127](https://github.com/mokaddem/Pivotick/blob/2116a2cd38cc1d9ebc97e43ba16acb534cbb4251/src/interfaces/GraphUI.ts#L127)

Represents the configuration for the properties panel in the graph UI's sidebar

Defines how to compute and display properties for nodes and edges.

## Default

```ts
All key/value pairs from node.getData() or edge.getData()
```

## Properties

### edgePropertiesMap()

> **edgePropertiesMap**: (`edge`) => [`PropertyEntry`](PropertyEntry.md)[]

Defined in: [interfaces/GraphUI.ts:139](https://github.com/mokaddem/Pivotick/blob/2116a2cd38cc1d9ebc97e43ba16acb534cbb4251/src/interfaces/GraphUI.ts#L139)

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

Defined in: [interfaces/GraphUI.ts:133](https://github.com/mokaddem/Pivotick/blob/2116a2cd38cc1d9ebc97e43ba16acb534cbb4251/src/interfaces/GraphUI.ts#L133)

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

Defined in: [interfaces/GraphUI.ts:146](https://github.com/mokaddem/Pivotick/blob/2116a2cd38cc1d9ebc97e43ba16acb534cbb4251/src/interfaces/GraphUI.ts#L146)

Custom renderer for the property panel. This content will override the default sidebar property panel.

#### Default

```ts
undefined
```

#### Example

```ts
(element) => `element id: ${element.id}`
```
