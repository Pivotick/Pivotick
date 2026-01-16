[**pivotick v0.0.1**](../README.md)

***

[pivotick](../README.md) / Node

# Class: Node

Defined in: [Node.ts:12](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/Node.ts#L12)

Represents a single node (vertex) in a graph.

## Constructors

### Constructor

> **new Node**(`id`, `data?`, `style?`): `Node`

Defined in: [Node.ts:37](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/Node.ts#L37)

Create a new Node instance.

#### Parameters

##### id

`string`

Unique identifier for the node

##### data?

[`NodeData`](../interfaces/NodeData.md)

Optional data payload associated with the node

##### style?

`Partial`\<[`NodeStyle`](../pivotick/namespaces/RendererOptions/interfaces/NodeStyle.md)\>

#### Returns

`Node`

## Methods

### clone()

> **clone**(): `Node`

Defined in: [Node.ts:156](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/Node.ts#L156)

#### Returns

`Node`

***

### degree()

> **degree**(): `number`

Defined in: [Node.ts:207](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/Node.ts#L207)

#### Returns

`number`

***

### freeze()

> **freeze**(): `void`

Defined in: [Node.ts:195](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/Node.ts#L195)

#### Returns

`void`

***

### getCircleRadius()

> **getCircleRadius**(): `number`

Defined in: [Node.ts:215](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/Node.ts#L215)

#### Returns

`number`

***

### getConnectedNodes()

> **getConnectedNodes**(): `Node`[]

Defined in: [Node.ts:96](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/Node.ts#L96)

#### Returns

`Node`[]

***

### getConnectingNodes()

> **getConnectingNodes**(): `Node`[]

Defined in: [Node.ts:102](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/Node.ts#L102)

#### Returns

`Node`[]

***

### getData()

> **getData**(): [`NodeData`](../interfaces/NodeData.md)

Defined in: [Node.ts:51](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/Node.ts#L51)

Get the node's data.

#### Returns

[`NodeData`](../interfaces/NodeData.md)

***

### getGraphElement()

> **getGraphElement**(): `SVGGElement` \| `null`

Defined in: [Node.ts:134](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/Node.ts#L134)

#### Returns

`SVGGElement` \| `null`

***

### getStyle()

> **getStyle**(): `Partial`\<[`NodeStyle`](../pivotick/namespaces/RendererOptions/interfaces/NodeStyle.md)\>

Defined in: [Node.ts:111](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/Node.ts#L111)

Get the node's data.

#### Returns

`Partial`\<[`NodeStyle`](../pivotick/namespaces/RendererOptions/interfaces/NodeStyle.md)\>

***

### setCircleRadius()

> **setCircleRadius**(`radius`): `void`

Defined in: [Node.ts:211](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/Node.ts#L211)

#### Parameters

##### radius

`number`

#### Returns

`void`

***

### setData()

> **setData**(`newData`): `void`

Defined in: [Node.ts:59](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/Node.ts#L59)

Update the node's data.

#### Parameters

##### newData

[`NodeData`](../interfaces/NodeData.md)

New data to set

#### Returns

`void`

***

### setStyle()

> **setStyle**(`newStyle`): `void`

Defined in: [Node.ts:119](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/Node.ts#L119)

Update the node's data.

#### Parameters

##### newStyle

`Partial`\<[`NodeStyle`](../pivotick/namespaces/RendererOptions/interfaces/NodeStyle.md)\>

New data to set

#### Returns

`void`

***

### toJSON()

> **toJSON**(): `object`

Defined in: [Node.ts:142](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/Node.ts#L142)

Convert node to a simple JSON object representation.

#### Returns

`object`

***

### unfreeze()

> **unfreeze**(): `void`

Defined in: [Node.ts:201](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/Node.ts#L201)

#### Returns

`void`

***

### updateData()

> **updateData**(`partialData`): `void`

Defined in: [Node.ts:69](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/Node.ts#L69)

Merge partial data into the current node data.
Useful for updating only parts of the data.

#### Parameters

##### partialData

`Partial`\<[`NodeData`](../interfaces/NodeData.md)\>

Partial data object to merge

#### Returns

`void`

***

### updateStyle()

> **updateStyle**(`partialStyle`): `void`

Defined in: [Node.ts:129](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/Node.ts#L129)

Merge partial data into the current node data.
Useful for updating only parts of the data.

#### Parameters

##### partialStyle

`Partial`\<[`NodeStyle`](../pivotick/namespaces/RendererOptions/interfaces/NodeStyle.md)\>

Partial data object to merge

#### Returns

`void`

## Properties

### defaultCircleRadius

> **defaultCircleRadius**: `number` = `10`

Defined in: [Node.ts:18](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/Node.ts#L18)

***

### domID

> `readonly` **domID**: `string`

Defined in: [Node.ts:30](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/Node.ts#L30)

***

### frozen?

> `optional` **frozen**: `boolean`

Defined in: [Node.ts:27](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/Node.ts#L27)

***

### fx?

> `optional` **fx**: `number`

Defined in: [Node.ts:25](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/Node.ts#L25)

***

### fy?

> `optional` **fy**: `number`

Defined in: [Node.ts:26](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/Node.ts#L26)

***

### id

> `readonly` **id**: `string`

Defined in: [Node.ts:13](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/Node.ts#L13)

***

### vx?

> `optional` **vx**: `number`

Defined in: [Node.ts:23](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/Node.ts#L23)

***

### vy?

> `optional` **vy**: `number`

Defined in: [Node.ts:24](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/Node.ts#L24)

***

### x?

> `optional` **x**: `number`

Defined in: [Node.ts:21](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/Node.ts#L21)

***

### y?

> `optional` **y**: `number`

Defined in: [Node.ts:22](https://github.com/mokaddem/Pivotick/blob/cf191d84f3964cc1388baf8ac05c46697d3f2b21/src/Node.ts#L22)
