[**pivotick v0.0.0**](../../../../README.md)

***

[pivotick](../../../../README.md) / [RendererOptions](../README.md) / GraphRendererOptions

# Interface: GraphRendererOptions

Defined in: [interfaces/RendererOptions.ts:8](https://github.com/mokaddem/Pivotick/blob/53114f6e22d5e6b41c897cd60c97c81156aff45a/src/interfaces/RendererOptions.ts#L8)

## Properties

### defaultEdgeStyle

> **defaultEdgeStyle**: [`EdgeStyle`](EdgeStyle.md)

Defined in: [interfaces/RendererOptions.ts:75](https://github.com/mokaddem/Pivotick/blob/53114f6e22d5e6b41c897cd60c97c81156aff45a/src/interfaces/RendererOptions.ts#L75)

The default edge style to be applied on all nodes

#### Default Value

[defaultEdgeStyleValue](../../../../variables/defaultEdgeStyleValue.md)

***

### defaultLabelStyle

> **defaultLabelStyle**: [`LabelStyle`](LabelStyle.md)

Defined in: [interfaces/RendererOptions.ts:80](https://github.com/mokaddem/Pivotick/blob/53114f6e22d5e6b41c897cd60c97c81156aff45a/src/interfaces/RendererOptions.ts#L80)

The default edge's label style to be applied on all nodes

#### Default Value

[defaultLabelStyleValue](../../../../variables/defaultLabelStyleValue.md)

***

### defaultNodeStyle

> **defaultNodeStyle**: [`NodeStyle`](NodeStyle.md)

Defined in: [interfaces/RendererOptions.ts:70](https://github.com/mokaddem/Pivotick/blob/53114f6e22d5e6b41c897cd60c97c81156aff45a/src/interfaces/RendererOptions.ts#L70)

The default node style to be applied on all nodes

#### Default Value

[defaultNodeStyleValue](../../../../variables/defaultNodeStyleValue.md)

***

### markerStyleMap?

> `optional` **markerStyleMap**: [`MarkerStyleMap`](../type-aliases/MarkerStyleMap.md)

Defined in: [interfaces/RendererOptions.ts:96](https://github.com/mokaddem/Pivotick/blob/53114f6e22d5e6b41c897cd60c97c81156aff45a/src/interfaces/RendererOptions.ts#L96)

Defines custom styles for marker shapes used in the graph.

Each key is a marker type (e.g., `'diamond'`, `'arrow'`) and maps to a `MarkerStyle` object.

#### Default Value

[defaultMarkerStyleMap](../../../../variables/defaultMarkerStyleMap.md)

#### Example

```ts
markerStyleMap: {
  'diamond': {
    fill: '#44c77f',
  },
}
```

***

### maxZoom

> **maxZoom**: `number`

Defined in: [interfaces/RendererOptions.ts:132](https://github.com/mokaddem/Pivotick/blob/53114f6e22d5e6b41c897cd60c97c81156aff45a/src/interfaces/RendererOptions.ts#L132)

#### Default

```ts
10
```

***

### minZoom

> **minZoom**: `number`

Defined in: [interfaces/RendererOptions.ts:130](https://github.com/mokaddem/Pivotick/blob/53114f6e22d5e6b41c897cd60c97c81156aff45a/src/interfaces/RendererOptions.ts#L130)

#### Default

```ts
0.1
```

***

### nodeStyleMap?

> `optional` **nodeStyleMap**: `Record`\<`string`, [`NodeStyle`](NodeStyle.md)\>

Defined in: [interfaces/RendererOptions.ts:126](https://github.com/mokaddem/Pivotick/blob/53114f6e22d5e6b41c897cd60c97c81156aff45a/src/interfaces/RendererOptions.ts#L126)

Maps node types to their styles.

Each key is a node type (as returned by `nodeTypeAccessor`) and maps to a `NodeStyle` object.

#### Remarks

Used in conjuction with [nodeTypeAccessor](#nodetypeaccessor)

#### Example

```ts
nodeStyleMap: {
  'hub': { shape: 'hexagon', color: '#aaa', size: 30 },
  'spoke': { shape: 'triangle', color: '#f00' },
}
```

***

### nodeTypeAccessor()?

> `optional` **nodeTypeAccessor**: (`node`) => `string` \| `undefined`

Defined in: [interfaces/RendererOptions.ts:109](https://github.com/mokaddem/Pivotick/blob/53114f6e22d5e6b41c897cd60c97c81156aff45a/src/interfaces/RendererOptions.ts#L109)

Function to access the type of a node. Used in 

Used to style nodes based on their type.

#### Parameters

##### node

[`Node`](../../../../classes/Node.md)

#### Returns

`string` \| `undefined`

#### Remarks

Used in conjuction with [nodeStyleMap](#nodestylemap)

#### Example

```ts
nodeTypeAccessor: (node) => node.getData()?.type
```

***

### renderLabel()?

> `optional` **renderLabel**: (`edge`) => `string` \| `void` \| `HTMLElement`

Defined in: [interfaces/RendererOptions.ts:65](https://github.com/mokaddem/Pivotick/blob/53114f6e22d5e6b41c897cd60c97c81156aff45a/src/interfaces/RendererOptions.ts#L65)

Custom renderer for edge labels.

Allows full control over how edge labels are displayed.
The function can return either:
- An `HTMLElement` to be used as the edge's label, or
- A string to render inside the label

#### Parameters

##### edge

[`Edge`](../../../../classes/Edge.md)

#### Returns

`string` \| `void` \| `HTMLElement`

#### Example

```ts
renderLabel: (edge: Edge): HTMLElement | string | void => {
  const style = [
    'display:inline-block',
    'background-color:#907acc',
    'border: 2px solid #fff',
    'border-radius:50%',
    'opacity: 1',
  ].join(';');

  const text = edge.getData().label;
  return `<span style="${style}">${text}</span>`;
}
```

***

### renderNode()?

> `optional` **renderNode**: (`node`) => `string` \| `void` \| `HTMLElement`

Defined in: [interfaces/RendererOptions.ts:40](https://github.com/mokaddem/Pivotick/blob/53114f6e22d5e6b41c897cd60c97c81156aff45a/src/interfaces/RendererOptions.ts#L40)

Custom renderer for nodes.

Allows full control over how a node is displayed
The function can return either:
- An `HTMLElement` to be used as the node, or
- A string to render inside the node

#### Parameters

##### node

[`Node`](../../../../classes/Node.md)

#### Returns

`string` \| `void` \| `HTMLElement`

#### Example

```ts
renderNode: (node: Node): HTMLElement | string | void => {
  const size = 12;
  const style = [
    'display:block',
    `width:${size}px`,
    `height:${size}px`,
    'background-color:#907acc',
    'border: 2px solid #fff',
    'border-radius:50%',
    'opacity: 1',
  ].join(';');

  return `<span style="${style}"></span>`;
}
```

***

### selectionBox

> **selectionBox**: [`SelectionBox`](SelectionBox.md)

Defined in: [interfaces/RendererOptions.ts:133](https://github.com/mokaddem/Pivotick/blob/53114f6e22d5e6b41c897cd60c97c81156aff45a/src/interfaces/RendererOptions.ts#L133)

***

### type

> **type**: [`RendererType`](../type-aliases/RendererType.md)

Defined in: [interfaces/RendererOptions.ts:13](https://github.com/mokaddem/Pivotick/blob/53114f6e22d5e6b41c897cd60c97c81156aff45a/src/interfaces/RendererOptions.ts#L13)

Defines the rendering method used by the graph.

***

### zoomEnabled

> **zoomEnabled**: `boolean`

Defined in: [interfaces/RendererOptions.ts:128](https://github.com/mokaddem/Pivotick/blob/53114f6e22d5e6b41c897cd60c97c81156aff45a/src/interfaces/RendererOptions.ts#L128)

#### Default

```ts
true
```
