[**pivotick v0.0.0**](../README.md)

***

[pivotick](../README.md) / Edge

# Class: Edge

Defined in: [Edge.ts:12](https://github.com/mokaddem/Pivotick/blob/08b3201af551806e821218a23b09b3df243be1a9/src/Edge.ts#L12)

Represents an edge (connection) between two nodes in a graph.

## Accessors

### source

#### Get Signature

> **get** **source**(): [`Node`](Node.md)

Defined in: [Edge.ts:45](https://github.com/mokaddem/Pivotick/blob/08b3201af551806e821218a23b09b3df243be1a9/src/Edge.ts#L45)

Required by d3-force

##### Returns

[`Node`](Node.md)

***

### target

#### Get Signature

> **get** **target**(): [`Node`](Node.md)

Defined in: [Edge.ts:48](https://github.com/mokaddem/Pivotick/blob/08b3201af551806e821218a23b09b3df243be1a9/src/Edge.ts#L48)

##### Returns

[`Node`](Node.md)

## Constructors

### Constructor

> **new Edge**(`id`, `from`, `to`, `data?`, `style?`, `directed?`): `Edge`

Defined in: [Edge.ts:30](https://github.com/mokaddem/Pivotick/blob/08b3201af551806e821218a23b09b3df243be1a9/src/Edge.ts#L30)

Create a new Edge instance.

#### Parameters

##### id

`string`

Unique identifier for the edge

##### from

[`Node`](Node.md)

Source node

##### to

[`Node`](Node.md)

Target node

##### data?

`EdgeData`

Optional data payload for the edge

##### style?

`Partial`\<[`EdgeFullStyle`](../pivotick/namespaces/RendererOptions/interfaces/EdgeFullStyle.md)\>

Optional style for the edge

##### directed?

`boolean` | `null`

#### Returns

`Edge`

## Methods

### clearDirty()

> **clearDirty**(): `void`

Defined in: [Edge.ts:165](https://github.com/mokaddem/Pivotick/blob/08b3201af551806e821218a23b09b3df243be1a9/src/Edge.ts#L165)

#### Returns

`void`

***

### clone()

> **clone**(): `Edge`

Defined in: [Edge.ts:145](https://github.com/mokaddem/Pivotick/blob/08b3201af551806e821218a23b09b3df243be1a9/src/Edge.ts#L145)

#### Returns

`Edge`

***

### getData()

> **getData**(): `EdgeData`

Defined in: [Edge.ts:55](https://github.com/mokaddem/Pivotick/blob/08b3201af551806e821218a23b09b3df243be1a9/src/Edge.ts#L55)

Get the edge's data.

#### Returns

`EdgeData`

***

### getEdgeStyle()

> **getEdgeStyle**(): `Partial`\<[`EdgeStyle`](../pivotick/namespaces/RendererOptions/interfaces/EdgeStyle.md)\>

Defined in: [Edge.ts:87](https://github.com/mokaddem/Pivotick/blob/08b3201af551806e821218a23b09b3df243be1a9/src/Edge.ts#L87)

Get the edge's style.

#### Returns

`Partial`\<[`EdgeStyle`](../pivotick/namespaces/RendererOptions/interfaces/EdgeStyle.md)\>

***

### getGraphElement()

> **getGraphElement**(): `SVGGElement` \| `null`

Defined in: [Edge.ts:120](https://github.com/mokaddem/Pivotick/blob/08b3201af551806e821218a23b09b3df243be1a9/src/Edge.ts#L120)

#### Returns

`SVGGElement` \| `null`

***

### getLabelStyle()

> **getLabelStyle**(): `Partial`\<[`LabelStyle`](../pivotick/namespaces/RendererOptions/interfaces/LabelStyle.md)\>

Defined in: [Edge.ts:94](https://github.com/mokaddem/Pivotick/blob/08b3201af551806e821218a23b09b3df243be1a9/src/Edge.ts#L94)

Get the edge's label style if available.

#### Returns

`Partial`\<[`LabelStyle`](../pivotick/namespaces/RendererOptions/interfaces/LabelStyle.md)\>

***

### getStyle()

> **getStyle**(): `Partial`\<[`EdgeFullStyle`](../pivotick/namespaces/RendererOptions/interfaces/EdgeFullStyle.md)\>

Defined in: [Edge.ts:80](https://github.com/mokaddem/Pivotick/blob/08b3201af551806e821218a23b09b3df243be1a9/src/Edge.ts#L80)

Get the edge's style.

#### Returns

`Partial`\<[`EdgeFullStyle`](../pivotick/namespaces/RendererOptions/interfaces/EdgeFullStyle.md)\>

***

### isDirty()

> **isDirty**(): `boolean`

Defined in: [Edge.ts:169](https://github.com/mokaddem/Pivotick/blob/08b3201af551806e821218a23b09b3df243be1a9/src/Edge.ts#L169)

#### Returns

`boolean`

***

### markDirty()

> **markDirty**(): `void`

Defined in: [Edge.ts:161](https://github.com/mokaddem/Pivotick/blob/08b3201af551806e821218a23b09b3df243be1a9/src/Edge.ts#L161)

#### Returns

`void`

***

### setData()

> **setData**(`newData`): `void`

Defined in: [Edge.ts:63](https://github.com/mokaddem/Pivotick/blob/08b3201af551806e821218a23b09b3df243be1a9/src/Edge.ts#L63)

Update the edge's data.

#### Parameters

##### newData

`EdgeData`

New data to set

#### Returns

`void`

***

### setFrom()

> **setFrom**(`node`): `void`

Defined in: [Edge.ts:125](https://github.com/mokaddem/Pivotick/blob/08b3201af551806e821218a23b09b3df243be1a9/src/Edge.ts#L125)

#### Parameters

##### node

[`Node`](Node.md)

#### Returns

`void`

***

### setStyle()

> **setStyle**(`newStyle`): `void`

Defined in: [Edge.ts:102](https://github.com/mokaddem/Pivotick/blob/08b3201af551806e821218a23b09b3df243be1a9/src/Edge.ts#L102)

Update the edge's style.

#### Parameters

##### newStyle

[`EdgeFullStyle`](../pivotick/namespaces/RendererOptions/interfaces/EdgeFullStyle.md)

New style to set

#### Returns

`void`

***

### setTo()

> **setTo**(`node`): `void`

Defined in: [Edge.ts:129](https://github.com/mokaddem/Pivotick/blob/08b3201af551806e821218a23b09b3df243be1a9/src/Edge.ts#L129)

#### Parameters

##### node

[`Node`](Node.md)

#### Returns

`void`

***

### toJSON()

> **toJSON**(): `object`

Defined in: [Edge.ts:136](https://github.com/mokaddem/Pivotick/blob/08b3201af551806e821218a23b09b3df243be1a9/src/Edge.ts#L136)

Convert edge to a simple JSON object representation.

#### Returns

`object`

##### data

> **data**: `EdgeData`

##### from

> **from**: `string`

##### id

> **id**: `string`

##### to

> **to**: `string`

***

### updateData()

> **updateData**(`partialData`): `void`

Defined in: [Edge.ts:72](https://github.com/mokaddem/Pivotick/blob/08b3201af551806e821218a23b09b3df243be1a9/src/Edge.ts#L72)

Merge partial data into the current edge data.

#### Parameters

##### partialData

`Partial`\<`EdgeData`\>

Partial data object to merge

#### Returns

`void`

***

### updateStyle()

> **updateStyle**(`partialStyle`): `void`

Defined in: [Edge.ts:112](https://github.com/mokaddem/Pivotick/blob/08b3201af551806e821218a23b09b3df243be1a9/src/Edge.ts#L112)

Merge partial style into the current edge style.
Useful for updating only parts of the style.

#### Parameters

##### partialStyle

[`PartialEdgeFullStyle`](../pivotick/namespaces/RendererOptions/interfaces/PartialEdgeFullStyle.md)

Partial style object to merge

#### Returns

`void`

## Properties

### directed

> `readonly` **directed**: `boolean` \| `null`

Defined in: [Edge.ts:16](https://github.com/mokaddem/Pivotick/blob/08b3201af551806e821218a23b09b3df243be1a9/src/Edge.ts#L16)

***

### domID

> `readonly` **domID**: `string`

Defined in: [Edge.ts:20](https://github.com/mokaddem/Pivotick/blob/08b3201af551806e821218a23b09b3df243be1a9/src/Edge.ts#L20)

***

### from

> **from**: [`Node`](Node.md)

Defined in: [Edge.ts:14](https://github.com/mokaddem/Pivotick/blob/08b3201af551806e821218a23b09b3df243be1a9/src/Edge.ts#L14)

***

### id

> `readonly` **id**: `string`

Defined in: [Edge.ts:13](https://github.com/mokaddem/Pivotick/blob/08b3201af551806e821218a23b09b3df243be1a9/src/Edge.ts#L13)

***

### to

> **to**: [`Node`](Node.md)

Defined in: [Edge.ts:15](https://github.com/mokaddem/Pivotick/blob/08b3201af551806e821218a23b09b3df243be1a9/src/Edge.ts#L15)
