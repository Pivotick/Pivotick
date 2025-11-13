[**pivotick v0.0.0**](../../../../README.md)

***

[pivotick](../../../../README.md) / [RendererOptions](../README.md) / GraphRendererOptions

# Interface: GraphRendererOptions

Defined in: [interfaces/RendererOptions.ts:5](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/RendererOptions.ts#L5)

## Properties

### defaultEdgeStyle

> **defaultEdgeStyle**: [`EdgeStyle`](EdgeStyle.md)

Defined in: [interfaces/RendererOptions.ts:70](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/RendererOptions.ts#L70)

The default edge style to be applied on all nodes

***

### defaultLabelStyle

> **defaultLabelStyle**: [`LabelStyle`](LabelStyle.md)

Defined in: [interfaces/RendererOptions.ts:74](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/RendererOptions.ts#L74)

The default edge's label style to be applied on all nodes

***

### defaultNodeStyle

> **defaultNodeStyle**: [`NodeStyle`](NodeStyle.md)

Defined in: [interfaces/RendererOptions.ts:66](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/RendererOptions.ts#L66)

The default node style to be applied on all nodes

***

### markerStyleMap?

> `optional` **markerStyleMap**: `Record`\<`string`, [`MarkerStyle`](MarkerStyle.md)\>

Defined in: [interfaces/RendererOptions.ts:89](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/RendererOptions.ts#L89)

Defines custom styles for marker shapes used in the graph.

Each key is a marker type (e.g., `'diamond'`, `'arrow'`) and maps to a `MarkerStyle` object.

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

Defined in: [interfaces/RendererOptions.ts:123](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/RendererOptions.ts#L123)

#### Default

```ts
10
```

***

### minZoom

> **minZoom**: `number`

Defined in: [interfaces/RendererOptions.ts:121](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/RendererOptions.ts#L121)

#### Default

```ts
0.1
```

***

### nodeStyleMap?

> `optional` **nodeStyleMap**: `Record`\<`string`, [`NodeStyle`](NodeStyle.md)\>

Defined in: [interfaces/RendererOptions.ts:119](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/RendererOptions.ts#L119)

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

Defined in: [interfaces/RendererOptions.ts:102](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/RendererOptions.ts#L102)

Function to access the type of a node. Used in 

Used to style nodes based on their type.

#### Parameters

##### node

[`Node`](../../Node/classes/Node.md)

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

Defined in: [interfaces/RendererOptions.ts:62](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/RendererOptions.ts#L62)

Custom renderer for edge labels.

Allows full control over how edge labels are displayed.
The function can return either:
- An `HTMLElement` to be used as the edge's label, or
- A string to render inside the label

#### Parameters

##### edge

[`Edge`](../../Edge/classes/Edge.md)

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

Defined in: [interfaces/RendererOptions.ts:37](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/RendererOptions.ts#L37)

Custom renderer for nodes.

Allows full control over how a node is displayed
The function can return either:
- An `HTMLElement` to be used as the node, or
- A string to render inside the node

#### Parameters

##### node

[`Node`](../../Node/classes/Node.md)

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

### type

> **type**: [`RendererType`](../type-aliases/RendererType.md)

Defined in: [interfaces/RendererOptions.ts:10](https://github.com/mokaddem/Pivotick/blob/4de0f7ea1ebfc718873aa7f04f3d018244416bc1/src/interfaces/RendererOptions.ts#L10)

Defines the rendering method used by the graph.
